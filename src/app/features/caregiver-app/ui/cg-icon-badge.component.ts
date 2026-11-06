import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';
import { IconComponent, IconName, IconSize } from '../../../shared/ui/display/icon.component';
import { CgAccent, accentClass } from './cg-accent';

export type CgBadgeSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Emblema redondo de ícone: o ícone em tinta sobre o fundo `strong` da seção (ou cheio, com `solid`). É o que dá
 * cor e peso a uma linha, a um cartão e a um ladrilho sem acrescentar texto. Decorativo (`aria-hidden`): o texto ao
 * lado diz o que é. O acento vem da seção corrente; `accent` força outro.
 *
 * ```html
 * <app-cg-icon-badge icon="pill" />
 * <app-cg-icon-badge icon="handshake" size="lg" accent="rede" solid />
 * ```
 */
@Component({
  selector: 'app-cg-icon-badge',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()', 'aria-hidden': 'true' },
  template: `<svg [appIcon]="icon()" [size]="iconSize()"></svg>`,
})
export class CgIconBadgeComponent {
  readonly icon = input.required<IconName>();
  readonly size = input<CgBadgeSize>('md');
  readonly accent = input<CgAccent | null>(null);
  /** Fundo cheio na cor da seção e ícone branco (para o que precisa de mais peso). */
  readonly solid = input(false, { transform: booleanAttribute });

  protected readonly iconSize = computed<IconSize>(() => (this.size() === 'sm' ? 'md' : this.size() === 'xl' ? 'xl' : 'lg'));
  protected readonly classes = computed(
    () => `cg-badge cg-badge--${this.size()}${this.solid() ? ' cg-badge--solid' : ''}${accentClass(this.accent())}`,
  );
}
