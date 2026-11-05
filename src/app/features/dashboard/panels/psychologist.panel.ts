import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatNumber, formatPercent, formatYearMonth } from '@core/format';
import { SessionModality, SessionStatus } from '@core/models';
import { BannerComponent } from '@shared/ui/overlay';
import {
  BadgeComponent,
  CardComponent,
  EmptyStateComponent,
  IconComponent,
  KpiStripComponent,
  OccupancyBarComponent,
  PageHeaderComponent,
} from '@shared/ui';
import { PanelKpiComponent } from '../components/panel-kpi.component';
import { DashboardStore, OccupancyLine } from '../state/dashboard.store';

const MODALITY: Record<SessionModality, string> = {
  online: 'On-line',
  in_person_coworking: 'Coworking',
  in_person_home: 'Domicílio',
};
const STATUS: Record<SessionStatus, { label: string; variant: 'success' | 'info' | 'attention' | 'neutral'; icon: 'circle-check' | 'clock' | 'circle-alert' }> = {
  done: { label: 'Realizada', variant: 'success', icon: 'circle-check' },
  confirmed: { label: 'Confirmada', variant: 'info', icon: 'circle-check' },
  scheduled: { label: 'Agendada', variant: 'neutral', icon: 'clock' },
  no_show: { label: 'Falta', variant: 'attention', icon: 'circle-alert' },
  cancelled_by_user: { label: 'Cancelada', variant: 'neutral', icon: 'clock' },
  cancelled_by_psychologist: { label: 'Cancelada', variant: 'neutral', icon: 'clock' },
};

/**
 * Painel do psicólogo (`psychologist`, SCR-M02-01): a agenda de hoje, a fila de acompanhamento dos SEUS casos (alertas e
 * aplicações da escala vencendo), as sessões a registrar, a ocupação do mês e as tarefas de revisar a rede de
 * apoio. Nomes em modo discreto (a tela pode estar compartilhada). O aviso de sobrecarga é acolhedor e só aparece
 * para quem passou de 80% por dois meses fechados (AC-M02-04).
 */
@Component({
  selector: 'app-psychologist-panel',
  imports: [
    RouterLink,
    BadgeComponent,
    BannerComponent,
    CardComponent,
    EmptyStateComponent,
    IconComponent,
    KpiStripComponent,
    OccupancyBarComponent,
    PageHeaderComponent,
    PanelKpiComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6" data-role="psychologist-panel">
      <app-page-header
        [title]="store.greeting()"
        description="A sua agenda de hoje e o que pede o seu cuidado."
      />

      @if (mine(); as line) {
        @if (line.overload) {
          <app-banner variant="attention" heading="A sua agenda passou de 80% por dois meses" data-role="overload">
            É um sinal para cuidar de quem cuida, não uma cobrança. A gestão e o responsável técnico podem
            redistribuir sessões.
            <a bannerActions class="btn btn--sm" routerLink="/app/atendimento">Ver a minha agenda</a>
          </app-banner>
        }
      }

      <app-kpi-strip>
        <app-panel-kpi
          label="Minha ocupação"
          [value]="occupancyText()"
          [context]="'em ' + closedMonth()"
          [tone]="mine()?.overload ? 'bad' : 'neutral'"
          link="/app/atendimento"
          [queryParams]="{ filtro: 'minha-ocupacao' }"
        />
        <app-panel-kpi
          label="Sessões a registrar"
          [value]="store.sessionsToRecord()"
          context="sem anotação assinada"
          link="/app/atendimento"
          [queryParams]="{ filtro: 'sem-anotacao' }"
        />
        <app-panel-kpi
          label="Revisar a rede de apoio"
          [value]="store.supportNetworkTasks()"
          context="tarefas dos alertas amarelos"
          link="/app/acompanhamento"
          [queryParams]="{ filtro: 'tarefas' }"
        />
      </app-kpi-strip>

      <div class="grid grid--2">
        <app-card title="Minha agenda de hoje" [subtitle]="store.todaySessions().length + (store.todaySessions().length === 1 ? ' sessão' : ' sessões')">
          @if (store.todaySessions().length === 0) {
            <app-empty-state compact title="Hoje não há sessões" text="Aproveite para abrir vagas ou revisar a fila de acompanhamento." />
          } @else {
            <div class="list-card" role="list" data-role="today">
              @for (item of store.todaySessions(); track item.session.id) {
                <a class="list-row" role="listitem" routerLink="/app/atendimento/agenda">
                    <span class="t-strong t-num">{{ item.time }}</span>
                    <span>
                      <span class="list-row__title discreet">{{ item.name }}</span>
                      <span class="list-row__meta">{{ modality(item.session.modality) }} · {{ item.session.kind === 'psychotherapy' ? 'Psicoterapia' : 'Orientação' }}</span>
                    </span>
                    <app-badge [variant]="status(item.session.status).variant" [icon]="status(item.session.status).icon">{{ status(item.session.status).label }}</app-badge>
                  </a>
              }
            </div>
          }
        </app-card>

        <app-card title="Minha fila de acompanhamento" [subtitle]="'Só os seus casos' + (hiddenCount() > 0 ? ' · ' + store.ownQueue().length + ' no total' : '')">
          @if (store.ownQueue().length === 0) {
            <app-empty-state compact title="Fila em dia" text="Quando um alerta abrir ou uma aplicação da escala estiver para vencer, o caso aparece aqui." />
          } @else {
            <div class="list-card" role="list" data-role="queue">
              @for (row of queue(); track row.key) {
                <a class="list-row" role="listitem" [routerLink]="row.link" [queryParams]="row.queryParams" [attr.data-kind]="row.kind">
                    <span><svg [appIcon]="row.kind === 'red' ? 'octagon-alert' : row.kind === 'yellow' ? 'triangle-alert' : 'clock'"></svg></span>
                    <span>
                      <span class="list-row__title discreet">{{ row.name }}</span>
                      <span class="list-row__meta list-row__meta--wrap">{{ row.text }}</span>
                    </span>
                    <svg appIcon="chevron-right"></svg>
                  </a>
              }
            </div>
            @if (hiddenCount() > 0) {
              <p class="t-caption" data-role="queue-more">
                E mais {{ hiddenCount() }} na fila, do mais urgente para o menos.
                <a routerLink="/app/acompanhamento">Abrir o acompanhamento</a>
              </p>
            }
          }
        </app-card>
      </div>

      <app-card title="Minha ocupação" subtitle="Último mês fechado e o mês corrente, parcial">
        <div class="stack stack--3" data-role="occupancy">
          @if (mine(); as line) {
            <app-occupancy-bar [name]="monthName(line.month)" [percent]="line.percent" />
          }
          <app-occupancy-bar [name]="monthName(current().month) + ' (parcial)'" [percent]="current().percent" />
          <p class="t-caption">
            Ocupação = horas realizadas ÷ horas disponibilizadas na agenda. O mês corrente é parcial e
            não conta para o alerta de sobrecarga.
          </p>
        </div>
      </app-card>
    </div>
  `,
})
export class PsychologistPanelComponent {
  protected readonly store = inject(DashboardStore);

  private static readonly QUEUE_LIMIT = 8;
  protected readonly queue = computed(() => this.store.ownQueue().slice(0, PsychologistPanelComponent.QUEUE_LIMIT));
  protected readonly hiddenCount = computed(() => Math.max(0, this.store.ownQueue().length - PsychologistPanelComponent.QUEUE_LIMIT));

  protected readonly mine = computed<OccupancyLine | undefined>(() => this.store.occupancy()[0]);
  protected readonly current = this.store.ownCurrentMonth;
  protected readonly closedMonth = computed(() => this.monthName(this.mine()?.month ?? ''));
  protected readonly occupancyText = computed(() => {
    const p = this.mine()?.percent;
    return p === null || p === undefined ? 'n/d' : formatPercent(p, { decimals: 1 });
  });

  protected modality(value: SessionModality): string {
    return MODALITY[value];
  }

  protected status(value: SessionStatus): (typeof STATUS)[SessionStatus] {
    return STATUS[value];
  }

  protected monthName(month: string): string {
    return month ? formatYearMonth(month) : '';
  }

  protected number(value: number): string {
    return formatNumber(value);
  }
}
