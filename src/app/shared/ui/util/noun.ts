/**
 * Concordância de contadores (CX-001): "1 solicitação", "2 solicitações". Recebe o substantivo no plural, como as
 * telas já passam (`noun="solicitações"`), e devolve o singular quando a quantidade é 1.
 */
export function singularNoun(plural: string): string {
  const lower = plural.toLowerCase();
  if (lower === 'meses') {
    return plural.slice(0, -5) + 'mês';
  }
  if (/(ões|ães)$/.test(lower)) {
    return plural.slice(0, -3) + 'ão';
  }
  if (/ns$/.test(lower)) {
    return plural.slice(0, -2) + 'm';
  }
  if (/ais$/.test(lower)) {
    return plural.slice(0, -3) + 'al';
  }
  if (/eis$/.test(lower)) {
    return plural.slice(0, -3) + 'el';
  }
  if (/[rz]es$/.test(lower)) {
    return plural.slice(0, -2);
  }
  if (/s$/.test(lower)) {
    return plural.slice(0, -1);
  }
  return plural;
}

/** Substantivo na forma certa para a quantidade: 1 vira singular, o resto fica como veio. */
export function nounFor(count: number, plural: string): string {
  return count === 1 ? singularNoun(plural) : plural;
}
