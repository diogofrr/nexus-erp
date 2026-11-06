import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Clock } from '../../../core/clock/clock.service';
import { minutesBetween, timeOf, toIsoDateTime } from '../../../core/clock/date-utils';
import { DoseSlot } from '../../../core/rules/medication-doses';
import { IconComponent } from '../../../shared/ui/display/icon.component';

/** Estado visual da dose (UX A.2.12). */
export type CgDoseState = 'later' | 'due' | 'late' | 'given';

/**
 * Tamanho da linha: `large` é a variante "por pessoa" de quem tem pouca familiaridade digital (UX C6, o João): a hora
 * em 22 px e o botão **Dei** com 96 px de largura. Quem decide é a tela, pelo `CaregiverContextService.doseSize()`.
 */
export type CgDoseSize = 'default' | 'large';

/** Até quantos minutos antes do horário o botão "Dei" já fica em destaque (UX A.2.12). */
export const DOSE_DUE_WINDOW_MIN = 30;

/**
 * Marcação "dei o remédio" (UX A.2.12): uma linha por dose do dia, com o botão **Dei** (uma marcação por toque,
 * "dado agora" pelo relógio do sistema). Estados: a dar (botão secundário); no horário ou até 30 minutos antes
 * (primário); passou do horário (nota âmbar "Passou do horário (08:00)", que é só da pessoa idosa, nunca da saúde
 * emocional); dado (fundo verde, "Dado às 08:12" e o botão de texto "Desfazer"). A linha não muda de lugar ao
 * marcar. O componente só desenha e avisa: quem grava é a tela, com `DoseCheckService`. `size="large"` é a variante de
 * quem tem pouca familiaridade digital (hora em 22 px, **Dei** de 96 px).
 *
 * ```html
 * @for (slot of slots(); track slot.key) {
 *   <app-cg-dose [slot]="slot" [size]="ctx.doseSize()" (dei)="doses.mark($event.medicationId, $event.date, $event.time)"
 *                (undo)="doses.unmark($event.medicationId, $event.date, $event.time)" />
 * }
 * ```
 */
@Component({
  selector: 'app-cg-dose',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cg-dose-host' },
  template: `
    <div
      class="cg-dose"
      [class.is-given]="state() === 'given'"
      [class.is-late]="state() === 'late'"
      [class.cg-dose--large]="size() === 'large'"
    >
      <span class="cg-dose__icon"><svg appIcon="pill" size="lg"></svg></span>
      <span class="cg-dose__text">
        <span class="cg-dose__name">{{ slot().medicationName }}</span>
        <span class="cg-dose__dosage">{{ slot().dosage }}</span>
        @if (state() === 'given') {
          <span class="cg-dose__state cg-dose__state--ok">
            <svg appIcon="circle-check" size="sm"></svg>Dado às {{ givenTime() }}
          </span>
        } @else if (state() === 'late') {
          <span class="cg-dose__state cg-dose__state--late">
            <svg appIcon="clock" size="sm"></svg>Passou do horário ({{ slot().time }})
          </span>
        }
      </span>
      <span class="cg-dose__time">{{ slot().time }}</span>
      @if (state() === 'given') {
        <button
          type="button"
          class="cg-link-btn cg-dose__action"
          [attr.aria-label]="'Desfazer: ' + slot().medicationName + ' das ' + slot().time + ' dado às ' + givenTime()"
          (click)="undo.emit(slot())"
        >
          Desfazer
        </button>
      } @else {
        <button
          type="button"
          class="btn cg-dose__action"
          [class.btn--primary]="state() !== 'later'"
          [attr.aria-label]="'Dei o ' + slot().medicationName + ' das ' + slot().time"
          (click)="dei.emit(slot())"
        >
          Dei
        </button>
      }
    </div>
  `,
})
export class CgDoseComponent {
  private readonly clock = inject(Clock);

  readonly slot = input.required<DoseSlot>();
  /** `large` para quem tem pouca familiaridade digital (UX C6, "por pessoa"). */
  readonly size = input<CgDoseSize>('default');
  /** A pessoa tocou em "Dei". */
  readonly dei = output<DoseSlot>();
  /** A pessoa tocou em "Desfazer". */
  readonly undo = output<DoseSlot>();

  protected readonly givenTime = computed(() => {
    const at = this.slot().givenAt;
    return at ? timeOf(at) : '';
  });

  protected readonly state = computed<CgDoseState>(() => {
    const slot = this.slot();
    if (slot.given) {
      return 'given';
    }
    const minutesToDose = minutesBetween(this.clock.now(), toIsoDateTime(slot.date, slot.time));
    // Só passa do horário depois de 1 minuto cheio (o segundo da hora marcada ainda é o horário).
    if (Math.ceil(minutesToDose) < 0) {
      return 'late';
    }
    return minutesToDose <= DOSE_DUE_WINDOW_MIN ? 'due' : 'later';
  });
}
