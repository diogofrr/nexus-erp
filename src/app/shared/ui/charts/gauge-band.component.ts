import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ZARIT_BANDS, ZaritBandInfo } from '../../../core/rules/zarit';
import { IconComponent } from '../display/icon.component';
import { gaugePosition } from './chart-math';

/** Ícone de cada faixa: formas diferentes (círculo, círculo, triângulo, octógono), nunca só cor. */
const BAND_ICONS = ['circle-check', 'info', 'triangle-alert', 'octagon-alert'] as const;

/**
 * Termômetro das quatro faixas da escala de Zarit: quatro segmentos proporcionais (21, 20, 20 e 28 dos
 * 89 valores possíveis), marcador com o total na posição `(pontos + 0,5) / 89`, faixa atual cheia e as
 * demais a 32%. Embaixo, cada faixa com ícone, intervalo e nome por extenso (no celular, só a atual).
 *
 * O componente só desenha: quem pode ver a pontuação individual é decidido pela tela (psicólogo do caso e
 * responsável técnico). Sem `score`, mostra as faixas sem marcador. Nunca escreva "diagnóstico" ao lado.
 *
 * ```html
 * <app-gauge-band [score]="63" />
 * ```
 */
@Component({
  selector: 'app-gauge-band',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="thermo" [style.--pos]="position() + '%'" role="img" [attr.aria-label]="summary()">
      <div class="thermo__track">
        @if (score() !== null) {
          <div class="thermo__marker">
            <span>{{ score() }}</span>
          </div>
        }
        @for (band of bands; track band.band; let i = $index) {
          <span
            [attr.class]="'thermo__seg thermo__seg--' + (i + 1)"
            [attr.aria-current]="isCurrent(band) ? 'true' : null"
          ></span>
        }
      </div>
      <div class="thermo__labels">
        @for (band of bands; track band.band; let i = $index) {
          <div
            [attr.class]="'thermo__label thermo__label--' + (i + 1)"
            [attr.aria-current]="isCurrent(band) ? 'true' : null"
          >
            <svg [appIcon]="icons[i] ?? 'info'"></svg>
            <span
              ><b>{{ band.min }} a {{ band.max }}</b
              ><br />{{ band.label }}</span
            >
          </div>
        }
      </div>
    </div>
  `,
})
export class GaugeBandComponent {
  /** Pontuação de 0 a 88, ou `null` para mostrar só as faixas. */
  readonly score = input<number | null>(null);

  protected readonly bands = ZARIT_BANDS;
  protected readonly icons = BAND_ICONS;
  protected readonly position = computed(() => gaugePosition(this.score() ?? 0));
  private readonly current = computed(() => {
    const score = this.score();
    return score === null
      ? null
      : (ZARIT_BANDS.find((b) => score >= b.min && score <= b.max) ?? null);
  });

  protected readonly summary = computed(() => {
    const band = this.current();
    const score = this.score();
    return band && score !== null
      ? `Pontuação ${score} de 88, faixa ${band.label}`
      : 'Faixas da escala de 0 a 88: 0 a 20, 21 a 40, 41 a 60 e 61 a 88';
  });

  protected isCurrent(band: ZaritBandInfo): boolean {
    return this.current()?.band === band.band;
  }
}
