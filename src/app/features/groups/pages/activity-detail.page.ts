import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '@core/auth';
import { Database } from '@core/data';
import { planIdOfCaregiver } from '@core/data/plan-lookup';
import { formatDate, formatDateTime, formatPercent, formatTime } from '@core/format';
import { GroupMembershipService } from '@core/groups';
import { ActivityEnrollment } from '@core/models';
import {
  BadgeComponent,
  EmptyStateComponent,
  IconComponent,
  KpiComponent,
  KpiStripComponent,
  PLAN_NAMES,
  PageHeaderComponent,
  PlaceholderLineComponent,
} from '@shared/ui';
import { DialogService, PageContextService, ToastService } from '@shared/ui/overlay';
import { EnrollDrawerComponent } from '../components/enroll-drawer.component';
import {
  ACTIVITY_STATUS_VIEW,
  CHARACTER_LABELS,
  ENROLLMENT_STATUS_VIEW,
  KIND_LABELS,
  MODE_LABELS,
  NO_PROMISE_TEXT,
  THEME_LABELS,
} from '../state/groups-labels';
import { GroupsService } from '../state/groups.service';

interface ParticipantRow {
  enrollment: ActivityEnrollment;
  name: string;
  code: string;
  plan: string;
}

/**
 * SCR-M07-03, Detalhe da atividade: caráter ("orientação e psicoeducação" ou "psicoterapia") e o aviso de que não
 * promete resultado terapêutico, número de inscrição profissional de quem conduz, encontros, inscritos, lista
 * de espera, contrato de sigilo e indicadores. As ações dizem o que vão fazer: "Inscrever" vira "Entrar na lista
 * de espera" quando lotado. Nomes só para quem pode (a gestão vê códigos; terapia de grupo não aparece ao atendimento).
 */
@Component({
  selector: 'app-activity-detail-page',
  imports: [
    BadgeComponent,
    EmptyStateComponent,
    EnrollDrawerComponent,
    IconComponent,
    KpiComponent,
    KpiStripComponent,
    PageHeaderComponent,
    PlaceholderLineComponent,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      @if (activity(); as a) {
        <app-page-header [title]="a.title" [description]="subtitle()">
          @if (canEnrollNow()) {
            <button type="button" class="btn btn--primary" (click)="enrollOpen.set(true)" data-role="enroll">
              <svg appIcon="user-check" size="sm"></svg>{{ isFull() ? 'Entrar na lista de espera' : 'Inscrever' }}
            </button>
          }
          @if (canManage() && a.status === 'draft') {
            <button type="button" class="btn btn--primary" (click)="publish()" data-role="publish">Publicar atividade</button>
          }
          @if (canManage() && (a.status === 'draft' || a.status === 'open' || a.status === 'full')) {
            <a class="btn" [routerLink]="['/app/grupos', a.id, 'editar']" data-role="edit">Editar</a>
          }
          @if (canManage() && a.status !== 'draft' && a.status !== 'cancelled') {
            <a class="btn" [routerLink]="['/app/grupos', a.id, 'presenca']" data-role="attendance-link">Presença</a>
          }
        </app-page-header>

        <div class="cluster" data-role="badges">
          <app-badge variant="info" data-role="kind">{{ kindText() }}</app-badge>
          <app-badge [variant]="a.kind === 'group_therapy' ? 'gold' : 'info'" [icon]="a.kind === 'group_therapy' ? 'heart-pulse' : 'book-open'" data-role="character">
            {{ characterText() }}
          </app-badge>
          <app-badge [variant]="status().variant" [icon]="status().icon" data-role="status">{{ status().label }}</app-badge>
          <app-badge [variant]="isFull() ? 'attention' : 'neutral'" [outline]="!isFull()" icon="users-round" data-role="seats">{{ seatsText() }}</app-badge>
        </div>

        @if (a.status === 'draft') {
          <p class="banner banner--attention" role="note" data-role="draft-note">Esta atividade é um rascunho. Publique para abrir as inscrições.</p>
        } @else if (a.status === 'cancelled') {
          <p class="banner banner--attention" role="note" data-role="cancelled-note">Esta atividade foi cancelada. Não recebe novas inscrições.</p>
        }

        <section class="card card--pad stack stack--3" aria-labelledby="gd-framing" data-role="framing">
          <h2 id="gd-framing" class="card__title">Sobre a atividade</h2>
          <p class="t-ui" data-role="framing-text">
            @if (a.kind === 'group_therapy') {
              Terapia de grupo é psicoterapia, conduzida por psicólogo da Nexus com CRP ativo, com objetivo clínico definido. Não é um grupo de apoio.
            } @else {
              Atividade de orientação e psicoeducação. Não é psicoterapia.
            }
          </p>
          <p class="t-ui" data-role="no-promise">{{ noPromise }}</p>
          <ul class="t-ui stack stack--2" role="list">
            @for (l of a.leaders; track l.name) {
              <li data-role="leader">
                <strong>{{ l.name }}</strong>
                @if (l.professionalRegistration) {
                  <span class="t-caption"> · Inscrição profissional {{ l.professionalRegistration }}</span>
                }
              </li>
            }
          </ul>
          @if (framing(); as f) {
            <p class="t-caption" data-role="framing-validated">Enquadramento validado por {{ f.by }} em {{ f.at }}.</p>
          }
          @if (canValidateFraming()) {
            <div>
              <button type="button" class="btn btn--sm" (click)="validateFraming()" data-role="validate-framing">Validar enquadramento</button>
            </div>
          }
        </section>

        <section class="card card--pad stack stack--3" aria-labelledby="gd-info">
          <h2 id="gd-info" class="card__title">Dados da atividade</h2>
          <dl class="dl">
            <dt>Tema</dt><dd>{{ themeText() }}</dd>
            <dt>Modalidade</dt><dd>{{ modeText() }}</dd>
            <dt>Quem pode participar</dt><dd data-role="min-plan">{{ a.minPlan ? 'Planos Cuida e Sustenta' : a.kind === 'training' ? 'Todos os planos (incluída conforme o plano, senão avulsa)' : 'Todos, inclusive sem cadastro' }}</dd>
            <dt>Vagas</dt><dd>{{ a.capacity }}</dd>
            @if (a.partnerOrg) {
              <dt>Em parceria com</dt><dd>{{ a.partnerOrg }}</dd>
            }
          </dl>
          <h3 class="t-strong">Encontros</h3>
          <ol class="stack stack--2" data-role="meetings">
            @for (m of a.meetings; track m.id; let i = $index) {
              <li class="cluster">
                <span class="t-num">{{ i + 1 }}. {{ date(m.startAt) }}, {{ time(m.startAt) }} às {{ time(m.endAt) }}</span>
                @if (m.done) {
                  <app-badge variant="success" icon="check">Realizado</app-badge>
                } @else {
                  <app-badge outline icon="clock">A realizar</app-badge>
                }
              </li>
            }
          </ol>
        </section>

        <app-kpi-strip aria-label="Indicadores da atividade">
          <app-kpi label="Inscritos" [value]="stats().holders" [context]="'de ' + a.capacity + ' vagas'" data-role="kpi-enrolled" />
          <app-kpi label="Lista de espera" [value]="stats().waitlisted" data-role="kpi-waitlist" />
          <app-kpi label="Preenchimento" [value]="percent(stats().fillPercent)" data-role="kpi-fill" />
          <app-kpi label="Taxa de presença" [value]="stats().presencePercent === null ? 'n/d' : percent(stats().presencePercent)" [context]="stats().doneMeetings + ' encontros realizados'" data-role="kpi-presence" />
        </app-kpi-strip>

        <section class="card card--pad stack stack--3" aria-labelledby="gd-enrolled" data-role="enrolled">
          <h2 id="gd-enrolled" class="card__title">Inscritos</h2>
          @if (!canSeeNames() && a.kind === 'group_therapy') {
            <app-placeholder-line reason="other-psychologist" text="Quem participa da terapia de grupo só aparece para quem a conduz." />
          }
          @if (rows().length === 0) {
            <app-empty-state compact title="Ninguém inscrito ainda" text="Quando alguém se inscrever, aparece aqui, com plano e aceite do sigilo." />
          } @else if (canSeeList()) {
            <div class="table-wrap">
              <table class="table" data-role="enrolled-table">
                <caption class="sr-only">Inscritos em {{ a.title }}</caption>
                <thead>
                  <tr>
                    <th scope="col">Participante</th>
                    <th scope="col">Plano</th>
                    <th scope="col">Aceite do sigilo</th>
                    <th scope="col">Estado</th>
                    @if (canEnrollRole()) {
                      <th scope="col"><span class="sr-only">Ações</span></th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (row of rows(); track row.enrollment.id) {
                    <tr [attr.data-enrollment]="row.enrollment.id">
                      <th scope="row"><span [class.discreet]="canSeeNames()">{{ row.name }}</span></th>
                      <td>{{ row.plan }}</td>
                      <td>{{ row.enrollment.confidentialityAcceptedAt ? dateTime(row.enrollment.confidentialityAcceptedAt) : 'Pendente' }}</td>
                      <td>
                        <app-badge [variant]="enrollmentView(row.enrollment).variant" [icon]="enrollmentView(row.enrollment).icon">{{ enrollmentView(row.enrollment).label }}</app-badge>
                      </td>
                      @if (canEnrollRole()) {
                        <td>
                          @if (row.enrollment.status === 'enrolled') {
                            <button type="button" class="btn btn--sm" (click)="cancelEnrollment(row)" data-role="cancel-enrollment">Cancelar inscrição</button>
                          }
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <p class="t-ui" data-role="enrolled-count">{{ rows().length }} {{ rows().length === 1 ? 'participante inscrito' : 'participantes inscritos' }}.</p>
          }
        </section>

        <section class="card card--pad stack stack--3" aria-labelledby="gd-waitlist" data-role="waitlist">
          <h2 id="gd-waitlist" class="card__title">Lista de espera</h2>
          @if (waitlist().length === 0) {
            <p class="t-muted t-ui">Ninguém na lista de espera.</p>
          } @else if (canSeeList()) {
            <ol class="stack stack--2">
              @for (row of waitlist(); track row.enrollment.id) {
                <li class="cluster cluster--between" [attr.data-waitlist]="row.enrollment.id">
                  <span><strong class="t-num">{{ row.enrollment.waitlistPosition }}.</strong> <span [class.discreet]="canSeeNames()">{{ row.name }}</span> <span class="t-caption">{{ row.plan }}</span></span>
                  @if (canEnrollRole()) {
                    <button type="button" class="btn btn--sm" (click)="cancelEnrollment(row)" data-role="cancel-waitlist">Sair da lista</button>
                  }
                </li>
              }
            </ol>
          } @else {
            <p class="t-ui">{{ waitlist().length }} {{ waitlist().length === 1 ? 'pessoa' : 'pessoas' }} na lista de espera.</p>
          }
        </section>

        <section class="card card--pad stack stack--2" aria-labelledby="gd-contract" data-role="contract">
          <h2 id="gd-contract" class="card__title">Contrato de sigilo</h2>
          <p class="t-ui">{{ a.confidentialityText }}</p>
          <p class="t-caption">Quem entra aceita o contrato, e a data e a hora do aceite ficam registradas.</p>
        </section>

        @if (canManage() && a.status !== 'cancelled' && a.status !== 'finished') {
          <section class="card card--pad stack stack--3" aria-labelledby="gd-manage">
            <h2 id="gd-manage" class="card__title">Gerir a atividade</h2>
            <div class="cluster">
              @if (a.status === 'in_progress') {
                <button type="button" class="btn" (click)="finish()" data-role="finish">Encerrar atividade</button>
              }
              <button type="button" class="btn btn--danger-quiet" (click)="cancelActivity()" data-role="cancel-activity">Cancelar atividade</button>
            </div>
          </section>
        }
      } @else {
        <app-empty-state title="Atividade não encontrada" text="Confira o endereço ou volte à programação.">
          <a class="btn btn--primary" routerLink="/app/grupos">Voltar à programação</a>
        </app-empty-state>
      }
    </div>

    <app-enroll-drawer [(open)]="enrollOpen" [activityId]="activity()?.id ?? ''" />
  `,
})
export class ActivityDetailPageComponent {
  private readonly db = inject(Database);
  private readonly auth = inject(AuthService);
  private readonly svc = inject(GroupsService);
  private readonly membership = inject(GroupMembershipService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly page = inject(PageContextService);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });

  protected readonly noPromise = NO_PROMISE_TEXT;
  protected readonly enrollOpen = signal(false);

  protected readonly activity = computed(() => this.db.activities.get(this.params().get('id') ?? ''));
  protected readonly status = computed(() => ACTIVITY_STATUS_VIEW[this.activity()?.status ?? 'draft']);
  protected readonly kindText = computed(() => KIND_LABELS[this.activity()?.kind ?? 'group_therapy']);
  protected readonly characterText = computed(() => CHARACTER_LABELS[this.activity()?.character ?? 'guidance']);
  protected readonly themeText = computed(() => THEME_LABELS[this.activity()?.theme ?? 'self_care']);
  protected readonly modeText = computed(() => {
    const a = this.activity();
    if (!a) {
      return '';
    }
    const room = a.roomId ? this.db.rooms.get(a.roomId) : undefined;
    return a.mode === 'in_person' ? `${MODE_LABELS[a.mode]}${room ? `, ${room.name}` : ''}` : MODE_LABELS[a.mode];
  });
  protected readonly subtitle = computed(() => {
    const a = this.activity();
    return a ? `${this.kindText()} · ${this.characterText()}` : '';
  });
  protected readonly stats = computed(() => {
    const a = this.activity();
    return a
      ? this.svc.statsOf(a)
      : { holders: 0, waitlisted: 0, capacity: 0, fillPercent: null, doneMeetings: 0, presences: 0, presencePercent: null };
  });
  protected readonly isFull = computed(() => {
    const a = this.activity();
    return !!a && this.membership.acceptsEnrollment(a) && this.membership.seatsFree(a) === 0;
  });
  protected readonly seatsText = computed(() => {
    const a = this.activity();
    if (!a) {
      return '';
    }
    const s = this.stats();
    return this.isFull()
      ? `Lotado: ${s.holders} de ${a.capacity}${s.waitlisted > 0 ? `, ${s.waitlisted} na lista de espera` : ''}`
      : `${s.holders} de ${a.capacity} vagas`;
  });

  protected readonly canManage = computed(() => {
    const a = this.activity();
    return !!a && this.svc.canManage(a);
  });
  protected readonly canEnrollRole = computed(() => {
    const a = this.activity();
    return !!a && this.svc.canEnroll(a);
  });
  protected readonly canEnrollNow = computed(() => {
    const a = this.activity();
    return !!a && this.canEnrollRole() && this.membership.acceptsEnrollment(a);
  });
  protected readonly canSeeNames = computed(() => {
    const a = this.activity();
    return !!a && this.svc.canSeeNames(a);
  });
  /** Quem vê a lista (com nome ou código): todos, menos o atendimento na terapia de grupo. */
  protected readonly canSeeList = computed(() => {
    const a = this.activity();
    return !!a && (this.canSeeNames() || this.auth.role() === 'partner');
  });
  protected readonly canValidateFraming = computed(() => this.svc.canValidateFraming());
  protected readonly framing = computed(() => {
    const a = this.activity();
    const found = a ? this.svc.framingValidation(a.id) : null;
    return found
      ? { by: this.db.users.get(found.userId)?.displayName ?? 'responsável técnico', at: formatDateTime(found.at) }
      : null;
  });

  private participant(enrollment: ActivityEnrollment): ParticipantRow {
    const caregiver = enrollment.caregiverId ? this.db.caregivers.get(enrollment.caregiverId) : undefined;
    const names = this.canSeeNames();
    const name = enrollment.external
      ? names
        ? enrollment.external.name
        : 'Participante externo'
      : names
        ? (caregiver?.fullName ?? 'Cuidador')
        : (caregiver?.code ?? 'Cuidador');
    return {
      enrollment,
      name,
      code: caregiver?.code ?? '',
      plan: caregiver ? `${PLAN_NAMES[planIdOfCaregiver(this.db, caregiver.id)]}${enrollmentPlanNote(enrollment)}` : 'Roda aberta',
    };
  }

  protected readonly rows = computed<ParticipantRow[]>(() => {
    const a = this.activity();
    return a
      ? this.svc
          .holders(a.id)
          .sort((x, y) => x.createdAt.localeCompare(y.createdAt))
          .map((e) => this.participant(e))
      : [];
  });
  protected readonly waitlist = computed<ParticipantRow[]>(() => {
    const a = this.activity();
    return a ? this.membership.waitlist(a.id).map((e) => this.participant(e)) : [];
  });

  constructor() {
    effect(() => {
      this.page.setCrumbs([
        { label: 'Grupos', link: '/app/grupos' },
        { label: this.activity()?.title ?? 'Atividade' },
      ]);
    });
    this.membership.reconcileAll();
  }

  protected date(value: string): string {
    return formatDate(value);
  }

  protected time(value: string): string {
    return formatTime(value);
  }

  protected dateTime(value: string): string {
    return formatDateTime(value);
  }

  protected percent(value: number | null): string {
    return value === null ? 'n/d' : formatPercent(value, { decimals: 1 });
  }

  protected enrollmentView(enrollment: ActivityEnrollment) {
    return ENROLLMENT_STATUS_VIEW[enrollment.status];
  }

  protected publish(): void {
    const a = this.activity();
    if (!a) {
      return;
    }
    const result = this.svc.publish(a.id);
    this.toasts.show(
      result.ok
        ? { message: 'Atividade publicada. As inscrições estão abertas.' }
        : { message: result.errors[0]?.message ?? 'Não foi possível publicar.', tone: 'danger' },
    );
  }

  protected validateFraming(): void {
    const a = this.activity();
    if (!a) {
      return;
    }
    const result = this.svc.validateFraming(a.id);
    this.toasts.show(
      result.ok
        ? { message: 'Enquadramento validado e registrado no log.' }
        : { message: result.errors[0]?.message ?? 'Não foi possível validar.', tone: 'danger' },
    );
  }

  protected async cancelEnrollment(row: ParticipantRow): Promise<void> {
    const preview = this.svc.promotionPreview(row.enrollment.id);
    const promotedRow = preview ? this.participant(preview) : null;
    const { confirmed } = await this.dialogs.confirm({
      title: `Cancelar a inscrição de ${row.name}?`,
      message: promotedRow ? undefined : 'A vaga volta a ficar aberta.',
      effects: promotedRow
        ? { keep: [`${promotedRow.name}, primeira da lista de espera, será promovida${this.isFull() ? ' e o grupo continua lotado' : ''}`] }
        : { erase: ['a inscrição e o lugar na turma'] },
      confirmLabel: 'Cancelar inscrição',
      cancelLabel: 'Voltar',
    });
    if (!confirmed) {
      return;
    }
    const result = this.svc.cancelEnrollment(row.enrollment.id);
    if (!result.ok) {
      this.toasts.error(result.errors[0]?.message ?? 'Não foi possível cancelar.');
      return;
    }
    const promoted = result.value.promoted[0];
    this.toasts.success(
      promoted ? `Inscrição cancelada. ${this.participant(promoted).name} foi promovida da lista de espera.` : 'Inscrição cancelada.',
    );
  }

  protected async cancelActivity(): Promise<void> {
    const a = this.activity();
    if (!a) {
      return;
    }
    const { confirmed } = await this.dialogs.confirm({
      title: `Cancelar a atividade "${a.title}"?`,
      effects: {
        block: ['novas inscrições'],
        erase: [`${this.stats().holders} inscrições e ${this.stats().waitlisted} na lista de espera`],
        keep: ['o histórico da atividade e os encontros já realizados'],
      },
      irreversibleNote: 'Não dá para desfazer.',
      confirmLabel: 'Cancelar atividade',
      cancelLabel: 'Voltar',
    });
    if (!confirmed) {
      return;
    }
    const result = this.svc.cancelActivity(a.id);
    this.toasts.show(
      result.ok
        ? { message: 'Atividade cancelada.' }
        : { message: result.errors[0]?.message ?? 'Não foi possível cancelar.', tone: 'danger' },
    );
  }

  protected async finish(): Promise<void> {
    const a = this.activity();
    if (!a) {
      return;
    }
    const { confirmed } = await this.dialogs.confirm({
      title: `Encerrar a atividade "${a.title}"?`,
      effects: { keep: ['a presença registrada em cada encontro'], block: ['novas presenças depois do encerramento'] },
      confirmLabel: 'Encerrar atividade',
      cancelLabel: 'Voltar',
    });
    if (!confirmed) {
      return;
    }
    const result = this.svc.finishActivity(a.id);
    this.toasts.show(
      result.ok
        ? { message: 'Atividade encerrada. Quem esteve presente aparece como participou.' }
        : { message: result.errors[0]?.message ?? 'Não foi possível encerrar.', tone: 'danger' },
    );
  }
}

/** ", incluída no plano" ou ", avulsa" na coluna Plano (docs/20); a roda aberta não leva nota. */
function enrollmentPlanNote(enrollment: ActivityEnrollment): string {
  if (enrollment.paid) {
    return ', avulsa';
  }
  return enrollment.includedInPlan ? ', incluída no plano' : '';
}
