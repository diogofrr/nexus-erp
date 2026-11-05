import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '@core/auth';
import { Database } from '@core/data';
import { planIdOfCaregiver } from '@core/data/plan-lookup';
import { formatMoney } from '@core/format';
import { REFERRAL_TABLE, EMERGENCY_NOTICE } from '@core/rules';
import {
  BadgeComponent,
  CheckboxComponent,
  ChecklistComponent,
  ChecklistItem,
  EmptyStateComponent,
  FormFieldComponent,
  IconComponent,
  PLAN_NAMES,
  PageHeaderComponent,
  RadioGroupComponent,
  RadioOption,
} from '@shared/ui';
import { DialogService, DrawerComponent, PageContextService, ToastService } from '@shared/ui/overlay';
import { ScheduleDrawerComponent } from '../components/schedule-drawer.component';
import { dayAndTime } from '../state/care-helpers';
import { KIND_LABELS, MODALITY_LABELS, sessionStatusView } from '../state/care-labels';
import { CareSessionsService, FieldError } from '../state/care-sessions.service';

const RISK_DESTINATIONS: readonly string[] =
  REFERRAL_TABLE.find((r) => r.category === 'severe_distress_or_suicide_risk')?.destinations ?? [];

/**
 * SCR-M05-04, Detalhe da sessão: estado, checklist de pertinência remota ou de domicílio e as ações de
 * transição (confirmar, cancelar, marcar realizada, registrar falta). O atendimento agenda e confirma em nome
 * do cuidador sem ver nada clínico (AC-M05-11). A anotação sigilosa fica em tela própria.
 */
@Component({
  selector: 'app-session-detail-page',
  imports: [
    BadgeComponent,
    CheckboxComponent,
    ChecklistComponent,
    DrawerComponent,
    EmptyStateComponent,
    FormFieldComponent,
    IconComponent,
    PageHeaderComponent,
    RadioGroupComponent,
    RouterLink,
    ScheduleDrawerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      @if (session(); as s) {
        <app-page-header title="Detalhe da sessão" [description]="when()">
          @if (showNoteLink()) {
            <a class="btn" [routerLink]="['/app/atendimento/sessoes', s.id, 'anotacao']" data-role="note-link">
              <svg appIcon="file-lock" size="sm"></svg>Anotação
            </a>
          }
          <a class="btn" routerLink="/app/atendimento/agenda">Voltar à agenda</a>
        </app-page-header>

        <section class="card card--pad stack stack--3" aria-labelledby="sd-info">
          <div class="cluster">
            <h2 id="sd-info" class="card__title">Sessão</h2>
            <app-badge [variant]="status().variant" [icon]="status().icon" data-role="status">{{ status().label }}</app-badge>
            <app-badge variant="info" data-role="kind">{{ kind() }}</app-badge>
          </div>
          <dl class="dl">
            <dt>Cuidador</dt><dd class="discreet" data-role="caregiver">{{ caregiverName() }} <span class="code-chip">{{ caregiverCode() }}</span></dd>
            <dt>Plano do cuidador</dt><dd>{{ planName() }}</dd>
            <dt>Psicólogo</dt><dd>{{ psychologistName() }}</dd>
            <dt>Quando</dt><dd>{{ when() }}, 1 hora</dd>
            <dt>Como</dt><dd>{{ how() }}</dd>
            <dt>Valor</dt><dd data-role="price">{{ price() }}</dd>
          </dl>
        </section>

        <section class="card card--pad stack stack--3" aria-labelledby="sd-checks">
          <h2 id="sd-checks" class="card__title">Checklist da sessão</h2>
          <app-checklist label="Checklist da sessão" [items]="checklist()" />
        </section>

        <section class="card card--pad stack stack--3" aria-labelledby="sd-actions">
          <h2 id="sd-actions" class="card__title">O que fazer agora</h2>
          @if (blockedMessage(); as msg) {
            <p class="t-ui" data-role="no-actions">{{ msg }}</p>
          }
          @if (s.status === 'scheduled' && canChange()) {
            @if (needsHomeCheck()) {
              <app-checkbox [checked]="homeSafe()" (checkedChange)="homeSafe.set($event)" data-role="home-safe">
                Domicílio adequado e seguro
              </app-checkbox>
            }
            <p class="t-caption">Confirmação esperada até 24 horas antes da sessão.</p>
          }
          @if (formError(); as msg) {
            <p class="field__error" role="alert" data-role="action-error">{{ msg }}</p>
          }
          <div class="cluster">
            @if (s.status === 'scheduled' && canChange()) {
              <button type="button" class="btn btn--primary" (click)="confirm()" data-role="confirm">Confirmar sessão</button>
            }
            @if ((s.status === 'confirmed' || s.status === 'scheduled') && isOwnPsychologist() && started()) {
              <button type="button" class="btn btn--primary" (click)="openDone()" data-role="mark-done">Marcar realizada</button>
              <button type="button" class="btn" (click)="markNoShow()" data-role="mark-noshow">Registrar falta</button>
            }
            @if ((s.status === 'scheduled' || s.status === 'confirmed') && canChange() && !started()) {
              <button type="button" class="btn" (click)="reschedule()" data-role="reschedule">
                <svg appIcon="calendar-days" size="sm"></svg>Remarcar sessão
              </button>
              <button type="button" class="btn btn--danger-quiet" (click)="openCancel()" data-role="cancel">Cancelar sessão</button>
            }
          </div>
        </section>
      } @else {
        <app-empty-state
          title="Sessão não encontrada"
          text="Confira o endereço ou volte à agenda para escolher a sessão."
        >
          <a class="btn btn--primary" routerLink="/app/atendimento/agenda">Voltar à agenda</a>
        </app-empty-state>
      }
    </div>

    <app-drawer [(open)]="doneOpen" heading="Marcar sessão como realizada" subtitle="Confirme o que a regra pede antes de registrar.">
      <div class="stack stack--6" data-role="done-form">
        @if (session()?.modality === 'online') {
          <app-form-field label="Formato remoto" group controlId="done-remote" [error]="doneError('remote')">
            <app-checkbox [checked]="remoteOk()" (checkedChange)="remoteOk.set($event)" data-role="remote-ok">
              O formato remoto é pertinente para este atendimento
            </app-checkbox>
          </app-form-field>
        }
        <app-form-field label="Risco, violência ou urgência" group controlId="done-risk">
          <app-checkbox [checked]="riskFlag()" (checkedChange)="riskFlag.set($event)" data-role="risk-flag">
            Há risco, violência ou urgência neste caso
          </app-checkbox>
        </app-form-field>
        @if (riskFlag()) {
          <app-form-field
            label="Encaminhamento à rede presencial"
            group
            controlId="done-referral"
            [error]="doneError('referral')"
            hint="Escolha o destino. A ocorrência do POP-05 é aberta para o responsável técnico."
          >
            @for (destination of riskDestinations; track destination) {
              <app-checkbox
                [checked]="destinations().includes(destination)"
                (checkedChange)="toggleDestination(destination, $event)"
              >
                {{ destination }}
              </app-checkbox>
            }
          </app-form-field>
          <p class="t-caption">{{ emergency }}</p>
        }
      </div>
      <ng-container drawerFooter>
        <button type="button" class="btn" (click)="doneOpen.set(false)">Voltar</button>
        <button type="button" class="btn btn--primary" (click)="submitDone()" data-role="done-submit">Marcar realizada</button>
      </ng-container>
    </app-drawer>

    <app-drawer [(open)]="cancelOpen" heading="Cancelar a sessão" subtitle="Veja o efeito antes de cancelar.">
      <div class="stack stack--6" data-role="cancel-form">
        <app-form-field label="Quem cancelou" group controlId="cancel-by">
          <app-radio-group [options]="cancelByOptions()" [value]="cancelBy()" (valueChange)="cancelBy.set($event ?? 'user')" />
        </app-form-field>
        <p class="banner banner--attention" role="status" data-role="cancel-effect">{{ cancelEffect() }}</p>
        <p class="t-caption">Quer mudar o horário em vez de cancelar? Feche esta janela e use "Remarcar sessão".</p>
      </div>
      <ng-container drawerFooter>
        <button type="button" class="btn" (click)="cancelOpen.set(false)">Voltar</button>
        <button type="button" class="btn btn--danger" (click)="submitCancel()" data-role="cancel-submit">Cancelar a sessão</button>
      </ng-container>
    </app-drawer>

    <app-schedule-drawer
      [(open)]="rescheduleOpen"
      [presetCaregiverId]="session()?.caregiverId ?? null"
      [rescheduleFrom]="session()?.id ?? null"
    />
  `,
})
export class SessionDetailPageComponent {
  private readonly db = inject(Database);
  private readonly svc = inject(CareSessionsService);
  private readonly auth = inject(AuthService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly page = inject(PageContextService);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });

  protected readonly riskDestinations = RISK_DESTINATIONS;
  protected readonly emergency = EMERGENCY_NOTICE;

  protected readonly session = computed(() => {
    this.db.careSessions.all();
    return this.db.careSessions.get(this.params().get('id') ?? '');
  });
  protected readonly caregiver = computed(() => this.db.caregivers.get(this.session()?.caregiverId ?? ''));
  protected readonly status = computed(() => sessionStatusView(this.session() ?? { status: 'scheduled' }));
  protected readonly kind = computed(() => KIND_LABELS[this.session()?.kind ?? 'psychotherapy']);
  protected readonly caregiverName = computed(() => this.caregiver()?.fullName ?? 'Cuidador');
  protected readonly caregiverCode = computed(() => this.caregiver()?.code ?? '');
  protected readonly planName = computed(() => {
    const id = this.session()?.caregiverId;
    return id ? PLAN_NAMES[planIdOfCaregiver(this.db, id)] : '';
  });
  protected readonly psychologistName = computed(
    () => this.db.psychologists.get(this.session()?.psychologistId ?? '')?.displayName ?? '',
  );
  protected readonly when = computed(() => {
    const s = this.session();
    return s ? dayAndTime(s.startAt.slice(0, 10), s.startAt.slice(11, 16)) : '';
  });
  protected readonly how = computed(() => {
    const s = this.session();
    if (!s) {
      return '';
    }
    if (s.modality === 'in_person_coworking') {
      return `${MODALITY_LABELS[s.modality]}: ${this.db.rooms.get(s.roomId ?? '')?.name ?? 'sala a definir'}`;
    }
    if (s.modality === 'in_person_home') {
      return `${MODALITY_LABELS[s.modality]}: ${s.homeAddress ?? 'endereço a informar'}`;
    }
    return MODALITY_LABELS[s.modality];
  });
  protected readonly price = computed(() => {
    const s = this.session();
    if (!s) {
      return '';
    }
    return s.discountPercent > 0
      ? `${formatMoney(s.priceCents)} (desconto de ${s.discountPercent}% do plano)`
      : `${formatMoney(s.priceCents)} (sem desconto)`;
  });

  protected readonly canChange = computed(() => {
    const s = this.session();
    const actor = this.auth.actor();
    return !!s && !!actor && this.auth.can('care_schedule', 'update', { own: actor.psychologistId === s.psychologistId });
  });
  protected readonly isOwnPsychologist = computed(() => {
    const s = this.session();
    const actor = this.auth.actor();
    return !!s && actor?.role === 'psychologist' && actor.psychologistId === s.psychologistId;
  });
  protected readonly started = computed(() => {
    const s = this.session();
    return !!s && this.svc.hasStarted(s);
  });
  protected readonly showNoteLink = computed(() => {
    const s = this.session();
    return (
      !!s &&
      s.status === 'done' &&
      (this.auth.can('session_notes', 'view', { own: this.isOwnPsychologist() }) || this.auth.can('session_notes', 'supervise'))
    );
  });
  protected readonly needsHomeCheck = computed(() => {
    const s = this.session();
    return !!s && s.modality === 'in_person_home' && !s.homeVisitConfirmedSafe;
  });
  protected readonly blockedMessage = computed(() => {
    const s = this.session();
    if (!s) {
      return null;
    }
    if (s.status === 'done') {
      return 'Sessão realizada. A anotação fica na tela própria, só para o psicólogo autor e a supervisão.';
    }
    if (s.status === 'no_show') {
      return 'Falta registrada. Esta sessão conta como horas não realizadas.';
    }
    if (s.rescheduledToId) {
      const next = this.db.careSessions.get(s.rescheduledToId);
      return next
        ? `Sessão remarcada para ${dayAndTime(next.startAt.slice(0, 10), next.startAt.slice(11, 16))}.`
        : 'Sessão remarcada.';
    }
    if (s.status === 'cancelled_by_user' || s.status === 'cancelled_by_psychologist') {
      return 'Sessão cancelada. A vaga voltou a ficar aberta.';
    }
    if (!this.canChange() && !this.isOwnPsychologist()) {
      return 'Seu perfil consulta a sessão. Quem confirma e cancela é o psicólogo ou o atendimento.';
    }
    return null;
  });

  protected readonly checklist = computed<ChecklistItem[]>(() => {
    const s = this.session();
    if (!s) {
      return [];
    }
    const items: ChecklistItem[] = [];
    if (s.modality === 'online') {
      items.push({
        id: 'remote',
        title: 'Formato remoto é pertinente',
        text: 'O psicólogo confirma ao marcar a sessão como realizada.',
        state: s.remoteFormatConfirmedPertinent ? 'ok' : 'pending',
      });
    } else if (s.modality === 'in_person_home') {
      items.push({
        id: 'home',
        title: 'Domicílio adequado e seguro',
        text: 'Confirmação do psicólogo antes de confirmar a sessão.',
        state: s.homeVisitConfirmedSafe ? 'ok' : 'pending',
      });
    } else {
      const room = this.db.rooms.get(s.roomId ?? '');
      items.push({
        id: 'room',
        title: 'Sala acessível',
        text: room ? `${room.name}, com os 4 itens de acessibilidade.` : 'Sala a definir.',
        state: room ? 'ok' : 'pending',
      });
    }
    items.push({
      id: 'kind',
      title: 'Tipo de atendimento informado',
      text: KIND_LABELS[s.kind],
      state: 'ok',
    });
    return items;
  });

  // ===== Estado dos painéis =====
  protected readonly homeSafe = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly doneOpen = signal(false);
  protected readonly remoteOk = signal(false);
  protected readonly riskFlag = signal(false);
  protected readonly destinations = signal<readonly string[]>([]);
  protected readonly doneErrors = signal<FieldError[]>([]);
  protected readonly cancelOpen = signal(false);
  protected readonly cancelBy = signal<'user' | 'psychologist'>('user');
  protected readonly rescheduleOpen = signal(false);

  protected readonly cancelByOptions = computed<RadioOption<'user' | 'psychologist'>[]>(() => {
    const options: RadioOption<'user' | 'psychologist'>[] = [{ value: 'user', label: 'O cuidador cancelou' }];
    if (this.auth.role() === 'psychologist') {
      options.push({ value: 'psychologist', label: 'O psicólogo cancelou' });
    }
    return options;
  });
  protected readonly cancelEffect = computed(() => {
    const s = this.session();
    return s ? this.svc.cancelEffect(s, this.cancelBy()) : '';
  });

  constructor() {
    effect(() => {
      const s = this.session();
      this.page.setCrumbs([
        { label: 'Atendimento', link: '/app/atendimento/agenda' },
        { label: 'Sessões', link: '/app/atendimento/sessoes' },
        { label: s ? `Sessão de ${this.when()}` : 'Sessão' },
      ]);
    });
  }

  protected doneError(field: string): string | null {
    return this.doneErrors().find((e) => e.field === field)?.message ?? null;
  }

  protected confirm(): void {
    const s = this.session();
    if (!s) {
      return;
    }
    const result = this.svc.confirm(s.id, this.homeSafe());
    if (!result.ok) {
      this.formError.set(result.errors[0]?.message ?? null);
      return;
    }
    this.formError.set(null);
    this.toasts.success(`Sessão confirmada para ${this.when()}.`);
  }

  protected openDone(): void {
    this.remoteOk.set(false);
    this.riskFlag.set(false);
    this.destinations.set([]);
    this.doneErrors.set([]);
    this.doneOpen.set(true);
  }

  protected toggleDestination(destination: string, on: boolean): void {
    const current = this.destinations();
    this.destinations.set(on ? [...current, destination] : current.filter((d) => d !== destination));
  }

  protected submitDone(): void {
    const s = this.session();
    if (!s) {
      return;
    }
    const result = this.svc.markDone(s.id, {
      remoteConfirmed: this.remoteOk(),
      risk: this.riskFlag() ? { destinations: this.destinations() } : null,
    });
    if (!result.ok) {
      this.doneErrors.set(result.errors);
      return;
    }
    this.doneOpen.set(false);
    this.toasts.success(
      this.riskFlag()
        ? 'Sessão realizada. O encaminhamento foi registrado e a ocorrência foi aberta para o responsável técnico.'
        : 'Sessão marcada como realizada. A anotação fica pendente.',
    );
  }

  protected async markNoShow(): Promise<void> {
    const s = this.session();
    if (!s) {
      return;
    }
    const { confirmed } = await this.dialogs.confirm({
      title: `Registrar falta na sessão de ${this.when()}?`,
      effects: { keep: ['a vaga como ocupada', 'o registro no histórico do cuidador'] },
      irreversibleNote: 'A falta não conta como hora realizada e não dá para desfazer.',
      confirmLabel: 'Registrar falta',
    });
    if (!confirmed) {
      return;
    }
    const result = this.svc.markNoShow(s.id);
    if (!result.ok) {
      this.formError.set(result.errors[0]?.message ?? null);
      return;
    }
    this.toasts.success('Falta registrada.');
  }

  protected openCancel(): void {
    this.cancelBy.set('user');
    this.cancelOpen.set(true);
  }

  protected submitCancel(): void {
    const s = this.session();
    if (!s) {
      return;
    }
    const result = this.svc.cancel(s.id, this.cancelBy());
    if (!result.ok) {
      this.formError.set(result.errors[0]?.message ?? null);
      this.cancelOpen.set(false);
      return;
    }
    this.cancelOpen.set(false);
    this.toasts.success(
      result.value.status === 'no_show'
        ? 'Cancelamento registrado como falta, conforme a regra de 24 horas.'
        : 'Sessão cancelada. A vaga voltou a ficar aberta.',
    );
  }

  protected reschedule(): void {
    this.rescheduleOpen.set(true);
  }
}
