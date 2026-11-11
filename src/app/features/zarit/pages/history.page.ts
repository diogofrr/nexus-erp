import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuditLogService } from '@core/audit';
import { SupervisionWindowService } from '@core/audit/supervision-window.service';
import { Clock } from '@core/clock';
import { Database } from '@core/data';
import { formatDate, formatDateTime } from '@core/format';
import { ConsentService } from '@core/privacy/consent.service';
import { zaritAssessmentState, zaritBandInfo, zaritConductFor, zaritDaysToDue } from '@core/rules';
import {
  BadgeComponent,
  EmptyStateComponent,
  FormFieldComponent,
  IconComponent,
  NxInputDirective,
  PageHeaderComponent,
  PlanBadgeComponent,
  TimelineComponent,
  TimelineItem,
  ZaritBandBadgeComponent,
} from '@shared/ui';
import { LineChartComponent, LinePoint } from '@shared/ui/charts';
import { SupervisionGateComponent } from '@shared/ui/access/supervision-gate.component';
import { PageContextService, ToastService } from '@shared/ui/overlay';
import { valueOf } from '@shared/ui/util/form-events';
import { planIdOfCaregiver } from '@core/data/plan-lookup';
import { ZaritAccessService } from '../state/zarit-access.service';
import { ARBE_LEVEL_VIEW, ARBE_STATUS_LABELS, ALERT_STATUS_LABELS } from '../state/zarit-labels';
import { ZaritService } from '../state/zarit.service';

/**
 * SCR-M06-04, Histórico do cuidador: linha do tempo de pontuações e faixas, evolução (%), próxima aplicação,
 * alertas e pedidos de revisão. Sem consentimento de saúde a tela só explica o estado, sem mostrar o histórico.
 * O responsável técnico abre pelo portão de supervisão. Aplicação assinada é imutável: correção só por adendo.
 */
@Component({
  selector: 'app-zarit-history-page',
  imports: [
    BadgeComponent,
    EmptyStateComponent,
    FormFieldComponent,
    IconComponent,
    LineChartComponent,
    NxInputDirective,
    PageHeaderComponent,
    PlanBadgeComponent,
    RouterLink,
    SupervisionGateComponent,
    TimelineComponent,
    ZaritBandBadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      <app-page-header title="Histórico do cuidador" [description]="subtitle()">
        @if (canApply()) {
          <a class="btn btn--primary" [routerLink]="['/app/acompanhamento/zarit', caregiver()?.id, 'nova']" data-role="apply">
            <svg appIcon="heart-pulse" size="sm"></svg>Aplicar a escala
          </a>
        }
        <a class="btn" routerLink="/app/acompanhamento/fila">Voltar à fila</a>
      </app-page-header>

      @if (!caregiver()) {
        <app-empty-state title="Cuidador não encontrado" text="Volte à fila e escolha o cuidador de novo.">
          <a class="btn btn--primary" routerLink="/app/acompanhamento/fila">Voltar à fila</a>
        </app-empty-state>
      } @else if (gated()) {
        <app-supervision-gate
          entity="zarit_history"
          [entityId]="caregiver()?.id ?? ''"
          [caregiverId]="caregiver()?.id ?? ''"
          (granted)="unlocked.set(true)"
        />
      } @else if (!consentOk()) {
        <app-empty-state
          kind="forbidden"
          title="Sem consentimento de dados de saúde"
          text="A aplicação da escala está pausada. O atendimento pode registrar o consentimento. O registro do que já foi feito é guardado, mas não é mostrado enquanto o consentimento estiver revogado."
          data-role="no-consent"
        >
          <a class="btn btn--primary" [routerLink]="['/app/cuidadores', caregiver()?.id]" [queryParams]="{ aba: 'consentimentos' }">Ver consentimentos do cuidador</a>
        </app-empty-state>
      } @else {
        <div class="cluster">
          <app-badge variant="info" icon="lock">Dado sensível · cifrado em repouso (simulado)</app-badge>
          <app-plan-badge [plan]="planId()" />
        </div>

        <section class="grid grid--3 grid--gap-6" aria-label="Resumo">
          <div class="card card--pad stack stack--2">
            <h2 class="card__title">Última pontuação</h2>
            @if (last(); as l) {
              <app-zarit-band-badge [score]="l.total" large />
              <p class="t-caption">Aplicada em {{ date(l.appliedAt) }}</p>
            } @else {
              <p class="t-muted">Ainda sem aplicação concluída.</p>
            }
          </div>
          <div class="card card--pad stack stack--2" data-role="evolution">
            <h2 class="card__title">Evolução desde a adesão</h2>
            <p class="t-strong">{{ evolutionText() }}</p>
          </div>
          <div class="card card--pad stack stack--2" data-role="next-due">
            <h2 class="card__title">Próxima aplicação</h2>
            <p class="t-strong">{{ nextDueText() }}</p>
            @if (nextDueState(); as s) {
              <app-badge [variant]="s.variant" [icon]="s.icon">{{ s.label }}</app-badge>
            }
          </div>
        </section>

        @if (points().length > 0) {
          <section class="card card--pad stack stack--3" aria-labelledby="hist-chart">
            <h2 id="hist-chart" class="card__title">Pontuação ao longo do tempo</h2>
            <app-line-chart
              [points]="points()"
              [referenceLine]="{ value: 41, label: 'A faixa amarela começa em 41' }"
              ariaLabel="Pontuação da escala em cada aplicação"
              primaryLabel="Pontuação"
              valueHeader="Pontuação"
              categoryHeader="Aplicação"
              [yMin]="0"
              [yMax]="88"
            />
          </section>
        }

        <section class="stack stack--3" aria-labelledby="hist-list">
          <h2 id="hist-list" class="card__title">Aplicações</h2>
          @for (row of assessments(); track row.id) {
            <article class="card card--pad stack stack--3" [attr.data-assessment]="row.id">
              <div class="cluster cluster--between">
                <div class="cluster">
                  <strong>{{ row.kindText }}</strong>
                  <span class="t-caption">{{ date(row.appliedAt) }}</span>
                  <app-zarit-band-badge [score]="row.total" />
                </div>
                <div class="cluster">
                  <app-badge outline icon="lock">Assinada, não pode ser editada</app-badge>
                  <a class="btn btn--sm" [routerLink]="['/app/acompanhamento/zarit', row.caregiverId, 'resultado', row.id]">Ver resultado</a>
                </div>
              </div>
              <p class="t-ui">{{ row.conduct }}</p>
              @if (row.addenda.length > 0) {
                <app-timeline label="Adendos da aplicação" [items]="row.addenda" />
              }
              @if (canApply()) {
                @if (addendumFor() === row.id) {
                  <app-form-field label="Adendo à aplicação" [controlId]="'addendum-' + row.id" [error]="addendumError()">
                    <textarea appInput rows="3" [value]="addendum()" (input)="addendum.set(valueOf($event))" data-role="addendum-text"></textarea>
                  </app-form-field>
                  <div class="cluster">
                    <button type="button" class="btn btn--sm btn--primary" (click)="saveAddendum(row.id)" data-role="addendum-save">Adicionar adendo</button>
                    <button type="button" class="btn btn--sm" (click)="addendumFor.set(null)">Voltar</button>
                  </div>
                } @else {
                  <div>
                    <button type="button" class="btn btn--sm" (click)="openAddendum(row.id)" data-role="addendum-open">Adicionar adendo</button>
                  </div>
                }
              }
            </article>
          } @empty {
            <app-empty-state title="Nenhuma aplicação concluída" text="Quando a escala for aplicada, o resultado aparece aqui, com a evolução.">
              @if (canApply()) {
                <a class="btn btn--primary" [routerLink]="['/app/acompanhamento/zarit', caregiver()?.id, 'nova']">Aplicar a escala</a>
              }
            </app-empty-state>
          }
        </section>

        <section class="card card--pad stack stack--3" aria-labelledby="hist-alerts">
          <h2 id="hist-alerts" class="card__title">Alertas</h2>
          @for (a of alerts(); track a.id) {
            <div class="cluster cluster--between" [attr.data-alert]="a.id">
              <span class="cluster">
                <app-badge [variant]="a.level === 'red' ? 'danger' : 'attention'" [icon]="a.level === 'red' ? 'octagon-alert' : 'triangle-alert'">
                  Alerta {{ a.level === 'red' ? 'vermelho' : 'amarelo' }}
                </app-badge>
                <span class="t-ui">{{ statusText(a.id) }}</span>
                <span class="t-caption">{{ dateTime(a.createdAt) }}</span>
              </span>
              <a class="btn btn--sm" [routerLink]="['/app/acompanhamento/alertas', a.id]">Abrir</a>
            </div>
          } @empty {
            <p class="t-muted t-ui">Nenhum alerta até aqui.</p>
          }
          @for (a of arbe(); track a.id) {
            <div class="cluster cluster--between">
              <span class="cluster">
                <app-badge [variant]="levelView(a.level).variant" [icon]="levelView(a.level).icon">Esgotamento: {{ levelView(a.level).label.toLowerCase() }}</app-badge>
                <span class="t-ui">{{ arbeStatus(a.status) }}</span>
              </span>
              <a class="btn btn--sm" routerLink="/app/acompanhamento/arbe">Ver alerta</a>
            </div>
          }
        </section>

        @if (reviews().length > 0) {
          <section class="card card--pad stack stack--3" aria-labelledby="hist-reviews">
            <h2 id="hist-reviews" class="card__title">Pedidos de revisão</h2>
            @for (r of reviews(); track r.id) {
              <div class="cluster cluster--between">
                <span class="t-ui">{{ r.answeredAt ? 'Respondido em ' + date(r.answeredAt) : 'Prazo até ' + date(r.dueAt) }}</span>
                <a class="btn btn--sm" routerLink="/app/acompanhamento/revisoes">Abrir</a>
              </div>
            }
          </section>
        }
      }
    </div>
  `,
})
export class ZaritHistoryPageComponent {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly svc = inject(ZaritService);
  private readonly access = inject(ZaritAccessService);
  private readonly consent = inject(ConsentService);
  private readonly audit = inject(AuditLogService);
  private readonly supervision = inject(SupervisionWindowService);
  private readonly toasts = inject(ToastService);
  private readonly page = inject(PageContextService);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });

  protected readonly valueOf = valueOf;
  protected readonly unlocked = signal(false);
  protected readonly addendumFor = signal<string | null>(null);
  protected readonly addendum = signal('');
  protected readonly addendumError = signal<string | null>(null);

  protected readonly caregiver = computed(() => this.db.caregivers.get(this.params().get('id') ?? ''));
  protected readonly consentOk = computed(() => {
    const c = this.caregiver();
    return !!c && this.consent.isActive(c.id, 'health_data');
  });
  protected readonly gated = computed(() => {
    const c = this.caregiver();
    return !!c && this.access.mustJustify(c.id) && !this.unlocked();
  });
  protected readonly canApply = computed(() => {
    const c = this.caregiver();
    return !!c && this.consentOk() && this.access.canApply(c.id);
  });
  protected readonly planId = computed(() => planIdOfCaregiver(this.db, this.caregiver()?.id ?? ''));
  protected readonly subtitle = computed(() => {
    const c = this.caregiver();
    return c ? `${c.fullName} (${c.code})` : '';
  });

  private readonly completed = computed(() => this.svc.completedOf(this.caregiver()?.id ?? ''));
  protected readonly last = computed(() => this.completed().at(-1));
  protected readonly points = computed<LinePoint[]>(() =>
    this.completed().map((a, i) => ({ label: i === 0 ? 'Adesão' : formatDate(a.appliedAt), value: a.total ?? null })),
  );
  protected readonly assessments = computed(() =>
    [...this.completed()].reverse().map((a) => ({
      id: a.id,
      caregiverId: a.caregiverId,
      appliedAt: a.appliedAt,
      total: a.total ?? 0,
      kindText: a.sequence === 0 ? 'Adesão' : `Trimestral nº ${a.sequence}`,
      conduct: zaritConductFor(a.total ?? 0, planIdOfCaregiver(this.db, a.caregiverId)),
      addenda: a.addenda.map((x): TimelineItem => ({ title: 'Adendo', text: x.content, at: x.at })),
    })),
  );
  protected readonly alerts = computed(() => this.svc.alertsOf(this.caregiver()?.id ?? ''));
  protected readonly arbe = computed(() =>
    this.db.arbeAlerts.query((a) => a.caregiverId === this.caregiver()?.id).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)),
  );
  protected readonly reviews = computed(() => this.db.reviewRequests.query((r) => r.caregiverId === this.caregiver()?.id));

  protected readonly evolutionText = computed(() => {
    const done = this.completed();
    const first = done[0];
    const last = done.at(-1);
    if (!first || !last || first.total === undefined || last.total === undefined) {
      return 'Sem aplicação ainda.';
    }
    const evolution = this.svc.evolutionOf(first.caregiverId);
    if (!evolution || evolution.kind === 'reference') {
      return `Adesão: ${first.total}. Esta é a referência para as próximas aplicações.`;
    }
    if (evolution.kind === 'not_defined') {
      return `n/d: a adesão foi 0, então a variação percentual não existe. Diferença de ${evolution.pointsDelta} ${Math.abs(evolution.pointsDelta) === 1 ? 'ponto' : 'pontos'}.`;
    }
    return `${evolution.display} (adesão ${first.total}, agora ${last.total})`;
  });
  protected readonly nextDueText = computed(() => {
    const due = this.svc.nextDueDate(this.caregiver()?.id ?? '');
    return due ? formatDate(due) : 'A definir';
  });
  protected readonly nextDueState = computed(() => {
    const due = this.svc.nextDueDate(this.caregiver()?.id ?? '');
    if (!due) {
      return null;
    }
    const state = zaritAssessmentState(due, this.clock.today(), false);
    const days = zaritDaysToDue(due, this.clock.today());
    if (state === 'overdue') {
      return { label: 'Vencida', variant: 'danger' as const, icon: 'clock' as const };
    }
    if (state === 'due') {
      return { label: days === 0 ? 'Vence hoje' : `Vence em ${days} ${days === 1 ? 'dia' : 'dias'}`, variant: 'attention' as const, icon: 'calendar-days' as const };
    }
    return { label: 'Em dia', variant: 'success' as const, icon: 'circle-check' as const };
  });

  constructor() {
    this.page.setCrumbs([
      { label: 'Acompanhamento', link: '/app/acompanhamento/fila' },
      { label: 'Histórico do cuidador' },
    ]);
    effect(() => {
      const c = this.caregiver();
      untracked(() => {
        if (!c || !this.consentOk()) {
          return;
        }
        if (this.access.mustJustify(c.id)) {
          if (this.supervision.access('zarit_history', c.id, c.id) === 'open') {
            this.unlocked.set(true);
          }
        } else if (this.access.canView(c.id)) {
          this.audit.view('zarit_history', c.id, c.id);
        }
      });
    });
  }

  protected date(value: string | undefined): string {
    return formatDate(value);
  }

  protected dateTime(value: string): string {
    return formatDateTime(value);
  }

  protected statusText(alertId: string): string {
    const alert = this.db.zaritAlerts.get(alertId);
    return alert ? ALERT_STATUS_LABELS[alert.status] : '';
  }

  protected arbeStatus(status: keyof typeof ARBE_STATUS_LABELS): string {
    return ARBE_STATUS_LABELS[status];
  }

  protected levelView(level: 'attention' | 'critical') {
    return ARBE_LEVEL_VIEW[level];
  }

  protected openAddendum(id: string): void {
    this.addendum.set('');
    this.addendumError.set(null);
    this.addendumFor.set(id);
  }

  protected saveAddendum(id: string): void {
    const result = this.svc.addAddendum(id, this.addendum());
    if (!result.ok) {
      this.addendumError.set(result.errors[0]?.message ?? null);
      return;
    }
    this.addendumFor.set(null);
    this.toasts.success('Adendo adicionado, com data e hora.');
  }
}
