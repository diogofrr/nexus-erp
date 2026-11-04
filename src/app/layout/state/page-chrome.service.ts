import { DOCUMENT } from '@angular/common';
import {
  Injectable,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, NavigationEnd, NavigationStart, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { MODULES } from '../../core/auth/module-map';
import { NAV_ITEMS, navLabel } from '../../core/search/screens';
import { Crumb, PageContextService } from '../../shared/ui/overlay/page-context.service';

/** Sufixo do título da aba (UX 3.9): "Tipo da tela · Nexus ERP". */
export const TITLE_SUFFIX = 'Nexus ERP';

interface RouteInfo {
  title: string | null;
  crumbs: Crumb[];
}

/**
 * Tudo o que muda a cada navegação e não é conteúdo da página (UX 3.9, WCAG 2.4.2 e 2.4.3):
 *
 * - o título da aba (`Perfil do cuidador · Nexus ERP`): o TIPO da tela, vindo de `data.title` da rota ou de
 *   `PageContextService.setTitle`. NUNCA nome, código, escore nem texto livre (LP-21);
 * - as migalhas da barra superior (`Cuidadores / Perfil do cuidador`), de `data.crumb` ou `data.title` de
 *   cada rota da trilha, com o módulo à frente;
 * - o foco no `h1` da página nova, para o leitor de tela anunciar onde está. Só quando o CAMINHO muda
 *   (trocar um filtro na URL não rouba o foco).
 *
 * Ligado uma vez pelo `App` (`start()`).
 */
@Injectable({ providedIn: 'root' })
export class PageChromeService {
  private readonly router = inject(Router);
  private readonly titleService = inject(Title);
  private readonly page = inject(PageContextService);
  private readonly auth = inject(AuthService);
  private readonly doc = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  private readonly info = signal<RouteInfo>({ title: null, crumbs: [] });
  private lastPath: string | null = null;
  private started = false;

  /** Título (sem o sufixo). */
  readonly title = computed(() => this.page.title() ?? this.info().title);
  /** Migalhas: as da página, se ela definiu, senão as das rotas. O último nível não tem `link`. */
  readonly crumbs = computed<readonly Crumb[]>(() => this.page.crumbs() ?? this.info().crumbs);

  /** Liga o serviço aos eventos do roteador. Chame uma vez, no contexto de injeção (raiz do app). */
  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    effect(() => {
      const title = this.title();
      this.titleService.setTitle(title ? `${title} · ${TITLE_SUFFIX}` : TITLE_SUFFIX);
    });
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.page.reset();
      } else if (event instanceof NavigationEnd) {
        this.info.set(this.read(event.urlAfterRedirects));
        const path = event.urlAfterRedirects.split(/[?#]/)[0] ?? '';
        if (path !== this.lastPath) {
          this.lastPath = path;
          this.focusHeading();
        }
      }
    });
  }

  /** Foca o `h1` da página (ou, na falta dele, o contêiner principal). */
  focusHeading(): void {
    afterNextRender(
      () => {
        const target =
          this.doc.querySelector<HTMLElement>('main h1') ??
          this.doc.querySelector<HTMLElement>('#conteudo');
        if (!target) {
          return;
        }
        if (!target.hasAttribute('tabindex')) {
          target.setAttribute('tabindex', '-1');
        }
        target.focus({ preventScroll: false });
      },
      { injector: this.injector },
    );
  }

  private read(url: string): RouteInfo {
    const path = url.split(/[?#]/)[0] ?? '';
    const raw: Crumb[] = [];
    let title: string | null = null;
    let link = '';
    let node: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    while (node) {
      if (node.url.length > 0) {
        link += `/${node.url.map((s) => s.path).join('/')}`;
      }
      const data = node.data;
      const label = typeof data['crumb'] === 'string' ? data['crumb'] : data['title'];
      if (typeof data['title'] === 'string') {
        title = data['title'];
      }
      if (typeof label === 'string') {
        raw.push({ label, link: link || '/' });
      }
      node = node.firstChild;
    }

    // Níveis seguidos com a mesma rota viram um só (módulo e sua lista).
    const crumbs: Crumb[] = [];
    raw.forEach((c) => {
      const last = crumbs[crumbs.length - 1];
      if (last && last.link === c.link) {
        crumbs[crumbs.length - 1] = c;
      } else {
        crumbs.push(c);
      }
    });

    // O módulo vem à frente da trilha quando a primeira rota com título já é uma tela dele.
    const role = this.auth.role();
    const module = MODULES.filter(
      (m) => m.inMenu && (path === m.path || path.startsWith(`${m.path}/`)),
    ).sort((a, b) => b.path.length - a.path.length)[0];
    const item = module ? NAV_ITEMS.find((i) => i.key === module.key) : undefined;
    if (module && item && role && crumbs[0]?.link !== module.path) {
      crumbs.unshift({ label: navLabel(item, role), link: module.path });
    }
    if (!title && item && role) {
      title = navLabel(item, role);
    }

    // A página atual é texto, não link.
    const trail = crumbs.map((c, i) => (i === crumbs.length - 1 ? { label: c.label } : c));
    return { title, crumbs: trail };
  }
}
