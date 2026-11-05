import { Routes } from '@angular/router';

/**
 * Área "Como estou" do aplicativo do cuidador (P2). Montada em `/cuidador/cuidar-de-mim/como-estou` por
 * `routing/caregiver-areas.ts`, com carregamento sob demanda. A rota carrega a tela de verdade e MANTÉM `data.title`
 * (vira o título da aba).
 */
export const ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/my-wellbeing.page').then((m) => m.MyWellbeingPage),
    data: { title: 'Como estou' },
  },
];
