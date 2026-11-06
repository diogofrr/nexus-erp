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
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../shared/ui/display/icon.component';
import { initialsOf } from '../../../shared/ui/overlay/user-display';
import { CaregiverContextService } from '../state/caregiver-context.service';
import { CaregiverSignOutService } from './caregiver-sign-out.service';

/**
 * Menu do usuário do cabeçalho do aplicativo do cuidador: o nome, "Meu perfil", "Privacidade e meus dados" e
 * "Sair". O botão tem 48 px; abaixo de 768 px mostra só as iniciais. Teclado: setas movem entre os itens, Home e
 * End vão às pontas, Esc fecha e devolve o foco ao botão. Não tem preferências de painel (tema, atalhos): o
 * tamanho da letra fica em "Mais".
 */
@Component({
  selector: 'app-cg-user-menu',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'cg-user-menu',
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'onEscape()',
  },
  template: `
    @if (ctx.caregiver(); as caregiver) {
      <button
        #trigger
        type="button"
        class="cg-user-menu__trigger"
        aria-haspopup="menu"
        aria-controls="cg-user-menu"
        [attr.aria-expanded]="open()"
        [attr.aria-label]="'Menu de ' + caregiver.fullName"
        (click)="toggle()"
      >
        <span class="cg-user-menu__avatar" aria-hidden="true">{{ initials() }}</span>
        <span class="cg-user-menu__name">{{ ctx.firstName() }}</span>
        <svg appIcon="chevron-down" size="sm"></svg>
      </button>

      @if (open()) {
        <!-- O toque fora do menu só fecha o menu: esta camada o consome, então ele não cai no cartão ou botão que estava embaixo. -->
        <div class="cg-user-menu__scrim" data-role="menu-scrim" aria-hidden="true" (click)="close(false)"></div>
        <div
          #menu
          class="cg-user-menu__panel"
          id="cg-user-menu"
          role="menu"
          aria-label="Menu do usuário"
          (keydown)="onMenuKeydown($event)"
        >
          <p class="cg-user-menu__who">
            <strong>{{ caregiver.fullName }}</strong>
            <span>Plano {{ ctx.planName() }}</span>
          </p>
          <a class="cg-user-menu__item" role="menuitem" routerLink="/cuidador/mais/perfil" (click)="close(false)">
            <svg appIcon="user-round"></svg><span>Meu perfil</span>
          </a>
          <a class="cg-user-menu__item" role="menuitem" routerLink="/cuidador/mais/privacidade" (click)="close(false)">
            <svg appIcon="shield-check"></svg><span>Privacidade e meus dados</span>
          </a>
          <button type="button" class="cg-user-menu__item" role="menuitem" data-role="sign-out" (click)="signOut()">
            <svg appIcon="log-out"></svg><span>Sair</span>
          </button>
        </div>
      }
    }
  `,
})
export class CaregiverUserMenuComponent {
  protected readonly ctx = inject(CaregiverContextService);
  private readonly signOutService = inject(CaregiverSignOutService);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly menu = viewChild<ElementRef<HTMLElement>>('menu');

  protected readonly open = signal(false);
  protected readonly initials = computed(() => initialsOf(this.ctx.caregiver()?.fullName ?? ''));

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

  protected signOut(): void {
    this.close(false);
    void this.signOutService.signOut();
  }

  private items(): HTMLElement[] {
    const menu = this.menu()?.nativeElement;
    return menu ? Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]')) : [];
  }
}
