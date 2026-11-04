/**
 * Agregação com mínimo de 5 por recorte (RN-KPI-02, RN-CORP-08, LP-09).
 * Indicador de saúde para a gestão (`partner`), o atendimento e empresas contratantes NUNCA mostra um
 * recorte com menos de 5 pessoas: devolve "dado insuficiente" (exibido como "menos de 5").
 */

/** Mínimo de pessoas por recorte exibido (padrão do protótipo, editável em `AppSettings.minGroupSizeForAggregates`). */
export const MIN_GROUP_SIZE = 5;

/** Texto longo (para leitores de tela e relatórios). */
export const INSUFFICIENT_DATA_LABEL = 'dado insuficiente';
/** Texto curto exibido nas tabelas e gráficos (AC-M06-11). */
export const LESS_THAN_MIN_LABEL = 'menos de 5';

export interface SufficientAggregate<T> {
  sufficient: true;
  value: T;
  /** Quantidade de pessoas do recorte. */
  n: number;
}

/** Recorte pequeno demais: não revela nem o número exato (só que é menor que o mínimo). */
export interface InsufficientAggregate {
  sufficient: false;
  label: typeof INSUFFICIENT_DATA_LABEL;
  shortLabel: string;
}

export type Aggregate<T> = SufficientAggregate<T> | InsufficientAggregate;

/** O recorte tem pessoas suficientes para ser exibido? */
export function isSufficient(groupSize: number, min: number = MIN_GROUP_SIZE): boolean {
  return groupSize >= min;
}

function insufficient(min: number): InsufficientAggregate {
  return { sufficient: false, label: INSUFFICIENT_DATA_LABEL, shortLabel: `menos de ${min}` };
}

/** Contagem protegida: devolve o número só se o recorte tem pelo menos `min` pessoas. */
export function aggregateCount(count: number, min: number = MIN_GROUP_SIZE): Aggregate<number> {
  return isSufficient(count, min)
    ? { sufficient: true, value: count, n: count }
    : insufficient(min);
}

/** Valor calculado sobre um recorte (por exemplo, média). Só é calculado e exibido se `n >= min`. */
export function aggregateValue<T>(
  groupSize: number,
  compute: () => T,
  min: number = MIN_GROUP_SIZE,
): Aggregate<T> {
  return isSufficient(groupSize, min)
    ? { sufficient: true, value: compute(), n: groupSize }
    : insufficient(min);
}

/** Média protegida. */
export function aggregateMean(
  values: readonly number[],
  min: number = MIN_GROUP_SIZE,
): Aggregate<number> {
  return aggregateValue(
    values.length,
    () => values.reduce((s, v) => s + v, 0) / values.length,
    min,
  );
}

/** Agrupa itens por chave e protege cada grupo (contagem). */
export function aggregateByKey<T, K extends string>(
  items: readonly T[],
  keyOf: (item: T) => K,
  min: number = MIN_GROUP_SIZE,
): Record<string, Aggregate<number>> {
  const counts = new Map<string, number>();
  items.forEach((item) => counts.set(keyOf(item), (counts.get(keyOf(item)) ?? 0) + 1));
  const result: Record<string, Aggregate<number>> = {};
  counts.forEach((count, key) => {
    result[key] = aggregateCount(count, min);
  });
  return result;
}

/**
 * Distribuição com chaves fixas (ex.: as 4 faixas da Zarit), incluindo as vazias.
 * Chaves sem ninguém aparecem como 0 SUPRIMIDO ("menos de 5"), não como zero exato.
 */
export function aggregateDistribution<K extends string>(
  keys: readonly K[],
  counts: Readonly<Partial<Record<K, number>>>,
  min: number = MIN_GROUP_SIZE,
): Record<K, Aggregate<number>> {
  const result = {} as Record<K, Aggregate<number>>;
  keys.forEach((key) => {
    result[key] = aggregateCount(counts[key] ?? 0, min);
  });
  return result;
}

/** Texto para exibir um agregado de contagem: o número ou "menos de 5". */
export function displayAggregate(aggregate: Aggregate<number>): string {
  return aggregate.sufficient ? String(aggregate.value) : aggregate.shortLabel;
}
