import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  model,
  signal,
} from '@angular/core';
import { Clock } from '../../../core/clock/clock.service';
import { yearMonthOf } from '../../../core/clock/date-utils';
import { ISODate, YearMonth } from '../../../core/models';
import { AppointmentKind } from '../../../core/rules/care-agenda';
import {
  CalendarCell,
  WEEKDAY_ABBREVIATIONS,
  WEEKDAY_NAMES,
  buildMonthGrid,
  calendarKeyTarget,
  dayLabel,
  joinNames,
  marksByDate,
  nextMonth,
  previousMonth,
  summarizeMarks,
} from '../../../core/rules/calendar-grid';
import { IconComponent } from '../../../shared/ui/display/icon.component';
import { uniqueId } from '../../../shared/ui/util/ids';

/** O tipo de um compromisso no calendário: os 4 do formulário mais a conversa do próprio cuidador ("Para você"). */
export type CgCalendarKind = AppointmentKind | 'you';

/** Um compromisso no calendário: só o dia e o tipo (o resto é da tela). */
export interface CgCalendarEvent {
  date: ISODate;
  kind: CgCalendarKind;
}

/** Na ordem da legenda. Cada tipo tem cor e forma (nunca só a cor) e o nome escrito. */
export const CG_CALENDAR_KINDS: readonly CgCalendarKind[] = ['medical', 'physio', 'psychological', 'you', 'other'];

export const CG_CALENDAR_KIND_LABELS: Readonly<Record<CgCalendarKind, string>> = {
  medical: 'Consulta',
  physio: 'Fisioterapia',
  psychological: 'Psicologia',
  you: 'Para você',
  other: 'Outro',
};

/**
 * O rótulo de leitor de tela de um dia: "6 de novembro, sexta-feira, hoje, 2 compromissos: Consulta e Fisioterapia".
 * O nome do tipo vai no rótulo porque a marca colorida sozinha não diz nada a quem não a enxerga.
 */
export function calendarDayLabel(date: ISODate, isToday: boolean, kinds: readonly CgCalendarKind[]): string {
  const parts = [dayLabel(date)];
  if (isToday) {
    parts.push('hoje');
  }
  if (kinds.length > 0) {
    const names = CG_CALENDAR_KINDS.filter((k) => kinds.includes(k)).map((k) => CG_CALENDAR_KIND_LABELS[k]);
    parts.push(`${kinds.length} ${kinds.length === 1 ? 'compromisso' : 'compromissos'}: ${joinNames(names)}`);
  }
  return parts.join(', ');
}

interface WeekView {
  /** O primeiro dia da semana: identifica a linha. */
  key: ISODate;
  days: DayView[];
}

interface DayView {
  cell: CalendarCell;
  label: string;
  shown: CgCalendarKind[];
  more: number;
  total: number;
  selected: boolean;
  tabbable: boolean;
}

/**
 * Calendário do mês (aplicativo do cuidador, Agenda). Semana de domingo a sábado, mês e ano por extenso, **Mês
 * anterior**, **Próximo mês** e **Hoje** (alvos de 48 px). Cada dia é um botão de 44 px de lado ou mais com o número,
 * uma marca por compromisso (até 3; de 4 em diante, duas marcas e "+2") e, abaixo da grade, a legenda dos tipos que
 * aparecem. A marca tem cor e forma, e o nome do tipo vai no rótulo de leitor de tela. Hoje fica num círculo cheio, o
 * dia escolhido numa caixa de borda grossa.
 *
 * Teclado (grade de datas): setas movem o foco um dia e uma semana, Home e End vão ao domingo e ao sábado da semana,
 * PageUp e PageDown ao mês anterior e ao seguinte, Enter e Espaço escolhem o dia. Um dia de outro mês (esmaecido) leva
 * a grade para o mês dele ao ser escolhido. A grade acompanha o dia escolhido por fora (`selected`).
 *
 * "Hoje" vem do `Clock`, nunca de `new Date()`. O componente só desenha e avisa: quem guarda o dia é a tela.
 *
 * ```html
 * <app-cg-calendar [events]="events()" [(selected)]="day" />
 * ```
 */
@Component({
  selector: 'app-cg-calendar',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cg-calendar-host' },
  styles: `
    :host { display: block; container: cg-cal / inline-size; }
    .cg-cal { padding-block: 0 0.25rem; border: 1px solid var(--cg-acc-strong); border-radius: var(--cg-radius-card); background: var(--cg-surface); box-shadow: var(--cg-shadow-1); overflow: hidden; }
    .cg-cal__head { display: flex; flex-wrap: wrap; align-items: center; gap: 0 0.25rem; margin-bottom: 0.25rem; padding: 0.75rem 0.5rem 0.5rem 1rem; background: var(--cg-acc-tint); }
    .cg-cal__title { flex: 1 0 100%; margin: 0 0 0.25rem; color: var(--cg-acc-ink); font-family: var(--font-serif); font-size: calc(1.5rem * var(--cg-zoom)); line-height: 1.2; }
    .cg-cal__title::first-letter { text-transform: uppercase; }
    .cg-cal__step { display: grid; place-items: center; width: var(--cg-target); height: var(--cg-target); padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--cg-acc-ink); cursor: pointer; transition: background-color var(--cg-dur) ease; }
    .cg-cal__today { min-height: var(--cg-target); margin-inline-start: auto; padding: 0 1rem; border: 2px solid var(--cg-acc-solid); border-radius: var(--cg-radius-pill); background: var(--cg-surface); color: var(--cg-acc-ink); font: inherit; font-weight: var(--fw-semibold); cursor: pointer; transition: background-color var(--cg-dur) ease; }
    .cg-cal__step:hover, .cg-cal__today:hover { background: var(--cg-surface-sunken); }
    .cg-cal__row { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
    .cg-cal__dow { padding: 0.5rem 0 0.25rem; color: var(--cg-text-soft); font-size: var(--cg-fs-caption); font-weight: var(--fw-semibold); text-align: center; }
    .cg-cal__cell { display: flex; min-width: 0; }
    .cg-cal__day { display: flex; flex: 1 1 auto; flex-direction: column; align-items: center; gap: 0.125rem; width: 100%; min-height: 3rem; padding: 0.125rem 0 0.25rem; border: 2px solid transparent; border-radius: 0.75rem; background: transparent; color: var(--cg-text); font: inherit; font-size: var(--cg-fs-body); font-variant-numeric: tabular-nums; line-height: 1.2; cursor: pointer; transition: background-color var(--cg-dur) ease; }
    .cg-cal__day:hover { background: var(--cg-surface-sunken); }
    .cg-cal__day:focus-visible { outline-offset: -4px; }
    .cg-cal__day.is-other { color: var(--cg-border-control); }
    .cg-cal__day.is-other:hover { color: var(--cg-text-soft); }
    .cg-cal__day.is-selected { border-color: var(--cg-acc-solid); background: var(--cg-acc-tint); color: var(--cg-acc-ink); }
    .cg-cal__num { display: grid; place-items: center; min-width: 1.75em; height: 1.75em; border-radius: 50%; }
    .cg-cal__day.has-events .cg-cal__num { font-weight: 700; }
    .cg-cal__day.is-today .cg-cal__num { background: var(--cg-acc-solid); color: var(--cg-surface); font-weight: 700; }
    .cg-cal__marks { display: flex; flex-wrap: nowrap; align-items: center; justify-content: center; gap: 0.125rem; min-height: 0.625rem; }
    .cg-cal__more { color: var(--cg-text-soft); font-size: calc(0.8125rem * min(var(--cg-zoom, 1), 1.1)); font-weight: var(--fw-semibold); line-height: 1; white-space: nowrap; }
    .cg-cal__mark { --mark: var(--cg-action); flex: none; box-sizing: border-box; display: inline-block; width: 0.625rem; height: 0.625rem; background: var(--mark); }
    .cg-cal__mark[data-kind='medical'] { border-radius: 50%; }
    .cg-cal__mark[data-kind='physio'] { --mark: var(--cg-ok-icon); border-radius: 2px; }
    .cg-cal__mark[data-kind='psychological'] { --mark: var(--cg-soft-icon); border-radius: 2px; transform: rotate(45deg) scale(0.85); }
    .cg-cal__mark[data-kind='you'] { --mark: var(--nx-gold-700); clip-path: polygon(50% 0, 100% 100%, 0 100%); }
    .cg-cal__mark[data-kind='other'] { border: 2px solid var(--cg-border-control); border-radius: 50%; background: transparent; }
    .cg-cal__legend { display: flex; flex-wrap: wrap; gap: 0.25rem 1rem; margin: 0.25rem 0 0; padding: 0.625rem 0.75rem 0.375rem; border-top: 1px solid var(--cg-border-subtle); color: var(--cg-text-soft); font-size: var(--cg-fs-small); list-style: none; }
    .cg-cal__legend li { display: inline-flex; align-items: center; gap: 0.375rem; }
    @container cg-cal (min-width: 28rem) { .cg-cal__title { flex: 1 1 0; min-width: 0; margin: 0; } }
    @media (min-width: 48rem) { .cg-cal__day { min-height: 3.5rem; } }
    @media (forced-colors: active) { .cg-cal__mark { forced-color-adjust: none; } .cg-cal__day.is-today .cg-cal__num { border: 2px solid CanvasText; } }
    @media (prefers-reduced-motion: reduce) { .cg-cal__day, .cg-cal__step, .cg-cal__today { transition: none; } }
  `,
  template: `
    <div class="cg-cal" role="group" aria-label="Calendário de compromissos">
      <div class="cg-cal__head">
        <p class="cg-cal__title" [id]="titleId" aria-live="polite">{{ grid().title }}</p>
        <button type="button" class="cg-cal__step" aria-label="Mês anterior" (click)="shift(-1)">
          <svg appIcon="chevron-left"></svg>
        </button>
        <button type="button" class="cg-cal__step" aria-label="Próximo mês" (click)="shift(1)">
          <svg appIcon="chevron-right"></svg>
        </button>
        <button type="button" class="cg-cal__today" (click)="goToday()">Hoje</button>
      </div>

      <div role="grid" [attr.aria-labelledby]="titleId" (keydown)="onKeydown($event)">
        <div class="cg-cal__row" role="row">
          @for (name of weekdays; track name.short) {
            <div class="cg-cal__dow" role="columnheader" [attr.aria-label]="name.long">{{ name.short }}</div>
          }
        </div>
        @for (week of rows(); track week.key) {
          <div class="cg-cal__row" role="row">
            @for (day of week.days; track day.cell.date) {
              <div class="cg-cal__cell" role="gridcell" [attr.aria-selected]="day.selected">
                <button
                  type="button"
                  class="cg-cal__day"
                  [class.is-today]="day.cell.isToday"
                  [class.is-other]="day.cell.isOtherMonth"
                  [class.is-selected]="day.selected"
                  [class.has-events]="day.total > 0"
                  [attr.data-date]="day.cell.date"
                  [attr.aria-label]="day.label"
                  [attr.aria-current]="day.cell.isToday ? 'date' : null"
                  [attr.tabindex]="day.tabbable ? 0 : -1"
                  (click)="pick(day.cell.date)"
                >
                  <span class="cg-cal__num">{{ day.cell.day }}</span>
                  <span class="cg-cal__marks" aria-hidden="true">
                    @for (kind of day.shown; track $index) {
                      <span class="cg-cal__mark" [attr.data-kind]="kind"></span>
                    }
                    @if (day.more > 0) {
                      <span class="cg-cal__more">+{{ day.more }}</span>
                    }
                  </span>
                </button>
              </div>
            }
          </div>
        }
      </div>

      @if (legend().length > 0) {
        <ul class="cg-cal__legend" aria-label="Tipos de compromisso">
          @for (item of legend(); track item.kind) {
            <li><span class="cg-cal__mark" [attr.data-kind]="item.kind" aria-hidden="true"></span>{{ item.label }}</li>
          }
        </ul>
      }
    </div>
  `,
})
export class CgCalendarComponent {
  private readonly clock = inject(Clock);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  /** Os compromissos (dia e tipo), na ordem do horário: a ordem vira a ordem das marcas de cada dia. */
  readonly events = input<readonly CgCalendarEvent[]>([]);
  /** O dia escolhido. A grade vai para o mês dele sempre que ele muda. */
  readonly selected = model<ISODate | null>(null);

  protected readonly titleId = uniqueId('cg-calendar-title');
  protected readonly weekdays = WEEKDAY_ABBREVIATIONS.map((short, i) => ({ short, long: WEEKDAY_NAMES[i] ?? short }));

  protected readonly today = computed<ISODate>(() => this.clock.today());
  /** O mês na tela: acompanha o dia escolhido (ou hoje) e muda sozinho com Mês anterior, Próximo mês e Hoje. */
  private readonly viewMonth = linkedSignal<YearMonth>(() => yearMonthOf(this.selected() ?? this.today()));
  /** O dia que o teclado alcançou por último (o "tabindex" 0 da grade). */
  private readonly focusDate = signal<ISODate | null>(null);

  protected readonly grid = computed(() => buildMonthGrid(this.viewMonth(), this.today()));

  /** Só uma célula entra na ordem do Tab: o último dia alcançado, o escolhido, hoje ou o dia 1, o que estiver no mês. */
  private readonly tabStop = computed<ISODate>(() => {
    const { first, last } = this.grid();
    const found = [this.focusDate(), this.selected(), this.today()].find((d) => !!d && d >= first && d <= last);
    return found ?? first;
  });

  protected readonly rows = computed<WeekView[]>(() => {
    const byDate = marksByDate(this.events());
    const selected = this.selected();
    const tabStop = this.tabStop();
    return this.grid().weeks.map((week) => ({
      key: week[0]?.date ?? '',
      days: week.map((cell) => {
        const kinds = byDate.get(cell.date) ?? [];
        const summary = summarizeMarks(kinds);
        return {
          cell,
          label: calendarDayLabel(cell.date, cell.isToday, kinds),
          shown: summary.shown,
          more: summary.more,
          total: summary.total,
          selected: cell.date === selected,
          tabbable: cell.date === tabStop,
        };
      }),
    }));
  });

  /** A legenda: só os tipos que aparecem na grade (e nenhuma legenda se não há compromisso à vista). */
  protected readonly legend = computed(() => {
    const weeks = this.grid().weeks;
    const from = weeks[0]?.[0]?.date ?? '';
    const to = weeks[weeks.length - 1]?.[6]?.date ?? '';
    const present = new Set(this.events().filter((e) => e.date >= from && e.date <= to).map((e) => e.kind));
    return CG_CALENDAR_KINDS.filter((kind) => present.has(kind)).map((kind) => ({
      kind,
      label: CG_CALENDAR_KIND_LABELS[kind],
    }));
  });

  protected shift(step: -1 | 1): void {
    this.viewMonth.update((month) => (step < 0 ? previousMonth(month) : nextMonth(month)));
  }

  protected goToday(): void {
    const today = this.today();
    this.viewMonth.set(yearMonthOf(today));
    this.focusDate.set(today);
    this.selected.set(today);
  }

  protected pick(date: ISODate): void {
    this.focusDate.set(date);
    this.selected.set(date);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const date = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-date]')?.dataset['date'];
    if (!date) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.pick(date);
      return;
    }
    const target = calendarKeyTarget(date, event.key);
    if (target) {
      event.preventDefault();
      this.moveFocus(target);
    }
  }

  /** Leva o foco a um dia, passando para o mês dele quando ele está fora da tela. */
  private moveFocus(date: ISODate): void {
    this.focusDate.set(date);
    const month = yearMonthOf(date);
    const focus = (): void => this.host.nativeElement.querySelector<HTMLElement>(`[data-date="${date}"]`)?.focus();
    if (month === this.viewMonth()) {
      focus();
      return;
    }
    this.viewMonth.set(month);
    afterNextRender(focus, { injector: this.injector });
  }
}
