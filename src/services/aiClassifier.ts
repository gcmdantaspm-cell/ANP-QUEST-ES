import {
  OFFICIAL_MATERIA,
  Official5LevelHierarchy,
  mapQuestionToOfficialHierarchy,
} from '../types/hierarchyTree';

export interface QuestionToClassify {
  id: string;
  enunciado: string;
  materia?: string;
  capitulo?: string;
  subtopico?: string;
  modulo?: string;
  tema?: string;
  tema_subtopico?: string;
  gabarito_comentado?: string;
  carimbo?: string;
  carimbado?: boolean;
}

/**
 * Classifica um conjunto de questões chamando o endpoint de backend seguro `/api/ai/classify-questions`,
 * alimentado pelo modelo oficial Gemini 3.8 Flash no servidor.
 * Caso o servidor ou rede esteja indisponível, aplica fallback transparente para o mapeador
 * heurístico neural dos 5 níveis oficiais.
 */
export async function classifyQuestionsWithAI(
  questions: QuestionToClassify[],
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, Official5LevelHierarchy>> {
  const resultMap = new Map<string, Official5LevelHierarchy>();
  if (!questions || questions.length === 0) return resultMap;

  // Lotes para envio ao backend (com reporte de progresso granular)
  const batchSize = 10;
  let processedCount = 0;

  for (let i = 0; i < questions.length; i += batchSize) {
    const chunk = questions.slice(i, i + batchSize);

    try {
      const response = await fetch('/api/ai/classify-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ questions: chunk }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();
      if (data && Array.isArray(data.results)) {
        for (const item of data.results) {
          if (item && item.id) {
            resultMap.set(item.id, {
              materia: item.materia || OFFICIAL_MATERIA,
              modulo: item.modulo || 'Módulo I',
              capitulo: item.capitulo || '',
              subtopico: item.subtopico || '',
              tema: item.tema || '',
            });
          }
        }
      }

      // Garante que questões com carimbo ou módulo/capítulo mantenham 100% sua hierarquia original
      for (const q of chunk) {
        if (q.carimbado || (q.modulo && q.capitulo)) {
          resultMap.set(q.id, {
            materia: q.materia || OFFICIAL_MATERIA,
            modulo: q.modulo || 'Módulo I',
            capitulo: q.capitulo || '',
            subtopico: q.subtopico || '',
            tema: q.tema || q.tema_subtopico || '',
          });
        } else if (!resultMap.has(q.id)) {
          resultMap.set(q.id, mapQuestionToOfficialHierarchy(q));
        }
      }
    } catch (err) {
      console.warn('Classificação via servidor falhou, aplicando mapeador heurístico local:', err);
      for (const q of chunk) {
        if (q.carimbado || (q.modulo && q.capitulo)) {
          resultMap.set(q.id, {
            materia: q.materia || OFFICIAL_MATERIA,
            modulo: q.modulo || 'Módulo I',
            capitulo: q.capitulo || '',
            subtopico: q.subtopico || '',
            tema: q.tema || q.tema_subtopico || '',
          });
        } else if (!resultMap.has(q.id)) {
          resultMap.set(q.id, mapQuestionToOfficialHierarchy(q));
        }
      }
    }

    processedCount += chunk.length;
    if (onProgress) {
      onProgress(Math.min(processedCount, questions.length), questions.length);
    }
  }

  return resultMap;
}
