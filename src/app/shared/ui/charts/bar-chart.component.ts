import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatNumber } from '../../../core/format/format';
import { ChartLegendComponent, LegendItem } from './chart-legend.component';
import { ChartTableComponent } from './chart-table.component';
import { CHART_WIDTH, labelEvery, leftMargin, linearScale, niceScale, px } from './chart-math';

export interface BarDatum {
  label: string;
  /** `null` ou `suppressed` = recorte abaixo do mínimo de 5: barra hachurada, sem valor (UX 6.4). */
  value: number | null;
  suppressed?: boolean;
}

export interface ReferenceLine {
  value: number;
  label: string;
}

let barSequence = 0;

/**
 * Gráfico de barras em SVG feito à mão. Barra positiva em azul, negativa em vermelho, eixo zero mais
 * forte, rótulo da categoria embaixo e alternativa em tabela. Recorte suprimido (menos de 5) vira barra
 * hachurada sem valor, nunca barra de tamanho zero.
 *
 * ```html
 * <app-bar-chart
 *   [data]="[{ label: 'M1', value: -235500 }, { label: 'M2', value: 27000 }]"
 *   [valueFormat]="formatMoney"
 *   ariaLabel="Resultado mensal: prejuízo nos primeiros meses, lucro a partir do mês 8"
 *   caption="Resultado por mês" valueHeader="Resultado"
 *   positiveLabel="Resultado positivo" negativeLabel="Resultado negativo" />
 * ```
 */
@Component({
  selector: 'app-bar-chart',
  imports: [ChartLegendComponent, ChartTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let g = geometry();
    <figure class="chart">
      <div class="chart__scroll">
        <svg
          class="chart__svg"
          [attr.viewBox]="'0 0 ' + g.width + ' ' + g.height"
          role="img"
          [attr.aria-label]="ariaLabel()"
        >
          <defs>
            <pattern
              [attr.id]="patternId"
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line class="ch-hatch" x1="0" y1="0" x2="0" y2="6" />
            </pattern>
          </defs>
          @for (tick of g.ticks; track tick.value) {
            <line
              [attr.class]="tick.zero ? 'ch-axis' : 'ch-grid'"
              [attr.x1]="g.left"
              [attr.x2]="g.width - g.right"
              [attr.y1]="tick.y"
              [attr.y2]="tick.y"
            />
            <text class="ch-text ch-text--end" [attr.x]="g.left - 8" [attr.y]="tick.y + 4">
              {{ tick.label }}
            </text>
          }
          @if (g.ref; as ref) {
            <line
              class="ch-ref"
              [attr.x1]="g.left"
              [attr.x2]="g.width - g.right"
              [attr.y1]="ref.y"
              [attr.y2]="ref.y"
            />
            <text class="ch-ref-label" [attr.x]="g.left + 8" [attr.y]="ref.y - 6">
              {{ ref.label }}
            </text>
          }
          @for (bar of g.bars; track bar.index) {
            @if (bar.suppressed) {
              <rect
                class="ch-bar ch-bar--suppressed"
                [style.fill]="'url(#' + patternId + ')'"
                [attr.x]="bar.x"
                [attr.y]="bar.y"
                [attr.width]="bar.width"
                [attr.height]="bar.height"
                rx="3"
              />
            } @else {
              <rect
                [attr.class]="bar.negative ? 'ch-bar ch-bar--neg' : 'ch-bar'"
                [attr.x]="bar.x"
                [attr.y]="bar.y"
                [attr.width]="bar.width"
                [attr.height]="bar.height"
                rx="3"
              />
            }
            @if (bar.valueLabel) {
              <text
                class="ch-text ch-text--mid ch-text--strong"
                [attr.x]="bar.cx"
                [attr.y]="bar.negative ? bar.y + bar.height + 14 : bar.y - 6"
              >
                {{ bar.valueLabel }}
              </text>
            }
            @if (bar.showLabel) {
              <text class="ch-text ch-text--mid" [attr.x]="bar.cx" [attr.y]="g.height - 8">
                {{ bar.label }}
              </text>
            }
          }
        </svg>
      </div>
      <app-chart-legend [items]="legendItems()" />
      <app-chart-table
        [caption]="caption()"
        [headers]="[categoryHeader(), valueHeader()]"
        [rows]="tableRows()"
      />
    </figure>
  `,
})
export class BarChartComponent {
  readonly data = input.required<readonly BarDatum[]>();
  /** Leitura do gráfico em palavras (`aria-label` do SVG). */
  readonly ariaLabel = input.required<string>();
  readonly valueFormat = input<(value: number) => string>((v) => formatNumber(v, 0));
  /** Legenda da tabela alternativa e leitor de tela. */
  readonly caption = input('Valores do gráfico');
  readonly categoryHeader = input('Período');
  readonly valueHeader = input('Valor');
  readonly height = input(230);
  readonly positiveLabel = input('Positivo');
  readonly negativeLabel = input('Negativo');
  readonly suppressedLabel = input('Menos de 5 (por privacidade, sem valor)');
  /** `auto` escreve o valor sobre a barra quando há até 8 barras. */
  readonly showValues = input<'auto' | 'always' | 'never'>('auto');
  readonly referenceLine = input<ReferenceLine | null>(null);

  protected readonly patternId = `nx-hatch-bar-${++barSequence}`;

  protected readonly geometry = computed(() => {
    const data = this.data();
    const format = this.valueFormat();
    const values = data.flatMap((d) => (d.value === null || d.suppressed ? [] : [d.value]));
    const ref = this.referenceLine();
    const scale = niceScale(
      Math.min(0, ...values, ...(ref ? [ref.value] : [])),
      Math.max(0, ...values, ...(ref ? [ref.value] : [])),
    );
    const width = CHART_WIDTH;
    const height = this.height();
    const top = 18;
    const bottom = 30;
    const right = 12;
    const left = leftMargin(scale.ticks.map((t) => format(t)));
    const plotHeight = height - top - bottom;
    const y = linearScale(scale.max, scale.min, top, top + plotHeight);
    const plotWidth = width - left - right;
    const count = Math.max(1, data.length);
    const step = plotWidth / count;
    const barWidth = Math.min(step * 0.56, 56);
    const every = labelEvery(data.length);
    const showValues =
      this.showValues() === 'always' || (this.showValues() === 'auto' && data.length <= 8);
    const zeroY = y(0);
    const bars = data.map((d, index) => {
      const x = left + step * index + (step - barWidth) / 2;
      const suppressed = d.suppressed === true || d.value === null;
      const value = d.value ?? 0;
      const valueY = y(value);
      const barHeight = suppressed ? plotHeight * 0.25 : Math.max(2, Math.abs(valueY - zeroY));
      const barY = suppressed ? zeroY - barHeight : Math.min(zeroY, valueY);
      return {
        index,
        label: d.label,
        x: px(x),
        y: px(barY),
        width: px(barWidth),
        height: px(barHeight),
        cx: px(x + barWidth / 2),
        negative: !suppressed && value < 0,
        suppressed,
        showLabel: index % every === 0,
        valueLabel: showValues && !suppressed ? format(value) : '',
      };
    });
    return {
      width,
      height,
      left,
      right,
      ticks: scale.ticks.map((value) => ({
        value,
        y: px(y(value)),
        label: format(value),
        zero: value === 0,
      })),
      ref: ref ? { y: px(y(ref.value)), label: ref.label } : null,
      bars,
    };
  });

  protected readonly legendItems = computed<LegendItem[]>(() => {
    const data = this.data();
    const items: LegendItem[] = [];
    const hasNegative = data.some((d) => d.value !== null && !d.suppressed && d.value < 0);
    items.push({ label: this.positiveLabel(), color: 'var(--chart-pos)' });
    if (hasNegative) {
      items.push({ label: this.negativeLabel(), color: 'var(--chart-neg)' });
    }
    if (data.some((d) => d.suppressed === true || d.value === null)) {
      items.push({ label: this.suppressedLabel(), color: 'var(--border-strong)' });
    }
    if (this.referenceLine()) {
      items.push({
        label: this.referenceLine()?.label ?? '',
        color: 'var(--accent)',
        shape: 'dash',
      });
    }
    return items;
  });

  protected readonly tableRows = computed(() => {
    const format = this.valueFormat();
    return this.data().map((d) => [
      d.label,
      d.suppressed === true || d.value === null ? 'menos de 5' : format(d.value),
    ]);
  });
}
