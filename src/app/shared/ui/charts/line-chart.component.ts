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

export interface LinePoint {
  label: string;
  value: number | null;
}

export interface LineReference {
  value: number;
  label: string;
}

/**
 * Gráfico de linha em SVG feito à mão: uma ou duas séries, pontos rotulados nas extremidades (ou em todos,
 * se forem poucos), linha de referência dourada tracejada e alternativa em tabela.
 *
 * ```html
 * <app-line-chart
 *   [points]="[{ label: 'Adesão', value: 66 }, { label: '3 meses', value: 52 }]"
 *   [referenceLine]="{ value: 41, label: 'Faixa amarela começa em 41' }"
 *   ariaLabel="Evolução da média de pontuação ao longo de quatro aplicações"
 *   primaryLabel="Média da pontuação" valueHeader="Pontuação" />
 * ```
 */
@Component({
  selector: 'app-line-chart',
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
          @for (tick of g.ticks; track tick.value) {
            <line
              class="ch-grid"
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
            <text class="ch-ref-label" [attr.x]="g.left + 8" [attr.y]="ref.y - 7">
              {{ ref.label }}
            </text>
          }
          @for (series of g.series; track series.id) {
            @if (series.polyline) {
              <polyline
                [attr.class]="series.secondary ? 'ch-line ch-line--2' : 'ch-line'"
                [attr.points]="series.polyline"
              />
            }
            @for (dot of series.dots; track dot.index) {
              <circle
                [attr.class]="series.secondary ? 'ch-dot ch-dot--2' : 'ch-dot'"
                [attr.cx]="dot.x"
                [attr.cy]="dot.y"
                r="4.5"
              />
              @if (dot.valueLabel) {
                <text
                  class="ch-text ch-text--strong ch-text--mid"
                  [attr.x]="dot.x"
                  [attr.y]="dot.y - 12"
                >
                  {{ dot.valueLabel }}
                </text>
              }
            }
          }
          @for (cat of g.categories; track cat.index) {
            @if (cat.show) {
              <text class="ch-text ch-text--mid" [attr.x]="cat.x" [attr.y]="g.height - 8">
                {{ cat.label }}
              </text>
            }
          }
        </svg>
      </div>
      <app-chart-legend [items]="legendItems()" />
      <app-chart-table [caption]="caption()" [headers]="tableHeaders()" [rows]="tableRows()" />
    </figure>
  `,
})
export class LineChartComponent {
  readonly points = input.required<readonly LinePoint[]>();
  /** Segunda série, com os mesmos rótulos de categoria. */
  readonly secondary = input<readonly LinePoint[] | null>(null);
  readonly ariaLabel = input.required<string>();
  readonly valueFormat = input<(value: number) => string>((v) => formatNumber(v, 0));
  readonly caption = input('Valores do gráfico');
  readonly categoryHeader = input('Período');
  readonly valueHeader = input('Valor');
  readonly primaryLabel = input('Série principal');
  readonly secondaryLabel = input('Segunda série');
  readonly referenceLine = input<LineReference | null>(null);
  /** Força o início do eixo (por exemplo, 0). */
  readonly yMin = input<number | null>(null);
  readonly yMax = input<number | null>(null);
  readonly height = input(200);
  /** `auto`: rotula todos os pontos se houver até 6; senão, só o primeiro e o último. */
  readonly showValues = input<'auto' | 'ends' | 'all' | 'none'>('auto');

  protected readonly geometry = computed(() => {
    const primary = this.points();
    const secondary = this.secondary() ?? [];
    const format = this.valueFormat();
    const ref = this.referenceLine();
    const numbers = [...primary, ...secondary].flatMap((p) => (p.value === null ? [] : [p.value]));
    const lo = Math.min(this.yMin() ?? Infinity, ...numbers, ...(ref ? [ref.value] : []));
    const hi = Math.max(this.yMax() ?? -Infinity, ...numbers, ...(ref ? [ref.value] : []));
    const scale = niceScale(
      Number.isFinite(lo) ? lo : 0,
      Number.isFinite(hi) ? hi : 1,
      5,
      this.yMin() !== null,
    );
    const width = CHART_WIDTH;
    const height = this.height();
    const top = 26;
    const bottom = 30;
    const right = 36;
    const left = leftMargin(scale.ticks.map((t) => format(t)));
    const y = linearScale(scale.max, scale.min, top, height - bottom);
    const count = Math.max(primary.length, secondary.length);
    const x = linearScale(0, Math.max(1, count - 1), left, width - right);
    const every = labelEvery(count);
    const mode = this.showValues();
    const labelAll = mode === 'all' || (mode === 'auto' && count <= 6);

    const build = (list: readonly LinePoint[], id: string, secondaryFlag: boolean) => {
      const dots = list.flatMap((p, index) =>
        p.value === null
          ? []
          : [
              {
                index,
                x: px(x(index)),
                y: px(y(p.value)),
                valueLabel:
                  mode !== 'none' &&
                  !secondaryFlag &&
                  (labelAll || index === 0 || index === list.length - 1)
                    ? format(p.value)
                    : '',
              },
            ],
      );
      return {
        id,
        secondary: secondaryFlag,
        dots,
        polyline: dots.length > 1 ? pointsAttribute(dots) : '',
      };
    };

    return {
      width,
      height,
      left,
      right,
      ticks: scale.ticks.map((value) => ({ value, y: px(y(value)), label: format(value) })),
      ref: ref ? { y: px(y(ref.value)), label: ref.label } : null,
      series: [
        build(primary, 'primary', false),
        ...(secondary.length ? [build(secondary, 'secondary', true)] : []),
      ],
      categories: primary.map((p, index) => ({
        index,
        label: p.label,
        x: px(x(index)),
        show: index % every === 0 || index === primary.length - 1,
      })),
    };
  });

  protected readonly legendItems = computed<LegendItem[]>(() => {
    const items: LegendItem[] = [
      { label: this.primaryLabel(), color: 'var(--chart-1)', shape: 'line' },
    ];
    if (this.secondary()?.length) {
      items.push({ label: this.secondaryLabel(), color: 'var(--chart-2)', shape: 'line' });
    }
    const ref = this.referenceLine();
    if (ref) {
      items.push({ label: ref.label, color: 'var(--accent)', shape: 'dash' });
    }
    return items;
  });

  protected readonly tableHeaders = computed(() => [
    this.categoryHeader(),
    this.secondary()?.length ? this.primaryLabel() : this.valueHeader(),
    ...(this.secondary()?.length ? [this.secondaryLabel()] : []),
  ]);

  protected readonly tableRows = computed(() => {
    const format = this.valueFormat();
    const second = this.secondary();
    const cell = (v: number | null | undefined): string =>
      v === null || v === undefined ? 'sem dado' : format(v);
    return this.points().map((p, i) => [
      p.label,
      cell(p.value),
      ...(second?.length ? [cell(second[i]?.value)] : []),
    ]);
  });
}
