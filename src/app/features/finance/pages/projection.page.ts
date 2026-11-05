import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { formatMoney, formatNumber, formatPercent } from '@core/format';
import { ProjectionRow, ScenarioKey } from '@core/models';
import { PLAN_REFERENCE } from '@core/rules/finance';
import { AreaChartComponent } from '@shared/ui/charts';
import { ChartFrameComponent } from '@shared/ui/charts/chart-frame.component';
import { ToastService } from '@shared/ui/overlay';
import {
  CardComponent,
  CellDirective,
  DataTableComponent,
  IconComponent,
  PageHeaderComponent,
  SegmentOption,
  SegmentedComponent,
  SwitchComponent,
  TableColumn,
} from '@shared/ui';
import { FinanceTabsComponent } from '../components/finance-tabs.component';
import { OriginTagComponent } from '../components/origin-tag.component';
import { FinanceStore, SCENARIO_ORDER } from '../state/finance.store';

const SCENARIO_QUERY: Record<ScenarioKey, string> = {
  pessimistic: '3',
  base: '5',
  optimistic: '7',
};

/** Espaço que não quebra: "R$ 2.522,50" não pode partir em duas linhas na tabela. */
function nb(text: string): string {
  return text.replace(' ', ' ');
}

function scenarioFromQuery(value: string | null): ScenarioKey {
  return (SCENARIO_ORDER.find((key) => SCENARIO_QUERY[key] === value) ?? 'base') as ScenarioKey;
}

/**
 * SCR-M10-02 Projeção de 24 meses (`/app/financeiro/projecao`). Três cenários (conversão de 3%, 5% e 7%,
 * editáveis em Parâmetros), gráfico de barras do resultado (vermelho no prejuízo, azul no lucro) com a linha
 * do saldo acumulado e a tabela mês a mês (A.13) logo abaixo, que é também a alternativa acessível. Todo valor
 * é rotulado "estimativa do plano" (RN-FIN-32). "Comparar com o plano" liga a referência literal do documento
 * ao lado do simulado (RN-FIN-27). A cena é do F14 (UX).
 */
@Component({
  selector: 'app-finance-projection-page',
  imports: [
    AreaChartComponent,
    ChartFrameComponent,
    CardComponent,
    CellDirective,
    DataTableComponent,
    IconComponent,
    PageHeaderComponent,
    SegmentedComponent,
    SwitchComponent,
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
        title="Projeção de 24 meses"
        description="Quanto entra, quanto sai e quando o investimento volta, em três cenários."
      >
        <button type="button" class="btn" data-role="export-csv" (click)="downloadCsv()">
          <svg appIcon="download" size="sm"></svg>Baixar tabela (CSV)
        </button>
      </app-page-header>

      <app-finance-tabs />

      <section class="stack stack--3" aria-labelledby="proj-controls">
        <h2 id="proj-controls" class="sr-only">Escolha o cenário</h2>
        <div class="cluster cluster--between">
          <app-segmented
            label="Cenário de conversão"
            [options]="options()"
            [value]="scenario()"
            (valueChange)="choose($event)"
          />
          <app-origin-tag kind="estimate" />
        </div>
        <div class="cluster cluster--4">
          <app-switch [(checked)]="compare" data-role="compare">Comparar com o plano</app-switch>
          <app-switch [(checked)]="tableOnly" data-role="table-only">Ver só a tabela</app-switch>
        </div>
      </section>

      <section class="stack stack--3" aria-labelledby="proj-milestones">
        <h2 id="proj-milestones" class="t-strong">Marcos do cenário de {{ label() }}</h2>
        <ul class="cluster plain-list" data-role="milestones">
          <li class="badge badge--info badge--lg" data-role="first-profit">
            <svg appIcon="trending-up"></svg>Primeiro lucro: {{ monthText(result().firstProfitMonth) }}
          </li>
          <li class="badge badge--success badge--lg" data-role="payback">
            <svg appIcon="circle-check"></svg>Retorno do investimento:
            {{ monthText(result().paybackMonth) }}
          </li>
          <li class="badge badge--gold badge--lg" data-role="extra">
            <svg appIcon="wallet"></svg>Aporte extra dos sócios: {{ money(result().extraContributionCents) }}
          </li>
        </ul>
        <p class="t-ui" data-role="first-year">
          Primeiro ano: mensalidades de
          <strong data-role="first-year-gross">{{ money(result().firstYear.grossRevenueCents) }}</strong>
          e resultado de
          <strong data-role="first-year-result">{{ money(result().firstYear.resultCents) }}</strong>
          (estimativa do plano).
          @if (scenario() === 'base') {
            <span class="t-muted" data-role="first-year-reference">
              Referência do plano: {{ money(reference.firstYearGrossCents) }} de mensalidades e
              {{ money(reference.firstYearResultCents) }} de resultado.
            </span>
          }
        </p>
        <p class="t-caption" data-role="maintenance-note">
          A manutenção anual do site ({{ money(params().annualSiteMaintenanceCents) }}) é lançada nos
          meses {{ maintenanceMonths() }}, quando o gasto passa a ser
          {{ money(maintenanceMonthCost()) }}. A hospedagem está a confirmar e não entra no cálculo.
        </p>
      </section>

      @if (!tableOnly()) {
        <app-card title="Resultado do mês e saldo acumulado" subtitle="Estimativa do plano">
          <app-chart-frame>
            <app-area-chart
              [points]="balancePoints()"
              [bars]="resultPoints()"
              [valueFormat]="formatMoney"
              [referenceLine]="{ value: 0, label: 'Retorno do investimento (saldo zero)' }"
              [ariaLabel]="chartAria()"
              caption="Projeção mês a mês do cenário de {{ label() }} (estimativa do plano)"
            />
          </app-chart-frame>
        </app-card>
      }

      <section class="stack stack--3" aria-labelledby="proj-table">
        <h2 id="proj-table" class="t-strong">Mês a mês</h2>
        <app-data-table
          caption="Projeção mês a mês, em reais, estimativa do plano"
          noun="meses"
          [rows]="result().rows"
          [columns]="columns()"
          [stack]="false"
          [rowKey]="rowKey"
        >
          <ng-template appCell="note" let-row>
            @for (note of notesOf(row); track note.text) {
              <span class="badge" [class.badge--info]="note.tone === 'info'" [class.badge--success]="note.tone === 'success'" [class.badge--attention]="note.tone === 'attention'">{{ note.text }}</span>
            }
          </ng-template>
        </app-data-table>
      </section>

      @if (compare()) {
        <app-card
          title="Conferência com o plano de negócios"
          subtitle="Valor literal do documento ao lado do simulado"
        >
          <div class="table-wrap">
            <table class="table" data-density="comfortable" data-role="reference-table">
              <caption class="sr-only">
                Referência do plano de negócios e valor simulado
              </caption>
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col" class="col-num">Plano de negócios</th>
                  <th scope="col" class="col-num">Simulado</th>
                  <th scope="col">Diferença</th>
                </tr>
              </thead>
              <tbody>
                @for (row of referenceRows(); track row.label) {
                  <tr>
                    <th scope="row">{{ row.label }}</th>
                    <td class="col-num">{{ row.plan }}</td>
                    <td class="col-num">{{ row.simulated }}</td>
                    <td>
                      @if (row.matches) {
                        <span class="badge badge--success"
                          ><svg appIcon="circle-check"></svg>{{ row.difference }}</span
                        >
                      } @else {
                        <span class="badge badge--attention"
                          ><svg appIcon="triangle-alert"></svg>{{ row.difference }}</span
                        >
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <p class="t-caption">
            O documento traz só os marcos; a tabela mês a mês é o modelo de referência do protótipo
            (RN-FIN-26). As diferenças pequenas vêm de assinantes inteiros e de números "cerca de".
          </p>
        </app-card>
      }

      <p class="t-caption" data-role="estimate-note">
        Estimativas do plano, a confirmar no piloto antes de qualquer investimento maior. A projeção
        considera só mensalidades: parcerias, canal corporativo e atendimentos psicológicos ficam de
        fora.
      </p>
    </div>
  `,
})
export class ProjectionPageComponent {
  protected readonly store = inject(FinanceStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  protected readonly formatMoney = formatMoney;
  protected readonly reference = PLAN_REFERENCE.base;
  protected readonly params = this.store.params;

  protected readonly scenario = signal<ScenarioKey>(
    scenarioFromQuery(this.route.snapshot.queryParamMap.get('cenario')),
  );
  protected readonly compare = signal(false);
  protected readonly tableOnly = signal(false);

  protected readonly options = computed<SegmentOption<ScenarioKey>[]>(() =>
    SCENARIO_ORDER.map((key) => ({
      value: key,
      label: this.store.scenarioLabel(key),
    })),
  );
  protected readonly label = computed(() => this.store.scenarioLabel(this.scenario()));
  protected readonly result = computed(() => this.store.scenarios()[this.scenario()]);
  protected readonly referenceRows = computed(() => this.store.referenceRows(this.scenario()));

  protected readonly maintenanceMonths = computed(() =>
    [...this.params().annualSiteMaintenanceMonths]
      .sort((a, b) => a - b)
      .join(' e '),
  );
  protected readonly maintenanceMonthCost = computed(
    () =>
      this.result().rows.find((r) =>
        this.params().annualSiteMaintenanceMonths.includes(r.month),
      )?.costsCents ?? 0,
  );

  protected readonly balancePoints = computed(() =>
    this.result().rows.map((r) => ({ label: `M${r.month}`, value: r.balanceCents })),
  );
  protected readonly resultPoints = computed(() =>
    this.result().rows.map((r) => ({ label: `M${r.month}`, value: r.resultCents })),
  );
  protected readonly chartAria = computed(
    () =>
      `Resultado mensal e saldo do investimento em 24 meses, cenário de ${this.label()}, estimativa do plano. Primeiro lucro no ${this.monthText(this.result().firstProfitMonth)}, retorno do investimento no ${this.monthText(this.result().paybackMonth)}.`,
  );

  protected readonly columns = computed<TableColumn<ProjectionRow>[]>(() => {
    const base: TableColumn<ProjectionRow>[] = [
      { key: 'month', header: 'Mês', primary: true, value: (r) => r.month, align: 'end' },
      { key: 'newFree', header: 'Novos gratuitos', align: 'end', value: (r) => formatNumber(r.newFreeUsers) },
      { key: 'free', header: 'Gratuitos acumulados', align: 'end', value: (r) => formatNumber(r.cumulativeFreeUsers) },
      { key: 'subscribers', header: `Assinantes (${this.label()})`, align: 'end', value: (r) => formatNumber(r.subscribers) },
    ];
    if (this.compare() && this.scenario() === 'base') {
      base.push({
        key: 'subscribersPlan',
        header: 'Assinantes (plano)',
        align: 'end',
        value: (r) => {
          const literal = PLAN_REFERENCE.base.subscribersByMonth[r.month];
          return literal === undefined ? '' : String(literal);
        },
      });
    }
    return [
      ...base,
      { key: 'gross', header: 'Receita bruta', align: 'end', value: (r) => nb(formatMoney(r.grossRevenueCents)) },
      { key: 'net', header: 'Receita líquida', align: 'end', value: (r) => nb(formatMoney(r.netRevenueCents)) },
      { key: 'costs', header: 'Gastos', align: 'end', value: (r) => nb(formatMoney(r.costsCents)) },
      { key: 'result', header: 'Resultado do mês', align: 'end', value: (r) => nb(formatMoney(r.resultCents)) },
      { key: 'cumulative', header: 'Resultado acumulado', align: 'end', value: (r) => nb(formatMoney(r.cumulativeResultCents)) },
      { key: 'balance', header: 'Saldo do investimento', align: 'end', value: (r) => nb(formatMoney(r.balanceCents)) },
      { key: 'note', header: 'Marco', noSearch: true },
    ];
  });

  protected readonly rowKey = (row: ProjectionRow): number => row.month;

  protected notesOf(row: ProjectionRow): { text: string; tone: 'info' | 'success' | 'attention' }[] {
    const notes: { text: string; tone: 'info' | 'success' | 'attention' }[] = [];
    const result = this.result();
    if (result.firstProfitMonth === row.month) {
      notes.push({ text: 'Primeiro lucro', tone: 'info' });
    }
    if (result.paybackMonth === row.month) {
      notes.push({ text: 'Retorno', tone: 'success' });
    }
    if (this.params().annualSiteMaintenanceMonths.includes(row.month)) {
      notes.push({ text: 'Manutenção do site', tone: 'attention' });
    }
    return notes;
  }

  protected monthText(month: number | null): string {
    return month === null ? 'não chega nos 24 meses' : `mês ${month}`;
  }

  protected money(cents: number): string {
    return formatMoney(cents);
  }

  protected percent(value: number): string {
    return formatPercent(value);
  }

  protected choose(key: ScenarioKey | undefined): void {
    if (!key) {
      return;
    }
    this.scenario.set(key);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { cenario: SCENARIO_QUERY[key] },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected downloadCsv(): void {
    if (this.store.exportCsv(this.scenario())) {
      this.toasts.success(
        `Tabela do cenário de ${this.label()} baixada. O arquivo não inclui dado pessoal.`,
      );
    } else {
      this.toasts.attention('Este navegador não permitiu baixar o arquivo. A tabela está nesta tela.');
    }
  }
}
