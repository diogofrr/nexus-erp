import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatYearMonth } from '@core/format';
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
import { AlertQueueRow, DashboardStore } from '../state/dashboard.store';

const QUEUE_FILTER: Record<AlertQueueRow['state'], string> = {
  overdue: 'contato-vencido',
  today: 'contato-hoje',
  open: 'em-andamento',
  contacted: 'em-andamento',
  task: 'tarefas',
};

/**
 * Painel do responsável técnico (`technical_lead`, SCR-M02-01): começa pelo que vence hoje (alerta vermelho do dia
 * sem contato e vermelho vencido), depois os números dos casos, a fila de alertas de todos os casos e as
 * validações pendentes. A fila mostra só código, nível e situação do prazo: nome e escore ficam na tela do caso,
 * onde a supervisão pede justificativa e vai ao log. AC-M02-02.
 */
@Component({
  selector: 'app-technical-lead-panel',
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
    <div class="page stack stack--6" data-role="technical-lead-panel">
      <app-page-header
        [title]="store.greeting()"
        description="O que vence hoje vem primeiro. Cada item leva à tela do caso."
      />

      @if (counts().redToday > 0) {
        <app-banner variant="danger" [heading]="redTodayTitle()" data-role="red-today">
          O contato da equipe precisa acontecer até 23:59 de hoje.
          <a bannerActions class="btn btn--sm" routerLink="/app/acompanhamento" [queryParams]="{ filtro: 'contato-hoje' }">Ver os alertas do dia</a>
        </app-banner>
      }
      @if (counts().redOverdue > 0) {
        <app-banner variant="danger" [heading]="redOverdueTitle()" data-role="red-overdue">
          O prazo passou sem contato e o caso foi escalado a você.
          <a bannerActions class="btn btn--sm" routerLink="/app/acompanhamento" [queryParams]="{ filtro: 'contato-vencido' }">Ver os vencidos</a>
        </app-banner>
      }

      <app-kpi-strip>
        <app-panel-kpi
          label="Alertas vermelhos abertos"
          [value]="counts().redOpen"
          context="não encerrados"
          link="/app/acompanhamento"
          [queryParams]="{ filtro: 'em-andamento' }"
        />
        <app-panel-kpi
          label="Alertas amarelos abertos"
          [value]="counts().yellowOpen"
          [context]="counts().yellowNotClosed + ' em acompanhamento no total'"
          link="/app/acompanhamento"
          [queryParams]="{ filtro: 'alertas-a-confirmar' }"
        />
        <app-panel-kpi
          label="ARBE críticos"
          [value]="counts().arbeCritical"
          [context]="counts().arbeAttention + ' de atenção'"
          link="/app/acompanhamento"
        />
        <app-panel-kpi
          label="Ocorrências em aberto"
          [value]="counts().pop05 + counts().pop07"
          [context]="'POP-05: ' + counts().pop05 + ' · POP-07: ' + counts().pop07"
          link="/app/governanca/ocorrencias"
        />
      </app-kpi-strip>

      <div class="layout-main-aside">
        <app-card title="Fila de alertas" subtitle="Todos os casos, só por código">
          @if (queue().length === 0) {
            <app-empty-state compact title="Nenhum alerta aberto por aqui" text="Quando uma aplicação da escala indicar atenção, o caso aparece nesta fila." />
          } @else {
            <div class="list-card" role="list" data-role="alert-queue">
              @for (row of queue(); track row.id) {
                <a class="list-row" role="listitem" routerLink="/app/acompanhamento" [queryParams]="{ filtro: filter(row) }" [attr.data-state]="row.state">
                    <span class="code-chip"><svg appIcon="shield-check"></svg>{{ row.code }}</span>
                    <span>
                      <span class="list-row__title">{{ row.level === 'red' ? 'Alerta vermelho' : 'Alerta amarelo' }}</span>
                      <span class="list-row__meta">{{ row.label }}</span>
                    </span>
                    <app-badge
                      [variant]="row.state === 'overdue' ? 'danger' : row.level === 'red' ? 'attention' : 'neutral'"
                      [icon]="row.state === 'overdue' ? 'octagon-alert' : row.level === 'red' ? 'clock' : 'triangle-alert'"
                      >{{ row.state === 'overdue' ? 'Vencido' : row.state === 'today' ? 'Hoje' : row.level === 'red' ? 'Aberto' : 'Amarelo' }}</app-badge
                    >
                  </a>
              }
            </div>
            @if (hiddenCount() > 0) {
              <p class="t-caption">E mais {{ hiddenCount() }} na fila de acompanhamento.</p>
            }
          }
        </app-card>

        <aside class="stack stack--6" aria-label="Validações e equipe">
          <app-card title="Validações pendentes" variant="sunken">
            <ul class="stack stack--3" data-role="validations">
              <li>
                <a routerLink="/app/governanca/conteudos">
                  {{ store.governance().contentsInReview }}
                  {{ store.governance().contentsInReview === 1 ? 'conteúdo aguarda' : 'conteúdos aguardam' }} a sua revisão (POP-09)
                </a>
              </li>
              <li>
                <a routerLink="/app/governanca/pops" [queryParams]="{ filtro: 'a-revisar' }">
                  {{ store.governance().popsToReview }} {{ store.governance().popsToReview === 1 ? 'POP a revisar' : 'POPs a revisar' }}
                </a>
              </li>
              <li>
                <a routerLink="/app/governanca/riscos">
                  {{ store.governance().priorityRisks }} riscos prioritários no registro
                </a>
              </li>
            </ul>
          </app-card>

          <app-card title="Ocupação da equipe" [subtitle]="'Em ' + monthName(store.occupancy()[0]?.month ?? '')" variant="sunken">
            <div class="stack stack--3" data-role="team">
              @for (line of store.occupancy(); track line.psychologistId) {
                <app-occupancy-bar [name]="line.name" [percent]="line.percent" />
              }
              <div><a class="btn btn--sm" routerLink="/app/indicadores" [queryParams]="{ aba: 'equipe' }">Ver a equipe</a></div>
            </div>
          </app-card>
        </aside>
      </div>
    </div>
  `,
})
export class TechnicalLeadPanelComponent {
  protected readonly store = inject(DashboardStore);
  protected readonly counts = this.store.rtCounts;

  private static readonly LIMIT = 8;
  protected readonly queue = computed(() => this.store.alertQueue().slice(0, TechnicalLeadPanelComponent.LIMIT));
  protected readonly hiddenCount = computed(() => Math.max(0, this.store.alertQueue().length - TechnicalLeadPanelComponent.LIMIT));

  protected readonly redTodayTitle = computed(() => {
    const n = this.counts().redToday;
    return `${n} ${n === 1 ? 'alerta vermelho do dia sem contato' : 'alertas vermelhos do dia sem contato'}`;
  });
  protected readonly redOverdueTitle = computed(() => {
    const n = this.counts().redOverdue;
    return `${n} ${n === 1 ? 'alerta vermelho vencido' : 'alertas vermelhos vencidos'}`;
  });

  protected filter(row: AlertQueueRow): string {
    return QUEUE_FILTER[row.state];
  }

  protected monthName(month: string): string {
    return month ? formatYearMonth(month) : '';
  }
}
