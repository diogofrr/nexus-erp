import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatNumber } from '../../../core/format/format';
import { ChartLegendComponent, LegendItem } from './chart-legend.component';
import { ChartTableComponent } from './chart-table.component';
import {
  CHART_WIDTH,
  labelEvery,
  leftMargin,
  linearScale,
  niceScale,
  pointsAttribute,
  px,
} from './chart-math';

export interface AreaPoint {
  label: string;
  value: number;
}

export interface AreaReference {
  value: number;
  label: string;
}

/**
 * Gráfico de área em SVG feito à mão, com barras opcionais acima. É o gráfico do financeiro: o painel de
 * cima traz o resultado de cada mês em barras (azul quando positivo, vermelho quando negativo) e o de
 * baixo traz o saldo acumulado em área, com a linha tracejada do retorno do investimento (saldo zero).
 * Os dois painéis dividem os rótulos do eixo X e cada um tem a própria escala vertical, com título.
 *
 * ```html
 * <app-area-chart
 *   [points]="balanceByMonth" [bars]="resultByMonth"
 *   [valueFormat]="formatMoney"
 *   [referenceLine]="{ value: 0, label: 'Retorno do investimento (saldo zero)' }"
 *   areaLabel="Saldo acumulado" barsLabel="Resultado do mês"
 *   ariaLabel="Resultado mensal e saldo acumulado em 12 meses" />
 * ```
 */
@Component({
  selector: 'app-area-chart',
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
          @for (panel of g.panels; track panel.id) {
            <text class="ch-text ch-text--strong" [attr.x]="g.left" [attr.y]="panel.titleY">
              {{ panel.title }}
            </text>
            @for (tick of panel.ticks; track tick.value) {
              <line
                [attr.class]="tick.zero && panel.id === 'bars' ? 'ch-axis' : 'ch-grid'"
                [attr.x1]="g.left"
                [attr.x2]="g.width - g.right"
                [attr.y1]="tick.y"
                [attr.y2]="tick.y"
              />
              <text class="ch-text ch-text--end" [attr.x]="g.left - 8" [attr.y]="tick.y + 4">
                {{ tick.label }}
              </text>
            }
          }
          @if (g.ref; as ref) {
            <line
              class="ch-ref"
              [attr.x1]="g.left"
              [attr.x2]="g.width - g.right"
              [attr.y1]="ref.y"
              [attr.y2]="ref.y"
            />
          }
          @for (bar of g.bars; track bar.index) {
            <rect
              [attr.class]="bar.negative ? 'ch-bar ch-bar--neg' : 'ch-bar'"
              [attr.x]="bar.x"
              [attr.y]="bar.y"
              [attr.width]="bar.width"
              [attr.height]="bar.height"
              rx="3"
            />
          }
          @if (g.area; as area) {
            <polygon class="ch-area" [attr.points]="area.polygon" />
            <polyline class="ch-line" [attr.points]="area.polyline" />
            @for (dot of area.labelled; track dot.index) {
              <circle class="ch-dot" [attr.cx]="dot.x" [attr.cy]="dot.y" r="4.5" />
              <text
                class="ch-text ch-text--strong"
                [attr.text-anchor]="dot.anchor"
                [attr.x]="dot.labelX"
                [attr.y]="dot.labelY"
              >
                {{ dot.label }}
              </text>
            }
          }
          @for (cat of g.categories; track cat.index) {
            <text class="ch-text ch-text--mid" [attr.x]="cat.x" [attr.y]="g.height - 8">
              {{ cat.label }}
            </text>
          }
        </svg>
      </div>
      <app-chart-legend [items]="legendItems()" />
      <app-chart-table [caption]="caption()" [headers]="tableHeaders()" [rows]="tableRows()" />
    </figure>
  `,
})
export class AreaChartComponent {
  /** Série da área (saldo acumulado). */
  readonly points = input.required<readonly AreaPoint[]>();
  /** Barras opcionais (resultado do mês), com os mesmos rótulos de `points`. */
  readonly bars = input<readonly AreaPoint[] | null>(null);
  readonly ariaLabel = input.required<string>();
  readonly valueFormat = input<(value: number) => string>((v) => formatNumber(v, 0));
  readonly caption = input('Valores do gráfico');
  readonly categoryHeader = input('Mês');
  readonly areaLabel = input('Saldo acumulado');
  readonly barsLabel = input('Resultado do mês');
  readonly positiveLabel = input('Resultado positivo');
  readonly negativeLabel = input('Resultado negativo');
  readonly referenceLine = input<AreaReference | null>(null);

  protected readonly geometry = computed(() => {
    const area = this.points();
    const bars = this.bars() ?? [];
    const format = this.valueFormat();
    const width = CHART_WIDTH;
    const right = 12;
    const hasBars = bars.length > 0;

    const areaValues = area.map((p) => p.value);
    const ref = this.referenceLine();
    const areaScale = niceScale(
      Math.min(...areaValues, ...(ref ? [ref.value] : []), 0),
      Math.max(...areaValues, ...(ref ? [ref.value] : []), 0),
      4,
    );
    const barValues = bars.map((b) => b.value);
    const barScale = hasBars
      ? niceScale(Math.min(...barValues, 0), Math.max(...barValues, 0), 4)
      : null;
    const left = leftMargin(
      [
        ...areaScale.ticks.map((t) => format(t)),
        ...(barScale ? barScale.ticks.map((t) => format(t)) : []),
      ],
      48,
    );

    const barsTop = 26;
    const barsHeight = hasBars ? 120 : 0;
    const areaTop = hasBars ? barsTop + barsHeight + 40 : 26;
    const areaHeight = 150;
    const height = areaTop + areaHeight + 30;
    const count = Math.max(area.length, bars.length, 1);
    const step = (width - left - right) / count;
    const cx = (i: number): number => left + step * i + step / 2;
    const every = labelEvery(count);

    const yArea = linearScale(areaScale.max, areaScale.min, areaTop, areaTop + areaHeight);
    const panels = [
      ...(barScale
        ? (() => {
            const y = linearScale(barScale.max, barScale.min, barsTop, barsTop + barsHeight);
            return [
              {
                id: 'bars',
                title: this.barsLabel(),
                titleY: barsTop - 10,
                ticks: barScale.ticks.map((value) => ({
                  value,
                  y: px(y(value)),
                  label: format(value),
                  zero: value === 0,
                })),
              },
            ];
          })()
        : []),
      {
        id: 'area',
        title: this.areaLabel(),
        titleY: areaTop - 10,
        ticks: areaScale.ticks.map((value) => ({
          value,
          y: px(yArea(value)),
          label: format(value),
          zero: value === 0,
        })),
      },
    ];

    const yBars = barScale
      ? linearScale(barScale.max, barScale.min, barsTop, barsTop + barsHeight)
      : null;
    const barWidth = Math.min(step * 0.56, 40);
    const barRects = yBars
      ? bars.map((b, index) => {
          const zero = yBars(0);
          const v = yBars(b.value);
          return {
            index,
            x: px(cx(index) - barWidth / 2),
            y: px(Math.min(zero, v)),
            width: px(barWidth),
            height: px(Math.max(2, Math.abs(v - zero))),
            negative: b.value < 0,
          };
        })
      : [];

    const dots = area.map((p, index) => ({
      index,
      x: px(cx(index)),
      y: px(yArea(p.value)),
      value: p.value,
    }));
    const first = 0;
    const last = dots.length - 1;
    const baseline = yArea(Math.min(Math.max(0, areaScale.min), areaScale.max));
    const areaShape =
      dots.length > 0
        ? {
            polygon: pointsAttribute([
              { x: dots[0]?.x ?? 0, y: baseline },
              ...dots,
              { x: dots[last]?.x ?? 0, y: baseline },
            ]),
            polyline: pointsAttribute(dots),
            labelled: [first, last]
              .filter((i, pos, arr) => arr.indexOf(i) === pos && dots[i] !== undefined)
              .map((i) => {
                const dot = dots[i] as (typeof dots)[number];
                // O primeiro rótulo começa ao lado do ponto e o último termina nele: não cobrem o eixo
                // vertical nem saem do gráfico.
                return {
                  index: i,
                  x: dot.x,
                  y: dot.y,
                  label: format(dot.value),
                  labelX: px(i === first ? dot.x + 8 : dot.x - 8),
                  anchor: i === first ? 'start' : 'end',
                  labelY: px(i === first ? dot.y - 10 : dot.y + 20),
                };
              }),
          }
        : null;

    return {
      width,
      height,
      left,
      right,
      panels,
      ref: ref ? { y: px(yArea(ref.value)) } : null,
      bars: barRects,
      area: areaShape,
      categories: (area.length >= bars.length ? area : bars)
        .map((p, index) => ({ index, label: p.label, x: px(cx(index)) }))
        .filter(
          // O último rótulo sempre aparece; o penúltimo some quando ficaria colado nele (ex.: "M23" e "M24").
          (c) => c.index === count - 1 || (c.index % every === 0 && count - 1 - c.index >= every),
        ),
    };
  });

  protected readonly legendItems = computed<LegendItem[]>(() => {
    const items: LegendItem[] = [];
    if (this.bars()?.length) {
      items.push({ label: this.positiveLabel(), color: 'var(--chart-pos)' });
      if (this.bars()?.some((b) => b.value < 0)) {
        items.push({ label: this.negativeLabel(), color: 'var(--chart-neg)' });
      }
    }
    items.push({ label: this.areaLabel(), color: 'var(--chart-1)', shape: 'line' });
    const ref = this.referenceLine();
    if (ref) {
      items.push({ label: ref.label, color: 'var(--accent)', shape: 'dash' });
    }
    return items;
  });

  protected readonly tableHeaders = computed(() => [
    this.categoryHeader(),
    ...(this.bars()?.length ? [this.barsLabel()] : []),
    this.areaLabel(),
  ]);

  protected readonly tableRows = computed(() => {
    const format = this.valueFormat();
    const bars = this.bars() ?? [];
    return this.points().map((p, i) => [
      p.label,
      ...(bars.length ? [bars[i] ? format((bars[i] as AreaPoint).value) : 'sem dado'] : []),
      format(p.value),
    ]);
  });
}
