import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { formatDate, formatMoney } from '@core/format';
import type { CorporateAccount } from '@core/models';
import {
  ActiveFilter,
  ActiveFiltersComponent,
  BadgeComponent,
  CellDirective,
  DataTableComponent,
  EmptyStateComponent,
  FilterChipsComponent,
  FilterOption,
  IconComponent,
  KpiComponent,
  KpiStripComponent,
  PLAN_NAMES,
  PageHeaderComponent,
  PlanBadgeComponent,
  TableColumn,
  TableState,
  createListState,
} from '@shared/ui';
import { CompanyFormDrawerComponent } from '../components/company-form.drawer';
import { CompaniesService } from '../state/companies.service';
import {
  CORPORATE_FUNNEL,
  CORPORATE_STATUS_LABEL,
  CORPORATE_STATUS_LOOK,
  plural,
} from '../state/partner-labels';

interface CompanyRow {
  id: string;
  name: string;
  cnpj: string;
  status: CorporateAccount['status'];
  planId: CorporateAccount['planId'];
  planName: string;
  seats: number;
  active: number;
  invited: number;
  priceCents: number;
  start: string;
}

const STATUS_ORDER: readonly CorporateAccount['status'][] = [
  'active',
  'negotiation',
  'prospect',
  'suspended',
  'ended',
];

/**
 * SCR-M09-03 Empresas (canal corporativo): contratos com estado, vagas contratadas e ativas. A empresa
 * paga o plano; o colaborador ativo conta como assinante (RN-CORP-07). O preço por vaga é rotulado
 * "não faz parte da projeção do plano" (RN-CORP-05). O atendimento só consulta.
 */
@Component({
  selector: 'app-companies-list-page',
  imports: [
    RouterLink,
    ActiveFiltersComponent,
    BadgeComponent,
    CellDirective,
    CompanyFormDrawerComponent,
    DataTableComponent,
    EmptyStateComponent,
    FilterChipsComponent,
    IconComponent,
    KpiComponent,
    KpiStripComponent,
    PageHeaderComponent,
    PlanBadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Empresas" [count]="countText()" [description]="activeText()">
        @if (service.canWrite()) {
          <button type="button" class="btn btn--primary" data-role="new-company" (click)="drawerOpen.set(true)">
            <svg appIcon="plus"></svg>Nova empresa
          </button>
        }
      </app-page-header>

      @if (!service.canWrite()) {
        <p class="t-muted t-ui mb-4" data-role="read-only-note">
          Você pode consultar as empresas. Quem cadastra e altera é a gestão.
        </p>
      }

      @if (rows().length === 0) {
        <div class="card">
          <app-empty-state
            title="Nenhuma empresa cadastrada"
            text="Os contratos do canal corporativo aparecem aqui, da prospecção até o contrato ativo."
          >
            @if (service.canWrite()) {
              <button type="button" class="btn btn--primary" (click)="drawerOpen.set(true)">Cadastrar empresa</button>
            }
          </app-empty-state>
        </div>
      } @else {
        <div class="stack stack--6">
          <app-kpi-strip aria-label="Resumo do canal corporativo">
            <app-kpi label="Contratos ativos" [value]="summary().contracts" />
            <app-kpi label="Vagas contratadas" [value]="summary().seats" context="Em contratos ativos" />
            <app-kpi label="Colaboradores ativos" [value]="summary().active" context="Contam como assinantes" />
            <app-kpi label="Em negociação" [value]="summary().negotiation" />
          </app-kpi-strip>

          <div class="cluster">
            <app-filter-chips label="Estado" [options]="statusOptions()" [value]="status()" (valueChange)="list.setFilter('estado', $event)" />
          </div>
          <app-active-filters [filters]="activeFilters()" (removed)="list.setFilter($event, null)" (cleared)="list.clear()" />

          <app-data-table
            caption="Empresas do canal corporativo"
            noun="empresas"
            [rows]="filteredRows()"
            [columns]="columns"
            [state]="state()"
            searchable
            searchLabel="Buscar empresa"
            searchPlaceholder="Nome da empresa"
            rowClickable
            [filtersActive]="list.hasActive()"
            emptyTitle="Nenhuma empresa neste filtro"
            [search]="list.search()"
            (searchChange)="list.search.set($event)"
            [sort]="list.sort()"
            (sortChange)="list.setSort($event)"
            [page]="list.page()"
            (pageChange)="list.setPage($event)"
            (rowClick)="open($event.id)"
            (filtersCleared)="list.clear()"
            (retry)="state.set('ready')"
          >
            <ng-template appCell="name" let-row>
              <a class="row-link" [routerLink]="['/app/empresas', row.id]">{{ row.name }}</a>
            </ng-template>
            <ng-template appCell="status" let-row>
              <app-badge [variant]="look(row.status).variant" [icon]="look(row.status).icon">{{ statusLabel(row.status) }}</app-badge>
            </ng-template>
            <ng-template appCell="plan" let-row><app-plan-badge [plan]="row.planId" /></ng-template>
            <ng-template appCell="seats" let-row>
              <span class="t-num">{{ row.active }} de {{ row.seats }}</span>
              @if (row.invited > 0) {
                <span class="t-caption"> · {{ plural(row.invited, 'convite', 'convites') }}</span>
              }
            </ng-template>
            <ng-template appCell="price" let-row>{{ money(row.priceCents) }}</ng-template>
            <ng-template appCell="actions" let-row>
              <a class="btn btn--sm" [routerLink]="['/app/empresas', row.id]">Abrir ficha</a>
            </ng-template>
          </app-data-table>
          <p class="t-caption">O preço por vaga não faz parte da projeção do plano. É um valor de negociação.</p>
        </div>
      }

      @if (service.canWrite()) {
        <app-company-form-drawer [(open)]="drawerOpen" (saved)="open($event)" />
      }
    </div>
  `,
})
export class CompaniesListPageComponent {
  protected readonly service = inject(CompaniesService);
  private readonly router = inject(Router);

  protected readonly list = createListState({
    key: 'companies',
    filterKeys: ['estado'],
    defaultSort: { key: 'status', direction: 'asc' },
  });
  protected readonly drawerOpen = signal(false);
  protected readonly state = signal<TableState>('ready');

  protected readonly rows = computed<CompanyRow[]>(() => {
    // `accounts` e as vagas mudam juntos: leia as duas coleções para a lista reagir.
    return this.service.accounts().map((a) => {
      const counts = this.service.countsOf(a.id);
      return {
        id: a.id,
        name: a.companyName,
        cnpj: a.cnpj,
        status: a.status,
        planId: a.planId,
        planName: PLAN_NAMES[a.planId],
        seats: a.seats,
        active: counts.active,
        invited: counts.invited,
        priceCents: a.seatPriceCents,
        start: a.startDate ? formatDate(a.startDate) : 'Não iniciado',
      };
    });
  });

  protected readonly status = computed(() => this.list.filters()['estado'] ?? null);
  protected readonly filteredRows = computed(() =>
    this.rows().filter((r) => this.status() === null || r.status === this.status()),
  );

  protected readonly summary = computed(() => {
    const rows = this.rows();
    const active = rows.filter((r) => r.status === 'active');
    return {
      contracts: active.length,
      seats: active.reduce((s, r) => s + r.seats, 0),
      active: rows.reduce((s, r) => s + (r.status === 'ended' ? 0 : r.active), 0),
      negotiation: rows.filter((r) => r.status === 'negotiation').length,
    };
  });
  protected readonly countText = computed(() => plural(this.rows().length, 'empresa', 'empresas'));
  protected readonly activeText = computed(
    () => `${plural(this.summary().contracts, 'contrato ativo', 'contratos ativos')}`,
  );

  protected readonly statusOptions = computed<FilterOption[]>(() =>
    CORPORATE_FUNNEL.map((status) => ({
      value: status,
      label: CORPORATE_STATUS_LABEL[status],
      count: this.rows().filter((r) => r.status === status).length,
    })),
  );
  protected readonly activeFilters = computed<ActiveFilter[]>(() => {
    const status = this.status();
    return status && status in CORPORATE_STATUS_LABEL
      ? [
          {
            key: 'estado',
            label: `Estado: ${CORPORATE_STATUS_LABEL[status as CorporateAccount['status']]}`,
          },
        ]
      : [];
  });

  protected readonly columns: readonly TableColumn<CompanyRow>[] = [
    { key: 'name', header: 'Empresa', primary: true, sortable: true },
    {
      key: 'status',
      header: 'Estado',
      sortable: true,
      sortValue: (r) => STATUS_ORDER.indexOf(r.status),
      value: (r) => CORPORATE_STATUS_LABEL[r.status],
    },
    { key: 'plan', header: 'Plano por vaga', value: (r) => r.planName },
    { key: 'seats', header: 'Vagas ativas', align: 'end', sortable: true, value: (r) => r.active, noSearch: true },
    { key: 'price', header: 'Preço por vaga', align: 'end', value: (r) => r.priceCents, noSearch: true },
    { key: 'start', header: 'Início do contrato', muted: true, noSearch: true },
    { key: 'actions', header: 'Ações', actions: true, noSearch: true },
  ];

  protected look(status: CorporateAccount['status']) {
    return CORPORATE_STATUS_LOOK[status];
  }

  protected statusLabel(status: CorporateAccount['status']): string {
    return CORPORATE_STATUS_LABEL[status];
  }

  protected money(cents: number): string {
    return formatMoney(cents);
  }

  protected plural(n: number, singular: string, pluralForm: string): string {
    return plural(n, singular, pluralForm);
  }

  protected open(id: string): void {
    void this.router.navigate(['/app/empresas', id]);
  }
}
