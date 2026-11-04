import { describe, expect, it } from 'vitest';
import { FinancialParams } from '../models/finance';
import { BASE_REFERENCE, SCENARIO_REFERENCE } from './fixtures/reference-projection';
import {
  CONVERSION_REFERENCES,
  DEFAULT_FINANCIAL_PARAMS,
  DEFAULT_FREE_USERS_SERIES,
  PLAN_REFERENCE,
  annualCostsCents,
  breakEvenExact,
  breakEvenSubscribers,
  conversionRatePercent,
  initialInvestmentTotalCents,
  isWithinTolerance,
  knownRecurringAnnualCents,
  monthlyCostsTotalCents,
  netRevenueCents,
  projectAllScenarios,
  projectScenario,
  realizedFinance,
  restoreFinancialParams,
  subscribersFor,
  subscribersMissing,
  totalContributionCents,
} from './finance';

const params = restoreFinancialParams();

describe('Financeiro: constantes do plano (A.0, A.3, A.4)', () => {
  it('gastos mensais somam R$ 2.355,00; anuais R$ 28.260,00; recorrente conhecido R$ 28.660,00', () => {
    expect(monthlyCostsTotalCents(params)).toBe(235_500);
    expect(annualCostsCents(params)).toBe(2_826_000);
    expect(knownRecurringAnnualCents(params)).toBe(2_866_000);
    expect(params.annualSiteMaintenanceCents).toBe(40_000);
    expect(params.annualSiteMaintenanceMonths).toEqual([3, 15]);
    expect(params.hostingAnnualCents).toBeNull();
  });

  it('investimento R$ 15.000 + R$ 1.200 + R$ 1.000 = R$ 17.200; reserva R$ 9.300; aporte R$ 26.500 (AC-M10-07)', () => {
    expect(initialInvestmentTotalCents(params)).toBe(1_720_000);
    expect(params.reserveCents).toBe(930_000);
    expect(totalContributionCents(params)).toBe(2_650_000);
  });

  it('a série de gratuitos tem 24 meses e termina em 4.240', () => {
    expect(DEFAULT_FREE_USERS_SERIES).toHaveLength(24);
    expect(DEFAULT_FREE_USERS_SERIES[11]).toBe(1700);
    expect(DEFAULT_FREE_USERS_SERIES[23]).toBe(4240);
  });

  it('"restaurar valores do plano" devolve uma cópia independente', () => {
    const copy = restoreFinancialParams();
    copy.planPricesCents.essencial = 5990;
    copy.cumulativeFreeUsersByMonth[0] = 99;
    expect(DEFAULT_FINANCIAL_PARAMS.planPricesCents.essencial).toBe(4990);
    expect(DEFAULT_FINANCIAL_PARAMS.cumulativeFreeUsersByMonth[0]).toBe(0);
    expect(restoreFinancialParams()).toEqual(DEFAULT_FINANCIAL_PARAMS);
  });
});

describe('Financeiro: ponto de equilíbrio (K10, K11; AC-M10-01, 06)', () => {
  it('R$ 2.355,00 ÷ R$ 89,80 = 26,2, logo 27 assinantes', () => {
    expect(breakEvenExact(params)).toBeCloseTo(26.22, 2);
    expect(breakEvenSubscribers(params)).toBe(27);
    expect(Math.ceil(2355 / 89.8)).toBe(27);
  });

  it('mudar o preço do Essencial para R$ 59,90 recalcula o ponto de equilíbrio', () => {
    const changed: FinancialParams = {
      ...params,
      planPricesCents: { ...params.planPricesCents, essencial: 5990 },
    };
    expect(breakEvenSubscribers(changed)).toBe(26);
  });

  it('faltam max(0, 27 - assinantes)', () => {
    expect(subscribersMissing(27, 17)).toBe(10);
    expect(subscribersMissing(27, 30)).toBe(0);
  });
});

describe('Financeiro: assinantes e receita líquida', () => {
  it('assinantes = conversão x gratuitos, meio para cima, em aritmética inteira', () => {
    expect(subscribersFor(0.05, 340)).toBe(17);
    expect(subscribersFor(0.03, 340)).toBe(10); // 10,2
    expect(subscribersFor(0.07, 340)).toBe(24); // 23,8
    expect(subscribersFor(0.05, 10)).toBe(1); // 0,5 sobe
    expect(subscribersFor(0.05, 9)).toBe(0); // 0,45
    expect(subscribersFor(0.05, 0)).toBe(0);
  });

  it('a líquida reproduz o arredondamento da tabela de referência (R$ 504,50 resulta R$ 449,00; R$ 2.522,50 resulta R$ 2.245,03)', () => {
    expect(netRevenueCents(50_450, 0.11)).toBe(44_900);
    expect(netRevenueCents(252_250, 0.11)).toBe(224_503);
    expect(netRevenueCents(0, 0.11)).toBe(0);
  });
});

describe('Financeiro: projeção de 24 meses (A.13)', () => {
  const base = projectScenario(params, 'base');
  const pess = projectScenario(params, 'pessimistic');
  const opt = projectScenario(params, 'optimistic');

  it('cenário-base: todas as linhas da tabela A.13.1, em centavos, exatamente', () => {
    expect(base.rows).toHaveLength(24);
    BASE_REFERENCE.forEach((ref) => {
      const row = base.rows[ref.month - 1];
      expect(row, `mês ${ref.month}`).toMatchObject({
        month: ref.month,
        cumulativeFreeUsers: ref.cumulativeFree,
        subscribers: ref.subscribers,
        grossRevenueCents: ref.grossCents,
        netRevenueCents: ref.netCents,
        costsCents: ref.costsCents,
        resultCents: ref.resultCents,
        cumulativeResultCents: ref.cumulativeResultCents,
        balanceCents: ref.balanceCents,
      });
    });
  });

  it('cenários 3% e 7%: assinantes, resultado e saldo da tabela A.13.2, exatamente', () => {
    SCENARIO_REFERENCE.forEach((ref) => {
      expect(pess.rows[ref.month - 1], `3% mês ${ref.month}`).toMatchObject({
        subscribers: ref.subscribers3,
        resultCents: ref.resultCents3,
        balanceCents: ref.balanceCents3,
      });
      expect(opt.rows[ref.month - 1], `7% mês ${ref.month}`).toMatchObject({
        subscribers: ref.subscribers7,
        resultCents: ref.resultCents7,
        balanceCents: ref.balanceCents7,
      });
    });
  });

  it('marcos do documento: lucro a partir dos meses 9, 7 e 6; retorno nos meses 18, 14 e 12 (AC-M10-02, 03)', () => {
    expect([pess.firstProfitMonth, base.firstProfitMonth, opt.firstProfitMonth]).toEqual([9, 7, 6]);
    expect([pess.paybackMonth, base.paybackMonth, opt.paybackMonth]).toEqual([18, 14, 12]);
    expect(PLAN_REFERENCE.base.firstProfitMonth).toBe(base.firstProfitMonth);
    expect(PLAN_REFERENCE.base.paybackMonth).toBe(base.paybackMonth);
  });

  it('assinantes no cenário-base: 5 no mês 3, 33 no mês 7, 85 no 12, 110 no 14 e 212 no 24', () => {
    Object.entries(PLAN_REFERENCE.base.subscribersByMonth).forEach(([month, subscribers]) => {
      expect(base.rows[Number(month) - 1]?.subscribers, `mês ${month}`).toBe(subscribers);
    });
    expect(base.rows[0]?.subscribers).toBe(0);
    expect(base.rows[1]?.subscribers).toBe(0);
    expect(base.rows[11]?.cumulativeFreeUsers).toBe(1700);
  });

  it('primeiro ano: mensalidades R$ 41.066,30 e resultado R$ 7.889,00, a menos de 0,5% do plano (AC-M10-04)', () => {
    expect(base.firstYear.grossRevenueCents).toBe(4_106_630);
    expect(base.firstYear.resultCents).toBe(788_900);
    expect(
      isWithinTolerance(base.firstYear.grossRevenueCents, PLAN_REFERENCE.base.firstYearGrossCents),
    ).toBe(true);
    expect(
      isWithinTolerance(base.firstYear.resultCents, PLAN_REFERENCE.base.firstYearResultCents),
    ).toBe(true);
  });

  it('mês 24: saldo R$ 132.381,50 (cerca de R$ 132.000,00, a menos de 0,5%)', () => {
    expect(base.month24BalanceCents).toBe(13_238_150);
    expect(
      isWithinTolerance(base.month24BalanceCents, PLAN_REFERENCE.base.cumulativeMonth24Cents),
    ).toBe(true);
    expect(base.month24CumulativeResultCents).toBe(14_958_150);
    expect(pess.month24BalanceCents).toBe(4_958_499);
    expect(opt.month24BalanceCents).toBe(21_517_802);
  });

  it('a manutenção anual do site cai nos meses 3 e 15 (gasto de R$ 2.755,00; AC-M10-09)', () => {
    expect(base.rows.filter((r) => r.costsCents === 275_500).map((r) => r.month)).toEqual([3, 15]);
    expect(base.rows.filter((r) => r.costsCents === 235_500)).toHaveLength(22);
  });

  it('aporte extra: R$ 2.755,91 no cenário de 3% (maior prejuízo R$ 12.055,91 no mês 8) e quase zero no base', () => {
    expect(pess.maxCumulativeLossCents).toBe(1_205_591);
    expect(pess.maxCumulativeLossMonth).toBe(8);
    expect(pess.extraContributionCents).toBe(275_591);
    expect(base.maxCumulativeLossCents).toBe(941_134);
    expect(base.maxCumulativeLossMonth).toBe(6);
    expect(base.extraContributionCents).toBe(11_134);
    expect(opt.extraContributionCents).toBe(0);
    expect(opt.maxCumulativeLossCents).toBe(813_396);
  });

  it('em todos os cenários a Nexus se paga em menos de dois anos', () => {
    [pess, base, opt].forEach((s) => expect(s.paybackMonth as number).toBeLessThan(24));
    expect(projectAllScenarios(params).base.paybackMonth).toBe(14);
  });

  it('a conversão realizada usa 3%, 5% e 7% como referência', () => {
    expect(CONVERSION_REFERENCES).toEqual([3, 5, 7]);
    expect(base.conversionRate).toBe(0.05);
    expect(pess.conversionRate).toBe(0.03);
    expect(opt.conversionRate).toBe(0.07);
  });

  it('alterar um parâmetro recalcula tudo (preço do Essencial a R$ 59,90 antecipa o retorno)', () => {
    const changed = projectScenario(
      { ...params, planPricesCents: { ...params.planPricesCents, essencial: 5990 } },
      'base',
    );
    expect(changed.rows[11]?.grossRevenueCents).toBeGreaterThan(
      base.rows[11]?.grossRevenueCents as number,
    );
    expect(changed.paybackMonth as number).toBeLessThanOrEqual(base.paybackMonth as number);
  });

  it('sem lucro no horizonte, não há mês de lucro nem retorno', () => {
    const bad = projectScenario(
      { ...params, scenarios: { ...params.scenarios, base: 0.001 } },
      'base',
    );
    expect(bad.firstProfitMonth).toBeNull();
    expect(bad.paybackMonth).toBeNull();
  });
});

describe('Financeiro: realizado do seed (K01 a K11; AC-M10-05)', () => {
  it('17 assinantes: R$ 1.698,30 bruta, R$ 1.511,49 líquida, -R$ 843,51 e faltam 10', () => {
    const r = realizedFinance(params, { essencial: 7, cuida: 5, sustenta: 5 });
    expect(r).toMatchObject({
      subscribers: 17,
      grossRevenueCents: 169_830,
      netRevenueCents: 151_149,
      costsCents: 235_500,
      resultCents: -84_351,
      breakEven: 27,
      missing: 10,
      aboveBreakEven: false,
    });
    expect(r.averageGrossCents).toBe(9990);
  });

  it('acima do ponto de equilíbrio com 27 assinantes na mistura do plano', () => {
    const r = realizedFinance(params, { essencial: 11, cuida: 8, sustenta: 8 });
    expect(r.aboveBreakEven).toBe(true);
    expect(r.missing).toBe(0);
  });

  it('inclui a manutenção anual quando o mês é o do pagamento', () => {
    expect(
      realizedFinance(
        params,
        { essencial: 0, cuida: 0, sustenta: 0 },
        { includeAnnualMaintenance: true },
      ).costsCents,
    ).toBe(275_500);
    expect(
      realizedFinance(params, { essencial: 0, cuida: 0, sustenta: 0 }).averageGrossCents,
    ).toBeNull();
  });

  it('conversão realizada: 17 de 340 é 5,0%', () => {
    expect(conversionRatePercent(17, 340)).toBe(5);
    expect(conversionRatePercent(0, 0)).toBeNull();
  });
});
