import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent } from '../../../shared/ui/display/icon.component';
import { CgEventType, EVENT_TYPE_ICONS, EVENT_TYPE_LABELS } from '../state/event-type';

/**
 * Selo do tipo de encontro (docs/20-regras-planos-v2.md, regra de exibição 3): roda de conversa aberta, capacitação ou
 * terapia de grupo, cada um com o seu ícone e a sua cor (verde-sálvia, azul-céu, areia dourada), sempre com o nome
 * escrito, nunca só a cor. Usado em todo lugar que lista encontros (Hoje, Agenda, Encontros), para a pessoa saber de
 * cara o que é. Os pares de cor são as tintas das seções, conferidas por `pnpm run check:a11y`.
 *
 * ```html
 * <app-cg-event-badge type="open_circle" />
 * <app-cg-event-badge type="training" size="sm" />
 * ```
 */
@Component({
  selector: 'app-cg-event-badge',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()', '[attr.data-type]': 'type()' },
  template: `
    <svg [appIcon]="icon()" size="sm"></svg>
    <span>{{ label() }}</span>
  `,
})
export class CgEventBadgeComponent {
  readonly type = input.required<CgEventType>();
  /** `md` (padrão) ou `sm` (dentro de uma linha de lista). */
  readonly size = input<'sm' | 'md'>('md');

  protected readonly label = computed(() => EVENT_TYPE_LABELS[this.type()]);
  protected readonly icon = computed(() => EVENT_TYPE_ICONS[this.type()]);
  protected readonly classes = computed(() => `cg-event cg-event--${this.type()} cg-event--${this.size()}`);
}
