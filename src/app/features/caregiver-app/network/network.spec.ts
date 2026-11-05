import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { bootCaregiverApp } from '../testing';
import { ROUTES } from './network.routes';

/**
 * Fumaça da área "Rede (a porta, buscar e pedidos)" (P3). Cada rota da área abre, fica no endereço esperado e tem título e um
 * `h1`. Quando você trocar a tela provisória pela tela de verdade, acrescente aqui os testes dela (fluxos,
 * estados vazios, plano e consentimento) e atualize a tabela de rotas se criar sub-rotas.
 */
describe('Área network (Rede (a porta, buscar e pedidos))', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('exporta as rotas da área', () => {
    expect(ROUTES.length).toBeGreaterThan(0);
  });

  const cases = [
    { url: '/cuidador/rede', final: '/cuidador/rede', title: 'Rede', signedIn: true },
    { url: '/cuidador/rede/buscar', final: '/cuidador/rede/buscar', title: 'Buscar', signedIn: true },
    { url: '/cuidador/rede/profissional/prv_01', final: '/cuidador/rede/profissional/prv_01', title: 'Profissional', signedIn: true },
    { url: '/cuidador/rede/pedidos', final: '/cuidador/rede/pedidos', title: 'Meus pedidos', signedIn: true },
  ];

  cases.forEach((c) => {
    it(`abre ${c.url}${c.url === c.final ? '' : ` e vai a ${c.final}`} com o título "${c.title}"`, async () => {
      const app = await bootCaregiverApp(c.signedIn ? 'cg_0001' : null, { url: c.url });
      expect(app.router.url).toBe(c.final);
      expect(app.root.querySelector('main h1')?.textContent?.trim()).toBeTruthy();
      expect(document.title).toContain(c.title);
    });
  });
});
