import { Injectable, inject } from '@angular/core';
import { Clock } from '../clock/clock.service';
import { addDays } from '../clock/date-utils';
import { Database } from '../data/database';
import { ID, ReviewRequest } from '../models';

/** Texto curto demais: o chamador diz a frase certa para a tela (equipe ou cuidador). */
export const REVIEW_TEXT_MIN_CHARS = 5;

export type ReviewRegisterResult =
  { ok: true; request: ReviewRequest } | { ok: false; reason: 'unknown_caregiver' | 'text_too_short' };

/**
 * Pedido de revisão de uma decisão tomada com base nos resultados (RN-ZRT-20): o cuidador pede, o psicólogo responde
 * por escrito até o prazo (15 dias corridos, o mesmo do titular, RN-LGPD-21). É o miolo, SEM checagem de perfil: a equipe
 * (`ZaritService.registerReviewRequest`, que confere se o caso é dela) e o aplicativo do cuidador (que só registra o
 * pedido da própria pessoa) usam a MESMA regra. O prazo vem do `Clock`.
 */
@Injectable({ providedIn: 'root' })
export class ReviewRequestService {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);

  /** Os pedidos do cuidador, o mais recente primeiro. */
  forCaregiver(caregiverId: ID): ReviewRequest[] {
    return this.db.reviewRequests
      .query((r) => r.caregiverId === caregiverId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  }

  /** Registra o pedido. Quem responde é o psicólogo do caso. */
  register(caregiverId: ID, about: ReviewRequest['about'], text: string): ReviewRegisterResult {
    const caregiver = this.db.caregivers.get(caregiverId);
    if (!caregiver) {
      return { ok: false, reason: 'unknown_caregiver' };
    }
    if (text.trim().length < REVIEW_TEXT_MIN_CHARS) {
      return { ok: false, reason: 'text_too_short' };
    }
    const request = this.db.reviewRequests.create({
      caregiverId,
      psychologistId: caregiver.assignedPsychologistId as ID,
      about,
      text: text.trim(),
      dueAt: addDays(this.clock.today(), this.db.settings.get().dsrDeadlineDays),
    });
    return { ok: true, request };
  }
}
