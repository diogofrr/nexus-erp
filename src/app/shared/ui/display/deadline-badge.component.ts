import { ChangeDetectionStrategy, Component, booleanAttribute, computed, inject, input } from '@angular/core';
import { Clock, daysBetween, dateOf } from '@core/clock';
import { formatDate, formatDateTime, formatTime } from '@core/format';
import type { ISODate, ISODateTime } from '@core/models';
import { businessMinutesBetween } from '@core/rules';
import { IconComponent } from './icon.component';

export type DeadlineTone = 'ok' | 'attention' | 'danger' | 'done';

export interface DeadlineView {
  tone: DeadlineTone;
  /** "No prazo", "Faltam 1 h 20 min úteis", "Atrasada há 6 h úteis". */
  label: string;
  /** Prazo por extenso ("Prazo: hoje, 17:00"), para foco e leitores de tela. */
  absolute: string;
}

function duration(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) {
    return `${rest} min`;
  }
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

function plural(n: number): string {
  return n === 1 ? 'dia' : 'dias';
}

/** Cálculo puro do selo em horas úteis (mensagens, SLA do canal). Exportado para teste e reuso. */
export function businessDeadlineView(
  due: ISODateTime,
  now: ISODateTime,
  warnMinutes = 120,
): DeadlineView {
  const today = dateOf(now);
  const day = dateOf(due);
  const when = day === today ? 'hoje' : formatDate(day);
  const absolute = `Prazo: ${when}, ${formatTime(due)}`;
  if (due > now) {
    const left = businessMinutesBetween(now, due);
    return left <= warnMinutes
      ? { tone: 'attention', label: `Faltam ${duration(left)} úteis`, absolute }
      : { tone: 'ok', label: 'No prazo', absolute };
  }
  if (due === now) {
    return { tone: 'attention', label: 'Vence agora', absolute };
  }
  return { tone: 'danger', label: `Atrasada há ${duration(businessMinutesBetween(due, now))} úteis`, absolute };
}

/** Cálculo puro do selo em dias corridos (solicitações do titular: 15 dias; âmbar até 3 dias, vermelho vencido). */
export function calendarDeadlineView(due: ISODate, today: ISODate, warnDays = 3): DeadlineView {
  const remaining = daysBetween(today, due);
  const absolute = `Prazo: ${formatDate(due)}`;
  if (remaining < 0) {
    const late = Math.abs(remaining);
    return { tone: 'danger', label: `Vencida há ${late} ${plural(late)}`, absolute };
  }
  if (remaining === 0) {
    return { tone: 'attention', label: 'Vence hoje', absolute };
  }
  if (remaining <= warnDays) {
    return { tone: 'attention', label: `Vence em ${remaining} ${plural(remaining)}`, absolute };
  }
  return { tone: 'ok', label: `Vence em ${remaining} ${plural(remaining)}`, absolute };
}

/**
 * Selo de prazo (PD-14): relógio, texto e cor juntos. Estado em palavras ("No prazo", "Faltam 1 h 20 min
 * úteis", "Atrasada há 6 h úteis"); o horário absoluto aparece em `title` e para leitor de tela, e o selo
 * é focável por teclado. O "agora" vem do `Clock` (real ou simulado).
 *
 * ```html
 * <app-deadline-badge [due]="message.dueAt" />                         <!-- horas úteis -->
 * <app-deadline-badge [due]="request.dueAt" unit="days" />             <!-- dias corridos -->
 * <app-deadline-badge [due]="alert.deadlineAt" [done]="alert.status === 'closed'" />
 * ```
 */
@Component({
  selector: 'app-deadline-badge',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'classes()',
    tabindex: '0',
    '[attr.title]': 'view().absolute',
  },
  template: `
    <svg [appIcon]="view().tone === 'done' ? 'circle-check' : 'clock'"></svg>
    {{ view().label }}
    <span class="sr-only">. {{ view().absolute }}</span>
  `,
})
export class DeadlineBadgeComponent {
  private readonly clock = inject(Clock);
  /** Prazo: `ISODateTime` (horas úteis) ou `ISODate` (dias). */
  readonly due = input.required<ISODate | ISODateTime>();
  /** `business-hours` conta minutos úteis (seg a sex, 8h às 18h); `days` conta dias corridos. */
  readonly unit = input<'business-hours' | 'days'>('business-hours');
  /** Já resolvido: mostra "Concluída" em vez do tempo. */
  readonly done = input(false, { transform: booleanAttribute });
  /** Âmbar quando faltam no máximo estes minutos úteis (padrão 120) ou, em dias, 3. */
  readonly warnAt = input<number>();

  protected readonly view = computed<DeadlineView>(() => {
    const due = this.due();
    const absolute = due.length > 10 ? `Prazo: ${formatDateTime(due)}` : `Prazo: ${formatDate(due)}`;
    if (this.done()) {
      return { tone: 'done', label: 'Concluída', absolute };
    }
    const now = this.clock.now();
    if (this.unit() === 'days') {
      return calendarDeadlineView(due.length > 10 ? dateOf(due) : due, dateOf(now), this.warnAt() ?? 3);
    }
    return businessDeadlineView(due.length === 10 ? `${due}T23:59:00-03:00` : due, now, this.warnAt() ?? 120);
  });

  protected readonly classes = computed(() => {
    const tone = this.view().tone;
    const variant =
      tone === 'danger' ? 'badge--danger' : tone === 'attention' ? 'badge--attention' : tone === 'done' ? 'badge--success' : 'badge--info';
    return `badge ${variant}`;
  });
}
