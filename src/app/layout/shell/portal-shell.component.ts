import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { Database } from '../../core/data/database';
import { PROTOTYPE_NOTICE } from '../../core/privacy/browser-data.service';
import { SearchService } from '../../core/search/search.service';
import { DialogService } from '../../shared/ui/overlay/dialog.service';
import { GlyphComponent } from '../../shared/ui/overlay/glyph.component';
import { closeModalDialog, showModalDialog } from '../../shared/ui/overlay/modal';
import { PORTAL_BOTTOM_NAV, portalMoreLinks } from '../nav/nav.model';
import { CommandPaletteComponent } from '../search/command-palette.component';
import { PaletteService } from '../search/palette.service';
import { ShortcutService } from '../shortcuts/shortcut.service';
import { LayoutDialogsService } from '../state/layout-dialogs.service';
import { LayoutDialogsComponent } from './layout-dialogs.component';
import { NotificationBellComponent } from './notification-bell.component';
import { SystemBannersComponent } from './system-banners.component';
import { UserMenuComponent } from './user-menu.component';

/**
 * Shell do portal do profissional credenciado (`/portal/**`, M14, UX 3.10): mobile first, uma coluna de até
 * 60 rem.
 *
 * - Cabeçalho com a marca, busca (só as próprias telas e solicitações), sino e menu do usuário (avatar
 *   dourado).
 * - Barra inferior fixa em celular E tablet (até 1023 px) com 5 destinos: Início, Solicitações,
 *   Disponibilidade, Mensagens e Mais (que abre Minha avaliação, Documentos, Integração, Meu perfil,
 *   Privacidade e Sair). De 1024 px em diante vira barra horizontal sob o cabeçalho.
 * - O rodapé rola acima da barra inferior; nada o cobre.
 */
@Component({
  selector: 'app-portal-shell',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    GlyphComponent,
    CommandPaletteComponent,
    LayoutDialogsComponent,
    NotificationBellComponent,
    SystemBannersComponent,
    UserMenuComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block', '(document:keydown)': 'shortcuts.handle($event)' },
  template: `
    <div class="portal-shell">
      <a class="skip-link" href="#conteudo" (click)="skipToContent($event)">Ir para o conteúdo</a>
      <header class="portal-header">
        <a class="topbar__brand" routerLink="/portal" aria-label="Nexus, ir ao início">
          <svg class="brand-symbol" aria-hidden="true">
            <use href="icons/sprite.svg#nx-symbol" />
          </svg>
          <span class="wordmark">Nexus</span>
        </a>
        <div class="topbar__actions">
          <button
            type="button"
            class="btn btn--ghost btn--icon"
            aria-label="Buscar ou ir para (Ctrl K)"
            (click)="palette.open()"
          >
            <svg appGlyph="search"></svg>
          </button>
          <app-notification-bell />
          <app-user-menu area="portal" />
        </div>
      </header>

      <nav class="bottom-nav" aria-label="Portal">
        @for (link of links; track link.path) {
          <a
            class="bottom-nav__item"
            [routerLink]="link.path"
            routerLinkActive="is-active"
            ariaCurrentWhenActive="page"
            [routerLinkActiveOptions]="{ exact: link.exact === true }"
          >
            <svg [appGlyph]="link.icon"></svg>
            <span>{{ link.label }}</span>
          </a>
        }
        <button
          #moreButton
          type="button"
          class="bottom-nav__item"
          aria-haspopup="dialog"
          [attr.aria-current]="moreActive() ? 'page' : null"
          (click)="moreOpen.set(true)"
        >
          <svg appGlyph="ellipsis"></svg>
          <span>Mais</span>
        </button>
      </nav>

      <main class="portal-main" id="conteudo" tabindex="-1">
        <app-system-banners />
        <router-outlet />
      </main>

      <footer class="app-footer">
        <svg appGlyph="info"></svg>
        <span>{{ notice }}</span>
        <nav class="app-footer__links" aria-label="Rodapé">
          <a routerLink="/portal/canal-do-titular">Privacidade e canal do titular</a>
          <a routerLink="/portal/meus-dados">Meus dados no navegador</a>
          <button type="button" class="btn-link" (click)="dialogs.openShortcuts()">Atalhos</button>
          <button type="button" class="btn-link" (click)="dialogs.openAbout()">Sobre</button>
        </nav>
      </footer>
    </div>

    <dialog
      #more
      class="dialog dialog--sheet"
      aria-labelledby="nx-more-title"
      (cancel)="onMoreCancel($event)"
      (click)="onMoreBackdrop($event)"
    >
      <div class="dialog__header">
        <h2 class="dialog__title" id="nx-more-title">Mais</h2>
      </div>
      <div class="dialog__body more-sheet">
        <div class="list-card">
          @for (link of moreLinks(); track link.path) {
            <a class="list-row" [routerLink]="link.path" (click)="moreOpen.set(false)">
              <span class="avatar avatar--sm avatar--gold"
                ><svg [appGlyph]="link.icon" glyphSize="sm"></svg
              ></span>
              <span
                ><span class="list-row__title">{{ link.label }}</span></span
              >
              <svg appGlyph="chevron-right" glyphSize="sm"></svg>
            </a>
          }
          <button type="button" class="list-row" data-role="sign-out" (click)="signOut()">
            <span class="avatar avatar--sm"><svg appGlyph="log-out" glyphSize="sm"></svg></span>
            <span><span class="list-row__title">Sair</span></span>
            <span></span>
          </button>
        </div>
      </div>
      <div class="dialog__footer">
        <button type="button" class="btn" data-role="close" (click)="moreOpen.set(false)">
          Fechar
        </button>
      </div>
    </dialog>

    <app-command-palette />
    <app-layout-dialogs area="portal" />
  `,
})
export class PortalShellComponent {
  protected readonly auth = inject(AuthService);
  protected readonly palette = inject(PaletteService);
  protected readonly dialogs = inject(LayoutDialogsService);
  protected readonly shortcuts = inject(ShortcutService);
  private readonly db = inject(Database);
  private readonly router = inject(Router);
  private readonly search = inject(SearchService);
  private readonly confirmDialogs = inject(DialogService);
  private readonly injector = inject(Injector);
  private readonly moreRef = viewChild.required<ElementRef<HTMLDialogElement>>('more');

  protected readonly notice = PROTOTYPE_NOTICE;
  protected readonly links = PORTAL_BOTTOM_NAV;
  protected readonly moreOpen = signal(false);
  private readonly url = signal(this.router.url);

  /** Prestador suspenso vê "Avaliação interna" no Mais (UX 3.3). */
  private readonly suspended = computed(() => {
    const providerId = this.auth.user()?.providerId;
    return providerId ? this.db.providers.get(providerId)?.status === 'suspended' : false;
  });

  protected readonly moreLinks = computed(() => portalMoreLinks(this.suspended()));

  /** O item "Mais" fica marcado quando a rota atual é um dos destinos dele. */
  protected readonly moreActive = computed(() => {
    const path = this.url().split(/[?#]/)[0] ?? '';
    return this.moreLinks().some((l) => path === l.path || path.startsWith(`${l.path}/`));
  });

  constructor() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((e) => {
        this.url.set(e.urlAfterRedirects);
        this.moreOpen.set(false);
        this.search.recordVisit(e.urlAfterRedirects.split(/[?#]/)[0] ?? '');
      });
    effect(() => {
      const open = this.moreOpen();
      untracked(() => this.syncMore(open));
    });
  }

  protected skipToContent(event: Event): void {
    event.preventDefault();
    const main = document.getElementById('conteudo');
    main?.focus();
    main?.scrollIntoView?.({ block: 'start' });
  }

  protected signOut(): void {
    this.moreOpen.set(false);
    this.confirmDialogs.cancelAll();
    this.search.clearRecents();
    this.auth.logout('user');
    void this.router.navigateByUrl('/login');
  }

  protected onMoreCancel(event: Event): void {
    event.preventDefault();
    this.moreOpen.set(false);
  }

  protected onMoreBackdrop(event: MouseEvent): void {
    if (event.target === this.moreRef().nativeElement) {
      this.moreOpen.set(false);
    }
  }

  private syncMore(open: boolean): void {
    const dialog = this.moreRef().nativeElement;
    if (open) {
      showModalDialog(dialog);
      afterNextRender(() => dialog.querySelector<HTMLElement>('.list-row')?.focus(), {
        injector: this.injector,
      });
    } else {
      closeModalDialog(dialog);
    }
  }
}
