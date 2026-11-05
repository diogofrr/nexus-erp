import { Routes } from '@angular/router';

/**
 * Área "Privacidade e meus dados" do aplicativo do cuidador (P2). Montada em `/cuidador/mais/privacidade` por
 * `routing/caregiver-areas.ts`, com carregamento sob demanda. Cada rota carrega a tela de verdade e MANTÉM
 * `data.title` (vira o título da aba).
 */
export const ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/privacy.page').then((m) => m.PrivacyPage),
    data: { title: 'Privacidade e meus dados' },
  },
];
