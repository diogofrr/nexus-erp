import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../shared/ui/display/icon.component';
import { CgNavComponent } from './cg-nav.component';

/**
 * Cabeçalho do aplicativo (UX A.2.1): a marca à esquerda e o botão "Ajuda agora" SEMPRE visível à direita, em
 * todas as telas, inclusive `/cuidador/comecar`. O botão é um link de verdade para `/cuidador/ajuda-agora`
 * (1 toque), com o texto sempre à mostra, e nunca pisca nem muda de cor. Em tela larga (1024 px ou mais) a
 * navegação principal entra no meio (`showNav`). O conteúdo projetado fica à direita do botão (menu do usuário ou
 * o link "Entrar").
 *
 * ```html
 * <app-cg-header [showNav]="signedIn()"><app-cg-user-menu /></app-cg-header>
 * ```
 */
@Component({
  selector: 'app-cg-header',
  imports: [RouterLink, IconComponent, CgNavComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cg-header' },
  template: `
    <header class="cg-header__bar">
      <a class="cg-header__brand" [routerLink]="homeLink()" aria-label="Nexus, ir para o início">
        <svg class="brand-symbol" aria-hidden="true"><use href="icons/sprite.svg#nx-symbol" /></svg>
        <span class="wordmark">Nexus</span>
      </a>
      @if (showNav()) {
        <app-cg-nav variant="top" />
      }
      <div class="cg-header__end">
        <a class="cg-help-now" routerLink="/cuidador/ajuda-agora">
          <svg appIcon="life-buoy" size="lg"></svg>
          <span>Ajuda agora</span>
        </a>
        <ng-content />
      </div>
    </header>
  `,
})
export class CgHeaderComponent {
  /** Navegação principal no meio do cabeçalho (só em tela larga, com sessão). */
  readonly showNav = input(false);
  readonly homeLink = input('/cuidador/hoje');
}
