import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Database } from '@core/data';
import { formatNumber, formatPercent, formatYearMonth } from '@core/format';
import { NetworkService } from '@core/network';
import { BadgeComponent, CellDirective, DataTableComponent, PageHeaderComponent, TableColumn } from '@shared/ui';
import { RefusalComponent } from '../components/badges.component';
import { categoryLabel } from '../state/network-labels';
import { Clock, addMonthsToYearMonth, yearMonthOf } from '@core/clock';
import { RefusalStats } from '@core/rules';

interface RefusalRow {
  id: string;
  name: string;
  category: string;
  refusal: RefusalStats;
  percent: number;
}

interface AvailabilityRow {
  id: string;
  name: string;
  current: number;
  previousText: string;
  dropText: string;
  signal: boolean;
}

interface FlowRow {
  id: string;
  monthText: string;
  entries: number;
  exits: number;
}

/**
 * Sinais da rede (SCR-M08-10, RN-REDE-27 a 29 e 33): taxa de recusa dos últimos 30 dias, queda de
 * disponibilidade sobre a média das 4 semanas anteriores e entradas e saídas de prestadores por mês. Os
 * sinais ajudam a antecipar a saída de prestadores e a planejar novas parcerias; nenhum deles descredencia sozinho.
 */
@Component({
  selector: 'app-network-signals-page',
  imports: [RouterLink, BadgeComponent, CellDirective, DataTableComponent, PageHeaderComponent, RefusalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header
        title="Sinais da rede"
        description="Recusa, disponibilidade e movimento de prestadores. Servem para agir antes de alguém sair."
      />
      <div class="stack stack--6">
        <section class="stack stack--3" aria-labelledby="nx-refusal-title" data-role="refusal-signal">
          <h2 class="card__title" id="nx-refusal-title">Taxa de recusa em 30 dias</h2>
          <p class="t-caption">
            Pedidos recusados ou cancelados pelo prestador sobre os recebidos. O selo aparece a partir de
            {{ threshold().percent }}% com no mínimo {{ threshold().min }} pedidos.
          </p>
          <app-data-table
            caption="Taxa de recusa dos prestadores"
            noun="prestadores"
            [rows]="refusalRows()"
            [columns]="refusalColumns"
            [stack]="true"
            emptyTitle="Nenhum prestador na busca"
            emptyText="Quando houver prestadores ativos ou em monitoramento, a taxa de recusa aparece aqui."
          >
            <ng-template appCell="name" let-row>
              <a class="row-link" [routerLink]="['/app/rede/prestadores', row.id]">{{ row.name }}</a>
            </ng-template>
            <ng-template appCell="refusal" let-row><app-refusal [stats]="row.refusal" /></ng-template>
          </app-data-table>
        </section>

        <section class="stack stack--3" aria-labelledby="nx-availability-title" data-role="availability-signal">
          <h2 class="card__title" id="nx-availability-title">Disponibilidade na semana</h2>
          <p class="t-caption">
            Sinal quando a semana atual fica mais de 50% abaixo da média das 4 semanas anteriores.
          </p>
          <app-data-table
            caption="Disponibilidade semanal dos prestadores"
            noun="prestadores"
            [rows]="availabilityRows()"
            [columns]="availabilityColumns"
            emptyTitle="Nenhum horário registrado"
            emptyText="Quando a gestão registrar os horários da semana de um prestador, a comparação aparece aqui."
          >
            <ng-template appCell="name" let-row>
              <a class="row-link" [routerLink]="['/app/rede/prestadores', row.id]">{{ row.name }}</a>
            </ng-template>
            <ng-template appCell="signal" let-row>
              @if (row.signal) {
                <app-badge variant="attention" icon="triangle-alert">Queda de disponibilidade</app-badge>
              } @else {
                <span class="t-muted">Dentro do esperado</span>
              }
            </ng-template>
          </app-data-table>
        </section>

        <section class="stack stack--3" aria-labelledby="nx-flow-title" data-role="flow-signal">
          <h2 class="card__title" id="nx-flow-title">Entradas e saídas por mês</h2>
          <p class="t-caption">
            Entrada é a ativação do prestador na rede. Saída é o descredenciamento confirmado.
          </p>
          <app-data-table
            caption="Entradas e saídas de prestadores por mês"
            noun="meses"
            [rows]="flowRows()"
            [columns]="flowColumns"
            [stack]="false"
            emptyTitle="Nenhum movimento"
            emptyText="Quando um prestador entrar ou sair da rede, o mês aparece aqui."
          />
        </section>
      </div>
    </div>
  `,
})
export class SignalsPage {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly network = inject(NetworkService);

  protected readonly threshold = computed(() => {
    const settings = this.db.settings.get();
    return { percent: settings.refusalRateThresholdPercent, min: settings.refusalRateMinRequests };
  });

  protected readonly refusalColumns: TableColumn<RefusalRow>[] = [
    { key: 'name', header: 'Prestador', primary: true, sortable: true, value: (r) => r.name },
    { key: 'category', header: 'Categoria', muted: true },
    { key: 'refusal', header: 'Recusa em 30 dias', sortable: true, noSearch: true, sortValue: (r) => r.percent },
  ];

  protected readonly availabilityColumns: TableColumn<AvailabilityRow>[] = [
    { key: 'name', header: 'Prestador', primary: true, sortable: true, value: (r) => r.name },
    { key: 'current', header: 'Esta semana', align: 'end', sortable: true, noSearch: true },
    { key: 'previousText', header: 'Média das 4 anteriores', align: 'end', noSearch: true },
    { key: 'dropText', header: 'Variação', align: 'end', noSearch: true },
    { key: 'signal', header: 'Sinal', noSearch: true },
  ];

  protected readonly flowColumns: TableColumn<FlowRow>[] = [
    { key: 'monthText', header: 'Mês', primary: true },
    { key: 'entries', header: 'Entradas', align: 'end' },
    { key: 'exits', header: 'Saídas', align: 'end' },
  ];

  private readonly inOperation = computed(() =>
    this.network
      .summaries()
      .filter((s) => s.provider.status === 'active' || s.provider.status === 'monitoring'),
  );

  protected readonly refusalRows = computed<RefusalRow[]>(() =>
    this.inOperation()
      .map((s) => ({
        id: s.provider.id,
        name: s.provider.name,
        category: categoryLabel(s.provider.category),
        refusal: s.refusal,
        percent: s.refusal.percent ?? -1,
      }))
      .sort((a, b) => b.percent - a.percent || a.name.localeCompare(b.name, 'pt-BR')),
  );

  protected readonly availabilityRows = computed<AvailabilityRow[]>(() =>
    this.inOperation()
      .filter((s) => s.availability.current !== null)
      .map((s) => {
        const a = s.availability;
        return {
          id: s.provider.id,
          name: s.provider.name,
          current: a.current ?? 0,
          previousText: a.previousAverage === null ? 'Sem histórico' : formatNumber(a.previousAverage, 1),
          dropText:
            a.dropPercent === null
              ? 'Sem comparação'
              : a.dropPercent > 0
                ? `Queda de ${formatPercent(a.dropPercent, { decimals: 1 })}`
                : 'Sem queda',
          signal: a.signal,
        };
      })
      .sort((a, b) => Number(b.signal) - Number(a.signal) || a.name.localeCompare(b.name, 'pt-BR')),
  );

  protected readonly flowRows = computed<FlowRow[]>(() => {
    const events = this.db.providerStatusEvents.all();
    const current = yearMonthOf(this.clock.today());
    const months = Array.from({ length: 6 }, (_, i) => addMonthsToYearMonth(current, i - 5));
    return months
      .map((month) => {
        const inMonth = events.filter((e) => e.createdAt.slice(0, 7) === month && e.from !== e.to);
        return {
          id: month,
          monthText: formatYearMonth(month),
          entries: inMonth.filter((e) => e.to === 'active' && (e.from === null || e.from === 'candidate')).length,
          exits: inMonth.filter((e) => e.to === 'deaccredited').length,
        };
      })
      .reverse();
  });
}
