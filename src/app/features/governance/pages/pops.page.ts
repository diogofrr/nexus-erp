import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { formatDate } from '@core/format';
import { Pop, PopReviewState } from '@core/models';
import { POP_RESPONSIBLE_LABELS, POP_STATE_LABELS } from '@core/rules/governance-access';
import {
  BadgeComponent,
  CellDirective,
  DataTableComponent,
  FilterChipsComponent,
  FilterOption,
  PageHeaderComponent,
  TableColumn,
  createListState,
} from '@shared/ui';
import { GovernanceTabsComponent } from '../components/governance-tabs.component';
import { GovernanceService } from '../state/governance.service';

interface PopRow {
  id: string;
  pop: Pop;
  state: PopReviewState;
}

const STATE_VARIANT: Record<PopReviewState, 'success' | 'attention' | 'danger'> = {
  up_to_date: 'success',
  due: 'attention',
  revision_triggered: 'danger',
};
const STATE_ICON: Record<PopReviewState, 'circle-check' | 'clock' | 'triangle-alert'> = {
  up_to_date: 'circle-check',
  due: 'clock',
  revision_triggered: 'triangle-alert',
};

/**
 * SCR-M13-01 POPs (`/app/governanca/pops`). Os 10 procedimentos com responsável (Quadro 11), última revisão e
 * estado (em dia, a revisar, revisão acionada). Filtro na URL (`?filtro=a-revisar`); a linha abre o POP.
 */
@Component({
  selector: 'app-governance-pops-page',
  imports: [
    BadgeComponent,
    CellDirective,
    DataTableComponent,
    FilterChipsComponent,
    PageHeaderComponent,
    GovernanceTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      <app-page-header
        title="Procedimentos (POPs)"
        [count]="count()"
        description="Cada POP tem objetivo, responsável, materiais, passo a passo, registro exigido, indicadores e data da última revisão."
      />
      <app-governance-tabs />

      <app-data-table
        caption="Procedimentos operacionais padrão"
        noun="POPs"
        [rows]="rows()"
        [columns]="columns"
        [rowKey]="rowKey"
        searchable
        searchLabel="Buscar POP"
        searchPlaceholder="Buscar por código ou título"
        rowClickable
        [filtersActive]="list.hasActive()"
        [sort]="list.sort()"
        (sortChange)="list.setSort($event)"
        [(search)]="list.search"
        (rowClick)="open($event)"
        (filtersCleared)="list.clear()"
        emptyTitle="Nenhum POP encontrado"
        emptyText="Tire o filtro ou busque por outro código."
      >
        <app-filter-chips
          appTableFilters
          label="Estado"
          [options]="options()"
          [value]="state()"
          (valueChange)="list.setFilter('filtro', $event)"
        />
        <ng-template appCell="code" let-row>
          <strong class="t-num">{{ row.pop.code }}</strong>
        </ng-template>
        <ng-template appCell="state" let-row>
          <app-badge [variant]="variant(row.state)" [icon]="icon(row.state)">{{ stateLabel(row.state) }}</app-badge>
        </ng-template>
      </app-data-table>
    </div>
  `,
})
export class PopsPageComponent {
  private readonly svc = inject(GovernanceService);
  private readonly router = inject(Router);

  protected readonly list = createListState({
    key: 'governance-pops',
    filterKeys: ['filtro'],
    defaultSort: { key: 'code', direction: 'asc' },
  });
  protected readonly state = computed(() => this.list.filters()['filtro'] ?? null);

  private readonly all = computed<PopRow[]>(() =>
    this.svc.pops().map((p) => ({ id: p.pop.code, pop: p.pop, state: p.state })),
  );
  protected readonly rows = computed(() => {
    const filter = this.state();
    return this.all().filter((r) =>
      filter === 'a-revisar'
        ? r.state !== 'up_to_date'
        : filter === 'em-dia'
          ? r.state === 'up_to_date'
          : true,
    );
  });
  protected readonly count = computed(() => {
    const n = this.rows().length;
    return `${n} ${n === 1 ? 'POP' : 'POPs'}`;
  });
  protected readonly options = computed<FilterOption[]>(() => [
    { value: 'a-revisar', label: 'A revisar', count: this.all().filter((r) => r.state !== 'up_to_date').length },
    { value: 'em-dia', label: 'Em dia', count: this.all().filter((r) => r.state === 'up_to_date').length },
  ]);

  protected readonly columns: TableColumn<PopRow>[] = [
    { key: 'code', header: 'Código', primary: true, sortable: true, value: (r) => r.pop.code },
    { key: 'title', header: 'Procedimento', sortable: true, value: (r) => r.pop.title },
    {
      key: 'responsible',
      header: 'Responsável',
      sortable: true,
      value: (r) => POP_RESPONSIBLE_LABELS[r.pop.responsibleRole],
    },
    {
      key: 'reviewed',
      header: 'Última revisão',
      sortable: true,
      value: (r) => formatDate(r.pop.lastReviewedAt),
      sortValue: (r) => r.pop.lastReviewedAt,
    },
    { key: 'state', header: 'Estado', value: (r) => POP_STATE_LABELS[r.state] },
  ];
  protected readonly rowKey = (row: PopRow): string => row.id;

  protected variant(state: PopReviewState): 'success' | 'attention' | 'danger' {
    return STATE_VARIANT[state];
  }
  protected icon(state: PopReviewState): 'circle-check' | 'clock' | 'triangle-alert' {
    return STATE_ICON[state];
  }
  protected stateLabel(state: PopReviewState): string {
    return POP_STATE_LABELS[state];
  }

  protected open(row: PopRow): void {
    void this.router.navigate(['/app/governanca/pops', row.pop.code]);
  }
}
