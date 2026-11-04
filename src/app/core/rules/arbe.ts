/**
 * ARBE: Avaliação de Risco de Burnout e Esgotamento (RN-ARBE-01 a 10).
 * Cruza horas diárias de cuidado, pedidos de apoio e a última Zarit. Não é diagnóstico: é um sinal
 * para a escuta clínica; a decisão é do psicólogo (RN-ARBE-03).
 *
 * Limites padrão são SUPOSIÇÕES de protótipo (S-11), editáveis pelo `technical_lead`.
 */
import { addDays, compareDateTimes, dateOf } from '../clock/date-utils';
import { ISODate, ISODateTime } from '../models/primitives';
import { Message } from '../models/messages';
import { ArbeAlert, ArbeCriteria, ArbeSettings } from '../models/zarit';
import { addBusinessDays } from './sla';

export const DEFAULT_ARBE_SETTINGS: Readonly<ArbeSettings> = {
  hoursThreshold: 8,
  supportRequestsThreshold: 3,
  windowDays: 30,
  zaritThreshold: 41,
  criticalZarit: 61,
};

export interface ArbeInput {
  /** Horas diárias de cuidado (0 a 24). */
  dailyCareHours: number;
  /** Pedidos de apoio na janela (`countSupportRequests`). */
  supportRequestsInWindow: number;
  /** Última Zarit concluída; `null` se nunca aplicada. */
  lastZarit: number | null;
}

export interface ArbeEvaluation {
  level: 'attention' | 'critical';
  criteria: ArbeCriteria;
  metCount: number;
}

/** Avalia os 3 critérios. Devolve `null` quando não há alerta. */
export function evaluateArbe(
  input: ArbeInput,
  settings: ArbeSettings = DEFAULT_ARBE_SETTINGS,
): ArbeEvaluation | null {
  const criteria: ArbeCriteria = {
    hoursPerDay: {
      value: input.dailyCareHours,
      met: input.dailyCareHours >= settings.hoursThreshold,
    },
    supportRequests: {
      value: input.supportRequestsInWindow,
      met: input.supportRequestsInWindow >= settings.supportRequestsThreshold,
    },
    zarit: {
      value: input.lastZarit,
      met: input.lastZarit !== null && input.lastZarit >= settings.zaritThreshold,
    },
  };
  const metCount = [
    criteria.hoursPerDay.met,
    criteria.supportRequests.met,
    criteria.zarit.met,
  ].filter(Boolean).length;
  const critical =
    metCount === 3 || (input.lastZarit !== null && input.lastZarit >= settings.criticalZarit);
  if (critical) {
    return { level: 'critical', criteria, metCount };
  }
  if (metCount >= 2) {
    return { level: 'attention', criteria, metCount };
  }
  return null;
}

/** Pedidos de apoio do cuidador nos últimos `windowDays` dias (RN-USR-06, M11 "pedido de apoio"). */
export function countSupportRequests(
  messages: readonly Pick<
    Message,
    'caregiverId' | 'isSupportRequest' | 'receivedAt' | 'direction'
  >[],
  caregiverId: string,
  today: ISODate,
  windowDays: number,
): number {
  const from = addDays(today, -windowDays);
  return messages.filter(
    (m) =>
      m.caregiverId === caregiverId &&
      m.isSupportRequest &&
      m.direction === 'in' &&
      dateOf(m.receivedAt) > from &&
      dateOf(m.receivedAt) <= today,
  ).length;
}

/** `true` se o alerta ainda está em aberto (RN-ARBE-08). */
export function isArbeAlertOpen(alert: Pick<ArbeAlert, 'status'>): boolean {
  return (
    alert.status === 'generated' || alert.status === 'confirmed' || alert.status === 'contacted'
  );
}

/** Não se gera novo alerta enquanto houver um aberto do mesmo nível para o cuidador (RN-ARBE-08). */
export function shouldGenerateArbeAlert(
  existing: readonly Pick<ArbeAlert, 'caregiverId' | 'level' | 'status'>[],
  caregiverId: string,
  level: ArbeAlert['level'],
): boolean {
  return !existing.some(
    (a) => a.caregiverId === caregiverId && a.level === level && isArbeAlertOpen(a),
  );
}

/**
 * Prazo de referência para o contato do psicólogo quando NÃO há Zarit vermelha (RN-ARBE-06):
 * `critical` em até 1 dia útil; `attention` em até 5 dias úteis.
 */
export function arbeContactDeadline(level: ArbeAlert['level'], generatedAt: ISODateTime): ISODate {
  return addBusinessDays(dateOf(generatedAt), level === 'critical' ? 1 : 5);
}

/** Contato atrasado em relação ao prazo de referência. */
export function isArbeContactLate(
  alert: Pick<ArbeAlert, 'level' | 'generatedAt' | 'status'>,
  now: ISODateTime,
): boolean {
  if (alert.status === 'contacted' || alert.status === 'closed' || alert.status === 'discarded') {
    return false;
  }
  const deadline = arbeContactDeadline(alert.level, alert.generatedAt);
  return compareDateTimes(now, `${deadline}T23:59:00-03:00`) > 0;
}
