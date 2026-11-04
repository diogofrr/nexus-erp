/**
 * POP-05 (situações de risco) e alerta vermelho da Zarit: "contato no mesmo dia" (RN-ZRT-13 a 15,
 * RN-POP-05, RN-KPI-17). O prazo do vermelho é 23h59 do dia da aplicação; sem contato vira `overdue`
 * e é escalado ao responsável técnico.
 */
import { addDays, compareDateTimes, dateOf, endOfDay, minutesBetween } from '../clock/date-utils';
import { ISODate, ISODateTime } from '../models/primitives';
import { ZaritAlert } from '../models/zarit';
import { Occurrence, OccurrenceStep } from '../models/governance';
import { percentOf } from './numbers';

/** Gatilhos do POP-05 (RN-POP-05). */
export const POP05_TRIGGERS = [
  'Alerta vermelho da Zarit (61 a 88)',
  'ARBE crítico',
  'Relato de risco de suicídio ou sofrimento psíquico grave em atendimento, grupo ou canal de mensagens',
] as const;

/** Os 7 passos mínimos do POP-05 (RN-POP-05). */
export const POP05_STEPS: readonly string[] = [
  'Acolhimento imediato',
  'Contato da equipe no mesmo dia',
  'Avaliação de risco pelo psicólogo, com registro',
  'Se necessário, encaminhamento imediato à rede de urgência em saúde mental (CVV 188; SAMU 192 em emergência)',
  'Se o atendimento era remoto, encaminhamento à rede presencial',
  'Registro da ocorrência e do encaminhamento',
  'Acompanhamento posterior',
];

/** Passos do POP-07 (suspeita de violência contra a pessoa idosa, RN-POP-07). */
export const POP07_STEPS: readonly string[] = [
  'Registrar os sinais de alerta observados',
  'Informar imediatamente o responsável técnico',
  'Comunicar os órgãos competentes e registrar o protocolo',
  'Registrar a notificação compulsória',
  'Acompanhar a família sem abandonar quem cuida',
];

/** Órgãos de comunicação do POP-07 (RN-ENC-05). */
export const POP07_AUTHORITIES: readonly string[] = [
  'CREAS',
  'Disque 100',
  'Delegacia especializada',
  'Ministério Público',
  'Conselho Municipal da Pessoa Idosa',
];

/** Lembrete obrigatório do POP-07. */
export const POP07_REMINDER = 'Proteger a pessoa idosa sem abandonar quem cuida.';

/** Prazo do alerta vermelho: 23h59 do dia da aplicação (RN-ZRT-14). */
export function redAlertDeadline(appliedAt: ISODate): ISODateTime {
  return endOfDay(appliedAt);
}

export type RedAlertState = 'open' | 'overdue' | 'contacted' | 'risk_assessed' | 'closed';

/** Estado exibido do vermelho: `overdue` quando sem contato depois do prazo (derivado, RN-ZRT-24). */
export function redAlertState(
  alert: Pick<ZaritAlert, 'status' | 'deadlineAt' | 'contact'>,
  now: ISODateTime,
): RedAlertState {
  if (alert.status === 'closed') {
    return 'closed';
  }
  if (!alert.contact && alert.deadlineAt && compareDateTimes(now, alert.deadlineAt) > 0) {
    return 'overdue';
  }
  return alert.status;
}

/** Vermelho vencido sem contato: escalado ao responsável técnico (RN-ZRT-14, E-11). */
export function isEscalatedToTechnicalLead(
  alert: Pick<ZaritAlert, 'level' | 'status' | 'deadlineAt' | 'contact'>,
  now: ISODateTime,
): boolean {
  return alert.level === 'red' && redAlertState(alert, now) === 'overdue';
}

/** Minutos restantes até o prazo (negativo = vencido). Para o cronômetro. */
export function redAlertMinutesLeft(
  alert: Pick<ZaritAlert, 'deadlineAt'>,
  now: ISODateTime,
): number | null {
  if (!alert.deadlineAt) {
    return null;
  }
  return Math.round(minutesBetween(now, alert.deadlineAt));
}

/** O contato foi feito na mesma data civil da aplicação (RN-ZRT-14). */
export function isSameDayContact(appliedAt: ISODate, contactAt: ISODateTime): boolean {
  return dateOf(contactAt) === appliedAt;
}

export type RedAlertClosureField = 'contact_time' | 'contact_by' | 'risk_assessment' | 'referral';

export interface RedAlertClosureCheck {
  ok: boolean;
  /** Campos que faltam para encerrar (AC-M06-06). */
  missing: RedAlertClosureField[];
}

/**
 * RN-ZRT-15: não encerra sem horário do contato, quem fez, resultado da avaliação de risco e, se houve
 * necessidade de encaminhamento, o encaminhamento.
 */
export function checkRedAlertClosure(
  alert: Pick<ZaritAlert, 'contact' | 'riskAssessment' | 'referralIds'>,
  referralRequired: boolean,
): RedAlertClosureCheck {
  const missing: RedAlertClosureField[] = [];
  if (!alert.contact?.at) {
    missing.push('contact_time');
  }
  if (!alert.contact?.byUserId) {
    missing.push('contact_by');
  }
  if (!alert.riskAssessment?.level || !alert.riskAssessment.note) {
    missing.push('risk_assessment');
  }
  if (referralRequired && alert.referralIds.length === 0) {
    missing.push('referral');
  }
  return { ok: missing.length === 0, missing };
}

/** Ocorrência POP-05 só encerra com os passos 1 a 7 feitos, com hora e responsável (RN-POP-05). */
export function checkOccurrenceClosure(
  steps: readonly OccurrenceStep[],
  expected: readonly string[] = POP05_STEPS,
): { ok: boolean; pendingSteps: number[] } {
  const pendingSteps: number[] = [];
  for (let n = 1; n <= expected.length; n += 1) {
    const step = steps.find((s) => s.n === n);
    if (!step || !step.doneAt || !step.byUserId) {
      pendingSteps.push(n);
    }
  }
  return { ok: pendingSteps.length === 0, pendingSteps };
}

/** Ocorrência pode ser vista pelo usuário? Só o RT e o psicólogo do caso (RN-ENC-11). */
export function canViewOccurrence(
  occurrence: Pick<Occurrence, 'restrictedToUserIds'>,
  userId: string,
): boolean {
  return occurrence.restrictedToUserIds.includes(userId);
}

export interface SameDayContactStat {
  numerator: number;
  denominator: number;
  /** `null` se não há vermelho com prazo vencido na janela. */
  percent: number | null;
}

/**
 * K18 / RN-KPI-17: contato no mesmo dia = vermelhos com contato na mesma data da aplicação
 * ÷ vermelhos com prazo VENCIDO na janela (30 dias) x 100. O vermelho de hoje só entra depois das 23h59.
 * `appliedOf` informa a data de aplicação do alerta.
 */
export function sameDayContactRate(
  alerts: readonly Pick<ZaritAlert, 'level' | 'deadlineAt' | 'contact' | 'assessmentId'>[],
  appliedOf: (alert: Pick<ZaritAlert, 'assessmentId'>) => ISODate | undefined,
  now: ISODateTime,
  windowDays = 30,
): SameDayContactStat {
  const today = dateOf(now);
  const from = addDays(today, -windowDays);
  const eligible = alerts.filter((a) => {
    if (a.level !== 'red' || !a.deadlineAt || compareDateTimes(now, a.deadlineAt) <= 0) {
      return false;
    }
    const applied = appliedOf(a);
    return applied !== undefined && applied > from && applied <= today;
  });
  const numerator = eligible.filter((a) => {
    const applied = appliedOf(a);
    return (
      applied !== undefined && a.contact !== undefined && isSameDayContact(applied, a.contact.at)
    );
  }).length;
  return {
    numerator,
    denominator: eligible.length,
    percent: percentOf(numerator, eligible.length, 1),
  };
}
