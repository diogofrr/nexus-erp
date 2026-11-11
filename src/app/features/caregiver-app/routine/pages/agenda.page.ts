import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, Injector, afterNextRender, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Clock } from '../../../../core/clock/clock.service';
import { addDays, dateOf, timeOf } from '../../../../core/clock/date-utils';
import { Database } from '../../../../core/data/database';
import { NAME_MAX_CHARS, tooLongText } from '../../../../core/rules/text-limits';
import { ID, ISODate, ISODateTime } from '../../../../core/models';
import {
  APPOINTMENT_KINDS,
  APPOINTMENT_KIND_LABELS,
  AppointmentKind,
  AppointmentProblem,
  betweenDates,
  groupByDay,
  isPastTime,
  onDate,
  sortByTime,
  windowEnd,
} from '../../../../core/rules/care-agenda';
import { IconComponent, IconName } from '../../../../shared/ui/display/icon.component';
import { ErrorSummaryComponent, ErrorSummaryItem } from '../../../../shared/ui/forms/error-summary.component';
import { FormFieldComponent } from '../../../../shared/ui/forms/form-field.component';
import { NxInputDirective } from '../../../../shared/ui/forms/input.directive';
import { ToastService } from '../../../../shared/ui/overlay/toast.service';
import { CaregiverContextService } from '../../state/caregiver-context.service';
import { EVENT_TYPE_ICONS, enrolledMeetingsOf } from '../../state/event-type';
import { OnlineStatusService } from '../../state/online-status.service';
import { withArticle } from '../../state/people-format';
import { CgCalendarComponent, CgCalendarEvent } from '../../ui/cg-calendar.component';
import { CgEmptyComponent } from '../../ui/cg-empty.component';
import { CgHeroComponent } from '../../ui/cg-hero.component';
import { CgNoteComponent } from '../../ui/cg-note.component';
import { CgSheetComponent } from '../../ui/cg-sheet.component';
import { CgSwitchComponent } from '../../ui/cg-switch.component';
import { AgendaEntryComponent } from '../components/agenda-entry.component';
import { RoutineTabsComponent } from '../components/routine-tabs.component';
import { AgendaEntry } from '../state/agenda-entry';
import { dayCardHeading, dayHeading, whenText } from '../state/agenda-format';
import { AgendaError, AgendaService, AppointmentInput } from '../state/agenda.service';
import { AgendaView, AgendaViewService } from '../state/agenda-view.service';

const KIND_ICON: Readonly<Record<AppointmentKind, IconName>> = {
  medical: 'stethoscope',
  physio: 'heart-pulse',
  psychological: 'hand-heart',
  other: 'calendar',
};

const UPCOMING_DAYS = 14;
const MORE_DAYS = 30;
const PAST_DAYS = 7;

/** A frase de cada problema de formulário (UX C5, erros), junto do campo e no resumo. */
const PROBLEM_TEXT: Readonly<Record<AppointmentProblem | 'kind_required', { field: string; message: string }>> = {
  title_required: { field: 'title', message: 'Informe o que é o compromisso.' },
  title_too_long: { field: 'title', message: tooLongText(NAME_MAX_CHARS) },
  place_too_long: { field: 'place', message: tooLongText(NAME_MAX_CHARS) },
  kind_required: { field: 'kind', message: 'Escolha o tipo do compromisso.' },
  date_required: { field: 'date', message: 'Informe o dia do compromisso.' },
  date_invalid: { field: 'date', message: 'Informe um dia que existe.' },
  date_past: { field: 'date', message: 'Escolha um dia de hoje em diante.' },
  time_required: { field: 'time', message: 'Informe a hora do compromisso.' },
  time_format: { field: 'time', message: 'Informe uma hora no formato 14:00.' },
  time_past: { field: 'time', message: 'Escolha uma hora que ainda não passou.' },
};

const FIELD_ID: Readonly<Record<string, string>> = {
  title: 'apt-title',
  place: 'apt-place',
  kind: 'apt-kind',
  date: 'apt-date',
  time: 'apt-time',
};

const SAVE_FAILED = 'Não foi possível salvar. Tente de novo; se continuar, fale com a gente.';

/**
 * Rotina, aba Agenda (UX C5, `/cuidador/rotina/agenda`): um **calendário do mês** (`app-cg-calendar`) com o detalhe do dia
 * escolhido (hoje, de começo). No celular o calendário fica em cima e o dia embaixo; em tela larga (1024 px ou mais) ficam
 * lado a lado. O dia mostra os compromissos da pessoa idosa e, no mesmo dia, a conversa do próprio cuidador com o psicólogo
 * ("Para você") e os encontros em que ele está inscrito (com o selo do tipo: roda aberta, capacitação, terapia de grupo;
 * docs/20, regra 2: na Agenda só entra o que já é da pessoa, nunca a vitrine), e a ação principal é **Adicionar
 * compromisso neste dia** (a data já vai preenchida). Tocar num dia vazio
 * diz "Nada marcado para este dia". Um alternador "Calendário | Lista" guarda o jeito preferido no navegador: a lista
 * (próximos 14 dias agrupados por dia, "Ver anteriores" e "Ver mais datas") continua como era.
 *
 * Tocar num compromisso abre a folha de detalhe (Remarcar, Lembrar de mim, Tirar da agenda). Cada gravação mostra uma
 * faixa de 8 s com "Desfazer", e o calendário acompanha o dia do que foi adicionado, remarcado ou devolvido. Nada de
 * atendimento, grupo ou escala entra nos textos.
 */
@Component({
  selector: 'app-agenda-page',
  imports: [
    AgendaEntryComponent,
    CgCalendarComponent,
    CgEmptyComponent,
    CgHeroComponent,
    CgNoteComponent,
    CgSheetComponent,
    CgSwitchComponent,
    ErrorSummaryComponent,
    FormFieldComponent,
    IconComponent,
    NxInputDirective,
    ReactiveFormsModule,
    RoutineTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .routine-panel {
      display: grid;
      gap: var(--cg-gap-block);
      grid-template-columns: minmax(0, 1fr);
    }
    .routine-panel .cg-actions {
      margin-top: 0;
    }
    .routine-day {
      margin: 0 0 0.75rem;
    }
    .routine-view {
      display: flex;
      width: fit-content;
      max-width: 100%;
      padding: 0.125rem;
      border: 2px solid var(--cg-border-control);
      border-radius: var(--cg-radius-pill);
      background: var(--cg-surface);
    }
    .routine-view__btn {
      display: inline-flex;
      flex: 1 1 auto;
      align-items: center;
      justify-content: center;
      gap: 0.375rem;
      min-height: var(--cg-target);
      padding: 0 1.125rem;
      border: 0;
      border-radius: var(--cg-radius-pill);
      background: transparent;
      color: var(--cg-text);
      font: inherit;
      font-weight: var(--fw-semibold);
      cursor: pointer;
    }
    .routine-view__btn[aria-pressed='true'] {
      background: var(--cg-acc-solid);
      color: var(--cg-surface);
    }
    .routine-cal {
      display: grid;
      gap: var(--cg-gap-block);
      grid-template-columns: minmax(0, 1fr);
      align-items: start;
      max-width: var(--cg-reading);
    }
    .routine-selected {
      display: grid;
      gap: var(--cg-gap-stack);
      align-content: start;
      min-width: 0;
    }
    .routine-selected__title {
      margin: 0;
    }
    @media (min-width: 64rem) {
      .routine-cal {
        grid-template-columns: minmax(0, 28rem) minmax(0, 1fr);
        max-width: none;
      }
    }
    .routine-form {
      display: grid;
      gap: 1.25rem;
    }
    .routine-kind {
      display: grid;
      gap: 0.5rem;
      margin: 0;
      padding: 0;
      border: 0;
      min-width: 0;
    }
    .routine-kind > legend {
      padding: 0;
      margin-bottom: 0.5rem;
      font-weight: var(--fw-semibold);
    }
    .routine-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .routine-chip {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      min-height: var(--cg-target);
      padding: 0 1rem;
      border: 2px solid var(--cg-border-control);
      border-radius: var(--cg-radius-pill);
      background: var(--cg-surface);
      font-weight: var(--fw-semibold);
      cursor: pointer;
    }
    .routine-chip.is-selected {
      border-color: var(--cg-action);
      background: var(--brand-soft);
      box-shadow: inset 0 0 0 1px var(--cg-action);
    }
    .routine-chip__input {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      margin: 0;
      opacity: 0;
      cursor: pointer;
    }
    .routine-chip:focus-within {
      outline: 3px solid var(--cg-focus);
      outline-offset: 3px;
    }
    .routine-when {
      margin: 0;
      font-size: var(--cg-fs-lead);
      color: var(--cg-heading);
    }
  `,
  template: `
    <app-cg-hero title="Rotina" illustration="calendar" />
    <app-routine-tabs current="agenda" panelId="routine-panel" />

    <div class="routine-panel" id="routine-panel" role="tabpanel" aria-labelledby="routine-tab-agenda">
      @if (!online.online()) {
        <app-cg-note variant="soft" icon="info">Você está sem conexão. Seus dados continuam neste navegador.</app-cg-note>
      }

      <div class="routine-view" role="group" aria-label="Ver a agenda como">
        <button type="button" class="routine-view__btn" [attr.aria-pressed]="view() === 'calendar'" (click)="setView('calendar')">
          @if (view() === 'calendar') {
            <svg appIcon="check" size="sm"></svg>
          }
          Calendário
        </button>
        <button type="button" class="routine-view__btn" [attr.aria-pressed]="view() === 'list'" (click)="setView('list')">
          @if (view() === 'list') {
            <svg appIcon="check" size="sm"></svg>
          }
          Lista
        </button>
      </div>

      @if (view() === 'calendar') {
        <div class="routine-cal">
          <app-cg-calendar [events]="calendarEvents()" [selected]="selectedDate()" (selectedChange)="selectDay($event)" />

          <section class="routine-selected" aria-labelledby="agenda-selected-day">
            <h2 class="cg-section__title routine-selected__title" id="agenda-selected-day" aria-live="polite">{{ selectedHeading() }}</h2>
            @if (dayEntries().length > 0) {
              <ul class="cg-list">
                @for (entry of dayEntries(); track entry.key) {
                  <li><app-agenda-entry [entry]="entry" [plain]="selectedIsPast()" (open)="openDetail($event)" /></li>
                }
              </ul>
            } @else {
              <app-cg-note variant="soft" icon="calendar">Nada marcado para este dia</app-cg-note>
            }
            @if (!selectedIsPast()) {
              <div class="cg-actions">
                <button type="button" class="btn btn--primary" (click)="openNew(selectedDate())">
                  <svg appIcon="plus" size="sm"></svg>
                  Adicionar compromisso neste dia
                </button>
              </div>
            }
          </section>
        </div>
      } @else {
        @if (isEmpty()) {
          <app-cg-empty
            illustration="calendar"
            title="Nenhum compromisso por aqui"
            text="Quando você adicionar uma consulta ou uma sessão, ela aparece nesta lista."
          >
            <button type="button" class="btn btn--primary" (click)="openNew()">Adicionar compromisso</button>
          </app-cg-empty>
        } @else {
          <div class="cg-actions">
            <button type="button" class="btn btn--primary" (click)="openNew()">
              <svg appIcon="plus" size="sm"></svg>
              Adicionar compromisso
            </button>
          </div>
        }

        @if (hasPast()) {
          <div>
            <button type="button" class="cg-link-btn" [attr.aria-expanded]="showPast()" (click)="showPast.set(!showPast())">
              {{ showPast() ? 'Esconder anteriores' : 'Ver anteriores' }}
            </button>
          </div>
        }
        @if (showPast()) {
          @for (group of pastGroups(); track group.date) {
            <section [attr.aria-labelledby]="'agenda-day-' + group.date">
              <h2 class="cg-section__title routine-day" [id]="'agenda-day-' + group.date">{{ heading(group.date) }}</h2>
              <ul class="cg-list">
                @for (entry of group.items; track entry.key) {
                  <li><app-agenda-entry [entry]="entry" [plain]="true" /></li>
                }
              </ul>
            </section>
          }
        }

        @for (group of upcomingGroups(); track group.date) {
          <section [attr.aria-labelledby]="'agenda-day-' + group.date">
            <h2 class="cg-section__title routine-day" [id]="'agenda-day-' + group.date">{{ heading(group.date) }}</h2>
            <ul class="cg-list">
              @for (entry of group.items; track entry.key) {
                <li><app-agenda-entry [entry]="entry" (open)="openDetail($event)" /></li>
              }
            </ul>
          </section>
        }

        @if (!isEmpty() && upcomingGroups().length === 0) {
          <app-cg-note variant="soft" icon="calendar">Nenhum compromisso nos próximos dias.</app-cg-note>
        }

        @if (windowDays() === baseWindow && !isEmpty()) {
          <div>
            <button type="button" class="cg-link-btn" (click)="windowDays.set(moreWindow)">Ver mais datas</button>
          </div>
        }
      }
    </div>

    <app-cg-sheet [heading]="detailTitle()" [(open)]="detailOpen">
      @if (selected(); as apt) {
        <p class="routine-when">{{ whenOf(apt.at) }}</p>
        @if (apt.place) {
          <p class="cg-muted">{{ apt.place }}</p>
        }
        <app-cg-switch
          label="Lembrar de mim"
          hint="Avisamos um dia antes e 1 hora antes. No protótipo, o aviso aparece só dentro do app."
          [checked]="apt.reminder"
          (checkedChange)="setReminder(apt.id, $event)"
        />
      }
      <ng-container cgSheetActions>
        <button type="button" class="btn" (click)="startReschedule()">Remarcar</button>
        <button type="button" class="btn btn--danger-quiet" (click)="askRemove()">Tirar da agenda</button>
        <button type="button" class="cg-link-btn" (click)="detailOpen.set(false)">Voltar</button>
      </ng-container>
    </app-cg-sheet>

    <app-cg-sheet [heading]="editingId() ? 'Remarcar compromisso' : 'Novo compromisso'" [(open)]="formOpen">
      <form class="routine-form" [formGroup]="form" novalidate (ngSubmit)="save()">
        <app-error-summary short [items]="errorItems()" />

        @if (editingId()) {
          <!-- Remarcar muda só o dia e a hora (CXC-018): o resto fica como está. -->
          <p class="routine-when" data-role="reschedule-what">{{ form.controls.title.value }}</p>
        } @else {
        <app-form-field label="O que é?" hint="Exemplo: consulta com o cardiologista" controlId="apt-title" [error]="messageOf('title')">
          <input appInput formControlName="title" autocomplete="off" />
        </app-form-field>

        <fieldset class="routine-kind" id="apt-kind">
          <legend>Tipo</legend>
          <div class="routine-chips">
            @for (kind of kinds; track kind) {
              <label class="routine-chip" [class.is-selected]="form.controls.kind.value === kind">
                <input class="routine-chip__input" type="radio" name="kind" formControlName="kind" [value]="kind" />
                @if (form.controls.kind.value === kind) {
                  <svg appIcon="check" size="sm"></svg>
                }
                <span>{{ kindLabels[kind] }}</span>
              </label>
            }
          </div>
          @if (messageOf('kind'); as problem) {
            <span class="field__error"><svg appIcon="circle-alert" size="sm"></svg><span><span class="sr-only">Erro: </span>{{ problem }}</span></span>
          }
        </fieldset>
        }

        <app-form-field label="Dia" controlId="apt-date" [error]="messageOf('date')">
          <input appInput type="date" formControlName="date" [attr.min]="today()" />
        </app-form-field>

        <app-form-field label="Hora" controlId="apt-time" [error]="messageOf('time')">
          <input appInput type="time" formControlName="time" />
        </app-form-field>

        @if (!editingId()) {
          <app-form-field label="Onde ou com quem" [optional]="true" controlId="apt-place" [error]="messageOf('place')">
            <input appInput formControlName="place" autocomplete="off" />
          </app-form-field>

          <app-cg-switch
            label="Lembrar de mim"
            hint="Avisamos um dia antes e 1 hora antes. No protótipo, o aviso aparece só dentro do app."
            [checked]="form.controls.reminder.value"
            (checkedChange)="form.controls.reminder.setValue($event)"
          />
        }
        @if (failure(); as text) {
          <app-cg-note variant="error">{{ text }}</app-cg-note>
        }
      </form>
      <ng-container cgSheetActions>
        <button type="button" class="btn btn--primary" (click)="save()">
          {{ editingId() ? 'Salvar novo horário' : 'Salvar compromisso' }}
        </button>
        <button type="button" class="cg-link-btn" (click)="formOpen.set(false)">Voltar</button>
      </ng-container>
    </app-cg-sheet>

    <app-cg-sheet heading="Tirar este compromisso da agenda?" initialFocus="safe-action" [(open)]="confirmOpen">
      <p>Ele some da sua agenda e dos lembretes.</p>
      <ng-container cgSheetActions>
        <button type="button" class="btn btn--danger-quiet" (click)="remove()">Tirar da agenda</button>
        <button type="button" class="cg-link-btn" (click)="confirmOpen.set(false)">Voltar</button>
      </ng-container>
    </app-cg-sheet>
  `,
})
export class AgendaPage {
  private readonly ctx = inject(CaregiverContextService);
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly agenda = inject(AgendaService);
  private readonly views = inject(AgendaViewService);
  private readonly toasts = inject(ToastService);
  private readonly location = inject(Location);
  private readonly injector = inject(Injector);
  protected readonly online = inject(OnlineStatusService);

  protected readonly kinds = APPOINTMENT_KINDS;
  protected readonly kindLabels = APPOINTMENT_KIND_LABELS;
  protected readonly today = this.ctx.today;
  protected readonly baseWindow = UPCOMING_DAYS;
  protected readonly moreWindow = MORE_DAYS;

  /** Calendário ou lista (guardado no navegador). */
  protected readonly view = this.views.view;
  protected readonly windowDays = signal(UPCOMING_DAYS);
  protected readonly showPast = signal(false);
  protected readonly detailOpen = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly confirmOpen = signal(false);
  protected readonly selectedId = signal<ID | null>(null);
  protected readonly editingId = signal<ID | null>(null);
  private readonly submitted = signal(false);
  protected readonly failure = signal<string | null>(null);
  /** O dia aberto no calendário: hoje, de começo. */
  protected readonly selectedDate = signal<ISODate>(this.ctx.today());

  protected readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true }),
    kind: new FormControl<AppointmentKind | null>(null),
    date: new FormControl('', { nonNullable: true }),
    time: new FormControl('', { nonNullable: true }),
    place: new FormControl('', { nonNullable: true }),
    reminder: new FormControl(true, { nonNullable: true }),
  });
  private readonly values = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  /** Os problemas do formulário, já com a frase de cada um; só depois da primeira tentativa de salvar. */
  private readonly problems = computed(() => {
    this.values();
    if (!this.submitted()) {
      return [] as { field: string; message: string }[];
    }
    const raw = this.form.getRawValue();
    const found = this.agenda
      .problems({
        title: raw.title,
        place: raw.place,
        date: raw.date === '' ? null : raw.date,
        time: raw.time === '' ? null : raw.time,
      })
      .map((p) => PROBLEM_TEXT[p]);
    if (!raw.kind) {
      found.push(PROBLEM_TEXT.kind_required);
    }
    return found;
  });
  protected readonly errorItems = computed<ErrorSummaryItem[]>(() =>
    this.problems().map((p) => ({ controlId: FIELD_ID[p.field] ?? 'apt-title', message: p.message })),
  );

  // ===== Compromissos (calendário e lista leem os mesmos) =====

  private readonly entries = computed<AgendaEntry[]>(() => {
    const today = this.ctx.today();
    const now = this.clock.now();
    const list: AgendaEntry[] = [];
    const elderId = this.ctx.elderId();
    if (elderId) {
      this.agenda.appointmentsOf(elderId).forEach((a) => {
        const place = a.place?.trim();
        const date = dateOf(a.at);
        list.push({
          key: a.id,
          at: a.at,
          date,
          time: timeOf(a.at),
          title: a.title,
          support: place ? place : null,
          icon: KIND_ICON[a.kind],
          kind: a.kind,
          forYou: false,
          eventType: null,
          link: null,
          linkQuery: null,
          appointment: a,
          passed: date === today && isPastTime(a.at, now),
        });
      });
    }
    const caregiverId = this.ctx.caregiverId();
    if (caregiverId) {
      this.db.careSessions
        .query((s) => s.caregiverId === caregiverId && (s.status === 'scheduled' || s.status === 'confirmed'))
        .forEach((s) => {
          const psychologist = this.db.psychologists.find((p) => p.id === s.psychologistId);
          list.push({
            key: s.id,
            at: s.startAt,
            date: dateOf(s.startAt),
            time: timeOf(s.startAt),
            title: `Sua conversa com ${psychologist ? withArticle(psychologist.displayName) : 'o psicólogo'}`,
            support: null,
            icon: s.modality === 'online' ? 'video' : s.modality === 'in_person_home' ? 'house' : 'building-2',
            kind: 'you',
            forYou: true,
            eventType: null,
            link: '/cuidador/cuidar-de-mim/atendimento',
            linkQuery: null,
            appointment: null,
            passed: false,
          });
        });
      // Os encontros em que a pessoa está inscrita (docs/20, regra 2: só o que já é dela), com o selo do tipo.
      enrolledMeetingsOf(this.db.activities.list(), this.db.activityEnrollments.list(), caregiverId, now).forEach((m) =>
        list.push({
          key: m.meetingId,
          at: m.startAt,
          date: dateOf(m.startAt),
          time: timeOf(m.startAt),
          title: m.title,
          support: null,
          icon: EVENT_TYPE_ICONS[m.type],
          kind: 'you',
          forYou: true,
          eventType: m.type,
          link: '/cuidador/cuidar-de-mim/grupos',
          linkQuery: { atividade: m.activityId },
          appointment: null,
          passed: false,
        }),
      );
    }
    return list;
  });

  // ===== Calendário =====

  /** O dia e o tipo de cada compromisso, na ordem do horário (a ordem das marcas do dia). */
  protected readonly calendarEvents = computed<CgCalendarEvent[]>(() =>
    sortByTime(this.entries()).map((e) => ({ date: e.date, kind: e.kind })),
  );
  protected readonly dayEntries = computed(() => onDate(this.entries(), this.selectedDate()));
  protected readonly selectedHeading = computed(() => dayCardHeading(this.selectedDate(), this.ctx.today()));
  /** Dia que já passou: só se lê (não se adiciona compromisso no passado). */
  protected readonly selectedIsPast = computed(() => this.selectedDate() < this.ctx.today());

  // ===== Lista =====

  protected readonly upcomingGroups = computed(() => {
    const today = this.ctx.today();
    return groupByDay(betweenDates(this.entries(), today, windowEnd(today, this.windowDays())));
  });
  protected readonly pastGroups = computed(() => {
    const today = this.ctx.today();
    return groupByDay(betweenDates(this.entries(), addDays(today, -PAST_DAYS), addDays(today, -1)));
  });
  protected readonly hasPast = computed(() => this.pastGroups().length > 0);
  /** Nada na agenda: o vazio acolhedor da lista. */
  protected readonly isEmpty = computed(() => this.entries().length === 0);

  protected readonly selected = computed(() => {
    const id = this.selectedId();
    return id ? (this.db.careAppointments.get(id) ?? null) : null;
  });
  protected readonly detailTitle = computed(() => this.selected()?.title ?? 'Compromisso');

  constructor() {
    if (inject(ActivatedRoute).snapshot.queryParamMap.has('novo')) {
      afterNextRender(
        () => {
          this.openNew();
          this.location.replaceState('/cuidador/rotina/agenda');
        },
        { injector: this.injector },
      );
    }
  }

  protected heading(date: ISODate): string {
    return dayHeading(date, this.ctx.today());
  }

  protected whenOf(at: ISODateTime): string {
    return whenText(at, this.ctx.today());
  }

  protected messageOf(field: string): string | null {
    return this.problems().find((p) => p.field === field)?.message ?? null;
  }

  protected setView(view: AgendaView): void {
    this.views.set(view);
  }

  /** Escolhe o dia do calendário (o calendário acompanha). */
  protected selectDay(date: ISODate | null): void {
    if (date) {
      this.selectedDate.set(date);
    }
  }

  // ===== Novo e remarcar =====

  /** Abre "Novo compromisso". Com `date` (o dia aberto no calendário), o dia já vem preenchido. */
  protected openNew(date: ISODate = ''): void {
    this.editingId.set(null);
    this.resetForm({ title: '', kind: null, date, time: '', place: '', reminder: true });
    this.formOpen.set(true);
  }

  protected openDetail(id: ID): void {
    if (!id) {
      return;
    }
    this.selectedId.set(id);
    this.detailOpen.set(true);
  }

  protected startReschedule(): void {
    const apt = this.selected();
    if (!apt) {
      return;
    }
    this.editingId.set(apt.id);
    this.resetForm({
      title: apt.title,
      kind: apt.kind,
      date: dateOf(apt.at),
      time: timeOf(apt.at),
      place: apt.place ?? '',
      reminder: apt.reminder,
    });
    // Uma folha por vez: o detalhe fecha antes de o formulário abrir.
    this.detailOpen.set(false);
    this.formOpen.set(true);
  }

  private resetForm(value: { title: string; kind: AppointmentKind | null; date: ISODate; time: string; place: string; reminder: boolean }): void {
    this.submitted.set(false);
    this.failure.set(null);
    this.form.reset(value);
  }

  protected save(): void {
    this.submitted.set(true);
    this.failure.set(null);
    const raw = this.form.getRawValue();
    if (this.problems().length > 0 || !raw.kind) {
      return;
    }
    const input: AppointmentInput = {
      title: raw.title,
      kind: raw.kind,
      date: raw.date,
      time: raw.time,
      place: raw.place,
      reminder: raw.reminder,
    };
    try {
      const editing = this.editingId();
      if (editing) {
        const { before, after } = this.agenda.update(editing, input);
        this.formOpen.set(false);
        // O calendário vai ao dia novo; o "Desfazer" volta ao de antes.
        this.selectDay(dateOf(after.at));
        this.toasts.show({
          message: `Remarcado para ${this.whenOf(after.at)}.`,
          durationMs: 8000,
          action: {
            label: 'Desfazer',
            run: () => {
              this.agenda.restore(before);
              this.selectDay(dateOf(before.at));
            },
          },
        });
      } else {
        const created = this.agenda.add(this.ctx.elderId() ?? '', input);
        this.formOpen.set(false);
        this.selectDay(dateOf(created.at));
        this.toasts.show({
          message: 'Compromisso salvo.',
          durationMs: 8000,
          action: { label: 'Desfazer', run: () => this.agenda.remove(created.id) },
        });
      }
    } catch (error) {
      if (error instanceof AgendaError) {
        // A regra do núcleo achou o que a tela não viu (a hora passou enquanto a folha estava aberta).
        this.submitted.set(true);
        this.form.updateValueAndValidity();
      }
      this.failure.set(SAVE_FAILED);
    }
  }

  // ===== Detalhe: lembrete e tirar da agenda =====

  protected setReminder(id: ID, reminder: boolean): void {
    this.agenda.setReminder(id, reminder);
  }

  protected askRemove(): void {
    this.detailOpen.set(false);
    this.confirmOpen.set(true);
  }

  protected remove(): void {
    const id = this.selectedId();
    if (!id) {
      return;
    }
    const removed = this.agenda.remove(id);
    this.confirmOpen.set(false);
    this.selectedId.set(null);
    this.toasts.show({
      message: 'Compromisso retirado.',
      durationMs: 8000,
      action: {
        label: 'Desfazer',
        run: () => {
          this.agenda.restore(removed);
          this.selectDay(dateOf(removed.at));
        },
      },
    });
  }
}
