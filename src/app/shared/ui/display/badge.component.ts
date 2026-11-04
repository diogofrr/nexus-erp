import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';
import type { PlanId } from '@core/models';
import type { ZaritBand } from '@core/models';
import { zaritBand, zaritBandLabel } from '@core/rules';
import { IconComponent, IconName } from './icon.component';

export type BadgeVariant =
  | 'neutral'
  | 'success'
  | 'attention'
  | 'danger'
  | 'info'
  | 'gold'
  | 'plan-livre'
  | 'plan-essencial'
  | 'plan-cuida'
  | 'plan-sustenta'
  | 'zarit-1'
  | 'zarit-2'
  | 'zarit-3'
  | 'zarit-4';

/**
 * Selo de estado. SEMPRE texto mais ícone ou ponto, nunca só cor: use `icon` ou `dot`.
 *
 * ```html
 * <app-badge variant="success" icon="award">Em destaque</app-badge>
 * <app-badge variant="attention" dot>Pendente</app-badge>
 * ```
 */
@Component({
  selector: 'app-badge',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()' },
  template: `
    @if (icon(); as name) {
      <svg [appIcon]="name"></svg>
    }
    <ng-content />
  `,
})
export class BadgeComponent {
  readonly variant = input<BadgeVariant>('neutral');
  /** Ícone à esquerda (o que acompanha o texto para a cor não ser o único sinal). */
  readonly icon = input<IconName>();
  /** Ponto antes do texto. */
  readonly dot = input(false, { transform: booleanAttribute });
  readonly outline = input(false, { transform: booleanAttribute });
  /** Selo grande (32 px). */
  readonly large = input(false, { transform: booleanAttribute });

  protected readonly classes = computed(() => {
    const parts = ['badge'];
    if (this.variant() !== 'neutral') {
      parts.push(`badge--${this.variant()}`);
    }
    if (this.dot()) {
      parts.push('badge--dot');
    }
    if (this.outline()) {
      parts.push('badge--outline');
    }
    if (this.large()) {
      parts.push('badge--lg');
    }
    return parts.join(' ');
  });
}

export const PLAN_NAMES: Readonly<Record<PlanId, string>> = {
  livre: 'Livre',
  essencial: 'Essencial',
  cuida: 'Cuida',
  sustenta: 'Sustenta',
};

/**
 * Selo de plano: ponto mais nome (Livre, Essencial, Cuida, Sustenta), nas cores da Figura 1.
 * `<app-plan-badge plan="cuida" />`
 */
@Component({
  selector: 'app-plan-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()' },
  template: '{{ name() }}',
})
export class PlanBadgeComponent {
  readonly plan = input.required<PlanId>();
  readonly large = input(false, { transform: booleanAttribute });
  protected readonly name = computed(() => PLAN_NAMES[this.plan()]);
  protected readonly classes = computed(
    () => `badge badge--dot badge--plan-${this.plan()}${this.large() ? ' badge--lg' : ''}`,
  );
}

const ZARIT_VISUAL: Record<ZaritBand, { level: 1 | 2 | 3 | 4; icon: IconName; short: string }> = {
  absent_or_small: { level: 1, icon: 'circle-check', short: 'Ausente ou pequena' },
  moderate: { level: 2, icon: 'info', short: 'Moderada' },
  moderate_to_severe: { level: 3, icon: 'triangle-alert', short: 'Moderada a severa' },
  severe: { level: 4, icon: 'octagon-alert', short: 'Severa' },
};

/**
 * Faixa do Zarit: cor, FORMA do ícone (círculo, círculo, triângulo, octógono) e rótulo, para não depender
 * da cor. Passe `band` ou a pontuação em `score` (a faixa é calculada pela regra do núcleo). Com `score` o
 * selo mostra "Severa · 63". `long` usa o rótulo completo ("Sobrecarga severa"). Nunca "diagnóstico".
 * Só para quem pode ver o resultado individual (psicólogo do caso e RT); gestão e atendimento não.
 *
 * `<app-zarit-band-badge [score]="63" />`
 */
@Component({
  selector: 'app-zarit-band-badge',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()' },
  template: `
    <svg [appIcon]="visual().icon"></svg>
    <span class="sr-only">Sobrecarga: </span>{{ text() }}
  `,
})
export class ZaritBandBadgeComponent {
  readonly band = input<ZaritBand>();
  readonly score = input<number>();
  /** Rótulo completo, como no resultado ("Sobrecarga severa"). */
  readonly long = input(false, { transform: booleanAttribute });
  readonly large = input(false, { transform: booleanAttribute });

  protected readonly resolved = computed<ZaritBand>(() => {
    const band = this.band();
    if (band) {
      return band;
    }
    const score = this.score();
    return zaritBand(score ?? 0);
  });
  protected readonly visual = computed(() => ZARIT_VISUAL[this.resolved()]);
  protected readonly text = computed(() => {
    const base = this.long() ? zaritBandLabel(this.resolved()) : this.visual().short;
    const score = this.score();
    return score === undefined ? base : `${base} · ${score}`;
  });
  protected readonly classes = computed(
    () => `badge badge--zarit-${this.visual().level}${this.large() ? ' badge--lg' : ''}`,
  );
}
