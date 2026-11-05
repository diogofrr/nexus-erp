import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatMoney } from '@core/format';
import {
  annualCostsCents,
  knownRecurringAnnualCents,
  monthlyCostsTotalCents,
} from '@core/rules/finance';
import { DonutChartComponent } from '@shared/ui/charts';
import {
  CardComponent,
  IconComponent,
  KpiComponent,
  KpiStripComponent,
  PageHeaderComponent,
} from '@shared/ui';
import { FinanceTabsComponent } from '../components/finance-tabs.component';
import { FinanceStore } from '../state/finance.store';

/**
 * SCR-M10-05 Custos (`/app/financeiro/custos`). O Quadro 5 (gastos mensais e anuais), a manutenção anual do site
 * (lançada nos meses em que é paga, não diluída) e a hospedagem "a confirmar", fora do cálculo (RN-FIN-11 a 14).
 */
@Component({
  selector: 'app-finance-costs-page',
  imports: [
    RouterLink,
    CardComponent,
    DonutChartComponent,
    IconComponent,
    KpiComponent,
    KpiStripComponent,
    PageHeaderComponent,
    FinanceTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      <app-page-header
        title="Custos"
        description="Quanto custa manter a Nexus funcionando, por mês e por ano."
      >
        <a class="btn" routerLink="/app/financeiro/parametros">Editar em Parâmetros</a>
      </app-page-header>

      <app-finance-tabs />

      <app-kpi-strip>
        <app-kpi label="Gastos por mês" [value]="money(monthly())" context="desde o primeiro mês" />
        <app-kpi label="Gastos por ano" [value]="money(annual())" context="12 meses de gastos mensais" />
        <app-kpi label="Manutenção do site" [value]="money(params().annualSiteMaintenanceCents)" context="por ano" />
        <app-kpi label="Recorrente conhecido" [value]="money(recurring())" context="por ano, sem a hospedagem" />
      </app-kpi-strip>

      <div class="grid grid--2">
        <app-card title="Gastos mensais" subtitle="Os gastos fixos do plano de negócios">
          <div class="table-wrap">
            <table class="table" data-density="comfortable" data-role="costs-table">
              <caption class="sr-only">
                Gastos mensais e anuais
              </caption>
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col" class="col-num t-nowrap">Por mês</th>
                  <th scope="col" class="col-num t-nowrap">Por ano</th>
                </tr>
              </thead>
              <tbody>
                @for (row of rows(); track row.label) {
                  <tr>
                    <th scope="row">{{ row.label }}</th>
                    <td class="col-num t-nowrap">{{ money(row.cents) }}</td>
                    <td class="col-num t-nowrap">{{ money(row.cents * 12) }}</td>
                  </tr>
                }
                <tr>
                  <th scope="row">Total</th>
                  <td class="col-num t-strong t-nowrap" data-role="monthly-total">{{ money(monthly()) }}</td>
                  <td class="col-num t-strong t-nowrap" data-role="annual-total">{{ money(annual()) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </app-card>

        <app-card title="Para onde vai o dinheiro" subtitle="Gastos mensais">
          <app-donut-chart
            [segments]="segments()"
            [centerValue]="money(monthly())"
            centerLabel="por mês"
            [ariaLabel]="donutAria()"
            caption="Composição dos gastos mensais"
            categoryHeader="Gasto"
            valueHeader="Por mês"
          />
        </app-card>
      </div>

      <app-card title="Despesas do site" subtitle="Pagas uma vez por ano">
        <ul class="stack stack--3 t-ui" data-role="site-costs">
          <li data-role="maintenance">
            <strong>Manutenção do site:</strong> {{ money(params().annualSiteMaintenanceCents) }} por
            ano. É lançada nos meses {{ months() }} (o gasto desses meses passa a ser
            {{ money(monthly() + params().annualSiteMaintenanceCents) }}) e não é diluída entre os
            meses.
          </li>
          <li data-role="hosting">
            <strong>Hospedagem (Locaweb):</strong>
            <span class="badge badge--attention"
              ><svg appIcon="clock"></svg>A confirmar, não incluída</span
            >
            O valor do plano anual ainda será confirmado e por isso não entra nos cálculos.
          </li>
          <li data-role="recurring">
            <strong>Recorrente conhecido:</strong> {{ money(annual()) }} +
            {{ money(params().annualSiteMaintenanceCents) }} = {{ money(recurring()) }} por ano.
          </li>
        </ul>
      </app-card>

      <app-card title="O que não está nestes números" subtitle="Para ninguém se enganar">
        <ul class="stack stack--2 t-ui">
          <li>Os gastos mensais valem desde o primeiro mês, por prudência, inclusive durante o desenvolvimento do aplicativo.</li>
          <li>Não há retirada de salário dos sócios. Contratações e remunerações só entram quando a receita permitir.</li>
          <li>O orçamento de comunicação não está incluído; até ser definido, a divulgação se apoia nos próprios sócios.</li>
        </ul>
      </app-card>
    </div>
  `,
})
export class CostsPageComponent {
  private readonly store = inject(FinanceStore);

  protected readonly params = this.store.params;
  protected readonly monthly = computed(() => monthlyCostsTotalCents(this.params()));
  protected readonly annual = computed(() => annualCostsCents(this.params()));
  protected readonly recurring = computed(() => knownRecurringAnnualCents(this.params()));
  protected readonly months = computed(() =>
    [...this.params().annualSiteMaintenanceMonths].sort((a, b) => a - b).join(' e '),
  );

  protected readonly rows = computed(() => {
    const c = this.params().monthlyCostsCents;
    return [
      { label: 'Coworking (salas)', cents: c.coworking },
      { label: 'Manutenção do aplicativo', cents: c.appMaintenance },
      { label: 'Contabilidade (estimada)', cents: c.accounting },
      { label: 'Deslocamentos', cents: c.travel },
    ];
  });

  protected readonly segments = computed(() =>
    this.rows().map((row, i) => ({
      label: row.label,
      value: row.cents,
      color: `var(--chart-${i + 1})`,
    })),
  );
  protected readonly donutAria = computed(
    () =>
      `Gastos mensais: ${this.rows()
        .map((r) => `${r.label} ${formatMoney(r.cents)}`)
        .join(', ')}`,
  );

  protected money(cents: number): string {
    return formatMoney(cents);
  }
}
