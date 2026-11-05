import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { bootCaregiverApp } from '../testing';
import { ROUTES } from './routine.routes';

/**
 * Fumaça da área "Rotina" (P1). Cada rota da área abre, fica no endereço esperado e tem título e um
 * `h1`. Quando você trocar a tela provisória pela tela de verdade, acrescente aqui os testes dela (fluxos,
 * estados vazios, plano e consentimento) e atualize a tabela de rotas se criar sub-rotas.
 */
describe('Área routine (Rotina)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('exporta as rotas da área', () => {
    expect(ROUTES.length).toBeGreaterThan(0);
  });

  const cases = [
    { url: '/cuidador/rotina', final: '/cuidador/rotina/agenda', title: 'Agenda', signedIn: true },
    { url: '/cuidador/rotina/agenda', final: '/cuidador/rotina/agenda', title: 'Agenda', signedIn: true },
    { url: '/cuidador/rotina/remedios', final: '/cuidador/rotina/remedios', title: 'Remédios', signedIn: true },
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
