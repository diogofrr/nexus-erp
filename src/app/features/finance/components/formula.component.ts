import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * "Como é calculado" de cada indicador (SCR-M10-06 mostra as fórmulas do quadro de indicadores). Recolhido por
 * padrão; o texto da fórmula e da janela vai como conteúdo.
 *
 * ```html
 * <app-formula>(pontuação atual − pontuação na adesão) ÷ pontuação na adesão × 100</app-formula>
 * ```
 */
@Component({
  selector: 'app-formula',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <details class="chart-alt">
      <summary>{{ title() }}</summary>
      <p class="t-ui"><ng-content /></p>
    </details>
  `,
})
export class FormulaComponent {
  readonly title = input('Como é calculado');
}
