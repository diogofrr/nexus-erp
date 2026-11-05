import { ChangeDetectionStrategy, Component, DestroyRef, booleanAttribute, computed, inject, input, signal } from '@angular/core';
import { Clock } from '@core/clock';
import { formatDate, formatDuration } from '@core/format';
import { ISODateTime } from '@core/models';
import { redAlertMinutesLeft } from '@core/rules';
import { BadgeComponent, IconComponent } from '@shared/ui';

const TICK_MS = 30_000;

/**
 * Cronômetro do prazo de contato do alerta vermelho (PD-14, A-27, UX 7.3): "Faltam 6 h 19 min" até as 23:59, ou
 * "Vencido há 18 h". Atualiza a cada 30 segundos. É texto e ícone, calmo: nada pisca nem toca. Leitores de
 * tela recebem o texto, sem anúncio a cada atualização.
 */
@Component({
  selector: 'app-alert-countdown',
  imports: [BadgeComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (large()) {
      <div class="deadline" data-role="countdown" [attr.data-state]="state()">
        <svg appIcon="clock"></svg>
        <div>
          <div class="deadline__time">{{ duration() }}</div>
          <div class="deadline__label">{{ label() }}</div>
        </div>
      </div>
    } @else {
      <app-badge variant="danger" icon="clock" data-role="countdown" [attr.data-state]="state()">{{ short() }}</app-badge>
    }
  `,
})
export class AlertCountdownComponent {
  private readonly clock = inject(Clock);
  private readonly tick = signal(0);

  /** Prazo do alerta (23:59 do dia da aplicação). */
  readonly deadlineAt = input.required<ISODateTime>();
  /** Versão grande, do cabeçalho do alerta. */
  readonly large = input(false, { transform: booleanAttribute });

  protected readonly minutes = computed(() => {
    this.tick();
    return redAlertMinutesLeft({ deadlineAt: this.deadlineAt() }, this.clock.now()) ?? 0;
  });
  protected readonly state = computed(() => (this.minutes() >= 0 ? 'on_time' : 'overdue'));
  protected readonly duration = computed(() => formatDuration(Math.abs(this.minutes())));
  protected readonly short = computed(() =>
    this.minutes() >= 0 ? `Faltam ${this.duration()}` : `Vencido há ${this.duration()}`,
  );
  protected readonly label = computed(() => {
    const date = this.deadlineAt().slice(0, 10);
    const today = this.clock.today();
    if (this.minutes() >= 0) {
      return date === today ? 'Prazo hoje, 23:59' : `Prazo em ${formatDate(date)}, 23:59`;
    }
    return `Prazo de contato venceu em ${formatDate(date)} às 23:59. Escalado ao responsável técnico.`;
  });

  constructor() {
    const timer = setInterval(() => this.tick.update((n) => n + 1), TICK_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
