/**
 * Embaralha um array de forma pseudo-aleatória determinística baseada em uma semente (seed).
 * Isso assegura estabilidade visual enquanto o estudante resolve as questões,
 * e gera uma nova ordem aleatória completa quando a semente muda (ex: clicar em Reembaralhar).
 */
export function shuffleArrayWithSeed<T>(array: T[], seed: number = 1): T[] {
  const result = [...array];
  let s = Math.abs(seed) % 2147483647;
  if (s <= 0) s = 123456789;

  // Gerador LCG (Linear Congruential Generator) padrão
  const pseudoRandom = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  // Fisher-Yates shuffle
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(pseudoRandom() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}
