export type SortDirection = 'asc' | 'desc';

export interface TableSort {
  key: string;
  direction: SortDirection;
}

/**
 * Coluna declarativa do `app-data-table`. O conteúdo da célula vem de `value`/`key` ou de um modelo
 * `<ng-template appCell="chave">`.
 */
export interface TableColumn<T> {
  /** Identifica a coluna (também liga o modelo de célula `appCell` e a ordenação). */
  key: string;
  /** Texto do cabeçalho. Em coluna de ações fica escondido (só leitor de tela). */
  header: string;
  /** Valor da célula. Padrão: `row[key]`. */
  value?: (row: T) => unknown;
  sortable?: boolean;
  /** Valor usado na ordenação. Padrão: `value`. */
  sortValue?: (row: T) => string | number | null | undefined;
  /** Texto usado na busca. Padrão: o texto mostrado. */
  searchText?: (row: T) => string;
  /** Fica fora da busca. */
  noSearch?: boolean;
  /** Números e dinheiro à direita. */
  align?: 'start' | 'end';
  /** Primeira coluna, a que identifica a linha (nome mais código). */
  primary?: boolean;
  muted?: boolean;
  /** Última coluna: uma ação visível com texto e o resto em "Mais ações". */
  actions?: boolean;
  /** Rótulo no cartão do celular (`data-label`). Padrão: `header`. */
  mobileLabel?: string;
}

const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

/** Sem ordem, depois crescente, depois decrescente, depois sem ordem (os três estados de UX 5.1). */
export function nextSort(current: TableSort | null, key: string): TableSort | null {
  if (current?.key !== key) {
    return { key, direction: 'asc' };
  }
  return current.direction === 'asc' ? { key, direction: 'desc' } : null;
}

export function cellValue<T>(column: TableColumn<T>, row: T): unknown {
  return column.value ? column.value(row) : (row as Record<string, unknown>)[column.key];
}

/** Texto mostrado numa célula sem modelo. Valor vazio vira texto vazio: o modelo de célula decide como mostrar a ausência. */
export function cellText<T>(column: TableColumn<T>, row: T): string {
  const value = cellValue(column, row);
  return value === null || value === undefined ? '' : String(value);
}

/** Ordenação estável, em português (acento e caixa não contam, números "naturais"), vazios por último. */
export function sortRows<T>(rows: readonly T[], columns: readonly TableColumn<T>[], sort: TableSort | null): T[] {
  const copy = [...rows];
  const column = sort ? columns.find((c) => c.key === sort.key) : undefined;
  if (!sort || !column) {
    return copy;
  }
  const sign = sort.direction === 'asc' ? 1 : -1;
  const read = (row: T): string | number | null | undefined => {
    if (column.sortValue) {
      return column.sortValue(row);
    }
    const value = cellValue(column, row);
    return typeof value === 'number' || typeof value === 'string' ? value : value == null ? null : String(value);
  };
  return copy
    .map((row, index) => ({ row, index, key: read(row) }))
    .sort((a, b) => {
      const aEmpty = a.key === null || a.key === undefined || a.key === '';
      const bEmpty = b.key === null || b.key === undefined || b.key === '';
      if (aEmpty || bEmpty) {
        return aEmpty && bEmpty ? a.index - b.index : aEmpty ? 1 : -1;
      }
      const result =
        typeof a.key === 'number' && typeof b.key === 'number'
          ? a.key - b.key
          : collator.compare(String(a.key), String(b.key));
      return result !== 0 ? sign * result : a.index - b.index;
    })
    .map((entry) => entry.row);
}

/** Minúsculas e sem acento: "Márcia" casa com "marcia". */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/** Filtra por texto nas colunas buscáveis (todas, menos as de ações e as marcadas `noSearch`). */
export function filterRows<T>(rows: readonly T[], columns: readonly TableColumn<T>[], term: string): T[] {
  const needle = normalizeText(term);
  if (needle === '') {
    return [...rows];
  }
  const searchable = columns.filter((c) => !c.actions && !c.noSearch);
  return rows.filter((row) =>
    searchable.some((c) => normalizeText(c.searchText ? c.searchText(row) : cellText(c, row)).includes(needle)),
  );
}

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
}

export function clampPage(page: number, total: number, pageSize: number): number {
  return Math.min(Math.max(1, Math.trunc(page) || 1), pageCount(total, pageSize));
}

/** Números de página a mostrar, com reticências: `1 … 4 5 6 … 14`. */
export function pageItems(page: number, pages: number): (number | 'gap')[] {
  const wanted = new Set<number>([1, pages, page - 1, page, page + 1]);
  const sorted = [...wanted].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const items: (number | 'gap')[] = [];
  sorted.forEach((n, i) => {
    const previous = sorted[i - 1];
    if (previous !== undefined && n - previous > 1) {
      items.push('gap');
    }
    items.push(n);
  });
  return items;
}
