import { describe, expect, it } from 'vitest';
import { TableColumn, clampPage, filterRows, nextSort, normalizeText, pageCount, pageItems, sortRows } from './table-utils';

interface Row {
  id: string;
  name: string;
  hours: number | null;
  plan: string;
}

const ROWS: Row[] = [
  { id: 'a', name: 'Ângela', hours: 9, plan: 'Cuida' },
  { id: 'b', name: 'Beatriz', hours: null, plan: 'Livre' },
  { id: 'c', name: 'Ana', hours: 11, plan: 'Cuida' },
  { id: 'd', name: 'Zélia', hours: 2, plan: 'Essencial' },
  { id: 'e', name: 'ana paula', hours: 10, plan: 'Livre' },
];
const COLUMNS: TableColumn<Row>[] = [
  { key: 'name', header: 'Cuidador', sortable: true, primary: true },
  { key: 'hours', header: 'Horas', sortable: true, align: 'end' },
  { key: 'plan', header: 'Plano', sortable: true },
  { key: 'actions', header: 'Ações', actions: true },
];

describe('ordenação', () => {
  it('três estados: sem ordem, crescente, decrescente, sem ordem', () => {
    const asc = nextSort(null, 'name');
    expect(asc).toEqual({ key: 'name', direction: 'asc' });
    const desc = nextSort(asc, 'name');
    expect(desc).toEqual({ key: 'name', direction: 'desc' });
    expect(nextSort(desc, 'name')).toBeNull();
    expect(nextSort(desc, 'plan')).toEqual({ key: 'plan', direction: 'asc' });
  });

  it('ordena em português: acento e caixa não contam, números pelo valor, vazios por último, estável', () => {
    const names = (sort: Parameters<typeof sortRows<Row>>[2]) => sortRows(ROWS, COLUMNS, sort).map((r) => r.name);
    expect(names({ key: 'name', direction: 'asc' })).toEqual(['Ana', 'ana paula', 'Ângela', 'Beatriz', 'Zélia']);
    expect(names({ key: 'name', direction: 'desc' })).toEqual(['Zélia', 'Beatriz', 'Ângela', 'ana paula', 'Ana']);
    expect(sortRows(ROWS, COLUMNS, { key: 'hours', direction: 'asc' }).map((r) => r.id)).toEqual(['d', 'a', 'e', 'c', 'b']);
    expect(sortRows(ROWS, COLUMNS, { key: 'hours', direction: 'desc' }).map((r) => r.id)).toEqual(['c', 'e', 'a', 'd', 'b']);
    expect(sortRows(ROWS, COLUMNS, { key: 'plan', direction: 'asc' }).map((r) => r.id)).toEqual(['a', 'c', 'd', 'b', 'e']);
    expect(sortRows(ROWS, COLUMNS, null)).toEqual(ROWS);
    expect(ROWS[0]?.id).toBe('a');
  });

  it('usa sortValue quando a coluna mostra outra coisa', () => {
    const cols: TableColumn<Row>[] = [{ key: 'plan', header: 'Plano', sortable: true, sortValue: (r) => ({ Livre: 0, Essencial: 1, Cuida: 2 })[r.plan] ?? 9 }];
    expect(sortRows(ROWS, cols, { key: 'plan', direction: 'asc' }).map((r) => r.plan)).toEqual(['Livre', 'Livre', 'Essencial', 'Cuida', 'Cuida']);
  });
});

describe('busca', () => {
  it('ignora acento e caixa e não olha a coluna de ações', () => {
    expect(normalizeText('  Márcia ')).toBe('marcia');
    expect(filterRows(ROWS, COLUMNS, 'angela').map((r) => r.id)).toEqual(['a']);
    expect(filterRows(ROWS, COLUMNS, 'ANA').map((r) => r.id)).toEqual(['c', 'e']);
    expect(filterRows(ROWS, COLUMNS, 'cuida').map((r) => r.id)).toEqual(['a', 'c']);
    expect(filterRows(ROWS, COLUMNS, '')).toHaveLength(5);
    expect(filterRows(ROWS, COLUMNS, 'zzz')).toEqual([]);
  });

  it('respeita searchText e noSearch', () => {
    const cols: TableColumn<Row>[] = [
      { key: 'name', header: 'Nome', searchText: (r) => `${r.name} ${r.id}` },
      { key: 'plan', header: 'Plano', noSearch: true },
    ];
    expect(filterRows(ROWS, cols, 'd').map((r) => r.id)).toEqual(['d']);
    expect(filterRows(ROWS, cols, 'livre')).toEqual([]);
  });
});

describe('páginas', () => {
  it('conta, limita e monta os números com reticências', () => {
    expect(pageCount(340, 25)).toBe(14);
    expect(pageCount(0, 25)).toBe(1);
    expect(clampPage(99, 340, 25)).toBe(14);
    expect(clampPage(0, 340, 25)).toBe(1);
    expect(clampPage(Number.NaN, 340, 25)).toBe(1);
    expect(pageItems(1, 3)).toEqual([1, 2, 3]);
    expect(pageItems(7, 14)).toEqual([1, 'gap', 6, 7, 8, 'gap', 14]);
    expect(pageItems(2, 14)).toEqual([1, 2, 3, 'gap', 14]);
  });
});
