import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  CardComponent,
  DeadlineBadgeComponent,
  EmptyStateComponent,
  IconComponent,
  KpiStripComponent,
  PageHeaderComponent,
} from '@shared/ui';
import { PanelKpiComponent } from '../components/panel-kpi.component';
import { DashboardStore, MessageRow } from '../state/dashboard.store';

/**
 * Painel do atendimento (`support`, SCR-M02-01): a fila de mensagens por prazo, com as atrasadas primeiro e o
 * tempo de atraso à vista (AC-M02-05), mais reclamações abertas, solicitações de serviço sem retorno,
 * solicitações do titular a registrar, cadastros novos e cancelamentos agendados. NENHUM dado clínico: nem
 * escore, nem faixa, nem alerta, nem "existe alerta" (escopo 1.3). Nomes em modo discreto.
 */
@Component({
  selector: 'app-support-panel',
  imports: [
    RouterLink,
    CardComponent,
    DeadlineBadgeComponent,
    EmptyStateComponent,
    IconComponent,
    KpiStripComponent,
    PageHeaderComponent,
    PanelKpiComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6" data-role="support-panel">
      <app-page-header
        [title]="store.greeting()"
        description="As mensagens com prazo primeiro, depois o que está esperando por você."
      >
        <a class="btn btn--primary" routerLink="/app/mensagens">Abrir a caixa de mensagens</a>
      </app-page-header>

      <app-card title="Mensagens por prazo" [subtitle]="subtitle()">
        @if (store.messageQueue().length === 0) {
          <app-empty-state compact title="Caixa em dia" text="Todas as mensagens foram respondidas dentro do prazo." />
        } @else {
          <div class="stack stack--3">
            @if (overdue().length > 0) {
              <section class="stack stack--2" aria-labelledby="late-title" data-role="overdue">
                <h3 id="late-title" class="t-strong">Atrasadas ({{ overdue().length }})</h3>
                <div class="list-card" role="list">
                  @for (row of overdue(); track row.id) {
                    <a class="list-row" role="listitem" routerLink="/app/mensagens" [queryParams]="{ filtro: 'atrasadas' }">
                        <span><svg appIcon="message-circle"></svg></span>
                        <span>
                          <span class="list-row__title discreet">{{ row.name }}</span>
                          <span class="list-row__meta">{{ store.channelLabel(row.channel) }}</span>
                        </span>
                        <app-deadline-badge [due]="row.dueAt" />
                      </a>
                  }
                </div>
              </section>
            }
            @if (onTime().length > 0) {
              <section class="stack stack--2" aria-labelledby="ontime-title" data-role="on-time">
                <h3 id="ontime-title" class="t-strong">No prazo</h3>
                <div class="list-card" role="list">
                  @for (row of onTime(); track row.id) {
                    <a class="list-row" role="listitem" routerLink="/app/mensagens">
                        <span><svg appIcon="message-circle"></svg></span>
                        <span>
                          <span class="list-row__title discreet">{{ row.name }}</span>
                          <span class="list-row__meta">{{ store.channelLabel(row.channel) }}</span>
                        </span>
                        <app-deadline-badge [due]="row.dueAt" />
                      </a>
                  }
                </div>
              </section>
            }
          </div>
        }
      </app-card>

      <app-kpi-strip>
        <app-panel-kpi label="Reclamações abertas" [value]="store.complaints().open" [context]="store.complaints().overdue + ' vencidas'" link="/app/reclamacoes" />
        <app-panel-kpi label="Solicitações de serviço sem retorno" [value]="store.serviceRequestsWithoutReply()" link="/app/rede/solicitacoes" />
        <app-panel-kpi label="Solicitações do titular a registrar" [value]="store.dsr().open" [context]="store.dsr().dueSoon + store.dsr().overdue + ' perto do prazo'" link="/app/lgpd/solicitacoes" />
      </app-kpi-strip>
      <app-kpi-strip>
        <app-panel-kpi label="Cadastros novos" [value]="store.newRegistrations()" context="nos últimos 7 dias" link="/app/cuidadores" />
        <app-panel-kpi label="Cancelamentos agendados" [value]="store.scheduledCancellations()" link="/app/assinaturas" [queryParams]="{ filtro: 'cancelamento-agendado' }" />
      </app-kpi-strip>
    </div>
  `,
})
export class SupportPanelComponent {
  protected readonly store = inject(DashboardStore);

  protected readonly overdue = computed<MessageRow[]>(() => this.store.messageQueue().filter((m) => m.overdue));
  protected readonly onTime = computed<MessageRow[]>(() =>
    this.store
      .messageQueue()
      .filter((m) => !m.overdue)
      .slice(0, 6),
  );
  protected readonly subtitle = computed(() => {
    const n = this.overdue().length;
    return n === 0 ? 'Nenhuma atrasada' : `${n} ${n === 1 ? 'atrasada' : 'atrasadas'}, as mais atrasadas primeiro`;
  });
}
