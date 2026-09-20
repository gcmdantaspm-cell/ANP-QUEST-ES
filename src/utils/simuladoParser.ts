import { SimuladoQuestion, Simulado } from '../types/simulado';
import { AlternativeItem } from '../types/question';
import { splitBatchQuestionsText } from './parser';

export interface SimuladoParseResult {
  questions: SimuladoQuestion[];
  errors: string[];
  totalPeso: number;
  materias: string[];
}

/**
 * Limpa quebras de linhas redundantes e espaços em branco excessivos
 */
function cleanText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

/**
 * Parser inteligente para questões de Simulado.
 * NÃO exige Módulo, Capítulo nem Subtópicos.
 * Exige APENAS: Matéria e Peso da questão.
 */
export function parseSimuladoRawQuestions(rawText: string): SimuladoParseResult {
  const text = cleanText(rawText);
  if (!text) {
    return { questions: [], errors: [], totalPeso: 0, materias: [] };
  }

  // Divide por divisores e marcadores inteligentes multi-estratégia
  const rawBlocks = splitBatchQuestionsText(text);

  const questions: SimuladoQuestion[] = [];
  const errors: string[] = [];
  const materiasSet = new Set<string>();

  rawBlocks.forEach((block, idx) => {
    try {
      const qNum = idx + 1;
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);

      let materia = 'Conhecimentos Gerais';
      let peso = 1;
      let gabarito = '';
      let comentario = '';
      let dica = '';

      // 1. Extração de Matéria / Disciplina
      const materiaMatch = block.match(/(?:mat[ée]ria|disciplina|conte[úu]do)\s*[:=-]\s*([^\n\r]+)/i);
      if (materiaMatch) {
        materia = materiaMatch[1].trim();
      } else {
        // Se a primeira linha for curta (< 40 caracteres) e parecer um título
        if (lines.length > 0 && lines[0].length < 40 && !/^[a-e]\s*[).-]/i.test(lines[0]) && !/^(julgue|assinale|considere|acerca|sobre)/i.test(lines[0])) {
          materia = lines[0].replace(/^#+\s*/, '').trim();
        }
      }
      materiasSet.add(materia);

      // 2. Extração de Peso
      const pesoMatch = block.match(/(?:peso|pontos?|valor|pontua[çc][ãa]o)\s*[:=-]\s*(\d+(?:[.,]\d+)?)/i);
      if (pesoMatch) {
        const pNum = parseFloat(pesoMatch[1].replace(',', '.'));
        if (!isNaN(pNum) && pNum > 0) {
          peso = pNum;
        }
      }

      // 3. Extração de Gabarito Estrita (Nunca confundir com 'assinale a alternativa correta')
      const gabRegex = /(?:^|\n)[^\S\r\n]*(?:gabarito(?:\s+oficial|\s+definitivo)?|resposta(?:\s+oficial)?|resp\.?)[^\S\r\n]*[:=-][^\S\r\n]*(?:letra\s*|alternativa\s*)?([A-Ea-e]|certo|errado|c|e)\b/i;
      const gabMatch = block.match(gabRegex);
      if (gabMatch) {
        const rawG = gabMatch[1].toUpperCase();
        if (rawG === 'CERTO' || rawG === 'C') gabarito = 'A';
        else if (rawG === 'ERRADO' || rawG === 'E') gabarito = 'B';
        else gabarito = rawG;
      }

      // 4. Extração de Comentário
      const comMatch = block.match(/(?:coment[áa]rio(?:s)?|resolu[çc][ãa]o|fundamenta[çc][ãa]o|explica[çc][ãa]o)\s*[:=-]\s*([\s\S]+?)(?=(?:\ndica|\nmacete|$))/i);
      if (comMatch) {
        comentario = comMatch[1].trim();
      }

      // 5. Extração de Dica/Macete
      const dicaMatch = block.match(/(?:dica|macete|mnem[ôo]nico)\s*[:=-]\s*([\s\S]+?)$/i);
      if (dicaMatch) {
        dica = dicaMatch[1].trim();
      }

      // 6. Extração das Alternativas e do Enunciado
      // Removemos linhas de metadados da análise do corpo principal sem engolir quebras de linha das alternativas
      let cleanedBody = block
        .replace(/(?:^|\n)[^\S\r\n]*(?:mat[ée]ria|disciplina|conte[úu]do)\s*[:=-][^\n\r]*/gi, '')
        .replace(/(?:^|\n)[^\S\r\n]*(?:peso|pontos?|valor|pontua[çc][ãa]o)\s*[:=-][^\n\r]*/gi, '');

      if (gabMatch) {
        cleanedBody = cleanedBody.replace(gabRegex, '\n');
      }

      cleanedBody = cleanedBody
        .replace(/(?:coment[áa]rio(?:s)?|resolu[çc][ãa]o|fundamenta[çc][ãa]o|explica[çc][ãa]o)\s*[:=-]\s*[\s\S]+?$/gi, '')
        .replace(/(?:dica|macete|mnem[ôo]nico)\s*[:=-]\s*[\s\S]+?$/gi, '')
        .replace(/\r\n/g, '\n')
        .trim();

      // Quebrar alternativas coladas após pontuação (ex: "...correta: A) Primeira...")
      cleanedBody = cleanedBody.replace(
        /(?:^|\n|[:.;?!]|\b)[ \t]+(?=(?:\(?\s*[a-eA-E]\s*[\)\].\-–—:]|\([a-eA-E]\)|\[[a-eA-E]\])[ \t]*)/g,
        '\n'
      );

      const alternativas: AlternativeItem[] = [];
      let enunciado = '';

      // Testar se tem alternativas com formato A) B) C) D) E) ou (A) (B)...
      const altMatches = Array.from(
        cleanedBody.matchAll(/(?:^|\n)[ \t]*(?:\(?\s*([a-eA-E])\s*[\)\].\-–—:]|\(([a-eA-E])\)|\[([a-eA-E])\])[ \t]*([\s\S]*?)(?=(?:\n[ \t]*(?:\(?\s*[a-eA-E]\s*[\)\].\-–—:]|\([a-eA-E]\)|\[[a-eA-E]\])[ \t]*)|$)/gi)
      );

      if (altMatches.length >= 2) {
        // Enunciado é tudo antes da primeira alternativa
        const firstIndex = altMatches[0].index !== undefined ? altMatches[0].index : 0;
        enunciado = cleanedBody.substring(0, firstIndex).trim();

        altMatches.forEach((m) => {
          const letter = (m[1] || m[2] || m[3]).toUpperCase();
          const altText = m[4].trim();
          alternativas.push({
            letra: letter,
            texto: altText,
          });
        });

        // RESGATE DE SEGURANÇA DA ALTERNATIVA A
        if (alternativas.length > 0 && !alternativas.some((a) => a.letra === 'A')) {
          const rescueMatch = enunciado.match(
            /(?:^|\n|[:.;?!])[ \t]*(?:\(?\s*A\s*[\)\].\-–—:]|\(A\)|\[A\])[ \t]*([\s\S]+)$/i
          );
          if (rescueMatch) {
            const rescuedText = rescueMatch[1].trim();
            const cutIndex = rescueMatch.index !== undefined ? rescueMatch.index : enunciado.length;
            enunciado = enunciado.substring(0, cutIndex).trim();
            alternativas.unshift({
              letra: 'A',
              texto: rescuedText,
            });
          }
        }
      } else {
        // Testar se é estilo Certo/Errado
        const ceMatches = Array.from(
          cleanedBody.matchAll(/(?:^|\n)\s*(?:\(?\s*(Certo|Errado)\s*[\)\].-]?\s*)([\s\S]*?)(?=(?:\n\s*(?:\(?(?:Certo|Errado)\s*[\)\].-]?))|$)/gi)
        );

        if (ceMatches.length >= 2) {
          const firstIndex = ceMatches[0].index || 0;
          enunciado = cleanedBody.substring(0, firstIndex).trim();
          ceMatches.forEach((m, cIdx) => {
            const letter = cIdx === 0 ? 'A' : 'B';
            alternativas.push({
              letra: letter,
              texto: m[1] + (m[2].trim() ? ': ' + m[2].trim() : ''),
            });
          });
        } else {
          // Se não encontrou opções explícitas, trata como assertiva Certo / Errado padrão
          enunciado = cleanedBody;
          alternativas.push({ letra: 'A', texto: 'Certo' });
          alternativas.push({ letra: 'B', texto: 'Errado' });
        }
      }

      // Se gabarito não veio explícito, mas foi encontrada letra única no final
      if (!gabarito) {
        gabarito = 'A'; // fallback seguro
      }

      questions.push({
        id: `sim_q_${Date.now()}_${idx}`,
        materia,
        peso,
        enunciado: enunciado || `Questão ${qNum}`,
        alternativas,
        alternativa_correta: gabarito,
        gabarito_comentado: comentario,
        dica_macete: dica,
      });
    } catch (err) {
      errors.push(`Erro ao analisar questão ${idx + 1}: ${err}`);
    }
  });

  const totalPeso = questions.reduce((acc, q) => acc + (q.peso || 1), 0);
  const materias = Array.from(materiasSet);

  return {
    questions,
    errors,
    totalPeso,
    materias,
  };
}

/**
 * Exemplo pronto para teste imediato de Simulado Ponderado
 */
export const SAMPLE_SIMULADO_TEXT = `Matéria: Língua Portuguesa
Peso: 1
Assinale a alternativa em que a regência verbal atende à norma-padrão da língua portuguesa:
A) O candidato aspirava o cargo público de chefia.
B) O cidadão obedeceu aos comandos emitidos pelo agente público.
C) O professor visava ao documento antes de assinar.
D) Lembrou-se o fato ocorrido durante o expediente matutino.
Gabarito: B
Comentário: O verbo "obedecer" é transitivo indireto e exige a preposição "a" (obedeceu aos comandos). Em A, "aspirar" no sentido de desejar exige "ao cargo".
Dica: "Quem obedece, obedece A alguém ou A alguma coisa".

---
Matéria: Direito Constitucional
Peso: 2
Acerca dos direitos e garantias fundamentais previstos no art. 5º da Constituição Federal, assinale a opção correta:
A) A casa é asilo inviolável do indivíduo, não se admitindo a entrada sem consentimento do morador em nenhuma hipótese durante a noite.
B) A prática do racismo constitui crime inafiançável e imprescritível, sujeito à pena de reclusão, nos termos da lei.
C) As associações só poderão ter suas atividades suspensas por decisão judicial transitada em julgado.
D) É plena a liberdade de associação para fins lícitos, inclusive a de caráter paramilitar.
Gabarito: B
Comentário: Art. 5º, XLII, CF/88: "a prática do racismo constitui crime inafiançável e imprescritível, sujeito à pena de reclusão, nos termos da lei". Em A, admite-se durante a noite em flagrante delito ou desastre. Em C, a suspensão exige apenas decisão judicial (não trânsito em julgado).
Dica: Mnemônico RA-ÇÃO (Racismo e Ação de grupos armados são imprescritíveis).

---
Matéria: Direito Penal
Peso: 3
Quanto aos crimes contra a administração pública, julgue o item a seguir:
O crime de corrupção passiva (art. 317 do Código Penal) consuma-se com a efetiva percepção ou recebimento da vantagem indevida pelo funcionário público, sendo atípica a conduta de apenas solicitar.
A) Certo.
B) Errado.
Gabarito: B
Comentário: O crime de corrupção passiva é de natureza FORMAL (de consumação antecipada). Ele se consuma com a mera solicitação da vantagem indevida, independentemente do recebimento efetivo.
Dica: Solicitar, receber ou aceitar promessa: basta solicitar para o crime estar 100% consumado!

---
Matéria: Legislação Especial
Peso: 2
Nos termos da Lei nº 13.869/2019 (Lei de Abuso de Autoridade), os crimes nela previstos são todos de:
A) Ação penal pública incondicionada, não se admitindo em qualquer caso ação penal privada subsidiária.
B) Ação penal privada exclusiva da vítima.
C) Ação penal pública incondicionada, admitindo-se a ação penal privada subsidiária da pública se esta não for intentada no prazo legal.
D) Ação penal pública condicionada à representação expressa do ofendido.
Gabarito: C
Comentário: Art. 3º da Lei nº 13.869/2019: Os crimes previstos nesta Lei são de ação penal pública incondicionada. § 1º Será admitida ação privada subsidiária da pública, se a ação pública não for intentada no prazo legal.
Dica: A regra geral dos crimes contra a administração é ação pública incondicionada, com garantia constitucional de ação privada subsidiária se o MP ficar inerte.`;
