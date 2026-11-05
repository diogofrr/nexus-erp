import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatMoney, formatNumber, formatPercent, formatYearMonth } from '@core/format';
import { Aggregate } from '@core/privacy';
import { CONVERSION_REFERENCES } from '@core/rules/finance';
import { PAID_PLAN_IDS } from '@core/rules/plans';
import { BarChartComponent, DonutChartComponent } from '@shared/ui/charts';
import {
  CardComponent,
  EmptyStateComponent,
  IconComponent,
  KpiStripComponent,
  MeterComponent,
  OccupancyBarComponent,
  PLAN_NAMES,
  PageHeaderComponent,
} from '@shared/ui';
import { PanelKpiComponent } from '../components/panel-kpi.component';
import { PanelSectionComponent } from '../components/panel-section.component';
import { DashboardStore } from '../state/dashboard.store';

/**
 * Painel da sócia (`partner`, SCR-M02-01): começa pelo que precisa da decisão dela (até 3 itens), depois o
 * negócio (assinantes, conversão, resultado, ponto de equilíbrio) e, em seções recolhíveis, rede, equipe,
 * alertas agregados, atendimento e conformidade. NUNCA mostra nome de cuidador; indicador de saúde abaixo do
 * mínimo de 5 aparece como "menos de 5" (RN-KPI-02). AC-M02-01 e AC-M02-03.
 */
@Component({
  selector: 'app-partner-panel',
  imports: [
    RouterLink,
    BarChartComponent,
    CardComponent,
    DonutChartComponent,
    EmptyStateComponent,
    IconComponent,
    KpiStripComponent,
    MeterComponent,
    OccupancyBarComponent,
    PageHeaderComponent,
    PanelKpiComponent,
    PanelSectionComponent,
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
    <div class="page stack stack--6" data-role="partner-panel">
      <app-page-header
        [title]="store.greeting()"
        description="Como está o negócio hoje. Nenhum cuidador aparece pelo nome, só por código e em números agregados."
      />

      <section class="stack stack--3" aria-labelledby="decisions-title">
        <h2 id="decisions-title" class="t-strong">Precisa da sua decisão</h2>
        @if (store.decisions().length === 0) {
          <app-empty-state compact title="Nada exige a sua decisão hoje" text="Quando algo pedir uma decisão, aparece aqui com o caminho até a tela certa." />
        } @else {
          <div class="list-card" role="list" data-role="decisions">
            @for (item of store.decisions(); track item.key) {
              <a class="list-row" role="listitem" [routerLink]="item.link" [queryParams]="item.queryParams">
                  <span><svg [appIcon]="item.icon"></svg></span>
                  <span class="list-row__title">{{ item.text }}</span>
                  <svg appIcon="chevron-right"></svg>
                </a>
            }
          </div>
        }
      </section>

      <app-kpi-strip>
        <app-panel-kpi
          label="Assinantes"
          [value]="store.subscribers().total"
          [context]="'de ' + free() + ' usuários gratuitos'"
          link="/app/assinaturas"
        />
        <app-panel-kpi
          label="Conversão"
          [value]="conversionText()"
          [context]="'referências do plano: ' + references"
          link="/app/indicadores"
          [queryParams]="{ aba: 'cuidadores' }"
        />
        <app-panel-kpi
          label="Resultado do mês"
          [value]="money(real().resultCents)"
          [context]="real().aboveBreakEven ? 'acima do equilíbrio' : 'abaixo do equilíbrio'"
          [tone]="real().aboveBreakEven ? 'good' : 'bad'"
          link="/app/financeiro"
        />
        <app-panel-kpi
          label="Ponto de equilíbrio"
          [value]="real().missing > 0 ? 'Faltam ' + real().missing : 'Atingido'"
          [context]="real().subscribers + ' de ' + real().breakEven + ' assinantes'"
          link="/app/financeiro"
        />
      </app-kpi-strip>

      <app-card title="Ponto de equilíbrio" subtitle="Dado do sistema">
        <div class="stack stack--3" data-role="break-even">
          <p class="t-strong" data-role="summary">
            {{ real().subscribers }} assinantes.
            @if (real().missing > 0) {
              Faltam {{ real().missing }} para o ponto de equilíbrio.
            } @else {
              Acima do ponto de equilíbrio.
            }
          </p>
          <app-meter label="Assinantes" [value]="real().subscribers" [target]="real().breakEven" unit="assinantes" />
          <div><a class="btn btn--sm" routerLink="/app/financeiro">Ver o financeiro</a></div>
        </div>
      </app-card>

      <div class="grid grid--2">
        <app-card title="Assinantes por plano" subtitle="Planos pagos">
          <app-donut-chart
            [segments]="planSegments()"
            [centerValue]="'' + store.subscribers().total"
            centerLabel="assinantes"
            [ariaLabel]="planAria()"
            caption="Assinantes por plano"
            categoryHeader="Plano"
            valueHeader="Assinantes"
          />
        </app-card>
        <app-card title="Resultado do mês e projeção" subtitle="Estimativa do plano nos 12 primeiros meses">
          <app-bar-chart
            [data]="projectionBars()"
            [valueFormat]="formatMoney"
            [referenceLine]="{ value: real().resultCents, label: 'Resultado realizado do mês' }"
            [ariaLabel]="projectionAria()"
            caption="Resultado mensal projetado, cenário-base"
            categoryHeader="Mês"
            valueHeader="Resultado projetado"
            positiveLabel="Lucro projetado"
            negativeLabel="Prejuízo projetado"
            showValues="never"
          />
        </app-card>
      </div>

      <app-panel-section title="Rede credenciada" hint="Prestadores, credenciamentos e risco de saída" open>
        <app-kpi-strip>
          <app-panel-kpi label="Em excelência" [value]="band('excellence')" link="/app/rede/prestadores" />
          <app-panel-kpi label="Em alerta" [value]="band('alert')" link="/app/rede/prestadores" />
          <app-panel-kpi label="Credenciamentos em andamento" [value]="store.accreditationsInProgress()" link="/app/rede/credenciamento" />
          <app-panel-kpi
            label="Risco de saída"
            [value]="store.exitRiskCount()"
            context="recusa alta ou queda de disponibilidade"
            link="/app/rede/prestadores"
          />
        </app-kpi-strip>
        <p class="t-caption">
          Em descredenciamento: {{ band('deaccreditation') }}. Sem média (menos de 5 avaliações): {{ band('no_average') }}.
          Última auditoria: {{ store.lastAuditDate() ? lastAudit() : 'ainda não houve' }}.
          @if (store.auditDue()) {
            <a routerLink="/app/rede/auditoria">Auditoria quinzenal pendente</a>
          }
        </p>
      </app-panel-section>

      <app-panel-section title="Equipe" [hint]="teamHint()" open>
        <div class="stack stack--3" data-role="team">
          @for (line of store.occupancy(); track line.psychologistId) {
            <app-occupancy-bar [name]="line.name" [percent]="line.percent" />
            @if (line.overload) {
              <p class="t-caption"><span class="badge badge--attention"><svg appIcon="triangle-alert"></svg>Agenda acima de 80% por dois meses</span></p>
            }
          }
          <div><a class="btn btn--sm" routerLink="/app/indicadores" [queryParams]="{ aba: 'equipe' }">Ver a equipe</a></div>
        </div>
      </app-panel-section>

      <app-panel-section title="Acompanhamento dos cuidadores" hint="Só contagens, sem casos">
        <app-kpi-strip>
          <app-panel-kpi label="Alertas amarelos abertos" [value]="agg(store.aggregateAlerts().yellow)" [suppressed]="!store.aggregateAlerts().yellow.sufficient" link="/app/indicadores" [queryParams]="{ aba: 'cuidadores' }" />
          <app-panel-kpi label="Alertas vermelhos abertos" [value]="agg(store.aggregateAlerts().red)" [suppressed]="!store.aggregateAlerts().red.sufficient" link="/app/indicadores" [queryParams]="{ aba: 'cuidadores' }" />
          <app-panel-kpi label="ARBE críticos abertos" [value]="agg(store.aggregateAlerts().arbeCritical)" [suppressed]="!store.aggregateAlerts().arbeCritical.sufficient" link="/app/indicadores" [queryParams]="{ aba: 'cuidadores' }" />
        </app-kpi-strip>
      </app-panel-section>

      <app-panel-section title="Atendimento e reclamações" hint="Prazos de resposta dos últimos 30 dias">
        <div class="stack stack--3" data-role="service">
          <ul class="cluster plain-list" aria-label="Prazo de resposta por canal">
            @for (row of store.sla(); track row.channel) {
              <li class="badge badge--outline">{{ channel(row.channel) }}: {{ row.percent === null ? 'n/d' : percent(row.percent) }}</li>
            }
          </ul>
          <app-kpi-strip>
            <app-panel-kpi label="Mensagens atrasadas" [value]="store.overdueMessages()" link="/app/mensagens" [queryParams]="{ filtro: 'atrasadas' }" />
            <app-panel-kpi label="Reclamações abertas" [value]="store.complaints().open" [context]="store.complaints().overdue + ' vencidas'" link="/app/reclamacoes" />
          </app-kpi-strip>
        </div>
      </app-panel-section>

      <app-panel-section title="Conformidade e governança" hint="LGPD, POPs e riscos">
        <app-kpi-strip>
          <app-panel-kpi
            label="Solicitações do titular a vencer"
            [value]="store.dsr().dueSoon + store.dsr().overdue"
            [context]="store.dsr().open + ' abertas'"
            link="/app/lgpd/solicitacoes"
            [queryParams]="{ filtro: 'vencendo' }"
          />
          <app-panel-kpi
            label="POPs a revisar"
            [value]="store.governance().popsToReview"
            link="/app/governanca/pops"
            [queryParams]="{ filtro: 'a-revisar' }"
          />
          <app-panel-kpi
            label="Riscos prioritários"
            [value]="store.governance().priorityRisks"
            context="criticidade 12 ou mais"
            link="/app/governanca/riscos"
          />
        </app-kpi-strip>
      </app-panel-section>
    </div>
  `,
})
export class PartnerPanelComponent {
  protected readonly store = inject(DashboardStore);
  protected readonly formatMoney = formatMoney;
  protected readonly references = CONVERSION_REFERENCES.map((r) => `${r}%`).join(', ');

  protected readonly real = this.store.realized;
  protected readonly free = computed(() => formatNumber(this.store.freeUsers()));
  protected readonly conversionText = computed(() => {
    const v = this.store.conversion();
    return v === null ? 'n/d' : formatPercent(v, { decimals: 1 });
  });

  protected readonly planSegments = computed(() =>
    PAID_PLAN_IDS.map((plan) => ({
      label: PLAN_NAMES[plan],
      value: this.store.subscribers().byPlan[plan],
      color: `var(--plan-${plan})`,
    })),
  );
  protected readonly planAria = computed(
    () =>
      `Assinantes por plano: ${PAID_PLAN_IDS.map(
        (plan) => `${this.store.subscribers().byPlan[plan]} ${PLAN_NAMES[plan]}`,
      ).join(', ')}`,
  );

  protected readonly projectionBars = computed(() =>
    this.store
      .baseProjection()
      .rows.slice(0, 12)
      .map((r) => ({ label: `M${r.month}`, value: r.resultCents })),
  );
  protected readonly projectionAria = computed(
    () =>
      `Resultado mensal projetado nos 12 primeiros meses, cenário-base, estimativa do plano. O resultado realizado do mês é ${formatMoney(this.real().resultCents)}.`,
  );

  protected readonly teamHint = computed(() => {
    const month = this.store.occupancy()[0]?.month;
    return month ? `Ocupação em ${formatYearMonth(month)} e alerta de sobrecarga` : 'Ocupação da agenda e alerta de sobrecarga';
  });

  protected band(key: string): number {
    return this.store.arpBands().find((b) => b.band === key)?.count ?? 0;
  }

  protected lastAudit(): string {
    const date = this.store.lastAuditDate();
    return date ? `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}` : '';
  }

  protected money(cents: number): string {
    return formatMoney(cents);
  }

  protected percent(value: number): string {
    return formatPercent(value, { decimals: 1 });
  }

  protected agg(a: Aggregate<number>): string {
    return a.sufficient ? String(a.value) : a.shortLabel;
  }

  protected monthName(month: string): string {
    return formatYearMonth(month);
  }

  protected channel(channel: string): string {
    return this.store.channelLabel(channel as 'app' | 'whatsapp' | 'phone' | 'email');
  }
}
