import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';
import { IconComponent, IconName } from './icon.component';

export type EmptyKind = 'empty' | 'error' | 'forbidden' | 'private';

const KIND_ICON: Record<Exclude<EmptyKind, 'empty'>, { icon: IconName }> = {
  error: { icon: 'circle-alert' },
  forbidden: { icon: 'lock' },
  private: { icon: 'lock' },
};

/**
 * Estado vazio, de erro e de acesso (PD-16). Acolhedor: título serifado curto, uma frase que explica o que
 * aparece ali e quando, e até duas ações (conteúdo projetado). Vazio mostra as mãos da marca; erro,
 * "sem permissão" e "menos de 5" mostram um ícone. Toda lista tem um (AC-GL-01); nunca uma tabela em branco.
 *
 * ```html
 * <app-empty-state title="Nenhum alerta aberto por aqui" text="Quando uma aplicação da escala indicar atenção, o caso aparece nesta fila.">
 *   <button class="btn">Ver histórico</button>
 * </app-empty-state>
 * ```
 */
@Component({
  selector: 'app-empty-state',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()', '[attr.role]': "kind() === 'error' ? 'alert' : 'status'" },
  template: `
    @if (visual(); as v) {
      <span class="empty__icon" [class.empty__icon--danger]="kind() === 'error'"><svg [appIcon]="v.icon" size="lg"></svg></span>
    } @else {
      <svg class="empty__art" viewBox="-18 3 156 98" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <use href="icons/sprite.svg#nx-hands" />
        <circle class="art-soft" cx="60" cy="38" r="12" stroke-dasharray="3 4" />
      </svg>
    }
    <h3 class="empty__title">{{ title() }}</h3>
    @if (text()) {
      <p class="empty__text">{{ text() }}</p>
    }
    <div class="empty__actions"><ng-content /></div>
  `,
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly text = input<string>();
  readonly kind = input<EmptyKind>('empty');
  /** Versão menor, para dentro de cartão e tabela. */
  readonly compact = input(false, { transform: booleanAttribute });

  protected readonly visual = computed(() => (this.kind() === 'empty' ? null : KIND_ICON[this.kind() as Exclude<EmptyKind, 'empty'>]));
  protected readonly classes = computed(() => `empty${this.compact() ? ' empty--compact' : ''}`);
}
