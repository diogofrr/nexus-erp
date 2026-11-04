/**
 * Matemática dos gráficos SVG (funções puras, testadas). Os componentes só desenham o que sai daqui.
 * Convenção: o gráfico tem 560 de largura no `viewBox` (design system 4.11) e rola dentro do cartão
 * abaixo de 34 rem.
 */

/** Largura do `viewBox` de todos os gráficos de eixo. */
export const CHART_WIDTH = 560;

export interface NiceScale {
  min: number;
  max: number;
  step: number;
  ticks: number[];
}

/** Passo "bonito" (1, 2, 2,5, 5 ou 10 vezes uma potência de dez) para cobrir `rawStep`. */
export function niceStep(rawStep: number): number {
  if (!(rawStep > 0) || !Number.isFinite(rawStep)) {
    return 1;
  }
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;
  const factor =
    residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 2.5 ? 2.5 : residual <= 5 ? 5 : 10;
  return factor * magnitude;
}

/** Corrige o erro binário de somas de passos (0,1 + 0,2). */
export function cleanNumber(value: number): number {
  return Math.round(value * 1e9) / 1e9;
}

/**
 * Escala com marcas redondas que cobre `[minValue, maxValue]`. Com `includeZero`, o zero sempre entra
 * (barras e áreas partem do zero).
 */
export function niceScale(
  minValue: number,
  maxValue: number,
  targetTicks = 5,
  includeZero = true,
): NiceScale {
  let lo = includeZero ? Math.min(minValue, 0) : minValue;
  let hi = includeZero ? Math.max(maxValue, 0) : maxValue;
  if (lo === hi) {
    const pad = Math.abs(lo) > 0 ? Math.abs(lo) * 0.1 : 1;
    lo -= pad;
    hi += pad;
  }
  const step = niceStep((hi - lo) / Math.max(1, targetTicks - 1));
  const min = cleanNumber(Math.floor(lo / step) * step);
  const max = cleanNumber(Math.ceil(hi / step) * step);
  const ticks: number[] = [];
  for (let v = min; v <= max + step / 2; v += step) {
    ticks.push(cleanNumber(v));
  }
  return { min, max, step, ticks };
}

/** Escala linear: leva um valor do domínio para o contradomínio (em pixels do `viewBox`). */
export function linearScale(
  domainMin: number,
  domainMax: number,
  rangeMin: number,
  rangeMax: number,
): (value: number) => number {
  const span = domainMax - domainMin;
  return (value: number) =>
    span === 0 ? rangeMin : rangeMin + ((value - domainMin) / span) * (rangeMax - rangeMin);
}

/** Arredonda para uma casa decimal de pixel (SVG mais leve e testes estáveis). */
export function px(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Texto de `points` de `polyline` e `polygon`. */
export function pointsAttribute(points: readonly { x: number; y: number }[]): string {
  return points.map((p) => `${px(p.x)},${px(p.y)}`).join(' ');
}

/** Margem esquerda que cabe o maior rótulo do eixo (a 12 px de fonte, cerca de 7 px por caractere). */
export function leftMargin(labels: readonly string[], min = 40): number {
  const longest = labels.reduce((max, l) => Math.max(max, l.length), 0);
  return Math.max(min, Math.ceil(longest * 7 + 16));
}

/** Passo dos rótulos do eixo X para não passar de `maxLabels` rótulos. */
export function labelEvery(count: number, maxLabels = 12): number {
  return Math.max(1, Math.ceil(count / maxLabels));
}

export interface DonutArc {
  /** Parte do círculo (0 a 100). */
  percent: number;
  /** Onde o arco começa (0 a 100). */
  offset: number;
}

/**
 * Arcos da rosca em circunferência 100 (`r = 15,9155`): `stroke-dasharray = "p 100-p"` e
 * `stroke-dashoffset = -acumulado`. Valores nulos ou negativos não desenham arco.
 */
export function donutArcs(values: readonly (number | null)[]): DonutArc[] {
  const total = values.reduce<number>((sum, v) => sum + (v !== null && v > 0 ? v : 0), 0);
  let offset = 0;
  return values.map((v) => {
    const percent = total > 0 && v !== null && v > 0 ? (v / total) * 100 : 0;
    const arc = { percent, offset };
    offset += percent;
    return arc;
  });
}

/** Nível de criticidade de uma célula da matriz de riscos: C até 4, de 5 a 11, 12 ou mais. */
export type HeatLevel = 'low' | 'mid' | 'high';

export function heatLevel(criticality: number): HeatLevel {
  return criticality >= 12 ? 'high' : criticality >= 5 ? 'mid' : 'low';
}

/** Posição (em %) do marcador do termômetro: `(pontos + 0,5) / 89`. */
export function gaugePosition(score: number, maxScore = 88): number {
  const clamped = Math.min(Math.max(score, 0), maxScore);
  return Math.round(((clamped + 0.5) / (maxScore + 1)) * 10000) / 100;
}

/** Caminho de uma sparkline (`M x y L x y ...`) no `viewBox` 104 x 32, com folga de 2 px nas bordas. */
export function sparklinePath(values: readonly number[]): {
  d: string;
  last: { x: number; y: number } | null;
} {
  if (values.length === 0) {
    return { d: '', last: null };
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const x = linearScale(0, Math.max(1, values.length - 1), 2, 100);
  const y = linearScale(min === max ? min - 1 : min, min === max ? max + 1 : max, 28, 4);
  const pts = values.map((v, i) => ({ x: px(x(i)), y: px(y(v)) }));
  return {
    d: pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' '),
    last: pts[pts.length - 1] ?? null,
  };
}
