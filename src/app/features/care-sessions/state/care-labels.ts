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

/** As regras de sala vivem no núcleo (também servem aos grupos): aqui só se reexportam. */
export { ROOM_ATTRIBUTES, isRoomBookable, roomBlockReason, roomScore } from '@core/rules/rooms';

const WEEKDAY_NAMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'] as const;

/** "quinta, 06/11" a partir de uma data ISO (dia da semana por extenso mais dia e mês). */
export function weekdayName(weekdayIndex: number): string {
  return WEEKDAY_NAMES[weekdayIndex] ?? '';
}
