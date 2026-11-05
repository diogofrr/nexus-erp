/**
 * Parâmetros financeiros editáveis (M10, SCR-M10-03): validação, comparação com os valores do plano e
 * exportação da projeção. RN-FIN-24 a 27, AC-M10-06. Funções PURAS, sem Angular e sem relógio.
 */
import { FinancialParams } from '../models/finance';
import { PaidPlanId } from '../models/plans';
import { PROJECTION_MONTHS, ProjectionResult, DEFAULT_FINANCIAL_PARAMS } from './finance';

export interface ParamIssue {
  /** Caminho do campo (`planMix`, `planPricesCents.essencial`, `cumulativeFreeUsersByMonth.5`). */
  path: string;
  /** Frase de erro no vocabulário do rótulo (catálogo de mensagens, sem "inválido"). */
  message: string;
}

const PAID: readonly PaidPlanId[] = ['essencial', 'cuida', 'sustenta'];

/** Soma das participações dos planos em pontos-base (10000 = 100%), sem o erro do ponto flutuante. */
export function mixTotalBasisPoints(mix: Readonly<Record<PaidPlanId, number>>): number {
  return PAID.reduce((sum, plan) => sum + Math.round((mix[plan] ?? 0) * 10000), 0);
}

/** Soma das participações em porcentagem, com 1 casa: 0,4 + 0,3 + 0,3 resulta 100. */
export function mixTotalPercent(mix: Readonly<Record<PaidPlanId, number>>): number {
  return mixTotalBasisPoints(mix) / 100;
}

function isCents(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * Valida os parâmetros. Devolve uma lista vazia quando está tudo certo. As frases seguem o catálogo de erros:
 * dizem o que houve e como resolver ("As participações dos planos precisam somar 100%. Hoje somam 90%.").
 */
export function validateFinancialParams(params: FinancialParams): ParamIssue[] {
  const issues: ParamIssue[] = [];
  const labels: Record<PaidPlanId, string> = {
    essencial: 'Essencial',
    cuida: 'Cuida',
    sustenta: 'Sustenta',
  };
  PAID.forEach((plan) => {
    const price = params.planPricesCents[plan];
    if (!Number.isInteger(price) || price <= 0) {
      issues.push({
        path: `planPricesCents.${plan}`,
        message: `Informe o preço do plano ${labels[plan]}, maior que zero.`,
      });
    }
    const share = params.planMix[plan];
    if (typeof share !== 'number' || share < 0 || share > 1) {
      issues.push({
        path: `planMix.${plan}`,
        message: `A participação do plano ${labels[plan]} deve ser de 0% a 100%.`,
      });
    }
  });
  const total = mixTotalPercent(params.planMix);
  if (total !== 100) {
    const shown = String(total).replace('.', ',');
    issues.push({
      path: 'planMix',
      message: `As participações dos planos precisam somar 100%. Hoje somam ${shown}%.`,
    });
  }
  if (typeof params.feesRate !== 'number' || params.feesRate < 0 || params.feesRate >= 0.5) {
    issues.push({
      path: 'feesRate',
      message: 'A taxa de impostos e plataformas deve ser de 0% a menos de 50%.',
    });
  }
  const costLabels: Record<keyof FinancialParams['monthlyCostsCents'], string> = {
    coworking: 'o coworking',
    appMaintenance: 'a manutenção do aplicativo',
    accounting: 'a contabilidade',
    travel: 'os deslocamentos',
  };
  (Object.keys(costLabels) as (keyof typeof costLabels)[]).forEach((key) => {
    if (!isCents(params.monthlyCostsCents[key])) {
      issues.push({
        path: `monthlyCostsCents.${key}`,
        message: `Informe o gasto mensal com ${costLabels[key]}.`,
      });
    }
  });
  if (!isCents(params.annualSiteMaintenanceCents)) {
    issues.push({
      path: 'annualSiteMaintenanceCents',
      message: 'Informe a manutenção anual do site.',
    });
  }
  const months = params.annualSiteMaintenanceMonths;
  if (
    !Array.isArray(months) ||
    months.some((m) => !Number.isInteger(m) || m < 1 || m > PROJECTION_MONTHS)
  ) {
    issues.push({
      path: 'annualSiteMaintenanceMonths',
      message: `Os meses da manutenção do site devem ser números de 1 a ${PROJECTION_MONTHS}.`,
    });
  }
  if (params.hostingAnnualCents !== null && !isCents(params.hostingAnnualCents)) {
    issues.push({
      path: 'hostingAnnualCents',
      message: 'Informe o valor da hospedagem ou deixe como "a confirmar".',
    });
  }
  const investLabels: Record<keyof FinancialParams['initialInvestmentCents'], string> = {
    appAndSite: 'o aplicativo e o site',
    company: 'a abertura da empresa',
    lawyer: 'o advogado',
  };
  (Object.keys(investLabels) as (keyof typeof investLabels)[]).forEach((key) => {
    if (!isCents(params.initialInvestmentCents[key])) {
      issues.push({
        path: `initialInvestmentCents.${key}`,
        message: `Informe o investimento com ${investLabels[key]}.`,
      });
    }
  });
  if (!isCents(params.reserveCents)) {
    issues.push({ path: 'reserveCents', message: 'Informe o valor da reserva dos sócios.' });
  }
  const series = params.cumulativeFreeUsersByMonth;
  if (!Array.isArray(series) || series.length !== PROJECTION_MONTHS) {
    issues.push({
      path: 'cumulativeFreeUsersByMonth',
      message: `A série de usuários gratuitos precisa ter ${PROJECTION_MONTHS} meses.`,
    });
  } else {
    series.forEach((value, index) => {
      if (!Number.isInteger(value) || value < 0) {
        issues.push({
          path: `cumulativeFreeUsersByMonth.${index}`,
          message: `Informe os usuários gratuitos acumulados do mês ${index + 1}, um número inteiro.`,
        });
      } else if (index > 0 && value < (series[index - 1] as number)) {
        issues.push({
          path: `cumulativeFreeUsersByMonth.${index}`,
          message: `O acumulado do mês ${index + 1} não pode ser menor que o do mês ${index}.`,
        });
      }
    });
  }
  (Object.keys(params.scenarios) as (keyof FinancialParams['scenarios'])[]).forEach((key) => {
    const rate = params.scenarios[key];
    if (typeof rate !== 'number' || rate < 0 || rate > 1) {
      issues.push({
        path: `scenarios.${key}`,
        message: 'A conversão do cenário deve ser de 0% a 100%.',
      });
    }
  });
  return issues;
}

/**
 * Caminhos dos campos que diferem dos valores do plano (para o selo "alterado" e a faixa "Parâmetros
 * diferentes do plano"). Campos agrupados vêm um a um (`planPricesCents.essencial`); a série de gratuitos
 * vem como `cumulativeFreeUsersByMonth` quando algum mês mudou.
 */
export function changedFinancialParamPaths(
  params: FinancialParams,
  reference: Readonly<FinancialParams> = DEFAULT_FINANCIAL_PARAMS,
): string[] {
  const changed: string[] = [];
  PAID.forEach((plan) => {
    if (params.planPricesCents[plan] !== reference.planPricesCents[plan]) {
      changed.push(`planPricesCents.${plan}`);
    }
    if (Math.round(params.planMix[plan] * 10000) !== Math.round(reference.planMix[plan] * 10000)) {
      changed.push(`planMix.${plan}`);
    }
  });
  if (Math.round(params.feesRate * 10000) !== Math.round(reference.feesRate * 10000)) {
    changed.push('feesRate');
  }
  (Object.keys(reference.monthlyCostsCents) as (keyof FinancialParams['monthlyCostsCents'])[]).forEach(
    (key) => {
      if (params.monthlyCostsCents[key] !== reference.monthlyCostsCents[key]) {
        changed.push(`monthlyCostsCents.${key}`);
      }
    },
  );
  if (params.annualSiteMaintenanceCents !== reference.annualSiteMaintenanceCents) {
    changed.push('annualSiteMaintenanceCents');
  }
  if (
    [...params.annualSiteMaintenanceMonths].sort().join(',') !==
    [...reference.annualSiteMaintenanceMonths].sort().join(',')
  ) {
    changed.push('annualSiteMaintenanceMonths');
  }
  if (params.hostingAnnualCents !== reference.hostingAnnualCents) {
    changed.push('hostingAnnualCents');
  }
  (
    Object.keys(reference.initialInvestmentCents) as (keyof FinancialParams['initialInvestmentCents'])[]
  ).forEach((key) => {
    if (params.initialInvestmentCents[key] !== reference.initialInvestmentCents[key]) {
      changed.push(`initialInvestmentCents.${key}`);
    }
  });
  if (params.reserveCents !== reference.reserveCents) {
    changed.push('reserveCents');
  }
  if (params.cumulativeFreeUsersByMonth.join(',') !== reference.cumulativeFreeUsersByMonth.join(',')) {
    changed.push('cumulativeFreeUsersByMonth');
  }
  (Object.keys(reference.scenarios) as (keyof FinancialParams['scenarios'])[]).forEach((key) => {
    if (Math.round(params.scenarios[key] * 10000) !== Math.round(reference.scenarios[key] * 10000)) {
      changed.push(`scenarios.${key}`);
    }
  });
  return changed;
}

/** Centavos como número de planilha em pt-BR, sem símbolo: `123456` vira `1234,56`. */
function sheetNumber(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
}

/**
 * CSV da projeção (SCR-M10-08): separador `;`, decimal com vírgula, valores em reais. Não traz dado pessoal.
 * Começa com BOM para o Excel abrir os acentos. Sempre rotulado como estimativa do plano (RN-FIN-32).
 */
export function projectionToCsv(result: ProjectionResult): string {
  const header = [
    'Mês',
    'Novos gratuitos',
    'Gratuitos acumulados',
    'Assinantes',
    'Receita bruta (R$)',
    'Receita líquida (R$)',
    'Gastos (R$)',
    'Resultado do mês (R$)',
    'Resultado acumulado (R$)',
    'Saldo do investimento (R$)',
    'Origem',
  ];
  const lines = result.rows.map((row) =>
    [
      row.month,
      row.newFreeUsers,
      row.cumulativeFreeUsers,
      row.subscribers,
      sheetNumber(row.grossRevenueCents),
      sheetNumber(row.netRevenueCents),
      sheetNumber(row.costsCents),
      sheetNumber(row.resultCents),
      sheetNumber(row.cumulativeResultCents),
      sheetNumber(row.balanceCents),
      'estimativa do plano',
    ].join(';'),
  );
  return `﻿${[header.join(';'), ...lines].join('\r\n')}\r\n`;
}
