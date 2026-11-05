import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { PROTOTYPE_NOTICE } from '../../../core/privacy/browser-data.service';
import { ContactDialogService } from '../state/contact-dialog.service';
import { BootedCaregiverApp, bootCaregiverApp, settleCaregiver } from '../testing';
import { TWO_FACTOR_CODE } from '../../../core/auth/auth.service';

const click = (el: Element | null | undefined): void => {
  if (!el) {
    throw new Error('elemento não encontrado');
  }
  (el as HTMLElement).click();
};
const text = (el: Element | null | undefined): string =>
  (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('Shell do aplicativo do cuidador (UX A.2 e A.3)', () => {
  let app: BootedCaregiverApp;
  const q = <T extends Element = HTMLElement>(selector: string): T | null =>
    app.root.querySelector<T>(selector);
  const all = <T extends Element = HTMLElement>(selector: string): T[] =>
    Array.from(app.root.querySelectorAll<T>(selector));
  const flush = (): Promise<void> => settleCaregiver(app.fixture);

  afterEach(() => TestBed.resetTestingModule());

  it('monta a casca: link para o conteúdo, cabeçalho com Ajuda agora, conteúdo e aviso de protótipo literal no fim', async () => {
    app = await bootCaregiverApp('cg_0001');
    const shell = q('app-caregiver-shell');
    expect(shell?.classList.contains('cg-app')).toBe(true);
    expect(shell?.getAttribute('data-text')).toBe('normal');
    expect(q('a.skip-link')?.getAttribute('href')).toBe('#conteudo');
    expect(q('header .cg-header__brand')?.getAttribute('aria-label')).toContain('Nexus');
    const help = q('a.cg-help-now');
    expect(help?.getAttribute('href')).toBe('/cuidador/ajuda-agora');
    expect(text(help)).toBe('Ajuda agora');
    expect(q('main#conteudo')).not.toBeNull();
    expect(q('main#conteudo')?.getAttribute('tabindex')).toBe('-1');
    expect(all('main h1')).toHaveLength(1);
    expect(text(q('.cg-proto-note'))).toContain(PROTOTYPE_NOTICE);
    expect(q('.cg-proto-note a')?.getAttribute('href')).toBe('/cuidador/mais/privacidade');
    // O foco vai ao h1 da tela nova (o mesmo comportamento da equipe).
    expect(document.activeElement?.tagName).toBe('H1');
  });

  it('o título da aba vem de data.title de cada rota', async () => {
    app = await bootCaregiverApp('cg_0001', { url: '/cuidador/rotina/remedios' });
    expect(document.title).toBe('Remédios · Nexus ERP');
    await app.router.navigateByUrl('/cuidador/mais');
    await flush();
    expect(document.title).toBe('Mais · Nexus ERP');
  });

  it('AC-CG-04: tela larga leva a navegação de 5 itens ao cabeçalho e não existe a barra inferior', async () => {
    app = await bootCaregiverApp('cg_0001', { url: '/cuidador/rotina/agenda', layout: 'full' });
    expect(all('.cg-nav--bottom')).toHaveLength(0);
    const nav = q('header .cg-nav--top');
    expect(nav?.querySelector('nav')?.getAttribute('aria-label')).toBe('Navegação principal');
    expect(all('header .cg-nav__label').map(text)).toEqual([
      'Hoje',
      'Rotina',
      'Cuidar de mim',
      'Rede',
      'Mais',
    ]);
    // A seção atual (também nas subtelas) leva aria-current="page".
    const current = all('header .cg-nav__link[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(text(current[0])).toBe('Rotina');
  });

  it('AC-CG-04: celular leva a barra inferior de 5 itens na ordem e o item atual em destaque', async () => {
    app = await bootCaregiverApp('cg_0001', { url: '/cuidador/rede/pedidos', layout: 'drawer' });
    expect(all('header .cg-nav--top')).toHaveLength(0);
    expect(all('.cg-nav--bottom .cg-nav__link')).toHaveLength(5);
    expect(all('.cg-nav--bottom .cg-nav__label').map(text)).toEqual([
      'Hoje',
      'Rotina',
      'Cuidar de mim',
      'Rede',
      'Mais',
    ]);
    expect(
      all('.cg-nav--bottom .cg-nav__link').map((a) => a.getAttribute('href')),
    ).toEqual([
      '/cuidador/hoje',
      '/cuidador/rotina',
      '/cuidador/cuidar-de-mim',
      '/cuidador/rede',
      '/cuidador/mais',
    ]);
    const current = all('.cg-nav--bottom .cg-nav__link.is-current');
    expect(current.map(text)).toEqual(['Rede']);
    expect(current[0]?.getAttribute('aria-current')).toBe('page');
    // Sem contador nem ponto de notificação.
    expect(all('.cg-nav__link .badge, .cg-nav__link [class*="count"]')).toHaveLength(0);
  });

  it('o tamanho da letra vale na hora, fica guardado no navegador e volta depois de recarregar', async () => {
    app = await bootCaregiverApp('cg_0001', { url: '/cuidador/mais' });
    const options = all<HTMLInputElement>('.cg-text-size__input');
    expect(options.map((o) => o.getAttribute('aria-label'))).toEqual([
      'Letra normal',
      'Letra grande',
      'Letra bem grande',
    ]);
    expect(options[0]?.checked).toBe(true);
    options[2]?.click();
    await flush();
    expect(q('app-caregiver-shell')?.getAttribute('data-text')).toBe('xlarge');
    expect(JSON.parse(app.local.getItem('nexus-erp:caregiver-font-scale') ?? '""')).toBe('xlarge');
    options[1]?.click();
    await flush();
    expect(q('app-caregiver-shell')?.getAttribute('data-text')).toBe('large');
    // Recarregar: o mesmo armazenamento, outra instância do app.
    const local = app.local;
    TestBed.resetTestingModule();
    app = await bootCaregiverApp('cg_0001', { url: '/cuidador/mais', local });
    expect(q('app-caregiver-shell')?.getAttribute('data-text')).toBe('large');
    expect(all<HTMLInputElement>('.cg-text-size__input')[1]?.checked).toBe(true);
  });

  it('S-01: só o tema claro. O shell força data-theme=light e marca data-app, e devolve tudo ao sair', async () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    app = await bootCaregiverApp('cg_0001');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.getAttribute('data-app')).toBe('caregiver');
    TestBed.resetTestingModule();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.hasAttribute('data-app')).toBe(false);
    document.documentElement.removeAttribute('data-theme');
  });

  it('o menu do usuário mostra o nome, o plano, Meu perfil, Privacidade e Sair; Sair leva à entrada e apaga a sessão', async () => {
    app = await bootCaregiverApp('cg_0001');
    const trigger = q<HTMLButtonElement>('.cg-user-menu__trigger');
    expect(trigger?.getAttribute('aria-label')).toBe('Menu de Ana Paula Ferraz');
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');
    click(trigger);
    await flush();
    expect(trigger?.getAttribute('aria-expanded')).toBe('true');
    expect(text(q('.cg-user-menu__who'))).toContain('Ana Paula Ferraz');
    expect(text(q('.cg-user-menu__who'))).toContain('Plano Cuida');
    expect(all('.cg-user-menu__item').map(text)).toEqual([
      'Meu perfil',
      'Privacidade e meus dados',
      'Sair',
    ]);
    click(q('[data-role="sign-out"]'));
    await flush();
    expect(app.router.url).toBe('/login');
    expect(app.session.isSignedIn()).toBe(false);
    expect(app.sessionBackend.getItem('nexus-erp:caregiver-session')).toBeNull();
    // Voltar ao aplicativo sem sessão leva de novo à entrada.
    await app.router.navigateByUrl('/cuidador/hoje');
    await flush();
    expect(app.router.url).toBe('/login');
  });

  it('Esc fecha o menu do usuário', async () => {
    app = await bootCaregiverApp('cg_0001');
    click(q('.cg-user-menu__trigger'));
    await flush();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flush();
    expect(q('.cg-user-menu__panel')).toBeNull();
  });
});

describe('Rotas e guards do aplicativo do cuidador (AC-CG-22, AC-CG-23)', () => {
  let app: BootedCaregiverApp;
  const q = <T extends Element = HTMLElement>(selector: string): T | null =>
    app.root.querySelector<T>(selector);
  const flush = (): Promise<void> => settleCaregiver(app.fixture);

  afterEach(() => TestBed.resetTestingModule());

  it('/cuidador leva a /cuidador/hoje', async () => {
    app = await bootCaregiverApp('cg_0001', { url: '/cuidador' });
    expect(app.router.url).toBe('/cuidador/hoje');
  });

  it('a raiz leva o cuidador a Hoje, a equipe ao painel e quem não entrou à entrada', async () => {
    app = await bootCaregiverApp('cg_0003', { url: '/' });
    expect(app.router.url).toBe('/cuidador/hoje');
    TestBed.resetTestingModule();
    app = await bootCaregiverApp(null, { url: '/' });
    expect(app.router.url).toBe('/login');
    app.auth.selectProfile('u1');
    app.auth.verifyTwoFactor(TWO_FACTOR_CODE);
    await app.router.navigateByUrl('/');
    await flush();
    expect(app.router.url).toBe('/app/painel');
  });

  it('sem sessão: a rota do cuidador leva à entrada; Começar e Ajuda agora abrem sem sessão', async () => {
    app = await bootCaregiverApp(null, { url: '/cuidador/mais/plano' });
    expect(app.router.url).toBe('/login');
    await app.router.navigateByUrl('/cuidador/comecar');
    await flush();
    expect(app.router.url).toBe('/cuidador/comecar');
    // Sem sessão: sem barra de navegação nem menu do usuário, mas com a Ajuda agora e o "Entrar".
    expect(q('.cg-nav')).toBeNull();
    expect(q('.cg-user-menu__trigger')).toBeNull();
    expect(q('a.cg-help-now')?.getAttribute('href')).toBe('/cuidador/ajuda-agora');
    expect(q('.cg-header__login')?.getAttribute('href')).toBe('/login');
    await app.router.navigateByUrl('/cuidador/ajuda-agora');
    await flush();
    expect(app.router.url).toBe('/cuidador/ajuda-agora');
  });

  it('a sessão da equipe nunca abre /cuidador/**: volta ao painel', async () => {
    app = await bootCaregiverApp(null, { url: '/login' });
    app.auth.selectProfile('u7');
    app.auth.verifyTwoFactor(TWO_FACTOR_CODE);
    for (const url of ['/cuidador/hoje', '/cuidador/comecar', '/cuidador/ajuda-agora']) {
      await app.router.navigateByUrl(url);
      await flush();
      expect(app.router.url, url).toBe('/app/painel');
    }
  });

  it('a sessão do cuidador nunca abre /app/**: volta a Hoje, sem guardar a rota e sem entrar no log', async () => {
    app = await bootCaregiverApp('cg_0001');
    const before = app.db.accessLog.size();
    for (const url of ['/app/painel', '/app/financeiro', '/403']) {
      await app.router.navigateByUrl(url);
      await flush();
      expect(app.router.url, url).toBe('/cuidador/hoje');
    }
    expect(app.db.accessLog.size()).toBe(before);
    expect(app.auth.consumeReturnUrl()).toBeNull();
  });

  it('endereço que não existe dentro do aplicativo mostra a página não encontrada na mesma casca', async () => {
    app = await bootCaregiverApp('cg_0001', { url: '/cuidador/nao-existe/nada' });
    expect(q('app-caregiver-shell')).not.toBeNull();
    expect(text(q('main h1'))).toBe('Página não encontrada');
    expect(q('[data-role="home"]')?.getAttribute('href')).toBe('/cuidador/hoje');
    await app.router.navigateByUrl('/cuidador/cuidar-de-mim/xyz');
    await flush();
    expect(text(q('main h1'))).toBe('Página não encontrada');
  });

  it('cuidador com cadastro encerrado depois de entrar volta à entrada na próxima tela', async () => {
    app = await bootCaregiverApp('cg_0004', { url: '/cuidador/hoje' });
    app.db.caregivers.update('cg_0004', { status: 'closed' });
    await app.router.navigateByUrl('/cuidador/rotina');
    await flush();
    expect(app.router.url).toBe('/login');
  });
});

describe('Mais, a porta da Base (UX C17)', () => {
  let app: BootedCaregiverApp;
  const q = <T extends Element = HTMLElement>(selector: string): T | null =>
    app.root.querySelector<T>(selector);
  const all = <T extends Element = HTMLElement>(selector: string): T[] =>
    Array.from(app.root.querySelectorAll<T>(selector));
  const rows = (): string[] => all('.cg-list .cg-row').map(text);

  afterEach(() => TestBed.resetTestingModule());

  it('AC-CG-145: h1, nome com a etiqueta do plano, 5 itens na ordem, letra e Sair', async () => {
    app = await bootCaregiverApp('cg_0001', { url: '/cuidador/mais' });
    expect(text(q('main h1'))).toBe('Mais');
    expect(text(q('.cg-who'))).toContain('Ana Paula Ferraz');
    expect(text(q('.cg-who app-cg-plan-tag'))).toBe('Plano Cuida');
    expect(all('.cg-list .cg-row__title').map(text)).toEqual([
      'Meu plano',
      'Falar com a Nexus',
      'Família',
      'Privacidade e meus dados',
      'Meu perfil',
    ]);
    expect(all('.cg-list .cg-row').map((a) => a.getAttribute('href'))).toEqual([
      '/cuidador/mais/plano',
      '/cuidador/mais/ajuda',
      '/cuidador/mais/familia',
      '/cuidador/mais/privacidade',
      '/cuidador/mais/perfil',
    ]);
    expect(rows()[0]).toContain('Cuida · R$ 119,90 por mês');
    expect(text(q('#cg-more-text'))).toBe('Tamanho da letra');
    expect(text(q('[data-role="sign-out"]'))).toBe('Sair');
  });

  it('AC-CG-148: nunca há contador, ponto de notificação nem selo de novidade', async () => {
    app = await bootCaregiverApp('cg_0001', { url: '/cuidador/mais' });
    expect(all('.cg-list .badge, .cg-list [class*="count"], .cg-list [class*="dot"]')).toHaveLength(0);
  });

  it('o plano vira "sem custo" no Livre e "Muda para o Livre em 13/11" com a mudança agendada (Marcos)', async () => {
    app = await bootCaregiverApp('cg_0003', { url: '/cuidador/mais' });
    expect(rows()[0]).toContain('Livre · sem custo');
    TestBed.resetTestingModule();
    app = await bootCaregiverApp('cg_0026', { url: '/cuidador/mais' });
    expect(rows()[0]).toContain('Muda para o Livre em 13/11');
  });

  it('pedido de dados em andamento muda o apoio de Privacidade (Raimunda)', async () => {
    app = await bootCaregiverApp('cg_0018', { url: '/cuidador/mais' });
    expect(rows()[3]).toContain('Há um pedido em andamento');
    TestBed.resetTestingModule();
    app = await bootCaregiverApp('cg_0001', { url: '/cuidador/mais' });
    expect(rows()[3]).toContain('Suas autorizações, cópia e eliminação dos dados');
  });

  it('"Como falar com a gente" abre o diálogo', async () => {
    app = await bootCaregiverApp('cg_0001', { url: '/cuidador/mais' });
    click(q('[data-role="contact"]'));
    await settleCaregiver(app.fixture);
    expect(TestBed.inject(ContactDialogService).isOpen()).toBe(true);
    expect(q('dialog.cg-sheet')?.hasAttribute('open')).toBe(true);
  });
});
