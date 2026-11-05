import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  ElementRef,
  TemplateRef,
  booleanAttribute,
  computed,
  contentChildren,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { EmptyStateComponent } from '../display/empty-state.component';
import { SegmentOption, SegmentedComponent } from '../display/segmented.component';
import { SearchFieldComponent } from '../forms/search-field.component';
import { MOBILE_QUERY, mediaQuery } from '../util/media';
import { nounFor } from '../util/noun';
import { PaginationComponent } from './pagination.component';
import { SortHeaderComponent } from './sort-header.component';
import {
  TableColumn,
  TableSort,
  cellText,
  cellValue,
  clampPage,
  filterRows,
  sortRows,
} from './table-utils';

export type TableState = 'ready' | 'loading' | 'error' | 'forbidden';
export type TableDensity = 'comfortable' | 'compact';
export type RowKey = string | number;

/** Contexto que o modelo de célula recebe. */
export interface CellContext<T> {
  /** A linha (`let-row`). */
  $implicit: T;
  /** O valor da coluna (`let-value="value"`). */
  value: unknown;
  /** Há linhas selecionadas: desabilite as ações da linha (lote ativo). */
  selecting: boolean;
  index: number;
}

/**
 * Modelo de uma célula: `<ng-template appCell="status" let-row let-value="value">...</ng-template>`.
 * A chave é a `key` da coluna.
 */
@Directive({ selector: 'ng-template[appCell]' })
export class CellDirective {
  readonly key = input.required<string>({ alias: 'appCell' });
  readonly template = inject<TemplateRef<CellContext<unknown>>>(TemplateRef);
}

const DENSITIES: readonly SegmentOption<TableDensity>[] = [
  { value: 'compact', label: 'Compacta', icon: 'layout-list' },
  { value: 'comfortable', label: 'Confortável', icon: 'table' },
];

function defaultRowKey(row: unknown, index: number): RowKey {
  const id = (row as { id?: unknown } | null)?.id;
  return typeof id === 'string' || typeof id === 'number' ? id : index;
}

/**
 * Tabela de dados genérica (PD-01). Colunas declarativas (`TableColumn`) com modelos de célula (`appCell`),
 * ordenação em três estados, busca, seleção com barra de ações em lote, paginação ou rolagem, densidade,
 * estados (carregando em esqueleto, vazio de dois tipos, erro e sem permissão) e contagem sempre visível.
 *
 * - Filtros em chips e ações entram por conteúdo projetado: `[appTableFilters]`, `[appTableActions]`, `[appBulkActions]`.
 * - Linha clicável (`rowClickable`): Enter ou clique abrem (`rowClick`); setas, Home e End movem o foco entre
 *   linhas; clique em botão, link ou caixa dentro da linha NÃO abre.
 * - Abaixo de 768 px as linhas viram cartões usando `data-label` (a ordenação e o "selecionar todos" vão para a
 *   barra de ferramentas, porque o cabeçalho some); a paginação vira "Carregar mais".
 * - Ações em lote só seguras ou reversíveis; nunca excluir, anonimizar ou descredenciar em lote.
 * - Tabelas de COMPARAÇÃO entre colunas (projeção, log, matriz) não são cartões: desligue com `[stack]="false"`.
 *
 * ```html
 * <app-data-table caption="Cuidadores cadastrados" noun="cuidadores" [rows]="rows()" [columns]="columns"
 *                searchable selectable rowClickable (rowClick)="open($event)">
 *   <ng-template appCell="plan" let-row><app-plan-badge [plan]="row.planId" /></ng-template>
 * </app-data-table>
 * ```
 */
@Component({
  selector: 'app-data-table',
  imports: [
    NgTemplateOutlet,
    EmptyStateComponent,
    PaginationComponent,
    SearchFieldComponent,
    SegmentedComponent,
    SortHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="table-toolbar">
      @if (searchable()) {
        <app-search-field [label]="searchLabel()" [placeholder]="searchPlaceholder()" [value]="search()" (valueChange)="onSearch($event)" />
      }
      <ng-content select="[appTableFilters]" />
      <div class="toolbar-end">
        @if (mobile() && selectable() && state() === 'ready') {
          <label class="check">
            <input type="checkbox" [checked]="allOnPage()" [indeterminate]="someOnPage()" (change)="togglePage()" />
            <span>Selecionar todos</span>
          </label>
        }
        @if (mobile() && sortableColumns().length > 0) {
          <label class="cluster">
            <span class="sr-only">Ordenar por</span>
            <select class="select select--sm" (change)="onMobileSort($event)">
              <option value="" [selected]="!sort()">Sem ordem</option>
              @for (column of sortableColumns(); track column.key) {
                <option [value]="column.key + ':asc'" [selected]="isSort(column.key, 'asc')">{{ column.header }}, crescente</option>
                <option [value]="column.key + ':desc'" [selected]="isSort(column.key, 'desc')">{{ column.header }}, decrescente</option>
              }
            </select>
          </label>
        }
        @if (densityToggle() && !mobile()) {
          <app-segmented label="Densidade" [options]="densities" [value]="density()" (valueChange)="onDensity($event)" />
        }
        <ng-content select="[appTableActions]" />
      </div>
    </div>

    @if (selectedCount() > 0) {
      <div class="selection-bar" role="status">
        <span>{{ selectedCount() }} {{ selectedCount() === 1 ? 'selecionado' : 'selecionados' }}</span>
        @if (offerSelectAll()) {
          <button type="button" class="btn-link" (click)="selectAllResults()">Selecionar todos os {{ total() }} resultados</button>
        }
        <div class="cluster">
          <ng-content select="[appBulkActions]" />
          <button type="button" class="btn btn--sm btn--ghost" (click)="clearSelection()">Limpar seleção</button>
        </div>
      </div>
    }

    @switch (state()) {
      @case ('loading') {
        <div class="table-wrap" aria-busy="true">
          <table class="table" [attr.data-density]="density()" role="table" [attr.aria-label]="'Carregando: ' + caption()">
            <thead role="rowgroup">
              <tr role="row">
                @for (column of columns(); track column.key) {
                  <th role="columnheader" scope="col">{{ column.actions ? '' : column.header }}</th>
                }
              </tr>
            </thead>
            <tbody role="rowgroup">
              @for (n of skeletonRows; track n) {
                <tr role="row">
                  @for (column of columns(); track column.key) {
                    <td role="cell"><span class="skeleton skeleton--text"></span></td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
      @case ('error') {
        <div class="card">
          <app-empty-state compact kind="error" title="Não foi possível carregar a lista" [text]="errorText()">
            <button type="button" class="btn" (click)="retry.emit()">Tentar de novo</button>
          </app-empty-state>
        </div>
      }
      @case ('forbidden') {
        <div class="card">
          <app-empty-state compact kind="forbidden" title="Esta lista não está disponível para o seu perfil" [text]="forbiddenText()" />
        </div>
      }
      @default {
        @if (total() === 0) {
          <div class="card">
            <app-empty-state compact [title]="emptyHeading()" [text]="emptyBody()">
              @if (hasFilters()) {
                <button type="button" class="btn" (click)="clearAll()">Limpar filtros</button>
              }
            </app-empty-state>
          </div>
        } @else {
          <div class="table-wrap" [style.max-height]="paging() === 'scroll' ? maxHeight() : null">
            <table class="table" role="table" [class.table--stack]="stack()" [attr.data-density]="density()">
              <caption class="sr-only">{{ caption() }}</caption>
              <thead role="rowgroup">
                <tr role="row">
                  @if (selectable()) {
                    <th class="col-select" role="columnheader" scope="col">
                      <label class="check">
                        <input type="checkbox" aria-label="Selecionar todos desta página" [checked]="allOnPage()" [indeterminate]="someOnPage()" (change)="togglePage()" />
                      </label>
                    </th>
                  }
                  @for (column of columns(); track column.key) {
                    @if (column.sortable) {
                      <th
                        role="columnheader"
                        [appSortHeader]="column.key"
                        [sort]="sort()"
                        [class.col-num]="column.align === 'end'"
                        (sortChange)="setSort($event)"
                      >{{ column.header }}</th>
                    } @else {
                      <th role="columnheader" scope="col" [class.col-num]="column.align === 'end'" [class.col-actions]="column.actions">
                        @if (column.actions) {
                          <span class="sr-only">{{ column.header }}</span>
                        } @else {
                          {{ column.header }}
                        }
                      </th>
                    }
                  }
                </tr>
              </thead>
              <tbody role="rowgroup">
                @for (row of visibleRows(); track keyOf(row); let i = $index) {
                  <tr
                    role="row"
                    data-row
                    [attr.aria-selected]="selectable() ? isSelected(row) : null"
                    [attr.data-clickable]="rowClickable() ? '' : null"
                    [attr.tabindex]="rowClickable() ? (i === activeIndex() ? 0 : -1) : null"
                    (click)="onRowClick($event, row)"
                    (keydown)="onRowKey($event, row, i)"
                    (focus)="activeRow.set(i)"
                  >
                    @if (selectable()) {
                      <td class="col-select" role="cell" data-label="Selecionar">
                        <label class="check">
                          <input type="checkbox" [attr.aria-label]="rowLabelOf(row)" [checked]="isSelected(row)" (change)="toggleRow(row)" />
                        </label>
                      </td>
                    }
                    @for (column of columns(); track column.key) {
                      <td
                        role="cell"
                        [attr.data-label]="column.mobileLabel ?? column.header"
                        [class.col-num]="column.align === 'end'"
                        [class.col-primary]="column.primary"
                        [class.col-muted]="column.muted"
                        [class.col-actions]="column.actions"
                      >
                        @if (cellTemplate(column.key); as tpl) {
                          <ng-container *ngTemplateOutlet="tpl; context: contextFor(column, row, i)" />
                        } @else {
                          {{ textOf(column, row) }}
                        }
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    }

    @if (state() === 'ready' && total() > 0) {
      <div class="table-footer">
        <span role="status" aria-live="polite">{{ countText() }}</span>
        @if (paging() === 'pages' && !mobile()) {
          <app-pagination [total]="total()" [page]="pageNumber()" (pageChange)="page.set($event)" [(pageSize)]="pageSize" [pageSizes]="pageSizes()" />
        }
        @if (paging() === 'pages' && mobile() && hasMore()) {
          <button type="button" class="btn" (click)="loadMore()">Carregar mais {{ pageSize() }}</button>
        }
      </div>
    }
  `,
})
export class DataTableComponent<T> {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly rows = input.required<readonly T[]>();
  readonly columns = input.required<readonly TableColumn<T>[]>();
  /** Nome da tabela para leitor de tela (obrigatório). */
  readonly caption = input.required<string>();
  /** O que a lista conta ("cuidadores"). */
  readonly noun = input('itens');
  readonly state = input<TableState>('ready');
  /** Id da linha (seleção e desenho estável). Padrão: `row.id`, senão o índice. */
  readonly rowKey = input<(row: T, index: number) => RowKey>(defaultRowKey);
  /** Nome da linha para o rótulo da caixa ("Selecionar CUI-0042"). Padrão: a coluna primária. */
  readonly rowLabel = input<(row: T) => string>();
  readonly stack = input(true, { transform: booleanAttribute });

  readonly searchable = input(false, { transform: booleanAttribute });
  readonly searchLabel = input('Buscar na lista');
  readonly searchPlaceholder = input('Buscar');
  readonly search = model('');

  readonly selectable = input(false, { transform: booleanAttribute });
  readonly selection = model<readonly RowKey[]>([]);

  readonly sort = model<TableSort | null>(null);

  readonly paging = input<'pages' | 'scroll'>('pages');
  readonly page = model(1);
  readonly pageSize = model(25);
  readonly pageSizes = input<readonly number[]>([25, 50, 100]);
  /** Altura máxima da rolagem no modo `scroll`. */
  readonly maxHeight = input('32rem');

  readonly density = model<TableDensity>('comfortable');
  readonly densityToggle = input(false, { transform: booleanAttribute });

  readonly rowClickable = input(false, { transform: booleanAttribute });
  /** Há filtros externos ativos (chips). Muda o texto do vazio para "nada encontrado". */
  readonly filtersActive = input(false, { transform: booleanAttribute });
  readonly emptyTitle = input('Nada por aqui ainda');
  readonly emptyText = input('Quando houver itens, eles aparecem nesta lista.');
  readonly errorText = input('Tente de novo. Se continuar, avise a equipe.');
  readonly forbiddenText = input('Fale com a gestão se você precisa deste acesso.');

  readonly rowClick = output<T>();
  readonly retry = output<void>();
  /** "Limpar filtros" foi usado: limpe também os chips externos. */
  readonly filtersCleared = output<void>();

  private readonly cells = contentChildren(CellDirective);
  protected readonly mobile = mediaQuery(MOBILE_QUERY);
  protected readonly densities = DENSITIES;
  protected readonly skeletonRows = [1, 2, 3, 4, 5, 6];
  protected readonly activeRow = signal(0);
  private readonly loadedPages = signal(1);

  protected readonly sortableColumns = computed(() => this.columns().filter((c) => c.sortable));

  private readonly keys = computed(() => {
    const map = new Map<T, RowKey>();
    const keyOf = this.rowKey();
    this.rows().forEach((row, index) => map.set(row, keyOf(row, index)));
    return map;
  });

  private readonly filtered = computed(() => filterRows(this.rows(), this.columns(), this.search()));
  private readonly sorted = computed(() => sortRows(this.filtered(), this.columns(), this.sort()));
  protected readonly total = computed(() => this.sorted().length);
  protected readonly pageNumber = computed(() => clampPage(this.page(), this.total(), this.pageSize()));

  /** As linhas da página atual (ou todas, no modo rolagem). Para seleção por página. */
  private readonly pageRows = computed(() => {
    const all = this.sorted();
    if (this.paging() === 'scroll') {
      return all;
    }
    const start = (this.pageNumber() - 1) * this.pageSize();
    return all.slice(start, start + this.pageSize());
  });

  /** O que aparece na tela: no celular, "Carregar mais" acumula páginas. */
  protected readonly visibleRows = computed(() =>
    this.mobile() && this.paging() === 'pages' ? this.sorted().slice(0, this.loadedPages() * this.pageSize()) : this.pageRows(),
  );
  protected readonly hasMore = computed(() => this.visibleRows().length < this.total());
  protected readonly activeIndex = computed(() => Math.min(this.activeRow(), Math.max(0, this.visibleRows().length - 1)));

  private readonly selectedSet = computed(() => new Set<RowKey>(this.selection()));
  protected readonly selectedCount = computed(() => this.selectedSet().size);
  private readonly pageKeys = computed(() => this.visibleRows().map((row) => this.keyOf(row)));
  protected readonly allOnPage = computed(() => this.pageKeys().length > 0 && this.pageKeys().every((k) => this.selectedSet().has(k)));
  protected readonly someOnPage = computed(() => !this.allOnPage() && this.pageKeys().some((k) => this.selectedSet().has(k)));
  protected readonly offerSelectAll = computed(
    () => this.allOnPage() && this.total() > this.pageKeys().length && !this.sorted().every((row) => this.selectedSet().has(this.keyOf(row))),
  );

  protected readonly hasFilters = computed(() => this.search().trim() !== '' || this.filtersActive());
  protected readonly emptyHeading = computed(() => {
    if (!this.hasFilters()) {
      return this.emptyTitle();
    }
    const term = this.search().trim();
    return term ? `Nada encontrado para "${term}"` : `Nenhum resultado com esses filtros`;
  });
  protected readonly emptyBody = computed(() =>
    this.hasFilters() ? 'Confira o nome ou o código e tente de novo, ou limpe os filtros.' : this.emptyText(),
  );
  protected readonly countText = computed(() => {
    const total = this.total();
    const all = this.rows().length;
    const noun = nounFor(total, this.noun());
    if (this.paging() === 'scroll' || this.mobile()) {
      const shown = this.mobile() && this.paging() === 'pages' ? this.visibleRows().length : total;
      return shown === total ? `${total} ${noun}${total !== all ? ` (de ${all})` : ''}` : `Mostrando ${shown} de ${total} ${noun}`;
    }
    const from = (this.pageNumber() - 1) * this.pageSize() + 1;
    const to = Math.min(total, this.pageNumber() * this.pageSize());
    return `Mostrando ${from} a ${to} de ${total} ${noun}${total !== all ? ` (filtrado de ${all})` : ''}`;
  });

  protected keyOf(row: T): RowKey {
    return this.keys().get(row) ?? defaultRowKey(row, -1);
  }

  protected isSelected(row: T): boolean {
    return this.selectedSet().has(this.keyOf(row));
  }

  protected isSort(key: string, direction: 'asc' | 'desc'): boolean {
    const sort = this.sort();
    return sort?.key === key && sort.direction === direction;
  }

  protected cellTemplate(key: string): TemplateRef<CellContext<unknown>> | null {
    return this.cells().find((c) => c.key() === key)?.template ?? null;
  }

  protected contextFor(column: TableColumn<T>, row: T, index: number): CellContext<T> {
    return { $implicit: row, value: cellValue(column, row), selecting: this.selectedCount() > 0, index };
  }

  protected textOf(column: TableColumn<T>, row: T): string {
    return cellText(column, row);
  }

  protected rowLabelOf(row: T): string {
    const custom = this.rowLabel();
    const primary = this.columns().find((c) => c.primary);
    const label = custom ? custom(row) : primary ? cellText(primary, row) : '';
    return `Selecionar ${label || 'linha'}`;
  }

  protected onDensity(value: TableDensity | undefined): void {
    this.density.set(value ?? 'comfortable');
  }

  // ===== Busca, ordem, páginas =====

  protected onSearch(term: string): void {
    this.search.set(term);
    this.page.set(1);
    this.loadedPages.set(1);
  }

  protected setSort(next: TableSort | null): void {
    this.sort.set(next);
    this.page.set(1);
    this.loadedPages.set(1);
  }

  protected onMobileSort(event: Event): void {
    const [key, direction] = (event.target as HTMLSelectElement).value.split(':');
    this.setSort(key && (direction === 'asc' || direction === 'desc') ? { key, direction } : null);
  }

  protected loadMore(): void {
    this.loadedPages.update((n) => n + 1);
  }

  protected clearAll(): void {
    this.onSearch('');
    this.filtersCleared.emit();
  }

  // ===== Seleção =====

  protected toggleRow(row: T): void {
    const key = this.keyOf(row);
    const next = new Set(this.selectedSet());
    if (!next.delete(key)) {
      next.add(key);
    }
    this.selection.set([...next]);
  }

  protected togglePage(): void {
    const next = new Set(this.selectedSet());
    if (this.allOnPage()) {
      this.pageKeys().forEach((k) => next.delete(k));
    } else {
      this.pageKeys().forEach((k) => next.add(k));
    }
    this.selection.set([...next]);
  }

  protected selectAllResults(): void {
    this.selection.set(this.sorted().map((row) => this.keyOf(row)));
  }

  protected clearSelection(): void {
    this.selection.set([]);
  }

  // ===== Linha clicável e teclado =====

  protected onRowClick(event: Event, row: T): void {
    if (!this.rowClickable()) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target?.closest('a, button, input, label, select, textarea')) {
      return;
    }
    this.rowClick.emit(row);
  }

  protected onRowKey(event: KeyboardEvent, row: T, index: number): void {
    if (!this.rowClickable() || event.target !== event.currentTarget) {
      return;
    }
    const last = this.visibleRows().length - 1;
    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        this.rowClick.emit(row);
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.focusRow(Math.min(last, index + 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.focusRow(Math.max(0, index - 1));
        break;
      case 'Home':
        event.preventDefault();
        this.focusRow(0);
        break;
      case 'End':
        event.preventDefault();
        this.focusRow(last);
        break;
      default:
        break;
    }
  }

  private focusRow(index: number): void {
    this.activeRow.set(index);
    this.host.nativeElement.querySelectorAll<HTMLElement>('tbody tr[data-row]')[index]?.focus();
  }
}
