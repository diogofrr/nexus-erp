/**
 * Piloto (MVP): resumo da coorte, janelas de coleta e metas (RN-PIL-03 a 10, K36 a K39, AC-M10-12 a 14).
 * Tudo agregado com mínimo de 5 por recorte (RN-KPI-02). O texto das telas fala em "indício", nunca em
 * "eficácia" (RN-ZRT-22, RN-PIL-07). Funções PURAS.
 */
import { ID } from '../models/primitives';
import {
  PilotConfig,
  PilotEnrollment,
  PilotWindow,
  PilotWindowName,
} from '../models/finance';
import { PlanId } from '../models/plans';
import { Aggregate, MIN_GROUP_SIZE, aggregateCount, aggregateValue } from '../privacy/aggregation';
import { evolutionAggregate } from './indicators';
import { mean, percentOf, roundHalfUp } from './numbers';

export const PILOT_WINDOW_NAMES: readonly PilotWindowName[] = ['enrollment', 'month3', 'month6'];

export const PILOT_WINDOW_LABELS: Readonly<Record<PilotWindowName, string>> = {
  enrollment: 'Adesão',
  month3: '3 meses',
  month6: '6 meses',
};

/** Os 7 indicadores do Quadro 10 (A.7), com instrumento e momento de coleta. */
export interface PilotIndicatorDef {
  key:
    | 'overload'
    | 'time'
    | 'usage'
    | 'satisfaction'
    | 'conversion'
    | 'willingness'
    | 'network';
  label: string;
  instrument: string;
  moment: string;
}

export const PILOT_INDICATORS: readonly PilotIndicatorDef[] = [
  {
    key: 'overload',
    label: 'Sobrecarga percebida',
    instrument: 'Escala de Sobrecarga do Cuidador de Zarit (Scazufca, 2002)',
    moment: 'Na adesão, aos 3 e aos 6 meses',
  },
  {
    key: 'time',
    label: 'Tempo dedicado à organização do cuidado',
    instrument: 'Horas semanais informadas pelo cuidador',
    moment: 'Início e final do piloto',
  },
  {
    key: 'usage',
    label: 'Uso do aplicativo',
    instrument: 'Acessos, funções usadas e frequência',
    moment: 'Contínuo',
  },
  {
    key: 'satisfaction',
    label: 'Satisfação e recomendação',
    instrument: 'Questionário e entrevista semiestruturada',
    moment: 'Final do piloto',
  },
  {
    key: 'conversion',
    label: 'Conversão para planos pagos',
    instrument: 'Usuários gratuitos que passam a assinar',
    moment: 'Contínuo',
  },
  {
    key: 'willingness',
    label: 'Disposição a pagar',
    instrument: 'Planos escolhidos e motivos',
    moment: 'Final do piloto',
  },
  {
    key: 'network',
    label: 'Avaliação da rede',
    instrument: 'Notas e comentários sobre os prestadores',
    moment: 'Contínuo',
  },
];

export interface PilotWindowStat {
  name: PilotWindowName;
  done: number;
  pending: number;
  missed: number;
}

export type PilotGoalStatus = 'reached' | 'not_reached' | 'insufficient';

export interface PilotGoalResult {
  status: PilotGoalStatus;
  /** Valor observado, quando o recorte tem pessoas suficientes. */
  value: number | null;
  goal: number;
}

export interface PilotSummary {
  cohort: number;
  windows: PilotWindowStat[];
  /** Zarit média em cada janela (só janelas com 5 ou mais cuidadores). */
  zaritMean: Record<PilotWindowName, Aggregate<number>>;
  /** Evolução média (%) da adesão até a aplicação mais recente. Negativo indica redução. */
  zaritEvolution: Aggregate<number | null>;
  /** Variação média das horas semanais (final menos início). */
  weeklyHoursDelta: Aggregate<number>;
  /** % com 1 ou mais acesso em 30 dias. */
  usageActive: Aggregate<number>;
  satisfaction: Aggregate<number>;
  recommendation: Aggregate<number>;
  /** Conversão da coorte (assinantes pagos ÷ coorte x 100). */
  conversion: { paid: number; total: number; percent: number | null };
  /** Planos escolhidos no final do piloto (contagem por plano, com mínimo de 5). */
  chosenPlans: Partial<Record<PlanId, Aggregate<number>>>;
  respondents: number;
  /** Nota média das avaliações da rede dadas pela coorte. */
  networkRating: Aggregate<number>;
  goals: {
    zaritReduction: PilotGoalResult;
    satisfaction: PilotGoalResult;
    conversion: PilotGoalResult;
  };
}

export interface PilotSummaryInput {
  enrollments: readonly PilotEnrollment[];
  /** Totais da Zarit de cada cuidador da coorte, da adesão para a mais recente. */
  zaritSeries: ReadonlyMap<ID, readonly number[]>;
  /** Acessos nos últimos 30 dias dos cuidadores da coorte. */
  usage: readonly { accesses30d: number }[];
  /** Cuidadores da coorte com assinatura paga ativa. */
  paidCaregiverIds: ReadonlySet<ID>;
  /** Nota (média das duas notas) de cada avaliação dada por alguém da coorte. */
  evaluationScores: readonly number[];
  goals: PilotConfig['goals'];
  min?: number;
}

/** Resumo do piloto. Cada indicador só aparece com `min` pessoas (5 por padrão). */
export function summarizePilot(input: PilotSummaryInput): PilotSummary {
  const min = input.min ?? MIN_GROUP_SIZE;
  const enrollments = input.enrollments;
  const windows: PilotWindowStat[] = PILOT_WINDOW_NAMES.map((name) => {
    const list: PilotWindow[] = enrollments
      .map((e) => e.windows.find((w) => w.name === name))
      .filter((w): w is PilotWindow => w !== undefined);
    return {
      name,
      done: list.filter((w) => w.status === 'done').length,
      pending: list.filter((w) => w.status === 'pending').length,
      missed: list.filter((w) => w.status === 'missed').length,
    };
  });

  const seriesList = enrollments
    .map((e) => input.zaritSeries.get(e.caregiverId))
    .filter((s): s is readonly number[] => s !== undefined && s.length > 0);
  const zaritAt = (index: number): number[] =>
    seriesList.filter((s) => s.length > index).map((s) => s[index] as number);
  const meanAggregate = (values: readonly number[], decimals: number): Aggregate<number> =>
    aggregateValue(
      values.length,
      () => roundHalfUp(mean(values) as number, decimals),
      min,
    );
  const zaritMean: Record<PilotWindowName, Aggregate<number>> = {
    enrollment: meanAggregate(zaritAt(0), 1),
    month3: meanAggregate(zaritAt(1), 1),
    month6: meanAggregate(zaritAt(2), 1),
  };
  const zaritEvolution = evolutionAggregate(seriesList, min);

  const deltas = enrollments
    .filter((e) => e.weeklyHoursStart !== undefined && e.weeklyHoursEnd !== undefined)
    .map((e) => (e.weeklyHoursEnd as number) - (e.weeklyHoursStart as number));
  const weeklyHoursDelta = meanAggregate(deltas, 1);

  const activeCount = input.usage.filter((u) => u.accesses30d >= 1).length;
  const usageActive = aggregateValue(
    input.usage.length,
    () => percentOf(activeCount, input.usage.length, 1) as number,
    min,
  );

  const satisfactionValues = enrollments
    .map((e) => e.satisfaction)
    .filter((v): v is NonNullable<typeof v> => v !== undefined);
  const satisfaction = meanAggregate(satisfactionValues, 2);
  const recommendValues = enrollments
    .map((e) => e.wouldRecommend)
    .filter((v): v is boolean => v !== undefined);
  const recommendation = aggregateValue(
    recommendValues.length,
    () => percentOf(recommendValues.filter(Boolean).length, recommendValues.length, 1) as number,
    min,
  );

  const paid = enrollments.filter((e) => input.paidCaregiverIds.has(e.caregiverId)).length;
  const conversion = { paid, total: enrollments.length, percent: percentOf(paid, enrollments.length, 1) };

  const planCounts: Partial<Record<PlanId, number>> = {};
  enrollments.forEach((e) => {
    if (e.chosenPlan) {
      planCounts[e.chosenPlan] = (planCounts[e.chosenPlan] ?? 0) + 1;
    }
  });
  const chosenPlans: Partial<Record<PlanId, Aggregate<number>>> = {};
  (Object.keys(planCounts) as PlanId[]).forEach((plan) => {
    chosenPlans[plan] = aggregateCount(planCounts[plan] as number, min);
  });

  const networkRating = aggregateValue(
    input.evaluationScores.length,
    () => roundHalfUp(mean(input.evaluationScores) as number, 2),
    min,
  );

  const goals = input.goals;
  const zaritGoal: PilotGoalResult = (() => {
    if (!zaritEvolution.sufficient || zaritEvolution.value === null) {
      return { status: 'insufficient', value: null, goal: goals.zaritReductionPercent };
    }
    const reduction = -zaritEvolution.value;
    return {
      status: reduction >= goals.zaritReductionPercent ? 'reached' : 'not_reached',
      value: reduction,
      goal: goals.zaritReductionPercent,
    };
  })();
  const satisfactionGoal: PilotGoalResult = satisfaction.sufficient
    ? {
        status: satisfaction.value >= goals.satisfactionMin ? 'reached' : 'not_reached',
        value: satisfaction.value,
        goal: goals.satisfactionMin,
      }
    : { status: 'insufficient', value: null, goal: goals.satisfactionMin };
  const conversionGoal: PilotGoalResult =
    conversion.percent === null || conversion.total < min
      ? { status: 'insufficient', value: null, goal: goals.conversionPercent }
      : {
          status: conversion.percent >= goals.conversionPercent ? 'reached' : 'not_reached',
          value: conversion.percent,
          goal: goals.conversionPercent,
        };

  return {
    cohort: enrollments.length,
    windows,
    zaritMean,
    zaritEvolution,
    weeklyHoursDelta,
    usageActive,
    satisfaction,
    recommendation,
    conversion,
    chosenPlans,
    respondents: satisfactionValues.length,
    networkRating,
    goals: { zaritReduction: zaritGoal, satisfaction: satisfactionGoal, conversion: conversionGoal },
  };
}

/** Meta editável direto antes do início; depois, só com justificativa registrada (RN-PIL-09, AC-M10-14). */
export function pilotGoalsEditableDirectly(config: Pick<PilotConfig, 'startedAt' | 'goalsLocked'>): boolean {
  return !config.goalsLocked && !config.startedAt;
}

export interface GoalChangeCheck {
  ok: boolean;
  message: string | null;
}

/** A justificativa da mudança de meta tem de ter texto de verdade (mínimo de 10 caracteres). */
export function checkGoalJustification(
  config: Pick<PilotConfig, 'startedAt' | 'goalsLocked'>,
  justification: string,
): GoalChangeCheck {
  if (pilotGoalsEditableDirectly(config)) {
    return { ok: true, message: null };
  }
  return justification.trim().length >= 10
    ? { ok: true, message: null }
    : { ok: false, message: 'Escreva a justificativa da mudança, com ao menos 10 caracteres.' };
}

/** Mês do piloto de um cuidador (1 a 6), a partir da data de entrada. */
export function pilotMonthOf(enrolledAt: string, today: string): number {
  const [ey, em, ed] = enrolledAt.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = today.split('-').map(Number) as [number, number, number];
  let months = (ty - ey) * 12 + (tm - em);
  if (td < ed) {
    months -= 1;
  }
  return Math.max(1, Math.min(6, months + 1));
}
