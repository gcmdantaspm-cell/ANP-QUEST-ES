import { Question, AlternativeItem } from '../types/question';

export interface ParsedQuestionResult {
  modulo?: string;
  capitulo?: string;
  subtopico?: string;
  tema_subtopico?: string;
  enunciado: string;
  alternativas: AlternativeItem[];
  alternativa_correta: string;
  gabarito_comentado: string;
  dica_macete: string;
  peso?: number;
  confidence: {
    hasEnunciado: boolean;
    hasAlternativas: boolean;
    hasGabarito: boolean;
    hasComentario: boolean;
  };
}

export interface HierarchyContext {
  materia?: string;
  modulo?: string;
  capitulo?: string;
  subtopico?: string;
  tema_subtopico?: string;
  peso?: number;
}

export interface ParsedCommentItem {
  questionNumber?: number;
  letter?: string;
  commentText: string;
}

/**
 * Limpa qualquer menção a Modelo 1, Modelo 2, Múltipla Escolha, Julgamento de Itens
 */
export function sanitizeEtiquetaField(field?: string): string {
  if (!field) return '';
  let s = field;
  s = s.replace(/\(?\s*modelo\s*[12]\s*[-–—:]*\s*(?:m[úu]ltipla\s*escol(?:ha|a)|julgamento(?:\s+de\s+itens)?|certo\s*e?\s*errado)?\s*\)?/gi, '');
  s = s.replace(/\(?\s*m[úu]ltipla\s*escol(?:ha|a)\s*\)?/gi, '');
  s = s.replace(/\(?\s*julgamento\s+de\s+itens\s*\)?/gi, '');
  s = s.replace(/\(?\s*modelo\s*[12]\s*\)?/gi, '');
  s = s.replace(/^[\s\-–—:.]+/g, '').replace(/[\s\-–—:.]+$/g, '').trim();
  return s;
}

/**
 * Formata a etiqueta destacada das questões: Módulo - Capítulo - Subtópicos e Temas quando houver
 */
export function formatEtiqueta(q: {
  modulo?: string;
  capitulo?: string;
  subtopico?: string;
  tema_subtopico?: string;
}): string {
  const parts: string[] = [];
  const mod = sanitizeEtiquetaField(q.modulo);
  const cap = sanitizeEtiquetaField(q.capitulo);
  const sub = sanitizeEtiquetaField(q.subtopico);
  const tema = sanitizeEtiquetaField(q.tema_subtopico);

  if (mod) parts.push(mod);
  if (cap) parts.push(cap);
  if (sub) parts.push(sub);
  if (tema) parts.push(tema);

  return parts.join(' - ');
}

/**
 * Formata e organiza o enunciado da questão, retirando menções a Modelo 1/2 e tags de módulo,
 * justificando e dando espaçamento adequado para itens de assertivas (I, II, III, IV) e comandos de fechamento.
 */
export function smartFormatEnunciado(rawText: string): string {
  if (!rawText) return '';

  let text = rawText.replace(/\r\n/g, '\n').trim();

  // 1. Remover Modelo 1, Modelo 2, Múltipla Escolha, Julgamento de Itens
  text = text.replace(/\(?\s*modelo\s*[12]\s*[-–—:]*\s*(?:m[úu]ltipla\s*escol(?:ha|a)|julgamento(?:\s+de\s+itens)?|certo\s*e?\s*errado)?\s*\)?/gi, '');
  text = text.replace(/\(?\s*m[úu]ltipla\s*escol(?:ha|a)\s*\)?/gi, '');
  text = text.replace(/\(?\s*julgamento\s+de\s+itens\s*\)?/gi, '');
  text = text.replace(/\(?\s*modelo\s*[12]\s*\)?/gi, '');

  // 2. Remover tags iniciais de cabeçalho do tipo (MÓDULO-2-CAPÍTULO 1- [1.0-INTRODUÇÃO])
  text = text.replace(/^\s*\([^)]*m[óo]dulo[^)]*\)\s*/i, '');

  // 3. Limpar traços ou pontuações residuais no início
  text = text.replace(/^[\s\-–—:.]+/g, '').trim();

  // 4. Quebrar assertivas / itens numerais romanos em linhas separadas e bem espaçadas
  // Exemplo: ": I. O domínio... II. A capacitação..." -> "\n\nI. O domínio...\n\nII. A capacitação..."
  text = text.replace(
    /(?:(?<=[:.;])|(?<=\n))\s*([IVXLCDM]{1,6})\.\s+/g,
    '\n\n$1. '
  );
  // Também para itens no meio da frase após ponto ou dois-pontos
  text = text.replace(
    /(?<=[:.;]|\b)\s+([IVXLCDM]{1,6})[.\-–]\s+(?=[A-Z\u00C0-\u00DC])/g,
    '\n\n$1. '
  );
  // Para formato (I), (II), (III)
  text = text.replace(
    /(?<=[:.;]|\b)\s*\(([IVXLCDM]{1,6})\)\s*/g,
    '\n\n($1) '
  );

  // 5. Quebrar comandos finais de pergunta em linha separada
  // Exemplo: "...trajetória profissional. Estão corretos os itens:" -> "\n\nEstão corretos os itens:"
  text = text.replace(
    /(?<=[\w.?!])\s+(Est[ãa]o\s+corret[ao]s(?:\s+os?\s+itens)?[:\s]|Assinale\s+a\s+alternativa\s+correta[:\s]|É\s+correto\s+o\s+que\s+se\s+afirma[:\s]|Julgue\s+os?\s+itens?[:\s]|Assinale\s+a\s+op[çc][ãa]o\s+correta[:\s]|Considerando\s+as\s+assertivas[:\s]|A\s+respeito\s+d[ao]s?[:\s]|Diante\s+d[ao]s?[:\s])/gi,
    '\n\n$1'
  );

  // 6. Limpar múltiplos espaços consecutivos e limitar quebras a no máximo duas (\n\n)
  text = text
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

/**
 * Formata o gabarito comentado para ficar justificado, espaçado e fácil de ler.
 */
export function smartFormatComentario(rawText: string): string {
  if (!rawText) return '';

  let text = rawText.replace(/\r\n/g, '\n').trim();

  // Remover prefixos repetidos se houver
  text = text.replace(
    /^(?:gabarito\s+comentado|coment[áa]rio|resolu[çc][ãa]o|justificativa|explica[çc][ãa]o):\s*/i,
    ''
  );

  // Separar itens comentados em parágrafos distintos
  // Ex: "Item I: Errado porque... Item II: Certo..." -> quebra linhas
  text = text.replace(
    /(?<=[\w.?!])\s+(Item\s+[A-Z0-9IVX]+[:\-–]|Assertiva\s+[A-Z0-9IVX]+[:\-–]|Alternativa\s+[A-E][:\-–]|[IVXLCDM]{1,6}\.\s+)/gi,
    '\n\n$1'
  );

  text = text
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

/**
 * Analisa um bloco de texto com múltiplos comentários e resoluções,
 * extraindo por número de questão ou por blocos ordenados.
 */
export function parseCommentsBlock(rawComments: string): ParsedCommentItem[] {
  if (!rawComments.trim()) return [];

  const text = rawComments.replace(/\r\n/g, '\n').trim();

  // Padrão de separador com número da questão:
  // "Questão 1:", "Questão 01 -", "Gabarito Comentado Questão 1:", "Q1:", "1.", "1 -", etc.
  const regexNum = /(?:^|\n)\s*(?:(?:quest[ãa]o|q\.?|gabarito(?:\s+comentado)?(?:\s+da\s+quest[ãa]o)?)\s*(\d+)[:.\-–]?|(\d+)[\s.:–-]+(?=[A-Za-z\u00C0-\u00DC(]))/gi;

  const matches: { index: number; qNum: number }[] = [];
  let m: RegExpExecArray | null;

  while ((m = regexNum.exec(text)) !== null) {
    const num = parseInt(m[1] || m[2], 10);
    if (!isNaN(num)) {
      matches.push({ index: m.index, qNum: num });
    }
  }

  const results: ParsedCommentItem[] = [];

  if (matches.length > 0) {
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index;
      const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
      const chunk = text.substring(start, end).trim();

      // Limpar cabeçalho do chunk
      const cleanChunk = chunk.replace(
        /^(?:(?:quest[ãa]o|q\.?|gabarito(?:\s+comentado)?(?:\s+da\s+quest[ãa]o)?)\s*\d+[:.\-–]?|\d+[\s.:–-]+)\s*/i,
        ''
      ).trim();

      // Detectar se especifica letra do gabarito: "Gabarito: B" ou "Resposta: B" ou "Letra B"
      let detectedLetter: string | undefined;
      const letterMatch = cleanChunk.match(
        /(?:gabarito|resposta(?:\s+correta)?|alternativa|letra):\s*([A-Ea-e])\b/i
      );
      if (letterMatch) {
        detectedLetter = letterMatch[1].toUpperCase();
      }

      results.push({
        questionNumber: matches[i].qNum,
        letter: detectedLetter,
        commentText: smartFormatComentario(cleanChunk),
      });
    }
    return results;
  }

  // Se não tem números explícitos, divide por parágrafos duplos ou divisores
  const blocks = text
    .split(/(?:\n\s*[-=_]{3,}\s*\n|\n\s*\n\s*\n|\n\s*\n)/)
    .map((b) => b.trim())
    .filter((b) => b.length > 5);

  return blocks.map((block, idx) => {
    let detectedLetter: string | undefined;
    const letterMatch = block.match(
      /(?:gabarito|resposta(?:\s+correta)?|alternativa|letra):\s*([A-Ea-e])\b/i
    );
    if (letterMatch) {
      detectedLetter = letterMatch[1].toUpperCase();
    }

    return {
      questionNumber: idx + 1,
      letter: detectedLetter,
      commentText: smartFormatComentario(block),
    };
  });
}

/**
 * Analisa o texto bruto de uma única questão de concurso e extrai os campos estruturados
 */
export function parseRawQuestionText(
  rawText: string,
  context?: HierarchyContext
): ParsedQuestionResult {
  let modulo = context?.modulo || context?.materia || '';
  let capitulo = context?.capitulo || '';
  let subtopico = context?.subtopico || '';
  let tema_subtopico = context?.tema_subtopico || '';
  let peso = context?.peso !== undefined ? context.peso : 1;
  let gabarito = '';
  let comentario = '';
  let dica = '';

  // 0. Limpar qualquer menção a Modelo 1, Modelo 2, Múltipla Escolha, etc.
  let cleanedRaw = rawText
    .replace(/\(?\s*modelo\s*[12]\s*[-–—:]*\s*(?:m[úu]ltipla\s*escol(?:ha|a)|julgamento(?:\s+de\s+itens)?|certo\s*e?\s*errado)?\s*\)?/gi, '')
    .replace(/\(?\s*m[úu]ltipla\s*escol(?:ha|a)\s*\)?/gi, '')
    .replace(/\(?\s*julgamento\s+de\s+itens\s*\)?/gi, '')
    .replace(/\(?\s*modelo\s*[12]\s*\)?/gi, '')
    .trim();

  // 0.1 Extrair tag inicial parentetizada tipo (MÓDULO-2-CAPÍTULO 1- [1.0-INTRODUÇÃO])
  const inlineTagMatch = cleanedRaw.match(/^\s*\(([^)]*m[óo]dulo[^)]*)\)\s*/i);
  if (inlineTagMatch) {
    const tagContent = inlineTagMatch[1];
    const modM = tagContent.match(/m[óo]dulo[\s\-–—:]*([^:\-–—\n]+)/i);
    const capM = tagContent.match(/cap[íi]tulo[\s\-–—:]*([^:\-–—\n\[]+)/i);
    const subM = tagContent.match(/\[([^\]]+)\]|subt[óo]pico[\s\-–—:]*([^:\-–—\n]+)/i);

    if (modM && !modulo) modulo = `Módulo ${modM[1].trim().replace(/^[\-–—:]+/, '').trim()}`;
    if (capM && !capitulo) capitulo = `Capítulo ${capM[1].trim().replace(/^[\-–—:]+/, '').trim()}`;
    if (subM && !subtopico) subtopico = (subM[1] || subM[2]).trim().replace(/^[\-–—:]+/, '').trim();

    cleanedRaw = cleanedRaw.substring(inlineTagMatch[0].length).trim();
  }

  const lines = cleanedRaw.split(/\r?\n/).map((l) => l.trimEnd());
  const cleanLines: string[] = [];

  // Padrões de hierarquia no cabeçalho do texto bruto
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const modMatch = line.match(/^(?:m[óo]dulo|disciplina|mat[ée]ria|nome da mat[ée]ria):\s*(.+)$/i);
    const capMatch = line.match(/^(?:cap[íi]tulo|assunto|t[óo]pico|cap[íi]tulo da mat[ée]ria):\s*(.+)$/i);
    const subMatch = line.match(/^(?:subt[óo]pico|subassunto):\s*(.+)$/i);
    const temaMatch = line.match(/^(?:tema|tema_subt[óo]pico|subtema):\s*(.+)$/i);
    const pesoMatch = line.match(/^(?:peso|pontos?|valor(?:\s+em\s+pontos)?):\s*(\d+(?:[.,]\d+)?)/i);

    if (modMatch) {
      modulo = modMatch[1].trim();
    } else if (capMatch) {
      capitulo = capMatch[1].trim();
    } else if (subMatch) {
      subtopico = subMatch[1].trim();
    } else if (temaMatch) {
      tema_subtopico = temaMatch[1].trim();
    } else if (pesoMatch) {
      const parsedNum = parseFloat(pesoMatch[1].replace(',', '.'));
      if (!isNaN(parsedNum) && parsedNum > 0) {
        peso = parsedNum;
      }
    } else {
      cleanLines.push(lines[i]);
    }
  }

  const fullCleanText = cleanLines.join('\n');

  // Separar blocos de Dica, Comentário e Gabarito
  let textBeforeDica = fullCleanText;
  const dicaMatch = fullCleanText.match(/(?:dica|macete|bizu|mnem[ôo]nico):\s*([\s\S]+?)$/i);
  if (dicaMatch) {
    dica = dicaMatch[1].trim();
    textBeforeDica = fullCleanText.substring(0, dicaMatch.index).trim();
  }

  let textBeforeComentario = textBeforeDica;
  const comentMatch = textBeforeDica.match(
    /(?:gabarito\s+comentado|resolu[çc][ãa]o\s+comentada|coment[áa]rio\s+da\s+quest[ãa]o|coment[áa]rio|resolu[çc][ãa]o|explica[çc][ãa]o|justificativa):\s*([\s\S]+?)$/i
  );
  if (comentMatch) {
    comentario = comentMatch[1].trim();
    textBeforeComentario = textBeforeDica.substring(0, comentMatch.index).trim();
  }

  let textBeforeGabarito = textBeforeComentario;
  const gabMatch = textBeforeComentario.match(
    /(?:gabarito|resposta(?:\s+correta)?|alternativa\s+correta):\s*(?:letra\s*|alternativa\s*)?([A-Ea-e])\b/i
  );
  if (gabMatch) {
    gabarito = gabMatch[1].toUpperCase().trim();
    // Remove a linha do gabarito para não poluir o enunciado/alternativas
    textBeforeGabarito = textBeforeComentario
      .replace(/(?:gabarito|resposta(?:\s+correta)?|alternativa\s+correta):\s*(?:letra\s*|alternativa\s*)?[A-Ea-e]\b[^\n]*/i, '')
      .trim();
  }

  // Se o comentário começou com a letra do gabarito: "Gabarito Comentado: B - Explicação..."
  if (!gabarito && comentario) {
    const comLetraMatch = comentario.match(/^(?:letra\s*|alternativa\s*)?([A-Ea-e])\b[.:\-–]?\s*/i);
    if (comLetraMatch) {
      gabarito = comLetraMatch[1].toUpperCase();
    }
  }

  // Extrair Enunciado e Alternativas de textBeforeGabarito
  // Normalizar quebras de linha e quebrar alternativas inline após pontuação (ex: "...correta: a) Primeira")
  let altTargetText = textBeforeGabarito.replace(/\r\n/g, '\n');
  altTargetText = altTargetText.replace(/(?<=[:.;]|\b)\s+(?=(?:\([a-eA-E]\)|\[[a-eA-E]\]|[a-eA-E][-.:–—)]\s*))/g, '\n');

  // Suporta A), B), C), D), E) ou (A), [A], A - ou A. ou a), b), c)...
  const altRegex = /(?:^|\n)\s*(?:\(([a-eA-E])\)|\[([a-eA-E])\]|([a-eA-E])\s*[-.:–—)])\s*([\s\S]*?)(?=(?:\n\s*(?:\([a-eA-E]\)|\[[a-eA-E]\]|[a-eA-E]\s*[-.:–—)]))|$)/g;

  const alternativas: AlternativeItem[] = [];
  let firstAltIndex = -1;

  let match: RegExpExecArray | null;
  while ((match = altRegex.exec(altTargetText)) !== null) {
    if (firstAltIndex === -1) {
      firstAltIndex = match.index;
    }
    const letter = (match[1] || match[2] || match[3]).toUpperCase();
    const text = match[4].trim();
    alternativas.push({
      letra: letter,
      texto: text,
    });
  }

  let enunciado = '';
  if (firstAltIndex !== -1) {
    enunciado = altTargetText.substring(0, firstAltIndex).trim();
  } else {
    enunciado = altTargetText.trim();
  }

  // Limpar prefixos comuns no enunciado como "Questão 1:" ou "Enunciado:"
  enunciado = enunciado.replace(/^(?:enunciado|quest[ãa]o\s*\d*[:.-]?)\s*/i, '').trim();

  // Formatar enunciado com espaçamentos justificados e quebras adequadas de assertivas
  enunciado = smartFormatEnunciado(enunciado);

  // Se não encontrou gabarito explícito, checar se alguma alternativa tinha marcação como "(Correta)" ou "*"
  if (!gabarito && alternativas.length > 0) {
    for (const alt of alternativas) {
      if (/\b(?:correta|gabarito)\b|\*/i.test(alt.texto)) {
        gabarito = alt.letra;
        alt.texto = alt.texto.replace(/\s*\((?:correta|gabarito)\)|\s*\*/gi, '').trim();
      }
    }
  }

  return {
    modulo: sanitizeEtiquetaField(modulo),
    capitulo: sanitizeEtiquetaField(capitulo),
    subtopico: sanitizeEtiquetaField(subtopico),
    tema_subtopico: sanitizeEtiquetaField(tema_subtopico),
    enunciado,
    alternativas,
    alternativa_correta: gabarito || 'A',
    gabarito_comentado: smartFormatComentario(comentario),
    dica_macete: dica,
    peso: peso || 1,
    confidence: {
      hasEnunciado: enunciado.length > 10,
      hasAlternativas: alternativas.length >= 2,
      hasGabarito: Boolean(gabarito),
      hasComentario: Boolean(comentario),
    },
  };
}

/**
 * Divide e organiza questões em lote, com suporte a:
 * 1. Gabarito comentado na mesma caixa junto a cada questão
 * 2. Gabarito comentado em bloco separado ao final da caixa principal
 * 3. Gabarito comentado em uma caixa de texto secundária independente
 */
export function parseBatchRawQuestions(
  rawQuestionsText: string,
  rawCommentsText?: string,
  context?: HierarchyContext
): ParsedQuestionResult[] {
  if (!rawQuestionsText.trim()) return [];

  let questionsText = rawQuestionsText.replace(/\r\n/g, '\n').trim();
  let commentsText = rawCommentsText ? rawCommentsText.trim() : '';

  // Se commentsText não foi passado, checar se há uma seção separada de gabaritos comentados ao final de rawQuestionsText
  if (!commentsText) {
    const splitCommentsHeader = /(?:^|\n)\s*(?:[-=_]{3,}\s*)?(?:GABARITOS?\s+COMENTADOS?|RESOLU[ÇC][ÕO]ES?\s+COMENTADAS?|COMENT[ÁA]RIOS?\s+DAS?\s+QUEST[ÕO]ES?|GABARITO\s+E\s+COMENT[ÁA]RIOS?)(?:\s*[-=_]{3,})?[:\s]*/i;
    const headerMatch = questionsText.match(splitCommentsHeader);
    if (headerMatch && headerMatch.index !== undefined && headerMatch.index > 50) {
      commentsText = questionsText.substring(headerMatch.index + headerMatch[0].length).trim();
      questionsText = questionsText.substring(0, headerMatch.index).trim();
    }
  }

  let splits: string[] = [];

  // 1. Divisores explícitos: ---, ===, ***
  if (/(?:\n|^)\s*[-=_*]{3,}\s*(?:\n|$)/.test(questionsText)) {
    const rawChunks = questionsText.split(/(?:\n|^)\s*[-=_*]{3,}\s*(?:\n|$)/);
    const filtered = rawChunks.map((c) => c.trim()).filter((c) => c.length > 20);
    if (filtered.length > 1) {
      splits = filtered;
    }
  }

  // 2. Divisão por quebra e nova questão explícita
  if (splits.length === 0) {
    const qSplitRegex = /(?:\n\s*\n|\n(?=(?:quest[ãa]o\s*\d+|\(?\s*modelo\s*[12])))(?=(?:quest[ãa]o\s*\d+|simulado\s*\d+|item\s*\d+|\(?\s*modelo\s*[12]|(?:\d+\s*[\.\-–]\s+(?=(?:\(?(?:modelo|m[óo]dulo|[A-Z\u00C0-\u00DC]))))))/gi;
    const rawSplits = questionsText.split(qSplitRegex);
    const filtered = rawSplits.map((c) => c.trim()).filter((c) => c.length > 20);
    if (filtered.length > 1) {
      splits = filtered;
    } else {
      splits = [questionsText.trim()];
    }
  }

  const parsedQuestions = splits.map((chunk) => parseRawQuestionText(chunk, context));

  // Se houver gabaritos comentados separados (da 2ª caixa ou da seção final), vincular automaticamente
  if (commentsText) {
    const commentsList = parseCommentsBlock(commentsText);

    // Mapeamento por número de questão explícito
    const commentsByNum = new Map<number, ParsedCommentItem>();
    commentsList.forEach((c) => {
      if (c.questionNumber) {
        commentsByNum.set(c.questionNumber, c);
      }
    });

    parsedQuestions.forEach((q, idx) => {
      const qNum = idx + 1;
      const matchedComment = commentsByNum.get(qNum) || commentsList[idx];

      if (matchedComment) {
        if (matchedComment.commentText) {
          q.gabarito_comentado = matchedComment.commentText;
          q.confidence.hasComentario = true;
        }
        if (matchedComment.letter) {
          q.alternativa_correta = matchedComment.letter;
          q.confidence.hasGabarito = true;
        }
      }
    });
  }

  return parsedQuestions;
}

/**
 * Exemplos pré-carregados de alta qualidade para teste imediato pelo administrador
 */
export const SAMPLE_QUESTIONS_RAW = [
  `Módulo: Direito Constitucional
Capítulo: Direitos e Garantias Fundamentais
Subtópico: Artigo 5º
Tema: Remédios Constitucionais

Enunciado:
(FCC - 2023 - Analista Judiciário) De acordo com a Constituição Federal de 1988, conceder-se-á mandado de segurança para proteger direito líquido e certo, não amparado por:
A) habeas corpus ou habeas data, quando o responsável pela ilegalidade ou abuso de poder for autoridade pública ou agente de pessoa jurídica no exercício de atribuições do Poder Público.
B) ação popular ou ação civil pública, em casos restritos à proteção do patrimônio público e social.
C) mandado de injunção coletivo unicamente, independentemente da existência de norma regulamentadora infraconstitucional.
D) direito de petição aos poderes públicos em defesa de direitos ou contra ilegalidade.
E) habeas corpus exclusivamente, sendo cabível de forma subsidiária mesmo na existência de habeas data.

Gabarito: A
Comentário: Conforme prevê expressamente o Artigo 5º, inciso LXIX da CF/88: "conceder-se-á mandado de segurança para proteger direito líquido e certo, não amparado por habeas corpus ou habeas data, quando o responsável pela ilegalidade ou abuso de poder for autoridade pública ou agente de pessoa jurídica no exercício de atribuições do Poder Público". Portanto, o mandado de segurança possui caráter residual em relação ao HC e ao HD.
Dica: Macete mnemônico "Residual HC/HD": Mandado de Segurança NUNCA entra onde couber HC (liberdade de locomoção) ou HD (informações pessoais). Se couber um deles, a porta do MS está fechada!`,

  `Módulo: Direito Administrativo
Capítulo: Atos Administrativos
Subtópico: Elementos e Requisitos
Tema: Competência e Forma

Enunciado:
(CEBRASPE / CESPE - 2024 - Tribunal de Contas) Em relação aos requisitos de validade dos atos administrativos, assinale a opção correta no que tange aos vícios sanáveis passíveis de convalidação:
A) O vício relativo ao motivo é sempre sanável pela autoridade superior se demonstrado o interesse público.
B) Apenas os vícios de competência (desde que não exclusiva) e de forma (desde que não essencial à validade do ato) são passíveis de convalidação.
C) O vício de finalidade (desvio de poder) admite convalidação tácita caso decorridos mais de 5 anos.
D) O vício de objeto pode ser convalidado mesmo quando o objeto for legalmente proibido ou indeterminado.
E) Todos os atos administrativos nulos podem ser convertidos ou convalidados discricionariamente pelo Judiciário.

Gabarito: B
Comentário: A doutrina clássica e a Lei nº 9.784/1999 (art. 55) estabelecem que em decisão na qual se evidencie não acarretarem lesão ao interesse público nem prejuízo a terceiros, os atos que apresentarem defeitos sanáveis poderão ser convalidados. São passíveis de convalidação vícios na COMPETÊNCIA (quando não se tratar de competência exclusiva ou em razão da matéria) e na FORMA (quando a forma não for indispensável/essencial à existência ou validade do ato). Vícios em motivo, finalidade e objeto (regra geral) são insanáveis.
Dica: Macete mnemônico "FO.CO sanável": Somente a FORMA e a COMPETÊNCIA podem ser convalidadas (FO = Forma não essencial; CO = Competência não exclusiva). Motivo, Objeto e Finalidade geram nulidade absoluta insanável!`,

  `Módulo: Língua Portuguesa
Capítulo: Sintaxe do Período
Subtópico: Regência e Crase
Tema: Casos Proibidos de Crase

Enunciado:
(VUNESP - 2024 - Oficial de Promotoria) Assinale a alternativa em que o sinal indicativo de crase foi empregado em estrita conformidade com a norma-padrão da língua portuguesa:
A) O promotor de justiça dirigiu-se à qualquer autoridade competente para solicitar as diligências urgentes.
B) Os candidatos responderam às questões discursivas com calma e precisão cirúrgica durante a prova.
C) O réu começou à prestar depoimento assim que o magistrado determinou o início da audiência.
D) As testemunhas compareceram perante à banca de jurados sem apresentar qualquer documento probatório.
E) O magistrado caminhou passo à passo em direção ao tribunal do júri para proferir a sentença.

Gabarito: B
Comentário: Na alternativa B, o verbo "responder" rege a preposição "a" (responder a algo) que se funde com o artigo feminino plural "as" que antecede o substantivo "questões" (a + as = às), justificando a crase obrigatória. Nas demais: A) diante de pronome indefinido "qualquer" não há crase; C) diante de verbo no infinitivo "prestar" é proibida a crase; D) após preposições como "perante" não ocorre crase; E) entre palavras repetidas "passo a passo" a crase é terminantemente proibida.
Dica: Mnemônico dos Casos Proibidos de Crase: "P.V.P.R" -> Nunca craseie antes de Pronome indefinido, Verbo no infinitivo, Palavras repetidas ou preposições duplas!`,
];
