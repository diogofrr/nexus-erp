import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { bootCaregiverApp } from '../testing';
import { ROUTES, PROFILE_ROUTES } from './start.routes';

/**
 * Fumaça da área "Começar e perfil" (P1). Cada rota da área abre, fica no endereço esperado e tem título e um
 * `h1`. Quando você trocar a tela provisória pela tela de verdade, acrescente aqui os testes dela (fluxos,
 * estados vazios, plano e consentimento) e atualize a tabela de rotas se criar sub-rotas.
 */
describe('Área start (Começar e perfil)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('exporta as rotas da área', () => {
    expect(ROUTES.length).toBeGreaterThan(0);
    expect(PROFILE_ROUTES.length).toBeGreaterThan(0);
  });

  const cases = [
    { url: '/cuidador/comecar', final: '/cuidador/comecar', title: 'Começar', signedIn: false },
    { url: '/cuidador/mais/perfil', final: '/cuidador/mais/perfil', title: 'Meu perfil', signedIn: true },
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
