import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { SearchService } from '../../core/search/search.service';
import { DialogService } from '../../shared/ui/overlay/dialog.service';
import { IconComponent } from '../../shared/ui/display/icon.component';
import { LayoutDialogsService } from '../state/layout-dialogs.service';
import { UiPrefsService } from '../../shared/ui/overlay/ui-prefs.service';
import { initialsOf, roleLabel } from '../../shared/ui/overlay/user-display';

/**
 * Menu do usuário (SCR-M01-03, UX 3.7), aberto pelo avatar. Nesta ordem: nome e perfil por extenso (com o
 * aviso de inatividade), preferências (tema escuro, modo discreto, atalhos de uma tecla, reduzir
 * movimento, tabelas compactas), atalhos de teclado, política de privacidade e canal do titular, meus
 * dados no navegador, trocar perfil e sair.
 *
 * Teclado: setas movem entre os itens, Home e End vão às pontas, Esc fecha e devolve o foco ao avatar.
 * Trocar perfil e Sair encerram a sessão, gravam o logout no log e levam à entrada.
 */
@Component({
  selector: 'app-user-menu',
  imports: [IconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'menu-anchor',
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'onEscape()',
  },
  template: `
    @if (user(); as u) {
      <button
        #trigger
        type="button"
        class="btn btn--ghost user-trigger"
        aria-haspopup="menu"
        aria-controls="nx-user-menu"
        [attr.aria-expanded]="open()"
        [attr.aria-label]="'Menu do usuário: ' + u.displayName + ', ' + role()"
        (click)="toggle()"
      >
        <span class="avatar avatar--sm">{{ initials() }}</span>
        <span class="user-trigger__text hide-md">
          <span class="user-trigger__name">{{ u.displayName }}</span>
          <span class="user-trigger__role">{{ role() }}</span>
        </span>
        <svg appIcon="chevron-down" size="sm"></svg>
      </button>

      @if (open()) {
        <div
          class="menu menu--user"
          id="nx-user-menu"
          role="menu"
          aria-label="Menu do usuário"
          #menu
          (keydown)="onMenuKeydown($event)"
        >
          <div class="menu__header">
            <strong>{{ u.displayName }}</strong>
            <span>{{ role() }}</span>
            <span class="block">Sessão encerra por inatividade em 30 min</span>
          </div>

          <p class="menu__group-label" role="presentation">Preferências</p>
          <button
            type="button"
            class="menu__item"
            role="menuitemcheckbox"
            [attr.aria-checked]="prefs.theme() === 'dark'"
            (click)="prefs.toggleTheme()"
          >
            <svg [appIcon]="prefs.theme() === 'dark' ? 'moon' : 'sun'"></svg>
            <span class="flex-1">Tema escuro</span>
            <span class="menu__state">{{ prefs.theme() === 'dark' ? 'Ligado' : 'Desligado' }}</span>
          </button>
          <button
            type="button"
            class="menu__item"
            role="menuitemcheckbox"
            [attr.aria-checked]="prefs.discreet()"
            (click)="prefs.setDiscreet(!prefs.discreet())"
          >
            <svg appIcon="eye-off"></svg>
            <span class="flex-1">Modo discreto</span>
            <span class="menu__state">{{ prefs.discreet() ? 'Ligado' : 'Desligado' }}</span>
          </button>
          <button
            type="button"
            class="menu__item"
            role="menuitemcheckbox"
            [attr.aria-checked]="prefs.density() === 'compact'"
            (click)="prefs.setDensity(prefs.density() === 'compact' ? 'comfortable' : 'compact')"
          >
            <svg appIcon="table"></svg>
            <span class="flex-1">Tabelas compactas</span>
            <span class="menu__state">{{
              prefs.density() === 'compact' ? 'Ligado' : 'Desligado'
            }}</span>
          </button>
          <button
            type="button"
            class="menu__item"
            role="menuitemcheckbox"
            [attr.aria-checked]="prefs.singleKeyShortcuts()"
            (click)="prefs.setSingleKeyShortcuts(!prefs.singleKeyShortcuts())"
          >
            <svg appIcon="key-round"></svg>
            <span class="flex-1">Atalhos de uma tecla</span>
            <span class="menu__state">{{
              prefs.singleKeyShortcuts() ? 'Ligado' : 'Desligado'
            }}</span>
          </button>
          <button
            type="button"
            class="menu__item"
            role="menuitemcheckbox"
            [attr.aria-checked]="prefs.reduceMotion()"
            (click)="prefs.setReduceMotion(!prefs.reduceMotion())"
          >
            <svg appIcon="pause"></svg>
            <span class="flex-1">Reduzir movimento</span>
            <span class="menu__state">{{ prefs.reduceMotion() ? 'Ligado' : 'Desligado' }}</span>
          </button>

          <div class="menu__sep" role="separator"></div>
          <button type="button" class="menu__item" role="menuitem" (click)="openShortcuts()">
            <svg appIcon="circle-help"></svg><span class="flex-1">Atalhos de teclado</span
            ><kbd class="kbd">?</kbd>
          </button>
          <a
            class="menu__item"
            role="menuitem"
            routerLink="/app/canal-do-titular"
            (click)="close(false)"
          >
            <svg appIcon="shield-check"></svg
            ><span class="flex-1">Privacidade e canal do titular</span>
          </a>
          <a
            class="menu__item"
            role="menuitem"
            routerLink="/app/meus-dados"
            (click)="close(false)"
          >
            <svg appIcon="database"></svg><span class="flex-1">Meus dados no navegador</span>
          </a>

          <div class="menu__sep" role="separator"></div>
          <button
            type="button"
            class="menu__item"
            role="menuitem"
            data-role="switch-profile"
            (click)="switchProfile()"
          >
            <svg appIcon="refresh-cw"></svg><span class="flex-1">Trocar perfil</span>
          </button>
          <button
            type="button"
            class="menu__item"
            role="menuitem"
            data-role="sign-out"
            (click)="signOut()"
          >
            <svg appIcon="log-out"></svg><span class="flex-1">Sair</span>
          </button>
        </div>
      }
    }
  `,
})
export class UserMenuComponent {
  protected readonly auth = inject(AuthService);
  protected readonly prefs = inject(UiPrefsService);
  private readonly router = inject(Router);
  private readonly dialogs = inject(LayoutDialogsService);
  private readonly confirmDialogs = inject(DialogService);
  private readonly search = inject(SearchService);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly menu = viewChild<ElementRef<HTMLElement>>('menu');

  protected readonly user = this.auth.user;
  protected readonly open = signal(false);
  protected readonly role = computed(() => {
    const role = this.auth.role();
    return role ? roleLabel(role) : '';
  });
  protected readonly initials = computed(() => initialsOf(this.user()?.displayName ?? ''));

  protected toggle(): void {
    if (this.open()) {
      this.close(true);
      return;
    }
    this.open.set(true);
    afterNextRender(() => this.items()[0]?.focus(), { injector: this.injector });
  }

  protected close(returnFocus: boolean): void {
    this.open.set(false);
    if (returnFocus) {
      this.trigger()?.nativeElement.focus();
    }
  }

  protected onEscape(): void {
    if (this.open()) {
      this.close(true);
    }
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.close(false);
    }
  }

  protected onMenuKeydown(event: KeyboardEvent): void {
    const items = this.items();
    const index = items.indexOf(document.activeElement as HTMLElement);
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        items[(index + 1) % items.length]?.focus();
        return;
      case 'ArrowUp':
        event.preventDefault();
        items[(index - 1 + items.length) % items.length]?.focus();
        return;
      case 'Home':
        event.preventDefault();
        items[0]?.focus();
        return;
      case 'End':
        event.preventDefault();
        items[items.length - 1]?.focus();
        return;
      case 'Tab':
        this.close(false);
        return;
    }
  }

  protected openShortcuts(): void {
    this.close(false);
    this.dialogs.openShortcuts();
  }

  /** Trocar de perfil encerra a sessão e volta à entrada; o log registra o logout e o próximo login. */
  protected switchProfile(): void {
    this.close(false);
    this.endSession(() => this.auth.switchProfile());
  }

  protected signOut(): void {
    this.close(false);
    this.endSession(() => this.auth.logout('user'));
  }

  private endSession(end: () => void): void {
    this.confirmDialogs.cancelAll();
    this.search.clearRecents();
    end();
    void this.router.navigateByUrl('/login');
  }

  private items(): HTMLElement[] {
    const menu = this.menu()?.nativeElement;
    return menu ? Array.from(menu.querySelectorAll<HTMLElement>('[role^="menuitem"]')) : [];
  }
}
