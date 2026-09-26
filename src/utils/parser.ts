import { Question, AlternativeItem } from '../types/question';

export interface ParsedQuestionResult {
  numero_questao?: number;
  materia?: string;
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
 * e prefixos indesejados como "QUESTÕES INÉDITAS — BLOCO" ou "BLOCO"
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

  // Remove prefixos como "QUESTÕES INÉDITAS — BLOCO", "QUESTÕES INÉDITAS —", "BLOCO "
  s = s.replace(/^(?:quest(?:[ãa]o|[õo]es)\s+in[ée]dita(?:s)?\s*[\-–—:]*\s*)/i, '');
  s = s.replace(/^bloco\s+/i, '');

  s = s.replace(/^[\s\-–—:.]+/g, '').replace(/[\s\-–—:.]+$/g, '').trim();
  return s;
}

export interface RawHierarchyMatch {
  materia?: string;
  modulo?: string;
  capitulo?: string;
  capituloNum?: string;
  capituloTitle?: string;
  subtopico?: string;
  topicoNum?: string;
  topicoTitle?: string;
  tema?: string;
  temaNum?: string;
  temaTitle?: string;
}

/**
 * Detecta cabeçalhos hierárquicos em uma linha:
 * Ex: QUESTÕES INÉDITAS — BLOCO 4.6.2 (AUTO CIRCUNSTANCIADO)
 * Ex: BLOCO 4.6.2 (AUTO CIRCUNSTANCIADO)
 * Ex: BLOCO 4.6 (TERMO DE DECLARAÇÕES)
 * Ex: BLOCO 2.2
 * Ex: 4.6.2 (AUTO CIRCUNSTANCIADO)
 * Ex: # MÓDULO II – FORMALIZAÇÃO DE DADOS DE INTERESSE
 * Ex: ## CAPÍTULO 4 – PEÇAS DE POLÍCIA JUDICIÁRIA
 */
export function extractHierarchyFromHeaderLine(line: string): RawHierarchyMatch | null {
  const rawClean = line.trim();
  if (!rawClean) return null;

  // Linhas que são títulos de seção de questões (ex: "### QUESTÕES DO TÓPICO 1 (EVOLUÇÃO E CONCEITO)") NÃO são hierarquia
  if (/^[#*=_~-]*\s*quest(?:[ãa]o|[õo]es)\s+d[oa]\s+/i.test(rawClean)) {
    return null;
  }

  // Normalizar markdown bold/italic (** e __) para suportar "**MATÉRIA:**", "**MÓDULO:**", etc.
  const cleanLine = rawClean
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .trim();

  // 1. Padrão Composto em linha única (delimitado por |, ;, •, ou >)
  // Ex: Matéria: Direito Penal | Módulo: 1 | Capítulo: 4 | Subtópico: 4.6 | Tema: 4.6.2 (Auto Circunstanciado)
  // Ex: Matéria: IPO-2 > Módulo 1 > Capítulo 4 > Subtópico 4.6 > Tema 4.6.2
  // Ex: [Matéria: IPO-2] [Módulo: 1] [Capítulo: 4] [Subtópico: 4.6] [Tema: 4.6.2]
  if (/[|;•>]|\[(?:mat[ée]ria|disciplina|m[óo]dulo|cap[íi]tulo|subt[óo]pico|tema)/i.test(cleanLine)) {
    const res: RawHierarchyMatch = {};
    let foundAny = false;

    // Matéria / Disciplina
    const matM = cleanLine.match(/(?:mat[ée]ria|disciplina|nome da mat[ée]ria)\s*[:=-]\s*([^|;•\n\r>\]]+)/i);
    if (matM) {
      res.materia = sanitizeEtiquetaField(matM[1].trim());
      foundAny = true;
    }

    // Módulo
    const modM = cleanLine.match(/(?:m[óo]dulo)\s*(?:([0-9]+|[IVXLCDM]+))?\s*[:.\-–—]?\s*([^|;•\n\r>\]]+)?/i);
    if (modM) {
      const modNum = modM[1]?.trim();
      const modTitle = modM[2]?.trim() || '';
      if (modNum && modTitle && !modTitle.toLowerCase().startsWith('módulo')) {
        res.modulo = `Módulo ${modNum} – ${modTitle}`;
      } else if (modNum) {
        res.modulo = `Módulo ${modNum}`;
      } else if (modTitle) {
        res.modulo = sanitizeEtiquetaField(modTitle);
      }
      foundAny = true;
    }

    // Capítulo
    const capM = cleanLine.match(/(?:cap[íi]tulo|cap\.?)\s*(?:([0-9]+|[IVXLCDM]+))?\s*[:.\-–—]?\s*([^|;•\n\r>\]]+)?/i);
    if (capM) {
      const capNum = capM[1]?.trim();
      const capTitle = capM[2]?.trim() || '';
      if (capNum) {
        res.capituloNum = capNum;
        res.capituloTitle = capTitle || undefined;
        res.capitulo = capTitle ? `Capítulo ${capNum} – ${capTitle}` : `Capítulo ${capNum}`;
      } else if (capTitle) {
        res.capitulo = sanitizeEtiquetaField(capTitle);
      }
      foundAny = true;
    }

    // Subtópico / Tópico
    const subM = cleanLine.match(/(?:subt[óo]pico|sub-t[óo]pico|t[óo]pico)\s*(?:(\d+(?:\.\d+)*))?\s*[:.\-–—]?\s*([^|;•\n\r>\]]+)?/i);
    if (subM) {
      const subNum = subM[1]?.trim();
      const subTitle = subM[2]?.trim() || '';
      if (subNum && subTitle) {
        res.subtopico = `${subNum} (${subTitle})`;
        res.topicoNum = subNum;
      } else if (subNum) {
        res.subtopico = subNum;
        res.topicoNum = subNum;
      } else if (subTitle) {
        res.subtopico = sanitizeEtiquetaField(subTitle);
      }
      foundAny = true;
    }

    // Tema / Subtópico do Subtópico
    const temaM = cleanLine.match(/(?:tema(?:\s*\((?:subt[óo]pico\s+do\s+subt[óo]pico|detalhe)\))?|subt[óo]pico\s+do\s+subt[óo]pico|subtopico\s+do\s+subtopico|sub-subt[óo]pico)\s*(?:(\d+(?:\.\d+)*))?\s*[:.\-–—]?\s*([^|;•\n\r>\]]+)?/i);
    if (temaM) {
      const temaNum = temaM[1]?.trim();
      const temaTitle = temaM[2]?.trim() || '';
      if (temaNum && temaTitle) {
        res.tema = `${temaNum} (${temaTitle})`;
        res.temaNum = temaNum;
      } else if (temaNum) {
        res.tema = temaNum;
        res.temaNum = temaNum;
      } else if (temaTitle) {
        res.tema = sanitizeEtiquetaField(temaTitle);
      }
      foundAny = true;
    }

    if (foundAny) {
      return res;
    }
  }

  // 2. Padrão BLOCO / TÓPICO com numeração pontuada (ex: 4.6.2 ou 2.2 ou 4.6)
  // Ex: QUESTÕES INÉDITAS — BLOCO 4.6.2 (AUTO CIRCUNSTANCIADO)
  // Ex: BLOCO 4.6.2 (AUTO CIRCUNSTANCIADO)
  // Ex: 4.6.2 (AUTO CIRCUNSTANCIADO)
  // Ex: BLOCO 2.2
  const blockNumMatch = cleanLine.match(
    /^(?:[#*=_~-]+\s*)?(?:quest(?:[ãa]o|[õo]es)\s+in[ée]dita(?:s)?\s*[\-–—:]*\s*)?(?:bloco|t[óo]pico|subt[óo]pico)?\s*(\d+(?:\.\d+)+)\s*(?:[\-–—:]|\s)*(\([^\)\n\r]+\)|[^\n\r]*)?$/i
  );

  if (blockNumMatch) {
    const numStr = blockNumMatch[1].trim(); // ex: "4.6.2" ou "2.2"
    let restDesc = (blockNumMatch[2] || '').trim(); // ex: "(AUTO CIRCUNSTANCIADO)" ou "AUTO CIRCUNSTANCIADO"

    // Limpar delimitadores do restDesc
    let cleanDesc = restDesc.replace(/^[\(\[\{]/, '').replace(/[\)\]\}]$/, '').trim();
    cleanDesc = cleanDesc.replace(/^[\-–—:]+\s*/, '').trim();

    const parts = numStr.split('.');
    const capNum = parts[0]; // "4" ou "2"
    const topNum = parts.length >= 2 ? `${parts[0]}.${parts[1]}` : parts[0]; // "4.6" ou "2.2"
    const temaNum = numStr; // "4.6.2"

    let tema = '';
    if (parts.length >= 3) {
      tema = cleanDesc ? `${numStr} (${cleanDesc})` : numStr;
    } else if (cleanDesc) {
      tema = `${numStr} (${cleanDesc})`;
    }

    return {
      capituloNum: capNum,
      topicoNum: topNum,
      subtopico: topNum,
      tema: tema || undefined,
      temaNum: temaNum,
      temaTitle: cleanDesc || undefined,
    };
  }

  // 3. Padrão MATÉRIA / DISCIPLINA isolado
  // Ex: Matéria: Direito Penal
  // Ex: Disciplina: IPO-2
  // Ex: # DIREITO PROCESSUAL PENAL
  const matMatch = cleanLine.match(/^(?:[#*=_~-]+\s*)?(?:mat[ée]ria|disciplina|nome da mat[ée]ria)\s*[:=-]\s*([^\n\r]+)$/i);
  if (matMatch) {
    return {
      materia: sanitizeEtiquetaField(matMatch[1].trim()),
    };
  }

  // 4. Padrão TEMA / SUBTÓPICO DO SUBTÓPICO isolado
  // Ex: Tema: 4.6.2 (Auto Circunstanciado)
  // Ex: Tema (subtópico do subtópico): Auto Circunstanciado
  // Ex: Subtópico do subtópico: Peças Iniciais
  // Ex: Tema: Inquérito Policial
  const temaMatch = cleanLine.match(
    /^(?:[#*=_~-]+\s*)?(?:tema(?:\s*\((?:subt[óo]pico\s+do\s+subt[óo]pico|subtopico\s+do\s+subtopico|detalhe)\))?|subt[óo]pico\s+do\s+subt[óo]pico|subtopico\s+do\s+subtopico|sub-subt[óo]pico)\s*(?:(\d+(?:\.\d+)*))?\s*[:.\-–—]?\s*([^\n\r]+)?$/i
  );
  if (temaMatch) {
    const tNum = temaMatch[1]?.trim();
    const tTitle = temaMatch[2]?.trim() || '';
    let val = '';
    if (tNum && tTitle) {
      val = `${tNum} (${tTitle.replace(/^[\(\[]/, '').replace(/[\)\]]$/, '')})`;
    } else if (tNum) {
      val = tNum;
    } else if (tTitle) {
      val = sanitizeEtiquetaField(tTitle);
    }
    if (val) {
      return {
        tema: val,
        temaNum: tNum,
        temaTitle: tTitle || undefined,
      };
    }
  }

  // 5. Padrão SUBTÓPICO / TÓPICO isolado
  // Ex: Subtópico: 4.6 (Termo de Declarações)
  // Ex: Subtópico 4.6: Termo de Declarações
  // Ex: Tópico: 2.2
  // Ex: Subtópico - Prisão em Flagrante
  const subMatch = cleanLine.match(
    /^(?:[#*=_~-]+\s*)?(?:subt[óo]pico|sub-t[óo]pico|t[óo]pico)\s*(?:(\d+(?:\.\d+)*))?\s*[:.\-–—]?\s*([^\n\r]+)?$/i
  );
  if (subMatch) {
    const sNum = subMatch[1]?.trim();
    const sTitle = subMatch[2]?.trim() || '';
    let val = '';
    if (sNum && sTitle) {
      val = `${sNum} (${sTitle.replace(/^[\(\[]/, '').replace(/[\)\]]$/, '')})`;
    } else if (sNum) {
      val = sNum;
    } else if (sTitle) {
      val = sanitizeEtiquetaField(sTitle);
    }
    if (val) {
      return {
        subtopico: val,
        topicoNum: sNum,
        topicoTitle: sTitle || undefined,
      };
    }
  }

  // 6. Padrão MÓDULO isolado ou no cabeçalho
  // Ex: # MÓDULO II – FORMALIZAÇÃO DE DADOS DE INTERESSE
  // Ex: MÓDULO 2: INVESTIGAÇÃO POLICIAL
  // Ex: Módulo: Investigação Policial
  // Ex: Módulo Investigação Policial
  // Ex: Módulo 1
  const modMatch = cleanLine.match(
    /^(?:[#*=_~-]+\s*)?m[óo]dulo(?:\s*([0-9]+|[IVXLCDM]+))?\b(?:\s*[:.\-–—]\s*|\s+)?([^\n\r]+)?/i
  );
  if (modMatch) {
    const modNum = modMatch[1]?.trim();
    const modTitle = modMatch[2]?.trim() || '';
    const cleanModTitle = sanitizeEtiquetaField(modTitle);

    let finalMod = '';
    if (modNum && cleanModTitle) {
      finalMod = `Módulo ${modNum} – ${cleanModTitle}`;
    } else if (modNum) {
      finalMod = `Módulo ${modNum}`;
    } else if (cleanModTitle) {
      finalMod = cleanModTitle;
    } else {
      finalMod = 'Módulo';
    }

    return {
      modulo: finalMod,
    };
  }

  // 7. Padrão CAPÍTULO isolado ou no cabeçalho
  // Ex: ## CAPÍTULO 4 – PEÇAS DE POLÍCIA JUDICIÁRIA
  // Ex: CAPÍTULO 4: PEÇAS
  // Ex: Capítulo 4
  // Ex: Capítulo: Peças de Polícia
  // Ex: Capítulo Peças de Polícia
  const capMatch = cleanLine.match(
    /^(?:[#*=_~-]+\s*)?cap[íi]tulo(?:\s*([0-9]+|[IVXLCDM]+))?\b(?:\s*[:.\-–—]\s*|\s+)?([^\n\r]+)?/i
  );
  if (capMatch) {
    const capNum = capMatch[1]?.trim();
    const capTitle = capMatch[2]?.trim() || '';
    const cleanCapTitle = sanitizeEtiquetaField(capTitle);

    let finalCap = '';
    if (capNum && cleanCapTitle) {
      finalCap = `Capítulo ${capNum} – ${cleanCapTitle}`;
    } else if (capNum) {
      finalCap = `Capítulo ${capNum}`;
    } else if (cleanCapTitle) {
      finalCap = cleanCapTitle;
    } else {
      finalCap = 'Capítulo';
    }

    return {
      capitulo: finalCap,
      capituloNum: capNum,
      capituloTitle: cleanCapTitle || undefined,
    };
  }

  return null;
}

/**
 * Vincula e harmoniza a hierarquia detectada com itens já existentes no Firestore.
 * Caso já exista o Capítulo, Módulo, Tópico ou Tema, aproveita exatamente o item existente.
 * Caso não exista, cria e formata conforme os parâmetros fornecidos.
 */
export function resolveHierarchyWithExisting(
  detected: RawHierarchyMatch,
  existingQuestions: Question[] = [],
  context?: HierarchyContext
): HierarchyContext {
  let materia = detected.materia?.trim() || context?.materia?.trim() || 'IPO-2';
  let modulo = detected.modulo?.trim() || context?.modulo?.trim() || '';
  let capitulo = context?.capitulo?.trim() || '';
  let subtopico = context?.subtopico?.trim() || '';
  let tema = context?.tema_subtopico?.trim() || '';

  // 1. Resolver Matéria com base existente
  if (materia) {
    const existingMat = existingQuestions.find(
      (q) => getQuestionMateria(q).toLowerCase() === materia.toLowerCase()
    );
    if (existingMat) {
      materia = getQuestionMateria(existingMat);
    }
  }

  // 2. Resolver Capítulo com base existente
  const capNum = detected.capituloNum;
  if (capNum) {
    // Procurar capítulo existente com o mesmo número (ex: "Capítulo 4", "Capítulo 4 – ...", "4")
    const matchExistingCap = existingQuestions.find((q) => {
      if (!q.capitulo) return false;
      const c = q.capitulo.trim();
      const numMatch = c.match(/\b0?(\d+)\b/);
      return numMatch && numMatch[1] === capNum;
    });

    if (matchExistingCap && matchExistingCap.capitulo) {
      capitulo = matchExistingCap.capitulo.trim();
    } else {
      capitulo = detected.capituloTitle
        ? `Capítulo ${capNum} – ${detected.capituloTitle}`
        : `Capítulo ${capNum}`;
    }
  } else if (detected.capitulo) {
    const cleanCap = sanitizeEtiquetaField(detected.capitulo);
    const matchExistingCap = existingQuestions.find(
      (q) => q.capitulo && q.capitulo.trim().toLowerCase() === cleanCap.toLowerCase()
    );
    capitulo = matchExistingCap?.capitulo?.trim() || cleanCap;
  }

  // 3. Resolver Módulo com base existente
  if (detected.modulo) {
    const cleanMod = sanitizeEtiquetaField(detected.modulo);
    const modNumMatch = cleanMod.match(/(?:m[óo]dulo\s*)?([0-9]+|[IVXLCDM]+)/i);
    const modId = modNumMatch ? modNumMatch[1].toLowerCase() : cleanMod.toLowerCase();

    const matchExistingMod = existingQuestions.find((q) => {
      const m = getQuestionModulo(q);
      if (!m) return false;
      const qNumMatch = m.match(/(?:m[óo]dulo\s*)?([0-9]+|[IVXLCDM]+)/i);
      return qNumMatch && qNumMatch[1].toLowerCase() === modId;
    });

    modulo = matchExistingMod ? getQuestionModulo(matchExistingMod) : cleanMod;
  } else if (!modulo && capitulo) {
    // Se o módulo não veio no texto, verificar se o Capítulo já possui um Módulo associado no banco
    const sameCapQuestion = existingQuestions.find(
      (q) =>
        q.capitulo &&
        q.capitulo.trim().toLowerCase() === capitulo.toLowerCase() &&
        getQuestionModulo(q)
    );
    if (sameCapQuestion) {
      modulo = getQuestionModulo(sameCapQuestion);
    }
  }

  // 4. Resolver Tópico / Subtópico com base existente
  const topNum = detected.topicoNum;
  if (topNum) {
    // Procurar subtópico existente com o mesmo número (ex: "4.6", "Tópico 4.6", "4.6 - ...")
    const matchExistingSub = existingQuestions.find((q) => {
      if (!q.subtopico) return false;
      const s = q.subtopico.trim();
      return (
        s === topNum ||
        s.startsWith(`${topNum} `) ||
        s.startsWith(`${topNum}-`) ||
        s.startsWith(`${topNum}.`) ||
        new RegExp(`\\b${topNum.replace('.', '\\.')}\\b`).test(s)
      );
    });

    if (matchExistingSub && matchExistingSub.subtopico) {
      subtopico = matchExistingSub.subtopico.trim();
    } else {
      subtopico = topNum;
    }
  } else if (detected.subtopico) {
    const cleanSub = sanitizeEtiquetaField(detected.subtopico);
    const matchExistingSub = existingQuestions.find(
      (q) => q.subtopico && q.subtopico.trim().toLowerCase() === cleanSub.toLowerCase()
    );
    subtopico = matchExistingSub?.subtopico?.trim() || cleanSub;
  }

  // 5. Resolver Tema com base existente
  if (detected.tema) {
    const cleanTema = sanitizeEtiquetaField(detected.tema);
    const temaNumMatch = cleanTema.match(/(\d+(?:\.\d+)+)/);
    const temaTargetNum = temaNumMatch ? temaNumMatch[1] : '';

    const matchExistingTema = existingQuestions.find((q) => {
      if (!q.tema_subtopico) return false;
      const t = q.tema_subtopico.trim();
      if (t.toLowerCase() === cleanTema.toLowerCase()) return true;
      if (temaTargetNum && t.includes(temaTargetNum)) return true;
      return false;
    });

    tema = matchExistingTema?.tema_subtopico?.trim() || cleanTema;
  }

  return {
    materia,
    modulo,
    capitulo,
    subtopico,
    tema_subtopico: tema,
    peso: context?.peso !== undefined ? context.peso : 1,
  };
}

/**
 * Extrai a matéria de uma questão com suporte a compatibilidade regressiva.
 */
export function getQuestionMateria(q: { materia?: string; modulo?: string }): string {
  if (q.materia && q.materia.trim()) {
    return q.materia.trim();
  }
  if (q.modulo && q.modulo.trim()) {
    // Se o modulo é algo como "IPO-2" ou "Direito Penal" e não tem a palavra "Módulo", é a matéria
    if (!/^\s*m[óo]dulo\b/i.test(q.modulo)) {
      return q.modulo.trim();
    }
  }
  return 'IPO-2';
}

/**
 * Extrai o módulo de uma questão com suporte a compatibilidade regressiva.
 */
export function getQuestionModulo(q: { materia?: string; modulo?: string }): string {
  if (q.modulo && q.modulo.trim()) {
    // Se modulo é idêntico à matéria e não tem "Módulo" explícito, não duplicar
    if (q.materia && q.modulo.trim().toLowerCase() === q.materia.trim().toLowerCase() && !/^\s*m[óo]dulo\b/i.test(q.modulo)) {
      return '';
    }
    return q.modulo.trim();
  }
  return '';
}

/**
 * Retorna os segmentos hierárquicos estruturados (Matéria, Módulo, Capítulo, Subtópico, Tema)
 * para exibição em cores diferenciadas na questão.
 */
export interface HierarchySegment {
  type: 'materia' | 'modulo' | 'capitulo' | 'subtopico' | 'tema';
  label: string;
  value: string;
}

export function getHierarchySegments(q: {
  materia?: string;
  modulo?: string;
  capitulo?: string;
  subtopico?: string;
  tema_subtopico?: string;
}): HierarchySegment[] {
  const segments: HierarchySegment[] = [];
  const mat = sanitizeEtiquetaField(getQuestionMateria(q));
  const mod = sanitizeEtiquetaField(getQuestionModulo(q));
  const cap = sanitizeEtiquetaField(q.capitulo);
  const sub = sanitizeEtiquetaField(q.subtopico);
  const tema = sanitizeEtiquetaField(q.tema_subtopico);

  if (mat) segments.push({ type: 'materia', label: 'Matéria', value: mat });
  if (mod && mod !== mat) segments.push({ type: 'modulo', label: 'Módulo', value: mod });
  if (cap) segments.push({ type: 'capitulo', label: 'Capítulo', value: cap });
  if (sub) segments.push({ type: 'subtopico', label: 'Subtópico', value: sub });
  if (tema) segments.push({ type: 'tema', label: 'Tema', value: tema });

  return segments;
}

/**
 * Formata a etiqueta destacada das questões: Matéria - Módulo - Capítulo - Subtópicos e Temas quando houver
 */
export function formatEtiqueta(q: {
  materia?: string;
  modulo?: string;
  capitulo?: string;
  subtopico?: string;
  tema_subtopico?: string;
}): string {
  const parts: string[] = [];
  const mat = sanitizeEtiquetaField(getQuestionMateria(q));
  const mod = sanitizeEtiquetaField(getQuestionModulo(q));
  const cap = sanitizeEtiquetaField(q.capitulo);
  const sub = sanitizeEtiquetaField(q.subtopico);
  const tema = sanitizeEtiquetaField(q.tema_subtopico);

  if (mat) parts.push(mat);
  if (mod && mod !== mat) parts.push(mod);
  if (cap) parts.push(cap);
  if (sub) parts.push(sub);
  if (tema) parts.push(tema);

  return parts.join(' - ');
}

/**
 * Regex para identificar linhas e títulos de orientação, mudança de assunto ou teoria de transição
 * que apenas servem para falar que mudou de assunto ou orientar o aluno e NÃO são questões.
 */
export const TRANSITION_CONTENT_REGEX = /(?:\n|^)[ \t]*(?:[#*=_~-]+\s*)?(?:(?:mudan[çc]a\s+de\s+(?:assunto|t[óo]pico|tema)|mudou\s+de\s+assunto|novo\s+(?:assunto|t[óo]pico|tema)|outro\s+assunto|orienta[çc][ãa]o(?:[õo]es)?(?:\s+gerais|\s+ao\s+aluno)?|aten[çc][ãa]o|aviso|nota|observa[çc][ãa]o|texto\s+de\s+apoio|texto\s+explicativo|texto\s+te[óo]rico|conte[úu]do(?:[ \t]+program[áa]tico)?|resumo(?:[ \t]+te[óo]rico)?|bloco(?:[ \t]+exclusivo)?\s+de\s+teoria|bloco\s+\d+|t[óo]pico\s+\d+|m[óo]dulo\s+[0-9IVXLCDM]+|cap[íi]tulo\s+[0-9IVXLCDM]+)[\s\-–—:]*)[^\n\r]*(?:\n|$)/i;

/**
 * Remove qualquer texto de transição, orientação ou mudança de assunto que tenha ficado
 * no final do bloco de uma questão (após alternativas, gabarito ou comentário).
 */
export function trimTrailingTransitionContent(chunk: string): string {
  if (!chunk) return '';
  const altOrGabRegex = /(?:^|\n)[ \t]*(?:(?:gabarito|resposta)(?:\s+oficial|\s+correta)?\s*[:=-]|(?:(?:\(?\s*[a-eA-E]\s*[\)\].\-–—:]|\([a-eA-E]\)|\[[a-eA-E]\])[ \t]+)|(?:Certo|Errado)\b)/gi;
  let lastMatchEnd = -1;
  let m: RegExpExecArray | null;
  while ((m = altOrGabRegex.exec(chunk)) !== null) {
    lastMatchEnd = m.index + m[0].length;
  }

  if (lastMatchEnd !== -1) {
    const textAfter = chunk.substring(lastMatchEnd);
    const comMatch = textAfter.match(/(?:gabarito\s+comentado|resolu[çc][ãa]o|coment[áa]rio|justificativa|explica[çc][ãa]o|dica|macete)\s*[:\-–—]/i);
    let searchStart = lastMatchEnd;
    if (comMatch && comMatch.index !== undefined) {
      searchStart = lastMatchEnd + comMatch.index + comMatch[0].length;
    }

    const searchArea = chunk.substring(searchStart);
    const transMatch = searchArea.match(TRANSITION_CONTENT_REGEX);
    if (transMatch && transMatch.index !== undefined) {
      return chunk.substring(0, searchStart + transMatch.index).trim();
    }
  }

  return chunk.trim();
}

/**
 * Remove números marcadores e citações bibliográficas de notas/páginas (ex: [1], [2], [1, 2], [3], [1-3], [i], (1), (2), ¹, ²)
 * e tags de gabarito coladas no texto ([Gabarito], (Gabarito), [Correto]).
 */
export function stripCitationMarkers(text: string): string {
  if (!text) return '';

  let cleaned = text;

  // 1. Remover tags de gabarito em colchetes ou parênteses: [Gabarito], (Gabarito), [Correta], (Correta), [Gabarito Oficial]
  cleaned = cleaned.replace(/[\[\(]\s*(?:gabarito(?:\s+oficial)?|corret[ao]|resposta(?:\s+correta)?)\s*[\]\)]/gi, '');

  // 2. Remover números marcadores de citação entre colchetes: [1], [2], [1, 2], [1, 2, 3], [3, 4], [1-3], [i], [ii]
  cleaned = cleaned.replace(/\[\s*(?:\d+|[iIvVxX]+)(?:\s*[,;\-–—]\s*(?:\d+|[iIvVxX]+))*\s*\]/g, '');

  // 3. Remover números marcadores de citação/nota entre parênteses colados a palavras ou pontuação: (1), (2), (1, 2), (nota 1)
  cleaned = cleaned.replace(/(?<=[a-zA-Z\u00C0-\u00DC.,;:?!])\s*\(\s*(?:nota\s+)?(?:\d+|[iIvVxX]+)(?:\s*[,;\-–—]\s*(?:\d+|[iIvVxX]+))*\s*\)/gi, '');

  // 4. Marcadores sobrescritos de notas de rodapé (¹, ², ³, ⁴, ⁵, ⁶, ⁷, ⁸, ⁹, ⁰)
  cleaned = cleaned.replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰]+/g, '');

  // 5. Limpar espaços residuais antes de sinais de pontuação resultantes da remoção (ex: "normativos [1]." -> "normativos.")
  cleaned = cleaned.replace(/[ \t]+([.,;:?!])/g, '$1');

  // 6. Limpar múltiplos espaços consecutivos na mesma linha
  cleaned = cleaned.replace(/[ \t]{2,}/g, ' ');

  return cleaned.trim();
}

/**
 * Remove números marcadores de linha (como numeração de margem de prova de concurso colada de PDF: 1, 2, 3, etc.)
 */
export function stripLineNumberMarkers(text: string): string {
  if (!text) return '';
  const lines = text.split('\n');
  const cleanedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Se a linha começa com número marcador de linha de PDF seguido de letra minúscula (continuação de frase de prova)
    // Ex: "2 judiciária deve conter todos os elementos..." -> "judiciária deve conter todos os elementos..."
    if (/^[ \t]*\d{1,3}[ \t]+(?=[a-z\u00E0-\u00FC])/.test(line)) {
      line = line.replace(/^[ \t]*\d{1,3}[ \t]+/, '');
    }

    // Se a linha começa com marcador explícito de linha: "Linha 1", "Linha 2", "L. 1", "L1"
    if (/^[ \t]*(?:linha|l\.)\s*\d{1,3}[:.\-–—]?[ \t]*/i.test(line)) {
      line = line.replace(/^[ \t]*(?:linha|l\.)\s*\d{1,3}[:.\-–—]?[ \t]*/i, '');
    }

    cleanedLines.push(line);
  }

  return cleanedLines.join('\n');
}

/**
 * Converte assertivas/itens numerados em algarismos arábicos (1., 2., 3. ou 1 -, 2 - ou (1), (2))
 * para o padrão clássico de concursos com numerais romanos (I., II., III. / (I), (II)),
 * garantindo espaçamento limpo entre assertivas e eliminando números marcadores soltos.
 */
export function convertArabicAssertivasToRoman(text: string): string {
  if (!text) return '';

  let res = text;

  // 1. Detectar padrão sequencial de itens com ponto ou hífen: 1. e 2. (ou 1 - e 2 -)
  const hasSeq12 = /(?:^|\n|[:;]\s*)\s*(?:1|01)[\.\)\-–—]\s+[A-Za-z\u00C0-\u00DC"“'\(]/i.test(res) &&
                   /(?:^|\n|[:;]\s*)\s*(?:2|02)[\.\)\-–—]\s+[A-Za-z\u00C0-\u00DC"“'\(]/i.test(res);

  if (hasSeq12) {
    const romanMap: [RegExp, string][] = [
      [/(?:^|\n|(?<=[:;]\s*))\s*(?:1|01)[\.\)\-–—]\s+(?=[A-Za-z\u00C0-\u00DC"“'\(])/g, '\n\nI. '],
      [/(?:^|\n|(?<=[:;]\s*))\s*(?:2|02)[\.\)\-–—]\s+(?=[A-Za-z\u00C0-\u00DC"“'\(])/g, '\n\nII. '],
      [/(?:^|\n|(?<=[:;]\s*))\s*(?:3|03)[\.\)\-–—]\s+(?=[A-Za-z\u00C0-\u00DC"“'\(])/g, '\n\nIII. '],
      [/(?:^|\n|(?<=[:;]\s*))\s*(?:4|04)[\.\)\-–—]\s+(?=[A-Za-z\u00C0-\u00DC"“'\(])/g, '\n\nIV. '],
      [/(?:^|\n|(?<=[:;]\s*))\s*(?:5|05)[\.\)\-–—]\s+(?=[A-Za-z\u00C0-\u00DC"“'\(])/g, '\n\nV. '],
      [/(?:^|\n|(?<=[:;]\s*))\s*(?:6|06)[\.\)\-–—]\s+(?=[A-Za-z\u00C0-\u00DC"“'\(])/g, '\n\nVI. '],
      [/(?:^|\n|(?<=[:;]\s*))\s*(?:7|07)[\.\)\-–—]\s+(?=[A-Za-z\u00C0-\u00DC"“'\(])/g, '\n\nVII. '],
      [/(?:^|\n|(?<=[:;]\s*))\s*(?:8|08)[\.\)\-–—]\s+(?=[A-Za-z\u00C0-\u00DC"“'\(])/g, '\n\nVIII. '],
      [/(?:^|\n|(?<=[:;]\s*))\s*(?:9|09)[\.\)\-–—]\s+(?=[A-Za-z\u00C0-\u00DC"“'\(])/g, '\n\nIX. '],
      [/(?:^|\n|(?<=[:;]\s*))\s*(?:10)[\.\)\-–—]\s+(?=[A-Za-z\u00C0-\u00DC"“'\(])/g, '\n\nX. '],
    ];

    for (const [re, rep] of romanMap) {
      res = res.replace(re, rep);
    }
  }

  // 2. Detectar padrão com parênteses: (1) e (2)
  const hasSeqParens = /(?:^|\n|[:;]\s*)\s*\((?:1|01)\)\s+[A-Za-z\u00C0-\u00DC"“'\(]/i.test(res) &&
                       /(?:^|\n|[:;]\s*)\s*\((?:2|02)\)\s+[A-Za-z\u00C0-\u00DC"“'\(]/i.test(res);

  if (hasSeqParens) {
    const romanParensMap: [RegExp, string][] = [
      [/(?:^|\n|(?<=[:;]\s*))\s*\((?:1|01)\)\s+(?=[A-Za-z\u00C0-\u00DC"“'\(])/g, '\n\n(I) '],
      [/(?:^|\n|(?<=[:;]\s*))\s*\((?:2|02)\)\s+(?=[A-Za-z\u00C0-\u00DC"“'\(])/g, '\n\n(II) '],
      [/(?:^|\n|(?<=[:;]\s*))\s*\((?:3|03)\)\s+(?=[A-Za-z\u00C0-\u00DC"“'\(])/g, '\n\n(III) '],
      [/(?:^|\n|(?<=[:;]\s*))\s*\((?:4|04)\)\s+(?=[A-Za-z\u00C0-\u00DC"“'\(])/g, '\n\n(IV) '],
      [/(?:^|\n|(?<=[:;]\s*))\s*\((?:5|05)\)\s+(?=[A-Za-z\u00C0-\u00DC"“'\(])/g, '\n\n(V) '],
    ];

    for (const [re, rep] of romanParensMap) {
      res = res.replace(re, rep);
    }
  }

  // 3. Item único isolado após dois-pontos ou quebra de linha: "julgue o item a seguir: 1. O inquérito..."
  res = res.replace(
    /(julgue\s+o\s+item(?:\s+a\s+seguir|\s+subsequente|\s+abaixo)?\s*[:.\-–—]*\s*)(?:1|01)[\.\)\-–—]\s+/gi,
    '$1\n\n'
  );

  return res;
}

/**
 * Remove do texto da pergunta o número predefinido colado na caixa de texto de importação
 * (ex: "**Questão 2**", "Questão 01:", "01. ", "1. ", "01) ", "1 - ", "(01) ", "1.\n")
 * e retorna o texto limpo juntamente com o número detectado (caso exista).
 * Garante que NENHUM número de questão permaneça dentro do comando/enunciado.
 */
export function cleanPredefinedQuestionNumber(rawText: string): { cleaned: string; detectedNum?: number } {
  if (!rawText) return { cleaned: '' };

  let text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  let detectedNum: number | undefined;

  // Remover previamente números marcadores de notas/citações bibliográficas ([1], [2], etc.) e linhas de PDF
  text = stripCitationMarkers(text);
  text = stripLineNumberMarkers(text);

  let changed = true;
  let iterations = 0;
  while (changed && iterations < 8) {
    changed = false;
    iterations++;

    // 0. Linhas de cabeçalho de seção de questões tipo "### QUESTÕES DO TÓPICO 1 (EVOLUÇÃO E CONCEITO)" no início
    const questSecMatch = text.match(/^[ \t]*(?:[#*=_~`]+\s*)?(?:quest(?:[ãa]o|[õo]es)\s+d[oa]\s+[^\n\r]+)(?:\r?\n+|$)/i);
    if (questSecMatch) {
      text = text.substring(questSecMatch[0].length).trim();
      changed = true;
    }

    // 1. Cabeçalhos de bloco / tópico / módulo / capítulo no início
    const headerMatch = text.match(/^[ \t]*(?:[#*=_~`]+\s*)?(?:quest(?:[ãa]o|[õo]es)\s+in[ée]dita(?:s)?\s*[\-–—:]*\s*)?(?:bloco|t[óo]pico|subt[óo]pico)?\s*\d+(?:\.\d+)+[^\n\r]*(?:\n+|$)/i);
    if (headerMatch) {
      text = text.substring(headerMatch[0].length).trim();
      changed = true;
    }

    const hierarchyPrefixMatch = text.match(
      /^[ \t]*(?:[#*=_~`]+\s*)?(?:mat[ée]ria|disciplina|nome\s+da\s+mat[ée]ria|m[óo]dulo|cap[íi]tulo|cap\.?|subt[óo]pico|sub-t[óo]pico|t[óo]pico|tema(?:\s*\((?:subt[óo]pico\s+do\s+subt[óo]pico|subtopico\s+do\s+subtopico|detalhe)\))?|subt[óo]pico\s+do\s+subt[óo]pico|subtopico\s+do\s+subtopico)\s*(?:[0-9IVXLCDM]+(?:\.[0-9IVXLCDM]+)*)?\s*[:.\-–—]?[^\n\r]*(?:\n+|$)/i
    );
    if (hierarchyPrefixMatch) {
      text = text.substring(hierarchyPrefixMatch[0].length).trim();
      changed = true;
    }

    // 2. Modelo 1/2 e Múltipla Escolha
    const modTag = text.match(/^[ \t]*\(?\s*modelo\s*[12]\s*[-–—:]*\s*(?:m[úu]ltipla\s*escol(?:ha|a)|julgamento(?:\s+de\s+itens)?|certo\s*e?\s*errado)?\s*\)?\s*/i);
    if (modTag) {
      text = text.substring(modTag[0].length).trim();
      changed = true;
    }

    // 3. Tags inline como (MÓDULO-2...)
    const inlineModTag = text.match(/^\s*\([^)]*m[óo]dulo[^)]*\)\s*/i);
    if (inlineModTag) {
      text = text.substring(inlineModTag[0].length).trim();
      changed = true;
    }

    // 4. Tags de Comando / Enunciado / Pergunta com ou sem número: "Comando da Questão 1:", "Comando:", "(Comando)", "Enunciado:"
    const cmdMatch = text.match(
      /^[ \t]*\(?[ \t]*(?:[#*=_~`]+\s*)?(?:comando(?:\s+da\s+quest[ãa]o)?|enunciado(?:\s+da\s+quest[ãa]o)?|pergunta)\s*(?:n[º°o]\.?|n[uú]mero)?\s*(\d+)?\s*[:.\-–—)]*(?:[#*=_~`]+\s*)?/i
    );
    if (cmdMatch) {
      if (cmdMatch[1] && detectedNum === undefined) detectedNum = parseInt(cmdMatch[1], 10);
      text = text.substring(cmdMatch[0].length).trim();
      changed = true;
    }

    // 5. Marcador nominal de questão com ou sem markdown (**, *, __, ##): "**Questão 1**", "**Questão 2.**", "QUESTÃO 01:", "Q.1:", "Q01 -", "Item 1:", "Exercício 1"
    const namedMatch = text.match(
      /^[ \t]*(?:[#*=_~`]+\s*)?(?:quest[ãa]o|q\.?|item|exerc[íi]cio|simulado)(?:\s*(?:n[º°o]\.?|n[uú]mero))?[\s\-–—:]*(\d+)\b[.:\-–—)]*(?:[#*=_~`]+\s*)?/i
    );
    if (namedMatch) {
      if (detectedNum === undefined) detectedNum = parseInt(namedMatch[1], 10);
      text = text.substring(namedMatch[0].length).trim();
      changed = true;
    }

    // 5.1 Linha isolada de Questão X no início ou após quebra de linha nas primeiras linhas
    const isolatedQuestLine = text.match(/(?:^|\n)[ \t]*(?:[#*=_~`]+\s*)?(?:quest[ãa]o|q\.?|item|exerc[íi]cio|simulado)(?:\s*(?:n[º°o]\.?|n[uú]mero))?[\s\-–—:]*(\d+)\b[.:\-–—)]*(?:[#*=_~`]+\s*)?[ \t]*(?:\n|$)/i);
    if (isolatedQuestLine && isolatedQuestLine.index !== undefined && isolatedQuestLine.index < 120) {
      if (detectedNum === undefined) detectedNum = parseInt(isolatedQuestLine[1], 10);
      text = (text.substring(0, isolatedQuestLine.index) + '\n' + text.substring(isolatedQuestLine.index + isolatedQuestLine[0].length)).trim();
      changed = true;
    }

    // 6. Número no início com pontuação: "**1.** ", "01. ", "1. ", "01) ", "1) ", "01 - ", "1 - ", "(01) ", "1º) ", "1.\n"
    const numPrefixMatch = text.match(
      /^[ \t]*(?:[#*=_~`]+\s*)?(?:\(?\s*(\d{1,4})\s*[\.\)\-–—:ºª]|\(\s*(\d{1,4})\s*\)|\b(\d{1,4})\s*[\.\)\-–—:])(?:[#*=_~`]+\s*)?\s*/
    );
    if (numPrefixMatch) {
      const n = parseInt(numPrefixMatch[1] || numPrefixMatch[2] || numPrefixMatch[3], 10);
      if (!isNaN(n)) {
        if (detectedNum === undefined) detectedNum = n;
        text = text.substring(numPrefixMatch[0].length).trim();
        changed = true;
      }
    }

    // 6.1 Número no início seguido de espaço e letra: "1 O auto...", "01 A respeito..."
    const numSpaceMatch = text.match(/^[ \t]*(?:[#*=_~`]+\s*)?(\d{1,4})[ \t]+(?:[#*=_~`]+\s*)?(?=[A-Z\u00C0-\u00DC"“'\(])/);
    if (numSpaceMatch) {
      const n = parseInt(numSpaceMatch[1], 10);
      if (!isNaN(n)) {
        if (detectedNum === undefined) detectedNum = n;
        text = text.substring(numSpaceMatch[0].length).trim();
        changed = true;
      }
    }

    // 7. Número isolado em sua própria linha no início: "1\n", "01\n", "**1**\n"
    const loneNumMatch = text.match(/^[ \t]*(?:[#*=_~`]+\s*)?(\d{1,4})[ \t]*(?:[#*=_~`]+\s*)?\n+/);
    if (loneNumMatch) {
      const n = parseInt(loneNumMatch[1], 10);
      if (!isNaN(n)) {
        if (detectedNum === undefined) detectedNum = n;
        text = text.substring(loneNumMatch[0].length).trim();
        changed = true;
      }
    }

    // 8. Banca no início seguida de número da questão:
    // Ex: "(CESPE - 2024) 01. O auto circunstanciado..." -> "(CESPE - 2024) O auto circunstanciado..."
    // Ex: "(FGV) Questão 2: Em relação..." -> "(FGV) Em relação..."
    const bancaThenNum = text.match(/^(\([^\)\n\r]+\)|\[[^\]\n\r]+\])[ \t]*(?:[#*=_~`]+\s*)?(?:quest[ãa]o\s*(\d+)|q\.?\s*(\d+)|(?:(?:\(?\s*(\d{1,4})\s*[\.\)\-–—:]|\(\s*(\d{1,4})\s*\))))\s*[:.\-–—]?(?:[#*=_~`]+\s*)?/i);
    if (bancaThenNum) {
      const bTag = bancaThenNum[1];
      const nStr = bancaThenNum[2] || bancaThenNum[3] || bancaThenNum[4] || bancaThenNum[5];
      if (nStr && detectedNum === undefined) detectedNum = parseInt(nStr, 10);
      text = (bTag + ' ' + text.substring(bancaThenNum[0].length)).trim();
      changed = true;
    }

    // 9. Limpar traços, dois-pontos, asteriscos ou pontuações residuais no início
    const dashMatch = text.match(/^[ \t]*[\-–—:.#*=_~`]+[ \t]*/);
    if (dashMatch) {
      text = text.substring(dashMatch[0].length).trim();
      changed = true;
    }
  }

  return { cleaned: text, detectedNum };
}

/**
 * Formata e organiza o enunciado da questão, retirando menções a Modelo 1/2 e tags de módulo,
 * removendo números predefinidos colados na importação e
 * justificando e dando espaçamento adequado para itens de assertivas (I, II, III, IV) e comandos de fechamento.
 */
export function smartFormatEnunciado(rawText: string): string {
  if (!rawText) return '';

  let text = rawText.replace(/\r\n/g, '\n').trim();

  // 0. Limpar números marcadores de notas, citações e linhas de PDF
  text = stripCitationMarkers(text);
  text = stripLineNumberMarkers(text);

  // 0.1 Remover qualquer menção a "Questão X", "QUESTÃO X:", "Questão X.", "**Questão X**" isolada ou em linha
  text = text.replace(/(?:^|\n)[ \t]*(?:[#*=_~`]+\s*)?(?:quest[ãa]o|q\.?|item|exerc[íi]cio|simulado)(?:\s*(?:n[º°o]\.?|n[uú]mero))?[\s\-–—:]*\d+\b[.:\-–—)]*(?:[#*=_~`]+\s*)?[ \t]*(?:\n|$)/gi, '\n');
  text = text.replace(/^[ \t]*(?:[#*=_~`]+\s*)?(?:quest[ãa]o|q\.?|item|exerc[íi]cio|simulado)(?:\s*(?:n[º°o]\.?|n[uú]mero))?[\s\-–—:]*\d+\b[.:\-–—)]*(?:[#*=_~`]+\s*)?[ \t]*/i, '');
  text = text.replace(/\b(?:quest[ãa]o|q\.?)\s*\d+\b[.:\-–—)]*/gi, '');

  // 1. Remover Modelo 1, Modelo 2, Múltipla Escolha, Julgamento de Itens
  text = text.replace(/\(?\s*modelo\s*[12]\s*[-–—:]*\s*(?:m[úu]ltipla\s*escol(?:ha|a)|julgamento(?:\s+de\s+itens)?|certo\s*e?\s*errado)?\s*\)?/gi, '');
  text = text.replace(/\(?\s*m[úu]ltipla\s*escol(?:ha|a)\s*\)?/gi, '');
  text = text.replace(/\(?\s*julgamento\s+de\s+itens\s*\)?/gi, '');
  text = text.replace(/\(?\s*modelo\s*[12]\s*\)?/gi, '');

  // 2. Remover tags iniciais de cabeçalho do tipo (MÓDULO-2-CAPÍTULO 1- [1.0-INTRODUÇÃO])
  text = text.replace(/^\s*\([^)]*m[óo]dulo[^)]*\)\s*/i, '');

  // 2.1 Remover cabeçalhos de bloco / tópicos no início do enunciado (ex: QUESTÕES INÉDITAS — BLOCO 4.6.2 (AUTO CIRCUNSTANCIADO))
  text = text.replace(/^[ \t]*(?:[#*=_~-]+\s*)?(?:quest(?:[ãa]o|[õo]es)\s+in[ée]dita(?:s)?\s*[\-–—:]*\s*)?(?:bloco|t[óo]pico|subt[óo]pico)?\s*\d+(?:\.\d+)+[^\n\r]*(?:\r?\n)*/gi, '');
  text = text.replace(/^[ \t]*(?:[#*=_~-]+\s*)?(?:mat[ée]ria|disciplina|m[óo]dulo|cap[íi]tulo|cap\.?|subt[óo]pico|t[óo]pico|tema|subt[óo]pico\s+do\s+subt[óo]pico)\s*(?:[0-9IVXLCDM]+(?:\.[0-9IVXLCDM]+)*)?\s*[:.\-–—]?[^\n\r]*(?:\r?\n)*/gi, '');

  // 3. Remover número predefinido colado no início do enunciado (ex: "01. ", "Questão 01 - ", "1) ", "(01) ")
  const { cleaned: cleanWithoutNum } = cleanPredefinedQuestionNumber(text);
  text = cleanWithoutNum;

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

  // 4.1 Converter assertivas numeradas em arábicos (1., 2. ou 1 -, 2 - ou (1), (2)) em numerais romanos (I., II.)
  text = convertArabicAssertivasToRoman(text);

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

  // 7. Passagem final de garantia para remover qualquer número predefinido ou menção a Questão X que tenha sido exposto após a limpeza
  text = text.replace(/(?:^|\n)[ \t]*(?:[#*=_~`]+\s*)?(?:quest[ãa]o|q\.?|item|exerc[íi]cio|simulado)(?:\s*(?:n[º°o]\.?|n[uú]mero))?[\s\-–—:]*\d+\b[.:\-–—)]*(?:[#*=_~`]+\s*)?[ \t]*(?:\n|$)/gi, '\n');
  text = text.replace(/^[ \t]*(?:[#*=_~`]+\s*)?(?:quest[ãa]o|q\.?|item|exerc[íi]cio|simulado)(?:\s*(?:n[º°o]\.?|n[uú]mero))?[\s\-–—:]*\d+\b[.:\-–—)]*(?:[#*=_~`]+\s*)?[ \t]*/i, '');
  text = text.replace(/\b(?:quest[ãa]o|q\.?)\s*\d+\b[.:\-–—)]*/gi, '');

  const finalPass = cleanPredefinedQuestionNumber(text);
  return finalPass.cleaned || text;
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
  let materia = context?.materia || '';
  let modulo = context?.modulo || '';
  if (!materia && modulo && !/^\s*m[óo]dulo\b/i.test(modulo)) {
    materia = modulo;
    modulo = '';
  }
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
    const matM = tagContent.match(/(?:mat[ée]ria|disciplina)[\s\-–—:]*([^:\-–—\n]+)/i);
    const modM = tagContent.match(/m[óo]dulo[\s\-–—:]*([^:\-–—\n]+)/i);
    const capM = tagContent.match(/cap[íi]tulo[\s\-–—:]*([^:\-–—\n\[]+)/i);
    const subM = tagContent.match(/\[([^\]]+)\]|subt[óo]pico[\s\-–—:]*([^:\-–—\n]+)/i);

    if (matM && !materia) {
      materia = matM[1].trim().replace(/^[\-–—:]+/, '').trim();
    }
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
    const matMatch = line.match(/^(?:mat[ée]ria|disciplina|nome da mat[ée]ria):\s*(.+)$/i);
    const modMatch = line.match(/^(?:m[óo]dulo):\s*(.+)$/i);
    const capMatch = line.match(/^(?:cap[íi]tulo|assunto|t[óo]pico|cap[íi]tulo da mat[ée]ria):\s*(.+)$/i);
    const subMatch = line.match(/^(?:subt[óo]pico|subassunto):\s*(.+)$/i);
    const temaMatch = line.match(/^(?:tema|tema_subt[óo]pico|subtema):\s*(.+)$/i);
    const pesoMatch = line.match(/^(?:peso|pontos?|valor(?:\s+em\s+pontos)?):\s*(\d+(?:[.,]\d+)?)/i);

    // Também detectar cabeçalhos tipo QUESTÕES INÉDITAS — BLOCO 4.6.2 (AUTO CIRCUNSTANCIADO)
    const blockHeader = extractHierarchyFromHeaderLine(line);

    if (matMatch) {
      materia = matMatch[1].trim();
    } else if (modMatch) {
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
    } else if (blockHeader) {
      if (blockHeader.materia) {
        materia = blockHeader.materia;
      }
      if (blockHeader.modulo) {
        modulo = blockHeader.modulo;
      }
      if (blockHeader.capituloNum) {
        capitulo = blockHeader.capituloTitle ? `Capítulo ${blockHeader.capituloNum} – ${blockHeader.capituloTitle}` : `Capítulo ${blockHeader.capituloNum}`;
      } else if (blockHeader.capitulo) {
        capitulo = blockHeader.capitulo;
      }
      if (blockHeader.topicoNum) {
        subtopico = blockHeader.topicoNum;
      } else if (blockHeader.subtopico) {
        subtopico = blockHeader.subtopico;
      }
      if (blockHeader.tema) {
        tema_subtopico = blockHeader.tema;
      }
      // Cabeçalho hierárquico NÃO deve ir para o enunciado
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

  // Limpar prefixos e extrair número predefinido da questão colado no enunciado
  const { cleaned: cleanEnunciadoText, detectedNum } = cleanPredefinedQuestionNumber(enunciado);
  enunciado = smartFormatEnunciado(cleanEnunciadoText);

  // Limpar marcadores de notas, citações, linhas e números soltos das alternativas
  for (const alt of alternativas) {
    alt.texto = stripCitationMarkers(alt.texto);
    alt.texto = stripLineNumberMarkers(alt.texto);
    alt.texto = alt.texto.replace(/^[ \t]*(?:\(?\s*\d+\s*[\.\)\-–—:]|\[\s*\d+\s*\]|\d+[ \t]+)\s*/, '').trim();
  }

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
    numero_questao: detectedNum,
    materia: sanitizeEtiquetaField(materia),
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
 * Verifica se um trecho contém indicadores de alternativas de concurso (A-E, Certo/Errado) ou gabarito
 */
export function hasQuestionAlternativesOrGabarito(textChunk: string): boolean {
  const hasAlts = /(?:^|\n)[ \t]*(?:\(?\s*[a-eA-E]\s*[\)\].\-–—:]|\([a-eA-E]\)|\[[a-eA-E]\])[ \t]+/i.test(textChunk);
  const hasCE = /(?:^|\n)[ \t]*(?:Certo|Errado)\b/i.test(textChunk);
  const hasGab = /(?:gabarito|resposta(?:\s+oficial|\s+correta)?)\s*[:=-]/i.test(textChunk);
  return hasAlts || hasCE || hasGab;
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

  // 1. Estratégia de Prioridade Máxima: Marcadores Nominais Explícitos de Questões
  // ("Questão 1", "QUESTÃO 01", "Questão 2.", "Q1.", "Item 1", "Exercício 1")
  // Quando o texto possui marcadores nominais explícitos, ELES SÃO A ÚNICA REFERÊNCIA DE CORTE!
  // NUNCA misturar com números isolados como 1., 2., 1 -, 2 -, pois são itens/assertivas internas ou linhas de prova!
  const qMarkerRegex = /(?:^|\n)[ \t]*(?:[#*=_~`]+\s*)?(?:quest[ãa]o|q\.?|item|exerc[íi]cio|simulado)(?:\s*(?:n[º°o]\.?|n[uú]mero))?[\s\-–—:]*(\d+)\b[.:\-–—)]*(?:[#*=_~`]+\s*)?/gi;
  const qMatches: { index: number; num: number }[] = [];
  let qm: RegExpExecArray | null;
  while ((qm = qMarkerRegex.exec(text)) !== null) {
    const actualIndex = qm.index === 0 && !text.startsWith('\n') ? 0 : qm.index + 1;
    const lineEnd = text.indexOf('\n', actualIndex);
    const fullLine = text.substring(actualIndex, lineEnd !== -1 ? lineEnd : text.length);
    // Ignorar se a linha for menção em cabeçalho de gabarito comentado
    if (!/gabarito\s+comentado|coment[áa]rio|resolu[çc][ãa]o|justificativa/i.test(fullLine)) {
      qMatches.push({ index: actualIndex, num: parseInt(qm[1], 10) });
    }
  }

  if (qMatches.length >= 1) {
    qMatches.sort((a, b) => a.index - b.index);
    const validStarts: number[] = [qMatches[0].index];

    for (let i = 1; i < qMatches.length; i++) {
      const candidate = qMatches[i];
      // Aceita nova questão se o índice for posterior em mais de 30 caracteres
      if (candidate.index - validStarts[validStarts.length - 1] > 30) {
        validStarts.push(candidate.index);
      }
    }

    if (validStarts.length > 0) {
      const chunks: string[] = [];
      for (let i = 0; i < validStarts.length; i++) {
        const start = validStarts[i];
        const end = i + 1 < validStarts.length ? validStarts[i + 1] : text.length;
        const rawChunk = text.substring(start, end).trim();
        const cleanChunk = trimTrailingTransitionContent(rawChunk);
        if (cleanChunk.length > 20) {
          chunks.push(cleanChunk);
        }
      }
      if (chunks.length > 0) {
        return chunks;
      }
    }
  }

  // 1.B Estratégia de Fallback: Questões numeradas na raiz sem a palavra "Questão" (ex: "01. ", "1. ", "1) ", "1 - ")
  // Usada APENAS quando NÃO existem marcadores nominais "Questão X" no texto.
  const candidateMatches: { index: number; num: number }[] = [];
  const numMarkerRegex = /(?:^|\n)[ \t]*(?:(?:\(?\s*(\d{1,4})\s*[\.\)\-–—:ºª]|\[\s*(\d{1,4})\s*\]|\(\s*(\d{1,4})\s*\)))[ \t]+(?=[A-Za-z\u00C0-\u00DC"“'\(])/g;
  let nm: RegExpExecArray | null;
  while ((nm = numMarkerRegex.exec(text)) !== null) {
    const actualIndex = nm.index === 0 && !text.startsWith('\n') ? 0 : nm.index + 1;
    const num = parseInt(nm[1] || nm[2] || nm[3], 10);
    // Verificar se não está dentro de comentário
    const textBefore = text.substring(Math.max(0, actualIndex - 200), actualIndex);
    const isInComment = /coment[áa]rio|resolu[çc][ãa]o|gabarito\s+comentado|justificativa/i.test(textBefore);
    if (!isInComment && !candidateMatches.some((c) => Math.abs(c.index - actualIndex) < 20)) {
      candidateMatches.push({ index: actualIndex, num });
    }
  }

  // Número isolado em sua linha antes do enunciado: "1\nUma equipe..."
  const numLoneLineRegex = /(?:^|\n)[ \t]*(\d{1,4})[ \t]*(?:\r?\n)+(?=[A-Za-z\u00C0-\u00DC"“'\(])/g;
  let nlm: RegExpExecArray | null;
  while ((nlm = numLoneLineRegex.exec(text)) !== null) {
    const actualIndex = nlm.index === 0 && !text.startsWith('\n') ? 0 : nlm.index + 1;
    const num = parseInt(nlm[1], 10);
    const textBefore = text.substring(Math.max(0, actualIndex - 200), actualIndex);
    const isInComment = /coment[áa]rio|resolu[çc][ãa]o|gabarito\s+comentado|justificativa/i.test(textBefore);
    if (!isInComment && !candidateMatches.some((c) => Math.abs(c.index - actualIndex) < 20)) {
      candidateMatches.push({ index: actualIndex, num });
    }
  }

  candidateMatches.sort((a, b) => a.index - b.index);

  if (candidateMatches.length >= 1) {
    const validStarts: number[] = [candidateMatches[0].index];
    let lastAcceptedNum = candidateMatches[0].num;

    for (let i = 1; i < candidateMatches.length; i++) {
      const prevStart = validStarts[validStarts.length - 1];
      const candidate = candidateMatches[i];
      const prevChunk = text.substring(prevStart, candidate.index);

      // O candidato é válido SE E SOMENTE SE:
      // a) O bloco anterior já apresentou alternativas ou gabarito (evita quebrar assertivas internas 1., 2.)
      // b) E a numeração é estritamente superior ao último número aceito OU reinicia em 1 (mudança de matéria/bloco)
      if (hasQuestionAlternativesOrGabarito(prevChunk) && (candidate.num > lastAcceptedNum || candidate.num === 1)) {
        validStarts.push(candidate.index);
        lastAcceptedNum = candidate.num;
      }
    }

    // Se temos 1 ou mais inícios válidos de questões numeradas
    if (validStarts.length > 0) {
      const chunks: string[] = [];
      for (let i = 0; i < validStarts.length; i++) {
        const start = validStarts[i];
        const end = i + 1 < validStarts.length ? validStarts[i + 1] : text.length;
        const rawChunk = text.substring(start, end).trim();
        // Remove qualquer texto de transição / orientação / mudança de assunto que tenha ficado no final
        const cleanChunk = trimTrailingTransitionContent(rawChunk);
        if (cleanChunk.length > 20) {
          chunks.push(cleanChunk);
        }
      }
      if (chunks.length > 0) {
        return chunks;
      }
    }
  }

  // 2. Estratégia de Divisores Explícitos: ---, ===, ***, ___
  if (/(?:\n|^)[ \t]*[-=_*]{3,}[ \t]*(?:\n|$)/.test(text)) {
    const rawChunks = text.split(/(?:\n|^)[ \t]*[-=_*]{3,}[ \t]*(?:\n|$)/);
    const filtered = rawChunks.map((c) => c.trim()).filter((c) => c.length > 20);
    if (filtered.length > 1) {
      return filtered;
    }
  }

  // 3. Estratégia de Cabeçalhos Estruturados Repetidos no início de linha
  // Ex: "Módulo: Direito...", "Matéria: Português...", "Disciplina: ..."
  const headerMarkerRegex = /(?:^|\n)[ \t]*(?:m[óo]dulo|mat[ée]ria|disciplina|nome da mat[ée]ria)\s*[:=-]/gi;
  const headerIndices: number[] = [];
  let hm: RegExpExecArray | null;
  while ((hm = headerMarkerRegex.exec(text)) !== null) {
    const actualIndex = hm.index === 0 && !text.startsWith('\n') ? 0 : hm.index + 1;
    headerIndices.push(actualIndex);
  }
  if (headerIndices.length > 1) {
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
      const rawChunk = text.substring(currentStart, nextEnd).trim();
      const chunk = trimTrailingTransitionContent(rawChunk);
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
      return paragraphBlocks.map((b) => trimTrailingTransitionContent(b));
    }
  }

  return [trimTrailingTransitionContent(text)];
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
  context?: HierarchyContext,
  existingQuestions: Question[] = []
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

  // Segmentação inteligente por seções / blocos com cabeçalhos hierárquicos
  // (ex: QUESTÕES INÉDITAS — BLOCO 4.6.2 (AUTO CIRCUNSTANCIADO), # MÓDULO II, etc.)
  const lines = questionsText.split(/\r?\n/);
  const sectionChunks: { hierarchy: RawHierarchyMatch; lines: string[] }[] = [];
  let activeHierarchy: RawHierarchyMatch = {};
  let currentLines: string[] = [];
  let foundAnyHeader = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const detected = extractHierarchyFromHeaderLine(line);

    if (
      detected &&
      (detected.materia ||
        detected.modulo ||
        detected.capitulo ||
        detected.capituloNum ||
        detected.subtopico ||
        detected.topicoNum ||
        detected.tema ||
        detected.temaNum)
    ) {
      foundAnyHeader = true;
      if (currentLines.some((l) => l.trim().length > 0)) {
        sectionChunks.push({
          hierarchy: { ...activeHierarchy },
          lines: [...currentLines],
        });
        currentLines = [];
      }

      // Atualização hierárquica em cascata (se mudar matéria/módulo/capítulo, reseta níveis inferiores)
      if (detected.materia) {
        activeHierarchy.materia = detected.materia;
        if (!detected.modulo) delete activeHierarchy.modulo;
        if (!detected.capitulo && !detected.capituloNum) {
          delete activeHierarchy.capitulo;
          delete activeHierarchy.capituloNum;
          delete activeHierarchy.capituloTitle;
        }
        if (!detected.subtopico && !detected.topicoNum) {
          delete activeHierarchy.subtopico;
          delete activeHierarchy.topicoNum;
          delete activeHierarchy.topicoTitle;
        }
        if (!detected.tema && !detected.temaNum) {
          delete activeHierarchy.tema;
          delete activeHierarchy.temaNum;
          delete activeHierarchy.temaTitle;
        }
      }

      if (detected.modulo) {
        activeHierarchy.modulo = detected.modulo;
        if (!detected.capitulo && !detected.capituloNum) {
          delete activeHierarchy.capitulo;
          delete activeHierarchy.capituloNum;
          delete activeHierarchy.capituloTitle;
        }
        if (!detected.subtopico && !detected.topicoNum) {
          delete activeHierarchy.subtopico;
          delete activeHierarchy.topicoNum;
          delete activeHierarchy.topicoTitle;
        }
        if (!detected.tema && !detected.temaNum) {
          delete activeHierarchy.tema;
          delete activeHierarchy.temaNum;
          delete activeHierarchy.temaTitle;
        }
      }

      if (detected.capitulo || detected.capituloNum) {
        activeHierarchy.capitulo = detected.capitulo;
        activeHierarchy.capituloNum = detected.capituloNum;
        activeHierarchy.capituloTitle = detected.capituloTitle;
        if (!detected.subtopico && !detected.topicoNum) {
          delete activeHierarchy.subtopico;
          delete activeHierarchy.topicoNum;
          delete activeHierarchy.topicoTitle;
        }
        if (!detected.tema && !detected.temaNum) {
          delete activeHierarchy.tema;
          delete activeHierarchy.temaNum;
          delete activeHierarchy.temaTitle;
        }
      }

      if (detected.subtopico || detected.topicoNum) {
        activeHierarchy.subtopico = detected.subtopico;
        activeHierarchy.topicoNum = detected.topicoNum;
        activeHierarchy.topicoTitle = detected.topicoTitle;
        if (!detected.tema && !detected.temaNum) {
          delete activeHierarchy.tema;
          delete activeHierarchy.temaNum;
          delete activeHierarchy.temaTitle;
        }
      }

      if (detected.tema || detected.temaNum) {
        activeHierarchy.tema = detected.tema;
        activeHierarchy.temaNum = detected.temaNum;
        activeHierarchy.temaTitle = detected.temaTitle;
      }
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.some((l) => l.trim().length > 0)) {
    sectionChunks.push({
      hierarchy: { ...activeHierarchy },
      lines: currentLines,
    });
  }

  const rawParsedQuestions: ParsedQuestionResult[] = [];

  if (foundAnyHeader && sectionChunks.length > 0) {
    for (const section of sectionChunks) {
      const sectionText = section.lines.join('\n').trim();
      if (!sectionText) continue;

      const resolvedContext = resolveHierarchyWithExisting(
        section.hierarchy,
        existingQuestions,
        context
      );

      const splits = splitBatchQuestionsText(sectionText);
      for (const chunk of splits) {
        const cleanChunk = trimTrailingTransitionContent(chunk);
        const parsed = parseRawQuestionText(cleanChunk, resolvedContext);
        rawParsedQuestions.push(parsed);
      }
    }
  } else {
    // Modo padrão sem cabeçalhos de bloco explícitos
    const splits = splitBatchQuestionsText(questionsText);
    for (const chunk of splits) {
      const cleanChunk = trimTrailingTransitionContent(chunk);
      const parsed = parseRawQuestionText(cleanChunk, context);
      rawParsedQuestions.push(parsed);
    }
  }

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

    rawParsedQuestions.forEach((q, idx) => {
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

  // FILTRAGEM RIGOROSA DE CONTEÚDO QUE NÃO SÃO QUESTÕES:
  // Conforme expressamente solicitado: "ignore o conteúdo que não são questões as questões são numeradas, 1,2,3,4,5,6 e por aí vai,
  // os conteúdos texto de conteúdo não são questões apenas servem para orientar e falar que mudou de assunto".
  // Uma questão legítima DEVE possuir alternativas completas (>= 2) ou gabarito oficial definido ou comentário estruturado com alternativas.
  const realQuestions = rawParsedQuestions.filter((q) => {
    const hasAlts = q.alternativas && q.alternativas.length >= 2;
    const hasGab = Boolean(q.confidence.hasGabarito);
    const hasCom = Boolean(q.confidence.hasComentario);
    return hasAlts || hasGab || (hasCom && q.alternativas && q.alternativas.length >= 1);
  });

  // Atribuição de numeração rigorosamente automática e sequencial: 1, 2, 3, 4, 5, 6...
  // Conforme solicitação: "a numeração da questão deverá ser automática, não deve ter questão com mesmo número e elas devem ser dispostas em ordem ordinal 1,2,3,4,5,6"
  realQuestions.forEach((q, idx) => {
    q.numero_questao = idx + 1;

    // Remove marcadores e transições residuais do comentário e das alternativas
    if (q.gabarito_comentado) {
      q.gabarito_comentado = stripCitationMarkers(q.gabarito_comentado);
      q.gabarito_comentado = stripLineNumberMarkers(q.gabarito_comentado);
      q.gabarito_comentado = trimTrailingTransitionContent(q.gabarito_comentado);
    }
    q.alternativas.forEach((alt) => {
      alt.texto = stripCitationMarkers(alt.texto);
      alt.texto = stripLineNumberMarkers(alt.texto);
      alt.texto = trimTrailingTransitionContent(alt.texto);
      // Remove números marcadores no início de alternativas (ex: "1. ", "1 - ", "1) ", "[1]")
      alt.texto = alt.texto.replace(/^[ \t]*(?:\(?\s*\d+\s*[\.\)\-–—:]|\[\s*\d+\s*\]|\d+[ \t]+)\s*/, '').trim();
    });

    // Remove completamente qualquer número predefinido do comando (enunciado)
    const { cleaned } = cleanPredefinedQuestionNumber(q.enunciado);
    let finalEnunciado = smartFormatEnunciado(cleaned);

    // Garantia estrita: nenhum número da questão ou etiqueta de comando dentro do comando/enunciado
    finalEnunciado = finalEnunciado
      .replace(/(?:^|\n)[ \t]*(?:[#*=_~`]+\s*)?(?:quest[ãa]o|q\.?|item|exerc[íi]cio|simulado)(?:\s*(?:n[º°o]\.?|n[uú]mero))?[\s\-–—:]*\d+\b[.:\-–—)]*(?:[#*=_~`]+\s*)?[ \t]*(?:\n|$)/gi, '\n')
      .replace(/^[ \t]*(?:[#*=_~`]+\s*)?(?:quest[ãa]o|q\.?|item|exerc[íi]cio|simulado)?(?:\s*(?:n[º°o]\.?|n[uú]mero))?[\s\-–—:]*(\d+)\b[.:\-–—)]*\s*/i, '')
      .replace(/^[ \t]*\(?[ \t]*(?:comando(?:\s+da\s+quest[ãa]o)?|enunciado(?:\s+da\s+quest[ãa]o)?|pergunta)\s*(?:n[º°o]\.?|n[uú]mero)?\s*(?:\d+)?\s*[:.\-–—)]*\s*/i, '')
      .replace(/^[ \t]*(?:\(?\s*\d+\s*[\.\)\-–—:ºª]|\[\s*\d+\s*\]|\(\s*\d+\s*\)|\b\d+\s*[\.\)\-–—:])\s*/, '')
      .replace(/^[ \t]*\d+[ \t]+(?=[A-Za-z\u00C0-\u00DC"“'\(])/, '')
      .trim();

    q.enunciado = finalEnunciado;
  });

  return realQuestions;
}

/**
 * Exemplo real de questões inéditas da PF - Bloco 4.6.2 (Auto Circunstanciado)
 */
export const SAMPLE_BLOCO_462 = `QUESTÕES INÉDITAS — BLOCO 4.6.2 (AUTO CIRCUNSTANCIADO)

Questão 1
Uma equipe da Polícia Federal foi encarregada de estruturar uma investigação sobre lavagem de dinheiro transnacional. Diante da evolução metodológica da atividade investigativa e das diretrizes institucionais de instrução probatória, julgue os itens a seguir:
I. A investigação policial moderna caracteriza-se como atividade técnico-jurídica que superou a exclusiva dependência de relatos testemunhais e diligências de campo tradicionais.
II. A utilização de pesquisas em fontes abertas e consultas a relatórios de inteligência financeira qualifica-se como meio extraordinário de investigação submetido à prévia autorização judicial.
III. A adequada formalização dos dados obtidos ao longo da colheita informativa consubstancia elemento indispensável para a preservação da cadeia de custódia e validade das provas.
IV. O emprego de inteligência artificial na análise investigativa prescinde de balizamentos éticos e normativos por constituir mera ferramenta de suporte operacional.
Estão corretos os itens:
a) I e III, apenas.
b) II e IV, apenas.
c) I, II e III, apenas.
d) I, III e IV, apenas.

Gabarito Comentado — Questão 1: Alternativa a.
Item I (Correto): A investigação moderna evoluiu de um modelo exclusivamente focado em testemunhas e diligências empíricas de campo para uma atividade técnico-jurídica estruturada.
Item II (Incorreto): As consultas a fontes abertas e exames de inteligência financeira constituem ações ordinárias que não dependem de autorização judicial prévia.
Item III (Correto): A formalização rigorosa dos dados colhidos é o pilar que assegura a rastreabilidade da cadeia de custódia e a validade processual do elemento probatório.
Item IV (Incorreto): O uso de inteligência artificial e ferramentas tecnológicas deve obrigatoriamente submeter-se aos princípios constitucionais, legais e balizamentos éticos.

Questão 2
Acerca do nível de aprofundamento técnico e da abordagem pedagógica conferida aos instrumentos de obtenção de prova na formação investigativa, assinale a alternativa correta:
a) A infiltração policial prescinde de fundamentação legal e judicial detalhada por constituir meio ordinário de coleta informativa.
b) A análise telemática e a de ativos virtuais demandam maior detalhamento técnico devido à dinâmica da evolução tecnológica contemporânea.
c) A colaboração premiada deve ser abordada de forma estritamente operacional, dispensando o aprofundamento em sala de aula.
d) Os meios ordinários de investigação dispensam formalização procedimental por não estarem sujeitos ao controle de validade processual.

Gabarito Comentado — Questão 2: Alternativa b.
a) Incorreta: A infiltração de agentes constitui técnica extraordinária (especial) revestida de excepcionalidade e reserva de jurisdição.
b) Correta: Conforme o material de referência, matérias como análise telemática, bancária e de ativos virtuais exigem maior detalhamento e aprofundamento técnico em razão da rápida evolução tecnológica.
c) Incorreta: Institutos como a colaboração premiada e a infiltração são abordados sob parâmetros amplos adequados ao aprofundamento prático e doutrinário em sala de aula.
d) Incorreta: Todos os meios de prova, inclusive os ordinários, demandam estrita formalização para assegurar a higidez da cadeia de custódia.

Questão 3
Considerando os parâmetros legais e operacionais que regem a investigação policial contemporânea e a utilização dos meios de prova, julgue os itens subsequentes:
I. Os meios extraordinários de investigação caracterizam-se pela exigência de controle judicial prévio e por maior rigor procedimental.
II. O avanço tecnológico dispensou a cooperação interinstitucional, tornando a atuação isolada da Polícia Federal autossuficiente.
III. A consulta a bancos de dados e o exame de relatórios de inteligência constituem ferramentas ordinárias colocadas à disposição do investigador.
IV. A validade processual dos elementos colhidos na investigação independe do cumprimento rigoroso das regras de cadeia de custódia.
Estão corretos os itens:
a) II e IV, apenas.
b) I e III, apenas.
c) I e IV, apenas.
d) II e III, apenas.

Gabarito Comentado — Questão 3: Alternativa b.
Item I (Correto): Meios extraordinários (interceptação, quebra de sigilo) relativizam direitos fundamentais e dependem obrigatoriamente de autorização judicial prévia.
Item II (Incorreto): O enfrentamento de infrações penais complexas torna indispensável a cooperação interinstitucional e o trabalho integrado.
Item III (Correto): A pesquisa em bancos de dados e fontes abertas representa o primeiro passo ordinário e imediato do policial investigador.
Item IV (Incorreto): A inobservância das regras formais e da cadeia de custódia compromete diretamente a validade probatória em juízo.

Questão 4
Sobre o papel da tecnologia e da inteligência artificial na atividade de investigação policial, assinale a alternativa correta:
a) A inteligência artificial substitui integralmente a valoração jurídica do delegado de polícia no enquadramento dos fatos investigados.
b) As ferramentas tecnológicas dispensam o respeito aos princípios constitucionais haja vista a prevalência do interesse público na apuração.
c) A utilização de algoritmos de inteligência artificial como ferramenta de análise demanda a observância de potencialidades e desafios éticos.
d) O uso de recursos tecnológicos restringe-se aos meios extraordinários de investigação submetidos à reserva absoluta de jurisdição.

Gabarito Comentado — Questão 4: Alternativa c.
a) Incorreta: A tecnologia e os sistemas de inteligência atuam como ferramentas de suporte analítico, jamais substituindo o juízo técnico-jurídico da autoridade policial.
b) Incorreta: A atuação estatal de polícia judiciária é estritamente vinculada às garantias constitucionais e aos limites legais.
c) Correta: O emprego de inteligência artificial no processamento de grandes volumes de dados exige a contínua ponderação de desafios éticos e jurídicos.
d) Incorreta: Ferramentas tecnológicas aplicam-se cotidianamente tanto no âmbito das ações ordinárias (análise de dados abertos) quanto nas extraordinárias.

Questão 5
Em relação às características constitutivas e à evolução metodológica do processo investigativo estatal, julgue os itens a seguir:
I. A investigação criminal moderna fundamenta-se no uso racional de recursos tecnológicos e humanos aliados à cooperação interinstitucional.
II. A apuração de infrações penais na atualidade prescinde de fundamentação normativo-teórica quando amparada em dados tecnológicos.
III. O aprendizado acadêmico na formação policial visa articular fundamentos normativos e exemplos práticos da realidade operacional.
IV. Os meios ordinários de coleta de informações prescindem de observância ao ordenamento jurídico por possuírem caráter informal.
Estão corretos os itens:
a) I e II, apenas.
b) III e IV, apenas.
c) I e III, apenas.
d) II e IV, apenas.

Gabarito Comentado — Questão 5: Alternativa c.
Item I (Correto): O enfrentamento à criminalidade exige otimização de recursos, tecnologia e articulação entre órgãos estatais.
Item II (Incorreto): A atividade de investigação é eminentemente técnico-jurídica, demandando permanente respaldo na teoria e na norma regente.
Item III (Correto): A estrutura pedagógica visa unir sólida base conceitual a aplicabilidades práticas do dia a dia policial.
Item IV (Incorreto): Os meios ordinários, embora dispensem ordem judicial, devem obrigatoriamente respeitar a legislação, a ética e os direitos fundamentais.

Questão 6
No tocante ao tratamento conferido aos instrumentos ordinários e extraordinários no processo de persecução penal, assinale a alternativa correta:
a) As interceptações telefônicas e as quebras de sigilo constituem meios ordinários de investigação acessíveis de imediato pelo investigador.
b) A formalização procedimental adequada dos dados obtidos visa precipuamente assegurar a celeridade arbitrária da instrução policial.
c) A persecução penal dos crimes complexos exige esforço integrado entre órgãos públicos e emprego de metodologias de inteligência.
d) As pesquisas em fontes abertas demandam autorização prévia do Poder Judiciário sob pena de ilicitude do conhecimento produzido.

Gabarito Comentado — Questão 6: Alternativa c.
a) Incorreta: Interceptação e quebra de sigilo são meios extraordinários/especiais dependentes de autorização judicial prévia.
b) Incorreta: A formalização dos atos de investigação destina-se a garantir a legalidade, a ampla defesa, o contraditório e a higidez da cadeia de custódia.
c) Correta: O enfrentamento de crimes complexos (como lavagem de dinheiro e organizações criminosas) pressupõe atuação coordenada e inteligência estratégica.
d) Incorreta: Pesquisas em fontes abertas (OSINT) e dados públicos não dependem de autorização judicial.`;

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
