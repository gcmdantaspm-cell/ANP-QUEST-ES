function hasAlternatives(text: string): boolean {
  // Check for (A) / A) / A. / A - or Certo / Errado or Gabarito
  const hasAlts = /(?:^|\n)[ \t]*(?:\(?\s*[a-eA-E]\s*[\)\].\-–—:]|\([a-eA-E]\)|\[[a-eA-E]\])[ \t]+/i.test(text);
  const hasCE = /(?:^|\n)[ \t]*(?:Certo|Errado)\b/i.test(text);
  const hasGab = /(?:gabarito|resposta)\s*[:=-]/i.test(text);
  return hasAlts || hasCE || hasGab;
}

function smartSplitQuestions(text: string): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];

  // Check strategy 1: explicit separators (---, ===, ***, ___)
  if (/(?:\n|^)[ \t]*[-=_*]{3,}[ \t]*(?:\n|$)/.test(clean)) {
    const rawChunks = clean.split(/(?:\n|^)[ \t]*[-=_*]{3,}[ \t]*(?:\n|$)/);
    const filtered = rawChunks.map(c => c.trim()).filter(c => c.length > 20);
    if (filtered.length > 1) return filtered;
  }

  // Strategy 2: Explicit "Questão X", "QUESTÃO X", "Q.X", "Q X" at start of line
  // (Excluding "Gabarito Comentado — Questão X")
  const qMarkerRegex = /(?:^|\n)[ \t]*(?:quest[ãa]o|q\.?|exerc[íi]cio|simulado)\s*(?:n[º°o]\s*)?(\d+)\b[.:\-–—)]*/gi;
  const namedIndices: { index: number; num: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = qMarkerRegex.exec(clean)) !== null) {
    const actualIndex = m.index === 0 && !clean.startsWith("\n") ? 0 : m.index + 1;
    const lineEnd = clean.indexOf("\n", actualIndex);
    const line = clean.substring(actualIndex, lineEnd !== -1 ? lineEnd : clean.length);
    if (!/gabarito|coment[áa]rio|resolu[çc][ãa]o|justificativa/i.test(line)) {
      namedIndices.push({ index: actualIndex, num: parseInt(m[1], 10) });
    }
  }

  if (namedIndices.length > 1) {
    const validStarts = [namedIndices[0].index];
    for (let i = 1; i < namedIndices.length; i++) {
      const prevStart = validStarts[validStarts.length - 1];
      const candidateStart = namedIndices[i].index;
      const prevChunk = clean.substring(prevStart, candidateStart);
      if (hasAlternatives(prevChunk)) {
        validStarts.push(candidateStart);
      }
    }
    if (validStarts.length > 1) {
      const chunks: string[] = [];
      for (let i = 0; i < validStarts.length; i++) {
        const start = validStarts[i];
        const end = i + 1 < validStarts.length ? validStarts[i + 1] : clean.length;
        chunks.push(clean.substring(start, end).trim());
      }
      return chunks;
    }
  }

  // Strategy 3: Numbered lines "1. ", "01. ", "1) ", "1 - " at root level
  const numMarkerRegex = /(?:^|\n)[ \t]*(?:(?:\(?\s*(\d{1,3})\s*[\.\)\-–—:ºª]|\[\s*(\d{1,3})\s*\]|\(\s*(\d{1,3})\s*\)))[ \t]+(?=[A-Za-z\u00C0-\u00DC"“'\(\[])/g;
  const numMatches: { index: number; num: number }[] = [];
  while ((m = numMarkerRegex.exec(clean)) !== null) {
    const actualIndex = m.index === 0 && !clean.startsWith("\n") ? 0 : m.index + 1;
    const num = parseInt(m[1] || m[2] || m[3], 10);
    numMatches.push({ index: actualIndex, num });
  }

  if (numMatches.length > 1) {
    const validStarts: number[] = [numMatches[0].index];
    let expectedNext = numMatches[0].num + 1;

    for (let i = 1; i < numMatches.length; i++) {
      const prevStart = validStarts[validStarts.length - 1];
      const candidate = numMatches[i];
      const prevChunk = clean.substring(prevStart, candidate.index);

      if (hasAlternatives(prevChunk) && (candidate.num >= expectedNext || candidate.num > numMatches[0].num)) {
        validStarts.push(candidate.index);
        expectedNext = candidate.num + 1;
      }
    }

    if (validStarts.length > 1) {
      const chunks: string[] = [];
      for (let i = 0; i < validStarts.length; i++) {
        const start = validStarts[i];
        const end = i + 1 < validStarts.length ? validStarts[i + 1] : clean.length;
        chunks.push(clean.substring(start, end).trim());
      }
      return chunks;
    }
  }

  return [clean];
}

const testText = `
01. (Cespe / Cebraspe - 2024) O auto circunstanciado de busca e apreensão deve relatar minuciosamente os objetos encontrados.
A) Certo
B) Errado
Gabarito: A
Comentário: Correto.

02. (Cespe / Cebraspe - 2024) A apreensão de bens prescinde de termo próprio.
A) Certo
B) Errado
Gabarito: B
Comentário: Errado.

03. (Cespe / Cebraspe - 2024) Acerca da investigação:
1. O inquérito é inquisitivo.
2. A ação penal é pública.
Estão corretos:
A) Apenas 1
B) Apenas 2
C) 1 e 2
D) Nenhum
Gabarito: C
Comentário: Ambos corretos.
`;

const res = smartSplitQuestions(testText);
console.log("Count:", res.length);
res.forEach((c, i) => console.log(`Q${i+1} preview:`, JSON.stringify(c.slice(0, 45))));
