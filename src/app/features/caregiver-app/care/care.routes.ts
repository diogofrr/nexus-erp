import { Routes } from '@angular/router';

/**
 * Área "Cuidar de mim (a porta) e Conversar com um psicólogo" do aplicativo do cuidador (P2). Montada em
 * `/cuidador/cuidar-de-mim` por `routing/caregiver-areas.ts`, com carregamento sob demanda. Cada rota carrega a tela de
 * verdade e MANTÉM `data.title` (vira o título da aba).
 */
export const ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/care-hub.page').then((m) => m.CareHubPage),
    data: { title: 'Cuidar de mim' },
  },
  {
    path: 'atendimento',
    loadComponent: () => import('./pages/psychologist.page').then((m) => m.PsychologistPage),
    data: { title: 'Conversar com um psicólogo' },
  },
];
