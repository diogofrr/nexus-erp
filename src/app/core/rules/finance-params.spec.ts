import { describe, expect, it } from 'vitest';
import { restoreFinancialParams, projectScenario, breakEvenSubscribers } from './finance';
import {
  changedFinancialParamPaths,
  mixTotalPercent,
  projectionToCsv,
  validateFinancialParams,
} from './finance-params';

describe('Parâmetros financeiros: validação (SCR-M10-03)', () => {
  it('os valores do plano não têm nenhum problema', () => {
    expect(validateFinancialParams(restoreFinancialParams())).toEqual([]);
  });

  it('participações que não somam 100% dizem quanto somam hoje', () => {
    const params = restoreFinancialParams();
    params.planMix = { essencial: 0.3, cuida: 0.3, sustenta: 0.3 };
    expect(mixTotalPercent(params.planMix)).toBe(90);
    const issues = validateFinancialParams(params);
    expect(issues).toContainEqual({
      path: 'planMix',
      message: 'As participações dos planos precisam somar 100%. Hoje somam 90%.',
    });
  });

  it('preço zero, série decrescente e mês fora do horizonte são recusados', () => {
    const params = restoreFinancialParams();
    params.planPricesCents.essencial = 0;
    params.cumulativeFreeUsersByMonth[5] = 10;
    params.annualSiteMaintenanceMonths = [3, 30];
    const paths = validateFinancialParams(params).map((i) => i.path);
    expect(paths).toContain('planPricesCents.essencial');
    expect(paths).toContain('cumulativeFreeUsersByMonth.5');
    expect(paths).toContain('annualSiteMaintenanceMonths');
  });

  it('hospedagem "a confirmar" (nula) é válida e fora do cálculo', () => {
    const params = restoreFinancialParams();
    expect(params.hostingAnnualCents).toBeNull();
    expect(validateFinancialParams(params)).toEqual([]);
    params.hostingAnnualCents = -5;
    expect(validateFinancialParams(params).map((i) => i.path)).toContain('hostingAnnualCents');
  });
});

describe('Parâmetros financeiros: o que mudou em relação ao plano (AC-M10-06)', () => {
  it('sem mudança não há campo alterado', () => {
    expect(changedFinancialParamPaths(restoreFinancialParams())).toEqual([]);
  });

  it('mudar o preço do Essencial para R$ 59,90 marca só esse campo e recalcula o equilíbrio', () => {
    const params = restoreFinancialParams();
    params.planPricesCents.essencial = 5990;
    expect(changedFinancialParamPaths(params)).toEqual(['planPricesCents.essencial']);
    // Bruta média: 0,4 x 59,90 + 0,3 x 119,90 + 0,3 x 149,90 = 104,90; líquida 93,36; 2.355 / 93,36 = 25,2.
    expect(breakEvenSubscribers(params)).toBe(26);
    expect(breakEvenSubscribers(restoreFinancialParams())).toBe(27);
  });

  it('a série e os cenários também entram na comparação', () => {
    const params = restoreFinancialParams();
    params.scenarios.base = 0.06;
    params.cumulativeFreeUsersByMonth[23] = 5000;
    expect(changedFinancialParamPaths(params)).toEqual([
      'cumulativeFreeUsersByMonth',
      'scenarios.base',
    ]);
  });
});

describe('Exportação da projeção em CSV (SCR-M10-08)', () => {
  it('traz 24 linhas, valores em reais com vírgula, BOM e o rótulo de estimativa', () => {
    const csv = projectionToCsv(projectScenario(restoreFinancialParams(), 'base'));
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(25);
    expect(lines[0]).toContain('Saldo do investimento (R$)');
    // Mês 3: 5 assinantes, bruta 504,50, líquida 449,00, gastos 2.755,00.
    expect(lines[3]).toBe(
      '3;100;100;5;504,50;449,00;2755,00;-2306,00;-7016,00;-24216,00;estimativa do plano',
    );
    expect(csv).not.toMatch(/CUI-|cpf|@/i);
  });
});
