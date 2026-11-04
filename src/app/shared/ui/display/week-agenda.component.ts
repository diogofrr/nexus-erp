import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { Clock, weekday } from '@core/clock';
import { formatDate } from '@core/format';
import type { ISODate, TimeOfDay } from '@core/models';
import { BadgeComponent, BadgeVariant } from './badge.component';
import { IconComponent, IconName } from './icon.component';

export type AgendaStatus = 'open' | 'booked' | 'confirmed' | 'priority' | 'blocked' | 'done' | 'noshow';

export interface AgendaSlot {
  id: string;
  date: ISODate;
  /** Hora cheia `HH:mm` (uma vaga por hora). */
  time: TimeOfDay;
  status: AgendaStatus;
  /** Quem reservou (já mascarado ou pseudonimizado pelo chamador). Só para quem pode ver. */
  label?: string;
  /** Linha extra (modalidade, sala). */
  detail?: string;
}

interface StatusView {
  text: string;
  icon: IconName;
  variant: BadgeVariant;
  outline: boolean;
}

/** Estado = cor + ÍCONE + TEXTO (PD-07): nunca só cor. */
export const AGENDA_STATUS: Readonly<Record<AgendaStatus, StatusView>> = {
  open: { text: 'Aberta', icon: 'circle-dashed', variant: 'neutral', outline: true },
  booked: { text: 'Reservada', icon: 'user', variant: 'info', outline: false },
  confirmed: { text: 'Confirmada', icon: 'circle-check', variant: 'success', outline: false },
  priority: { text: 'Vaga prioritária', icon: 'star', variant: 'gold', outline: false },
  blocked: { text: 'Bloqueada', icon: 'ban', variant: 'neutral', outline: true },
  done: { text: 'Realizada', icon: 'check', variant: 'neutral', outline: false },
  noshow: { text: 'Falta', icon: 'circle-alert', variant: 'danger', outline: false },
};

const STATUS_ORDER: readonly AgendaStatus[] = ['open', 'booked', 'confirmed', 'priority', 'blocked', 'done', 'noshow'];
const DAY_NAMES = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const;

interface DayView {
  date: ISODate;
  name: string;
  dayOfMonth: string;
  short: string;
  today: boolean;
}

/**
 * Agenda semanal (PD-07, segunda a sexta, hora a hora). No computador é uma grade `role="grid"`: setas movem
 * entre vagas, Home e End vão às pontas da linha, Enter abre a vaga (`slotSelected`). Hoje leva a linha
 * dourada no cabeçalho e há a linha do "agora". Há legenda em texto e a contagem de vagas abertas. NO CELULAR
 * não há grade espremida: entra a visão do dia, com seletor de dias e lista de vagas.
 *
 * ```html
 * <app-week-agenda caption="Agenda da semana de 02 a 06 de novembro" [days]="week" [slots]="slots" (slotSelected)="open($event)" />
 * ```
 */
@Component({
  selector: 'app-week-agenda',
  imports: [BadgeComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="t-ui" aria-live="polite"><strong class="t-num">{{ openCount() }}</strong> {{ openCount() === 1 ? 'vaga aberta' : 'vagas abertas' }} {{ openScope() }}</p>
    <div class="agenda-legend" aria-label="Legenda" role="list">
      @for (status of statuses; track status) {
        <span role="listitem"><svg [appIcon]="view(status).icon" size="sm"></svg>{{ view(status).text }}</span>
      }
    </div>

    <div class="hide-sm">
      <div class="agenda" role="grid" [attr.aria-label]="caption()" [attr.aria-rowcount]="hours().length + 1" (keydown)="onGridKey($event)">
        <div class="agenda__row" role="row">
          <div class="agenda__corner" role="columnheader"><span class="sr-only">Hora</span></div>
          @for (day of dayViews(); track day.date) {
            <div class="agenda__dayhead" role="columnheader" [class.is-today]="day.today" [attr.aria-current]="day.today ? 'date' : null">
              {{ day.name }}<strong>{{ day.dayOfMonth }}</strong>
            </div>
          }
        </div>
        @for (hour of hours(); track hour; let r = $index) {
          <div class="agenda__row" role="row">
            <div class="agenda__time" role="rowheader">{{ hour }}</div>
            @for (day of dayViews(); track day.date; let c = $index) {
              <div class="agenda__cell" role="gridcell">
                @if (slotAt(day.date, hour); as slot) {
                  <button
                    type="button"
                    [class]="'slot slot--' + slot.status"
                    [attr.data-r]="r"
                    [attr.data-c]="c"
                    [attr.tabindex]="r === tabStop().row && c === tabStop().col ? 0 : -1"
                    [attr.aria-disabled]="slot.status === 'blocked' ? 'true' : null"
                    [attr.aria-label]="slotLabel(slot, day)"
                    (focus)="active.set({ row: r, col: c })"
                    (click)="choose(slot)"
                  >
                    <b><svg [appIcon]="view(slot.status).icon" size="sm"></svg>{{ view(slot.status).text }}</b>
                    @if (slot.label) {
                      <span>{{ slot.label }}</span>
                    }
                  </button>
                } @else {
                  <span class="sr-only">Sem vaga</span>
                }
                @if (nowOffset(day, hour); as offset) {
                  <span class="agenda__now" aria-hidden="true" [style.top.%]="offset"></span>
                }
              </div>
            }
          </div>
        }
      </div>
    </div>

    <div class="show-sm stack">
      <div class="day-picker" role="group" aria-label="Dia da agenda">
        @for (day of dayViews(); track day.date) {
          <button type="button" class="chip" [attr.aria-pressed]="day.date === currentDay()" (click)="selectedDay.set(day.date)">
            <span>{{ day.name }}&ngsp;</span><b>{{ day.dayOfMonth }}</b>
          </button>
        }
        @if (todayInWeek()) {
          <button type="button" class="chip" (click)="selectedDay.set(today())">Hoje</button>
        }
      </div>
      <div class="list-card">
        @for (slot of daySlots(); track slot.id) {
          <button type="button" class="list-row" [attr.aria-disabled]="slot.status === 'blocked' ? 'true' : null" (click)="choose(slot)">
            <span class="t-num">{{ slot.time }}</span>&ngsp;
            <span>
              <span class="list-row__title">{{ slot.label ?? view(slot.status).text }}</span>
              @if (slot.detail) {
                <span class="list-row__meta">{{ slot.detail }}</span>
              }
            </span>&ngsp;
            <app-badge [variant]="view(slot.status).variant" [outline]="view(slot.status).outline" [icon]="view(slot.status).icon">{{ view(slot.status).text }}</app-badge>
          </button>
        } @empty {
          <p class="t-muted p-4">Não há vagas neste dia.</p>
        }
      </div>
    </div>
  `,
})
export class WeekAgendaComponent {
  private readonly clock = inject(Clock);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** As datas da semana (segunda a sexta), em ordem. */
  readonly days = input.required<readonly ISODate[]>();
  readonly slots = input.required<readonly AgendaSlot[]>();
  /** Nome da grade para leitor de tela ("Agenda da semana de 02 a 06 de novembro"). */
  readonly caption = input.required<string>();
  readonly startHour = input(8);
  readonly endHour = input(18);
  /** Hoje. Sem valor, usa o `Clock`. */
  readonly todayOverride = input<ISODate | undefined>(undefined, { alias: 'today' });
  /** Dia mostrado na visão do celular. */
  readonly selectedDay = model<ISODate>();
  readonly slotSelected = output<AgendaSlot>();

  protected readonly statuses = STATUS_ORDER;
  protected readonly active = signal({ row: 0, col: 0 });
  /** A vaga que entra na ordem do Tab: a ativa, ou a primeira que existir. */
  protected readonly tabStop = computed(() => {
    const current = this.active();
    if (this.hasSlot(current.row, current.col)) {
      return current;
    }
    for (let row = 0; row < this.hours().length; row += 1) {
      for (let col = 0; col < this.days().length; col += 1) {
        if (this.hasSlot(row, col)) {
          return { row, col };
        }
      }
    }
    return current;
  });

  protected readonly today = computed(() => this.todayOverride() ?? this.clock.today());
  protected readonly hours = computed(() => {
    const list: TimeOfDay[] = [];
    for (let h = this.startHour(); h < this.endHour(); h += 1) {
      list.push(`${String(h).padStart(2, '0')}:00`);
    }
    return list;
  });
  protected readonly dayViews = computed<DayView[]>(() =>
    this.days().map((date) => {
      const name = DAY_NAMES[weekday(date)] ?? '';
      const dayOfMonth = date.slice(8, 10);
      return { date, name, dayOfMonth, short: `${name} ${dayOfMonth}`, today: date === this.today() };
    }),
  );
  protected readonly todayInWeek = computed(() => this.days().includes(this.today()));
  protected readonly currentDay = computed(() => {
    const wanted = this.selectedDay();
    return wanted && this.days().includes(wanted) ? wanted : this.todayInWeek() ? this.today() : (this.days()[0] ?? '');
  });
  protected readonly daySlots = computed(() =>
    this.slots()
      .filter((s) => s.date === this.currentDay())
      .sort((a, b) => a.time.localeCompare(b.time)),
  );
  protected readonly openCount = computed(() => this.slots().filter((s) => s.status === 'open' || s.status === 'priority').length);
  protected readonly openScope = computed(() => 'nesta semana');

  protected view(status: AgendaStatus): StatusView {
    return AGENDA_STATUS[status];
  }

  protected slotAt(date: ISODate, hour: TimeOfDay): AgendaSlot | undefined {
    return this.slots().find((s) => s.date === date && s.time === hour);
  }

  protected slotLabel(slot: AgendaSlot, day: DayView): string {
    const parts = [`${day.name} ${formatDate(slot.date)}`, slot.time, this.view(slot.status).text];
    if (slot.label) {
      parts.push(slot.label);
    }
    if (slot.detail) {
      parts.push(slot.detail);
    }
    return parts.join(', ');
  }

  /** Posição (em %) da linha do "agora" dentro da célula da hora atual, ou 0 se não é agora. */
  protected nowOffset(day: DayView, hour: TimeOfDay): number {
    if (!day.today) {
      return 0;
    }
    const now = this.clock.now();
    if (now.slice(0, 10) !== day.date || now.slice(11, 13) !== hour.slice(0, 2)) {
      return 0;
    }
    return Math.max(1, Math.round((Number(now.slice(14, 16)) / 60) * 100));
  }

  protected choose(slot: AgendaSlot): void {
    if (slot.status !== 'blocked') {
      this.slotSelected.emit(slot);
    }
  }

  private hasSlot(row: number, col: number): boolean {
    const date = this.days()[col];
    const hour = this.hours()[row];
    return date !== undefined && hour !== undefined && this.slotAt(date, hour) !== undefined;
  }

  /** Anda na direção pedida até achar uma célula com vaga; sem vaga adiante, fica onde está. */
  private walk(row: number, col: number, dRow: number, dCol: number): { row: number; col: number } | null {
    let r = row + dRow;
    let c = col + dCol;
    while (r >= 0 && r < this.hours().length && c >= 0 && c < this.days().length) {
      if (this.hasSlot(r, c)) {
        return { row: r, col: c };
      }
      r += dRow;
      c += dCol;
    }
    return null;
  }

  protected onGridKey(event: KeyboardEvent): void {
    const { row, col } = this.tabStop();
    let next: { row: number; col: number } | null;
    switch (event.key) {
      case 'ArrowRight':
        next = this.walk(row, col, 0, 1);
        break;
      case 'ArrowLeft':
        next = this.walk(row, col, 0, -1);
        break;
      case 'ArrowDown':
        next = this.walk(row, col, 1, 0);
        break;
      case 'ArrowUp':
        next = this.walk(row, col, -1, 0);
        break;
      case 'Home':
        next = this.hasSlot(row, 0) ? { row, col: 0 } : this.walk(row, 0, 0, 1);
        break;
      case 'End': {
        const last = this.days().length - 1;
        next = this.hasSlot(row, last) ? { row, col: last } : this.walk(row, last, 0, -1);
        break;
      }
      default:
        return;
    }
    event.preventDefault();
    if (next) {
      this.active.set(next);
      this.host.nativeElement.querySelector<HTMLElement>(`[data-r="${next.row}"][data-c="${next.col}"]`)?.focus();
    }
  }
}
