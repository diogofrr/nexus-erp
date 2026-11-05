import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { InactivityService } from '../../core/auth/inactivity.service';
import { PROTOTYPE_NOTICE } from '../../core/privacy/browser-data.service';
import { BootedApp, bootApp, settle } from '../../layout/testing';
import { destinationAfterLogin } from './return-url';
import { CODE_FORMAT_TEXT, wrongCodeText } from './pages/two-factor.page';
import { SESSION_EXPIRED_TEXT, TWO_FACTOR_FAILED_TEXT } from './pages/login.page';

const click = (el: Element | null | undefined): void => {
  if (!el) {
    throw new Error('elemento não encontrado');
  }
  (el as HTMLElement).click();
};

describe('destinationAfterLogin (U-02, A-03)', () => {
  it('volta ao link de origem se o perfil que entrou pode abri-lo; senão vai à tela inicial', () => {
    expect(destinationAfterLogin('partner', '/app/financeiro?mes=2026-11')).toBe(
      '/app/financeiro?mes=2026-11',
    );
    expect(destinationAfterLogin('support', '/app/financeiro')).toBe('/app/painel');
    // O antigo portal não existe mais: qualquer endereço /portal volta ao painel.
    expect(destinationAfterLogin('partner', '/portal/documentos')).toBe('/app/painel');
    expect(destinationAfterLogin('support', '/portal')).toBe('/app/painel');
    expect(destinationAfterLogin('psychologist', '/app/cuidadores/cg_0001')).toBe(
      '/app/cuidadores/cg_0001',
    );
    expect(destinationAfterLogin('technical_lead', '/app/configuracoes/arbe')).toBe(
      '/app/configuracoes/arbe',
    );
    expect(destinationAfterLogin('support', '/app/meus-dados')).toBe('/app/meus-dados');
  });

  it('nunca volta à entrada, ao 403 nem a um endereço de fora', () => {
    expect(destinationAfterLogin('partner', '/login')).toBe('/app/painel');
    expect(destinationAfterLogin('partner', '/login/2fa')).toBe('/app/painel');
    expect(destinationAfterLogin('partner', '/403')).toBe('/app/painel');
    expect(destinationAfterLogin('partner', null)).toBe('/app/painel');
    expect(destinationAfterLogin('partner', 'https://exemplo.com/app/painel')).toBe('/app/painel');
  });
});

describe('entrada: seleção de perfil (SCR-M01-01, AC-M01-01 e 02)', () => {
  let app: BootedApp;
  const q = <T extends Element = HTMLElement>(selector: string): T | null =>
    app.root.querySelector<T>(selector);
  const all = <T extends Element = HTMLElement>(selector: string): T[] =>
    Array.from(app.root.querySelectorAll<T>(selector));

  it('lista os 8 usuários da equipe em três grupos por função, com perfil por extenso, frase de cenário e aviso de protótipo', async () => {
    app = await bootApp({ url: '/login' });
    expect(q('h1')?.textContent).toBe('Entrar como');
    expect(q('.banner--prototype')?.textContent).toContain(PROTOTYPE_NOTICE);
    const headings = all('.profile-group h2').map((h) => h.textContent?.trim());
    expect(headings).toEqual(['Gestão (2)', 'Psicologia (4)', 'Atendimento (2)']);
    const cards = all('.profile-group .list-row');
    expect(cards).toHaveLength(8);
    expect(cards.map((c) => c.querySelector('.list-row__title')?.textContent)).not.toContain(
      'Dr. Eduardo Falcão',
    );
    const rafael = cards.find((c) => c.textContent?.includes('Dr. Rafael Moreira'));
    expect(rafael?.getAttribute('aria-label')).toContain('Entrar como Dr. Rafael Moreira');
    expect(rafael?.textContent).toContain('Psicólogo(a) da Nexus');
    expect(rafael?.textContent).toContain('Agenda muito ocupada');
    // Toda a equipe mostra o selo "Código".
    const badges = all('.profile-group .badge');
    expect(badges).toHaveLength(8);
    expect(badges.every((b) => b.textContent?.includes('Código'))).toBe(true);
    // Não há grupo da rede credenciada nem avatar dourado de prestador.
    expect(all('.profile-group h2').some((h) => h.textContent?.includes('Rede'))).toBe(false);
    expect(all('.avatar--gold')).toHaveLength(0);
  });

  it('a equipe vai ao segundo fator: código exibido, "Usar o código mostrado", confirmar e entrar no painel', async () => {
    app = await bootApp({ url: '/login' });
    click(all('.list-row').find((c) => c.textContent?.includes('Dra. Cecília Montenegro')));
    await settle(app.fixture);
    expect(app.router.url).toBe('/login/2fa');
    expect(app.auth.isAuthenticated()).toBe(false);
    expect(q('h1')?.textContent).toBe('Confirme que é você');
    expect(q('[data-role="shown-code"]')?.textContent).toBe('123456');
    const input = q<HTMLInputElement>('#nx-code') as HTMLInputElement;
    expect(input.getAttribute('autocomplete')).toBe('one-time-code');
    expect(input.getAttribute('inputmode')).toBe('numeric');
    expect(input.maxLength).toBe(6);
    click(q('[data-role="use-code"]'));
    await settle(app.fixture);
    expect(input.value).toBe('123456');
    // Sem envio automático: ainda não entrou.
    expect(app.auth.isAuthenticated()).toBe(false);
    click(q('[data-role="confirm"]'));
    await settle(app.fixture);
    expect(app.auth.isAuthenticated()).toBe(true);
    expect(app.router.url).toBe('/app/painel');
    expect(document.activeElement?.tagName).toBe('H1');
    expect(app.db.accessLog.list().at(-1)).toMatchObject({ action: 'login', userId: 'u2' });
  });

  it('código errado: erro no campo e no resumo, texto mantido, tentativas contadas; o 3º erro volta à entrada e grava denied (U-06)', async () => {
    app = await bootApp({ url: '/login' });
    click(all('.list-row').find((c) => c.textContent?.includes('Camila Duarte')));
    await settle(app.fixture);
    const submit = async (code: string): Promise<void> => {
      const input = q<HTMLInputElement>('#nx-code') as HTMLInputElement;
      input.value = code;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      click(q('[data-role="confirm"]'));
      await settle(app.fixture);
    };

    await submit('111111');
    expect(q('.field__error')?.textContent).toContain(wrongCodeText(2));
    expect(q('.field__error')?.textContent).toContain('Erro:');
    expect(q('.error-summary')?.textContent).toContain(wrongCodeText(2));
    expect(q('.error-summary')?.getAttribute('role')).toBe('alert');
    expect(q<HTMLInputElement>('#nx-code')?.value).toBe('111111');
    expect(q('#nx-code')?.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(q('.error-summary'));

    await submit('222222');
    expect(q('.field__error')?.textContent).toContain('Resta 1 tentativa.');

    const before = app.db.accessLog.size();
    await submit('333333');
    expect(app.router.url).toBe('/login');
    expect(app.auth.isAuthenticated()).toBe(false);
    expect(q('.banner--attention')?.textContent).toContain(TWO_FACTOR_FAILED_TEXT);
    expect(
      app.db.accessLog
        .list()
        .slice(before)
        .some((e) => e.action === 'denied' && e.userId === 'u7'),
    ).toBe(true);
  });

  it('código com menos de 6 números pede os 6 dígitos; o campo só aceita números', async () => {
    app = await bootApp({ url: '/login' });
    click(all('.list-row').find((c) => c.textContent?.includes('Wesley Lacerda')));
    await settle(app.fixture);
    const input = q<HTMLInputElement>('#nx-code') as HTMLInputElement;
    input.value = '12ab34';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(input.value).toBe('1234');
    click(q('[data-role="confirm"]'));
    await settle(app.fixture);
    expect(q('.field__error')?.textContent).toContain(CODE_FORMAT_TEXT);
    // Voltar descarta a sessão pendente, sem log de logout.
    const before = app.db.accessLog.size();
    click(q('[data-role="back"]'));
    await settle(app.fixture);
    expect(app.router.url).toBe('/login');
    expect(app.auth.isPendingTwoFactor()).toBe(false);
    expect(app.db.accessLog.size()).toBe(before);
  });

  it('abrir /login/2fa sem ter escolhido perfil volta à entrada', async () => {
    app = await bootApp({ url: '/login/2fa' });
    expect(app.router.url).toBe('/login');
  });

  it('quem já entrou não vê a entrada: vai à sua tela inicial', async () => {
    app = await bootApp({ userId: 'u3' });
    await app.router.navigateByUrl('/login');
    await settle(app.fixture);
    expect(app.router.url).toBe('/app/painel');
  });
});

describe('retorno ao link de origem (U-02) e telas do M01', () => {
  let app: BootedApp;
  const q = <T extends Element = HTMLElement>(selector: string): T | null =>
    app.root.querySelector<T>(selector);
  const all = <T extends Element = HTMLElement>(selector: string): T[] =>
    Array.from(app.root.querySelectorAll<T>(selector));

  const choose = async (name: string): Promise<void> => {
    click(all('.list-row').find((c) => c.textContent?.includes(name)));
    await settle(app.fixture);
  };
  const confirmCode = async (): Promise<void> => {
    click(q('[data-role="use-code"]'));
    click(q('[data-role="confirm"]'));
    await settle(app.fixture);
  };

  it('sem sessão a rota leva à entrada e, depois do código, volta ao link se o perfil confere', async () => {
    app = await bootApp({ url: '/app/financeiro' });
    expect(app.router.url).toBe('/login');
    await choose('Helena Prado Vasconcelos');
    await confirmCode();
    expect(app.router.url).toBe('/app/financeiro');
  });

  it('com outro perfil que não abre o link, vai ao painel (e não ao 403)', async () => {
    app = await bootApp({ url: '/app/financeiro' });
    await choose('Camila Duarte');
    await confirmCode();
    expect(app.router.url).toBe('/app/painel');
  });

  it('o 403 é neutro, não diz se o recurso existe e leva ao painel; o 404 também', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/financeiro' });
    expect(app.router.url).toBe('/403');
    expect(q('h1')?.textContent).toBe('Você não tem acesso a esta página');
    const text = q('.empty')?.textContent ?? '';
    expect(text).not.toMatch(/financeiro|existe|não encontrad|404|403/i);
    expect(q('[data-role="home"]')?.getAttribute('href')).toBe('/app/painel');
    expect(q('.app-footer')?.textContent).toContain(PROTOTYPE_NOTICE);

    await app.router.navigateByUrl('/endereco/que/nao-existe');
    await settle(app.fixture);
    expect(q('h1')?.textContent).toBe('Página não encontrada');
    expect(q('[data-role="home"]')?.getAttribute('href')).toBe('/app/painel');
  });

  it('o 404 sem sessão leva à entrada', async () => {
    app = await bootApp({ url: '/nada-aqui' });
    expect(q('h1')?.textContent).toBe('Página não encontrada');
    expect(q('[data-role="home"]')?.getAttribute('href')).toBe('/login');
  });

  it('sessão expirada por inatividade: tela própria, log de logout e volta ao mesmo lugar com o mesmo perfil (A-03)', async () => {
    app = await bootApp({ userId: 'u3', url: '/app/grupos' });
    expect(app.router.url).toBe('/app/grupos');
    const before = app.db.accessLog.size();
    // O serviço de inatividade encerra a sessão aos 30 minutos.
    TestBed.inject(InactivityService).start();
    const lastActivity = (
      TestBed.inject(InactivityService) as unknown as { lastActivityMs: number }
    ).lastActivityMs;
    TestBed.inject(InactivityService).evaluate(lastActivity + 31 * 60_000);
    await settle(app.fixture);
    TestBed.inject(InactivityService).stop();

    expect(app.auth.isAuthenticated()).toBe(false);
    expect(app.router.url).toBe('/login/expirada');
    expect(q('h1')?.textContent).toBe('Sua sessão terminou');
    expect(q('.empty__text')?.textContent).toBe(SESSION_EXPIRED_TEXT);
    expect(
      app.db.accessLog
        .list()
        .slice(before)
        .some((e) => e.action === 'logout' && e.detail?.includes('inatividade')),
    ).toBe(true);

    click(q('[data-role="sign-in"]'));
    await settle(app.fixture);
    expect(app.router.url).toBe('/login');
    expect(q('.banner--attention')?.textContent).toContain(SESSION_EXPIRED_TEXT);
    await choose('Dr. Rafael Moreira');
    await confirmCode();
    expect(app.router.url).toBe('/app/grupos');
  });
});
