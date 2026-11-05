import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { BootedApp, bootApp, settle } from '../../layout/testing';
import { pick, pickAll, text, typeInto } from '../../shared/ui/testing/dom';
import { FinanceStore } from './state/finance.store';
import { parseMonths } from './pages/params.page';

async function open(userId: string, url: string): Promise<BootedApp> {
  TestBed.resetTestingModule();
  const app = await bootApp({ userId, url });
  await settle(app.fixture);
  return app;
}

const body = (app: BootedApp): string => text(app.root);

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe('M10 Financeiro: visão geral (SCR-M10-01, AC-M10-01 e 05)', () => {
  it('mostra o realizado do seed e a conta do ponto de equilíbrio', async () => {
    const app = await open('u1', '/app/financeiro');
    expect(app.router.url).toBe('/app/financeiro');
    const text1 = body(app);
    // AC-M10-05
    expect(text1).toContain('R$ 1.511,49');
    expect(text1).toContain('R$ 1.698,30');
    expect(text1).toContain('R$ 2.355,00');
    expect(text1).toContain('-R$ 843,51');
    expect(text1).toContain('Faltam 10 assinantes para o ponto de equilíbrio');
    // AC-M10-01: a conta aberta
    expect(text(pick(app.root, '[data-role="how-text"]'))).toBe(
      'R$ 2.355,00 ÷ R$ 89,80 = 26,2, arredondado para cima: 27 assinantes.',
    );
    expect(text(pick(app.root, '[data-role="break-even"]'))).toContain('17 de 27 assinantes');
    expect(text(pick(app.root, '[data-role="break-even"]'))).toContain('63% do caminho');
    // A conversão do seed: 5,0% (17 de 340) ao lado das referências de 3, 5 e 7 (AC-M10-10).
    expect(text(pick(app.root, '[data-role="conversion"]'))).toContain('5,0%');
    expect(text(pick(app.root, '[data-role="conversion"]'))).toContain('17 de 340');
    expect(text(pick(app.root, '[data-role="conversion"]'))).toContain('Referência 3%');
    expect(text(pick(app.root, '[data-role="conversion"]'))).toContain('Referência 7%');
    // Origem dos números (UX 5.13, RN-FIN-32).
    expect(text1).toContain('Dado do sistema');
    expect(text1).toContain('Estimativa do plano');
  });

  it('tem exatamente um h1 e a navegação entre as telas do financeiro', async () => {
    const app = await open('u1', '/app/financeiro');
    expect(pickAll(app.root, 'h1')).toHaveLength(1);
    const links = pickAll<HTMLAnchorElement>(app.root, 'nav[aria-label="Telas do financeiro"] a').map((a) => text(a));
    expect(links).toEqual(['Visão geral', 'Projeção', 'Parâmetros', 'Investimento e capital', 'Custos']);
    expect(app.root.querySelector('nav[aria-label="Telas do financeiro"] a[aria-current="page"]')?.textContent).toContain('Visão geral');
  });
});

describe('M10 Financeiro: projeção (SCR-M10-02, AC-M10-02, 03, 04 e 09)', () => {
  it('cenário de 5%: marcos, primeiro ano e a tabela com 24 meses', async () => {
    const app = await open('u1', '/app/financeiro/projecao');
    expect(text(pick(app.root, '[data-role="first-profit"]'))).toContain('mês 7');
    expect(text(pick(app.root, '[data-role="payback"]'))).toContain('mês 14');
    // AC-M10-04: resultado do primeiro ano e a referência do plano ao lado.
    expect(text(pick(app.root, '[data-role="first-year-result"]'))).toBe('R$ 7.889,00');
    expect(text(pick(app.root, '[data-role="first-year-gross"]'))).toBe('R$ 41.066,30');
    expect(text(pick(app.root, '[data-role="first-year-reference"]'))).toContain('R$ 7.905,00');
    expect(text(pick(app.root, '[data-role="first-year-reference"]'))).toContain('R$ 41.084,00');
    // Tabela mês a mês: 24 linhas (A.13.1).
    const rows = pickAll(app.root, 'app-data-table tbody tr');
    expect(rows).toHaveLength(24);
    const month12 = text(rows[11] as Element);
    expect(month12).toContain('85');
    expect(month12).toContain('R$ 7.633,09');
    expect(text(rows[23] as Element)).toContain('212');
    expect(text(rows[23] as Element)).toContain('R$ 132.381,50');
    // AC-M10-09: a manutenção do site nos meses 3 e 15 (gasto de R$ 2.755,00).
    expect(text(rows[2] as Element)).toContain('R$ 2.755,00');
    expect(text(rows[2] as Element)).toContain('Manutenção do site');
    expect(text(rows[14] as Element)).toContain('R$ 2.755,00');
    expect(text(rows[3] as Element)).not.toContain('Manutenção do site');
    expect(text(pick(app.root, '[data-role="maintenance-note"]'))).toContain('meses 3 e 15');
    // Todo valor de projeção é estimativa do plano (RN-FIN-32).
    expect(body(app)).toContain('Estimativa do plano');
  });

  it('trocar o cenário recalcula os marcos e o aporte extra (3%: mês 9, mês 18, R$ 2.755,91; 7%: mês 6, mês 12)', async () => {
    const app = await open('u1', '/app/financeiro/projecao');
    const radios = pickAll<HTMLButtonElement>(app.root, 'app-segmented [role="radio"]');
    expect(radios.map((r) => text(r))).toEqual(['3%', '5%', '7%']);
    expect(radios[1]?.getAttribute('aria-checked')).toBe('true');
    radios[0]?.click();
    await settle(app.fixture);
    expect(text(pick(app.root, '[data-role="first-profit"]'))).toContain('mês 9');
    expect(text(pick(app.root, '[data-role="payback"]'))).toContain('mês 18');
    expect(text(pick(app.root, '[data-role="extra"]'))).toContain('R$ 2.755,91');
    expect(app.root.querySelector('[data-role="first-year-reference"]')).toBeNull();
    pickAll<HTMLButtonElement>(app.root, 'app-segmented [role="radio"]')[2]?.click();
    await settle(app.fixture);
    expect(text(pick(app.root, '[data-role="first-profit"]'))).toContain('mês 6');
    expect(text(pick(app.root, '[data-role="payback"]'))).toContain('mês 12');
  });

  it('"Comparar com o plano" mostra a conferência com o documento', async () => {
    const app = await open('u1', '/app/financeiro/projecao');
    expect(app.root.querySelector('[data-role="reference-table"]')).toBeNull();
    pick<HTMLInputElement>(app.root, '[data-role="compare"] input').click();
    await settle(app.fixture);
    const table = text(pick(app.root, '[data-role="reference-table"]'));
    expect(table).toContain('Primeiro mês de lucro');
    expect(table).toContain('R$ 7.905,00');
    expect(table).toContain('R$ 7.889,00');
    expect(table).toContain('dentro de 0,5%');
  });

  it('"Baixar tabela (CSV)" grava a exportação no log, sem dado pessoal', async () => {
    const app = await open('u1', '/app/financeiro/projecao');
    const before = app.db.accessLog.size();
    pick<HTMLButtonElement>(app.root, '[data-role="export-csv"]').click();
    await settle(app.fixture);
    const entries = app.db.accessLog.list().slice(before);
    expect(entries.some((e) => e.action === 'export' && e.entity === 'financial_projection')).toBe(true);
    expect(TestBed.inject(FinanceStore).csvFileName('base')).toBe('nexus-projecao-5pct-estimativa.csv');
  });
});

describe('M10 Financeiro: parâmetros (SCR-M10-03, AC-M10-06)', () => {
  it('mudar o preço do Essencial recalcula tudo e "restaurar valores do plano" volta aos do documento', async () => {
    const app = await open('u1', '/app/financeiro/parametros');
    const store = TestBed.inject(FinanceStore);
    expect(store.params().planPricesCents.essencial).toBe(4990);
    expect(app.root.querySelector('[data-role="differs"]')).toBeNull();

    const price = pick<HTMLInputElement>(app.root, '#fp-planpricescents-essencial');
    typeInto(price, '5990');
    await settle(app.fixture);
    expect(store.params().planPricesCents.essencial).toBe(5990);
    // Bruta média: 0,4 x 59,90 + 0,3 x 119,90 + 0,3 x 149,90 = R$ 104,90; líquida R$ 93,36; equilíbrio 26.
    expect(text(pick(app.root, '[data-role="avg-gross"]'))).toBe('R$ 104,90');
    expect(text(pick(app.root, '[data-role="avg-net"]'))).toBe('R$ 93,36');
    expect(text(pick(app.root, '[data-role="break-even"]'))).toContain('26 assinantes');
    // O campo ganha "(alterado)" e a faixa de aviso aparece.
    expect(body(app)).toContain('Preço do Nexus Essencial (alterado)');
    expect(app.root.querySelector('[data-role="differs"]')).not.toBeNull();

    // As outras telas já refletem (o realizado usa a mesma conta).
    expect(store.realized().breakEven).toBe(26);
    expect(store.realized().grossRevenueCents).toBe(7 * 5990 + 5 * 11990 + 5 * 14990);

    pick<HTMLButtonElement>(app.root, '[data-role="restore"]').click();
    await settle(app.fixture);
    expect(store.params().planPricesCents.essencial).toBe(4990);
    expect(text(pick(app.root, '[data-role="break-even"]'))).toContain('27 assinantes');
    expect(text(pick(app.root, '[data-role="avg-net"]'))).toBe('R$ 89,80');
    expect(app.root.querySelector('[data-role="differs"]')).toBeNull();
    expect(app.db.accessLog.list().some((e) => e.entity === 'financial_params')).toBe(true);
  });

  it('participações que não somam 100% mostram o erro em linha e NÃO são gravadas', async () => {
    const app = await open('u1', '/app/financeiro/parametros');
    const store = TestBed.inject(FinanceStore);
    typeInto(pick<HTMLInputElement>(app.root, '#fp-planmix-essencial'), '30');
    await settle(app.fixture);
    expect(text(pick(app.root, '[data-role="mix-error"]'))).toContain(
      'As participações dos planos precisam somar 100%. Hoje somam 90%.',
    );
    expect(app.root.querySelector('app-error-summary')?.hasAttribute('hidden')).toBe(false);
    expect(store.params().planMix.essencial).toBe(0.4);
    // Corrigir (40) volta a gravar.
    typeInto(pick<HTMLInputElement>(app.root, '#fp-planmix-essencial'), '40');
    await settle(app.fixture);
    expect(app.root.querySelector('[data-role="mix-error"]')).toBeNull();
  });

  it('os meses da manutenção aceitam "3 e 15" e recusam texto', () => {
    expect(parseMonths('3 e 15')).toEqual([3, 15]);
    expect(parseMonths('3, 15')).toEqual([3, 15]);
    expect(parseMonths('três')).toEqual([Number.NaN]);
  });
});

describe('M10 Financeiro: investimento e custos (SCR-M10-04 e 05, AC-M10-07 e 08)', () => {
  it('investimento: R$ 15.000,00 + R$ 1.200,00 + R$ 1.000,00 = R$ 17.200,00; reserva e aporte', async () => {
    const app = await open('u1', '/app/financeiro/investimento');
    const t = body(app);
    expect(text(pick(app.root, '[data-role="sum-text"]'))).toContain(
      'R$ 15.000,00 + R$ 1.200,00 + R$ 1.000,00 = R$ 17.200,00',
    );
    expect(t).toContain('R$ 9.300,00');
    expect(t).toContain('R$ 26.500,00');
    expect(text(pick(app.root, '[data-role="sources"]'))).toContain('Empréstimos: nenhum');
    // Aporte extra por cenário (K14).
    expect(text(pick(app.root, '[data-extra="pessimistic"]'))).toBe('R$ 2.755,91');
    expect(text(pick(app.root, '[data-extra="optimistic"]'))).toContain('R$ 0,00');
  });

  it('custos: quadro 5, anual, manutenção do site e hospedagem a confirmar', async () => {
    const app = await open('u1', '/app/financeiro/custos');
    const t = body(app);
    for (const v of ['R$ 499,00', 'R$ 250,00', 'R$ 300,00', 'R$ 1.306,00']) {
      expect(t).toContain(v);
    }
    expect(text(pick(app.root, '[data-role="monthly-total"]'))).toBe('R$ 2.355,00');
    expect(text(pick(app.root, '[data-role="annual-total"]'))).toBe('R$ 28.260,00');
    expect(text(pick(app.root, '[data-role="maintenance"]'))).toContain('R$ 400,00');
    expect(text(pick(app.root, '[data-role="hosting"]'))).toContain('A confirmar, não incluída');
    expect(text(pick(app.root, '[data-role="recurring"]'))).toContain('R$ 28.660,00');
  });
});

describe('M10 Financeiro: quem abre (AC-M10-15)', () => {
  it.each([
    ['u2', 'responsável técnico'],
    ['u3', 'psicólogo'],
    ['u7', 'atendimento'],
  ])('%s (%s) não abre o financeiro: vai a /403 e nada vaza', async (userId) => {
    const app = await open(userId, '/app/financeiro');
    expect(app.router.url).toBe('/403');
    expect(body(app)).not.toContain('R$ 1.511,49');
    expect(body(app)).not.toContain('R$ 2.355,00');
    expect(app.db.accessLog.list().some((e) => e.action === 'denied')).toBe(true);
  });

  it('o responsável técnico também é barrado nas subtelas de valores', async () => {
    const app = await open('u2', '/app/financeiro/projecao');
    expect(app.router.url).toBe('/403');
    TestBed.resetTestingModule();
    const again = await open('u7', '/app/financeiro/parametros');
    expect(again.router.url).toBe('/403');
  });
});
