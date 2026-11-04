import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { sparklinePath } from './chart-math';

/**
 * Sparkline: a tendência de uma série em 6,5 x 2 rem, sem eixos nem rótulos (cabe num KPI). Leitura em
 * palavras no `ariaLabel`; o valor exato vive no KPI ao lado.
 *
 * ```html
 * <app-sparkline [values]="[26, 22, 24, 16, 18, 9, 6]" ariaLabel="Assinantes: subindo nos últimos 7 meses" />
 * <app-sparkline [values]="series" tone="gold" ariaLabel="Ocupação do mês" />
 * ```
 */
@Component({
  selector: 'app-sparkline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let s = shape();
    <svg
      class="spark"
      [class.spark--gold]="tone() === 'gold'"
      viewBox="0 0 104 32"
      role="img"
      [attr.aria-label]="ariaLabel()"
    >
      @if (s.d) {
        <path [attr.d]="s.d" />
      }
      @if (s.last) {
        <circle [attr.cx]="s.last.x" [attr.cy]="s.last.y" r="2.5" />
      }
    </svg>
  `,
})
export class SparklineComponent {
  readonly values = input.required<readonly number[]>();
  readonly ariaLabel = input.required<string>();
  readonly tone = input<'blue' | 'gold'>('blue');

  protected readonly shape = computed(() => sparklinePath(this.values()));
}
