import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import {
  OFFICIAL_HIERARCHY_TREE,
  OFFICIAL_MATERIA,
  mapQuestionToOfficialHierarchy,
  Official5LevelHierarchy,
} from './src/types/hierarchyTree';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// Helper to format the official hierarchy tree for Gemini prompt
function getHierarchyTreePromptSummary(): string {
  const lines: string[] = [
    `MATÉRIA ÚNICA: "${OFFICIAL_MATERIA}"`,
    'ESTRUTURA HIERÁRQUICA OFICIAL (5 NÍVEIS):',
  ];

  for (const mod of OFFICIAL_HIERARCHY_TREE) {
    lines.push(`\n- MÓDULO: "${mod.id}" (${mod.label})`);
    for (const cap of mod.capitulos || []) {
      lines.push(`  * CAPÍTULO: "${cap.label}" (id: ${cap.id})`);
      if (cap.temas && cap.temas.length > 0) {
        lines.push(`    TEMAS DO CAPÍTULO: ${cap.temas.join('; ')}`);
      }
      for (const sub of cap.subtopicos || []) {
        lines.push(`    > SUBTÓPICO: "${sub.label}" (id: ${sub.id})`);
        if (sub.temas && sub.temas.length > 0) {
          lines.push(`      TEMAS: ${sub.temas.join('; ')}`);
        }
      }
    }
  }

  return lines.join('\n');
}

// Cooldown timestamp to prevent 429 quota spamming
let geminiRateLimitCooldown = 0;

// API endpoint to classify questions using Gemini 3.8 Flash
app.post('/api/ai/classify-questions', async (req, res) => {
  try {
    const { questions } = req.body;
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.json({ success: true, usingAI: false, results: [] });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const isUnderRateLimit = Date.now() < geminiRateLimitCooldown;

    // If no API key configured on server or in 429 cooldown, use official heuristic mapper preserving carimbos
    if (!apiKey || isUnderRateLimit) {
      if (isUnderRateLimit) {
        console.log('Gemini API em cooldown de cota (429). Aplicando mapeador heurístico oficial.');
      } else {
        console.warn('Server: GEMINI_API_KEY not set. Using official heuristic hierarchy mapper.');
      }
      const fallbackResults = questions.map((q) => {
        if (q.carimbado || (q.modulo && q.capitulo)) {
          return {
            id: q.id,
            materia: q.materia || OFFICIAL_MATERIA,
            modulo: q.modulo || 'Módulo I',
            capitulo: q.capitulo || '',
            subtopico: q.subtopico || '',
            tema: q.tema || q.tema_subtopico || '',
            carimbado: true,
          };
        }
        const mapped = mapQuestionToOfficialHierarchy(q);
        return { id: q.id, ...mapped };
      });
      return res.json({ success: true, usingAI: false, results: fallbackResults });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const treeSummary = getHierarchyTreePromptSummary();
    const results: Array<Official5LevelHierarchy & { id: string }> = [];

    // Process questions in batches of 25 to reduce API call count and stay within 5 RPM quota
    const chunkSize = 25;
    let switchedToHeuristic = false;

    for (let i = 0; i < questions.length; i += chunkSize) {
      const chunk = questions.slice(i, i + chunkSize);

      // If previous chunk hit quota limit, directly map this chunk using official heuristic
      if (switchedToHeuristic) {
        for (const q of chunk) {
          if (q.carimbado || (q.modulo && q.capitulo)) {
            results.push({
              id: q.id,
              materia: q.materia || OFFICIAL_MATERIA,
              modulo: q.modulo || 'Módulo I',
              capitulo: q.capitulo || '',
              subtopico: q.subtopico || '',
              tema: q.tema || q.tema_subtopico || '',
            });
          } else {
            const mapped = mapQuestionToOfficialHierarchy(q);
            results.push({ id: q.id, ...mapped });
          }
        }
        continue;
      }

      // Filter only questions that truly need AI classification (not yet carimbadas or categorized)
      const needAi = chunk.filter((q) => !(q.carimbado || (q.modulo && q.capitulo)));

      if (needAi.length === 0) {
        // All questions in this chunk already have module/chapter defined
        for (const q of chunk) {
          results.push({
            id: q.id,
            materia: q.materia || OFFICIAL_MATERIA,
            modulo: q.modulo || 'Módulo I',
            capitulo: q.capitulo || '',
            subtopico: q.subtopico || '',
            tema: q.tema || q.tema_subtopico || '',
          });
        }
        continue;
      }

      try {
        const questionsPrompt = needAi.map((q, idx) => ({
          index: idx,
          id: q.id,
          enunciado: (q.enunciado || '').slice(0, 450),
          materia_atual: q.materia || '',
          modulo_atual: q.modulo || '',
          capitulo_atual: q.capitulo || '',
          subtopico_atual: q.subtopico || '',
          tema_atual: q.tema || q.tema_subtopico || '',
          gabarito: (q.gabarito_comentado || '').slice(0, 300),
        }));

        const prompt = `Você é um perito examinador da Polícia Federal e professor especializado.
Sua tarefa é analisar cada questão e associar à sua hierarquia correspondente na árvore oficial de Investigação Policial II.

REGRAS OBRIGATÓRIAS:
1. Para cada questão, classifique com base na árvore oficial.
2. materia: "${OFFICIAL_MATERIA}".
3. modulo: Atribua um dos módulos válidos da árvore oficial (ex: "Módulo I", "Módulo II", etc.).
4. capitulo: Atribua o capítulo correspondente.
5. subtopico: Se aplicável, atribua o subtópico correspondente ou vazio "".
6. tema: Atribua o tema específico correspondente ou vazio "".

ÁRVORE OFICIAL:
${treeSummary}

QUESTÕES A CLASSIFICAR:
${JSON.stringify(questionsPrompt, null, 2)}
`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              description: 'Lista com as classificações de cada questão',
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  materia: { type: Type.STRING },
                  modulo: { type: Type.STRING },
                  capitulo: { type: Type.STRING },
                  subtopico: { type: Type.STRING },
                  tema: { type: Type.STRING },
                },
                required: ['id', 'materia', 'modulo', 'capitulo', 'subtopico', 'tema'],
              },
            },
          },
        });

        const responseText = response.text || '[]';
        const parsed = JSON.parse(responseText) as Array<{
          id: string;
          materia: string;
          modulo: string;
          capitulo: string;
          subtopico: string;
          tema: string;
        }>;

        const returnedIds = new Set<string>();
        for (const item of parsed) {
          if (item && item.id) {
            returnedIds.add(item.id);
            results.push({
              id: item.id,
              materia: item.materia || OFFICIAL_MATERIA,
              modulo: item.modulo || 'Módulo I',
              capitulo: item.capitulo || '',
              subtopico: item.subtopico || '',
              tema: item.tema || '',
            });
          }
        }

        // For questions in chunk: either carimbadas, returned from AI, or heuristic fallback
        for (const q of chunk) {
          if (q.carimbado || (q.modulo && q.capitulo)) {
            results.push({
              id: q.id,
              materia: q.materia || OFFICIAL_MATERIA,
              modulo: q.modulo || 'Módulo I',
              capitulo: q.capitulo || '',
              subtopico: q.subtopico || '',
              tema: q.tema || q.tema_subtopico || '',
            });
          } else if (!returnedIds.has(q.id)) {
            const mapped = mapQuestionToOfficialHierarchy(q);
            results.push({ id: q.id, ...mapped });
          }
        }
      } catch (chunkErr: any) {
        const errMsg = String(chunkErr?.message || chunkErr || '');
        const isQuota429 =
          chunkErr?.status === 429 ||
          errMsg.includes('429') ||
          errMsg.includes('RESOURCE_EXHAUSTED') ||
          errMsg.includes('Quota exceeded');

        if (isQuota429) {
          geminiRateLimitCooldown = Date.now() + 45000;
          switchedToHeuristic = true;
          console.warn('Cota de requisições do Gemini atingida (429/RESOURCE_EXHAUSTED). Aplicando mapeador heurístico oficial com cooldown de 45s.');
        } else {
          console.warn('Classificação via Gemini gerou aviso. Aplicando mapeador heurístico oficial:', errMsg.slice(0, 160));
        }

        for (const q of chunk) {
          if (q.carimbado || (q.modulo && q.capitulo)) {
            results.push({
              id: q.id,
              materia: q.materia || OFFICIAL_MATERIA,
              modulo: q.modulo || 'Módulo I',
              capitulo: q.capitulo || '',
              subtopico: q.subtopico || '',
              tema: q.tema || q.tema_subtopico || '',
            });
          } else {
            const mapped = mapQuestionToOfficialHierarchy(q);
            results.push({ id: q.id, ...mapped });
          }
        }
      }
    }

    return res.json({ success: true, usingAI: !switchedToHeuristic, results });
  } catch (error: any) {
    console.error('Erro na rota /api/ai/classify-questions:', error);
    const questions = req.body?.questions || [];
    const fallbackResults = questions.map((q: any) => {
      if (q.carimbado || (q.modulo && q.capitulo)) {
        return {
          id: q.id,
          materia: q.materia || OFFICIAL_MATERIA,
          modulo: q.modulo || 'Módulo I',
          capitulo: q.capitulo || '',
          subtopico: q.subtopico || '',
          tema: q.tema || q.tema_subtopico || '',
        };
      }
      const mapped = mapQuestionToOfficialHierarchy(q);
      return { id: q.id, ...mapped };
    });
    return res.json({ success: true, usingAI: false, results: fallbackResults });
  }
});

// Vite middleware in dev / Static files in production
if (process.env.NODE_ENV !== 'production') {
  const { createServer } = await import('vite');
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
