/**
 * Cotas mensais e valores avulsos por plano (docs/20-regras-planos-v2.md, decisão do dono em 06/11 e 11/11/2026). Funções
 * PURAS, sem Angular e sem relógio: o mês de referência vem de fora (do `Clock`, pela tela ou pelo serviço).
 *
 * - Tabela do docs/20: atendimento individual 0, 0, 2 e 4 sessões por mês; terapia de grupo 0, 0, 2 e 2 encontros por mês;
 *   capacitações incluídas nenhuma, 2 por mês [suposição], todas, todas; Cartão, conteúdos exclusivos e condições na rede do
 *   Essencial em diante; benefícios diferenciados na rede só no Sustenta.
 * - **Cotas mensais não acumulam** (docs/20): o que não foi usado no mês não passa para o seguinte.
 * - Cancelamento com menos de 24 h consome a cota (RN-ATD-16): a sessão `no_show` continua contando.
 * - Avulsos (docs/20, suposições): sessão R$ 120,00; encontro de terapia de grupo R$ 60,00 (só Cuida e Sustenta, além da
 *   cota); capacitação R$ 40,00 por encontro (qualquer cadastrado, em qualquer plano). Pagamento simulado.
 * - O desconto por plano na sessão (RN-ATD-05 antiga) deixou de existir: o que vale é a cota e o avulso.
 * - A cota de encontros conta os ENCONTROS do mês das atividades em que a pessoa está inscrita (não a inscrição): uma turma
 *   de terapia de grupo com dois encontros em novembro usa os 2 encontros da cota de novembro [suposição de protótipo].
 * - RN-PLN-19: nada aqui lê pontuação, faixa, alerta ou ARBE.
 */
import { Activity, ActivityEnrollment, ActivityKind } from '../models/groups';
import { CareSession } from '../models/care';
import { PlanId } from '../models/plans';
import { Cents, YearMonth } from '../models/primitives';

/** Limite mensal: um número de vezes ou `'all'` (todas as do mês). */
export type MonthlyLimit = number | 'all';

export interface PlanQuotas {
  /** Sessões de atendimento psicológico individual por mês. */
  individualSessionsPerMonth: number;
  /** Encontros de terapia de grupo por mês. */
  groupTherapyPerMonth: number;
  /** Encontros de capacitação incluídos por mês (`'all'` = todas as do mês). */
  trainingsPerMonth: MonthlyLimit;
  card: boolean;
  exclusiveContent: boolean;
  networkConditions: boolean;
  networkDifferentiated: boolean;
}

/** A tabela do docs/20, por plano. */
export const PLAN_QUOTAS: Readonly<Record<PlanId, PlanQuotas>> = {
  livre: {
    individualSessionsPerMonth: 0,
    groupTherapyPerMonth: 0,
    trainingsPerMonth: 0,
    card: false,
    exclusiveContent: false,
    networkConditions: false,
    networkDifferentiated: false,
  },
  essencial: {
    individualSessionsPerMonth: 0,
    groupTherapyPerMonth: 0,
    trainingsPerMonth: 2,
    card: true,
    exclusiveContent: true,
    networkConditions: true,
    networkDifferentiated: false,
  },
  cuida: {
    individualSessionsPerMonth: 2,
    groupTherapyPerMonth: 2,
    trainingsPerMonth: 'all',
    card: true,
    exclusiveContent: true,
    networkConditions: true,
    networkDifferentiated: false,
  },
  sustenta: {
    individualSessionsPerMonth: 4,
    groupTherapyPerMonth: 2,
    trainingsPerMonth: 'all',
    card: true,
    exclusiveContent: true,
    networkConditions: true,
    networkDifferentiated: true,
  },
};

/** O que se paga avulso. */
export type SingleItemKind = 'individual_session' | 'group_therapy' | 'training';

/** Valores de referência dos avulsos, em centavos (docs/20, suposições; editáveis aqui). */
export const SINGLE_PRICES_CENTS: Readonly<Record<SingleItemKind, Cents>> = {
  individual_session: 12000,
  group_therapy: 6000,
  training: 4000,
};

/** "R$ 40,00 por encontro", "R$ 120,00 por sessão" (sem depender do módulo de formato: centavos inteiros). */
export function singlePriceText(kind: SingleItemKind, prices: Readonly<Record<SingleItemKind, Cents>> = SINGLE_PRICES_CENTS): string {
  const unit = kind === 'individual_session' ? 'sessão' : 'encontro';
  return `${formatCentsBr(prices[kind])} por ${unit}`;
}

/** "R$ 1.234,56" a partir de centavos (puro, sem o módulo de formato). */
export function formatCentsBr(cents: Cents): string {
  const abs = Math.abs(Math.round(cents));
  const reais = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${reais},${String(abs % 100).padStart(2, '0')}`;
}

export interface QuotaUsage {
  limit: MonthlyLimit;
  used: number;
  /** O que ainda cabe no mês; `'all'` quando não há limite. */
  left: MonthlyLimit;
}

/** O que sobra da cota no mês: nunca negativo; `'all'` quando não há limite. */
export function quotaLeft(limit: MonthlyLimit, used: number): MonthlyLimit {
  return limit === 'all' ? 'all' : Math.max(0, limit - used);
}

function usage(limit: MonthlyLimit, used: number): QuotaUsage {
  return { limit, used, left: quotaLeft(limit, used) };
}

/** Mês (`YYYY-MM`) de uma data ou instante ISO. */
export function monthOf(value: string): YearMonth {
  return value.slice(0, 7);
}

/** Sessões que ocupam a cota: agendada, confirmada, realizada e falta (a cancelada com 24 h ou mais devolve a cota). */
export const QUOTA_SESSION_STATUSES: readonly CareSession['status'][] = ['scheduled', 'confirmed', 'done', 'no_show'];

type SessionForQuota = Pick<CareSession, 'startAt' | 'status' | 'includedInPlan'>;

/** Quantas sessões incluídas no plano a pessoa usou no mês (RN-ATD-16: a falta por cancelar tarde continua contando). */
export function sessionsUsedInMonth(month: YearMonth, sessions: readonly SessionForQuota[]): number {
  return sessions.filter(
    (s) => s.includedInPlan === true && QUOTA_SESSION_STATUSES.includes(s.status) && monthOf(s.startAt) === month,
  ).length;
}

/** Cota de sessões individuais do plano no mês: limite, usadas e o que resta. */
export function individualSessionQuota(planId: PlanId, month: YearMonth, sessions: readonly SessionForQuota[]): QuotaUsage {
  return usage(PLAN_QUOTAS[planId].individualSessionsPerMonth, sessionsUsedInMonth(month, sessions));
}

/** O plano deixa agendar sessão individual (Cuida e Sustenta)? */
export function canBookIndividualSession(planId: PlanId): boolean {
  return PLAN_QUOTAS[planId].individualSessionsPerMonth > 0;
}

/** Quantos encontros da atividade caem no mês. */
export function meetingsInMonth(activity: Pick<Activity, 'meetings'>, month: YearMonth): number {
  return activity.meetings.filter((m) => monthOf(m.startAt) === month).length;
}

/** Inscrições que ocupam a cota: quem está (ou esteve) na turma; lista de espera e cancelada não contam. */
export const QUOTA_ENROLLMENT_STATUSES: readonly ActivityEnrollment['status'][] = ['enrolled', 'attended', 'absent'];

type EnrollmentForQuota = Pick<ActivityEnrollment, 'activityId' | 'status' | 'includedInPlan'>;
type ActivityForQuota = Pick<Activity, 'id' | 'kind' | 'meetings'>;

/** Encontros do tipo, no mês, das atividades incluídas no plano em que a pessoa está inscrita. */
export function meetingsUsedInMonth(
  month: YearMonth,
  kind: ActivityKind,
  enrollments: readonly EnrollmentForQuota[],
  activities: readonly ActivityForQuota[],
): number {
  return enrollments
    .filter((e) => e.includedInPlan === true && QUOTA_ENROLLMENT_STATUSES.includes(e.status))
    .reduce((sum, e) => {
      const activity = activities.find((a) => a.id === e.activityId);
      return activity && activity.kind === kind ? sum + meetingsInMonth(activity, month) : sum;
    }, 0);
}

/** Cota de encontros de terapia de grupo no mês. */
export function groupTherapyQuota(
  planId: PlanId,
  month: YearMonth,
  enrollments: readonly EnrollmentForQuota[],
  activities: readonly ActivityForQuota[],
): QuotaUsage {
  return usage(PLAN_QUOTAS[planId].groupTherapyPerMonth, meetingsUsedInMonth(month, 'group_therapy', enrollments, activities));
}

/** Cota de encontros de capacitação incluídos no mês. */
export function trainingQuota(
  planId: PlanId,
  month: YearMonth,
  enrollments: readonly EnrollmentForQuota[],
  activities: readonly ActivityForQuota[],
): QuotaUsage {
  return usage(PLAN_QUOTAS[planId].trainingsPerMonth, meetingsUsedInMonth(month, 'training', enrollments, activities));
}

/** O que a inscrição vai custar e se consome cota, decidido ANTES de gravar (a tela mostra e o serviço confirma). */
export interface EnrollmentOffer {
  /** `blocked`: o plano não inclui o tipo (terapia de grupo no Livre e no Essencial). */
  kind: 'included' | 'paid' | 'free' | 'blocked';
  /** Encontros da atividade no mês de referência (o que a cota cobre ou o que se paga). */
  meetings: number;
  priceCents: Cents;
  /** Cota do tipo no mês, antes desta inscrição (`null` na roda aberta). */
  usage: QuotaUsage | null;
  month: YearMonth;
}

/**
 * Decide a oferta de uma inscrição (docs/20): roda aberta é grátis e sem cota; terapia de grupo só Cuida e Sustenta, dentro
 * da cota incluída, além dela avulsa a R$ 60,00 o encontro; capacitação incluída quando os encontros do mês cabem na cota,
 * senão avulsa a R$ 40,00 o encontro (qualquer plano). O mês de referência é o do próximo encontro da atividade.
 */
export function enrollmentOffer(
  planId: PlanId,
  activity: ActivityForQuota,
  month: YearMonth,
  enrollments: readonly EnrollmentForQuota[],
  activities: readonly ActivityForQuota[],
  prices: Readonly<Record<SingleItemKind, Cents>> = SINGLE_PRICES_CENTS,
): EnrollmentOffer {
  const meetings = meetingsInMonth(activity, month);
  if (activity.kind === 'open_circle') {
    return { kind: 'free', meetings, priceCents: 0, usage: null, month };
  }
  if (activity.kind === 'group_therapy') {
    if (PLAN_QUOTAS[planId].groupTherapyPerMonth === 0) {
      return { kind: 'blocked', meetings, priceCents: 0, usage: null, month };
    }
    const quota = groupTherapyQuota(planId, month, enrollments, activities);
    return fits(quota, meetings)
      ? { kind: 'included', meetings, priceCents: 0, usage: quota, month }
      : { kind: 'paid', meetings, priceCents: meetings * prices.group_therapy, usage: quota, month };
  }
  const quota = trainingQuota(planId, month, enrollments, activities);
  return fits(quota, meetings)
    ? { kind: 'included', meetings, priceCents: 0, usage: quota, month }
    : { kind: 'paid', meetings, priceCents: meetings * prices.training, usage: quota, month };
}

/** Os encontros cabem no que resta da cota (uma atividade sem encontro no mês cabe sempre)? */
function fits(quota: QuotaUsage, meetings: number): boolean {
  return quota.left === 'all' || meetings <= quota.left;
}

/** "Neste mês: 1 de 2 sessões usadas"; com limite `'all'`, "Neste mês: todas as capacitações incluídas". */
export function quotaSentence(quota: QuotaUsage, noun: 'sessões' | 'encontros' | 'capacitações'): string {
  if (quota.limit === 'all') {
    return `Neste mês: todas as ${noun} incluídas`;
  }
  return `Neste mês: ${quota.used} de ${quota.limit} ${noun} usad${noun === 'encontros' ? 'os' : 'as'}`;
}

/** "Incluída no seu plano (1 de 2 neste mês)": o que a tela diz quando a sessão ou o encontro cabe na cota. */
export function includedSentence(quota: QuotaUsage, consumed = 1): string {
  if (quota.limit === 'all') {
    return 'Incluída no seu plano';
  }
  return `Incluída no seu plano (${Math.min(quota.limit, quota.used + consumed)} de ${quota.limit} neste mês)`;
}

/** "2 sessões por mês", "Todas as do mês", "Nenhuma" (quadro de planos). */
export function limitText(limit: MonthlyLimit, noun: 'sessões' | 'encontros' | 'capacitações'): string {
  if (limit === 'all') {
    return noun === 'capacitações' ? 'Todas as do mês' : 'Todos os do mês';
  }
  if (limit === 0) {
    return 'Não inclui';
  }
  const singular = noun === 'sessões' ? 'sessão' : noun === 'encontros' ? 'encontro' : 'capacitação';
  return `${limit} ${limit === 1 ? singular : noun} por mês`;
}
