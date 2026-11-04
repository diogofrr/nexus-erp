import { Signal, WritableSignal, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { StorageService } from '@core/storage';
import { TableSort } from './table-utils';

export interface ListStateConfig {
  /** Nome da lista (`caregivers`). Separa o que é lembrado na sessão de cada lista. */
  key: string;
  /** Parâmetros de filtro estruturado na URL, em português: `['plano', 'status']`. */
  filterKeys: readonly string[];
  /** Ordem inicial, quando a URL não diz nada. */
  defaultSort?: TableSort | null;
}

export interface ListState {
  /** Filtros presentes na URL (`{ plano: 'cuida' }`). */
  readonly filters: Signal<Readonly<Record<string, string>>>;
  readonly sort: Signal<TableSort | null>;
  /** Página atual (começa em 1). */
  readonly page: Signal<number>;
  /** Texto da busca da lista: SÓ em memória e na sessão, NUNCA na URL (pode ser nome de pessoa, LP-21). */
  readonly search: WritableSignal<string>;
  /** Há filtro ou busca ativos? */
  readonly hasActive: Signal<boolean>;
  setFilter(key: string, value: string | null): void;
  setSort(sort: TableSort | null): void;
  setPage(page: number): void;
  /** Tira todos os filtros e a busca (volta à página 1; a ordem fica). */
  clear(): void;
}

const SORT_PARAM = 'ordem';
const PAGE_PARAM = 'pagina';

type Query = Readonly<Record<string, string>>;

function sortToParam(sort: TableSort | null): string | null {
  return sort ? `${sort.key}:${sort.direction}` : null;
}

function parseSort(raw: string | undefined, fallback: TableSort | null): TableSort | null {
  if (raw === undefined) {
    return fallback;
  }
  const [key, direction] = raw.split(':');
  return key && (direction === 'asc' || direction === 'desc') ? { key, direction } : fallback;
}

/**
 * Guarda filtros, ordem e página na URL (`?plano=cuida&ordem=nome:asc&pagina=2`) e restaura ao voltar (U-05):
 * o botão Voltar, o recarregar e o link compartilhado funcionam. O que está na URL também é lembrado na
 * sessão: voltar à lista sem parâmetros restaura o último estado. O texto da busca NÃO vai para a URL.
 * Chame em contexto de injeção (campo da página ou construtor). Os setters atualizam os sinais na hora e
 * navegam com `replaceUrl`, sem empilhar histórico; só parâmetros conhecidos entram na conta (os outros da
 * URL ficam como estão).
 *
 * ```ts
 * readonly list = createListState({ key: 'caregivers', filterKeys: ['plano', 'status'], defaultSort: { key: 'name', direction: 'asc' } });
 * // chips: (valueChange)="list.setFilter('plano', $event)"; tabela: [sort]="list.sort()" (sortChange)="list.setSort($event)"
 * ```
 */
export function createListState(config: ListStateConfig): ListState {
  const router = inject(Router);
  const route = inject(ActivatedRoute);
  const storage = inject(StorageService);
  const known = [...config.filterKeys, SORT_PARAM, PAGE_PARAM];
  const savedName = `list:${config.key}`;
  const searchName = `list:${config.key}:q`;
  const fallback = config.defaultSort ?? null;
  const fallbackParam = sortToParam(fallback);

  const read = (map: ParamMap): Query => {
    const out: Record<string, string> = {};
    known.forEach((key) => {
      const value = map.get(key);
      if (value) {
        out[key] = value;
      }
    });
    return out;
  };

  const query = signal<Query>(read(route.snapshot.queryParamMap));
  route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((map) => query.set(read(map)));

  const filters = computed(() => Object.fromEntries(config.filterKeys.flatMap((k) => (query()[k] ? [[k, query()[k]]] : []))));
  const sort = computed(() => parseSort(query()[SORT_PARAM], fallback));
  const page = computed(() => Math.max(1, Math.trunc(Number(query()[PAGE_PARAM])) || 1));
  const search = signal(storage.readSession<string>(searchName, ''));
  // O texto da busca fica só na memória e na sessão.
  effect(() => storage.writeSession(searchName, search()));

  const apply = (patch: Record<string, string | null>): void => {
    const next: Record<string, string> = { ...query() };
    Object.entries(patch).forEach(([key, value]) => {
      if (value === null || value === '') {
        delete next[key];
      } else {
        next[key] = value;
      }
    });
    if (next[SORT_PARAM] === fallbackParam) {
      delete next[SORT_PARAM];
    }
    query.set(next);
    storage.writeSession(savedName, next);
    void router.navigate([], {
      relativeTo: route,
      queryParams: Object.fromEntries(known.map((k) => [k, next[k] ?? null])),
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  };

  // Voltou à lista sem parâmetros: restaura o último estado da sessão.
  const saved = storage.readSession<Query | null>(savedName, null);
  if (Object.keys(query()).length === 0 && saved && Object.keys(saved).length > 0) {
    apply(Object.fromEntries(Object.entries(saved).filter(([k]) => known.includes(k))));
  }

  return {
    filters,
    sort,
    page,
    search,
    hasActive: computed(() => Object.keys(filters()).length > 0 || search() !== ''),
    setFilter: (key, value) => apply({ [key]: value, [PAGE_PARAM]: null }),
    setSort: (next) => apply({ [SORT_PARAM]: sortToParam(next), [PAGE_PARAM]: null }),
    setPage: (next) => apply({ [PAGE_PARAM]: next > 1 ? String(next) : null }),
    clear: () => {
      search.set('');
      apply({ ...Object.fromEntries(config.filterKeys.map((k) => [k, null])), [PAGE_PARAM]: null });
    },
  };
}
