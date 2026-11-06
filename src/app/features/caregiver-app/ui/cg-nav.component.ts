import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent, IconName } from '../../../shared/ui/display/icon.component';

export interface CgNavItem {
  id: string;
  label: string;
  /** Rota base, absoluta. A seção fica atual também nas subtelas dela. */
  path: string;
  icon: IconName;
}

/** Os 5 destinos fixos (docs/10-cuidador-contexto.md, "Arquitetura de informação"). Não mude a ordem nem os nomes. */
export const CG_NAV_ITEMS: readonly CgNavItem[] = [
  { id: 'hoje', label: 'Hoje', path: '/cuidador/hoje', icon: 'house' },
  { id: 'rotina', label: 'Rotina', path: '/cuidador/rotina', icon: 'calendar-days' },
  { id: 'cuidar', label: 'Cuidar de mim', path: '/cuidador/cuidar-de-mim', icon: 'hand-heart' },
  { id: 'rede', label: 'Rede', path: '/cuidador/rede', icon: 'handshake' },
  { id: 'mais', label: 'Mais', path: '/cuidador/mais', icon: 'ellipsis' },
];

/**
 * Navegação principal do aplicativo (UX A.2.2). `variant="bottom"` é a barra inferior do celular e do tablet
 * (abaixo de 1024 px); `variant="top"` são as abas de texto no cabeçalho em tela larga. O shell monta UMA das
 * duas por vez. A seção atual leva `aria-current="page"` (também nas subtelas), linha dourada e peso 700: o
 * destaque nunca depende só de cor. Sem contador e sem ponto de notificação.
 *
 * ```html
 * <app-cg-nav variant="bottom" />
 * ```
 */
@Component({
  selector: 'app-cg-nav',
  imports: [RouterLink, RouterLinkActive, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': "'cg-nav cg-nav--' + variant()" },
  template: `
    <nav aria-label="Navegação principal">
      <ul class="cg-nav__list">
        @for (item of items(); track item.id) {
          <li class="cg-nav__li">
            <a
              class="cg-nav__link"
              [attr.data-sec]="item.id"
              [routerLink]="item.path"
              routerLinkActive="is-current"
              ariaCurrentWhenActive="page"
            >
              <span class="cg-nav__icon"><svg [appIcon]="item.icon" size="lg"></svg></span>
              <span class="cg-nav__label">{{ item.label }}</span>
            </a>
          </li>
        }
      </ul>
    </nav>
  `,
})
export class CgNavComponent {
  readonly variant = input<'bottom' | 'top'>('bottom');
  readonly items = input<readonly CgNavItem[]>(CG_NAV_ITEMS);
}
