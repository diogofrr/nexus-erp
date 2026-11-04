import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { afterEach, describe, expect, it } from 'vitest';
import { MODULES, canAccessModule, menuFor } from '../../core/auth/module-map';
import { PROTOTYPE_NOTICE } from '../../core/privacy/browser-data.service';
import { UiPrefsService } from '../../shared/ui/overlay/ui-prefs.service';
import { NotificationService } from '../../core/notifications/notification.service';
import { BootedApp, bootApp, settle, signIn } from '../testing';
import { ViewportService } from '../state/viewport.service';

const click = (el: Element | null): void => {
  if (!el) {
    throw new Error('elemento não encontrado');
  }
  (el as HTMLElement).click();
};

describe('shell da equipe', () => {
  let app: BootedApp;

  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-discreet');
  });

  const q = <T extends Element = HTMLElement>(selector: string): T | null =>
    app.root.querySelector<T>(selector);
  const all = <T extends Element = HTMLElement>(selector: string): T[] =>
    Array.from(app.root.querySelectorAll<T>(selector));

  it('mostra o menu da sócia (17 itens), o item atual, o aviso literal no rodapé e o link de pular', async () => {
    app = await bootApp({ userId: 'u1' });
    const links = all<HTMLAnchorElement>('.sidebar .nav-item[href]');
    expect(links).toHaveLength(17);
    const current = all('.sidebar .nav-item[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0]?.textContent).toContain('Painel');
    expect(q('.skip-link')?.textContent).toContain('Ir para o conteúdo');
    expect(q('main#conteudo')).not.toBeNull();
    expect(q('.app-footer')?.textContent).toContain(PROTOTYPE_NOTICE);
    const footerLinks = all('.app-footer a, .app-footer button').map((e) => e.textContent?.trim());
    expect(footerLinks).toEqual([
      'Privacidade e canal do titular',
      'Meus dados no navegador',
      'Atalhos',
      'Sobre',
    ]);
    // Perfil por extenso no rodapé do menu e no botão do usuário.
    expect(q('.sidebar__profile')?.textContent).toContain('Sócio/Gestão');
  });

  it('cada perfil da equipe vê só os links que pode abrir (nenhum item sem permissão)', async () => {
    for (const userId of ['u1', 'u2', 'u3', 'u7']) {
      TestBed.resetTestingModule();
      app = await bootApp({ userId });
      const role = app.auth.role();
      expect(role).not.toBeNull();
      const hrefs = all<HTMLAnchorElement>('.sidebar .nav-item[href]').map((a) =>
        a.getAttribute('href'),
      );
      expect(hrefs, userId).toHaveLength(menuFor(role!).length);
      hrefs.forEach((href) => {
        const module = MODULES.find((m) => href === m.path);
        expect(module && canAccessModule(role!, module), `${userId}: ${href}`).toBe(true);
      });
    }
  });

  it('título da aba "Tipo da tela · Nexus ERP" e foco no h1 a cada navegação', async () => {
    app = await bootApp({ userId: 'u1' });
    expect(TestBed.inject(Title).getTitle()).toBe('Painel · Nexus ERP');
    expect(document.activeElement?.tagName).toBe('H1');
    await app.router.navigateByUrl('/app/cuidadores');
    await settle(app.fixture);
    expect(TestBed.inject(Title).getTitle()).toMatch(/^Cuidadores.* · Nexus ERP$/);
    expect(document.activeElement?.tagName).toBe('H1');
    // Nunca nome nem código no título da aba.
    app.db.caregivers
      .list()
      .slice(0, 20)
      .forEach((c) => expect(document.title).not.toContain(c.code));
  });

  it('as migalhas da barra superior vêm das rotas e o menu abre o grupo da rota atual', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/configuracoes/relogio' });
    expect(all('.topbar .breadcrumb li').map((li) => li.textContent?.trim())).toEqual([
      'Configurações',
      'Relógio simulado',
    ]);
    expect(q('.topbar .breadcrumb [aria-current="page"]')?.textContent).toContain(
      'Relógio simulado',
    );
    expect(q('.topbar .breadcrumb a')?.getAttribute('href')).toBe('/app/configuracoes');
    // Atendimento do psicólogo é um grupo: a rota atual deixa o grupo aberto.
    TestBed.resetTestingModule();
    app = await bootApp({ userId: 'u3', url: '/app/grupos' });
    const care = q('[data-group="care"] .nav-group__title');
    expect(care?.getAttribute('aria-expanded')).toBe('true');
  });

  it('grupos recolhíveis: o estado fica lembrado por usuário no repositório de preferências', async () => {
    app = await bootApp({ userId: 'u1' });
    const title = q<HTMLButtonElement>('[data-group="management"] .nav-group__title');
    expect(title?.getAttribute('aria-expanded')).toBe('true');
    click(title);
    await settle(app.fixture);
    expect(q('[data-group="management"] .nav-group__title')?.getAttribute('aria-expanded')).toBe(
      'false',
    );
    expect(q('[data-group="management"] .nav-list')).toBeNull();
    expect(TestBed.inject(UiPrefsService).collapsedGroups('u1')).toContain('management');
    expect(app.local.getItem('nexus-erp:ui-prefs')).toContain('management');
  });

  it('Fixados: a sócia fixa até 3 itens e eles sobem para o topo do menu', async () => {
    app = await bootApp({ userId: 'u1' });
    expect(q('[data-role="pinned"]')).toBeNull();
    const pins = all<HTMLButtonElement>('.nav-pin');
    expect(pins.length).toBe(17);
    [0, 1, 2].forEach((i) => click(all<HTMLButtonElement>('.nav-pin')[i + 1] ?? null));
    await settle(app.fixture);
    expect(all('[data-role="pinned"] .nav-item')).toHaveLength(3);
    // O quarto é recusado com um aviso.
    click(all<HTMLButtonElement>('.nav-pin')[8] ?? null);
    await settle(app.fixture);
    expect(all('[data-role="pinned"] .nav-item')).toHaveLength(3);
    expect(q('.toast')?.textContent).toContain('Você já fixou 3 itens');
    // O atendimento (13 itens) também fixa; o psicólogo (8 itens) não.
    TestBed.resetTestingModule();
    app = await bootApp({ userId: 'u3' });
    expect(all('.nav-pin')).toHaveLength(0);
  });

  it('contador do menu só onde há ação, com texto para leitor de tela', async () => {
    app = await bootApp({ userId: 'u2', url: '/app/painel' });
    const link = q('.sidebar a[href="/app/acompanhamento"]');
    expect(link?.querySelector('.nav-item__badge')?.textContent?.trim()).toBe('2');
    expect(link?.getAttribute('aria-label')).toBe('Acompanhamento, 2 contatos pendentes hoje');
    expect(q('.sidebar a[href="/app/mensagens"] .nav-item__badge')).toBeNull();
  });

  it('chip do relógio simulado: aparece só com a simulação ativa e leva ao relógio (sócia)', async () => {
    app = await bootApp({ userId: 'u1' });
    app.clock.resetToReal();
    await settle(app.fixture);
    expect(q('.topbar__chip')).toBeNull();
    app.clock.setSimulated('2026-11-12');
    await settle(app.fixture);
    const chip = q('.topbar__chip');
    expect(chip?.textContent).toContain('Hoje (simulado): 12/11/2026');
    expect(chip?.getAttribute('href')).toBe('/app/configuracoes/relogio');
    TestBed.resetTestingModule();
    app = await bootApp({ userId: 'u2' });
    app.clock.setSimulated('2026-11-12');
    await settle(app.fixture);
    expect(q('.topbar__chip')?.getAttribute('href')).toBeNull();
    expect(q('.topbar__chip')?.textContent).toContain('12/11/2026');
  });

  it('gaveta do menu (celular e tablet): abre, prende o foco, fecha com Esc e devolve o foco ao botão', async () => {
    app = await bootApp({ userId: 'u1' });
    TestBed.inject(ViewportService).set('drawer');
    const button = q<HTMLButtonElement>('.topbar__menu') as HTMLButtonElement;
    click(button);
    await settle(app.fixture);
    expect(q('.app-shell')?.getAttribute('data-nav-open')).toBe('true');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(q('main')?.hasAttribute('inert')).toBe(true);
    expect(q('.topbar')?.hasAttribute('inert')).toBe(true);
    expect(document.activeElement?.classList.contains('nav-item')).toBe(true);

    q('.app-shell')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle(app.fixture);
    expect(q('.app-shell')?.getAttribute('data-nav-open')).toBe('false');
    expect(q('main')?.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(button);

    // Tocar fora (o fundo) também fecha; escolher um item fecha e navega.
    click(button);
    await settle(app.fixture);
    click(q('.scrim'));
    await settle(app.fixture);
    expect(q('.app-shell')?.getAttribute('data-nav-open')).toBe('false');
    click(button);
    await settle(app.fixture);
    click(q('.sidebar a[href="/app/cuidadores"]'));
    await settle(app.fixture);
    expect(app.router.url).toBe('/app/cuidadores');
    expect(q('.app-shell')?.getAttribute('data-nav-open')).toBe('false');
  });

  it('trilho de 1024 a 1279 px: o botão do menu expande o menu completo sobre o conteúdo', async () => {
    app = await bootApp({ userId: 'u1' });
    TestBed.inject(ViewportService).set('rail');
    await settle(app.fixture);
    expect(q('.app-shell')?.hasAttribute('data-nav')).toBe(false);
    click(q('.topbar__menu'));
    await settle(app.fixture);
    expect(q('.app-shell')?.getAttribute('data-nav')).toBe('expanded');
    expect(q('.topbar__menu')?.getAttribute('aria-expanded')).toBe('true');
    click(q('.scrim'));
    await settle(app.fixture);
    expect(q('.app-shell')?.hasAttribute('data-nav')).toBe(false);
  });

  it('menu do usuário: preferências, tema escuro gravado pelo repositório, trocar perfil e sair registram o logout', async () => {
    app = await bootApp({ userId: 'u7' });
    const trigger = q<HTMLButtonElement>('app-user-menu button.user-trigger') as HTMLButtonElement;
    expect(trigger.getAttribute('aria-label')).toContain('Camila Duarte');
    expect(trigger.textContent).toContain('Atendimento/Relacionamento');
    click(trigger);
    await settle(app.fixture);
    const menu = q('[role="menu"]');
    expect(menu).not.toBeNull();
    expect(menu?.textContent).toContain('Sessão encerra por inatividade em 30 min');
    const labels = all('[role="menu"] [role^="menuitem"]').map((i) =>
      i.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(labels.some((l) => l?.startsWith('Tema escuro'))).toBe(true);
    expect(labels.some((l) => l?.startsWith('Modo discreto'))).toBe(true);
    expect(labels.some((l) => l?.startsWith('Atalhos de teclado'))).toBe(true);
    expect(labels.some((l) => l?.startsWith('Privacidade e canal do titular'))).toBe(true);
    expect(labels.some((l) => l?.startsWith('Meus dados no navegador'))).toBe(true);
    expect(labels.some((l) => l?.startsWith('Trocar perfil'))).toBe(true);
    expect(labels.some((l) => l?.startsWith('Sair'))).toBe(true);

    // Tema escuro: atributo no <html> e preferência gravada.
    click(all('[role="menu"] [role="menuitemcheckbox"]')[0] ?? null);
    await settle(app.fixture);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(app.local.getItem('nexus-erp:ui-prefs')).toContain('"theme":"dark"');
    click(all('[role="menu"] [role="menuitemcheckbox"]')[0] ?? null);
    await settle(app.fixture);
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);

    // Esc fecha e devolve o foco ao avatar.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle(app.fixture);
    expect(q('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    // Trocar perfil: encerra a sessão, grava o logout e volta à entrada.
    const before = app.db.accessLog.size();
    click(trigger);
    await settle(app.fixture);
    click(q('[data-role="switch-profile"]'));
    await settle(app.fixture);
    expect(app.auth.isAuthenticated()).toBe(false);
    expect(app.router.url).toBe('/login');
    expect(
      app.db.accessLog
        .list()
        .slice(before)
        .some((e) => e.action === 'logout' && e.userId === 'u7'),
    ).toBe(true);
  });

  it('modo discreto: borra o dado marcado e um clique revela', async () => {
    app = await bootApp({ userId: 'u7' });
    const prefs = TestBed.inject(UiPrefsService);
    prefs.setDiscreet(true);
    await settle(app.fixture);
    expect(document.documentElement.getAttribute('data-discreet')).toBe('true');
    const main = q('main') as HTMLElement;
    const field = document.createElement('span');
    field.className = 'discreet';
    field.textContent = 'Ana Paula Ferraz';
    main.appendChild(field);
    field.click();
    expect(field.hasAttribute('data-revealed')).toBe(true);
    field.click();
    expect(field.hasAttribute('data-revealed')).toBe(false);
  });

  it('a primeira página do ERP não usa nenhum link do portal e o credenciado não vê o shell da equipe', async () => {
    app = await bootApp({ userId: 'u9' });
    expect(q('.sidebar')).toBeNull();
    expect(q('.portal-shell')).not.toBeNull();
    expect(q('.bottom-nav')).not.toBeNull();
    void signIn;
  });
});

describe('sino de notificações', () => {
  let app: BootedApp;
  const q = <T extends Element = HTMLElement>(selector: string): T | null =>
    app.root.querySelector<T>(selector);
  const all = <T extends Element = HTMLElement>(selector: string): T[] =>
    Array.from(app.root.querySelectorAll<T>(selector));

  it('mostra o número de pendências com texto para leitor de tela, abre o painel e marca como vista', async () => {
    app = await bootApp({ userId: 'u2' });
    const notifications = TestBed.inject(NotificationService);
    const bell = q<HTMLButtonElement>('app-notification-bell button') as HTMLButtonElement;
    const unread = notifications.unreadCount();
    expect(unread).toBeGreaterThan(2);
    expect(bell.getAttribute('aria-label')).toBe(`Notificações: ${unread} não vistas`);
    expect(bell.querySelector('.topbar__badge')?.textContent?.trim()).toBe(String(unread));

    click(bell);
    await settle(app.fixture);
    const panel = q('.popover--panel');
    expect(panel?.getAttribute('role')).toBe('dialog');
    expect(document.activeElement?.id).toBe('nx-notification-title');
    expect(panel?.textContent).toContain('Precisa de ação hoje');
    expect(panel?.textContent).toContain('Para acompanhar');
    // O título descreve a tarefa; o contexto traz nome e prazo.
    expect(panel?.textContent).toContain('Contato do mesmo dia pendente');
    expect(panel?.textContent).toContain('Ana Paula Ferraz, prazo 23:59');
    expect(panel?.textContent).not.toMatch(/zarit|escore|pontua|faixa/i);

    const firstMark = panel?.querySelector<HTMLButtonElement>(
      'button[aria-label^="Marcar como vista"]',
    );
    click(firstMark ?? null);
    await settle(app.fixture);
    expect(notifications.unreadCount()).toBe(unread - 1);
    expect(q('.popover--panel')?.textContent).toContain('Vistas (1)');

    // Esc fecha o painel e devolve o foco ao sino.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle(app.fixture);
    expect(q('.popover--panel')).toBeNull();
    expect(document.activeElement).toBe(bell);
  });

  it('clicar numa pendência abre a tela com o filtro aplicado e marca como vista', async () => {
    app = await bootApp({ userId: 'u2' });
    const notifications = TestBed.inject(NotificationService);
    const unread = notifications.unreadCount();
    click(q('app-notification-bell button'));
    await settle(app.fixture);
    const first = q<HTMLButtonElement>('.popover--panel .list-row__main');
    click(first);
    await settle(app.fixture);
    expect(app.router.url).toContain('/app/acompanhamento');
    expect(app.router.url).toContain('filtro=');
    expect(notifications.unreadCount()).toBe(unread - 1);
    expect(q('.popover--panel')).toBeNull();
    void all;
  });

  it('"Marcar todas como vistas" zera o contador e a lista mostra o grupo Vistas', async () => {
    app = await bootApp({ userId: 'u7' });
    const notifications = TestBed.inject(NotificationService);
    click(q('app-notification-bell button'));
    await settle(app.fixture);
    click(q('.popover__header .btn'));
    await settle(app.fixture);
    expect(notifications.unreadCount()).toBe(0);
    expect(q('.popover--panel details summary')?.textContent).toContain('Vistas');
    expect(q('app-notification-bell button')?.getAttribute('aria-label')).toBe(
      'Notificações: nenhuma não vista',
    );
  });
});

describe('shell do portal do profissional', () => {
  let app: BootedApp;
  const q = <T extends Element = HTMLElement>(selector: string): T | null =>
    app.root.querySelector<T>(selector);
  const all = <T extends Element = HTMLElement>(selector: string): T[] =>
    Array.from(app.root.querySelectorAll<T>(selector));

  it('barra inferior com 5 destinos, aviso de protótipo no rodapé e foco no conteúdo', async () => {
    app = await bootApp({ userId: 'u9', url: '/portal' });
    const items = all('.bottom-nav .bottom-nav__item');
    expect(items.map((i) => i.textContent?.trim())).toEqual([
      'Início',
      'Solicitações',
      'Disponibilidade',
      'Mensagens',
      'Mais',
    ]);
    expect(all('.bottom-nav a[aria-current="page"]')).toHaveLength(1);
    expect(q('.app-footer')?.textContent).toContain(PROTOTYPE_NOTICE);
    expect(q('.portal-header .avatar') ?? q('app-user-menu .avatar--gold')).not.toBeNull();
    expect(q('.portal-main h1')).not.toBeNull();
  });

  it('"Mais" abre a folha com os destinos do portal e o Sair; prestador suspenso vê Avaliação interna', async () => {
    app = await bootApp({ userId: 'u9', url: '/portal' });
    click(q('.bottom-nav button.bottom-nav__item'));
    await settle(app.fixture);
    const sheet = q('dialog.dialog--sheet') as HTMLDialogElement;
    expect(sheet.hasAttribute('open')).toBe(true);
    const rows = Array.from(sheet.querySelectorAll('.list-row')).map((r) => r.textContent?.trim());
    expect(rows).toEqual([
      'Minha avaliação',
      'Documentos',
      'Integração',
      'Meu perfil',
      'Privacidade',
      'Sair',
    ]);
    sheet.dispatchEvent(new Event('cancel', { cancelable: true }));
    await settle(app.fixture);
    expect(sheet.hasAttribute('open')).toBe(false);

    TestBed.resetTestingModule();
    app = await bootApp({ userId: 'u11', url: '/portal' });
    click(q('.bottom-nav button.bottom-nav__item'));
    await settle(app.fixture);
    expect(q('dialog.dialog--sheet')?.textContent).toContain('Avaliação interna');
  });

  it('o credenciado não abre o ERP: /app/financeiro vai ao 403 e grava denied', async () => {
    app = await bootApp({ userId: 'u9', url: '/portal' });
    const before = app.db.accessLog.size();
    await app.router.navigateByUrl('/app/financeiro');
    await settle(app.fixture);
    expect(app.router.url).toBe('/403');
    expect(
      app.db.accessLog
        .list()
        .slice(before)
        .some((e) => e.action === 'denied'),
    ).toBe(true);
    expect(q('h1')?.textContent).toContain('Você não tem acesso a esta página');
    expect(q('.sidebar')).toBeNull();
  });
});
