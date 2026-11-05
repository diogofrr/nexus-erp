import { Injectable, computed, inject } from '@angular/core';
import { CaregiverMessagesService } from '@core/care/caregiver-messages.service';
import { dateOf } from '@core/clock';
import { Channel, Message } from '@core/models';
import { IconName } from '@shared/ui';
import { CaregiverContextService } from '../../state/caregiver-context.service';
import { dayMonth } from '../../state/day-format';

/** Os 3 assuntos da mensagem pelo aplicativo (UX C19). Nada vem marcado; sem escolha, o assunto vira "Outro assunto". */
export const MESSAGE_SUBJECTS: readonly string[] = [
  'Dúvida sobre o app',
  'Preciso remarcar ou cancelar',
  'Outro assunto',
];
export const DEFAULT_SUBJECT = 'Outro assunto';

export const MESSAGE_SENT_NOTE = 'Recebemos a sua mensagem. Respondemos em até 24 horas úteis.';

const CHANNEL_LABEL: Readonly<Record<Channel, string>> = {
  app: 'Aplicativo',
  whatsapp: 'WhatsApp',
  phone: 'Telefone',
  email: 'E-mail',
};
const CHANNEL_ICON: Readonly<Record<Channel, IconName>> = {
  app: 'messages-square',
  whatsapp: 'message-circle',
  phone: 'phone',
  email: 'mail',
};

/** Uma linha de "Suas mensagens": a data, o canal (ícone e texto) e a situação, nunca só um ícone. */
export interface MessageEntry {
  id: string;
  /** "04/11". */
  dateLabel: string;
  channelLabel: string;
  icon: IconName;
  /** O que a pessoa lê: o texto da mensagem, ou "Conversa por telefone registrada em 02/11.". */
  text: string;
  /** "Enviada", "Respondida" ou "Resposta da equipe". */
  status: string;
  kind: 'sent' | 'registered' | 'reply';
}

/**
 * As mensagens da pessoa com a equipe, para a tela Falar com a Nexus (UX C19). Lê pelo núcleo
 * (`CaregiverMessagesService`) e só traduz para o que a tela mostra; a mensagem pelo aplicativo grava no núcleo com
 * o prazo de 24 horas úteis (RN-CAN-02 e 04). O aplicativo NÃO detecta risco no texto: a equipe sinaliza (S-24).
 */
@Injectable({ providedIn: 'root' })
export class NexusMessagesService {
  private readonly ctx = inject(CaregiverContextService);
  private readonly core = inject(CaregiverMessagesService);

  /** Da mais recente para a mais antiga. */
  readonly entries = computed<MessageEntry[]>(() => {
    const id = this.ctx.caregiverId();
    return id ? this.core.thread(id).map((m) => this.toEntry(m)) : [];
  });

  /** Manda a mensagem pelo aplicativo. Devolve a frase do erro quando o texto vem em branco. */
  send(subject: string | null, body: string): { ok: true } | { ok: false; error: string } {
    const result = this.core.send(this.ctx.requireCaregiverId(), { subject: subject ?? DEFAULT_SUBJECT, body });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  }

  private toEntry(message: Message): MessageEntry {
    const dateLabel = dayMonth(dateOf(message.receivedAt));
    const channelLabel = CHANNEL_LABEL[message.channel];
    const icon = CHANNEL_ICON[message.channel];
    if (message.direction === 'out') {
      return { id: message.id, dateLabel, channelLabel, icon, text: message.body, status: 'Resposta da equipe', kind: 'reply' };
    }
    if (message.channel === 'phone' || message.channel === 'whatsapp') {
      const how = message.channel === 'phone' ? 'telefone' : 'WhatsApp';
      return {
        id: message.id,
        dateLabel,
        channelLabel,
        icon,
        text: `Conversa por ${how} registrada em ${dateLabel}.`,
        status: 'Registrada pela equipe',
        kind: 'registered',
      };
    }
    return {
      id: message.id,
      dateLabel,
      channelLabel,
      icon,
      text: message.body,
      status: message.status === 'answered' ? 'Respondida' : 'Enviada',
      kind: 'sent',
    };
  }
}
