import { Routes } from '@angular/router';

/**
 * Área "Grupos e capacitações" do aplicativo do cuidador (P3, UX C10). Montada em `/cuidador/cuidar-de-mim/grupos` por
 * `routing/caregiver-areas.ts`, com carregamento sob demanda. O detalhe da atividade abre em folha de tela cheia com
 * `?atividade=<id>` (S-21), sem rota filha.
 */
export const ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/groups.page').then((m) => m.GroupsPage),
    data: { title: 'Grupos e capacitações' },
  },
];
