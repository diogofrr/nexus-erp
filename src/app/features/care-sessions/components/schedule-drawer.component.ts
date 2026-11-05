import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@core/auth';
import { Database } from '@core/data';
import { formatMoney } from '@core/format';
import { CareSession, ID, SessionModality } from '@core/models';
import {
  CheckboxComponent,
  ErrorSummaryComponent,
  ErrorSummaryItem,
  FormFieldComponent,
  IconComponent,
  NxInputDirective,
  PLAN_NAMES,
  RadioGroupComponent,
  RadioOption,
} from '@shared/ui';
import { DrawerComponent, ToastService } from '@shared/ui/overlay';
import { checkedOf, valueOf } from '@shared/ui/util/form-events';
import { dayAndTime } from '../state/care-helpers';
import { KIND_LABELS, MODALITY_LABELS, isRoomBookable, roomBlockReason } from '../state/care-labels';
import { CareSessionsService, FieldError } from '../state/care-sessions.service';

const MODALITY_OPTIONS: RadioOption<SessionModality>[] = (
  ['online', 'in_person_coworking', 'in_person_home'] as const
).map((value) => ({ value, label: MODALITY_LABELS[value] }));

const MAX_SLOTS = 40;
const MAX_CAREGIVERS = 30;

/**
 * SCR-M05-03, Agendar sessão (F04). Cinco blocos na ordem do raciocínio: quem, com quem, quando, como e tipo.
 * O que já se sabe (vaga ou cuidador) chega preenchido. Mostra o valor e o desconto do plano. A ocupação
 * nunca bloqueia o agendamento: só informa, e só a quem pode ver ocupação (o atendimento não vê percentual).
 */
@Component({
  selector: 'app-schedule-drawer',
  imports: [
    CheckboxComponent,
    DrawerComponent,
    ErrorSummaryComponent,
    FormFieldComponent,
    IconComponent,
    NxInputDirective,
    RadioGroupComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-drawer
      [(open)]="open"
      [heading]="rescheduling() ? 'Remarcar sessão' : 'Agendar sessão'"
      [subtitle]="rescheduling() ? 'A sessão atual só é liberada depois que você salvar o novo horário.' : 'O psicólogo confirma depois, no detalhe da sessão.'"
    >
      <form class="stack stack--6" novalidate (submit)="$event.preventDefault(); submit()" data-role="schedule-form">
        <app-error-summary [items]="summary()" />

        @if (rescheduling()) {
          <!-- Remarcar: quem pediu e o efeito na sessão atual (CX-027) -->
          @if (isSupport()) {
            <p class="t-ui" data-role="requested-by-fixed">Remarcação a pedido do cuidador.</p>
          } @else {
            <app-form-field label="Quem pediu para remarcar" group controlId="sched-requested-by" [error]="err('requestedBy')">
              <app-radio-group [options]="requestedByOptions" [value]="requestedBy()" (valueChange)="requestedBy.set($event)" />
            </app-form-field>
          }
          <p class="banner banner--attention" role="status" data-role="reschedule-effect">{{ rescheduleEffect() }}</p>
        }

        <!-- 1. Quem -->
        <app-form-field label="Cuidador" controlId="sched-caregiver-select" [error]="err('caregiver')" hint="Busque pelo nome ou pelo código e escolha na lista.">
          <input
            class="input mb-2"
            type="search"
            placeholder="Buscar cuidador"
            aria-label="Buscar cuidador por nome ou código"
            [value]="term()"
            (input)="term.set(valueOf($event))"
            data-role="caregiver-search"
          />
          <select appInput [value]="caregiverId()" (change)="pickCaregiver(valueOf($event))" data-role="caregiver-select">
            <option value="">Escolha o cuidador</option>
            @for (c of caregiverOptions(); track c.id) {
              <option [value]="c.id" [selected]="c.id === caregiverId()">{{ c.fullName }} ({{ c.code }})</option>
            }
          </select>
        </app-form-field>

        <!-- 2. Com quem -->
        <app-form-field label="Psicólogo" controlId="sched-psychologist" [error]="err('psychologist')" hint="Só aparecem psicólogos com CRP ativo.">
          <select
            appInput
            [value]="psychologistId()"
            [disabled]="lockedPsychologist()"
            (change)="pickPsychologist(valueOf($event))"
            data-role="psychologist-select"
          >
            <option value="">Escolha o psicólogo</option>
            @for (p of psychologistOptions(); track p.id) {
              <option [value]="p.id" [selected]="p.id === psychologistId()">{{ p.label }}</option>
            }
          </select>
        </app-form-field>
        @if (overloadNote(); as note) {
          <p class="banner banner--attention" role="note" data-role="overload-note">{{ note }}</p>
        }

        <!-- 3. Quando: as vagas só aparecem depois de escolher o cuidador (CX-030) -->
        <app-form-field label="Vaga" group controlId="sched-slot" [error]="err('slot')">
          @if (!caregiverId()) {
            <p class="t-muted t-ui" data-role="slots-wait">
              @if (presetSlotLabel(); as chosen) {
                Vaga escolhida na agenda: {{ chosen }}. Escolha o cuidador para continuar.
              } @else {
                Escolha o cuidador para ver as vagas disponíveis para ele.
              }
            </p>
          } @else if (psychologistId()) {
            @if (slotOptions().length > 0) {
              <p class="t-caption">Mostrando as vagas disponíveis para este cuidador.</p>
              <div class="stack stack--2" style="max-height: 16rem; overflow: auto">
                <app-radio-group [options]="slotOptions()" [value]="slotId()" (valueChange)="slotId.set($event)" />
              </div>
            } @else {
              <p class="t-ui" data-role="no-slots">
                Sem vagas abertas para este psicólogo. Escolha outro psicólogo ou volte quando houver novas vagas.
              </p>
            }
          }
        </app-form-field>

        <!-- 4. Como -->
        <app-form-field label="Como a sessão acontece" group controlId="sched-modality" [error]="err('modality')">
          <app-radio-group [options]="modalityOptions" [value]="modality()" (valueChange)="modality.set($event)" />
        </app-form-field>
        @if (modality() === 'online') {
          <p class="t-caption">O psicólogo confirma depois se o formato remoto é pertinente.</p>
        }
        @if (modality() === 'in_person_coworking') {
          <app-form-field label="Sala do coworking" group controlId="sched-room" [error]="err('room')">
            <app-radio-group [options]="roomOptions()" [value]="roomId()" (valueChange)="roomId.set($event)" />
          </app-form-field>
        }
        @if (modality() === 'in_person_home') {
          <app-form-field label="Endereço do atendimento" controlId="sched-address" [error]="err('homeAddress')">
            <input appInput [value]="homeAddress()" (input)="homeAddress.set(valueOf($event))" data-role="home-address" />
          </app-form-field>
          <app-form-field label="Segurança do domicílio" group controlId="sched-home-safe" [error]="err('homeSafe')">
            <app-checkbox [checked]="homeSafe()" (checkedChange)="homeSafe.set($event)">
              Domicílio adequado e seguro
            </app-checkbox>
          </app-form-field>
        }

        <!-- 5. Tipo -->
        <app-form-field
          label="Tipo de atendimento"
          group
          controlId="sched-kind"
          [error]="err('kind')"
          [hint]="kindHint()"
        >
          <app-radio-group [options]="kindOptions" [value]="kind()" (valueChange)="kind.set($event)" />
        </app-form-field>

        @if (quote(); as q) {
          <div class="card card--sunken card--pad" data-role="price-summary" aria-live="polite">
            <p class="t-strong">
              Sessão {{ money(q.baseCents) }}, desconto {{ planName(q.planId) }} {{ q.discountPercent }}% ({{ money(q.discountCents) }}), total
              {{ money(q.totalCents) }}
            </p>
          </div>
        }
      </form>
      <ng-container drawerFooter>
        <button type="button" class="btn" (click)="open.set(false)">Voltar</button>
        <button type="button" class="btn btn--primary" [disabled]="busy()" (click)="submit()" data-role="schedule-submit">
          <svg appIcon="calendar-days" size="sm"></svg>{{ busy() ? 'Salvando...' : rescheduling() ? 'Remarcar sessão' : 'Agendar sessão' }}
        </button>
      </ng-container>
    </app-drawer>
  `,
})
export class ScheduleDrawerComponent {
  private readonly svc = inject(CareSessionsService);
  private readonly db = inject(Database);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);

  readonly open = model(false);
  /** Vaga clicada na agenda (chega preenchida). */
  readonly presetSlotId = input<ID | null>(null);
  readonly presetCaregiverId = input<ID | null>(null);
  /** Sessão que será cancelada quando o reagendamento for salvo. */
  readonly rescheduleFrom = input<ID | null>(null);
  readonly scheduled = output<CareSession>();

  protected readonly valueOf = valueOf;
  protected readonly checkedOf = checkedOf;
  protected readonly modalityOptions = MODALITY_OPTIONS;
  protected readonly kindOptions: RadioOption<CareSession['kind']>[] = (['psychotherapy', 'guidance'] as const).map(
    (value) => ({ value, label: KIND_LABELS[value] }),
  );

  protected readonly term = signal('');
  protected readonly caregiverId = signal('');
  protected readonly psychologistId = signal('');
  protected readonly slotId = signal<string | null>(null);
  protected readonly modality = signal<SessionModality | null>(null);
  protected readonly roomId = signal<string | null>(null);
  protected readonly homeAddress = signal('');
  protected readonly homeSafe = signal(false);
  protected readonly kind = signal<CareSession['kind'] | null>(null);
  protected readonly kindPrefilled = signal(false);
  protected readonly requestedBy = signal<'user' | 'psychologist' | null>(null);
  protected readonly requestedByOptions: RadioOption<'user' | 'psychologist'>[] = [
    { value: 'user', label: 'O cuidador pediu para remarcar' },
    { value: 'psychologist', label: 'Eu preciso remarcar' },
  ];
  protected readonly errors = signal<FieldError[]>([]);
  protected readonly busy = signal(false);

  protected readonly isSupport = computed(() => this.auth.role() === 'support');
  protected readonly rescheduling = computed(() => this.rescheduleFrom() !== null);
  private readonly original = computed(() => {
    const id = this.rescheduleFrom();
    return id ? this.db.careSessions.get(id) : undefined;
  });
  protected readonly rescheduleEffect = computed(() => {
    const session = this.original();
    return session ? this.svc.rescheduleEffect(session, this.isSupport() ? 'user' : this.requestedBy()) : '';
  });
  protected readonly presetSlotLabel = computed(() => {
    const slot = this.presetSlotId() ? this.db.availabilitySlots.get(this.presetSlotId() as string) : undefined;
    return slot ? dayAndTime(slot.date, slot.start) : null;
  });
  private readonly myPsychologist = computed(() => this.auth.actor()?.psychologistId ?? null);
  protected readonly lockedPsychologist = computed(() => this.myPsychologist() !== null);

  protected readonly caregiverOptions = computed(() => {
    const mine = this.myPsychologist();
    const term = this.term().trim().toLowerCase();
    const selected = this.caregiverId();
    const all = this.db.caregivers
      .all()
      .filter((c) => c.status !== 'closed' && (mine === null || c.assignedPsychologistId === mine));
    const found = all
      .filter((c) => !term || c.fullName.toLowerCase().includes(term) || c.code.toLowerCase().includes(term))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'pt-BR'))
      .slice(0, MAX_CAREGIVERS);
    const chosen = all.find((c) => c.id === selected);
    return chosen && !found.some((c) => c.id === selected) ? [chosen, ...found] : found;
  });

  protected readonly psychologistOptions = computed(() => {
    const mine = this.myPsychologist();
    return this.svc
      .activePsychologists()
      .filter((p) => mine === null || p.id === mine)
      .map((p) => {
        const next = this.svc.freeSlots(p.id, true)[0];
        return { id: p.id, label: `${p.displayName} (${next ? `próxima vaga: ${dayAndTime(next.date, next.start)}` : 'sem vagas abertas'})` };
      });
  });

  protected readonly slotOptions = computed<RadioOption<string>[]>(() => {
    const psy = this.psychologistId();
    if (!psy) {
      return [];
    }
    const caregiver = this.caregiverId();
    const seesPriority = caregiver ? this.svc.canSeePriority(caregiver) : false;
    const preset = this.presetSlotId();
    const slots = this.svc.freeSlots(psy, seesPriority);
    const presetSlot = preset ? this.db.availabilitySlots.get(preset) : undefined;
    if (presetSlot && presetSlot.psychologistId === psy && this.svc.isSlotFree(presetSlot) && !slots.some((s) => s.id === presetSlot.id)) {
      slots.unshift(presetSlot);
    }
    return slots.slice(0, MAX_SLOTS).map((s) => ({
      value: s.id,
      label: dayAndTime(s.date, s.start),
      ...(s.priorityOnly && !this.isSupport() ? { hint: 'Vaga prioritária' } : {}),
    }));
  });

  protected readonly roomOptions = computed<RadioOption<string>[]>(() =>
    this.db.rooms.all().map((room) => {
      const reason = roomBlockReason(room);
      return {
        value: room.id,
        label: room.name,
        disabled: !isRoomBookable(room),
        ...(reason ? { hint: reason } : {}),
      };
    }),
  );

  protected readonly quote = computed(() => {
    const id = this.caregiverId();
    return id ? this.svc.quote(id) : null;
  });

  protected readonly overloadNote = computed(() => {
    const psy = this.db.psychologists.get(this.psychologistId());
    if (!psy || this.isSupport()) {
      return null;
    }
    const row = this.svc.occupancyFor(psy);
    if (!row.overload) {
      return null;
    }
    return this.myPsychologist() === psy.id
      ? 'Sua agenda está acima de 80% há dois meses seguidos. A gestão e o responsável técnico também veem este aviso, para ajudar a redistribuir os casos.'
      : `A agenda de ${psy.displayName} está acima de 80% há dois meses. Se for possível, considere outro psicólogo.`;
  });

  protected readonly kindHint = computed(() =>
    this.kindPrefilled()
      ? 'Pré-preenchido pelo histórico do cuidador. Em dúvida, confirme com o psicólogo do caso.'
      : 'Em dúvida, confirme com o psicólogo do caso.',
  );

  protected readonly summary = computed<ErrorSummaryItem[]>(() =>
    this.errors().map((e) => ({ controlId: FIELD_IDS[e.field] ?? 'sched-slot', message: e.message })),
  );

  constructor() {
    effect(() => {
      if (this.open()) {
        untracked(() => this.reset());
      }
    });
  }

  protected err(field: string): string | null {
    return this.errors().find((e) => e.field === field)?.message ?? null;
  }

  protected money(cents: number): string {
    return formatMoney(cents);
  }

  protected planName(planId: keyof typeof PLAN_NAMES): string {
    return PLAN_NAMES[planId];
  }

  private reset(): void {
    this.errors.set([]);
    this.busy.set(false);
    this.term.set('');
    this.modality.set(null);
    this.roomId.set(null);
    this.homeAddress.set('');
    this.homeSafe.set(false);
    this.kind.set(null);
    this.kindPrefilled.set(false);
    this.requestedBy.set(null);
    const slot = this.presetSlotId() ? this.db.availabilitySlots.get(this.presetSlotId() as string) : undefined;
    this.slotId.set(slot?.id ?? null);
    const caregiver = this.presetCaregiverId();
    this.caregiverId.set(caregiver ?? '');
    this.psychologistId.set(
      this.myPsychologist() ?? slot?.psychologistId ?? this.defaultPsychologistOf(caregiver) ?? '',
    );
    if (caregiver) {
      this.prefillKind(caregiver);
    }
    // Remarcar: o que já foi informado na sessão atual chega preenchido (CX-027).
    const original = this.original();
    if (original) {
      this.caregiverId.set(original.caregiverId);
      this.psychologistId.set(this.myPsychologist() ?? original.psychologistId);
      this.modality.set(original.modality);
      this.roomId.set(original.roomId ?? null);
      this.homeAddress.set(original.homeAddress ?? '');
      this.homeSafe.set(original.homeVisitConfirmedSafe === true);
      this.kind.set(original.kind);
      this.slotId.set(null);
    }
  }

  private defaultPsychologistOf(caregiverId: ID | null): ID | null {
    const id = caregiverId ? this.svc.psychologistOfCaregiver(caregiverId) : undefined;
    const psy = id ? this.db.psychologists.get(id) : undefined;
    return psy?.crpStatus === 'active' ? psy.id : null;
  }

  /** Quando o atendimento agenda, o tipo vem do histórico (U-09, A-22); o psicólogo escolhe por conta própria. */
  private prefillKind(caregiverId: ID): void {
    if (!this.isSupport()) {
      return;
    }
    const last = this.svc.lastKind(caregiverId);
    this.kind.set(last);
    this.kindPrefilled.set(last !== null);
  }

  protected pickCaregiver(id: string): void {
    this.caregiverId.set(id);
    if (!id) {
      return;
    }
    const keepsPreset = this.presetSlotId() !== null;
    if (!this.lockedPsychologist() && !keepsPreset) {
      this.psychologistId.set(this.defaultPsychologistOf(id) ?? this.psychologistId());
    }
    if (this.slotId() && !this.slotOptions().some((o) => o.value === this.slotId())) {
      this.slotId.set(null);
    }
    this.prefillKind(id);
  }

  protected pickPsychologist(id: string): void {
    this.psychologistId.set(id);
    if (!this.slotOptions().some((o) => o.value === this.slotId())) {
      this.slotId.set(null);
    }
  }

  protected submit(): void {
    const input = {
      caregiverId: this.caregiverId(),
      psychologistId: this.psychologistId(),
      slotId: this.slotId() ?? '',
      modality: this.modality(),
      roomId: this.roomId(),
      homeAddress: this.homeAddress(),
      homeSafe: this.homeSafe(),
      kind: this.kind(),
    };
    const from = this.rescheduleFrom();
    const by = this.isSupport() ? 'user' : this.requestedBy();
    if (from && by === null) {
      this.errors.set([{ field: 'requestedBy', message: 'Diga quem pediu para remarcar.' }]);
      return;
    }
    this.busy.set(true);
    const result = from && by ? this.svc.reschedule(from, input, by) : this.svc.schedule(input);
    this.busy.set(false);
    if (!result.ok) {
      this.errors.set(result.errors);
      return;
    }
    const session = result.value;
    this.errors.set([]);
    this.open.set(false);
    const date = session.startAt.slice(0, 10);
    const psychologist = this.db.psychologists.get(session.psychologistId);
    const when = `${dayAndTime(date, session.startAt.slice(11, 16))}, com ${psychologist?.displayName ?? 'o psicólogo'}`;
    this.toasts.show({
      message: from
        ? `Sessão remarcada para ${when}. A anterior ficou como remarcada ${by === 'psychologist' ? 'pelo psicólogo' : 'a pedido do cuidador'}.`
        : `Sessão agendada para ${when}.`,
      action: {
        label: 'Ver na agenda',
        run: () => void this.router.navigate(['/app/atendimento/agenda'], { queryParams: { semana: date } }),
      },
    });
    this.scheduled.emit(session);
  }
}

const FIELD_IDS: Record<string, string> = {
  caregiver: 'sched-caregiver-select',
  psychologist: 'sched-psychologist',
  slot: 'sched-slot',
  modality: 'sched-modality',
  room: 'sched-room',
  homeAddress: 'sched-address',
  homeSafe: 'sched-home-safe',
  kind: 'sched-kind',
  requestedBy: 'sched-requested-by',
};
