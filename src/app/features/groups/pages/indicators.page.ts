import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/auth';
import { Database } from '@core/data';
import { formatPercent } from '@core/format';
import { aggregateCount } from '@core/privacy/aggregation';
import { percentOf } from '@core/rules';
import { EmptyStateComponent, KpiComponent, KpiStripComponent, PageHeaderComponent } from '@shared/ui';
import { BarChartComponent, BarDatum } from '@shared/ui/charts';
import { KIND_LABELS } from '../state/groups-labels';
import { GroupsService } from '../state/groups.service';

interface IndicatorRow {
  id: string;
  title: string;
  kindText: string;
  holders: number | null;
  capacity: number;
  fill: number | null;
  doneMeetings: number;
  presence: number | null;
  suppressed: boolean;
}

/**
 * SCR-M07-06, Indicadores de participação (RN-KPI-08, K28): inscritos, presentes, taxa de presença e
 * preenchimento de vagas, por atividade e no total. A sócia e o psicólogo veem; o psicólogo só as suas atividades.
 * Participação em terapia de grupo é dado de saúde: para a gestão, recorte com menos de 5 pessoas aparece como "menos de 5".
 */
@Component({
  selector: 'app-indicators-page',
  imports: [BarChartComponent, EmptyStateComponent, KpiComponent, KpiStripComponent, PageHeaderComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      <app-page-header title="Indicadores de participação" description="Inscritos, presentes, taxa de presença e preenchimento das vagas.">
        <a class="btn" routerLink="/app/grupos">Voltar à programação</a>
      </app-page-header>

      @if (rows().length === 0) {
        <app-empty-state title="Nenhuma atividade para medir" text="Quando houver atividades com inscritos, os indicadores aparecem aqui." />
      } @else {
        <app-kpi-strip aria-label="Indicadores gerais">
          <app-kpi label="Inscritos" [value]="totals().holders" data-role="kpi-holders" />
          <app-kpi label="Presenças registradas" [value]="totals().presences" data-role="kpi-presences" />
          <app-kpi label="Taxa de presença" [value]="percent(totals().presence)" context="Presenças em encontros realizados" data-role="kpi-presence" />
          <app-kpi label="Preenchimento das vagas" [value]="percent(totals().fill)" context="Atividades publicadas ou em andamento" data-role="kpi-fill" />
        </app-kpi-strip>

        <section class="card card--pad stack stack--3" aria-labelledby="ind-chart">
          <h2 id="ind-chart" class="card__title">Preenchimento por atividade</h2>
          <app-bar-chart
            [data]="chartData()"
            ariaLabel="Preenchimento das vagas de cada atividade, em percentual"
            caption="Preenchimento das vagas"
            categoryHeader="Atividade"
            valueHeader="Preenchimento"
            [valueFormat]="formatFill"
          />
        </section>

        <section class="card card--pad stack stack--3" aria-labelledby="ind-table">
          <h2 id="ind-table" class="card__title">Por atividade</h2>
          <div class="table-wrap">
            <table class="table" data-role="indicators-table">
              <caption class="sr-only">Indicadores de participação por atividade</caption>
              <thead>
                <tr>
                  <th scope="col">Atividade</th>
                  <th scope="col">Tipo</th>
                  <th scope="col" class="t-right">Inscritos</th>
                  <th scope="col" class="t-right">Vagas</th>
                  <th scope="col" class="t-right">Preenchimento</th>
                  <th scope="col" class="t-right">Encontros realizados</th>
                  <th scope="col" class="t-right">Taxa de presença</th>
                </tr>
              </thead>
              <tbody>
                @for (row of rows(); track row.id) {
                  <tr [attr.data-activity]="row.id">
                    <th scope="row"><a [routerLink]="['/app/grupos', row.id]">{{ row.title }}</a></th>
                    <td>{{ row.kindText }}</td>
                    <td class="t-right t-num">{{ row.suppressed ? lessThan : row.holders }}</td>
                    <td class="t-right t-num">{{ row.capacity }}</td>
                    <td class="t-right t-num">{{ row.suppressed ? lessThan : percent(row.fill) }}</td>
                    <td class="t-right t-num">{{ row.doneMeetings }}</td>
                    <td class="t-right t-num">{{ row.suppressed ? lessThan : percent(row.presence) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }
    </div>
  `,
})
export class IndicatorsPageComponent {
  private readonly db = inject(Database);
  private readonly auth = inject(AuthService);
  private readonly svc = inject(GroupsService);

  protected readonly lessThan = 'menos de 5';
  protected readonly formatFill = (value: number): string => formatPercent(value, { decimals: 1 });

  /** Atividades que contam: nem rascunho nem cancelada. O psicólogo vê só as que conduz. */
  private readonly activities = computed(() => {
    const role = this.auth.role();
    return this.db.activities
      .all()
      .filter((a) => a.status !== 'draft' && a.status !== 'cancelled')
      .filter((a) => role !== 'psychologist' || this.svc.leads(a));
  });

  protected readonly rows = computed<IndicatorRow[]>(() => {
    const min = this.db.settings.value().minGroupSizeForAggregates;
    const partner = this.auth.role() === 'partner';
    return this.activities().map((a) => {
      const stats = this.svc.statsOf(a);
      const suppressed = partner && a.kind === 'group_therapy' && !aggregateCount(stats.holders, min).sufficient;
      return {
        id: a.id,
        title: a.title,
        kindText: KIND_LABELS[a.kind],
        holders: stats.holders,
        capacity: a.capacity,
        fill: stats.fillPercent,
        doneMeetings: stats.doneMeetings,
        presence: stats.presencePercent,
        suppressed,
      };
    });
  });

  protected readonly totals = computed(() => {
    const visible = this.activities().filter((a) => {
      const partner = this.auth.role() === 'partner';
      const min = this.db.settings.value().minGroupSizeForAggregates;
      return !(partner && a.kind === 'group_therapy' && !aggregateCount(this.svc.statsOf(a).holders, min).sufficient);
    });
    let holders = 0;
    let presences = 0;
    let possible = 0;
    let capacity = 0;
    visible.forEach((a) => {
      const s = this.svc.statsOf(a);
      holders += s.holders;
      presences += s.presences;
      possible += s.holders * s.doneMeetings;
      if (a.status === 'open' || a.status === 'full' || a.status === 'in_progress') {
        capacity += a.capacity;
      }
    });
    const openHolders = visible
      .filter((a) => a.status === 'open' || a.status === 'full' || a.status === 'in_progress')
      .reduce((sum, a) => sum + this.svc.statsOf(a).holders, 0);
    return { holders, presences, presence: percentOf(presences, possible, 1), fill: percentOf(openHolders, capacity, 1) };
  });

  protected readonly chartData = computed<BarDatum[]>(() =>
    this.rows().map((r) => ({ label: r.title, value: r.fill ?? 0, suppressed: r.suppressed })),
  );

  protected percent(value: number | null): string {
    return value === null ? 'n/d' : formatPercent(value, { decimals: 1 });
  }
}
