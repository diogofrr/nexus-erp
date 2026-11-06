import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent } from '../../../../shared/ui/display/icon.component';

/**
 * Cinco estrelas para a nota do profissional (decorativas, `aria-hidden`): as cheias valem a nota arredondada. O número
 * e as avaliações vêm SEMPRE escritos ao lado ("Nota 4,8 (12 avaliações)"): a estrela nunca é a única informação. Sem nota
 * (menos de 5 avaliações), não desenha nada.
 *
 * ```html
 * <app-cg-stars [value]="4.8" />
 * ```
 */
@Component({
  selector: 'app-cg-stars',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  styles: [
    `
      :host { display: inline-flex; gap: 0.125rem; vertical-align: middle; }
      .on { color: var(--nx-gold-700); fill: currentColor; }
      .off { color: var(--nx-slate-500); }
    `,
  ],
  template: `
    @for (on of stars(); track $index) {
      <svg appIcon="star" size="sm" [class.on]="on" [class.off]="!on"></svg>
    }
  `,
})
export class StarsComponent {
  /** A nota média (0 a 5), ou `null` quando ainda não há nota. */
  readonly value = input<number | null>(null);

  protected readonly stars = computed(() => {
    const value = this.value();
    if (value === null) {
      return [];
    }
    const filled = Math.max(0, Math.min(5, Math.round(value)));
    return [0, 1, 2, 3, 4].map((i) => i < filled);
  });
}
