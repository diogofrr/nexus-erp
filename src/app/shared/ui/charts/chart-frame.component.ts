import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Moldura de gráfico: limita a largura para o SVG (viewBox de 560) não ampliar o texto dos eixos em cartão
 * largo (a 1100 px o texto de 12 px viraria 23 px). Use em volta de `app-area-chart`, `app-bar-chart` e
 * `app-line-chart` quando o cartão ocupa a linha inteira.
 *
 * ```html
 * <app-chart-frame><app-bar-chart ... /></app-chart-frame>
 * ```
 */
@Component({
  selector: 'app-chart-frame',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: block; max-width: 46rem;' },
  template: '<ng-content />',
})
export class ChartFrameComponent {}
