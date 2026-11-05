import { Routes } from '@angular/router';

/**
 * M04 Planos, assinaturas e Cartão Nexus, montado em `/app/assinaturas`.
 * Telas: lista, `planos` (comparativo), `cartoes` (com o registro de uso em gaveta) e `:id` (detalhe da
 * assinatura). O módulo é do `partner`, do `support` (edita) e do `technical_lead` (lê); o psicólogo só vê
 * o plano do próprio cuidador dentro da ficha (M03).
 */
export const ROUTES: Routes = [
  {
    path: '',
    data: { title: 'Assinaturas' },
    loadComponent: () => import('./pages/subscriptions-list.page').then((m) => m.SubscriptionsListPage),
  },
  {
    path: 'planos',
    data: { title: 'Planos' },
    loadComponent: () => import('./pages/plans.page').then((m) => m.PlansPage),
  },
  {
    path: 'cartoes',
    data: { title: 'Cartões' },
    loadComponent: () => import('./pages/cards.page').then((m) => m.CardsPage),
  },
  {
    path: ':id',
    data: { title: 'Detalhe da assinatura' },
    loadComponent: () => import('./pages/subscription-detail.page').then((m) => m.SubscriptionDetailPage),
  },
];
