import { Routes } from '@angular/router';

/**
 * Área "Rede (a porta, buscar e pedidos)" do aplicativo do cuidador (P3, UX C12 a C15). Montada em `/cuidador/rede` por
 * `routing/caregiver-areas.ts`, com carregamento sob demanda. A porta de Rede é a rota `''`; Buscar guarda a necessidade em
 * `?categoria=`; Meus pedidos abre a avaliação com `?avaliar=<id do pedido>` e o pedido com `?pedido=<id>`.
 */
export const ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/network-door.page').then((m) => m.NetworkDoorPage),
    data: { title: 'Rede' },
  },
  {
    path: 'buscar',
    loadComponent: () => import('./pages/search.page').then((m) => m.SearchPage),
    data: { title: 'Buscar' },
  },
  {
    path: 'profissional/:id',
    loadComponent: () => import('./pages/provider.page').then((m) => m.ProviderPage),
    data: { title: 'Profissional' },
  },
  {
    path: 'pedidos',
    loadComponent: () => import('./pages/orders.page').then((m) => m.OrdersPage),
    data: { title: 'Meus pedidos' },
  },
];
