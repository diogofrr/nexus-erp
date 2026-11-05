import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { formatMoney, formatPercent } from '@core/format';
import type { Partner, PartnerStatus } from '@core/models';
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
  KanbanBoardComponent,
  KanbanCardDirective,
  KanbanColumn,
  KpiComponent,
  KpiStripComponent,
  PageHeaderComponent,
  SegmentOption,
  SegmentedComponent,
  TableColumn,
  TableState,
  createListState,
} from '@shared/ui';
import {
  PARTNER_CATEGORIES,
  PARTNER_CATEGORY_LABEL,
  PARTNER_FUNNEL,
  PARTNER_STATUS_LABEL,
  PARTNER_STATUS_LOOK,
  REMUNERATION_LABEL,
  plural,
} from '../state/partner-labels';
import { checkPartnerActivation } from '../state/partner-rules';
import { PartnersService } from '../state/partners.service';
import { PartnerFormDrawerComponent } from '../components/partner-form.drawer';

interface PartnerRow {
  id: string;
  name: string;
  category: string;
  categoryKey: string;
  city: string;
  status: PartnerStatus;
  discount: number;
  model: string;
  /** "2 de 2", "0 de 2" ou "não precisa". */
  validation: string;
  validationDone: boolean;
  /** O que falta, em uma frase, para o cartão do funil. */
  note: string;
}

const STATUS_ORDER: readonly PartnerStatus[] = [
  'active',
  'legal_ethics_review',
  'prospect',
  'suspended',
  'ended',
];

type View = 'lista' | 'funil';

/**
 * SCR-M09-01 Parceiros do Cartão (PD-01 e PD-06): lista com filtros na URL e o funil de prospecção até
 * "Ativo" em quadro somente leitura. O painel conta os parceiros ativos (RN-CRT-09). A gestão cadastra;
 * o atendimento só consulta.
 */
@Component({
  selector: 'app-partners-list-page',
  imports: [
    RouterLink,
    ActiveFiltersComponent,
    BadgeComponent,
    CellDirective,
    DataTableComponent,
    EmptyStateComponent,
    FilterChipsComponent,
    IconComponent,
    KanbanBoardComponent,
    KanbanCardDirective,
    KpiComponent,
    KpiStripComponent,
    PageHeaderComponent,
    PartnerFormDrawerComponent,
    SegmentedComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header
        title="Parceiros do Cartão"
        [count]="activeText()"
        [description]="totalText()"
      >
        @if (service.canWrite()) {
          <button type="button" class="btn btn--primary" data-role="new-partner" (click)="drawerOpen.set(true)">
            <svg appIcon="plus"></svg>Novo parceiro
          </button>
        }
      </app-page-header>

      @if (!service.canWrite()) {
        <p class="t-muted t-ui mb-4" data-role="read-only-note">
          Você pode consultar os parceiros. Quem cadastra e altera é a gestão.
        </p>
      }

      @if (rows().length === 0) {
        <div class="card">
          <app-empty-state
            title="Nenhum parceiro cadastrado"
            text="Quando houver parceiros do Cartão Nexus, eles aparecem aqui, do primeiro contato até a parceria ativa."
          >
            @if (service.canWrite()) {
              <button type="button" class="btn btn--primary" (click)="drawerOpen.set(true)">Cadastrar parceiro</button>
            }
          </app-empty-state>
        </div>
      } @else {
        <div class="stack stack--6">
          <app-kpi-strip aria-label="Funil de parceiros">
            @for (item of funnel(); track item.status) {
              <app-kpi [label]="item.label" [value]="item.count" [context]="item.context" />
            }
          </app-kpi-strip>

          @if (usage().uses > 0) {
            <section class="card card--pad stack stack--2" aria-labelledby="pl-usage" data-role="usage-summary">
              <h2 class="card__title" id="pl-usage">Uso do Cartão Nexus em todos os parceiros</h2>
              <p>
                {{ plural(usage().uses, 'uso', 'usos') }} do cartão, com {{ money(usage().discountCents) }} em descontos
                sobre {{ money(usage().amountCents) }} em compras.
              </p>
              <p class="t-caption">
                Quem mais usa, só pelo código:
                @for (item of usage().top; track item.code) {
                  <span class="code-chip">{{ item.code }}</span>
                  {{ plural(item.uses, 'uso', 'usos') }}{{ $last ? '.' : ', ' }}
                }
              </p>
            </section>
          }

          <div class="cluster cluster--between">
            <app-segmented label="Forma de ver" [options]="views" [value]="view()" (valueChange)="setView($event)" />
            <div class="cluster">
              <app-filter-chips label="Estado" [options]="statusOptions()" [value]="status()" (valueChange)="list.setFilter('estado', $event)" />
            </div>
          </div>
          <div class="cluster">
            <app-filter-chips label="Categoria" [options]="categoryOptions()" [value]="category()" (valueChange)="list.setFilter('categoria', $event)" allLabel="Todas as categorias" />
          </div>
          <app-active-filters [filters]="activeFilters()" (removed)="list.setFilter($event, null)" (cleared)="clearFilters()" />

          @if (view() === 'funil') {
            <section aria-labelledby="funnel-title" class="stack stack--3">
              <h2 id="funnel-title" class="t-ui">Funil de parceiros, somente leitura</h2>
              <app-kanban-board [columns]="columns()" emptyText="Nenhum parceiro aqui." (cardOpened)="open($event.item.id)">
                <ng-template appKanbanCard let-item>
                  <strong>{{ item.name }}</strong>
                  <span class="t-caption">{{ item.note }}</span>
                </ng-template>
              </app-kanban-board>
            </section>
          } @else {
            <app-data-table
              caption="Parceiros do Cartão Nexus"
              noun="parceiros"
              [rows]="filteredRows()"
              [columns]="tableColumns"
              [state]="state()"
              searchable
              searchLabel="Buscar parceiro"
              searchPlaceholder="Nome ou categoria"
              rowClickable
              [filtersActive]="list.hasActive()"
              emptyTitle="Nenhum parceiro neste filtro"
              [search]="list.search()"
              (searchChange)="list.search.set($event)"
              [sort]="list.sort()"
              (sortChange)="list.setSort($event)"
              [page]="list.page()"
              (pageChange)="list.setPage($event)"
              (rowClick)="open($event.id)"
              (filtersCleared)="clearFilters()"
              (retry)="state.set('ready')"
            >
              <ng-template appCell="name" let-row>
                <a class="row-link" [routerLink]="['/app/parceiros', row.id]">{{ row.name }}</a>
              </ng-template>
              <ng-template appCell="status" let-row>
                <app-badge [variant]="look(row.status).variant" [icon]="look(row.status).icon">{{ statusLabel(row.status) }}</app-badge>
              </ng-template>
              <ng-template appCell="discount" let-row>{{ percent(row.discount) }}</ng-template>
              <ng-template appCell="validation" let-row>
                <app-badge [variant]="row.validationDone ? 'success' : 'attention'" [icon]="row.validationDone ? 'circle-check' : 'clock'">{{ row.validation }}</app-badge>
              </ng-template>
              <ng-template appCell="actions" let-row>
                <a class="btn btn--sm" [routerLink]="['/app/parceiros', row.id]">Abrir ficha</a>
              </ng-template>
            </app-data-table>
          }
        </div>
      }

      @if (service.canWrite()) {
        <app-partner-form-drawer [(open)]="drawerOpen" (saved)="open($event)" />
      }
    </div>
  `,
})
export class PartnersListPageComponent {
  protected readonly service = inject(PartnersService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly list = createListState({
    key: 'partners',
    filterKeys: ['estado', 'categoria'],
    defaultSort: { key: 'status', direction: 'asc' },
  });
  protected readonly drawerOpen = signal(false);
  protected readonly state = signal<TableState>('ready');

  private readonly query = toSignal(this.route.queryParamMap, { requireSync: false });
  protected readonly view = computed<View>(() =>
    this.query()?.get('visao') === 'funil' ? 'funil' : 'lista',
  );
  protected readonly views: readonly SegmentOption<View>[] = [
    { value: 'lista', label: 'Lista', icon: 'layout-list' },
    { value: 'funil', label: 'Funil', icon: 'square-kanban' },
  ];

  protected readonly rows = computed<PartnerRow[]>(() =>
    this.service.partners().map((p) => this.toRow(p)),
  );
  protected readonly status = computed(() => this.list.filters()['estado'] ?? null);
  protected readonly category = computed(() => this.list.filters()['categoria'] ?? null);

  protected readonly filteredRows = computed(() =>
    this.rows().filter(
      (r) =>
        (this.status() === null || r.status === this.status()) &&
        (this.category() === null || r.categoryKey === this.category()),
    ),
  );

  protected readonly activeText = computed(() =>
    plural(this.service.activeCount(), 'parceiro ativo', 'parceiros ativos'),
  );
  protected readonly totalText = computed(
    () => `${plural(this.rows().length, 'parceiro cadastrado', 'parceiros cadastrados')} no total`,
  );

  protected readonly usage = computed(() => {
    this.service.partners();
    return this.service.overallUsage();
  });

  protected readonly funnel = computed(() =>
    PARTNER_FUNNEL.map((status) => ({
      status,
      label: PARTNER_STATUS_LABEL[status],
      count: this.rows().filter((r) => r.status === status).length,
      context: status === 'active' ? 'Aceitam o Cartão Nexus' : 'No funil',
    })),
  );

  protected readonly statusOptions = computed<FilterOption[]>(() =>
    PARTNER_FUNNEL.map((status) => ({
      value: status,
      label: PARTNER_STATUS_LABEL[status],
      count: this.rows().filter((r) => r.status === status).length,
    })),
  );
  protected readonly categoryOptions = computed<FilterOption[]>(() =>
    PARTNER_CATEGORIES.map((key) => ({
      value: key,
      label: PARTNER_CATEGORY_LABEL[key],
      count: this.rows().filter((r) => r.categoryKey === key).length,
    })).filter((o) => (o.count ?? 0) > 0),
  );

  protected readonly activeFilters = computed<ActiveFilter[]>(() => {
    const out: ActiveFilter[] = [];
    const status = this.status();
    if (status && status in PARTNER_STATUS_LABEL) {
      out.push({ key: 'estado', label: `Estado: ${PARTNER_STATUS_LABEL[status as PartnerStatus]}` });
    }
    const category = this.category();
    if (category && category in PARTNER_CATEGORY_LABEL) {
      out.push({
        key: 'categoria',
        label: `Categoria: ${PARTNER_CATEGORY_LABEL[category as keyof typeof PARTNER_CATEGORY_LABEL]}`,
      });
    }
    return out;
  });

  protected readonly columns = computed<KanbanColumn<PartnerRow>[]>(() =>
    PARTNER_FUNNEL.map((status) => ({
      id: status,
      label: PARTNER_STATUS_LABEL[status],
      items: this.rows().filter(
        (r) => r.status === status && (this.category() === null || r.categoryKey === this.category()),
      ),
    })),
  );

  protected readonly tableColumns: readonly TableColumn<PartnerRow>[] = [
    { key: 'name', header: 'Parceiro', primary: true, sortable: true },
    { key: 'category', header: 'Categoria', sortable: true },
    {
      key: 'status',
      header: 'Estado',
      sortable: true,
      sortValue: (r) => STATUS_ORDER.indexOf(r.status),
      value: (r) => PARTNER_STATUS_LABEL[r.status],
    },
    { key: 'discount', header: 'Desconto', align: 'end', sortable: true, value: (r) => r.discount },
    { key: 'model', header: 'Remuneração', muted: true },
    { key: 'validation', header: 'Validação jurídica e ética', noSearch: true },
    { key: 'actions', header: 'Ações', actions: true, noSearch: true },
  ];

  protected look(status: PartnerStatus) {
    return PARTNER_STATUS_LOOK[status];
  }

  protected statusLabel(status: PartnerStatus): string {
    return PARTNER_STATUS_LABEL[status];
  }

  protected money(cents: number): string {
    return formatMoney(cents);
  }

  protected plural(n: number, singular: string, pluralForm: string): string {
    return plural(n, singular, pluralForm);
  }

  protected percent(value: number): string {
    return formatPercent(value, { decimals: 1 });
  }

  protected setView(view: View | undefined): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { visao: view === 'funil' ? 'funil' : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected clearFilters(): void {
    this.list.clear();
  }

  protected open(id: string): void {
    void this.router.navigate(['/app/parceiros', id]);
  }

  private toRow(p: Partner): PartnerRow {
    const check = checkPartnerActivation(p.remuneration);
    const needs = p.remuneration.model !== 'none';
    const done = [p.remuneration.legalValidatedAt, p.remuneration.ethicsValidatedAt].filter(Boolean).length;
    let note: string;
    switch (p.status) {
      case 'prospect':
        note = 'Primeiro contato. Defina a remuneração.';
        break;
      case 'legal_ethics_review':
        note = check.canActivate
          ? 'Pronto para ativar'
          : `Faltam ${plural(check.missing.length, 'validação', 'validações')}`;
        break;
      case 'active':
        note = `${formatPercent(p.discountPercent, { decimals: 1 })} de desconto`;
        break;
      case 'suspended':
        note = 'Parceria pausada';
        break;
      default:
        note = 'Parceria encerrada';
    }
    return {
      id: p.id,
      name: p.name,
      category: PARTNER_CATEGORY_LABEL[p.category],
      categoryKey: p.category,
      city: p.city,
      status: p.status,
      discount: p.discountPercent,
      model: REMUNERATION_LABEL[p.remuneration.model],
      validation: needs ? `${done} de 2` : 'Não precisa',
      validationDone: !needs || done === 2,
      note,
    };
  }
}
