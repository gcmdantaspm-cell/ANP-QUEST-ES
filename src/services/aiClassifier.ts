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

  // 1. Imediatamente mapeia e protege questões que já possuem carimbo ou módulo e capítulo definidos
  const questionsNeedingAI: QuestionToClassify[] = [];
  for (const q of questions) {
    if (q.carimbado || (q.modulo && q.capitulo)) {
      resultMap.set(q.id, {
        materia: q.materia || OFFICIAL_MATERIA,
        modulo: q.modulo || 'Módulo I',
        capitulo: q.capitulo || '',
        subtopico: q.subtopico || '',
        tema: q.tema || q.tema_subtopico || '',
      });
    } else {
      questionsNeedingAI.push(q);
    }
  }

  // Se todas as questões já possuem módulo e capítulo definidos, não faz chamadas de rede desnecessárias
  if (questionsNeedingAI.length === 0) {
    if (onProgress) onProgress(questions.length, questions.length);
    return resultMap;
  }

  // 2. Lotes de tamanho 25 para minimizar o número de requisições e respeitar a cota do Free Tier (5 RPM)
  const batchSize = 25;
  let processedCount = questions.length - questionsNeedingAI.length;
  if (onProgress) {
    onProgress(processedCount, questions.length);
  }

  for (let i = 0; i < questionsNeedingAI.length; i += batchSize) {
    const chunk = questionsNeedingAI.slice(i, i + batchSize);

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

      // Preenche fallback heurístico para qualquer questão faltante no chunk
      for (const q of chunk) {
        if (!resultMap.has(q.id)) {
          resultMap.set(q.id, mapQuestionToOfficialHierarchy(q));
        }
      }
    } catch {
      // Fallback transparente para o mapeador heurístico dos 5 níveis oficiais
      for (const q of chunk) {
        if (!resultMap.has(q.id)) {
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
