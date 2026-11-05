import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/auth';
import {
  PLAN_SHORT_NAMES,
  SUBSCRIPTION_DISPLAY_LABELS,
  SubscriptionDisplay,
  SubscriptionService,
  scheduledChangeOf,
  subscriptionDisplay,
} from '@core/commerce/subscription.service';
import { Database } from '@core/data';
import { AuditLogService } from '@core/audit';
import { buildCsv, downloadTextFile } from '@core/export/file-download';
import { formatDate, formatMoney } from '@core/format';
import type { ID, ISODate, PlanId, Subscription } from '@core/models';
import { caregiverLabel } from '@core/privacy/caregiver-label';
import { PLAN_ORDER, countSubscribers } from '@core/rules';
import {
  ActiveFilter,
  ActiveFiltersComponent,
  BadgeComponent,
  CellDirective,
  DataTableComponent,
  FilterChipsComponent,
  FilterOption,
  KpiComponent,
  KpiStripComponent,
  MOBILE_QUERY,
  PageHeaderComponent,
  PlanBadgeComponent,
  TableColumn,
  createListState,
  filterRows,
  mediaQuery,
} from '@shared/ui';
import { ToastService } from '@shared/ui/overlay';

interface SubscriptionRow {
  id: ID;
  caregiverId: ID;
  /** Nome (equipe) ou código (gestão). */
  label: string;
  code: string;
  pseudonymized: boolean;
  planId: PlanId;
  display: SubscriptionDisplay;
  scheduledLabel: string | null;
  payer: string;
  corporate: boolean;
  startedAt: ISODate;
  nextCycleAt: ISODate | null;
  priceCents: number;
}

const DISPLAY_IDS: readonly SubscriptionDisplay[] = ['active', 'change_scheduled', 'cancel_scheduled', 'cancelled'];

/**
 * SCR-M04-02 Assinaturas (PD-01): plano, situação, pagador, início e próximo ciclo, com totais por plano
 * e filtros na URL. O que está agendado aparece em palavras ("Mudança agendada", "Cancelamento agendado",
 * A-18). A gestão vê o cuidador só pelo código. Ordem padrão: próximo ciclo mais próximo primeiro.
 */
@Component({
  selector: 'app-subscriptions-list-page',
  imports: [
    ActiveFiltersComponent,
    BadgeComponent,
    CellDirective,
    DataTableComponent,
    FilterChipsComponent,
    KpiComponent,
    KpiStripComponent,
    NgTemplateOutlet,
    PageHeaderComponent,
    PlanBadgeComponent,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      <app-page-header title="Assinaturas" [count]="countText()" description="Quem assina o quê, quem paga e quando é o próximo ciclo.">
        <a class="btn" routerLink="/app/assinaturas/planos">Ver os planos</a>
        <a class="btn" routerLink="/app/assinaturas/cartoes">Ver os cartões</a>
      </app-page-header>

      <app-kpi-strip aria-label="Totais por plano">
        <app-kpi label="Assinantes pagos" [value]="totals().total.toString()" context="Essencial, Cuida e Sustenta" />
        <app-kpi label="Essencial" [value]="totals().byPlan.essencial.toString()" context="assinantes" />
        <app-kpi label="Cuida" [value]="totals().byPlan.cuida.toString()" [context]="corporateContext()" />
        <app-kpi label="Sustenta" [value]="totals().byPlan.sustenta.toString()" context="assinantes" />
        <app-kpi label="Livre" [value]="freeCount().toString()" context="cuidadores sem cobrança" />
      </app-kpi-strip>

      <ng-template #filterGroups>
        <div class="cluster cluster--4" role="group" aria-label="Filtros da lista">
        <div class="stack stack--2"><span class="t-ui t-strong">Plano</span><app-filter-chips label="Plano" [options]="planOptions()" [value]="plan()" (valueChange)="list.setFilter('plano', $event)" [allCount]="all().length" /></div>
        <div class="stack stack--2"><span class="t-ui t-strong">Situação</span><app-filter-chips label="Situação" [options]="statusOptions()" [value]="status()" (valueChange)="list.setFilter('status', $event)" allLabel="Todas" /></div>
        <div class="stack stack--2"><span class="t-ui t-strong">Quem paga</span><app-filter-chips label="Quem paga" [options]="payerOptions" [value]="payer()" (valueChange)="list.setFilter('pagador', $event)" allLabel="Todos" /></div>
        </div>
      </ng-template>
      @if (mobile()) {
        <details class="card card--pad" data-role="filters-sheet">
          <summary class="btn btn--sm">Filtros ({{ activeFilters().length }})</summary>
          <div class="mt-3"><ng-container *ngTemplateOutlet="filterGroups" /></div>
        </details>
      } @else {
        <ng-container *ngTemplateOutlet="filterGroups" />
      }
      <app-active-filters [filters]="activeFilters()" (removed)="list.setFilter($event, null)" (cleared)="clearFilters()" />

      <p class="t-caption">A exportação não inclui nome, CPF, telefone nem e-mail.</p>
      <app-data-table
        caption="Assinaturas"
        noun="assinaturas"
        [rows]="filtered()"
        [columns]="columns()"
        [rowLabel]="rowLabel"
        [filtersActive]="list.hasActive()"
        [sort]="list.sort()"
        (sortChange)="list.setSort($event)"
        [search]="list.search()"
        (searchChange)="list.search.set($event)"
        [page]="list.page()"
        (pageChange)="list.setPage($event)"
        searchable
        rowClickable
        [searchPlaceholder]="partner() ? 'Buscar por código, por exemplo CUI-0001' : 'Buscar por nome ou código'"
        emptyTitle="Nenhuma assinatura por aqui"
        emptyText="Quando houver assinaturas, elas aparecem aqui com o próximo ciclo."
        (rowClick)="open($event)"
        (filtersCleared)="clearFilters()"
      >
        <button appTableActions type="button" class="btn btn--sm" (click)="exportCsv()">Exportar CSV</button>
        <ng-template appCell="person" let-row>
          @if (row.pseudonymized) {
            <span class="code-chip">{{ row.code }}</span><span class="sr-only"> (código pseudonimizado)</span>
          } @else {
            <span class="col-primary discreet">{{ row.label }}</span> <span class="code-chip">{{ row.code }}</span>
          }
        </ng-template>
        <ng-template appCell="plan" let-row><app-plan-badge [plan]="row.planId" /></ng-template>
        <ng-template appCell="status" let-row>
          <app-badge [variant]="row.display === 'active' ? 'success' : row.display === 'cancelled' ? 'neutral' : 'attention'" [icon]="row.display === 'active' ? 'circle-check' : row.display === 'cancelled' ? 'ban' : 'clock'">
            {{ statusLabel(row.display) }}
          </app-badge>
          @if (row.scheduledLabel) { <span class="t-caption">{{ row.scheduledLabel }}</span> }
        </ng-template>
        <ng-template appCell="payer" let-row>
          @if (row.corporate) { <app-badge variant="info" icon="building-2">{{ row.payer }}</app-badge> } @else { {{ row.payer }} }
        </ng-template>
        <ng-template appCell="actions" let-row>
          <button type="button" class="btn btn--sm" [attr.aria-label]="'Abrir a assinatura de ' + row.code" (click)="open(row)">Abrir</button>
        </ng-template>
      </app-data-table>
    </div>
  `,
})
export class SubscriptionsListPage {
  private readonly db = inject(Database);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly service = inject(SubscriptionService);
  private readonly audit = inject(AuditLogService);
  private readonly toasts = inject(ToastService);
  private readonly doc = inject(DOCUMENT);

  protected readonly partner = computed(() => this.auth.role() === 'partner');
  protected readonly mobile = mediaQuery(MOBILE_QUERY);
  protected readonly list = createListState({
    key: 'subscriptions',
    filterKeys: ['plano', 'status', 'pagador', 'filtro'],
    defaultSort: { key: 'cycle', direction: 'asc' },
  });
  protected readonly rowLabel = (row: SubscriptionRow): string => row.code;
  protected readonly payerOptions: FilterOption[] = [
    { value: 'proprio', label: 'O próprio cuidador' },
    { value: 'empresa', label: 'Empresa' },
  ];

  constructor() {
    // O que venceu pelo relógio (inclusive o simulado) passa a valer ao abrir a lista.
    this.service.applyDueChanges();
  }

  protected readonly all = computed<SubscriptionRow[]>(() => {
    const role = this.auth.role();
    const caregivers = new Map(this.db.caregivers.all().map((c) => [c.id, c] as const));
    const prices = new Map(this.db.plans.all().map((p) => [p.id, p.monthlyPriceCents] as const));
    const companies = new Map(this.db.corporateAccounts.all().map((c) => [c.id, c.companyName] as const));
    const latest = new Map<ID, Subscription>();
    this.db.subscriptions.all().forEach((s) => {
      const known = latest.get(s.caregiverId);
      if (!known || (known.status === 'cancelled' && s.status !== 'cancelled') || ((known.status === 'cancelled') === (s.status === 'cancelled') && s.createdAt > known.createdAt)) {
        latest.set(s.caregiverId, s);
      }
    });
    return [...latest.values()].flatMap((s): SubscriptionRow[] => {
      const cg = caregivers.get(s.caregiverId);
      if (!cg) {
        return [];
      }
      const label = caregiverLabel(role, cg);
      const scheduled = scheduledChangeOf(s);
      return [
        {
          id: s.id,
          caregiverId: cg.id,
          label: label.text,
          code: cg.code,
          pseudonymized: label.pseudonymized,
          planId: s.planId,
          display: subscriptionDisplay(s),
          scheduledLabel: scheduled?.label ?? null,
          payer: s.payer === 'corporate' ? `Empresa: ${s.corporateAccountId ? (companies.get(s.corporateAccountId) ?? 'empresa') : 'empresa'}` : 'O próprio cuidador',
          corporate: s.payer === 'corporate',
          startedAt: s.startedAt,
          nextCycleAt: s.nextCycleAt ?? null,
          priceCents: prices.get(s.planId) ?? 0,
        },
      ];
    });
  });

  protected readonly plan = computed(() => this.list.filters()['plano'] ?? null);
  protected readonly status = computed(() => this.list.filters()['status'] ?? null);
  protected readonly payer = computed(() => this.list.filters()['pagador'] ?? null);

  protected readonly filtered = computed(() => {
    const f = this.list.filters();
    return this.all().filter(
      (r) =>
        (!f['plano'] || r.planId === f['plano']) &&
        (!f['status'] || r.display === f['status']) &&
        (!f['pagador'] || (f['pagador'] === 'empresa') === r.corporate) &&
        (f['filtro'] !== 'cancelamento-agendado' || r.display === 'cancel_scheduled' || r.display === 'change_scheduled'),
    );
  });
  protected readonly countText = computed(() => {
    const n = this.filtered().length;
    return `${n} ${n === 1 ? 'assinatura' : 'assinaturas'}`;
  });

  protected readonly totals = computed(() => countSubscribers(this.db.subscriptions.all()));
  protected readonly freeCount = computed(() => this.all().filter((r) => r.planId === 'livre' && r.display !== 'cancelled').length);
  protected readonly corporateContext = computed(() => {
    const n = this.db.subscriptions.count((s) => s.planId === 'cuida' && s.payer === 'corporate' && s.status !== 'cancelled');
    return n > 0 ? `assinantes, ${n} ${n === 1 ? 'paga pela empresa' : 'pagas pela empresa'}` : 'assinantes';
  });

  protected readonly planOptions = computed<FilterOption[]>(() =>
    PLAN_ORDER.map((id) => ({ value: id, label: PLAN_SHORT_NAMES[id], count: this.all().filter((r) => r.planId === id).length })),
  );
  protected readonly statusOptions = computed<FilterOption[]>(() =>
    DISPLAY_IDS.map((id) => ({ value: id, label: SUBSCRIPTION_DISPLAY_LABELS[id], count: this.all().filter((r) => r.display === id).length })),
  );
  protected readonly activeFilters = computed<ActiveFilter[]>(() => {
    const out: ActiveFilter[] = [];
    const f = this.list.filters();
    if (f['plano']) {
      out.push({ key: 'plano', label: `Plano: ${PLAN_SHORT_NAMES[f['plano'] as PlanId] ?? f['plano']}` });
    }
    if (f['status']) {
      out.push({ key: 'status', label: `Situação: ${SUBSCRIPTION_DISPLAY_LABELS[f['status'] as SubscriptionDisplay] ?? f['status']}` });
    }
    if (f['pagador']) {
      out.push({ key: 'pagador', label: `Quem paga: ${f['pagador'] === 'empresa' ? 'empresa' : 'o próprio cuidador'}` });
    }
    if (f['filtro'] === 'cancelamento-agendado') {
      out.push({ key: 'filtro', label: 'Com mudança ou cancelamento agendado' });
    }
    return out;
  });

  protected readonly columns = computed<TableColumn<SubscriptionRow>[]>(() => [
    { key: 'person', header: this.partner() ? 'Código' : 'Cuidador', primary: true, sortable: true, sortValue: (r) => (this.partner() ? r.code : r.label), searchText: (r) => `${r.pseudonymized ? '' : r.label} ${r.code}` },
    { key: 'plan', header: 'Plano', sortable: true, sortValue: (r) => PLAN_ORDER.indexOf(r.planId), noSearch: true },
    { key: 'status', header: 'Situação', sortable: true, sortValue: (r) => DISPLAY_IDS.indexOf(r.display), noSearch: true },
    { key: 'payer', header: 'Quem paga', sortable: true, noSearch: true },
    { key: 'started', header: 'Início', sortable: true, noSearch: true, value: (r) => formatDate(r.startedAt), sortValue: (r) => r.startedAt },
    { key: 'cycle', header: 'Próximo ciclo', sortable: true, noSearch: true, value: (r) => (r.nextCycleAt ? formatDate(r.nextCycleAt) : 'Sem cobrança'), sortValue: (r) => r.nextCycleAt },
    { key: 'price', header: 'Mensalidade', align: 'end', sortable: true, noSearch: true, value: (r) => formatMoney(r.priceCents), sortValue: (r) => r.priceCents },
    { key: 'actions', header: 'Ações', actions: true },
  ]);

  protected statusLabel(display: SubscriptionDisplay): string {
    return SUBSCRIPTION_DISPLAY_LABELS[display];
  }

  protected clearFilters(): void {
    this.list.clear();
  }

  protected open(row: SubscriptionRow): void {
    void this.router.navigate(['/app/assinaturas', row.id]);
  }

  protected exportCsv(): void {
    const term = this.list.search();
    const rows = term ? filterRows(this.filtered(), this.columns(), term) : this.filtered();
    this.audit.exported('caregiver_list_csv', undefined, 'assinaturas, sem dados sensíveis');
    const csv = buildCsv(
      ['codigo', 'plano', 'situacao', 'pagador', 'inicio', 'proximo_ciclo'],
      rows.map((r) => [r.code, PLAN_SHORT_NAMES[r.planId], SUBSCRIPTION_DISPLAY_LABELS[r.display], r.corporate ? 'empresa' : 'proprio', r.startedAt, r.nextCycleAt ?? '']),
    );
    const ok = downloadTextFile(this.doc, 'assinaturas.csv', csv, 'text/csv;charset=utf-8');
    this.toasts.show({ message: ok ? `Lista exportada: ${rows.length} assinaturas, sem nome, CPF, telefone nem e-mail.` : 'Não foi possível baixar o arquivo neste navegador.', tone: ok ? 'success' : 'danger' });
  }
}

