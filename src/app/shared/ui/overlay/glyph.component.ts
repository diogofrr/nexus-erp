import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type GlyphSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Ícone do sprite local (`public/icons/sprite.svg`, lucide). Usado pelo shell, pelas sobreposições e
 * pelos gráficos. É um atributo do próprio `<svg>` para que os seletores do design system que miram o
 * filho direto (`.banner > .icon`, `.toast > .icon`) continuem valendo.
 *
 * ```html
 * <svg appGlyph="circle-check"></svg>
 * <svg appGlyph="octagon-alert" glyphSize="lg"></svg>
 * ```
 *
 * Decorativo por padrão (`aria-hidden`). Botão só de ícone leva `aria-label` no botão.
 */
@Component({
  selector: 'svg[appGlyph]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'icon',
    'aria-hidden': 'true',
    '[class.icon--sm]': "glyphSize() === 'sm'",
    '[class.icon--lg]': "glyphSize() === 'lg'",
    '[class.icon--xl]': "glyphSize() === 'xl'",
  },
  template: `<svg:use [attr.href]="href()" />`,
})
export class GlyphComponent {
  /** Nome do ícone, sem o prefixo `i-` (por exemplo, `circle-check`). */
  readonly appGlyph = input.required<string>();
  readonly glyphSize = input<GlyphSize>('md');

  protected readonly href = computed(() => `icons/sprite.svg#i-${this.appGlyph()}`);
}
