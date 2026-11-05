import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { Clock } from '../../core/clock/clock.service';
import { DateBrPipe } from '../../core/format/pipes';
import { ModuleKey } from '../../core/auth/module-map';
import { NotificationService } from '../../core/notifications/notification.service';
import { PROTOTYPE_NOTICE } from '../../core/privacy/browser-data.service';
import { NavGroupId, screensFor } from '../../core/search/screens';
import { SearchService } from '../../core/search/search.service';
import { IconComponent } from '../../shared/ui/display/icon.component';
import { ToastService } from '../../shared/ui/overlay/toast.service';
import { NavEntry, NavLink, activeGroupOf, buildNavigation, pinnedLinks } from '../nav/nav.model';
import { CommandPaletteComponent } from '../search/command-palette.component';
import { PaletteService } from '../search/palette.service';
import { ShortcutService } from '../shortcuts/shortcut.service';
import { LayoutDialogsService } from '../state/layout-dialogs.service';
import { MAX_PINNED, UiPrefsService } from '../../shared/ui/overlay/ui-prefs.service';
import { initialsOf, roleLabel } from '../../shared/ui/overlay/user-display';
import { ViewportService } from '../state/viewport.service';
import { BreadcrumbsComponent } from './breadcrumbs.component';
import { LayoutDialogsComponent } from './layout-dialogs.component';
import { NotificationBellComponent } from './notification-bell.component';
import { SystemBannersComponent } from './system-banners.component';
import { UserMenuComponent } from './user-menu.component';

/**
 * Shell da equipe (`/app/**`, UX 3): menu lateral em pilar azul com o símbolo dourado, barra superior com
 * migalhas, busca global (`Ctrl+K`), chip do relógio simulado, sino, ajuda e menu do usuário, conteúdo e
 * rodapé fixo com o aviso de protótipo.
 *
 * - **Menu por perfil**: vem de `menuFor(role)` do núcleo, nunca mostra o que o perfil não pode abrir
 *   (AC-M01-08). Grupos recolháveis (estado lembrado por usuário), "Fixados" para perfis com muitos itens
 *   (U-01), contador só onde há ação (com texto para leitor de tela).
 * - **Responsivo**: abaixo de 1024 px o menu é uma gaveta (foco preso, Esc, toque fora, item escolhido
 *   fecha); de 1024 a 1279 px é um trilho de ícones que o botão expande sobre o conteúdo; de 1280 px é o
 *   menu completo, recolhível a trilho.
 * - **Acessibilidade**: link de pular para o conteúdo, foco no `h1` a cada navegação (feito pelo
 *   `PageChromeService`), `aria-current="page"` no item da rota atual.
 */
@Component({
  selector: 'app-team-shell',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    DateBrPipe,
    IconComponent,
    BreadcrumbsComponent,
    CommandPaletteComponent,
    LayoutDialogsComponent,
    NotificationBellComponent,
    SystemBannersComponent,
    UserMenuComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block', '(document:keydown)': 'shortcuts.handle($event)' },
  templateUrl: './team-shell.component.html',
})
export class TeamShellComponent {
  protected readonly auth = inject(AuthService);
  protected readonly clock = inject(Clock);
  protected readonly prefs = inject(UiPrefsService);
  protected readonly palette = inject(PaletteService);
  protected readonly dialogs = inject(LayoutDialogsService);
  protected readonly shortcuts = inject(ShortcutService);
  private readonly notifications = inject(NotificationService);
  private readonly viewport = inject(ViewportService);
  private readonly router = inject(Router);
  private readonly search = inject(SearchService);
  private readonly toasts = inject(ToastService);
  private readonly injector = inject(Injector);
  private readonly menuButton = viewChild.required<ElementRef<HTMLButtonElement>>('menuButton');

  protected readonly notice = PROTOTYPE_NOTICE;
  /** Gaveta do menu aberta (abaixo de 1024 px). */
  protected readonly drawerOpen = signal(false);
  /** Menu completo aberto sobre o conteúdo (de 1024 a 1279 px). */
  private readonly railExpanded = signal(false);

  protected readonly entries = computed<NavEntry[]>(() => {
    const role = this.auth.role();
    return role ? buildNavigation(role) : [];
  });

  /** Perfis com muitos itens (sócia e RT) fixam atalhos no topo do menu (U-01). */
  protected readonly canPin = computed(() => this.allLinks().length >= 12);
  private readonly allLinks = computed(() =>
    this.entries().flatMap((e) => (e.kind === 'link' ? [e.link] : e.links)),
  );

  protected readonly pinned = computed<NavLink[]>(() => {
    const role = this.auth.role();
    const userId = this.auth.user()?.id;
    return role && userId && this.canPin() ? pinnedLinks(role, this.prefs.pinned(userId)) : [];
  });

  protected readonly initials = computed(() => initialsOf(this.auth.user()?.displayName ?? ''));
  protected readonly role = computed(() => {
    const role = this.auth.role();
    return role ? roleLabel(role) : '';
  });

  protected readonly navMode = computed<'rail' | 'expanded' | null>(() => {
    switch (this.viewport.navLayout()) {
      case 'full':
        return this.prefs.menuRail() ? 'rail' : null;
      case 'rail':
        return this.railExpanded() ? 'expanded' : null;
      default:
        return null;
    }
  });

  protected readonly menuExpanded = computed(() =>
    this.viewport.navLayout() === 'drawer' ? this.drawerOpen() : this.navMode() === 'expanded',
  );

  protected readonly canOpenClock = computed(() =>
    screensFor(this.auth.role() ?? 'support').some((s) => s.link === '/app/configuracoes/relogio'),
  );
  protected readonly clockLabel = computed(() =>
    `Hoje (simulado): ${this.clock.today().split('-').reverse().join('/')}. ${this.canOpenClock() ? 'Abrir o relógio simulado' : ''}`.trim(),
  );

  constructor() {
    // A cada navegação: fecha a gaveta, abre o grupo da rota atual e registra a tela nos recentes.
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((e) => {
        this.closeNav(false);
        const userId = this.auth.user()?.id;
        const group = activeGroupOf(e.urlAfterRedirects, this.entries());
        if (userId && group && this.prefs.collapsedGroups(userId).includes(group)) {
          this.prefs.setGroupCollapsed(userId, group, false);
        }
        this.search.recordVisit(e.urlAfterRedirects.split(/[?#]/)[0] ?? '');
      });
  }

  protected entryId(entry: NavEntry): string {
    return entry.kind === 'link' ? `link:${entry.link.key}` : `group:${entry.id}`;
  }

  protected isExpanded(group: NavGroupId): boolean {
    const userId = this.auth.user()?.id;
    return !userId || !this.prefs.collapsedGroups(userId).includes(group);
  }

  protected toggleGroup(group: NavGroupId): void {
    const userId = this.auth.user()?.id;
    if (userId) {
      this.prefs.setGroupCollapsed(userId, group, this.isExpanded(group));
    }
  }

  protected isPinned(key: ModuleKey): boolean {
    const userId = this.auth.user()?.id;
    return !!userId && this.prefs.pinned(userId).includes(key);
  }

  protected togglePin(link: NavLink): void {
    const userId = this.auth.user()?.id;
    if (userId && !this.prefs.togglePin(userId, link.key)) {
      this.toasts.attention(`Você já fixou ${MAX_PINNED} itens. Desafixe um para fixar outro.`);
    }
  }

  protected counterOf(key: ModuleKey): { count: number; label: string } | null {
    return this.notifications.counterFor(key);
  }

  /** Nome acessível do item: o rótulo e, quando há contador, o texto dele ("3 mensagens atrasadas"). */
  protected linkLabel(link: NavLink): string {
    const counter = this.notifications.counterFor(link.key);
    return counter ? `${link.label}, ${counter.label}` : link.label;
  }

  protected toggleNav(): void {
    switch (this.viewport.navLayout()) {
      case 'drawer':
        if (this.drawerOpen()) {
          this.closeNav(true);
        } else {
          this.drawerOpen.set(true);
          afterNextRender(
            () => document.querySelector<HTMLElement>('.sidebar .nav-item')?.focus(),
            { injector: this.injector },
          );
        }
        return;
      case 'rail':
        this.railExpanded.update((v) => !v);
        return;
      default:
        this.prefs.setMenuRail(!this.prefs.menuRail());
    }
  }

  /** Fecha a gaveta ou o menu expandido; com `returnFocus`, devolve o foco ao botão do menu. */
  protected closeNav(returnFocus: boolean): void {
    const wasOpen = this.drawerOpen() || this.railExpanded();
    this.drawerOpen.set(false);
    this.railExpanded.set(false);
    if (wasOpen && returnFocus) {
      // O botão fica dentro da barra com `inert` enquanto a gaveta está aberta: o foco só volta depois da renderização.
      afterNextRender(() => this.menuButton().nativeElement.focus(), { injector: this.injector });
    }
  }

  protected onShellEscape(): void {
    this.closeNav(true);
  }

  /** "Pular para o conteúdo" sem depender do `href` (a base `/` o levaria para a raiz). */
  protected skipToContent(event: Event): void {
    event.preventDefault();
    const main = document.getElementById('conteudo');
    main?.focus();
    main?.scrollIntoView?.({ block: 'start' });
  }

  /** Modo discreto: um clique revela (ou volta a borrar) um nome ou contato borrado. */
  protected onMainClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element) || !this.prefs.discreet()) {
      return;
    }
    const field = target.closest<HTMLElement>('.discreet');
    if (field) {
      field.toggleAttribute('data-revealed');
    }
  }
}
