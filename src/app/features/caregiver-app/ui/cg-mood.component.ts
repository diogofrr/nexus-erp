import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { IconComponent, IconName } from '../../../shared/ui/display/icon.component';
import { uniqueId } from '../../../shared/ui/util/ids';

export type MoodValue = 1 | 2 | 3 | 4 | 5;

export interface MoodOption {
  value: MoodValue;
  label: string;
  icon: IconName;
}

/** As 5 opções do registro de bem-estar (RN-USR-05): o rótulo é a informação, o rosto só apoia. */
export const MOOD_OPTIONS: readonly MoodOption[] = [
  { value: 1, label: 'Muito mal', icon: 'frown' },
  { value: 2, label: 'Mal', icon: 'annoyed' },
  { value: 3, label: 'Mais ou menos', icon: 'meh' },
  { value: 4, label: 'Bem', icon: 'smile' },
  { value: 5, label: 'Muito bem', icon: 'laugh' },
];

export function moodLabel(value: number | null | undefined): string {
  return MOOD_OPTIONS.find((o) => o.value === value)?.label ?? '';
}

/**
 * Seletor de humor de 5 opções (UX A.2.11): "Como você está hoje?" em UM toque. É dado de saúde: a tela só o
 * mostra se o consentimento de saúde estiver vigente. Nada vem marcado e as 5 opções têm o MESMO visual (sem
 * semáforo, sem comemoração). Letra Normal e largura de 328 px ou mais: 5 colunas; senão, lista vertical de 5
 * linhas de 56 px (o CSS decide). `value` é o que a pessoa tocou; quem grava é a tela, ao receber `chosen`.
 * Vida: cada carinha tem uma cor suave própria (frias para quentes, sem vermelho nem laranja; `--cg-mood-N-*`), sem
 * dizer "bom" ou "ruim": o rótulo é a informação. Ao escolher, a carinha cresce um pouco (sem movimento com "reduzir movimento").
 *
 * ```html
 * <app-cg-mood [value]="today()" (chosen)="save($event)" />
 * ```
 */
@Component({
  selector: 'app-cg-mood',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cg-mood-host' },
  template: `
    <div class="cg-mood" role="radiogroup" [attr.aria-label]="label()">
      @for (option of options; track option.value) {
        <label class="cg-mood__option" [attr.data-value]="option.value" [class.is-selected]="value() === option.value">
          <input
            class="cg-mood__input"
            type="radio"
            [name]="name"
            [checked]="value() === option.value"
            [attr.aria-label]="option.label + ', ' + option.value + ' de 5'"
            (change)="choose(option.value)"
          />
          <span class="cg-mood__face">
            <svg [appIcon]="option.icon" size="xl"></svg>
            @if (value() === option.value) {
              <svg class="cg-mood__check" appIcon="check" size="sm"></svg>
            }
          </span>
          <span class="cg-mood__label">{{ option.label }}</span>
        </label>
      }
    </div>
  `,
})
export class CgMoodComponent {
  readonly label = input('Como você está hoje');
  readonly value = model<MoodValue | null>(null);
  /** Nome do grupo de rádio; cada seletor na página precisa de um próprio. */
  protected readonly name = uniqueId('cg-mood');
  protected readonly options = MOOD_OPTIONS;

  /** Emite quando a pessoa toca numa opção (inclusive para mudar a de hoje). */
  readonly chosen = output<MoodValue>();

  protected choose(value: MoodValue): void {
    this.value.set(value);
    this.chosen.emit(value);
  }
}
