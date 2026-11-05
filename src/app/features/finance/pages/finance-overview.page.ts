import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatMoney, formatNumber, formatPercent, formatYearMonth } from '@core/format';
import { PAID_PLAN_IDS } from '@core/rules/plans';
import {
  CONVERSION_REFERENCES,
  averageGrossFromParams,
  averageNetFromParams,
  breakEvenExact,
  monthlyCostsTotalCents,
} from '@core/rules/finance';
import {
  BannerComponent,
  ToastService,
} from '@shared/ui/overlay';
import { AreaChartComponent, DonutChartComponent } from '@shared/ui/charts';
import { ChartFrameComponent } from '@shared/ui/charts/chart-frame.component';
import {
  CardComponent,
  IconComponent,
  KpiComponent,
  KpiDelta,
  KpiStripComponent,
  MeterComponent,
  PageHeaderComponent,
  PLAN_NAMES,
} from '@shared/ui';
import { FinanceTabsComponent } from '../components/finance-tabs.component';
import { OriginTagComponent } from '../components/origin-tag.component';
import { FinanceStore } from '../state/finance.store';

/**
 * SCR-M10-01 Visão financeira (`/app/financeiro`, só `partner`). O realizado do mês (dado do sistema), o ponto
 * de equilíbrio com a conta aberta ("Como chegamos a 27", AC-M10-01), a conversão ao lado das referências de
 * 3%, 5% e 7% e um resumo da projeção do cenário-base (estimativa do plano). F14.
 */
@Component({
  selector: 'app-finance-overview-page',
  imports: [
    RouterLink,
    BannerComponent,
    AreaChartComponent,
    ChartFrameComponent,
    DonutChartComponent,
    CardComponent,
    IconComponent,
    KpiComponent,
    KpiStripComponent,
    MeterComponent,
    PageHeaderComponent,
    FinanceTabsComponent,
    OriginTagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .plain-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }
  `,
  template: `
    <div class="page stack stack--6">
      <app-page-header
        title="Financeiro"
        [description]="'Realizado de ' + monthText() + '. A projeção é uma estimativa do plano.'"
      >
        <button type="button" class="btn" data-role="export-csv" (click)="downloadCsv()">
          <svg appIcon="download" size="sm"></svg>Baixar tabela (CSV)
        </button>
      </app-page-header>

      <app-finance-tabs />

      @if (store.differsFromPlan()) {
        <app-banner variant="attention" heading="Parâmetros diferentes do plano" data-role="differs">
          Os números abaixo usam parâmetros que você editou.
          <a bannerActions class="btn btn--sm" routerLink="/app/financeiro/parametros"
            >Ver parâmetros</a
          >
        </app-banner>
      }

      <section class="stack stack--3" aria-labelledby="fin-real">
        <div class="cluster cluster--between">
          <h2 id="fin-real" class="t-strong">Realizado do mês</h2>
          <app-origin-tag kind="system" />
        </div>
        <app-kpi-strip>
          <app-kpi
            label="Assinantes"
            [value]="real().subscribers"
            [context]="'de ' + freeText() + ' usuários gratuitos'"
            link="/app/assinaturas"
          />
          <app-kpi
            label="Receita líquida"
            [value]="money(real().netRevenueCents)"
            [context]="'bruta ' + money(real().grossRevenueCents) + ', menos as taxas'"
          />
          <app-kpi
            label="Gastos do mês"
            [value]="money(real().costsCents)"
            context="gastos mensais fixos"
            link="/app/financeiro/custos"
          />
          <app-kpi
            label="Resultado do mês"
            [value]="money(real().resultCents)"
            [delta]="resultDelta()"
            link="/app/financeiro/projecao"
          />
        </app-kpi-strip>
      </section>

      <app-card title="Ponto de equilíbrio" subtitle="Quantos assinantes pagam os gastos mensais">
        <div class="stack stack--3" data-role="break-even">
          <app-meter
            label="Assinantes hoje"
            [value]="real().subscribers"
            [target]="real().breakEven"
            unit="assinantes"
          />
          @if (real().missing > 0) {
            <p data-role="missing" class="t-strong">
              Faltam {{ real().missing }}
              {{ real().missing === 1 ? 'assinante' : 'assinantes' }} para o ponto de equilíbrio.
              <span class="t-muted t-ui">{{ store.breakEvenProgress() }}% do caminho.</span>
            </p>
          } @else {
            <p data-role="missing" class="t-strong">
              <span class="badge badge--success"
                ><svg appIcon="circle-check"></svg>Acima do ponto de equilíbrio</span
              >
              A receita líquida cobre os gastos do mês.
            </p>
          }
          <details class="chart-alt" open data-role="how">
            <summary>Como chegamos a {{ real().breakEven }}</summary>
            <p class="t-ui" data-role="how-text">
              {{ money(costs()) }} ÷ {{ money(netAverage()) }} = {{ exactText() }}, arredondado para
              cima: <strong>{{ real().breakEven }} assinantes</strong>.
            </p>
            <p class="t-caption">
              Os gastos mensais são os do plano de negócios (coworking, aplicativo, contabilidade e
              deslocamentos), que você confere na tela de
              <a routerLink="/app/financeiro/custos">Custos</a>. A receita líquida média por assinante é a
              bruta média ({{ money(grossAverage()) }}) menos as taxas de pagamento ({{ feesText() }}).
              Cada assinante acima do equilíbrio gera lucro.
            </p>
          </details>
        </div>
      </app-card>

      <div class="grid grid--2">
        <app-card title="Assinantes por plano" subtitle="Planos pagos, dado do sistema">
          <app-donut-chart
            [segments]="planSegments()"
            [centerValue]="'' + real().subscribers"
            centerLabel="assinantes"
            [ariaLabel]="planAria()"
            caption="Assinantes por plano"
            categoryHeader="Plano"
            valueHeader="Assinantes"
          />
        </app-card>
        <app-card title="Conversão" subtitle="Assinantes sobre usuários gratuitos">
          <div class="stack stack--3" data-role="conversion">
            <p class="t-display" data-role="conversion-value">{{ conversionText() }}</p>
            <p class="t-ui t-muted">
              {{ real().subscribers }} de {{ freeText() }} usuários gratuitos.
            </p>
            <ul class="cluster plain-list" aria-label="Referências do plano">
              @for (ref of references(); track ref.label) {
                <li class="badge badge--outline">{{ ref.label }}</li>
              }
            </ul>
            <p class="t-caption">
              O plano trabalha com 3%, 5% e 7% de conversão. A de 5% é o cenário-base.
            </p>
          </div>
        </app-card>
      </div>

      <app-card title="Resultado mensal e saldo do investimento" subtitle="Cenário-base">
        <app-origin-tag appCardActions kind="estimate" />
        <div class="stack stack--3">
          <app-chart-frame>
            <app-area-chart
              [points]="balancePoints()"
              [bars]="resultPoints()"
              [valueFormat]="formatMoney"
              [referenceLine]="{ value: 0, label: 'Retorno do investimento (saldo zero)' }"
              [ariaLabel]="chartAria()"
              caption="Projeção do cenário-base, mês a mês (estimativa do plano)"
            />
          </app-chart-frame>
          <p class="t-ui" data-role="milestones">
            Primeiro lucro: {{ firstProfitText() }}. Retorno do investimento: {{ paybackText() }}.
          </p>
          <div class="cluster">
            <a class="btn btn--primary" routerLink="/app/financeiro/projecao">Ver os três cenários</a>
          </div>
        </div>
      </app-card>

      <app-card
        title="Fora da projeção do plano"
        subtitle="O plano projeta só mensalidades. Estes valores ficam à parte."
      >
        <ul class="stack stack--2 t-ui" data-role="outside">
          <li>
            <strong>Canal corporativo:</strong>
            {{ outside().corporateSeats }}
            {{ outside().corporateSeats === 1 ? 'vaga ativa' : 'vagas ativas' }} em
            {{ outside().corporateAccounts }}
            {{ outside().corporateAccounts === 1 ? 'empresa' : 'empresas' }}, cerca de
            {{ money(outside().corporateCents) }} por mês (valor por vaga é suposição do protótipo).
          </li>
          <li>
            <strong>Cartão Nexus:</strong> {{ money(outside().cardSavingsCents) }} de economia
            concedida às famílias no mês.
          </li>
          <li>
            <strong>Atendimento psicológico:</strong> {{ outside().doneHours }}
            {{ outside().doneHours === 1 ? 'hora realizada' : 'horas realizadas' }} no mês. A Nexus
            não cobra porcentagem sobre atendimentos.
          </li>
        </ul>
      </app-card>
    </div>
  `,
})
export class FinanceOverviewPageComponent {
  protected readonly store = inject(FinanceStore);
  private readonly toasts = inject(ToastService);
  protected readonly formatMoney = formatMoney;

  protected readonly real = this.store.realized;
  protected readonly outside = this.store.outsideProjection;
  protected readonly monthText = computed(() => formatYearMonth(this.store.monthLabel()));
  protected readonly freeText = computed(() => formatNumber(this.store.freeUsers()));
  protected readonly costs = computed(() => monthlyCostsTotalCents(this.store.params()));
  protected readonly netAverage = computed(() => averageNetFromParams(this.store.params()));
  protected readonly grossAverage = computed(() => averageGrossFromParams(this.store.params()));
  protected readonly feesText = computed(() => formatPercent(this.store.params().feesRate * 100));
  protected readonly exactText = computed(() => formatNumber(breakEvenExact(this.store.params()), 1));

  protected readonly resultDelta = computed<KpiDelta>(() =>
    this.real().aboveBreakEven
      ? { text: 'acima do equilíbrio', tone: 'good', direction: 'up' }
      : { text: 'abaixo do equilíbrio', tone: 'bad', direction: 'down' },
  );

  protected readonly conversionText = computed(() => {
    const value = this.store.conversionPercent();
    return value === null ? 'n/d' : formatPercent(value, { decimals: 1 });
  });
  protected readonly references = computed(() =>
    CONVERSION_REFERENCES.map((rate) => ({ label: `Referência ${rate}%` })),
  );

  protected readonly planSegments = computed(() =>
    PAID_PLAN_IDS.map((plan) => ({
      label: PLAN_NAMES[plan],
      value: this.real().subscribersByPlan[plan],
      color: `var(--plan-${plan})`,
    })),
  );
  protected readonly planAria = computed(
    () =>
      `Assinantes por plano: ${PAID_PLAN_IDS.map(
        (plan) => `${this.real().subscribersByPlan[plan]} ${PLAN_NAMES[plan]}`,
      ).join(', ')}`,
  );

  private readonly base = computed(() => this.store.scenarios().base);
  protected readonly balancePoints = computed(() =>
    this.base().rows.map((r) => ({ label: `M${r.month}`, value: r.balanceCents })),
  );
  protected readonly resultPoints = computed(() =>
    this.base().rows.map((r) => ({ label: `M${r.month}`, value: r.resultCents })),
  );
  protected readonly firstProfitText = computed(() =>
    this.base().firstProfitMonth === null ? 'não chega nos 24 meses' : `mês ${this.base().firstProfitMonth}`,
  );
  protected readonly paybackText = computed(() =>
    this.base().paybackMonth === null ? 'não chega nos 24 meses' : `mês ${this.base().paybackMonth}`,
  );
  protected readonly chartAria = computed(
    () =>
      `Resultado mensal e saldo do investimento em 24 meses, cenário-base, estimativa do plano. Primeiro lucro no ${this.firstProfitText()}, retorno no ${this.paybackText()}.`,
  );

  protected money(cents: number): string {
    return formatMoney(cents);
  }

  protected downloadCsv(): void {
    if (this.store.exportCsv('base')) {
      this.toasts.success('Tabela do cenário-base baixada. O arquivo não inclui dado pessoal.');
    } else {
      this.toasts.attention('Este navegador não permitiu baixar o arquivo. A tabela está na tela de Projeção.');
    }
  }
}
