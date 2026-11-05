import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/auth';
import { formatDate } from '@core/format';
import {
  OCCURRENCE_KIND_LABELS,
  POP_STATE_LABELS,
  occurrenceClosureStatus,
} from '@core/rules/governance-access';
import {
  BadgeComponent,
  CardComponent,
  EmptyStateComponent,
  IconComponent,
  KpiComponent,
  KpiStripComponent,
  PageHeaderComponent,
} from '@shared/ui';
import { Database } from '@core/data';
import { GovernanceTabsComponent } from '../components/governance-tabs.component';
import { GovernanceService } from '../state/governance.service';

/**
 * Visão geral da Governança (`/app/governanca`): o que pede atenção em POPs, riscos, ocorrências e conteúdos.
 * Cada item leva à tela certa. A gestão vê só a contagem das ocorrências; o atendimento não vê ocorrências.
 */
@Component({
  selector: 'app-governance-overview-page',
  imports: [
    RouterLink,
    BadgeComponent,
    CardComponent,
    EmptyStateComponent,
    IconComponent,
    KpiComponent,
    KpiStripComponent,
    PageHeaderComponent,
    GovernanceTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      <app-page-header
        title="Governança"
        description="Procedimentos, riscos, encaminhamentos e formação: o cuidado com quem cuida, por escrito e em dia."
      />
      <app-governance-tabs />

      <app-kpi-strip>
        <app-kpi
          label="POPs a revisar"
          [value]="svc.summary().popsToReview"
          [context]="'de ' + svc.pops().length + ' procedimentos'"
          link="/app/governanca/pops"
        />
        <app-kpi
          label="Riscos prioritários"
          [value]="svc.summary().priorityRisks"
          [context]="'de ' + svc.risks().length + ' riscos (criticidade 12 ou mais)'"
          link="/app/governanca/riscos"
        />
        @if (showOccurrences()) {
          <app-kpi
            label="Ocorrências em aberto"
            [value]="openOccurrences()"
            [context]="occurrenceContext()"
            link="/app/governanca/ocorrencias"
          />
        }
        <app-kpi
          label="Conteúdos em revisão"
          [value]="svc.summary().contentsInReview"
          context="aguardam o responsável técnico"
          link="/app/governanca/conteudos"
        />
      </app-kpi-strip>

      <div class="grid grid--2">
        <app-card title="POPs que pedem revisão" subtitle="Revistos a cada 12 meses ou depois de um incidente">
          @if (dueList().length === 0) {
            <app-empty-state compact title="Todos os POPs estão em dia" text="Quando um POP passar de 12 meses sem revisão, ele aparece aqui." />
          } @else {
            <div class="list-card" role="list" data-role="due-pops">
              @for (item of dueList(); track item.pop.code) {
                <a class="list-row" role="listitem" [routerLink]="['/app/governanca/pops', item.pop.code]">
                    <span><svg appIcon="book-open"></svg></span>
                    <span>
                      <span class="list-row__title">{{ item.pop.code }} · {{ item.pop.title }}</span>
                      <span class="list-row__meta">Última revisão em {{ date(item.pop.lastReviewedAt) }}</span>
                    </span>
                    <app-badge [variant]="item.state === 'revision_triggered' ? 'danger' : 'attention'" icon="clock">{{ stateLabel(item.state) }}</app-badge>
                  </a>
              }
            </div>
          }
        </app-card>

        <app-card title="Riscos de maior criticidade" subtitle="Probabilidade x impacto">
          <div class="list-card" role="list" data-role="top-risks">
            @for (row of topRisks(); track row.risk.code) {
              <a class="list-row" role="listitem" [routerLink]="['/app/governanca/riscos', row.risk.code]">
                  <span class="t-strong t-num">{{ row.risk.code }}</span>
                  <span>
                    <span class="list-row__title">{{ row.risk.title }}</span>
                    <span class="list-row__meta">{{ row.risk.category }}</span>
                  </span>
                  <app-badge variant="danger" icon="triangle-alert">C {{ row.criticality }}</app-badge>
                </a>
            }
          </div>
        </app-card>
      </div>

      @if (showOccurrences()) {
        <app-card title="Ocorrências" subtitle="Acesso restrito ao responsável técnico e ao psicólogo do caso">
          @if (auth.role() === 'partner') {
            <p class="t-ui" data-role="counts-only">
              Por privacidade, a gestão vê só as contagens: {{ svc.occurrenceCounts().pop05 }} de situação de risco
              (POP-05) e {{ svc.occurrenceCounts().pop07 }} de suspeita de violência (POP-07).
            </p>
          } @else if (svc.occurrences().length === 0) {
            <app-empty-state compact title="Nenhuma ocorrência para você" text="Quando houver uma situação de risco nos seus casos, ela aparece aqui." />
          } @else {
            <div class="list-card" role="list" data-role="occurrence-list">
              @for (o of svc.occurrences(); track o.id) {
                <a class="list-row" role="listitem" [routerLink]="['/app/governanca/ocorrencias', o.id]">
                    <span><svg appIcon="file-lock"></svg></span>
                    <span>
                      <span class="list-row__title">{{ kindLabel(o.kind) }}</span>
                      <span class="list-row__meta">{{ caregiverCode(o.caregiverId) }} · aberta em {{ date(o.openedAt) }}</span>
                    </span>
                    <app-badge [variant]="o.status === 'closed' ? 'success' : 'attention'" dot>{{ pending(o) }}</app-badge>
                  </a>
              }
            </div>
          }
        </app-card>
      }

      <p class="t-caption" data-role="norms-note">
        {{ unconfirmedNorms() }} das {{ svc.norms().length }} normas citadas ainda estão sem a data de
        "vigência confirmada em".
        <a routerLink="/app/governanca/normas">Ver normas</a>
      </p>
    </div>
  `,
})
export class GovernanceOverviewPageComponent {
  protected readonly svc = inject(GovernanceService);
  protected readonly auth = inject(AuthService);
  private readonly db = inject(Database);

  protected readonly showOccurrences = computed(
    () => this.auth.can('occurrences', 'view') || this.auth.can('occurrences', 'view_aggregate'),
  );
  protected readonly dueList = computed(() =>
    this.svc.pops().filter((p) => p.state === 'due' || p.state === 'revision_triggered'),
  );
  protected readonly topRisks = computed(() => this.svc.risks().slice(0, 3));
  protected readonly openOccurrences = computed(() =>
    this.auth.role() === 'partner'
      ? this.svc.occurrenceCounts().open
      : this.svc.occurrences().filter((o) => o.status !== 'closed').length,
  );
  protected readonly occurrenceContext = computed(() =>
    this.auth.role() === 'partner' ? 'só a contagem, sem os casos' : 'nos seus casos',
  );
  protected readonly unconfirmedNorms = computed(
    () => this.svc.norms().filter((n) => !n.confirmedInForceAt).length,
  );

  protected date(value: string): string {
    return formatDate(value);
  }

  protected stateLabel(state: 'up_to_date' | 'due' | 'revision_triggered'): string {
    return POP_STATE_LABELS[state];
  }

  protected kindLabel(kind: 'pop05_risk' | 'pop07_violence_suspicion'): string {
    return OCCURRENCE_KIND_LABELS[kind];
  }

  protected caregiverCode(id: string): string {
    return this.db.caregivers.get(id)?.code ?? 'CUI-0000';
  }

  protected pending(o: Parameters<typeof occurrenceClosureStatus>[0] & { status: string }): string {
    if (o.status === 'closed') {
      return 'Encerrada';
    }
    const check = occurrenceClosureStatus(o);
    return check.pendingSteps.length > 0
      ? `${check.pendingSteps.length} ${check.pendingSteps.length === 1 ? 'passo pendente' : 'passos pendentes'}`
      : 'Falta comunicar';
  }
}
