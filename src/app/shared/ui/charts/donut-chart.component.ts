import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatNumber, formatPercent } from '../../../core/format/format';
import { ChartLegendComponent, LegendItem } from './chart-legend.component';
import { ChartTableComponent } from './chart-table.component';
import { donutArcs, px } from './chart-math';

export interface DonutSegment {
  label: string;
  value: number | null;
  /** Token de cor: `var(--plan-essencial)`, `var(--accent-brand)`. Nunca hexadecimal. */
  color: string;
  /** Recorte abaixo do mínimo de 5: sem arco e sem número (UX 6.4). */
  suppressed?: boolean;
}

/** Folga entre os arcos (em unidades da circunferência 100). */
const GAP = 0.8;

/**
 * Rosca em SVG feita à mão (assinantes por plano): círculos com `stroke-dasharray` na circunferência 100,
 * total no centro, legenda com valor e percentual e alternativa em tabela.
 *
 * Se algum recorte está suprimido (menos de 5), a rosca NÃO mostra percentuais nem total: um total ao lado
 * de uma só faixa suprimida permitiria deduzir o valor por subtração (core, decisão 18).
 *
 * ```html
 * <app-donut-chart
 *   [segments]="[{ label: 'Essencial', value: 7, color: 'var(--plan-essencial)' }, ...]"
 *   centerValue="17" centerLabel="assinantes"
 *   ariaLabel="Rosca: 7 Essencial, 5 Cuida, 5 Sustenta" />
 * ```
 */
@Component({
  selector: 'app-donut-chart',
  imports: [ChartLegendComponent, ChartTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="chart">
      <div class="cluster cluster--4">
        <div class="donut" role="img" [attr.aria-label]="ariaLabel()">
          <svg viewBox="0 0 36 36">
            <circle class="donut__track" cx="18" cy="18" r="15.9155" />
            @for (arc of arcs(); track arc.label) {
              @if (arc.percent > 0) {
                <circle
                  class="donut__seg"
                  cx="18"
                  cy="18"
                  r="15.9155"
                  [style.stroke]="arc.color"
                  [attr.stroke-dasharray]="arc.dash"
                  [attr.stroke-dashoffset]="arc.offset"
                />
              }
            }
          </svg>
          @if (centerValue()) {
            <div class="donut__center">
              <strong>{{ centerValue() }}</strong>
              <span>{{ centerLabel() }}</span>
            </div>
          }
        </div>
        <app-chart-legend [items]="legendItems()" direction="column" />
      </div>
      <app-chart-table
        [caption]="caption()"
        [headers]="[categoryHeader(), valueHeader(), 'Participação']"
        [rows]="tableRows()"
      />
    </figure>
  `,
})
export class DonutChartComponent {
  readonly segments = input.required<readonly DonutSegment[]>();
  readonly ariaLabel = input.required<string>();
  /** Texto grande no centro (o total). Omita se houver recorte suprimido. */
  readonly centerValue = input('');
  readonly centerLabel = input('');
  readonly caption = input('Valores do gráfico');
  readonly categoryHeader = input('Categoria');
  readonly valueHeader = input('Quantidade');

  private readonly hasSuppressed = computed(() =>
    this.segments().some((s) => s.suppressed === true || s.value === null),
  );

  protected readonly arcs = computed(() => {
    const segments = this.segments();
    const arcs = donutArcs(segments.map((s) => (s.suppressed === true ? null : s.value)));
    return segments.map((s, i) => {
      const arc = arcs[i] ?? { percent: 0, offset: 0 };
      const drawn = Math.max(0, arc.percent - GAP);
      return {
        label: s.label,
        color: s.color,
        percent: arc.percent,
        dash: `${px(drawn)} ${px(100 - drawn)}`,
        offset: px(-arc.offset),
      };
    });
  });

  protected readonly legendItems = computed<LegendItem[]>(() => {
    const hidden = this.hasSuppressed();
    const total = this.segments().reduce((sum, s) => sum + (s.suppressed ? 0 : (s.value ?? 0)), 0);
    return this.segments().map((s) => {
      const isHidden = s.suppressed === true || s.value === null;
      const detail = isHidden
        ? 'menos de 5'
        : hidden
          ? formatNumber(s.value)
          : `${formatNumber(s.value)} · ${formatPercent(total > 0 ? ((s.value ?? 0) / total) * 100 : 0, { decimals: 1 })}`;
      return { label: `${s.label} · ${detail}`, color: s.color };
    });
  });

  protected readonly tableRows = computed(() => {
    const hidden = this.hasSuppressed();
    const total = this.segments().reduce((sum, s) => sum + (s.suppressed ? 0 : (s.value ?? 0)), 0);
    return this.segments().map((s) => {
      const isHidden = s.suppressed === true || s.value === null;
      return [
        s.label,
        isHidden ? 'menos de 5' : formatNumber(s.value),
        isHidden || hidden
          ? 'não exibida'
          : formatPercent(total > 0 ? ((s.value ?? 0) / total) * 100 : 0, { decimals: 1 }),
      ];
    });
  });
}
