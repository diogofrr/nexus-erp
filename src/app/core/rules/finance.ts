/**
 * Financeiro e viabilidade (RN-FIN-01 a 37, RN-KPI-19 a 21, A.0, A.3, A.4, A.13).
 *
 * Tudo em centavos. A projeção segue a RN-FIN-24 com a série de gratuitos da RN-FIN-25 e reproduz
 * exatamente os marcos do plano (A.13): primeiro lucro nos meses 7, 9 e 6; retorno nos meses 14, 18 e 12.
 */
import { Cents } from '../models/primitives';
import { FinancialParams, ProjectionRow, ScenarioKey } from '../models/finance';
import { PaidPlanId } from '../models/plans';
import {
  DEFAULT_FEES_RATE,
  DEFAULT_PLAN_MIX,
  DEFAULT_PLAN_PRICES,
  averageGrossPerSubscriberCents,
  averageNetPerSubscriberCents,
} from './plans';

/** Série de gratuitos acumulados do cenário-base, meses 1 a 24 (RN-FIN-25). */
export const DEFAULT_FREE_USERS_SERIES: readonly number[] = [
  0, 0, 100, 200, 340, 500, 660, 860, 1060, 1240, 1480, 1700, 1940, 2200, 2400, 2660, 2880, 3120,
  3320, 3500, 3700, 3900, 4080, 4240,
];

export const PROJECTION_MONTHS = 24;

/** Valores do plano de negócios (A.0). `restoreFinancialParams` devolve uma cópia profunda. */
export const DEFAULT_FINANCIAL_PARAMS: Readonly<FinancialParams> = {
  planPricesCents: { ...DEFAULT_PLAN_PRICES },
  planMix: { ...DEFAULT_PLAN_MIX },
  feesRate: DEFAULT_FEES_RATE,
  monthlyCostsCents: { coworking: 49900, appMaintenance: 25000, accounting: 30000, travel: 130600 },
  annualSiteMaintenanceCents: 40000,
  annualSiteMaintenanceMonths: [3, 15],
  hostingAnnualCents: null,
  initialInvestmentCents: { appAndSite: 1_500_000, company: 120_000, lawyer: 100_000 },
  reserveCents: 930_000,
  cumulativeFreeUsersByMonth: [...DEFAULT_FREE_USERS_SERIES],
  scenarios: { pessimistic: 0.03, base: 0.05, optimistic: 0.07 },
};

/** "Restaurar valores do plano" (AC-M10-06): cópia independente dos padrões. */
export function restoreFinancialParams(): FinancialParams {
  const d = DEFAULT_FINANCIAL_PARAMS;
  return {
    ...d,
    planPricesCents: { ...d.planPricesCents },
    planMix: { ...d.planMix },
    monthlyCostsCents: { ...d.monthlyCostsCents },
    annualSiteMaintenanceMonths: [...d.annualSiteMaintenanceMonths],
    initialInvestmentCents: { ...d.initialInvestmentCents },
    cumulativeFreeUsersByMonth: [...d.cumulativeFreeUsersByMonth],
    scenarios: { ...d.scenarios },
  };
}

export const SCENARIO_LABELS: Readonly<Record<ScenarioKey, string>> = {
  pessimistic: 'Pessimista (3 a cada 100)',
  base: 'Base (5 a cada 100)',
  optimistic: 'Otimista (7 a cada 100)',
};

/** Rótulo obrigatório de toda projeção (RN-FIN-32). */
export const ESTIMATE_LABEL = 'estimativa do plano';

// ===== Valores derivados =====

/** Gasto mensal fixo total: R$ 2.355,00 (Quadro 5). */
export function monthlyCostsTotalCents(params: Pick<FinancialParams, 'monthlyCostsCents'>): Cents {
  const c = params.monthlyCostsCents;
  return c.coworking + c.appMaintenance + c.accounting + c.travel;
}

/** Gasto anual dos custos mensais: R$ 28.260,00. */
export function annualCostsCents(params: Pick<FinancialParams, 'monthlyCostsCents'>): Cents {
  return monthlyCostsTotalCents(params) * 12;
}

/** Gasto recorrente anual conhecido, sem hospedagem: R$ 28.660,00 (RN-FIN-13). */
export function knownRecurringAnnualCents(
  params: Pick<FinancialParams, 'monthlyCostsCents' | 'annualSiteMaintenanceCents'>,
): Cents {
  return annualCostsCents(params) + params.annualSiteMaintenanceCents;
}

/** Investimento inicial: R$ 17.200,00 (Quadro 3). */
export function initialInvestmentTotalCents(
  params: Pick<FinancialParams, 'initialInvestmentCents'>,
): Cents {
  const i = params.initialInvestmentCents;
  return i.appAndSite + i.company + i.lawyer;
}

/** Aporte total dos sócios: investimento mais reserva = R$ 26.500,00 (RN-FIN-06). */
export function totalContributionCents(
  params: Pick<FinancialParams, 'initialInvestmentCents' | 'reserveCents'>,
): Cents {
  return initialInvestmentTotalCents(params) + params.reserveCents;
}

export function averageGrossFromParams(
  params: Pick<FinancialParams, 'planPricesCents' | 'planMix'>,
): Cents {
  return averageGrossPerSubscriberCents(params.planPricesCents, params.planMix);
}

export function averageNetFromParams(
  params: Pick<FinancialParams, 'planPricesCents' | 'planMix' | 'feesRate'>,
): Cents {
  return averageNetPerSubscriberCents(params.planPricesCents, params.planMix, params.feesRate);
}

/**
 * Receita líquida a partir da bruta: bruta x (1 - taxas). O arredondamento replica a tabela de referência
 * do plano (A.13), calculada em reais com ponto flutuante e fechada em 2 casas.
 */
export function netRevenueCents(grossCents: Cents, feesRate: number): Cents {
  return Math.round(Number(((grossCents / 100) * (1 - feesRate)).toFixed(2)) * 100);
}

/**
 * Ponto de equilíbrio (K10, RN-KPI-20): teto de (gastos mensais ÷ líquida média do plano).
 * Com os padrões: 2.355,00 ÷ 89,80 = 26,2, logo 27 assinantes.
 */
export function breakEvenSubscribers(
  params: Pick<FinancialParams, 'monthlyCostsCents' | 'planPricesCents' | 'planMix' | 'feesRate'>,
): number {
  const net = averageNetFromParams(params);
  return net <= 0 ? Infinity : Math.ceil(monthlyCostsTotalCents(params) / net);
}

/** A divisão exata antes do teto (26,2), para exibir a conta (AC-M10-01). */
export function breakEvenExact(
  params: Pick<FinancialParams, 'monthlyCostsCents' | 'planPricesCents' | 'planMix' | 'feesRate'>,
): number {
  const net = averageNetFromParams(params);
  return net <= 0 ? Infinity : monthlyCostsTotalCents(params) / net;
}

/** K11: assinantes que faltam para o ponto de equilíbrio. */
export function subscribersMissing(breakEven: number, subscribers: number): number {
  return Math.max(0, breakEven - subscribers);
}

// ===== Projeção =====

/** Assinantes = conversão x gratuitos acumulados, arredondado meio para cima (RN-FIN-24), em aritmética inteira. */
export function subscribersFor(conversionRate: number, cumulativeFree: number): number {
  const basisPoints = Math.round(conversionRate * 10000);
  return Math.floor((cumulativeFree * basisPoints + 5000) / 10000);
}

export interface ProjectionResult {
  scenario: ScenarioKey;
  conversionRate: number;
  rows: ProjectionRow[];
  /** Primeiro mês de um lucro que se mantém até o fim do horizonte. `null` se nunca. */
  firstProfitMonth: number | null;
  /** Primeiro mês com saldo do investimento maior ou igual a zero (K13). */
  paybackMonth: number | null;
  /** Maior prejuízo acumulado de operação (positivo), sem o investimento. */
  maxCumulativeLossCents: Cents;
  /** Mês do maior prejuízo acumulado. */
  maxCumulativeLossMonth: number | null;
  /** Aporte extra = max(0, maior prejuízo acumulado - reserva) (K14, RN-FIN-29). */
  extraContributionCents: Cents;
  firstYear: { grossRevenueCents: Cents; netRevenueCents: Cents; resultCents: Cents };
  month24BalanceCents: Cents;
  month24CumulativeResultCents: Cents;
}

/** Projeção mês a mês (RN-FIN-24). */
export function projectScenario(params: FinancialParams, scenario: ScenarioKey): ProjectionResult {
  const rate = params.scenarios[scenario];
  const avgGross = averageGrossFromParams(params);
  const baseCost = monthlyCostsTotalCents(params);
  const investment = initialInvestmentTotalCents(params);
  const series = params.cumulativeFreeUsersByMonth;
  const rows: ProjectionRow[] = [];
  let cumulative = 0;
  for (let month = 1; month <= PROJECTION_MONTHS; month += 1) {
    const cumulativeFree = series[month - 1] ?? series[series.length - 1] ?? 0;
    const previousFree = month === 1 ? 0 : (series[month - 2] ?? 0);
    const subscribers = subscribersFor(rate, cumulativeFree);
    const gross = subscribers * avgGross;
    const net = netRevenueCents(gross, params.feesRate);
    const costs =
      baseCost +
      (params.annualSiteMaintenanceMonths.includes(month) ? params.annualSiteMaintenanceCents : 0);
    const result = net - costs;
    cumulative += result;
    rows.push({
      month,
      newFreeUsers: Math.max(0, cumulativeFree - previousFree),
      cumulativeFreeUsers: cumulativeFree,
      subscribers,
      grossRevenueCents: gross,
      netRevenueCents: net,
      costsCents: costs,
      resultCents: result,
      cumulativeResultCents: cumulative,
      balanceCents: -investment + cumulative,
    });
  }
  return summarizeProjection(scenario, rate, rows, params.reserveCents);
}

function summarizeProjection(
  scenario: ScenarioKey,
  rate: number,
  rows: ProjectionRow[],
  reserveCents: Cents,
): ProjectionResult {
  let firstProfitMonth: number | null = null;
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if ((rows[i] as ProjectionRow).resultCents > 0) {
      firstProfitMonth = (rows[i] as ProjectionRow).month;
    } else {
      break;
    }
  }
  const payback = rows.find((r) => r.balanceCents >= 0);
  let minCumulative = 0;
  let minMonth: number | null = null;
  rows.forEach((r) => {
    if (r.cumulativeResultCents < minCumulative) {
      minCumulative = r.cumulativeResultCents;
      minMonth = r.month;
    }
  });
  const firstYearRows = rows.slice(0, 12);
  const last = rows[rows.length - 1] as ProjectionRow;
  const maxLoss = -minCumulative;
  return {
    scenario,
    conversionRate: rate,
    rows,
    firstProfitMonth,
    paybackMonth: payback ? payback.month : null,
    maxCumulativeLossCents: maxLoss,
    maxCumulativeLossMonth: minMonth,
    extraContributionCents: Math.max(0, maxLoss - reserveCents),
    firstYear: {
      grossRevenueCents: firstYearRows.reduce((s, r) => s + r.grossRevenueCents, 0),
      netRevenueCents: firstYearRows.reduce((s, r) => s + r.netRevenueCents, 0),
      resultCents: firstYearRows.reduce((s, r) => s + r.resultCents, 0),
    },
    month24BalanceCents: last.balanceCents,
    month24CumulativeResultCents: last.cumulativeResultCents,
  };
}

/** Os três cenários (3%, 5%, 7%). */
export function projectAllScenarios(
  params: FinancialParams,
): Record<ScenarioKey, ProjectionResult> {
  return {
    pessimistic: projectScenario(params, 'pessimistic'),
    base: projectScenario(params, 'base'),
    optimistic: projectScenario(params, 'optimistic'),
  };
}

// ===== Referência literal do plano (A.11, A.12) e tolerância =====

/** Marcos literais do documento, para exibir ao lado da projeção simulada (RN-FIN-27). */
export const PLAN_REFERENCE = {
  base: {
    firstProfitMonth: 7,
    paybackMonth: 14,
    subscribersByMonth: { 3: 5, 7: 33, 12: 85, 14: 110, 24: 212 } as Readonly<
      Record<number, number>
    >,
    firstYearGrossCents: 4_108_400,
    firstYearResultCents: 790_500,
    cumulativeMonth24Cents: 13_200_000,
    freeUsersMonth12: 1700,
  },
  pessimistic: { firstProfitMonth: 9, paybackMonth: 18, extraContributionCents: 270_000 },
  optimistic: { firstProfitMonth: 6, paybackMonth: 12 },
} as const;

/** Tolerância de aceite dos valores em reais: até 0,5% do valor de referência (RN-FIN-27). */
export function isWithinTolerance(actual: number, reference: number, tolerance = 0.005): boolean {
  if (reference === 0) {
    return actual === 0;
  }
  return Math.abs(actual - reference) / Math.abs(reference) <= tolerance;
}

// ===== Realizado (K01 a K11) =====

export interface RealizedFinance {
  subscribers: number;
  subscribersByPlan: Record<PaidPlanId, number>;
  grossRevenueCents: Cents;
  netRevenueCents: Cents;
  costsCents: Cents;
  resultCents: Cents;
  breakEven: number;
  missing: number;
  aboveBreakEven: boolean;
  /** Média bruta por assinante realizada (K06), `null` sem assinantes. */
  averageGrossCents: Cents | null;
  averageNetCents: Cents | null;
}

/**
 * Realizado do mês a partir da contagem de assinantes pagos por plano (K04 a K11).
 * No seed: 17 assinantes, bruta R$ 1.698,30, líquida R$ 1.511,49, gastos R$ 2.355,00,
 * resultado -R$ 843,51, faltam 10 (AC-M10-05).
 */
export function realizedFinance(
  params: FinancialParams,
  subscribersByPlan: Readonly<Record<PaidPlanId, number>>,
  options: { includeAnnualMaintenance?: boolean } = {},
): RealizedFinance {
  const subscribers =
    subscribersByPlan.essencial + subscribersByPlan.cuida + subscribersByPlan.sustenta;
  const gross =
    subscribersByPlan.essencial * params.planPricesCents.essencial +
    subscribersByPlan.cuida * params.planPricesCents.cuida +
    subscribersByPlan.sustenta * params.planPricesCents.sustenta;
  const net = netRevenueCents(gross, params.feesRate);
  const costs =
    monthlyCostsTotalCents(params) +
    (options.includeAnnualMaintenance ? params.annualSiteMaintenanceCents : 0);
  const breakEven = breakEvenSubscribers(params);
  return {
    subscribers,
    subscribersByPlan: { ...subscribersByPlan },
    grossRevenueCents: gross,
    netRevenueCents: net,
    costsCents: costs,
    resultCents: net - costs,
    breakEven,
    missing: subscribersMissing(breakEven, subscribers),
    aboveBreakEven: net >= costs,
    averageGrossCents: subscribers === 0 ? null : Math.round(gross / subscribers),
    averageNetCents: subscribers === 0 ? null : Math.round(net / subscribers),
  };
}

/** Conversão realizada (K03) = assinantes ÷ gratuitos acumulados x 100, com 1 casa. */
export function conversionRatePercent(subscribers: number, freeUsers: number): number | null {
  if (freeUsers === 0) {
    return null;
  }
  return Math.round((subscribers / freeUsers) * 1000) / 10;
}

/** Referências de conversão exibidas ao lado do realizado (RN-KPI-06). */
export const CONVERSION_REFERENCES: readonly number[] = [3, 5, 7];
