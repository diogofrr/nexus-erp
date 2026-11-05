import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PlanId } from '../../../core/models';
import { planShortName } from '../../../core/rules/plan-features';

/**
 * Etiqueta de plano (UX A.2.23): ponto mais nome ("Plano Cuida"), nas cores do plano do design system. Nunca só
 * cor. Não é um alvo de toque; se virar link, envolva em `<a>` com 48 px de área. É informação neutra: nunca
 * ligada a pontuação, alerta ou oferta (RN-PLN-19).
 *
 * ```html
 * <app-cg-plan-tag plan="cuida" />
 * ```
 */
@Component({
  selector: 'app-cg-plan-tag',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': "'cg-plan-tag cg-plan-tag--' + plan()" },
  template: `<span class="cg-plan-tag__dot" aria-hidden="true"></span>Plano {{ name() }}`,
})
export class CgPlanTagComponent {
  readonly plan = input.required<PlanId>();
  protected readonly name = computed(() => planShortName(this.plan()));
}
