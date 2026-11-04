/** Utilidades numéricas puras usadas pelas regras. */

/**
 * Arredonda "meio para cima" (afastando do zero) com `decimals` casas, sem o erro binário do ponto flutuante
 * (`roundHalfUp(86.25, 1) === 86.3`, `roundHalfUp(1.005, 2) === 1.01`).
 */
export function roundHalfUp(value: number, decimals = 0): number {
  if (!Number.isFinite(value)) {
    return value;
  }
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  const text = String(abs);
  if (text.includes('e')) {
    const factor = 10 ** decimals;
    return (sign * Math.round(abs * factor)) / factor;
  }
  const shifted = Number(`${text}e${decimals}`);
  return sign * Number(`${Math.round(shifted)}e-${decimals}`);
}

/** Percentual `part / whole * 100` arredondado; `null` se `whole` é zero. */
export function percentOf(part: number, whole: number, decimals = 1): number | null {
  if (whole === 0) {
    return null;
  }
  return roundHalfUp((part / whole) * 100, decimals);
}

/** Média aritmética; `null` para lista vazia. */
export function mean(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Soma. */
export function sum(values: readonly number[]): number {
  return values.reduce((total, v) => total + v, 0);
}

/** `true` para inteiro dentro do intervalo (inclusive). */
export function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}
