/**
 * Como falar com a Nexus (decisão 6 do contexto e UX A.2.16). Nenhum canal liga ou abre nada de verdade: os
 * números são fictícios (`(34) 90000-0000`), nunca há `tel:` nem `wa.me`, e a tela mostra "No protótipo, a
 * ligação não é feita". Prazos de resposta: RN-CAN-02 (aplicativo 24 h úteis, WhatsApp 4 h úteis, telefone na
 * hora em horário comercial, e-mail 48 h úteis). Expediente: RN-CAN-03 (segunda a sexta, 8h às 18h, sem feriado
 * nacional). Funções puras: recebem o instante, nunca leem o relógio.
 */
import { addDays, dateOf, timeOf } from '../../../core/clock/date-utils';
import { Channel, ISODateTime } from '../../../core/models';
import { isBusinessDay } from '../../../core/rules/sla';

export const NEXUS_PHONE = '(34) 90000-0000';
export const NEXUS_WHATSAPP = '(34) 90000-0000';
export const NEXUS_EMAIL = 'atendimento@exemplo.com.br';

export const BUSINESS_OPEN = '08:00';
export const BUSINESS_CLOSE = '18:00';

/** Aviso fixo dos canais (RN-CAN-06, RN-ATD-11): emergência é 192 e os canais não substituem atendimento de saúde. */
export const CHANNELS_NOTICE =
  'Em emergência, ligue 192 (SAMU). Os canais da Nexus não substituem atendimento de saúde nem orientação sobre remédios.';
export const PROTOTYPE_CALL_NOTICE = 'No protótipo, a ligação não é feita.';

export type ContactAction = 'copy_number' | 'write_message' | 'copy_email';

export interface ContactChannel {
  channel: Channel;
  label: string;
  /** Nome do ícone do sprite. */
  icon: 'phone' | 'message-circle' | 'messages-square' | 'mail';
  /** Quando respondemos (RN-CAN-02). */
  answer: string;
  action: ContactAction;
  actionLabel: string;
  /** Número ou e-mail a mostrar e copiar (`null` no aplicativo: a mensagem é escrita na tela Falar com a Nexus). */
  value: string | null;
  /** Só o telefone: avisa que está fechado agora e quando abre. */
  closedNote?: string;
}

/** Dia útil entre 8h e 18h. */
export function isWithinBusinessHours(now: ISODateTime): boolean {
  if (!isBusinessDay(dateOf(now))) {
    return false;
  }
  const time = timeOf(now);
  return time >= BUSINESS_OPEN && time < BUSINESS_CLOSE;
}

/** "Fechado agora. Abrimos amanhã às 8h." (ou o dia da semana, quando não é amanhã). */
export function phoneClosedNote(now: ISODateTime): string | undefined {
  if (isWithinBusinessHours(now)) {
    return undefined;
  }
  const today = dateOf(now);
  // Antes das 8h de um dia útil: abrimos hoje.
  if (isBusinessDay(today) && timeOf(now) < BUSINESS_OPEN) {
    return 'Fechado agora. Abrimos hoje às 8h.';
  }
  let next = addDays(today, 1);
  let days = 1;
  while (!isBusinessDay(next)) {
    next = addDays(next, 1);
    days += 1;
  }
  return days === 1
    ? 'Fechado agora. Abrimos amanhã às 8h.'
    : 'Fechado agora. Abrimos no próximo dia útil, às 8h.';
}

/** Os 4 canais, o preferido da pessoa primeiro (os outros seguem a ordem fixa: telefone, WhatsApp, aplicativo, e-mail). */
export function contactChannels(preferred: Channel, now: ISODateTime): ContactChannel[] {
  const closed = phoneClosedNote(now);
  const all: ContactChannel[] = [
    {
      channel: 'phone',
      label: 'Telefone',
      icon: 'phone',
      answer: 'Na hora, em horário comercial (segunda a sexta, 8h às 18h)',
      action: 'copy_number',
      actionLabel: 'Copiar número',
      value: NEXUS_PHONE,
      ...(closed ? { closedNote: closed } : {}),
    },
    {
      channel: 'whatsapp',
      label: 'WhatsApp',
      icon: 'message-circle',
      answer: 'Até 4 horas úteis',
      action: 'copy_number',
      actionLabel: 'Copiar número',
      value: NEXUS_WHATSAPP,
    },
    {
      channel: 'app',
      label: 'Mensagem no aplicativo',
      icon: 'messages-square',
      answer: 'Até 24 horas úteis',
      action: 'write_message',
      actionLabel: 'Escrever mensagem',
      value: null,
    },
    {
      channel: 'email',
      label: 'E-mail',
      icon: 'mail',
      answer: 'Até 48 horas úteis',
      action: 'copy_email',
      actionLabel: 'Copiar e-mail',
      value: NEXUS_EMAIL,
    },
  ];
  return [...all.filter((c) => c.channel === preferred), ...all.filter((c) => c.channel !== preferred)];
}
