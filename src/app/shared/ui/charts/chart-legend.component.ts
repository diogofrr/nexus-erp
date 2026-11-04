import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type LegendShape = 'box' | 'line' | 'dash';

export interface LegendItem {
  label: string;
  /** Cor como variável de token: `var(--chart-1)`, `var(--chart-neg)`. Nunca hexadecimal. */
  color: string;
  /** O marcador muda de forma para não depender só da cor: quadrado, traço, tracejado. */
  shape?: LegendShape;
}

/**
 * Legenda de gráfico. O marcador muda de forma (quadrado, traço, tracejado) e o texto diz o que é, então
 * a leitura não depende da cor.
 *
 * ```html
 * <app-chart-legend [items]="[{ label: 'Resultado positivo', color: 'var(--chart-pos)' }]" />
 * ```
 */
@Component({
  selector: 'app-chart-legend',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul
      class="legend"
      [class.legend--column]="direction() === 'column'"
      [attr.aria-label]="label()"
    >
      @for (item of items(); track item.label) {
        <li
          class="legend__item"
          [class.legend__item--line]="item.shape === 'line'"
          [class.legend__item--dash]="item.shape === 'dash'"
          [style.--sw]="item.color"
        >
          {{ item.label }}
        </li>
      }
    </ul>
  `,
})
export class ChartLegendComponent {
  readonly items = input.required<readonly LegendItem[]>();
  readonly direction = input<'row' | 'column'>('row');
  readonly label = input('Legenda do gráfico');
}
