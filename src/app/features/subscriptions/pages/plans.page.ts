import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService, canSeeFinancialValues } from '@core/auth';
import { Database } from '@core/data';
import { formatMoney } from '@core/format';
import type { BenefitKey, PlanId } from '@core/models';
import {
  BENEFIT_LABELS,
  PLAN_NOT_INCLUDED_NOTICE,
  PLAN_ORDER,
  averageGrossPerSubscriberCents,
  averageNetPerSubscriberCents,
  countSubscribers,
  netRevenueCents,
  planBenefits,
} from '@core/rules';
import {
  CardComponent,
  CellDirective,
  DataTableComponent,
  IconComponent,
  KpiComponent,
  KpiStripComponent,
  PageHeaderComponent,
  TableColumn,
} from '@shared/ui';
import { BannerComponent } from '@shared/ui/overlay';
import { PLAN_SHORT_NAMES } from '@core/commerce/subscription.service';

type Cell = { kind: 'included' } | { kind: 'excluded' } | { kind: 'text'; text: string };

interface ComparisonRow {
  id: string;
  label: string;
  cells: Record<PlanId, Cell>;
}

const PLAN_CLASS: Record<PlanId, string> = {
  livre: 'plan-card',
  essencial: 'plan-card plan-card--essencial',
  cuida: 'plan-card plan-card--cuida',
  sustenta: 'plan-card plan-card--sustenta',
};

/**
 * SCR-M04-01 Planos: o comparativo da Figura 1 (A.1) com os 4 planos, preços, benefícios progressivos e
 * o aviso de que a mensalidade não inclui serviços da rede nem atendimento psicológico (RN-PLN-22).
 * Só quatro planos existem: Livre, Essencial, Cuida e Sustenta. O valor médio e o líquido (realizado e de
 * referência do plano) aparecem só para quem pode ver valores financeiros.
 */
@Component({
  selector: 'app-plans-page',
  imports: [
    BannerComponent,
    CardComponent,
    CellDirective,
    DataTableComponent,
    IconComponent,
    KpiComponent,
    KpiStripComponent,
    PageHeaderComponent,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      <app-page-header title="Planos" description="Quatro planos, com benefícios que crescem de um para o outro.">
        <a class="btn" routerLink="/app/assinaturas">Ver as assinaturas</a>
      </app-page-header>

      <app-banner variant="info" heading="O que a mensalidade não inclui">{{ notice }}</app-banner>

      <section class="grid grid--4 grid--gap-6" aria-label="Os quatro planos">
        @for (plan of plans(); track plan.id) {
          <article [class]="plan.css" [attr.data-plan]="plan.id">
            <h2 class="plan-card__head">{{ plan.shortName }}</h2>
            <p class="plan-card__price">{{ plan.price }}<small>{{ plan.id === 'livre' ? 'gratuito' : 'por mês' }}</small></p>
            <ul class="plan-card__list list-reset">
              @if (plan.inherits) {
                <li><svg appIcon="circle-check" size="sm"></svg><strong>Tudo do {{ plan.inherits }}, mais:</strong></li>
              }
              @for (benefit of plan.benefits; track benefit) {
                <li><svg appIcon="check" size="sm"></svg><span>{{ benefit }}</span></li>
              }
              <li class="t-caption">Desconto na sessão com psicólogo da Nexus: {{ plan.discount }}%</li>
            </ul>
            <p class="t-caption card__body">{{ plan.subscribers }}</p>
          </article>
        }
      </section>

      <section class="stack stack--3" aria-labelledby="nx-compare-title">
        <h2 id="nx-compare-title">Comparativo dos planos</h2>
        <app-data-table
          caption="Comparativo dos planos Livre, Essencial, Cuida e Sustenta"
          noun="benefícios"
          [rows]="rows()"
          [columns]="columns"
          [stack]="false"
          [rowKey]="rowKey"
        >
          @for (plan of planIds; track plan) {
            <ng-template [appCell]="plan" let-row>
              @switch (row.cells[plan].kind) {
                @case ('included') { <span class="cluster"><svg appIcon="circle-check" size="sm"></svg>Inclui</span> }
                @case ('excluded') { <span class="cluster t-muted"><svg appIcon="minus" size="sm"></svg>Não inclui</span> }
                @default { <span class="t-num">{{ row.cells[plan].text }}</span> }
              }
            </ng-template>
          }
        </app-data-table>
      </section>

      @if (finance(); as f) {
        <app-card title="Valor médio e líquido por assinante" subtitle="Realizado no sistema e referência do plano de negócios">
          <app-kpi-strip aria-label="Valor médio e líquido">
            <app-kpi label="Valor médio realizado" [value]="money(f.grossReal)" [context]="'Referência do plano: ' + money(f.grossRef)" />
            <app-kpi label="Líquido médio realizado" [value]="money(f.netReal)" [context]="'Referência do plano: ' + money(f.netRef) + ', após as taxas'" />
            <app-kpi label="Assinantes pagos" [value]="f.count.toString()" context="dado do sistema" />
          </app-kpi-strip>
        </app-card>
      }
    </div>
  `,
})
export class PlansPage {
  private readonly db = inject(Database);
  private readonly auth = inject(AuthService);

  protected readonly notice = PLAN_NOT_INCLUDED_NOTICE;
  protected readonly planIds = PLAN_ORDER;
  protected readonly rowKey = (row: ComparisonRow): string => row.id;

  protected readonly columns: TableColumn<ComparisonRow>[] = [
    { key: 'label', header: 'Benefício', primary: true },
    ...PLAN_ORDER.map((id): TableColumn<ComparisonRow> => ({ key: id, header: PLAN_SHORT_NAMES[id], noSearch: true })),
  ];

  private readonly counts = computed(() => countSubscribers(this.db.subscriptions.all()));

  protected readonly plans = computed(() => {
    const counts = this.counts();
    return PLAN_ORDER.map((id, index) => {
      const own = this.db.plans.get(id);
      const previous = index > 0 ? new Set(planBenefits(PLAN_ORDER[index - 1] as PlanId)) : new Set<BenefitKey>();
      const free = this.db.subscriptions.count((s) => s.planId === 'livre' && s.status !== 'cancelled');
      return {
        id,
        css: PLAN_CLASS[id],
        shortName: PLAN_SHORT_NAMES[id],
        price: formatMoney(own?.monthlyPriceCents ?? 0),
        discount: own?.psychSessionDiscountPercent ?? 0,
        inherits: index > 0 ? PLAN_SHORT_NAMES[PLAN_ORDER[index - 1] as PlanId] : null,
        benefits: [...planBenefits(id)].filter((b) => !previous.has(b)).map((b) => BENEFIT_LABELS[b]),
        subscribers: id === 'livre' ? `${free} cuidadores no plano` : `${counts.byPlan[id as 'essencial' | 'cuida' | 'sustenta']} assinantes`,
      };
    });
  });

  protected readonly rows = computed<ComparisonRow[]>(() => {
    const byPlan = (fn: (id: PlanId) => Cell): Record<PlanId, Cell> =>
      Object.fromEntries(PLAN_ORDER.map((id) => [id, fn(id)])) as Record<PlanId, Cell>;
    const all = [...new Set(planBenefits('sustenta'))];
    return [
      { id: 'price', label: 'Preço por mês', cells: byPlan((id) => ({ kind: 'text', text: id === 'livre' ? 'R$ 0,00' : formatMoney(this.db.plans.get(id)?.monthlyPriceCents ?? 0) })) },
      { id: 'discount', label: 'Desconto na sessão com psicólogo da Nexus', cells: byPlan((id) => ({ kind: 'text', text: `${this.db.plans.get(id)?.psychSessionDiscountPercent ?? 0}%` })) },
      ...all.map((b): ComparisonRow => ({
        id: b,
        label: BENEFIT_LABELS[b],
        cells: byPlan((id) => (planBenefits(id).includes(b) ? { kind: 'included' } : { kind: 'excluded' })),
      })),
    ];
  });

  protected readonly finance = computed(() => {
    if (!canSeeFinancialValues(this.auth.role() ?? 'support')) {
      return null;
    }
    const paid = this.db.subscriptions.query((s) => s.planId !== 'livre' && (s.status === 'active' || s.status === 'cancel_scheduled'));
    const prices = this.db.plans.all();
    const sum = paid.reduce((acc, s) => acc + (prices.find((p) => p.id === s.planId)?.monthlyPriceCents ?? 0), 0);
    const grossReal = paid.length > 0 ? Math.round(sum / paid.length) : 0;
    const fees = this.db.financialParams.get().feesRate;
    return {
      count: paid.length,
      grossReal,
      netReal: netRevenueCents(grossReal, fees),
      grossRef: averageGrossPerSubscriberCents(),
      netRef: averageNetPerSubscriberCents(),
    };
  });

  protected money(cents: number): string {
    return formatMoney(cents);
  }
}
