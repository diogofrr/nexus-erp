import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';
import { formatPercent } from '@core/format';
import { IconComponent } from './icon.component';

/**
 * Medidor com meta (ponto de equilíbrio: "17 de 27 assinantes, faltam 10"). A barra tem texto equivalente
 * (`aria-label`) e a meta aparece escrita, não só como marca dourada.
 *
 * ```html
 * <app-meter label="Ponto de equilíbrio" [value]="17" [target]="27" unit="assinantes" />
 * ```
 */
@Component({
  selector: 'app-meter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cluster cluster--between t-ui">
      <span>{{ label() }}</span>
      <b class="t-num">{{ summary() }}</b>
    </div>
    <div class="meter">
      <div class="meter__track" role="img" [attr.aria-label]="alt()">
        <span class="meter__fill" [style.--value]="fillPercent() + '%'"></span>
        <span class="meter__target" [style.--target]="targetPercent() + '%'"></span>
      </div>
      <div class="meter__scale" aria-hidden="true">
        <span>0</span>
        <span>
          @if (missing() > 0) {
            <b>Faltam {{ missing() }}</b>
          } @else {
            <b>Meta atingida</b>
          }
        </span>
        <span>Meta: {{ target() }}</span>
      </div>
    </div>
  `,
})
export class MeterComponent {
  readonly label = input.required<string>();
  readonly value = input.required<number>();
  readonly target = input.required<number>();
  /** Fim da escala. Sem ele, usa o maior entre meta e valor. */
  readonly max = input<number>();
  readonly unit = input('');

  protected readonly scaleMax = computed(() => Math.max(this.max() ?? 0, this.target(), this.value(), 1));
  protected readonly fillPercent = computed(() => Math.min(100, Math.round((this.value() / this.scaleMax()) * 1000) / 10));
  protected readonly targetPercent = computed(() => Math.min(100, Math.round((this.target() / this.scaleMax()) * 1000) / 10));
  protected readonly missing = computed(() => Math.max(0, this.target() - this.value()));
  protected readonly summary = computed(() => `${this.value()} de ${this.target()}${this.unit() ? ` ${this.unit()}` : ''}`);
  protected readonly alt = computed(
    () => `${this.summary()}; ${this.missing() > 0 ? `faltam ${this.missing()}` : 'meta atingida'}`,
  );
}

/**
 * Barra de ocupação da agenda (RN-AGD): marca dourada na linha de 80%; acima dela a barra muda de cor E ganha
 * o ícone e o texto "acima de 80%". Sem agenda no mês (`percent` nulo) mostra "n/d" tracejado.
 *
 * ```html
 * <app-occupancy-bar name="Dr. Rafael Moreira" [percent]="91.3" />
 * ```
 */
@Component({
  selector: 'app-occupancy-bar',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'occ' },
  template: `
    <div class="occ__row">
      <span class="occ__name">{{ name() }}</span>
      <div class="occ__track" role="img" [attr.aria-label]="alt()">
        <span class="occ__fill" [class.occ__fill--over]="over()" [class.occ__fill--na]="percent() === null" [style.--v]="width()"></span>
        <span class="occ__limit"></span>
      </div>
      <span class="occ__value">
        @if (over()) {
          <svg appIcon="triangle-alert" size="sm" class="text-attention"></svg>
        }
        {{ text() }}
      </span>
    </div>
  `,
})
export class OccupancyBarComponent {
  readonly name = input.required<string>();
  /** Ocupação de 0 a 100, ou `null` quando não há agenda no mês. */
  readonly percent = input.required<number | null>();
  /** Limite de alerta (padrão 80). */
  readonly limit = input(80, { transform: (v: unknown) => Number(v) });

  protected readonly over = computed(() => {
    const value = this.percent();
    return value !== null && value > this.limit();
  });
  protected readonly width = computed(() => `${Math.min(100, this.percent() ?? 100)}%`);
  protected readonly text = computed(() => {
    const value = this.percent();
    return value === null ? 'n/d' : formatPercent(value, { decimals: 1 });
  });
  protected readonly alt = computed(() => {
    const value = this.percent();
    if (value === null) {
      return `${this.name()}: sem agenda no mês`;
    }
    return `${this.name()}: ${this.text()} de ocupação${this.over() ? `, acima do limite de ${this.limit()}%` : ''}`;
  });
}

/**
 * Barra de progresso (`role="progressbar"`). Sempre diga o que mede em `label`.
 * `<app-progress label="6 de 22 itens respondidos" [value]="6" [max]="22" large />`
 */
@Component({
  selector: 'app-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="progress"
      [class.progress--lg]="large()"
      [class.progress--gold]="tone() === 'gold'"
      [class.progress--success]="tone() === 'success'"
      role="progressbar"
      aria-valuemin="0"
      [attr.aria-valuemax]="max()"
      [attr.aria-valuenow]="clamped()"
      [attr.aria-label]="label()"
    >
      <span class="progress__bar" [style.--value]="percent() + '%'"></span>
    </div>
  `,
})
export class ProgressComponent {
  readonly label = input.required<string>();
  readonly value = input.required<number>();
  readonly max = input(100);
  readonly large = input(false, { transform: booleanAttribute });
  readonly tone = input<'brand' | 'gold' | 'success'>('brand');

  protected readonly clamped = computed(() => Math.min(Math.max(this.value(), 0), this.max()));
  protected readonly percent = computed(() =>
    this.max() <= 0 ? 0 : Math.round((this.clamped() / this.max()) * 1000) / 10,
  );
}
