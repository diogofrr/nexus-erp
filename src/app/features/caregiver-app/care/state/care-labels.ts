import { CareSession, SessionModality, SessionStatus } from '@core/models';
import { IconName } from '@shared/ui';

/**
 * Os textos de "Conversar com um psicólogo" (UX C8, B4; RN-ATD-02, 07, 09, 10, 15, 16, 19). "Conversa" no lugar de
 * "sessão", "psicólogo" no lugar de "profissional". Frases curtas, sem jargão, sem promessa de resultado.
 */

export interface FormatOption {
  value: SessionModality;
  label: string;
  hint: string;
  icon: IconName;
}

/** Os 3 formatos, na ordem da tela (RN-ATD-02). */
export const FORMAT_OPTIONS: readonly FormatOption[] = [
  { value: 'online', label: 'On-line', hint: 'Pelo celular ou computador, de onde você estiver.', icon: 'video' },
  {
    value: 'in_person_coworking',
    label: 'No espaço de coworking',
    hint: 'Em uma sala com acesso sem degraus, em Uberlândia.',
    icon: 'building-2',
  },
  { value: 'in_person_home', label: 'Em casa', hint: 'O psicólogo vai até você, se for seguro e adequado.', icon: 'house' },
];

export const FORMAT_LABEL: Readonly<Record<SessionModality, string>> = {
  online: 'On-line',
  in_person_coworking: 'No espaço de coworking',
  in_person_home: 'Em casa',
};

/** Aviso por formato, na folha de resumo (RN-ATD-07 e RN-ATD-09). O coworking não precisa de aviso. */
export const FORMAT_NOTICE: Readonly<Record<SessionModality, string | null>> = {
  online: 'O psicólogo confirma se o formato on-line serve para você. Se não servir, combina outro formato.',
  in_person_coworking: null,
  in_person_home: 'O psicólogo confirma se o local é adequado e seguro antes de confirmar a conversa.',
};

/** Psicoterapia, orientação ou "não sei" (S-07: "não sei" grava orientação e o psicólogo confirma na conversa). */
export type KindChoice = 'psychotherapy' | 'guidance' | 'unsure';

export const KIND_OPTIONS: readonly { value: KindChoice; label: string; hint?: string }[] = [
  { value: 'psychotherapy', label: 'Psicoterapia', hint: 'Acompanhamento regular, com objetivo clínico.' },
  { value: 'guidance', label: 'Orientação psicológica', hint: 'Orientação pontual sobre o cuidado e o que você sente.' },
  { value: 'unsure', label: 'Não sei', hint: 'O psicólogo ajuda a decidir na conversa.' },
];

/** O caráter que a conversa mostra (RN-ATD-19: sempre à vista). */
export const KIND_LABEL: Readonly<Record<CareSession['kind'], string>> = {
  psychotherapy: 'Psicoterapia',
  guidance: 'Orientação psicológica',
};

export function kindFromChoice(choice: KindChoice): CareSession['kind'] {
  return choice === 'psychotherapy' ? 'psychotherapy' : 'guidance';
}

/** A situação da conversa, do jeito que o cuidador lê (S-15: quem confirma é a equipe ou o psicólogo). */
export function statusText(session: Pick<CareSession, 'status' | 'rescheduledToId'>): string {
  if (session.rescheduledToId) {
    return 'Remarcada';
  }
  const text: Readonly<Record<SessionStatus, string>> = {
    scheduled: 'Aguardando confirmação do psicólogo',
    confirmed: 'Confirmada',
    done: 'Realizada',
    cancelled_by_user: 'Cancelada por você',
    cancelled_by_psychologist: 'Cancelada pelo psicólogo. Marque outro horário.',
    no_show: 'Você não compareceu',
  };
  return text[session.status];
}

export const CANCEL_FREE = 'Cancelar libera o horário. Não há custo.';
export const CANCEL_LATE = 'Faltam menos de 24 horas. Se cancelar agora, o horário fica registrado como falta.';
export const RESCHEDULE_LATE =
  'Faltam menos de 24 horas. Se remarcar agora, o horário atual fica registrado como falta.';
export const RESCHEDULE_FREE = 'O horário atual só é liberado depois que você marcar o novo.';

export const PAYMENT_NOTE = 'O pagamento é combinado direto no atendimento. No protótipo não há cobrança.';
export const NO_SLOTS_TEXT = 'Sem horários nesse formato nos próximos 14 dias. Escolha outro formato ou fale com a gente.';
export const SLOT_TAKEN = 'Esse horário acabou de ser reservado. Escolha outro.';
