/**
 * A nota de cuidado de Hoje e de Como estou (CXC-003, RN-ZRT-14 e 19, RN-CAN-03, RN-ETICA-15). Só duas frases do que a
 * equipe faz por você, em tom de convite: nunca "responsável técnica", "ainda não conseguiu falar com você", prazo,
 * "vencido" nem "alerta". Funções puras: recebem o instante, nunca leem o relógio.
 *
 * "Hoje" só aparece dentro do horário comercial (segunda a sexta, 8h às 18h, RN-CAN-03): fora dele a frase não promete
 * o que a equipe não vai cumprir, e diz "amanhã de manhã" ou "na segunda de manhã".
 */
import { addDays, dateOf, timeOf, weekday } from '../../../core/clock/date-utils';
import { ISODateTime } from '../../../core/models';
import { isBusinessDay, nextBusinessDay } from '../../../core/rules/sla';
import { BUSINESS_OPEN, isWithinBusinessHours } from './nexus-contact';

/** Nome do dia, para "na segunda de manhã" (de domingo a sábado). */
const WEEKDAY_NAMES: readonly string[] = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** Quando a equipe de psicologia fala com a pessoa: "hoje", "hoje de manhã", "amanhã de manhã" ou "na segunda de manhã". */
export function teamCallWhen(now: ISODateTime): string {
  if (isWithinBusinessHours(now)) {
    return 'hoje';
  }
  const today = dateOf(now);
  // Antes de a equipe abrir, num dia útil: ela ainda fala hoje, de manhã.
  if (isBusinessDay(today) && timeOf(now) < BUSINESS_OPEN) {
    return 'hoje de manhã';
  }
  const next = nextBusinessDay(today);
  if (next === addDays(today, 1)) {
    return 'amanhã de manhã';
  }
  return `na ${WEEKDAY_NAMES[weekday(next)] ?? 'próxima semana'} de manhã`;
}

/** "A equipe de psicologia vai falar com você hoje." (ou "amanhã de manhã", "na segunda de manhã"). */
export function careTodayHeading(now: ISODateTime): string {
  return `A equipe de psicologia vai falar com você ${teamCallWhen(now)}.`;
}

/** O que a pessoa precisa saber depois do título, em uma linha. */
export const CARE_TODAY_TEXT = 'Você não precisa fazer nada.';

/** Contato que ainda não aconteceu: um convite, sem culpa e sem alarme. */
export const CARE_INVITE_HEADING = 'Queremos falar com você.';
export const CARE_INVITE_TEXT = 'Se quiser, fale com a gente agora.';
/** A mesma nota numa frase só (Como estou). */
export const CARE_INVITE = `${CARE_INVITE_HEADING} ${CARE_INVITE_TEXT}`;
