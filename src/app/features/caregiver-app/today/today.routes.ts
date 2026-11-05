import { Routes } from '@angular/router';

/**
 * Área "Hoje" do aplicativo do cuidador (P1). Montada em `/cuidador/hoje` por
 * `routing/caregiver-areas.ts`, com carregamento sob demanda. O título da aba vem de `data.title`.
 */
export const ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/today.page').then((m) => m.TodayPage),
    data: { title: 'Hoje' },
  },
];
