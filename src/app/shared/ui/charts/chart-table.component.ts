import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { GlyphComponent } from '../overlay/glyph.component';

/**
 * Alternativa em tabela de todo gráfico (acessibilidade): um `<details>` "Ver como tabela" com a mesma
 * informação em linhas e colunas. As colunas a partir de `numericFrom` ficam alinhadas à direita.
 *
 * O texto das células vem pronto (formatado em pt-BR) e segue a mesma regra de privacidade do gráfico:
 * recorte suprimido aparece como "menos de 5", nunca como número.
 */
@Component({
  selector: 'app-chart-table',
  imports: [GlyphComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <details class="chart-alt">
      <summary><svg appGlyph="table" glyphSize="sm"></svg>{{ summary() }}</summary>
      <div class="table-wrap">
        <table class="table" data-density="compact">
          <caption class="sr-only">
            {{
              caption()
            }}
          </caption>
          <thead>
            <tr>
              @for (header of headers(); track $index) {
                <th scope="col" [class.col-num]="$index >= numericFrom()">{{ header }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track $index) {
              <tr>
                @for (cell of row; track $index) {
                  <td [class.col-primary]="$index === 0" [class.col-num]="$index >= numericFrom()">
                    {{ cell }}
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    </details>
  `,
})
export class ChartTableComponent {
  readonly caption = input.required<string>();
  readonly headers = input.required<readonly string[]>();
  readonly rows = input.required<readonly (readonly string[])[]>();
  readonly numericFrom = input(1);
  readonly summary = input('Ver como tabela');
}
