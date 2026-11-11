import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { SubscriptionService } from '../../../core/commerce/subscription.service';
import { CaregiverContextService } from '../state/caregiver-context.service';

/**
 * O Cartão Nexus só existe para quem tem plano pago (RN-CRT-02). Decisão do líder (docs/20, regra de exibição 1): no Livre a
 * rota **redireciona** para a porta de Rede, sem página intermediária. Uma mudança de plano que já venceu vale antes de decidir.
 */
export const cardPlanGuard: CanActivateFn = () => {
  inject(SubscriptionService).applyDueChanges();
  return inject(CaregiverContextService).canUse('card') ? true : inject(Router).parseUrl('/cuidador/rede');
};

/**
 * Área "Cartão Nexus" do aplicativo do cuidador (P3, UX C16). Montada em `/cuidador/rede/cartao` por
 * `routing/caregiver-areas.ts`, com carregamento sob demanda.
 */
export const ROUTES: Routes = [
  {
    path: '',
    canActivate: [cardPlanGuard],
    loadComponent: () => import('./pages/card.page').then((m) => m.CardPage),
    data: { title: 'Cartão Nexus' },
  },
];
