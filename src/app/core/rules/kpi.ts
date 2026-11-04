/**
 * Indicadores do quadro de indicadores (escopo, seção 7, K01 a K40). Funções PURAS sobre listas de
 * entidades: o chamador (feature de painel) lê dos repositórios e aplica o RBAC.
 *
 * Indicador clínico para `partner`/`support` é SEMPRE agregado com mínimo de 5 (`privacy/aggregation`).
 */
import { Aggregate, MIN_GROUP_SIZE, aggregateDistribution } from '../privacy/aggregation';
import { ISODate, ISODateTime } from '../models/primitives';
import { ArbeAlert, ZaritAlert, ZaritBand } from '../models/zarit';
import { Subscription, PaidPlanId } from '../models/plans';
import { Caregiver } from '../models/caregivers';
import { Activity, ActivityEnrollment } from '../models/groups';
import { ArpBand, ArpSnapshot } from '../models/network';
import { Complaint } from '../models/messages';
import { DataSubjectRequest } from '../models/lgpd';
import { Pop, RiskItem } from '../models/governance';
import { PilotEnrollment } from '../models/finance';
import { compareDates, dateOf, daysBetween, epochMs } from '../clock/date-utils';
import { mean, percentOf, roundHalfUp } from './numbers';
import { zaritBand } from './zarit';
import { riskCriticality, isPriorityRisk } from './governance';
import { dsrDeadlineState } from './lgpd';

// ===== Comercial =====

export interface SubscriberCounts {
  total: number;
  byPlan: Record<PaidPlanId, number>;
  /** Assinaturas de colaboradores pagas por empresa (contam como assinante, RN-CORP-07). */
  corporate: number;
}

/** K01: assinaturas pagas `active` ou `cancel_scheduled` (inclui as pagas por empresa). */
export function countSubscribers(
  subscriptions: readonly Pick<Subscription, 'planId' | 'status' | 'payer'>[],
): SubscriberCounts {
  const byPlan: Record<PaidPlanId, number> = { essencial: 0, cuida: 0, sustenta: 0 };
  let corporate = 0;
  subscriptions.forEach((s) => {
    if (s.planId !== 'livre' && (s.status === 'active' || s.status === 'cancel_scheduled')) {
      byPlan[s.planId] += 1;
      if (s.payer === 'corporate') {
        corporate += 1;
      }
    }
  });
  return { total: byPlan.essencial + byPlan.cuida + byPlan.sustenta, byPlan, corporate };
}

/** K02: usuários gratuitos acumulados = cadastros que não foram encerrados (RN-KPI-04). */
export function countFreeUsers(caregivers: readonly Pick<Caregiver, 'status'>[]): number {
  return caregivers.filter((c) => c.status !== 'closed').length;
}

// ===== Cuidadores (sempre agregados) =====

const ZARIT_BAND_KEYS: readonly ZaritBand[] = [
  'absent_or_small',
  'moderate',
  'moderate_to_severe',
  'severe',
];

/** K15: distribuição da ÚLTIMA Zarit de cada cuidador elegível, com mínimo de 5 por faixa. */
export function zaritDistribution(
  latestTotals: readonly number[],
  min: number = MIN_GROUP_SIZE,
): Record<ZaritBand, Aggregate<number>> {
  const counts: Partial<Record<ZaritBand, number>> = {};
  latestTotals.forEach((total) => {
    const band = zaritBand(total);
    counts[band] = (counts[band] ?? 0) + 1;
  });
  return aggregateDistribution(ZARIT_BAND_KEYS, counts, min);
}

/** Contagem exata por faixa (uso interno e testes; NUNCA exibir a `partner`). */
export function zaritBandCounts(latestTotals: readonly number[]): Record<ZaritBand, number> {
  const counts: Record<ZaritBand, number> = {
    absent_or_small: 0,
    moderate: 0,
    moderate_to_severe: 0,
    severe: 0,
  };
  latestTotals.forEach((t) => {
    counts[zaritBand(t)] += 1;
  });
  return counts;
}

/**
 * K16: evolução média (%) entre cuidadores com 2 ou mais aplicações e adesão maior que 0.
 * `series` é a lista de totais de um cuidador, da adesão para a mais recente.
 */
export function averageEvolutionPercent(series: readonly (readonly number[])[]): number | null {
  const evolutions = series
    .filter((totals) => totals.length >= 2 && (totals[0] as number) > 0)
    .map(
      (totals) =>
        (((totals[totals.length - 1] as number) - (totals[0] as number)) / (totals[0] as number)) *
        100,
    );
  const average = mean(evolutions);
  return average === null ? null : roundHalfUp(average, 1);
}

/** K17: alertas de Zarit abertos por nível. */
export function openZaritAlertsByLevel(alerts: readonly Pick<ZaritAlert, 'level' | 'status'>[]): {
  yellow: number;
  red: number;
} {
  const open = alerts.filter((a) => a.status !== 'closed');
  return {
    yellow: open.filter((a) => a.level === 'yellow').length,
    red: open.filter((a) => a.level === 'red').length,
  };
}

/** K19: ARBE abertos por nível (exclui `closed` e `discarded`). */
export function openArbeByLevel(alerts: readonly Pick<ArbeAlert, 'level' | 'status'>[]): {
  attention: number;
  critical: number;
} {
  const open = alerts.filter((a) => a.status !== 'closed' && a.status !== 'discarded');
  return {
    attention: open.filter((a) => a.level === 'attention').length,
    critical: open.filter((a) => a.level === 'critical').length,
  };
}

// ===== Rede =====

/** K23: prestadores por faixa, pelo ÚLTIMO instantâneo da auditoria de cada um. */
export function providersByBand(snapshots: readonly ArpSnapshot[]): Record<ArpBand, number> {
  const latest = new Map<string, ArpSnapshot>();
  snapshots.forEach((s) => {
    const current = latest.get(s.providerId);
    if (!current || compareDates(s.auditDate, current.auditDate) > 0) {
      latest.set(s.providerId, s);
    }
  });
  const result: Record<ArpBand, number> = {
    excellence: 0,
    alert: 0,
    deaccreditation: 0,
    no_average: 0,
  };
  latest.forEach((s) => {
    result[s.band] += 1;
  });
  return result;
}

// ===== Grupos =====

export interface ParticipationStat {
  activityId: string;
  capacity: number;
  enrolled: number;
  present: number;
  /** Presença % = presentes ÷ inscritos x 100. */
  attendancePercent: number | null;
  /** Preenchimento % = inscritos ÷ vagas x 100. */
  fillPercent: number | null;
}

/** K28: participação (RN-KPI-08). Inscritos = enrolled, attended e absent; lista de espera e cancelados não contam. */
export function participationStats(
  activities: readonly Pick<Activity, 'id' | 'capacity'>[],
  enrollments: readonly Pick<ActivityEnrollment, 'activityId' | 'status'>[],
): ParticipationStat[] {
  return activities.map((activity) => {
    const mine = enrollments.filter((e) => e.activityId === activity.id);
    const enrolled = mine.filter(
      (e) => e.status === 'enrolled' || e.status === 'attended' || e.status === 'absent',
    ).length;
    const present = mine.filter((e) => e.status === 'attended').length;
    return {
      activityId: activity.id,
      capacity: activity.capacity,
      enrolled,
      present,
      attendancePercent: percentOf(present, enrolled, 1),
      fillPercent: percentOf(enrolled, activity.capacity, 1),
    };
  });
}

// ===== Reclamações =====

export interface ComplaintStats {
  received: number;
  open: number;
  resolved: number;
  /** Tempo médio até a 1ª resposta em horas corridas; `null` sem respostas. */
  averageFirstResponseHours: number | null;
}

/** K29: reclamações do mês (`month` no formato `YYYY-MM`). */
export function complaintStats(complaints: readonly Complaint[], month: string): ComplaintStats {
  const inMonth = complaints.filter((c) => dateOf(c.openedAt).startsWith(month));
  const hours = inMonth
    .map((c) => {
      const firstReply = c.events[0];
      return firstReply ? (epochMs(firstReply.at) - epochMs(c.openedAt)) / 3_600_000 : null;
    })
    .filter((h): h is number => h !== null);
  const avg = mean(hours);
  return {
    received: inMonth.length,
    open: inMonth.filter((c) => c.status === 'open' || c.status === 'in_progress').length,
    resolved: inMonth.filter(
      (c) => c.status === 'answered' || c.status === 'closed' || c.status === 'dismissed',
    ).length,
    averageFirstResponseHours: avg === null ? null : roundHalfUp(avg, 1),
  };
}

// ===== LGPD, governança =====

/** K33: solicitações do titular abertas, vencendo em breve (últimos 3 dias) e vencidas. */
export function dsrCounts(
  requests: readonly DataSubjectRequest[],
  today: ISODate,
  dueSoonDays = 3,
): { open: number; dueSoon: number; overdue: number } {
  let open = 0;
  let dueSoon = 0;
  let overdue = 0;
  requests.forEach((r) => {
    const state = dsrDeadlineState(r, today, dueSoonDays);
    if (r.status === 'open' || r.status === 'in_progress') {
      open += 1;
    }
    if (state === 'due_soon') {
      dueSoon += 1;
    }
    if (state === 'overdue') {
      overdue += 1;
    }
  });
  return { open, dueSoon, overdue };
}

/** K34: POPs a revisar (`due` e `revision_triggered`). */
export function popsToReview(pops: readonly Pick<Pop, 'reviewState'>[]): number {
  return pops.filter((p) => p.reviewState === 'due' || p.reviewState === 'revision_triggered')
    .length;
}

/** K35: riscos prioritários (C maior ou igual a 12). */
export function countPriorityRisks(
  risks: readonly Pick<RiskItem, 'probability' | 'impact'>[],
): number {
  return risks.filter((r) => isPriorityRisk(riskCriticality(r.probability, r.impact))).length;
}

// ===== Piloto =====

export interface PilotStats {
  cohort: number;
  /** Satisfação média 1 a 5. */
  satisfactionAverage: number | null;
  /** Recomendação % = "sim" ÷ respondentes x 100. */
  recommendationPercent: number | null;
  /** Variação média de horas semanais (final menos início). */
  weeklyHoursDeltaAverage: number | null;
}

/** K37, K38: tempo dedicado, satisfação e recomendação da coorte (RN-KPI-13, 14). */
export function pilotStats(
  enrollments: readonly Pick<
    PilotEnrollment,
    'satisfaction' | 'wouldRecommend' | 'weeklyHoursStart' | 'weeklyHoursEnd'
  >[],
): PilotStats {
  const satisfaction = enrollments
    .map((e) => e.satisfaction)
    .filter((v): v is NonNullable<typeof v> => v !== undefined);
  const recommend = enrollments
    .map((e) => e.wouldRecommend)
    .filter((v): v is boolean => v !== undefined);
  const deltas = enrollments
    .filter((e) => e.weeklyHoursStart !== undefined && e.weeklyHoursEnd !== undefined)
    .map((e) => (e.weeklyHoursEnd as number) - (e.weeklyHoursStart as number));
  const satAvg = mean(satisfaction);
  const deltaAvg = mean(deltas);
  return {
    cohort: enrollments.length,
    satisfactionAverage: satAvg === null ? null : roundHalfUp(satAvg, 2),
    recommendationPercent: percentOf(recommend.filter(Boolean).length, recommend.length, 1),
    weeklyHoursDeltaAverage: deltaAvg === null ? null : roundHalfUp(deltaAvg, 1),
  };
}

/** Meta de redução da Zarit do piloto atingida? (média da redução % entre adesão e 6 meses). */
export function pilotGoalReached(
  averageReductionPercent: number | null,
  goalPercent: number,
): boolean {
  return averageReductionPercent !== null && -averageReductionPercent >= goalPercent;
}

// ===== Uso do aplicativo (K31) =====

export interface UsageStats {
  users: number;
  /** % com 1 ou mais acesso em 30 dias. */
  activePercent: number | null;
  averageAccesses: number | null;
  averageDistinctFeatures: number | null;
}

export function appUsageStats(
  summaries: readonly { accesses30d: number; distinctFeatures: readonly string[] }[],
): UsageStats {
  const avgAccess = mean(summaries.map((s) => s.accesses30d));
  const avgFeatures = mean(summaries.map((s) => s.distinctFeatures.length));
  return {
    users: summaries.length,
    activePercent: percentOf(
      summaries.filter((s) => s.accesses30d >= 1).length,
      summaries.length,
      1,
    ),
    averageAccesses: avgAccess === null ? null : roundHalfUp(avgAccess, 1),
    averageDistinctFeatures: avgFeatures === null ? null : roundHalfUp(avgFeatures, 1),
  };
}

/** Dias desde o último evento (auxiliar). */
export function daysSince(date: ISODate, today: ISODate): number {
  return daysBetween(date, today);
}

/** Instante mais recente de uma lista. */
export function latestInstant(instants: readonly ISODateTime[]): ISODateTime | null {
  return instants.length === 0
    ? null
    : instants.reduce((a, b) => (epochMs(a) >= epochMs(b) ? a : b));
}
