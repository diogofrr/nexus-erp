import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent } from './icon.component';

/**
 * Esqueleto de carregamento, na forma do conteúdo (nunca spinner no meio). É decorativo (`aria-hidden`):
 * marque a REGIÃO que carrega com `aria-busy="true"`. Sem brilho com movimento reduzido.
 *
 * ```html
 * <div aria-busy="true"><app-skeleton variant="title" /><app-skeleton [lines]="3" /></div>
 * ```
 */
@Component({
  selector: 'app-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', class: 'stack stack--2' },
  template: `
    @for (line of rows(); track $index) {
      <span [class]="'skeleton skeleton--' + variant() + (variant() === 'text' && $last && lines() > 1 ? ' skeleton--short' : '')"></span>
    }
  `,
})
export class SkeletonComponent {
  readonly variant = input<'text' | 'title' | 'value' | 'circle' | 'block'>('text');
  /** Quantas linhas (só para `text`). A última sai mais curta. */
  readonly lines = input(1);
  protected readonly rows = computed(() => Array.from({ length: Math.max(1, this.variant() === 'text' ? this.lines() : 1) }));
}

/**
 * Placeholder consistente para o que existe mas o perfil não vê (UX 6.3): cadeado e frase curta, nunca célula
 * em branco, `---` ou `null`.
 *
 * ```html
 * <app-placeholder-line reason="hidden" />            <!-- Oculto para o seu perfil -->
 * <app-placeholder-line reason="small-group" />       <!-- Menos de 5 pessoas -->
 * ```
 */
@Component({
  selector: 'app-placeholder-line',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'placeholder-line' },
  template: `<svg appIcon="lock" size="sm"></svg>{{ text() }}`,
})
export class PlaceholderLineComponent {
  readonly reason = input<'hidden' | 'no-result' | 'small-group' | 'other-psychologist'>('hidden');
  /** Substitui a frase padrão. */
  readonly textOverride = input<string | undefined>(undefined, { alias: 'text' });

  protected readonly text = computed(() => {
    const custom = this.textOverride();
    if (custom) {
      return custom;
    }
    switch (this.reason()) {
      case 'no-result':
        return 'Sem acesso ao resultado';
      case 'small-group':
        return 'Menos de 5 pessoas';
      case 'other-psychologist':
        return 'Disponível só para o psicólogo do caso';
      default:
        return 'Oculto para o seu perfil';
    }
  });
}
