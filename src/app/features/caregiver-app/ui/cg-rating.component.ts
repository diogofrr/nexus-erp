import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { uniqueId } from '../../../shared/ui/util/ids';

export type CgRatingValue = 1 | 2 | 3 | 4 | 5;

const SCORES: readonly CgRatingValue[] = [1, 2, 3, 4, 5];

/**
 * Seletor de nota de 1 a 5 (UX A.2.22): cinco botões NUMERADOS de 48 x 48 px, com os extremos escritos
 * ("Muito ruim" e "Muito bom"). Nunca só estrelas: o número aparece sempre. Rádio nativo (setas funcionam).
 *
 * ```html
 * <app-cg-rating label="Como foi o serviço?" [(value)]="quality" />
 * ```
 */
@Component({
  selector: 'app-cg-rating',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cg-rating-host' },
  template: `
    <fieldset class="cg-rating">
      <legend class="cg-rating__legend">{{ label() }}</legend>
      <div class="cg-rating__scores">
        @for (score of scores; track score) {
          <label class="cg-rating__score" [class.is-selected]="value() === score">
            <input
              class="cg-rating__input"
              type="radio"
              [name]="name"
              [checked]="value() === score"
              [attr.aria-label]="score + ' de 5'"
              (change)="value.set(score)"
            />
            <span aria-hidden="true">{{ score }}</span>
          </label>
        }
      </div>
      <p class="cg-rating__ends" aria-hidden="true">
        <span>{{ low() }}</span><span>{{ high() }}</span>
      </p>
    </fieldset>
  `,
})
export class CgRatingComponent {
  readonly label = input.required<string>();
  readonly low = input('Muito ruim');
  readonly high = input('Muito bom');
  readonly value = model<CgRatingValue | null>(null);

  protected readonly scores = SCORES;
  protected readonly name = uniqueId('cg-rating');
}
