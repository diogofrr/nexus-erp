import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { BootedCaregiverApp, bootCaregiverApp, settleCaregiver } from '../testing';
import { ROUTES } from './network.routes';

const norm = (t: string | null | undefined): string => (t ?? '').replace(/\s+/g, ' ').trim();

const cards = (app: BootedCaregiverApp): HTMLAnchorElement[] => Array.from(app.root.querySelectorAll<HTMLAnchorElement>('main a.cg-card--link'));

/**
 * Área network: fumaça das 4 rotas e a porta de Rede (UX C12, AC-CG-113 a 115). Buscar, Profissional e Meus pedidos têm
 * os seus testes em `search.spec.ts`, `provider.spec.ts` e `orders.spec.ts`.
 */
describe('Área network (Rede)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('exporta as rotas da área', () => {
    expect(ROUTES.length).toBe(4);
  });

  const cases = [
    { url: '/cuidador/rede', title: 'Rede' },
    { url: '/cuidador/rede/buscar', title: 'Buscar' },
    { url: '/cuidador/rede/buscar?categoria=physiotherapy', title: 'Buscar' },
    { url: '/cuidador/rede/profissional/prv_01', title: 'Profissional' },
    { url: '/cuidador/rede/profissional/nao-existe', title: 'Profissional' },
    { url: '/cuidador/rede/pedidos', title: 'Meus pedidos' },
  ];

  cases.forEach((c) => {
    it(`abre ${c.url} com o título "${c.title}" e um único h1`, async () => {
      const app = await bootCaregiverApp('cg_0001', { url: c.url });
      expect(app.router.url).toBe(c.url);
      expect(document.title).toContain(c.title);
      expect(app.root.querySelectorAll('main h1').length).toBe(1);
      expect(app.root.querySelector('main h1')?.textContent?.trim()).toBeTruthy();
    });
  });

  describe('a porta de Rede (AC-CG-113 a 115)', () => {
    it('AC-CG-113: 3 cartões na ordem Buscar, Meus pedidos e Cartão Nexus, cada um leva à sua rota, em uma coluna no celular', async () => {
      const app = await bootCaregiverApp('cg_0001', { url: '/cuidador/rede' });
      expect(app.root.querySelector('main h1')?.textContent?.trim()).toBe('Rede');
      expect(norm(app.root.querySelector('.cg-page-header__desc')?.textContent)).toBe(
        'Profissionais e serviços para o cuidado da pessoa idosa. A Nexus organiza e você escolhe.',
      );
      const list = cards(app);
      expect(list.map((c) => norm(c.querySelector('.cg-card__title')?.textContent))).toEqual([
        'Buscar profissionais e serviços',
        'Meus pedidos',
        'Cartão Nexus',
      ]);
      expect(list.map((c) => c.getAttribute('href'))).toEqual(['/cuidador/rede/buscar', '/cuidador/rede/pedidos', '/cuidador/rede/cartao']);
      // A grade do kit é de 1 coluna e passa a 2 de 768 px em diante (CSS global `.cg-grid`).
      expect(app.root.querySelector('main .cg-grid')?.querySelectorAll('a.cg-card--link').length).toBe(3);
    });

    it('AC-CG-114: todos os planos veem os 3 cartões, sem cadeado e sem preço', async () => {
      for (const id of ['cg_0001', 'cg_0002', 'cg_0003', 'cg_0027', 'cg_0026', 'cg_0016']) {
        const app = await bootCaregiverApp(id, { url: '/cuidador/rede' });
        expect(cards(app).length).toBe(3);
        const html = app.root.querySelector('main')?.innerHTML ?? '';
        expect(html).not.toContain('i-lock');
        expect(norm(app.root.querySelector('main')?.textContent)).not.toContain('R$');
        TestBed.resetTestingModule();
      }
    });

    it('AC-CG-114: o cartão do Cartão Nexus diz "Seu número e onde usar." ao assinante e "Um benefício dos planos pagos." ao Livre', async () => {
      const elza = await bootCaregiverApp('cg_0027', { url: '/cuidador/rede' });
      expect(norm(elza.root.querySelector('[data-role="card-line"]')?.textContent)).toBe('Seu número e onde usar.');
      TestBed.resetTestingModule();
      const joao = await bootCaregiverApp('cg_0003', { url: '/cuidador/rede' });
      expect(norm(joao.root.querySelector('[data-role="card-line"]')?.textContent)).toBe('Um benefício dos planos pagos.');
      expect(cards(joao)[2]?.getAttribute('href')).toBe('/cuidador/rede/cartao');
    });

    it('a frase de Meus pedidos muda com os fatos da pessoa', async () => {
      const line = async (id: string): Promise<string> => {
        const app = await bootCaregiverApp(id, { url: '/cuidador/rede' });
        const text = norm(app.root.querySelector('[data-role="orders-line"]')?.textContent);
        TestBed.resetTestingModule();
        return text;
      };
      expect(await line('cg_0002')).toBe('Você ainda não fez pedidos.');
      expect(await line('cg_0003')).toBe('1 pedido aguardando resposta.');
      expect(await line('cg_0027')).toBe('1 pedido aguardando resposta.');
      expect(await line('cg_0008')).toBe('1 serviço para avaliar.');
      expect(await line('cg_0001')).toBe('Acompanhe os seus pedidos.');
    });

    it('vários pedidos aguardando resposta ficam no plural', async () => {
      const app = await bootCaregiverApp('cg_0002', { url: '/cuidador/rede' });
      ['prv_01', 'prv_02'].forEach((providerId) =>
        app.db.serviceRequests.create({
          caregiverId: 'cg_0002',
          providerId,
          specialty: 'physiotherapy',
          need: 'Fisioterapia',
          modality: 'at_provider',
          status: 'requested',
          requestedAt: '2026-11-03T10:00:00-03:00',
        }),
      );
      await settleCaregiver(app.fixture);
      expect(norm(app.root.querySelector('[data-role="orders-line"]')?.textContent)).toBe('2 pedidos aguardando resposta.');
    });

    it('AC-CG-115: o aviso "A Nexus organiza a rede. O serviço é feito e pago direto com o profissional." está na tela', async () => {
      const app = await bootCaregiverApp('cg_0003', { url: '/cuidador/rede' });
      expect(norm(app.root.querySelector('[data-role="notice"]')?.textContent)).toBe(
        'A Nexus organiza a rede. O serviço é feito e pago direto com o profissional.',
      );
    });

    it('nada na porta depende de pontuação, faixa, alerta ou ARBE', async () => {
      for (const id of ['cg_0001', 'cg_0002']) {
        const app = await bootCaregiverApp(id, { url: '/cuidador/rede' });
        expect(norm(app.root.querySelector('main')?.textContent).toLowerCase()).not.toMatch(/zarit|pontua|faixa|alerta|arbe|sobrecarga|risco/);
        TestBed.resetTestingModule();
      }
    });
  });
});
