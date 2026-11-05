import { Routes } from '@angular/router';

/**
 * Área "Meu plano" do aplicativo do cuidador (P3, UX C18 e B9). Montada em `/cuidador/mais/plano` por
 * `routing/caregiver-areas.ts`, com carregamento sob demanda. O quadro dos 4 planos abre em folha de tela cheia com
 * `?ver=planos`, sem rota filha.
 */
export const ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/plan.page').then((m) => m.PlanPage),
    data: { title: 'Meu plano' },
  },
];
