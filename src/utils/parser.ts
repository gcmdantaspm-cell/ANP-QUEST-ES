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
 * e remove duplicações de termos ("Módulo Módulo 1", "Capítulo Capítulo 1", "Questão 1", etc.)
 */
export function sanitizeEtiquetaField(field?: string): string {
  if (!field) return '';
  let s = field;
  s = s.replace(/\(?\s*modelo\s*[12]\s*[-–—:]*\s*(?:m[úu]ltipla\s*escol(?:ha|a)|julgamento(?:\s+de\s+itens)?|certo\s*e?\s*errado)?\s*\)?/gi, '');
  s = s.replace(/\(?\s*m[úu]ltipla\s*escol(?:ha|a)\s*\)?/gi, '');
  s = s.replace(/\(?\s*julgamento\s+de\s+itens\s*\)?/gi, '');
  s = s.replace(/\(?\s*modelo\s*[12]\s*\)?/gi, '');

  // Remove duplicações de prefixos como "Módulo Módulo 1" -> "Módulo 1" ou "Capítulo Capítulo 1" -> "Capítulo 1"
  s = s.replace(/\b(m[óo]dulo)[\s\-–—:]+\1\b/gi, '$1');
  s = s.replace(/\b(cap[íi]tulo)[\s\-–—:]+\1\b/gi, '$1');
  s = s.replace(/\b(subt[óo]pico)[\s\-–—:]+\1\b/gi, '$1');
  s = s.replace(/\b(tema)[\s\-–—:]+\1\b/gi, '$1');

  // Remove "Questão X" acidentalmente embutida dentro de campos de etiqueta
  s = s.replace(/^(?:quest[ãa]o\s*\d*[:.-]?)\s*/i, '');

  s = s.replace(/^[\s\-–—:.]+/g, '').replace(/[\s\-–—:.]+$/g, '').trim();
  return s;
}

/**
 * Retorna os segmentos hierárquicos estruturados (Módulo, Capítulo, Subtópico, Tema)
 * para exibição em cores diferenciadas na questão.
 */
export interface HierarchySegment {
  type: 'modulo' | 'capitulo' | 'subtopico' | 'tema';
  label: string;
  value: string;
}

export function getHierarchySegments(q: {
  modulo?: string;
  capitulo?: string;
  subtopico?: string;
  tema_subtopico?: string;
}): HierarchySegment[] {
  const segments: HierarchySegment[] = [];
  const mod = sanitizeEtiquetaField(q.modulo);
  const cap = sanitizeEtiquetaField(q.capitulo);
  const sub = sanitizeEtiquetaField(q.subtopico);
  const tema = sanitizeEtiquetaField(q.tema_subtopico);

  if (mod) segments.push({ type: 'modulo', label: 'Módulo', value: mod });
  if (cap) segments.push({ type: 'capitulo', label: 'Capítulo', value: cap });
  if (sub) segments.push({ type: 'subtopico', label: 'Subtópico', value: sub });
  if (tema) segments.push({ type: 'tema', label: 'Tema', value: tema });

  return segments;
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
 * Formata o gabarito comentado para ficar justificado, espaçado e fácil de ler,
 * removendo repetições do enunciado e destacando as alternativas e os erros/acertos de cada uma.
 */
export function smartFormatComentario(rawText: string): string {
  if (!rawText) return '';

  let text = rawText.replace(/\r\n/g, '\n').trim();

  // 1. Remover prefixos de cabeçalho repetidos se houver
  text = text.replace(
    /^(?:gabarito\s+comentado|coment[áa]rio|resolu[çc][ãa]o|justificativa|explica[çc][ãa]o|an[áa]lise(?:\s+das\s+alternativas)?)(?:\s*[\-–—:]+\s*(?:quest[ãa]o\s*\d+|q\d+))?[:\-–—\s]*/i,
    ''
  );

  // 2. Remover repetição do tipo "Alternativa X." ou "Gabarito: Alternativa X" no início se logo em seguida já vem a análise
  text = text.replace(/^(?:gabarito(?:\s+oficial)?|resposta(?:\s+correta)?|alternativa\s+correta|op[çc][ãa]o\s+correta)?\s*[:\-–—]?\s*(?:alternativa|letra|op[çc][ãa]o)?\s*[a-eA-E][.:\-–—)]\s*/i, '');

  // 3. Se o texto começar com enunciado repetido antes de listar as alternativas comentadas:
  // Detecta se existe marcador de alternativas como "\nItem I:", "\nAlternativa a:", "\na)", "\nA.", etc.
  // e remove qualquer texto introdutório de enunciado repetido que venha antes se contiver palavras como "julgue", "assinale", "considerando", etc.
  const firstAltOrItemMarker = text.search(/(?:^|\n)\s*(?:(?:alternativa|op[çc][ãa]o|item|assertiva)\s+[a-eA-E0-9IVX]+|[a-eA-E]\s*[\)\].\-–—:]|[IVXLCDM]{1,6}\.\s+)/i);
  if (firstAltOrItemMarker > 0) {
    const introPart = text.substring(0, firstAltOrItemMarker).trim();
    // Se a introdução parece ser repetição de enunciado (ex: tem mais de 40 caracteres e comandos de prova)
    if (
      introPart.length > 30 &&
      /(?:julgue|assinale|considerando|equipe|pol[íi]cia|conforme|diante|a\s+respeito|est[ãa]o\s+corret)/i.test(introPart)
    ) {
      text = text.substring(firstAltOrItemMarker).trim();
    }
  }

  // 4. Separar alternativas e itens comentados em parágrafos distintos e bem espaçados
  // Ex: "Alternativa a) Incorreta... Alternativa b) Correta..." ou "a) Errado:... b) Certo:..."
  text = text.replace(
    /(?<=[\w.?!;])\s+(?:(?=(?:alternativa|op[çc][ãa]o|item|assertiva)\s+[a-eA-E0-9IVX]+[:\-–—.]?|[a-eA-E]\s*[\)\].\-–—:]|[IVXLCDM]{1,6}\.\s+[A-Z\u00C0-\u00DC]))/gi,
    '\n\n'
  );

  // Também separar itens romanos comentados (Item I, Item II, I., II.)
  text = text.replace(
    /(?<=[\w.?!;])\s+(Item\s+[A-Z0-9IVX]+[:\-–—]|Assertiva\s+[A-Z0-9IVX]+[:\-–—]|Alternativa\s+[A-Ea-e][:\-–—.]?|[IVXLCDM]{1,6}\.\s+)/gi,
    '\n\n$1'
  );

  // 5. Limpar múltiplos espaços consecutivos e limitar quebras a no máximo duas (\n\n)
  text = text
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line, idx, arr) => !(line === '' && arr[idx - 1] === ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

/**
 * Extração estrita e de alta precisão do gabarito oficial / resposta correta.
 * Evita falsos positivos como palavras iniciadas por "A", "E" (ex: "A autorização...", "Em regra...")
 * e garante suporte a dezenas de convenções de bancas (Cespe, FGV, FCC, PF, etc.).
 */
export function extractStrictGabaritoFromText(
  fullBlock: string,
  comentarioText?: string
): string | undefined {
  // 1. Cabeçalho de Gabarito Comentado no bloco
  // Ex: "Gabarito Comentado — Questão 1: Alternativa a." ou "Gabarito Comentado: Alternativa B" ou "Gabarito Comentado - Letra C"
  const headerMatch = fullBlock.match(
    /(?:gabarito(?:\s+comentado)?|resposta(?:\s+comentada)?|resolu[çc][ãa]o(?:\s+comentada)?)[^\n\r]*?[:\-–—]\s*(?:alternativa|letra|op[çc][ãa]o)?\s*([a-eA-E])\b[.:\-–—)]?/i
  );
  if (headerMatch && headerMatch[1]) {
    return headerMatch[1].toUpperCase();
  }

  // 2. Linha clássica de Gabarito / Resposta no corpo
  // Ex: "Gabarito: A" ou "Resposta: B" ou "Resp: C" ou "Gabarito Oficial: D"
  const gabRegex = /(?:^|\n)[^\S\r\n]*(?:gabarito(?:\s+oficial|\s+definitivo)?|resposta(?:\s+oficial|\s+correta)?|resp\.?)[^\S\r\n]*[:=-][^\S\r\n]*(?:letra\s*|alternativa\s*|op[çc][ãa]o\s*)?([A-Ea-e])\b/i;
  const gabMatch = fullBlock.match(gabRegex);
  if (gabMatch && gabMatch[1]) {
    return gabMatch[1].toUpperCase();
  }

  // Se temos texto de comentário analisado
  const com = (comentarioText || '').trim();
  if (com) {
    // 3. Início do comentário com identificador explícito de letra:
    // Ex: "Alternativa a." ou "Letra B:" ou "Opção C -" ou "Gabarito D" ou "Resposta correta: E"
    const comLetraMatch = com.match(
      /^(?:alternativa|letra|op[çc][ãa]o|resposta(?:\s+correta)?|gabarito)\s*[:\-–—]?\s*([a-eA-E])\b[.:\-–—)]?/i
    );
    if (comLetraMatch && comLetraMatch[1]) {
      return comLetraMatch[1].toUpperCase();
    }

    // 4. Início do comentário com formato "a) Correta" ou "a. Verdadeira" ou "[b] Correto"
    const comDirectMatch = com.match(
      /^(?:\[|\()?([a-eA-E])(?:\)|\].|\.|[\-–—:])\s*(?:corret[ao]|verdadeir[ao])/i
    );
    if (comDirectMatch && comDirectMatch[1]) {
      return comDirectMatch[1].toUpperCase();
    }

    // 5. No corpo do comentário com linha iniciando por alternativa correta:
    // Ex: "b) Correta:" ou "c. Verdadeira:" ou "d) É a alternativa correta"
    const corretaInComentMatch = com.match(
      /(?:^|\n)[^\S\r\n]*(?:\[|\()?([a-eA-E])(?:\)|\].|\.|[\-–—:])\s*(?:corret[ao]|verdadeir[ao]|[ée]\s+a\s+alternativa\s+correta)/i
    );
    if (corretaInComentMatch && corretaInComentMatch[1]) {
      return corretaInComentMatch[1].toUpperCase();
    }

    // 6. Frase explicativa no comentário:
    // Ex: "A alternativa correta é a letra B" ou "O gabarito correto é a alternativa C"
    const phraseMatch = com.match(
      /(?:alternativa|resposta|gabarito)\s+(?:corret[ao]\s+)?(?:[ée]\s+a\s+|est[áa]\s+)?(?:letra\s+|alternativa\s+)?([a-eA-E])\b/i
    );
    if (phraseMatch && phraseMatch[1]) {
      return phraseMatch[1].toUpperCase();
    }
  }

  return undefined;
}

/**
 * Extração de padrão Certo / Errado (Cebraspe / PF)
 */
export function extractStrictCertoErrado(fullBlock: string): 'A' | 'B' | undefined {
  const ceMatch = fullBlock.match(
    /(?:^|\n)[^\S\r\n]*(?:gabarito(?:\s+oficial)?|resposta(?:\s+oficial)?)[^\S\r\n]*[:=-][^\S\r\n]*(certo|errado|corret[ao]|incorret[ao])\b/i
  );
  if (ceMatch) {
    const val = ceMatch[1].toLowerCase();
    if (val.startsWith('certo') || val.startsWith('corret')) return 'A';
    if (val.startsWith('errad') || val.startsWith('incorret')) return 'B';
  }
  return undefined;
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

      // Detectar letra do gabarito com alta precisão
      const detectedLetter = extractStrictGabaritoFromText(chunk, cleanChunk) || extractStrictCertoErrado(chunk);

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
    const detectedLetter = extractStrictGabaritoFromText(block, block) || extractStrictCertoErrado(block);

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

    if (modM && !modulo) {
      const rawModVal = modM[1].trim().replace(/^[\-–—:]+/, '').trim();
      modulo = /^m[óo]dulo/i.test(rawModVal) ? rawModVal : `Módulo ${rawModVal}`;
    }
    if (capM && !capitulo) {
      const rawCapVal = capM[1].trim().replace(/^[\-–—:]+/, '').trim();
      capitulo = /^cap[íi]tulo/i.test(rawCapVal) ? rawCapVal : `Capítulo ${rawCapVal}`;
    }
    if (subM && !subtopico) {
      const rawSubVal = (subM[1] || subM[2]).trim().replace(/^[\-–—:]+/, '').trim();
      subtopico = rawSubVal;
    }

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
  // Reconhece formatos como:
  // "Gabarito Comentado — Questão 1: Alternativa a." ou "Gabarito Comentado - Questão 1: Alternativa a." ou "Gabarito Comentado: B"
  const comentMatch = textBeforeDica.match(
    /(?:gabarito\s+comentado(?:\s*[\-–—:]+\s*(?:quest[ãa]o\s*\d+|q\d+))?|resolu[çc][ãa]o\s+comentada|coment[áa]rio\s+da\s+quest[ãa]o|coment[áa]rio|resolu[çc][ãa]o|explica[çc][ãa]o|justificativa)\s*[:\-–—]\s*([\s\S]+?)$/i
  );
  if (comentMatch) {
    comentario = comentMatch[1].trim();
    textBeforeComentario = textBeforeDica.substring(0, comentMatch.index).trim();
  }

  let textBeforeGabarito = textBeforeComentario;
  // Extração estrita de Gabarito: APENAS quando a linha for explicitamente destinada ao gabarito/resposta
  const gabRegex = /(?:^|\n)[^\S\r\n]*(?:gabarito(?:\s+oficial|\s+definitivo)?|resposta(?:\s+oficial|\s+correta)?|resp\.?)[^\S\r\n]*[:=-][^\S\r\n]*(?:letra\s*|alternativa\s*)?([A-Ea-e])\b/i;
  const gabMatch = textBeforeComentario.match(gabRegex);
  if (gabMatch) {
    gabarito = gabMatch[1].toUpperCase().trim();
    // Remove apenas a linha de gabarito para não poluir o enunciado/alternativas
    textBeforeGabarito = textBeforeComentario.replace(gabRegex, '\n').trim();
  }

  // Extração avançada e estrita de Gabarito (cabeçalho comentado, início de comentário, frases de conclusão ou Certo/Errado)
  const strictGabarito = extractStrictGabaritoFromText(fullCleanText, comentario) || extractStrictCertoErrado(fullCleanText);
  if (strictGabarito) {
    gabarito = strictGabarito;
  }

  // Extrair Enunciado e Alternativas de textBeforeGabarito
  // Normalizar quebras de linha e forçar quebras antes de marcadores de alternativas (A, B, C, D, E)
  // mesmo que venham grudadas após dois-pontos, ponto ou no meio da linha
  let altTargetText = textBeforeGabarito.replace(/\r\n/g, '\n').trim();

  // Garante quebra de linha antes de qualquer indicador de alternativa
  altTargetText = altTargetText.replace(
    /(?:^|\n|[.:;?!]|\b)[ \t]*(?=(?:\(?\s*[a-eA-E]\s*[\)\].\-–—:]|\([a-eA-E]\)|\[[a-eA-E]\])[ \t]+)/g,
    '\n'
  );
  // Também para casos colados como: "correta:A) Primeira" ou "correta:a) Primeira"
  altTargetText = altTargetText.replace(
    /([.:;?!])[ \t]*(?=(?:\(?\s*[a-eA-E]\s*[\)\].\-–—:]|\([a-eA-E]\)|\[[a-eA-E]\]))/g,
    '$1\n'
  );

  // Suporta A), B), C), D), E) ou (A), [A], A - ou A. ou a), b), c)...
  const altRegex = /(?:^|\n)[ \t]*(?:\(?\s*([a-eA-E])\s*[\)\].\-–—:]|\(([a-eA-E])\)|\[([a-eA-E])\])[ \t]*([\s\S]*?)(?=(?:\n[ \t]*(?:\(?\s*[a-eA-E]\s*[\)\].\-–—:]|\([a-eA-E]\)|\[[a-eA-E]\])[ \t]*)|$)/g;

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

  // RESGATE DE ALTA PRECISÃO DA ALTERNATIVA A:
  // Se as alternativas encontradas não contiverem a Letra A (por exemplo, começaram em B),
  // significa que o enunciado absorveu a Alternativa A no seu término.
  // Resgatamos a Alternativa A do final do enunciado com precisão cirúrgica.
  if (alternativas.length > 0 && !alternativas.some((a) => a.letra === 'A')) {
    const rescueMatch = enunciado.match(
      /(?:^|\n|[:.;?!])[ \t]*(?:\(?\s*[aA]\s*[\)\].\-–—:]|\([aA]\)|\[[aA]\])[ \t]*([\s\S]+)$/
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

  // Se não encontrou alternativas no formato A-E, verificar estilo Certo / Errado
  if (alternativas.length === 0) {
    const ceRegex = /(?:^|\n)[ \t]*(?:\(?\s*(Certo|Errado)\s*[\)\].\-–—:]?|\((C|E)\))[ \t]*([\s\S]*?)(?=(?:\n[ \t]*(?:\(?\s*(?:Certo|Errado)\s*[\)\].\-–—:]?|\((?:C|E)\))[ \t]*)|$)/gi;
    let ceMatch: RegExpExecArray | null;
    let firstCeIndex = -1;
    while ((ceMatch = ceRegex.exec(altTargetText)) !== null) {
      if (firstCeIndex === -1) firstCeIndex = ceMatch.index;
      const rawType = (ceMatch[1] || ceMatch[2]).toUpperCase();
      const isC = rawType.startsWith('C');
      alternativas.push({
        letra: isC ? 'A' : 'B',
        texto: isC ? 'Certo' : 'Errado',
      });
    }
    if (firstCeIndex !== -1) {
      enunciado = altTargetText.substring(0, firstCeIndex).trim();
    }
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
 * Fatiador inteligente e multi-estratégia para dividir blocos de questões coladas em lote.
 * Identifica com robustez 10 questões coladas em qualquer padrão comum de concursos:
 * 1. Divisores explícitos (---, ===, ***, ___)
 * 2. Cabeçalhos repetidos ("Módulo:", "Matéria:", "Disciplina:")
 * 3. Marcadores nominais ("Questão 1", "Item 1", "Q1.", "Simulado 1")
 * 4. Numeração no início de linha ("1. ", "1) ", "1 - ", "01. ", "(01)", "[1]")
 * 5. Fechamento de questão por Gabarito repetido ("Gabarito: [A-E]")
 * 6. Blocos por parágrafos duplos com alternativas independentes
 */
export function splitBatchQuestionsText(rawText: string): string[] {
  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!text) return [];

  // 1. Estratégia de Divisores Explícitos: ---, ===, ***, ___
  if (/(?:\n|^)[ \t]*[-=_*]{3,}[ \t]*(?:\n|$)/.test(text)) {
    const rawChunks = text.split(/(?:\n|^)[ \t]*[-=_*]{3,}[ \t]*(?:\n|$)/);
    const filtered = rawChunks.map((c) => c.trim()).filter((c) => c.length > 20);
    if (filtered.length > 1) {
      return filtered;
    }
  }

  // 2. Estratégia de Cabeçalhos Estruturados Repetidos no início de linha
  // Ex: "Módulo: Direito...", "Matéria: Português...", "Disciplina: ..."
  const headerMarkerRegex = /(?:^|\n)[ \t]*(?:m[óo]dulo|mat[ée]ria|disciplina|nome da mat[ée]ria)\s*[:=-]/gi;
  const headerIndices: number[] = [];
  let hm: RegExpExecArray | null;
  while ((hm = headerMarkerRegex.exec(text)) !== null) {
    const actualIndex = hm.index === 0 && !text.startsWith('\n') ? 0 : hm.index + 1;
    headerIndices.push(actualIndex);
  }
  if (headerIndices.length > 1) {
    // Se o primeiro cabeçalho não começar no índice 0 mas estiver perto do topo
    if (headerIndices[0] > 0 && headerIndices[0] < 80) {
      headerIndices[0] = 0;
    }
    const chunks: string[] = [];
    for (let i = 0; i < headerIndices.length; i++) {
      const start = headerIndices[i];
      const end = i + 1 < headerIndices.length ? headerIndices[i + 1] : text.length;
      const chunk = text.substring(start, end).trim();
      if (chunk.length > 20) {
        chunks.push(chunk);
      }
    }
    if (chunks.length > 1) {
      return chunks;
    }
  }

  // 3. Estratégia de Marcadores Explícitos de "Questão X" ou "Item X" no início de linha
  // Não confundir com linhas de comentários como "Gabarito Comentado — Questão 1"
  const qMarkerRegex = /(?:^|\n)[ \t]*(?:quest[ãa]o|q\.?|item|exerc[íi]cio|simulado)\s*(?:n[º°o]\s*)?\d+\b[.:\-–—)]*/gi;
  const markerIndices: number[] = [];
  let qm: RegExpExecArray | null;
  while ((qm = qMarkerRegex.exec(text)) !== null) {
    const actualIndex = qm.index === 0 && !text.startsWith('\n') ? 0 : qm.index + 1;
    const lineEnd = text.indexOf('\n', actualIndex);
    const fullLine = text.substring(actualIndex, lineEnd !== -1 ? lineEnd : text.length);
    if (!/gabarito\s+comentado|coment[áa]rio\s+da\s+quest|resolu[çc][ãa]o\s+comentada|justificativa/i.test(fullLine)) {
      markerIndices.push(actualIndex);
    }
  }
  if (markerIndices.length > 1) {
    if (markerIndices[0] > 0 && markerIndices[0] < 80) {
      markerIndices[0] = 0;
    }
    const chunks: string[] = [];
    for (let i = 0; i < markerIndices.length; i++) {
      const start = markerIndices[i];
      const end = i + 1 < markerIndices.length ? markerIndices[i + 1] : text.length;
      const chunk = text.substring(start, end).trim();
      if (chunk.length > 20) {
        chunks.push(chunk);
      }
    }
    if (chunks.length > 1) {
      return chunks;
    }
  }

  // 4. Estratégia de Numeração no início de linha: "1. ", "1) ", "1 - ", "01. ", "(01) ", "[1] "
  const numMarkerRegex = /(?:^|\n)[ \t]*(?:(?:\(?\s*\d{1,3}\s*[\.\)\-–—:ºª]|\[\s*\d{1,3}\s*\]|\(\s*\d{1,3}\s*\)))[ \t]+(?=[A-Za-z\u00C0-\u00DC"“'\(])/g;
  const numIndices: number[] = [];
  let nm: RegExpExecArray | null;
  while ((nm = numMarkerRegex.exec(text)) !== null) {
    const actualIndex = nm.index === 0 && !text.startsWith('\n') ? 0 : nm.index + 1;
    numIndices.push(actualIndex);
  }
  if (numIndices.length > 1) {
    if (numIndices[0] > 0 && numIndices[0] < 80) {
      numIndices[0] = 0;
    }
    const chunks: string[] = [];
    for (let i = 0; i < numIndices.length; i++) {
      const start = numIndices[i];
      const end = i + 1 < numIndices.length ? numIndices[i + 1] : text.length;
      const chunk = text.substring(start, end).trim();
      if (chunk.length > 20) {
        chunks.push(chunk);
      }
    }
    if (chunks.length > 1) {
      return chunks;
    }
  }

  // 5. Estratégia de Fechamento por Gabarito repetido no corpo das questões
  // Ex: cada questão termina com "Gabarito: [A-E]" ou "Resposta: [A-E]"
  const gabDelimiterRegex = /(?:^|\n)[^\S\r\n]*(?:gabarito(?:\s+oficial|\s+definitivo)?|resposta(?:\s+oficial)?|resp\.?)[^\S\r\n]*[:=-][^\S\r\n]*(?:letra\s*|alternativa\s*)?[A-Ea-e]\b[^\n]*/gi;
  const gabMatches: { start: number; end: number }[] = [];
  let gm: RegExpExecArray | null;
  while ((gm = gabDelimiterRegex.exec(text)) !== null) {
    gabMatches.push({ start: gm.index, end: gm.index + gm[0].length });
  }

  if (gabMatches.length > 1) {
    const chunks: string[] = [];
    let currentStart = 0;
    for (let i = 0; i < gabMatches.length; i++) {
      let cutPoint = gabMatches[i].end;
      const textAfterGab = text.substring(cutPoint);
      const metaMatch = textAfterGab.match(/^[ \t]*(?:\n[ \t]*)*(?:(?:coment[áa]rio|resolu[çc][ãa]o|justificativa|dica|macete)[\s\S]*?)(?=\n\s*\n[^\s]|\n{2,}|\n(?=[A-Za-z0-9])|$)/i);
      if (metaMatch && metaMatch.index !== undefined && metaMatch.index < 10) {
        cutPoint += metaMatch[0].length;
      }
      const nextEnd = i + 1 < gabMatches.length ? cutPoint : text.length;
      const chunk = text.substring(currentStart, nextEnd).trim();
      if (chunk.length > 20) {
        chunks.push(chunk);
      }
      currentStart = nextEnd;
    }
    if (chunks.length > 1) {
      return chunks;
    }
  }

  // 6. Estratégia de Divisão por Blocos de Parágrafos Duplos onde cada bloco contém alternativas
  const paragraphBlocks = text
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter((b) => b.length > 25);

  if (paragraphBlocks.length > 1) {
    const blocksWithAlts = paragraphBlocks.filter((b) =>
      /(?:^|\n)[ \t]*(?:\(?\s*[a-eA-E]\s*[\)\].\-–—:]|\([a-eA-E]\)|\[[a-eA-E]\]|Certo|Errado)/i.test(b)
    );
    if (blocksWithAlts.length >= 2 && blocksWithAlts.length >= paragraphBlocks.length * 0.6) {
      return paragraphBlocks;
    }
  }

  return [text];
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

  // Se commentsText não foi passado, checar se há uma seção separada de gabaritos comentados ao final de rawQuestionsText.
  // IMPORTANTE: NUNCA fatiar o texto se a linha for o gabarito comentado de uma questão específica
  // (ex: "Gabarito Comentado — Questão 1: Alternativa a.") ou se houver questões subsequentes com alternativas.
  if (!commentsText) {
    const globalCommentsHeaderRegex = /(?:^|\n)[ \t]*(?:[-=_*#]{3,}[ \t]*)?(?:GABARITOS?\s+COMENTADOS?|RESOLU[ÇC][ÕO]ES?\s+COMENTADAS?|COMENT[ÁA]RIOS?\s+DAS?\s+QUEST[ÕO]ES?|GABARITO\s+E\s+COMENT[ÁA]RIOS?)(?:[ \t]*[-=_*#]{3,})?[ \t]*(?:\n|$)/gi;
    let ghMatch: RegExpExecArray | null;
    while ((ghMatch = globalCommentsHeaderRegex.exec(questionsText)) !== null) {
      const matchIndex = ghMatch.index;
      if (matchIndex > 50) {
        const textAfterHeader = questionsText.substring(matchIndex + ghMatch[0].length).trim();
        // Se após esse cabeçalho existirem novas questões com alternativas completas, NÃO é um bloco final de comentários,
        // mas sim questões com seus próprios gabaritos comentados!
        const hasSubsequentQuestionsWithAlts = /(?:^|\n)[ \t]*(?:quest[ãa]o|item)\s*\d+[\s\S]*?(?:^|\n)[ \t]*[a-eA-E][\)\].\-–—]/i.test(
          textAfterHeader
        );
        if (!hasSubsequentQuestionsWithAlts) {
          commentsText = textAfterHeader;
          questionsText = questionsText.substring(0, matchIndex).trim();
          break;
        }
      }
    }
  }

  // Divisão com o fatiador inteligente multi-estratégia
  const splits = splitBatchQuestionsText(questionsText);

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
