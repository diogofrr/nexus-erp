import { Injectable, inject } from '@angular/core';
import { Clock } from '../../../../core/clock/clock.service';
import {
  ChangeQuote,
  PLAN_SHORT_NAMES,
  SubscriptionError,
  SubscriptionService,
} from '../../../../core/commerce/subscription.service';
import { Database } from '../../../../core/data/database';
import { PlanId, Subscription } from '../../../../core/models';
import { CaregiverContextService } from '../../state/caregiver-context.service';
import { CHANGE_FAILED } from './plan-copy';

export type PlanActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string; field?: 'acceptance' };

/**
 * Ações de "Meu plano" para o cuidador (UX B9 e C18). O miolo é do `SubscriptionService` do núcleo (RN-PLN-14): subir vale
 * na hora e emite o Cartão Nexus, descer e cancelar valem no fim do ciclo pago, plano pago pela empresa só muda pelo
 * contrato. Aqui ficam o que é do cuidador: quem fez a troca vai no histórico em nome dele (decisão do líder), o aceite do
 * aviso de emergência na primeira contratação paga (RN-ATD-11, RN-CAN-06, S-23) e as frases de erro.
 *
 * Pagamento é simulado: nenhum número de cartão existe em lugar nenhum daqui (decisão 5 do contexto).
 */
@Injectable({ providedIn: 'root' })
export class CaregiverPlanService {
  private readonly ctx = inject(CaregiverContextService);
  private readonly subscriptions = inject(SubscriptionService);
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);

  /** O plano é pago pela empresa do cuidador (só muda pelo contrato dela). */
  isCorporate(): boolean {
    return this.ctx.subscription()?.payer === 'corporate';
  }

  /** Nome da empresa que paga o plano, sem o ponto final. */
  companyName(): string | null {
    const sub = this.ctx.subscription();
    const name = sub ? this.subscriptions.payerCompany(sub) : null;
    return name ? name.replace(/\.$/, '') : null;
  }

  /**
   * A assinatura em que a troca é calculada: a vigente, ou uma do Livre quando a pessoa não tem assinatura ou a dela foi
   * cancelada (a de verdade só é criada ao confirmar).
   */
  private baseSubscription(): Subscription {
    const sub = this.ctx.subscription();
    if (sub && sub.status !== 'cancelled') {
      return sub;
    }
    const now = this.clock.now();
    return {
      id: sub?.id ?? 'sub_pending',
      caregiverId: this.ctx.requireCaregiverId(),
      planId: 'livre',
      status: 'active',
      payer: 'self',
      startedAt: this.clock.today(),
      createdAt: now,
      updatedAt: now,
    };
  }

  /** O que acontece se a pessoa for para `to`, para mostrar ANTES de confirmar. */
  quote(to: PlanId): ChangeQuote {
    return this.subscriptions.quote(this.baseSubscription(), to);
  }

  /** A pessoa ainda não aceitou o aviso de emergência e dos canais e vai contratar plano pago (S-23). */
  needsEmergencyAcceptance(to: PlanId): boolean {
    return this.quote(to).kind === 'upgrade' && !this.ctx.caregiver()?.emergencyNoticeAcceptedAt;
  }

  /** Confirma a troca. Sem o aceite, na contratação, devolve o erro do campo; o resto do estado não muda. */
  confirm(to: PlanId, options: { emergencyAccepted: boolean }): PlanActionResult {
    const caregiverId = this.ctx.requireCaregiverId();
    const quote = this.quote(to);
    if (quote.timing === 'blocked') {
      return { ok: false, error: CHANGE_FAILED };
    }
    const needsAcceptance = this.needsEmergencyAcceptance(to);
    if (needsAcceptance && !options.emergencyAccepted) {
      return { ok: false, error: 'Marque que você leu o aviso para continuar.', field: 'acceptance' };
    }
    try {
      const subscription = this.ensureSubscription();
      if (needsAcceptance) {
        this.db.caregivers.update(caregiverId, { emergencyNoticeAcceptedAt: this.clock.now() });
      }
      const result = this.subscriptions.changePlan(subscription.id, to, caregiverId);
      const message =
        result.kind === 'upgrade' && result.card
          ? `Plano alterado para o ${PLAN_SHORT_NAMES[to]}. Cartão ${result.card.number} ${quote.issuesCard ? 'emitido' : 'segue ativo'}.`
          : result.message;
      return { ok: true, message };
    } catch (error) {
      if (error instanceof SubscriptionError) {
        return { ok: false, error: CHANGE_FAILED };
      }
      throw error;
    }
  }

  /** "Manter meu plano": desfaz a mudança ou o cancelamento agendado, em um toque. */
  keep(): PlanActionResult {
    const sub = this.ctx.subscription();
    if (!sub) {
      return { ok: false, error: CHANGE_FAILED };
    }
    try {
      this.subscriptions.keepPlan(sub.id, this.ctx.requireCaregiverId());
      return { ok: true, message: 'Plano mantido.' };
    } catch (error) {
      if (error instanceof SubscriptionError) {
        return { ok: false, error: CHANGE_FAILED };
      }
      throw error;
    }
  }

  /** Cria a assinatura que falta: do cadastro sem assinatura ou da cancelada, sempre no Livre (a troca vem em seguida). */
  private ensureSubscription(): Subscription {
    const caregiverId = this.ctx.requireCaregiverId();
    const sub = this.ctx.subscription();
    if (!sub) {
      return this.subscriptions.startSubscription(caregiverId, 'livre', caregiverId);
    }
    if (sub.status === 'cancelled') {
      return this.subscriptions.reactivate(sub.id, caregiverId);
    }
    return sub;
  }
}
