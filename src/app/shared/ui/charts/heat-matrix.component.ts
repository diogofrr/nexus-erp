import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ChartLegendComponent, LegendItem } from './chart-legend.component';
import { ChartTableComponent } from './chart-table.component';
import { HeatLevel, heatLevel } from './chart-math';

export interface HeatRisk {
  /** `R1` a `R12`. */
  code: string;
  /** Probabilidade de 1 a 5 (linha). */
  probability: number;
  /** Impacto de 1 a 5 (coluna). */
  impact: number;
  title?: string;
}

interface HeatCell {
  probability: number;
  impact: number;
  criticality: number;
  level: HeatLevel;
  risks: readonly HeatRisk[];
}

const LEVEL_TEXT: Record<HeatLevel, string> = {
  low: 'baixa',
  mid: 'média',
  high: 'alta (prioritária)',
};

/**
 * Matriz de risco 5 x 5 (M13): linha = probabilidade (5 no topo), coluna = impacto. Cada célula mostra o
 * número P x I (a cor nunca vai sozinha) e os riscos `R1` a `R12` como bolhas dentro dela. Criticidade:
 * até 4 baixa, de 5 a 11 média, 12 ou mais alta (prioritária). Alternativa em tabela com P, I e C.
 *
 * ```html
 * <app-heat-matrix [risks]="[{ code: 'R3', probability: 4, impact: 4 }]" />
 * ```
 */
@Component({
  selector: 'app-heat-matrix',
  imports: [ChartLegendComponent, ChartTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="chart">
      <div class="heat" role="img" [attr.aria-label]="summary()">
        @for (row of rows(); track row.probability) {
          <div class="heat__axis">{{ row.probability }}</div>
          @for (cell of row.cells; track cell.impact) {
            <div class="heat__cell" [attr.data-level]="cell.level">
              <span class="heat__score">{{ cell.criticality }}</span>
              @for (risk of cell.risks; track risk.code) {
                <span class="heat__risk">{{ risk.code }}</span>
              }
            </div>
          }
        }
        <div></div>
        @for (impact of axis; track impact) {
          <div class="heat__axis">{{ impact }}</div>
        }
      </div>
      <app-chart-legend [items]="legend" />
      <p class="t-caption">Eixo vertical: probabilidade (P). Eixo horizontal: impacto (I).</p>
      <app-chart-table
        caption="Riscos por probabilidade, impacto e criticidade"
        [headers]="['Risco', 'P', 'I', 'C', 'Nível']"
        [rows]="tableRows()"
      />
    </figure>
  `,
})
export class HeatMatrixComponent {
  readonly risks = input.required<readonly HeatRisk[]>();

  protected readonly axis = [1, 2, 3, 4, 5];
  protected readonly legend: LegendItem[] = [
    { label: 'C até 4', color: 'var(--success-bg)' },
    { label: 'C de 5 a 11', color: 'var(--attention-bg)' },
    { label: 'C 12 ou mais (prioritário)', color: 'var(--danger-bg)' },
  ];

  /** Linhas da probabilidade 5 até 1 (a mais alta no topo). */
  protected readonly rows = computed(() =>
    [5, 4, 3, 2, 1].map((probability) => ({
      probability,
      cells: this.axis.map((impact): HeatCell => {
        const criticality = probability * impact;
        return {
          probability,
          impact,
          criticality,
          level: heatLevel(criticality),
          risks: this.risks().filter((r) => r.probability === probability && r.impact === impact),
        };
      }),
    })),
  );

  protected readonly summary = computed(() => {
    const total = this.risks().length;
    const high = this.risks().filter((r) => heatLevel(r.probability * r.impact) === 'high').length;
    return `Matriz de risco: probabilidade por impacto, ${total} riscos, ${high} prioritários`;
  });

  protected readonly tableRows = computed(() =>
    [...this.risks()]
      .sort(
        (a, b) =>
          b.probability * b.impact - a.probability * a.impact ||
          a.code.localeCompare(b.code, 'pt-BR', { numeric: true }),
      )
      .map((r) => [
        r.title ? `${r.code} ${r.title}` : r.code,
        String(r.probability),
        String(r.impact),
        String(r.probability * r.impact),
        LEVEL_TEXT[heatLevel(r.probability * r.impact)],
      ]),
  );
}
