/**
 * Gerador pseudoaleatório DETERMINÍSTICO (mulberry32) com semente textual. O seed nunca usa `Math.random()`:
 * mesma semente (`nexus-seed-1`), mesmo resultado a cada reset (escopo, seção 5.0).
 */

/** Hash FNV-1a de 32 bits de um texto, usado para derivar a semente numérica. */
export function hashSeed(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export class Rng {
  private state: number;

  constructor(seed: string | number) {
    this.state = (typeof seed === 'string' ? hashSeed(seed) : seed) >>> 0;
  }

  /** Número em [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Inteiro entre `min` e `max`, inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** `true` com probabilidade `p` (0 a 1). */
  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)] as T;
  }

  /** Embaralha uma cópia (Fisher-Yates). */
  shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.next() * (i + 1));
      [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
    }
    return copy;
  }

  /** `count` itens distintos, em ordem aleatória. */
  sample<T>(items: readonly T[], count: number): T[] {
    return this.shuffle(items).slice(0, count);
  }
}
