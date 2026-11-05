import { Routes } from '@angular/router';

/**
 * Área "Família" do aplicativo do cuidador (P1). Montada em `/cuidador/mais/familia` por
 * `routing/caregiver-areas.ts`, com carregamento sob demanda. O título da aba vem de `data.title`.
 */
export const ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/family.page').then((m) => m.FamilyPage),
    data: { title: 'Família' },
  },
];
