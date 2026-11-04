import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { GlyphComponent } from './glyph.component';

export type BannerVariant = 'info' | 'success' | 'attention' | 'danger' | 'prototype' | 'consent';

const ICONS: Record<BannerVariant, string> = {
  info: 'info',
  success: 'circle-check',
  attention: 'triangle-alert',
  danger: 'octagon-alert',
  prototype: 'info',
  consent: 'shield-check',
};

/**
 * Faixa de aviso: informação, sucesso, atenção, perigo, protótipo e consentimento. Fica na tela até a
 * causa sumir ou a pessoa dispensar (ao contrário do toast). Informação e sucesso usam `role="status"`;
 * perigo usa `role="alert"`.
 *
 * ```html
 * <app-banner variant="attention" heading="Documento vence em 12 dias">
 *   Peça ao profissional que envie o novo registro do conselho.
 *   <button bannerActions class="btn btn--sm">Ver documento</button>
 * </app-banner>
 * ```
 *
 * O texto vai no conteúdo; botões de ação levam o atributo `bannerActions`.
 */
@Component({
  selector: 'app-banner',
  imports: [GlyphComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div
      class="banner"
      [class.banner--success]="variant() === 'success'"
      [class.banner--attention]="variant() === 'attention'"
      [class.banner--danger]="variant() === 'danger'"
      [class.banner--prototype]="variant() === 'prototype'"
      [class.banner--consent]="variant() === 'consent'"
      [attr.role]="resolvedRole()"
    >
      <svg [appGlyph]="resolvedIcon()"></svg>
      <div class="banner__body">
        @if (heading()) {
          <p class="banner__title">{{ heading() }}</p>
        }
        <div class="banner__text"><ng-content /></div>
        <div class="banner__actions"><ng-content select="[bannerActions]" /></div>
      </div>
      @if (dismissible()) {
        <button
          type="button"
          class="btn btn--ghost btn--icon btn--sm"
          [attr.aria-label]="dismissLabel()"
          (click)="dismissed.emit()"
        >
          <svg appGlyph="x" glyphSize="sm"></svg>
        </button>
      }
    </div>
  `,
})
export class BannerComponent {
  readonly variant = input<BannerVariant>('info');
  /** Título curto em destaque (não use `title`, que vira dica do navegador). */
  readonly heading = input<string>('');
  /** Nome de um ícone do sprite; por padrão vem da variante. */
  readonly icon = input<string | null>(null);
  readonly liveRole = input<'status' | 'alert' | 'note' | null>(null);
  readonly dismissible = input(false);
  readonly dismissLabel = input('Dispensar aviso');
  readonly dismissed = output<void>();

  protected readonly resolvedIcon = computed(() => this.icon() ?? ICONS[this.variant()]);
  protected readonly resolvedRole = computed(() => {
    const explicit = this.liveRole();
    if (explicit) {
      return explicit;
    }
    switch (this.variant()) {
      case 'danger':
        return 'alert';
      case 'prototype':
        return null;
      case 'consent':
        return null;
      default:
        return 'status';
    }
  });
}
