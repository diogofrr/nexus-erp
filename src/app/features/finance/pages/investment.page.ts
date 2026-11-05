import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatMoney } from '@core/format';
import { initialInvestmentTotalCents, totalContributionCents } from '@core/rules/finance';
import { DonutChartComponent } from '@shared/ui/charts';
import {
  CardComponent,
  KpiComponent,
  KpiStripComponent,
  PageHeaderComponent,
} from '@shared/ui';
import { Database } from '@core/data';
import { FinanceTabsComponent } from '../components/finance-tabs.component';
import { OriginTagComponent } from '../components/origin-tag.component';
import { FinanceStore, SCENARIO_ORDER } from '../state/finance.store';

/**
 * SCR-M10-04 Investimento e capital (`/app/financeiro/investimento`). O Quadro 3 (investimento inicial), a
 * reserva, o aporte total dos sócios (sem empréstimos) e o aporte extra por cenário (K14, RN-FIN-29). Os valores
 * vêm dos parâmetros: editar em Parâmetros muda esta tela.
 */
@Component({
  selector: 'app-finance-investment-page',
  imports: [
    RouterLink,
    CardComponent,
    DonutChartComponent,
    KpiComponent,
    KpiStripComponent,
    PageHeaderComponent,
    FinanceTabsComponent,
    OriginTagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      <app-page-header
        title="Investimento e capital"
        description="Quanto os sócios colocam no negócio e quanto pode faltar nos primeiros meses."
      >
        <a class="btn" routerLink="/app/financeiro/parametros">Editar em Parâmetros</a>
      </app-page-header>

      <app-finance-tabs />

      <app-kpi-strip>
        <app-kpi label="Investimento inicial" [value]="money(investment())" context="feito uma única vez" />
        <app-kpi label="Reserva dos sócios" [value]="money(params().reserveCents)" context="para os primeiros meses" />
        <app-kpi label="Aporte total dos sócios" [value]="money(contribution())" context="investimento mais reserva" />
        <app-kpi label="Empréstimos" value="Nenhum" context="só recursos dos sócios" />
      </app-kpi-strip>

      <div class="grid grid--2">
        <app-card title="Investimento inicial" subtitle="O investimento do plano de negócios">
          <div class="stack stack--3">
            <div class="table-wrap">
              <table class="table" data-density="comfortable" data-role="investment-table">
                <caption class="sr-only">
                  Investimento inicial
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Item</th>
                    <th scope="col" class="col-num t-nowrap">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of items(); track item.label) {
                    <tr>
                      <th scope="row">
                        {{ item.label }}<br /><span class="t-caption">{{ item.note }}</span>
                      </th>
                      <td class="col-num t-nowrap">{{ money(item.cents) }}</td>
                    </tr>
                  }
                  <tr>
                    <th scope="row">Total do investimento inicial</th>
                    <td class="col-num t-strong t-nowrap">{{ money(investment()) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="t-ui" data-role="sum-text">{{ sumText() }}</p>
            <p class="t-caption">
              O serviço de advogado é pontual (pago uma vez), não uma assessoria mensal.
            </p>
          </div>
        </app-card>

        <app-card title="Uso do capital" subtitle="Aporte total dos sócios">
          <app-donut-chart
            [segments]="segments()"
            [centerValue]="money(contribution())"
            centerLabel="aporte total"
            [ariaLabel]="donutAria()"
            caption="Uso do capital dos sócios"
            categoryHeader="Destino"
            valueHeader="Valor"
          />
        </app-card>
      </div>

      <app-card
        title="Fontes do capital"
        subtitle="De onde vem o dinheiro"
      >
        <ul class="stack stack--2 t-ui" data-role="sources">
          <li><strong>Recursos dos sócios:</strong> {{ money(contribution()) }} (100% do capital).</li>
          <li><strong>Empréstimos:</strong> nenhum.</li>
          <li>
            <strong>Reserva:</strong> {{ money(params().reserveCents) }} guardados para cobrir os
            primeiros meses, quando o resultado ainda é negativo.
          </li>
        </ul>
      </app-card>

      <app-card
        title="Aporte extra por cenário"
        subtitle="O maior prejuízo acumulado menos a reserva"
      >
        <app-origin-tag appCardActions kind="estimate" />
        <div class="stack stack--3">
          <div class="table-wrap">
            <table class="table" data-density="comfortable" data-role="extra-table">
              <caption class="sr-only">
                Aporte extra dos sócios em cada cenário
              </caption>
              <thead>
                <tr>
                  <th scope="col">Cenário</th>
                  <th scope="col" class="col-num t-nowrap">Maior prejuízo acumulado</th>
                  <th scope="col">Em que mês</th>
                  <th scope="col" class="col-num t-nowrap">Reserva</th>
                  <th scope="col" class="col-num t-nowrap">Aporte extra</th>
                </tr>
              </thead>
              <tbody>
                @for (row of extraRows(); track row.label) {
                  <tr>
                    <th scope="row">{{ row.label }}</th>
                    <td class="col-num t-nowrap">{{ money(row.maxLoss) }}</td>
                    <td>{{ row.month }}</td>
                    <td class="col-num t-nowrap">{{ money(params().reserveCents) }}</td>
                    <td class="col-num t-strong t-nowrap" [attr.data-extra]="row.key">{{ row.extraText }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <p class="t-caption">
            O documento fala em "cerca de R$ 2.700,00" de aporte extra no cenário de 3%. A conta do
            protótipo dá {{ money(pessimisticExtra()) }}, compatível com o "cerca de".
          </p>
        </div>
      </app-card>

      <app-card title="Constituição da empresa" subtitle="Pendências registradas pelo plano">
        <ul class="stack stack--2 t-ui" data-role="company">
          <li>Natureza jurídica proposta: Sociedade Empresária Limitada (LTDA). A definição final depende de orientação contábil e jurídica.</li>
          <li>Responsável técnico indicado: {{ technicalLead() }}.</li>
          <li>Registro da pessoa jurídica no CRP-04: pendente de confirmação.</li>
        </ul>
      </app-card>
    </div>
  `,
})
export class InvestmentPageComponent {
  private readonly store = inject(FinanceStore);
  private readonly db = inject(Database);

  protected readonly params = this.store.params;
  protected readonly investment = computed(() => initialInvestmentTotalCents(this.params()));
  protected readonly contribution = computed(() => totalContributionCents(this.params()));

  protected readonly items = computed(() => {
    const i = this.params().initialInvestmentCents;
    return [
      { label: 'Desenvolvimento do site e do aplicativo', note: 'Aplicativo, site e integrações', cents: i.appAndSite },
      { label: 'Abertura do CNPJ', note: 'Constituição da empresa', cents: i.company },
      {
        label: 'Serviços de advogado',
        note: 'Contrato social, termos de uso e contratos de credenciamento',
        cents: i.lawyer,
      },
    ];
  });

  protected readonly sumText = computed(() => {
    const i = this.params().initialInvestmentCents;
    return `${formatMoney(i.appAndSite)} + ${formatMoney(i.company)} + ${formatMoney(i.lawyer)} = ${formatMoney(this.investment())}. Com a reserva de ${formatMoney(this.params().reserveCents)}, o aporte total é de ${formatMoney(this.contribution())}.`;
  });

  protected readonly segments = computed(() => {
    const p = this.params();
    return [
      { label: 'Aplicativo e site', value: p.initialInvestmentCents.appAndSite, color: 'var(--chart-1)' },
      { label: 'Abertura da empresa', value: p.initialInvestmentCents.company, color: 'var(--chart-3)' },
      { label: 'Advogado', value: p.initialInvestmentCents.lawyer, color: 'var(--chart-4)' },
      { label: 'Reserva', value: p.reserveCents, color: 'var(--chart-2)' },
    ];
  });
  protected readonly donutAria = computed(
    () =>
      `Uso do capital: ${this.segments()
        .map((s) => `${s.label} ${formatMoney(s.value)}`)
        .join(', ')}`,
  );

  protected readonly extraRows = computed(() =>
    SCENARIO_ORDER.map((key) => {
      const r = this.store.scenarios()[key];
      return {
        key,
        label: `${this.store.scenarioLabel(key)} de conversão`,
        maxLoss: r.maxCumulativeLossCents,
        month: r.maxCumulativeLossMonth === null ? 'sem prejuízo acumulado' : `mês ${r.maxCumulativeLossMonth}`,
        extraText: r.extraContributionCents > 0 ? formatMoney(r.extraContributionCents) : 'R$ 0,00 (cabe na reserva)',
      };
    }),
  );
  protected readonly pessimisticExtra = computed(
    () => this.store.scenarios().pessimistic.extraContributionCents,
  );

  protected readonly technicalLead = computed(
    () =>
      this.db.users.find((u) => u.role === 'technical_lead')?.displayName ?? 'a definir',
  );

  protected money(cents: number): string {
    return formatMoney(cents);
  }
}
