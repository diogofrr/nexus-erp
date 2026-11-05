import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/auth';
import { Clock, addDays, addMonths, firstDayOfYearMonth, isWeekend, lastDayOfYearMonth } from '@core/clock';
import { Database } from '@core/data';
import { formatDate } from '@core/format';
import { CareSession, ISODate, SessionModality } from '@core/models';
import {
  AgendaSlot,
  AgendaStatus,
  BadgeComponent,
  EmptyStateComponent,
  FilterChipsComponent,
  FilterOption,
  IconComponent,
  PageHeaderComponent,
  SegmentOption,
  SegmentedComponent,
  SkeletonComponent,
  WeekAgendaComponent,
} from '@shared/ui';
import { ToastService } from '@shared/ui/overlay';
import { ScheduleDrawerComponent } from '../components/schedule-drawer.component';
import { dayAndMonth, mondayOf, weekCaption, weekDaysFrom } from '../state/care-helpers';
import { KIND_LABELS, MODALITY_SHORT } from '../state/care-labels';
import { CareSessionsService } from '../state/care-sessions.service';

const VIEWS: SegmentOption<'week' | 'month'>[] = [
  { value: 'week', label: 'Semana', icon: 'calendar-days' },
  { value: 'month', label: 'Mês', icon: 'calendar' },
];

interface MonthDay {
  date: ISODate;
  sessions: number;
  open: number;
}

/**
 * SCR-M05-01, Agenda (PD-07, F04). Semana (grade hora a hora; no celular, visão do dia) e mês (densidade por
 * dia). Filtros por psicólogo e modalidade. Clicar numa vaga aberta abre "Agendar sessão"; numa reservada,
 * abre o detalhe da sessão. O psicólogo vê a própria agenda, o RT consulta e o atendimento agenda em nome do
 * cuidador, sem acesso clínico. Nome do cuidador só para quem pode ver; nada clínico aparece aqui.
 */
@Component({
  selector: 'app-agenda-page',
  imports: [
    BadgeComponent,
    EmptyStateComponent,
    FilterChipsComponent,
    IconComponent,
    PageHeaderComponent,
    RouterLink,
    ScheduleDrawerComponent,
    SegmentedComponent,
    SkeletonComponent,
    WeekAgendaComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      <app-page-header title="Agenda" [description]="description()">
        @if (canSchedule()) {
          <button type="button" class="btn btn--primary" (click)="openSchedule(null)" data-role="open-schedule">
            <svg appIcon="plus" size="sm"></svg>Agendar sessão
          </button>
        }
        @if (isPsychologist()) {
          <a class="btn" routerLink="/app/atendimento/disponibilidade">Abrir ou fechar vagas</a>
        }
      </app-page-header>

      <div class="cluster cluster--between">
        <app-segmented label="Visão da agenda" [options]="views" [value]="view()" (valueChange)="setView($event)" />
        <div class="cluster">
          <button type="button" class="btn btn--sm" (click)="shift(-1)" data-role="prev">
            <svg appIcon="chevron-left" size="sm"></svg>Anterior
          </button>
          <strong class="t-ui" aria-live="polite" data-role="range">{{ rangeLabel() }}</strong>
          <button type="button" class="btn btn--sm" (click)="shift(1)" data-role="next">
            Próxima<svg appIcon="chevron-right" size="sm"></svg>
          </button>
          <button type="button" class="btn btn--sm" (click)="goToday()">Hoje</button>
        </div>
      </div>

      <div class="cluster">
        @if (psychologistChips().length > 1) {
          <app-filter-chips
            label="Psicólogo"
            [options]="psychologistChips()"
            [value]="psychologistFilter()"
            [allLabel]="view() === 'month' ? 'Todos' : ''"
            (valueChange)="setPsychologist($event)"
          />
        }
        <app-filter-chips
          label="Modalidade"
          [options]="modalityChips"
          [value]="modalityFilter()"
          (valueChange)="setModality($event)"
        />
      </div>

      @if (loading()) {
        <div aria-busy="true" aria-label="Carregando a agenda"><app-skeleton variant="block" /></div>
      } @else if (psychologistChips().length === 0) {
        <app-empty-state
          title="Nenhum psicólogo na agenda"
          text="Só psicólogos com CRP ativo aparecem aqui. Quando houver, a agenda semanal aparece neste lugar."
        />
      } @else if (view() === 'week') {
        @if (openCount() === 0 && !hasAnySlot()) {
          <app-empty-state
            title="Sem vagas nesta semana"
            [text]="emptyText()"
          >
            <button type="button" class="btn" (click)="shift(1)">Ver a próxima semana</button>
            @if (isPsychologist()) {
              <a class="btn btn--primary" routerLink="/app/atendimento/disponibilidade">Abrir vagas</a>
            }
          </app-empty-state>
        }
        <app-week-agenda
          [caption]="caption()"
          [days]="days()"
          [slots]="slots()"
          (slotSelected)="onSlot($event)"
        />
        <p class="t-caption">
          @if (canSchedule()) {
            Clique numa vaga aberta para agendar uma sessão. Clique numa vaga reservada para ver a sessão.
          } @else {
            Clique numa vaga reservada para ver a sessão. Seu perfil consulta a agenda, sem agendar.
          }
        </p>
      } @else {
        <section aria-label="Densidade do mês" class="stack stack--3">
          <p class="t-ui">
            Cada linha mostra quantas sessões e quantas vagas abertas há no dia. Escolha um dia para ver a semana.
          </p>
          <ul class="list-card" role="list" data-role="month-list">
            @for (day of monthDays(); track day.date) {
              <li>
                <button type="button" class="list-row" (click)="openWeek(day.date)">
                  <span class="t-num">{{ dayLabel(day.date) }}</span>&ngsp;
                  <span class="list-row__meta">{{ day.sessions }} {{ day.sessions === 1 ? 'sessão' : 'sessões' }}</span>&ngsp;
                  <app-badge [variant]="day.open > 0 ? 'info' : 'neutral'" [outline]="day.open === 0" icon="circle-dashed">
                    {{ day.open }} {{ day.open === 1 ? 'vaga aberta' : 'vagas abertas' }}
                  </app-badge>
                </button>
              </li>
            }
          </ul>
        </section>
      }

      @if (isPsychologist() || isTechnicalLead()) {
        <p class="t-ui">
          <svg appIcon="heart-pulse" size="sm"></svg>
          <a routerLink="/app/acompanhamento/fila">Ver a fila de acompanhamento</a>
        </p>
      }
    </div>

    <app-schedule-drawer
      [(open)]="scheduleOpen"
      [presetSlotId]="presetSlot()"
      [presetCaregiverId]="presetCaregiver()"
    />
  `,
})
export class AgendaPageComponent {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly auth = inject(AuthService);
  private readonly svc = inject(CareSessionsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });

  protected readonly views = VIEWS;
  protected readonly modalityChips: FilterOption[] = (
    ['online', 'in_person_coworking', 'in_person_home'] as SessionModality[]
  ).map((value) => ({ value, label: MODALITY_SHORT[value] }));

  protected readonly loading = signal(false);
  protected readonly scheduleOpen = signal(false);
  protected readonly presetSlot = signal<string | null>(null);
  protected readonly presetCaregiver = signal<string | null>(null);

  protected readonly isPsychologist = computed(() => this.auth.role() === 'psychologist');
  protected readonly isTechnicalLead = computed(() => this.auth.role() === 'technical_lead');
  protected readonly isSupport = computed(() => this.auth.role() === 'support');
  protected readonly canSchedule = computed(() => this.auth.can('care_schedule', 'create'));

  protected readonly view = computed<'week' | 'month'>(() => (this.query().get('visao') === 'mes' ? 'month' : 'week'));
  private readonly anchor = computed(() => this.query().get('semana') ?? this.clock.today());
  protected readonly monday = computed(() => mondayOf(this.anchor()));
  protected readonly days = computed(() => weekDaysFrom(this.monday()));
  protected readonly caption = computed(() => weekCaption(this.days()));
  protected readonly modalityFilter = computed(() => this.query().get('modalidade'));

  private readonly myPsychologist = computed(() => this.auth.actor()?.psychologistId ?? null);
  private readonly psychologists = computed(() =>
    this.svc.activePsychologists().filter((p) => this.myPsychologist() === null || p.id === this.myPsychologist()),
  );
  protected readonly psychologistChips = computed<FilterOption[]>(() =>
    this.psychologists().map((p) => ({ value: p.id, label: p.displayName })),
  );
  /** A grade mostra um psicólogo por vez; o mês pode somar todos. */
  protected readonly psychologistFilter = computed(() => {
    const wanted = this.query().get('psicologo');
    const list = this.psychologists();
    if (wanted && list.some((p) => p.id === wanted)) {
      return wanted;
    }
    if (this.view() === 'month' && !wanted) {
      return null;
    }
    return list[0]?.id ?? null;
  });

  protected readonly description = computed(() =>
    this.isPsychologist()
      ? 'Sua agenda: vagas abertas, sessões reservadas e confirmadas.'
      : 'Vagas abertas, reservadas e bloqueadas, por psicólogo.',
  );
  protected readonly rangeLabel = computed(() => {
    if (this.view() === 'month') {
      return monthName(firstDayOfYearMonth(this.anchor().slice(0, 7)));
    }
    const d = this.days();
    return `${formatDate(d[0])} a ${formatDate(d[4])}`;
  });

  private readonly bookedSessions = computed(() => {
    const byslot = new Map<string, CareSession>();
    this.db.careSessions.all().forEach((s) => {
      if (s.status === 'scheduled' || s.status === 'confirmed' || s.status === 'done' || s.status === 'no_show') {
        byslot.set(s.slotId, s);
      }
    });
    return byslot;
  });

  protected readonly slots = computed<AgendaSlot[]>(() => {
    const psy = this.psychologistFilter();
    if (!psy) {
      return [];
    }
    const days = new Set(this.days());
    const modality = this.modalityFilter();
    const now = this.clock.now();
    const sessions = this.bookedSessions();
    const names = this.db.caregivers;
    const result: AgendaSlot[] = [];
    this.db.availabilitySlots.all().forEach((slot) => {
      if (slot.psychologistId !== psy || !days.has(slot.date)) {
        return;
      }
      const session = sessions.get(slot.id);
      if (session) {
        if (modality && session.modality !== modality) {
          return;
        }
        const caregiver = names.get(session.caregiverId);
        result.push({
          id: slot.id,
          date: slot.date,
          time: slot.start,
          status: SESSION_TO_AGENDA[session.status] ?? 'booked',
          label: caregiver?.fullName ?? 'Cuidador',
          detail: `${MODALITY_SHORT[session.modality]}, ${KIND_LABELS[session.kind]}`,
        });
        return;
      }
      if (slot.status === 'blocked') {
        result.push({ id: slot.id, date: slot.date, time: slot.start, status: 'blocked' });
        return;
      }
      if (this.svc.isSlotFree(slot) && this.svc.startOf(slot) > now) {
        const status: AgendaStatus = slot.priorityOnly && !this.isSupport() ? 'priority' : 'open';
        result.push({ id: slot.id, date: slot.date, time: slot.start, status });
      }
    });
    return result;
  });

  protected readonly openCount = computed(
    () => this.slots().filter((s) => s.status === 'open' || s.status === 'priority').length,
  );
  protected readonly hasAnySlot = computed(() => this.slots().length > 0);
  protected readonly emptyText = computed(() => {
    const psy = this.db.psychologists.get(this.psychologistFilter() ?? '');
    return `Sem vagas abertas nesta semana para ${psy?.displayName ?? 'o psicólogo'}. Veja a próxima semana ou escolha outro psicólogo.`;
  });

  protected readonly monthDays = computed<MonthDay[]>(() => {
    const first = firstDayOfYearMonth(this.anchor().slice(0, 7));
    const last = lastDayOfYearMonth(this.anchor().slice(0, 7));
    const psy = this.psychologistFilter();
    const modality = this.modalityFilter();
    const sessions = this.bookedSessions();
    const now = this.clock.now();
    const perDay = new Map<ISODate, MonthDay>();
    for (let d = first; d <= last; d = addDays(d, 1)) {
      if (!isWeekend(d)) {
        perDay.set(d, { date: d, sessions: 0, open: 0 });
      }
    }
    this.db.availabilitySlots.all().forEach((slot) => {
      const day = perDay.get(slot.date);
      if (!day || (psy && slot.psychologistId !== psy)) {
        return;
      }
      const session = sessions.get(slot.id);
      if (session) {
        if (!modality || session.modality === modality) {
          day.sessions += 1;
        }
      } else if (slot.status !== 'blocked' && this.svc.isSlotFree(slot) && this.svc.startOf(slot) > now) {
        day.open += 1;
      }
    });
    return [...perDay.values()];
  });

  constructor() {
    // `?acao=agendar&cuidador=cg_0003` abre o diálogo já preenchido (paleta de comandos e ficha do cuidador).
    effect(() => {
      const q = this.query();
      if (q.get('acao') !== 'agendar') {
        return;
      }
      untracked(() => {
        if (this.canSchedule()) {
          this.openSchedule(null, q.get('cuidador'));
        }
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { acao: null, cuidador: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      });
    });
  }

  protected openSchedule(slotId: string | null, caregiverId: string | null = null): void {
    this.presetSlot.set(slotId);
    this.presetCaregiver.set(caregiverId);
    this.scheduleOpen.set(true);
  }

  protected onSlot(slot: AgendaSlot): void {
    if (this.bookedSessions().has(slot.id)) {
      const session = this.bookedSessions().get(slot.id) as CareSession;
      void this.router.navigate(['/app/atendimento/sessoes', session.id]);
      return;
    }
    if (!this.canSchedule()) {
      this.toasts.attention('Seu perfil consulta a agenda. Quem agenda é o psicólogo ou o atendimento.');
      return;
    }
    this.openSchedule(slot.id);
  }

  private navigateTo(params: Record<string, string | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected setView(view: 'week' | 'month' | undefined): void {
    this.navigateTo({ visao: view === 'month' ? 'mes' : null });
  }

  protected setPsychologist(id: string | null): void {
    this.navigateTo({ psicologo: id });
  }

  protected setModality(value: string | null): void {
    this.navigateTo({ modalidade: value });
  }

  protected shift(direction: -1 | 1): void {
    const target =
      this.view() === 'month'
        ? addMonths(firstDayOfYearMonth(this.anchor().slice(0, 7)), direction)
        : addDays(this.monday(), direction * 7);
    this.navigateTo({ semana: target });
  }

  protected goToday(): void {
    this.navigateTo({ semana: null });
  }

  protected openWeek(date: ISODate): void {
    this.navigateTo({ semana: date, visao: null });
  }

  protected dayLabel(date: ISODate): string {
    return dayAndMonth(date);
  }
}

const SESSION_TO_AGENDA: Partial<Record<CareSession['status'], AgendaStatus>> = {
  scheduled: 'booked',
  confirmed: 'confirmed',
  done: 'done',
  no_show: 'noshow',
};

const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

function monthName(date: ISODate): string {
  return `${MONTHS[Number(date.slice(5, 7)) - 1] ?? ''} de ${date.slice(0, 4)}`;
}
