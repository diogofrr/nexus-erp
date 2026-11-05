import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/auth';
import { Clock } from '@core/clock';
import { Database } from '@core/data';
import { formatPercent } from '@core/format';
import { ConsentService } from '@core/privacy/consent.service';
import { LESS_THAN_MIN_LABEL, displayAggregate } from '@core/privacy/aggregation';
import { ZARIT_BANDS, zaritBandLabel } from '@core/rules';
import {
  EmptyStateComponent,
  KpiComponent,
  KpiStripComponent,
  PageHeaderComponent,
} from '@shared/ui';
import { BarChartComponent, BarDatum } from '@shared/ui/charts';
import { BAND_ORDER, buildAggregate } from '@core/rules/zarit-aggregate';

/**
 * SCR-M06-10, Painel agregado (K15 a K19, RN-KPI-02, A-30): distribuição por faixa da última aplicação de cada
 * cuidador, evolução média, alertas abertos e ARBE, tudo com no mínimo 5 pessoas por recorte. Recorte menor
 * aparece como "menos de 5", sem número e sem barra. Quando algum recorte é suprimido, o total fica oculto, para
 * ninguém deduzir o valor por subtração. Cuidador sem os consentimentos de saúde e de indicadores fica de fora
 * (RN-ZRT-26). A sócia vê só isto (nunca um nome); o psicólogo vê o agregado dos seus casos.
 */
@Component({
  selector: 'app-aggregate-page',
  imports: [BarChartComponent, EmptyStateComponent, KpiComponent, KpiStripComponent, PageHeaderComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      <app-page-header [title]="title()" [description]="description()" />

      @if (result().people === 0 && !result().anySuppressed) {
        <app-empty-state title="Sem dados para mostrar" text="Quando houver aplicações concluídas com os consentimentos ativos, o painel aparece aqui." />
      } @else {
        <app-kpi-strip aria-label="Indicadores agregados">
          <app-kpi label="Pessoas no painel" [value]="peopleValue()" [suppressed]="result().anySuppressed" context="Última aplicação de cada cuidador" data-role="kpi-people" />
          <app-kpi label="Evolução média desde a adesão" [value]="evolutionValue()" [suppressed]="!result().meanEvolution.sufficient" context="Quem tem 2 ou mais aplicações" data-role="kpi-evolution" />
          <app-kpi label="Alertas vermelhos abertos" [value]="shortOf(result().alerts.red)" [suppressed]="!result().alerts.red.sufficient" data-role="kpi-red" />
          <app-kpi label="Alertas amarelos abertos" [value]="shortOf(result().alerts.yellow)" [suppressed]="!result().alerts.yellow.sufficient" data-role="kpi-yellow" />
          <app-kpi label="ARBE crítico aberto" [value]="shortOf(result().arbe.critical)" [suppressed]="!result().arbe.critical.sufficient" data-role="kpi-arbe-critical" />
          <app-kpi label="ARBE de atenção aberto" [value]="shortOf(result().arbe.attention)" [suppressed]="!result().arbe.attention.sufficient" data-role="kpi-arbe-attention" />
          @if (showSameDay()) {
            <app-kpi label="Contato no mesmo dia (30 dias)" [value]="sameDayValue()" [suppressed]="sameDaySuppressed()" [context]="sameDayContext()" data-role="kpi-same-day" />
          }
        </app-kpi-strip>

        <section class="card card--pad stack stack--3" aria-labelledby="agg-chart" data-role="distribution">
          <h2 id="agg-chart" class="card__title">Distribuição por faixa</h2>
          <app-bar-chart
            [data]="chartData()"
            ariaLabel="Quantidade de cuidadores em cada faixa da escala, pela última aplicação de cada um"
            caption="Cuidadores por faixa da escala"
            categoryHeader="Faixa"
            valueHeader="Cuidadores"
          />
          <p class="t-caption" data-role="privacy-note">
            Recortes com menos de 5 pessoas aparecem como "{{ lessThan }}", sem número e sem barra.
            @if (result().anySuppressed) {
              O total do painel fica oculto para ninguém deduzir o valor ausente por subtração.
            }
          </p>
        </section>

        <section class="card card--pad stack stack--2" aria-labelledby="agg-limits" data-role="limits">
          <h2 id="agg-limits" class="card__title">Limites da ARBE em vigor</h2>
          <p class="t-ui">
            Horas por dia de cuidado: {{ limits().hoursThreshold }} ou mais. Pedidos de apoio: {{ limits().supportRequestsThreshold }} ou mais em
            {{ limits().windowDays }} dias. Pontuação da escala: {{ limits().zaritThreshold }} ou mais. Crítico: os 3 critérios ou {{ limits().criticalZarit }} ou mais.
          </p>
          <p class="t-caption">Só o responsável técnico edita os limites.
            @if (canSeeSettings()) {
              <a routerLink="/app/configuracoes/arbe">Abrir os parâmetros da ARBE</a>
            }
          </p>
        </section>
      }
    </div>
  `,
})
export class AggregatePageComponent {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly auth = inject(AuthService);
  private readonly consent = inject(ConsentService);

  protected readonly lessThan = LESS_THAN_MIN_LABEL;
  protected readonly limits = computed(() => this.db.settings.value().arbe);
  protected readonly title = computed(() => (this.auth.role() === 'partner' ? 'Sobrecarga agregada' : 'Painel agregado'));
  protected readonly description = computed(() =>
    this.auth.role() === 'psychologist'
      ? 'Os seus casos, em números somados. Nenhum recorte com menos de 5 pessoas é mostrado.'
      : 'Números somados, sem nenhum cuidador identificado. Nenhum recorte com menos de 5 pessoas é mostrado.',
  );
  protected readonly canSeeSettings = computed(() => this.auth.role() === 'technical_lead');

  protected readonly result = computed(() => {
    const actor = this.auth.actor();
    const caregivers =
      actor?.role === 'psychologist'
        ? this.db.caregivers.query((c) => c.assignedPsychologistId === actor.psychologistId)
        : [...this.db.caregivers.list()];
    return buildAggregate({
      caregivers,
      assessments: this.db.zaritAssessments.all(),
      alerts: this.db.zaritAlerts.all(),
      arbe: this.db.arbeAlerts.all(),
      eligible: (id) => this.consent.isActive(id, 'health_data') && this.consent.isActive(id, 'people_analytics'),
      min: this.db.settings.value().minGroupSizeForAggregates,
      now: this.clock.now(),
      today: this.clock.today(),
    });
  });

  protected readonly chartData = computed<BarDatum[]>(() =>
    BAND_ORDER.map((band) => {
      const aggregate = this.result().bands[band];
      return {
        label: `${ZARIT_BANDS.find((b) => b.band === band)?.min} a ${ZARIT_BANDS.find((b) => b.band === band)?.max}: ${zaritBandLabel(band)}`,
        value: aggregate.sufficient ? aggregate.value : 0,
        suppressed: !aggregate.sufficient,
      };
    }),
  );

  protected readonly peopleValue = computed(() => (this.result().anySuppressed ? '' : displayAggregate(this.result().total)));
  protected readonly evolutionValue = computed(() => {
    const evolution = this.result().meanEvolution;
    return evolution.sufficient ? formatPercent(evolution.value, { decimals: 1, signed: true }) : '';
  });
  protected readonly showSameDay = computed(() => this.auth.role() === 'technical_lead' || this.auth.role() === 'partner');
  /** Para a sócia, o contato no mesmo dia também respeita o mínimo de 5 (agregado). */
  protected readonly sameDaySuppressed = computed(
    () => this.auth.role() === 'partner' && !this.result().sameDayAggregate.sufficient,
  );
  protected readonly sameDayValue = computed(() => {
    const stat = this.result().sameDay;
    return this.sameDaySuppressed() || stat.percent === null ? '' : formatPercent(stat.percent, { decimals: 1 });
  });
  protected readonly sameDayContext = computed(() => {
    const stat = this.result().sameDay;
    if (this.sameDaySuppressed()) {
      return 'Menos de 5 casos no período';
    }
    return stat.percent === null
      ? 'Sem alerta vermelho com prazo vencido no período'
      : `${stat.numerator} de ${stat.denominator} alertas vermelhos com prazo vencido`;
  });

  protected shortOf(aggregate: { sufficient: boolean; value?: number }): string {
    return aggregate.sufficient && aggregate.value !== undefined ? String(aggregate.value) : '';
  }
}
