import { CareSession, SessionModality, SessionStatus } from '@core/models';
import type { BadgeVariant, IconName } from '@shared/ui';

/** Textos de tela da agenda e das sessões (pt-BR, tom da marca, sem jargão clínico). */

export const MODALITY_LABELS: Readonly<Record<SessionModality, string>> = {
  online: 'On-line',
  in_person_coworking: 'Presencial no coworking',
  in_person_home: 'Presencial em domicílio',
};

export const MODALITY_SHORT: Readonly<Record<SessionModality, string>> = {
  online: 'On-line',
  in_person_coworking: 'Coworking',
  in_person_home: 'Domicílio',
};

/** RN-ATD-19: a classificação aparece ao usuário. */
export const KIND_LABELS: Readonly<Record<CareSession['kind'], string>> = {
  psychotherapy: 'Psicoterapia',
  guidance: 'Orientação psicológica',
};

export interface StatusView {
  label: string;
  variant: BadgeVariant;
  icon: IconName;
}

export const SESSION_STATUS_VIEW: Readonly<Record<SessionStatus, StatusView>> = {
  scheduled: { label: 'Agendada', variant: 'info', icon: 'calendar-days' },
  confirmed: { label: 'Confirmada', variant: 'success', icon: 'circle-check' },
  done: { label: 'Realizada', variant: 'neutral', icon: 'check' },
  cancelled_by_user: { label: 'Cancelada pelo cuidador', variant: 'neutral', icon: 'ban' },
  cancelled_by_psychologist: { label: 'Cancelada pelo psicólogo', variant: 'neutral', icon: 'ban' },
  no_show: { label: 'Falta', variant: 'danger', icon: 'circle-alert' },
};

/**
 * Visão do estado de uma sessão. Uma sessão remarcada diz quem pediu para remarcar, em vez de "Cancelada pelo
 * cuidador" (CX-027); a falta por remarcação a menos de 24 horas continua sendo falta.
 */
export function sessionStatusView(
  session: Pick<CareSession, 'status' | 'rescheduledToId' | 'rescheduleRequestedBy'>,
): StatusView {
  if (session.rescheduledToId && session.status !== 'no_show') {
    return {
      label: session.rescheduleRequestedBy === 'psychologist' ? 'Remarcada pelo psicólogo' : 'Remarcada a pedido do cuidador',
      variant: 'neutral',
      icon: 'calendar-days',
    };
  }
  if (session.rescheduledToId) {
    return { label: 'Falta (remarcada a menos de 24 horas)', variant: 'danger', icon: 'circle-alert' };
  }
  return SESSION_STATUS_VIEW[session.status];
}

/** As regras de sala vivem no núcleo (também servem aos grupos): aqui só se reexportam. */
export { ROOM_ATTRIBUTES, isRoomBookable, roomBlockReason, roomScore } from '@core/rules/rooms';

const WEEKDAY_NAMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'] as const;

/** "quinta, 06/11" a partir de uma data ISO (dia da semana por extenso mais dia e mês). */
export function weekdayName(weekdayIndex: number): string {
  return WEEKDAY_NAMES[weekdayIndex] ?? '';
}
