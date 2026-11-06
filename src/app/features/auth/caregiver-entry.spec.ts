import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PROTOTYPE_NOTICE } from '../../core/privacy/browser-data.service';
import { DEMO_CAREGIVERS } from '../caregiver-app/state/demo-caregivers';
import { BootedCaregiverApp, bootCaregiverApp, settleCaregiver } from '../caregiver-app/testing';
import { destinationAfterCaregiverLogin } from './return-url';

const click = (el: Element | null | undefined): void => {
  if (!el) {
    throw new Error('elemento não encontrado');
  }
  (el as HTMLElement).click();
};
const text = (el: Element | null | undefined): string =>
  (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('destinationAfterCaregiverLogin', () => {
  it('volta ao link de origem se era do aplicativo do cuidador; senão vai a Hoje', () => {
    expect(destinationAfterCaregiverLogin('/cuidador/rotina/agenda')).toBe('/cuidador/rotina/agenda');
    expect(destinationAfterCaregiverLogin('/cuidador/rede/profissional/prv_01?x=1')).toBe(
      '/cuidador/rede/profissional/prv_01?x=1',
    );
    expect(destinationAfterCaregiverLogin(null)).toBe('/cuidador/hoje');
    expect(destinationAfterCaregiverLogin('/app/painel')).toBe('/cuidador/hoje');
    expect(destinationAfterCaregiverLogin('/login')).toBe('/cuidador/hoje');
    expect(destinationAfterCaregiverLogin('/cuidador/comecar')).toBe('/cuidador/hoje');
    expect(destinationAfterCaregiverLogin('https://exemplo.com/cuidador/hoje')).toBe(
      '/cuidador/hoje',
    );
    expect(destinationAfterCaregiverLogin('//cuidador.exemplo.com')).toBe('/cuidador/hoje');
  });
});

describe('entrada: porta do cuidador (UX C1, AC-CG-17 a 23)', () => {
  let app: BootedCaregiverApp;
  const q = <T extends Element = HTMLElement>(selector: string): T | null =>
    app.root.querySelector<T>(selector);
  const all = <T extends Element = HTMLElement>(selector: string): T[] =>
    Array.from(app.root.querySelectorAll<T>(selector));
  const people = (): HTMLElement[] => all('.cg-door__person');
  const person = (name: string): HTMLElement | undefined =>
    people().find((p) => p.textContent?.includes(name));

  afterEach(() => TestBed.resetTestingModule());

  it('AC-CG-17: o cuidador vem primeiro e aberto, com 6 cartões; a equipe vem depois e recolhida', async () => {
    app = await bootCaregiverApp(null, { url: '/login' });
    expect(text(q('h1'))).toBe('Entrar');
    const doors = all('main > section.cg-door');
    expect(doors).toHaveLength(2);
    expect(text(doors[0]?.querySelector('h2'))).toBe('Sou cuidador(a)');
    expect(text(doors[1]?.querySelector('h2 .cg-accordion__title'))).toBe('Sou da equipe Nexus');
    expect(people()).toHaveLength(6);
    expect(people().map((p) => text(p.querySelector('.cg-door__name')))).toEqual([
      expect.stringContaining('Ana Paula Ferraz'),
      expect.stringContaining('Maria Aparecida Lemos'),
      expect.stringContaining('João Batista Carneiro'),
      expect.stringContaining('Rita de Cássia Moura'),
      expect.stringContaining('Elza Guimarães'),
      expect.stringContaining('Lourdes Campos'),
    ]);
    // A equipe: recolhida, e abre com o segundo fator de sempre.
    expect(all('.profile-group')).toHaveLength(0);
    click(q('[data-role="staff-toggle"]'));
    await settleCaregiver(app.fixture);
    expect(all('.profile-group .list-row')).toHaveLength(8);
    expect(q('.banner--prototype')?.textContent).toContain(PROTOTYPE_NOTICE);
  });

  it('o cartão mostra nome e idade, o plano e uma frase; a frase é neutra (AC-CG-21, S-10)', async () => {
    app = await bootCaregiverApp(null, { url: '/login' });
    const ana = person('Ana Paula Ferraz');
    expect(text(ana?.querySelector('.cg-door__name'))).toBe('Ana Paula Ferraz, 45 anos');
    expect(text(ana?.querySelector('app-plan-badge'))).toContain('Cuida');
    expect(text(ana?.querySelector('.cg-door__blurb'))).toBe(
      'Cuida da mãe e organiza consultas e remédios.',
    );
    expect(ana?.getAttribute('aria-label')).toContain('Entrar como Ana Paula Ferraz, 45 anos, plano Cuida');
    DEMO_CAREGIVERS.forEach((demo) => {
      expect(demo.blurb, demo.id).not.toMatch(/\d|zarit|alerta|risco|sobrecarga|pontua|diagn|doen|sa[úu]de/i);
    });
  });

  it('AC-CG-19: "Ver mais exemplos" mostra mais 5 cartões (11 no total), troca o texto do botão e leva o foco ao primeiro novo', async () => {
    app = await bootCaregiverApp(null, { url: '/login' });
    const more = q('[data-role="more-examples"]');
    expect(text(more)).toBe('Ver mais exemplos');
    click(more);
    await settleCaregiver(app.fixture);
    expect(people()).toHaveLength(11);
    expect(text(q('[data-role="more-examples"]'))).toBe('Ver menos exemplos');
    expect(q('[data-role="more-examples"]')?.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement?.getAttribute('data-caregiver')).toBe('cg_0012');
    // Raimunda, com pedido de exclusão aberto, é a 11ª e aparece.
    expect(person('Raimunda Siqueira')).toBeDefined();
    click(q('[data-role="more-examples"]'));
    await settleCaregiver(app.fixture);
    expect(people()).toHaveLength(6);
  });

  it('AC-CG-18: tocar no cartão abre a sessão do cuidador no armazenamento de sessão e vai a Hoje, sem senha e sem código', async () => {
    app = await bootCaregiverApp(null, { url: '/login' });
    click(person('Ana Paula Ferraz'));
    await settleCaregiver(app.fixture);
    expect(app.router.url).toBe('/cuidador/hoje');
    expect(app.session.isSignedIn()).toBe(true);
    const stored = app.sessionBackend.getItem('nexus-erp:caregiver-session');
    expect(JSON.parse(stored ?? '{}')).toMatchObject({ caregiverId: 'cg_0001' });
    expect(app.auth.isAuthenticated()).toBe(false);
    expect(app.auth.isPendingTwoFactor()).toBe(false);
    // O h1 de Hoje é a saudação pela hora (UX C4): "Bom dia, Ana", "Boa tarde, Ana" ou "Boa noite, Ana".
    expect(text(q('h1'))).toMatch(/^(Bom dia|Boa tarde|Boa noite), Ana$/);
  });

  it('volta à rota de origem depois de entrar (na mesma aba)', async () => {
    app = await bootCaregiverApp(null, { url: '/cuidador/rotina/remedios' });
    expect(app.router.url).toBe('/login');
    click(person('João Batista Carneiro'));
    await settleCaregiver(app.fixture);
    expect(app.router.url).toBe('/cuidador/rotina/remedios');
  });

  it('AC-CG-20: cadastro encerrado, anonimizado ou eliminado não aparece; pedido de exclusão aberto aparece', async () => {
    app = await bootCaregiverApp(null, { url: '/login' });
    app.db.caregivers.update('cg_0012', { status: 'closed' });
    app.db.caregivers.update('cg_0026', { anonymizedAt: '2026-11-01T10:00:00-03:00' });
    app.db.caregivers.update('cg_0016', { erasedAt: '2026-11-01T10:00:00-03:00', status: 'closed' });
    // Os fechados saem de "Ver mais exemplos" (e o sistema não deixa entrar de forma alguma).
    click(q('[data-role="more-examples"]'));
    await settleCaregiver(app.fixture);
    const names = people().map((p) => text(p.querySelector('.cg-door__name')));
    expect(names).toHaveLength(8);
    ['Terezinha Alves', 'Marcos Vinícius Leal', 'Sônia Maria Dutra'].forEach((name) =>
      expect(names.join(' | ')).not.toContain(name),
    );
    expect(names.join(' | ')).toContain('Raimunda Siqueira');
    expect(app.session.signIn('cg_0012').status).toBe('denied');
    expect(app.session.signIn('cg_0026').status).toBe('denied');
    expect(app.session.signIn('cg_0016').status).toBe('denied');
    expect(app.session.signIn('cg_0018').status).toBe('ok');
  });

  it('AC-CG-23: "Criar minha conta" e "Ajuda agora" abrem sem sessão', async () => {
    app = await bootCaregiverApp(null, { url: '/login' });
    expect(q('[data-role="create-account"]')?.getAttribute('href')).toBe('/cuidador/comecar');
    expect(q('[data-role="help-now"]')?.getAttribute('href')).toBe('/cuidador/ajuda-agora');
    expect(text(q('.cg-door__emergency'))).toContain('Em emergência, ligue 192 (SAMU).');
    await app.router.navigateByUrl('/cuidador/ajuda-agora');
    await settleCaregiver(app.fixture);
    expect(app.router.url).toBe('/cuidador/ajuda-agora');
  });

  it('E1: "Ajuda agora" fica na linha do título "Entrar", na coluna do formulário (não na faixa de marca), com o desenho do botão do aplicativo', async () => {
    app = await bootCaregiverApp(null, { url: '/login' });
    const help = q<HTMLAnchorElement>('[data-role="help-now"]');
    expect(text(help)).toBe('Ajuda agora');
    expect(help?.getAttribute('href')).toBe('/cuidador/ajuda-agora');
    // Mesma linha do h1, dentro do painel do formulário; fora da faixa de marca azul.
    const head = q('.login__head');
    expect(head?.contains(help ?? null)).toBe(true);
    expect(head?.querySelector('h1')).not.toBeNull();
    expect(q('.login__panel')?.contains(head ?? null)).toBe(true);
    expect(q('.login__brand')?.querySelector('[data-role="help-now"]')).toBeNull();
    expect(all('[data-role="help-now"]')).toHaveLength(1);
    // A um toque e sem entrar: o destino abre sem sessão.
    await app.router.navigateByUrl('/cuidador/ajuda-agora');
    await settleCaregiver(app.fixture);
    expect(app.router.url).toBe('/cuidador/ajuda-agora');
    expect(app.session.isSignedIn()).toBe(false);
  });

  it('E2: "Sou da equipe Nexus" é um acordeão: um botão no título com ícone, frase curta e seta, aria-expanded, abre e fecha por toque', async () => {
    app = await bootCaregiverApp(null, { url: '/login' });
    const toggle = q<HTMLButtonElement>('[data-role="staff-toggle"]');
    // O botão é de verdade (Enter e Espaço funcionam sem código) e mora dentro do título h2.
    expect(toggle?.tagName).toBe('BUTTON');
    expect(toggle?.getAttribute('type')).toBe('button');
    expect(toggle?.closest('h2')).not.toBeNull();
    expect(toggle?.querySelector('.cg-accordion__icon svg')).not.toBeNull();
    expect(text(toggle?.querySelector('.cg-accordion__title'))).toBe('Sou da equipe Nexus');
    expect(text(toggle?.querySelector('.cg-accordion__hint'))).toBe(
      'Painel de trabalho da equipe, com código de confirmação',
    );
    expect(toggle?.querySelector('.cg-accordion__chevron')).not.toBeNull();
    // Nome acessível curto; a frase vai como descrição.
    expect(toggle?.getAttribute('aria-label')).toBe('Sou da equipe Nexus');
    expect(document.getElementById(toggle?.getAttribute('aria-describedby') ?? '')?.textContent).toContain('Painel de trabalho');
    // Recolhido: o painel existe (o aria-controls aponta para ele), está escondido e vazio.
    const panel = document.getElementById(toggle?.getAttribute('aria-controls') ?? '');
    expect(panel).not.toBeNull();
    expect(panel?.hasAttribute('hidden')).toBe(true);
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(all('.profile-group')).toHaveLength(0);
    expect(q('.cg-accordion')?.classList.contains('cg-accordion--open')).toBe(false);
    click(toggle);
    await settleCaregiver(app.fixture);
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(panel?.hasAttribute('hidden')).toBe(false);
    expect(panel?.querySelectorAll('.list-row')).toHaveLength(8);
    expect(q('.cg-accordion')?.classList.contains('cg-accordion--open')).toBe(true);
    // O foco continua no botão (Enter e Espaço de novo fecham); a escolha do perfil segue a de sempre.
    click(toggle);
    await settleCaregiver(app.fixture);
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(panel?.hasAttribute('hidden')).toBe(true);
    expect(all('.profile-group')).toHaveLength(0);
  });

  it('E2: ao abrir, a tela rola até o começo do bloco; ao fechar, não rola', async () => {
    app = await bootCaregiverApp(null, { url: '/login' });
    const door = q<HTMLElement>('.cg-accordion');
    const scroll = vi.fn();
    (door as HTMLElement).scrollIntoView = scroll;
    click(q('[data-role="staff-toggle"]'));
    await settleCaregiver(app.fixture);
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll.mock.calls[0]?.[0]).toMatchObject({ block: 'start' });
    click(q('[data-role="staff-toggle"]'));
    await settleCaregiver(app.fixture);
    expect(scroll).toHaveBeenCalledTimes(1);
  });

  it('E2: aberto, escolher a equipe continua levando ao segundo fator; a lista tem os 3 grupos', async () => {
    app = await bootCaregiverApp(null, { url: '/login' });
    click(q('[data-role="staff-toggle"]'));
    await settleCaregiver(app.fixture);
    expect(all('.profile-group h3').map(text)).toEqual(['Gestão (2)', 'Psicologia (4)', 'Atendimento (2)']);
    click(all('.profile-group .list-row')[0]);
    await settleCaregiver(app.fixture);
    expect(app.router.url).toBe('/login/2fa');
  });

  it('AC-CG-22: quem já tem sessão de cuidador não vê a entrada; a equipe segue com o segundo fator', async () => {
    app = await bootCaregiverApp('cg_0001', { url: '/login' });
    expect(app.router.url).toBe('/cuidador/hoje');
  });

  it('a lista da equipe abre sozinha para quem volta de uma sessão da equipe ou de um link de /app', async () => {
    app = await bootCaregiverApp(null, { url: '/app/financeiro' });
    expect(app.router.url).toBe('/login');
    expect(all('.profile-group')).toHaveLength(3);
    expect(q('[data-role="staff-toggle"]')?.getAttribute('aria-expanded')).toBe('true');
  });

  it('depois de sair, a entrada diz "Você saiu. Até a próxima."', async () => {
    app = await bootCaregiverApp('cg_0002', { url: '/cuidador/mais' });
    click(q('[data-role="sign-out"]'));
    await settleCaregiver(app.fixture);
    expect(app.router.url).toBe('/login');
    expect(
      all('.login__panel .banner')
        .map((b) => text(b))
        .join(' '),
    ).toContain('Você saiu. Até a próxima.');
    expect(app.sessionBackend.getItem('nexus-erp:caregiver-session')).toBeNull();
    click(person('Ana Paula Ferraz'));
    await settleCaregiver(app.fixture);
    expect(app.router.url).toBe('/cuidador/hoje');
  });
});
