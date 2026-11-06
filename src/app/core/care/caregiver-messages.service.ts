import { Injectable, inject } from '@angular/core';
import { NOT_OWNER_TEXT, CaregiverOwnership } from '../auth/caregiver-ownership';
import { Clock } from '../clock/clock.service';
import { Database } from '../data/database';
import { ID, Message } from '../models';
import { messageDueAt } from '../rules/sla';
import { FREE_TEXT_MAX_CHARS, NAME_MAX_CHARS, isTooLong, tooLongText } from '../rules/text-limits';

/** Resultado de mandar uma mensagem pelo aplicativo: a mensagem gravada ou a frase do erro, junto do campo. */
export type CaregiverMessageResult =
  { ok: true; message: Message } | { ok: false; error: string };

export interface CaregiverMessageInput {
  /** Assunto curto ("Dúvida sobre o app"). */
  subject: string;
  /** O que a pessoa escreveu. */
  body: string;
}

export const EMPTY_MESSAGE_ERROR = 'Escreva a sua mensagem para enviar.';

/**
 * Mensagens do cuidador para a equipe pelo aplicativo (RN-CAN-01, RN-CAN-02, RN-CAN-04, RN-USR-07). Chega à caixa
 * de mensagens da equipe (M11) como uma mensagem de entrada do canal `app`, com o prazo de 24 horas úteis
 * calculado na chegada (`messageDueAt`). O aplicativo NÃO detecta nem classifica risco no texto: quem sinaliza é a
 * equipe (suposição S-24 do UX do cuidador). A posse é conferida na borda (`CaregiverOwnership`): com a sessão de um cuidador aberta, só se manda e se lê a mensagem dele.
 */
@Injectable({ providedIn: 'root' })
export class CaregiverMessagesService {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly ownership = inject(CaregiverOwnership);

  /** Tudo o que a pessoa trocou com a equipe (entrada e saída), da mais recente para a mais antiga. */
  thread(caregiverId: ID): Message[] {
    if (!this.ownership.ownsCaregiver(caregiverId)) {
      return [];
    }
    return this.db.messages
      .query((m) => m.caregiverId === caregiverId)
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt) || b.id.localeCompare(a.id));
  }

  /** Grava a mensagem do cuidador (canal aplicativo). Texto em branco não grava. */
  send(caregiverId: ID, input: CaregiverMessageInput): CaregiverMessageResult {
    // A mensagem sai em nome de quem está na sessão e de mais ninguém (QAC-001).
    if (!this.ownership.ownsCaregiver(caregiverId)) {
      return { ok: false, error: NOT_OWNER_TEXT };
    }
    const body = input.body.trim();
    if (!body) {
      return { ok: false, error: EMPTY_MESSAGE_ERROR };
    }
    // Limite do tamanho: o armazenamento do navegador é pequeno e um texto de 10 mil caracteres é um erro de colagem (QAC-015).
    if (isTooLong(body, FREE_TEXT_MAX_CHARS) || isTooLong(input.subject, NAME_MAX_CHARS)) {
      return { ok: false, error: tooLongText(isTooLong(body, FREE_TEXT_MAX_CHARS) ? FREE_TEXT_MAX_CHARS : NAME_MAX_CHARS) };
    }
    if (!this.db.caregivers.exists(caregiverId)) {
      return { ok: false, error: 'Não foi possível enviar. Sua mensagem continua aqui. Tente de novo.' };
    }
    const now = this.clock.now();
    const message = this.db.messages.create({
      channel: 'app',
      direction: 'in',
      caregiverId,
      ...(input.subject.trim() ? { subject: input.subject.trim() } : {}),
      body,
      receivedAt: now,
      dueAt: messageDueAt('app', now, this.db.settings.get().slaHours),
      status: 'new',
      isSupportRequest: false,
    });
    return { ok: true, message };
  }
}
