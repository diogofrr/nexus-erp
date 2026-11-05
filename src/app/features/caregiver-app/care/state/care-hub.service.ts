import { Injectable, computed, inject } from '@angular/core';
import { Database } from '@core/data';
import { formatDayShort } from '../../state/day-format';
import { CaregiverContextService } from '../../state/caregiver-context.service';
import { ConversationsService } from './conversations.service';

export const HUB_CONVERSATION_DEFAULT = 'Escolha o formato e o horário.';
export const HUB_WELLBEING_DEFAULT = 'Veja como o seu cansaço tem andado e conte como você está.';
export const HUB_WELLBEING_PAUSED = 'Acompanhamento pausado.';
export const HUB_GROUPS_DEFAULT = 'Encontros com outras pessoas que cuidam e aulas práticas.';
export const HUB_CONTENT_DEFAULT = 'Leituras curtas sobre cuidar e sobre cuidar de você.';

function groups(n: number): string {
  return n === 1 ? '1 grupo' : `${n} grupos`;
}

/**
 * As frases dos quatro cartões da porta "Cuidar de mim" (UX C7). Em dois deles a frase muda quando há algo da pessoa para
 * mostrar, e só FATOS dela: a conversa marcada e os grupos. Nunca pontuação, faixa, contato da equipe ou plano
 * (RN-PLN-19). Com a autorização de saúde retirada, a frase de Como estou vira "Acompanhamento pausado.".
 */
@Injectable({ providedIn: 'root' })
export class CareHubService {
  private readonly ctx = inject(CaregiverContextService);
  private readonly db = inject(Database);
  private readonly conversations = inject(ConversationsService);

  /** "Você tem uma conversa marcada: qui, 06/11, às 14:00." */
  readonly conversationPhrase = computed(() => {
    const next = this.conversations.next();
    return next
      ? `Você tem uma conversa marcada: ${formatDayShort(next.startAt.slice(0, 10), this.ctx.today())}, às ${next.time}.`
      : HUB_CONVERSATION_DEFAULT;
  });

  readonly wellbeingPhrase = computed(() => (this.ctx.healthConsent() ? HUB_WELLBEING_DEFAULT : HUB_WELLBEING_PAUSED));

  /** "Você está em 1 grupo." ou "Você está na lista de espera de 1 grupo." (grupos que ainda não acabaram). */
  readonly groupsPhrase = computed(() => {
    const id = this.ctx.caregiverId();
    if (!id) {
      return HUB_GROUPS_DEFAULT;
    }
    const live = new Set(
      this.db.activities
        .query((a) => a.status === 'open' || a.status === 'full' || a.status === 'in_progress')
        .map((a) => a.id),
    );
    const mine = this.db.activityEnrollments.query((e) => e.caregiverId === id && live.has(e.activityId));
    const enrolled = mine.filter((e) => e.status === 'enrolled').length;
    const waiting = mine.filter((e) => e.status === 'waitlist').length;
    if (enrolled > 0 && waiting > 0) {
      return `Você está em ${groups(enrolled)} e na lista de espera de ${groups(waiting)}.`;
    }
    if (enrolled > 0) {
      return `Você está em ${groups(enrolled)}.`;
    }
    if (waiting > 0) {
      return `Você está na lista de espera de ${groups(waiting)}.`;
    }
    return HUB_GROUPS_DEFAULT;
  });
}
