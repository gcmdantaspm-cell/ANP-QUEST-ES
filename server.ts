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

// API endpoint to classify questions using Gemini 3.8 Flash
app.post('/api/ai/classify-questions', async (req, res) => {
  try {
    const { questions } = req.body;
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.json({ success: true, usingAI: false, results: [] });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // If no API key configured on server, use official heuristic mapper
    if (!apiKey) {
      console.warn('Server: GEMINI_API_KEY not set. Using official heuristic hierarchy mapper.');
      const fallbackResults = questions.map((q) => {
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

    // Process questions in small chunks to ensure accuracy and avoid token overflow
    const chunkSize = 10;
    for (let i = 0; i < questions.length; i += chunkSize) {
      const chunk = questions.slice(i, i + chunkSize);

      try {
        const questionsPrompt = chunk.map((q, idx) => ({
          index: idx,
          id: q.id,
          enunciado: (q.enunciado || '').slice(0, 450),
          modulo_atual: q.modulo || '',
          capitulo_atual: q.capitulo || '',
          subtopico_atual: q.subtopico || '',
          tema_atual: q.tema || q.tema_subtopico || '',
          gabarito: (q.gabarito_comentado || '').slice(0, 300),
        }));

        const prompt = `Você é um perito examinador da Polícia Federal e professor da matéria "${OFFICIAL_MATERIA}".
Sua tarefa é classificar cada questão recebida rigorosamente na ÁRVORE OFICIAL DE CONTEÚDO fornecida abaixo.

REGRAS OBRIGATÓRIAS:
1. materia DEVE SER SEMPRE: "${OFFICIAL_MATERIA}".
2. modulo DEVE SER exatamente um dos seguintes: "Módulo I", "Módulo II", "Módulo V", "Módulo VI", "Módulo VII", "Módulo VIII", "Módulo IX".
3. capitulo DEVE SER exatamente o rótulo completo de um capítulo válido do respectivo módulo (ex: "Capítulo 2.1: Critérios para a seleção de técnicas investigativas", "Capítulo 4.6: Formalização de outros atos de investigação", "Capítulo 3.1: Pesquisas em fontes abertas (OSINT)", "Capítulo 3.2: Pesquisa em bancos de dados", "Capítulo 3.4: Análise de vínculos", "Capítulo 3.3: Análise de Relatórios de Inteligência Financeira", "Capítulo 3.5: Ações encobertas", "Capítulo 3.6: Obtenção de dados oriundos de fontes humanas", "Capítulo 5.5.6: Infiltração policial").
4. subtopico DEVE SER o rótulo exato do subtópico se o capítulo possuir subtópicos (ex: "Subtópico 4.6.1: Informação de Polícia Judiciária (IPJ)", "Subtópico 3.1.2: Ferramentas de busca, acompanhamento e análise", etc.), ou string vazia "" se o capítulo não possuir subtópicos.
5. tema DEVE SER um dos temas oficiais listados para aquele subtópico ou capítulo.

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
              materia: OFFICIAL_MATERIA,
              modulo: item.modulo || 'Módulo I',
              capitulo: item.capitulo || '',
              subtopico: item.subtopico || '',
              tema: item.tema || '',
            });
          }
        }

        // Fallback for any missing items in chunk
        for (const q of chunk) {
          if (!returnedIds.has(q.id)) {
            const mapped = mapQuestionToOfficialHierarchy(q);
            results.push({ id: q.id, ...mapped });
          }
        }
      } catch (chunkErr) {
        console.warn('Erro ao processar chunk com Gemini, aplicando mapeador heurístico:', chunkErr);
        for (const q of chunk) {
          const mapped = mapQuestionToOfficialHierarchy(q);
          results.push({ id: q.id, ...mapped });
        }
      }
    }

    return res.json({ success: true, usingAI: true, results });
  } catch (error: any) {
    console.error('Erro na rota /api/ai/classify-questions:', error);
    const questions = req.body?.questions || [];
    const fallbackResults = questions.map((q: any) => {
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
