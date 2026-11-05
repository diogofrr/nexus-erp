import { Routes } from '@angular/router';

/**
 * Área "Cartão Nexus" do aplicativo do cuidador (P3, UX C16). Montada em `/cuidador/rede/cartao` por
 * `routing/caregiver-areas.ts`, com carregamento sob demanda.
 */
export const ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/card.page').then((m) => m.CardPage),
    data: { title: 'Cartão Nexus' },
  },
];
