import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import type { PlanId } from '@core/models';
import {
  ActiveFilter,
  ActiveFiltersComponent,
  CellDirective,
  DataTableComponent,
  DeadlineBadgeComponent,
  FilterChipsComponent,
  FilterOption,
  PaginationComponent,
  PlanBadgeComponent,
  RowKey,
  SegmentOption,
  SegmentedComponent,
  TableColumn,
  TableDensity,
  TableSort,
  TableState,
  ZaritBandBadgeComponent,
  PLAN_NAMES,
  createListState,
} from '@shared/ui';
import { KIT_PEOPLE, KitPerson } from './kit.data';

const STATES: SegmentOption<TableState | 'empty'>[] = [
  { value: 'ready', label: 'Com dados' },
  { value: 'loading', label: 'Carregando' },
  { value: 'empty', label: 'Vazia' },
  { value: 'error', label: 'Erro' },
  { value: 'forbidden', label: 'Sem permissão' },
];

/** Tabela de dados com todos os estados, filtros na URL, paginação e a coluna de ações. */
@Component({
  selector: 'app-kit-data',
  imports: [
    ActiveFiltersComponent,
    CellDirective,
    DataTableComponent,
    DeadlineBadgeComponent,
    FilterChipsComponent,
    PaginationComponent,
    PlanBadgeComponent,
    SegmentedComponent,
    ZaritBandBadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'stack stack--8' },
  template: `
    <section class="stack stack--6" aria-labelledby="kit-table-title">
      <div class="section-head">
        <h2 id="kit-table-title">Tabela de dados</h2>
        <p>Ordenação, busca sem acento, filtros na URL, seleção, linha clicável, densidade e todos os estados. Abaixo de 768 px vira cartões.</p>
      </div>

      <div class="cluster">
        <span class="t-ui">Estado da lista:</span>
        <app-segmented label="Estado da lista" [options]="states" [(value)]="mode" />
      </div>

      <app-data-table
        caption="Cuidadores de exemplo"
        noun="cuidadores"
        [rows]="rows()"
        [columns]="columns"
        [state]="tableState()"
        [filtersActive]="list.hasActive()"
        [sort]="list.sort()"
        (sortChange)="list.setSort($event)"
        [search]="list.search()"
        (searchChange)="list.search.set($event)"
        [page]="list.page()"
        (pageChange)="list.setPage($event)"
        [(selection)]="selection"
        [(density)]="density"
        searchable
        selectable
        rowClickable
        densityToggle
        (rowClick)="opened.set($event.name)"
        (retry)="mode.set('ready')"
        (filtersCleared)="clearFilters()"
      >
        <div appTableFilters class="cluster">
          <app-filter-chips label="Plano" [options]="planOptions()" [value]="plan()" (valueChange)="list.setFilter('plano', $event)" [allCount]="people.length" />
        </div>
        <button appTableActions type="button" class="btn btn--sm">Exportar CSV</button>
        <button appBulkActions type="button" class="btn btn--sm">Marcar como visto</button>
        <ng-template appCell="name" let-row>
          <span class="col-primary">{{ row.name }}</span>
          <span class="code-chip">{{ row.code }}</span>
        </ng-template>
        <ng-template appCell="plan" let-row><app-plan-badge [plan]="row.plan" /></ng-template>
        <ng-template appCell="zarit" let-row>
          @if (row.zarit !== null) {
            <app-zarit-band-badge [score]="row.zarit" />
          } @else {
            <span class="badge badge--outline">Aplicação pendente</span>
          }
        </ng-template>
        <ng-template appCell="due" let-row><app-deadline-badge [due]="row.dueDate" unit="days" /></ng-template>
        <ng-template appCell="actions" let-row let-selecting="selecting">
          <button type="button" class="btn btn--sm" [disabled]="selecting" (click)="opened.set(row.name)">Abrir</button>
        </ng-template>
      </app-data-table>
      <p class="t-ui" role="status">{{ opened() ? 'Abriria a ficha de ' + opened() + '.' : 'Clique ou use Enter numa linha para abrir.' }}</p>
      <p class="t-caption">
        Filtros e ordem na URL: <code>{{ query() }}</code>. O texto da busca nunca entra na URL.
      </p>
      <app-active-filters [filters]="activeFilters()" (removed)="list.setFilter($event, null)" (cleared)="clearFilters()" />
    </section>

    <section class="stack stack--6" aria-labelledby="kit-pagination-title">
      <div class="section-head">
        <h2 id="kit-pagination-title">Paginação</h2>
        <p>Sem rolagem infinita em tabela. 25, 50 ou 100 por página.</p>
      </div>
      <div class="card card--pad">
        <app-pagination [total]="340" [(page)]="page" [(pageSize)]="pageSize" noun="cuidadores" summary />
      </div>
    </section>
  `,
})
export class KitDataSection {
  protected readonly people = KIT_PEOPLE;
  protected readonly states = STATES;
  protected readonly mode = signal<TableState | 'empty'>('ready');
  protected readonly density = signal<TableDensity>('comfortable');
  protected readonly selection = signal<readonly RowKey[]>([]);
  protected readonly opened = signal('');
  protected readonly page = signal(1);
  protected readonly pageSize = signal(25);

  /** Filtros e ordem na URL (`?plano=cuida&ordem=name:desc&pagina=2`), restaurados ao voltar. */
  protected readonly list = createListState({
    key: 'kit-people',
    filterKeys: ['plano'],
    defaultSort: { key: 'name', direction: 'asc' } satisfies TableSort,
  });
  protected readonly plan = computed(() => this.list.filters()['plano'] ?? null);
  protected readonly query = computed(() => {
    const parts = Object.entries(this.list.filters()).map(([k, v]) => `${k}=${v}`);
    const sort = this.list.sort();
    if (sort) {
      parts.push(`ordem=${sort.key}:${sort.direction}`);
    }
    if (this.list.page() > 1) {
      parts.push(`pagina=${this.list.page()}`);
    }
    return parts.length > 0 ? `?${parts.join('&')}` : '(vazia)';
  });

  protected readonly tableState = computed<TableState>(() => (this.mode() === 'empty' ? 'ready' : (this.mode() as TableState)));
  protected readonly rows = computed<readonly KitPerson[]>(() => {
    if (this.mode() === 'empty') {
      return [];
    }
    const plan = this.plan();
    return plan ? KIT_PEOPLE.filter((p) => p.plan === plan) : KIT_PEOPLE;
  });
  protected readonly planOptions = computed<FilterOption[]>(() =>
    (['livre', 'essencial', 'cuida', 'sustenta'] as PlanId[]).map((id) => ({
      value: id,
      label: PLAN_NAMES[id],
      count: KIT_PEOPLE.filter((p) => p.plan === id).length,
    })),
  );
  protected readonly activeFilters = computed<ActiveFilter[]>(() => {
    const plan = this.plan();
    return plan ? [{ key: 'plano', label: `Plano: ${PLAN_NAMES[plan as PlanId]}` }] : [];
  });

  protected readonly columns: TableColumn<KitPerson>[] = [
    { key: 'name', header: 'Cuidador', primary: true, sortable: true, searchText: (p) => `${p.name} ${p.code}` },
    { key: 'plan', header: 'Plano', sortable: true, sortValue: (p) => PLAN_NAMES[p.plan], noSearch: true },
    { key: 'zarit', header: 'Zarit', sortable: true, sortValue: (p) => p.zarit, noSearch: true },
    { key: 'hoursPerDay', header: 'Horas por dia', align: 'end', sortable: true, noSearch: true },
    { key: 'due', header: 'Próxima aplicação', sortable: true, sortValue: (p) => p.dueDate, noSearch: true },
    { key: 'actions', header: 'Ações', actions: true },
  ];

  protected clearFilters(): void {
    this.list.clear();
    this.page.set(1);
    this.selection.set([]);
  }
}
