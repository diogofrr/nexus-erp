import { Routes } from '@angular/router';

/**
 * Área "Falar com a Nexus e Ajuda agora" do aplicativo do cuidador (P2). Montada em `/cuidador/mais/ajuda` por
 * `routing/caregiver-areas.ts`, com carregamento sob demanda. Cada rota carrega a tela de verdade e MANTÉM
 * `data.title` (vira o título da aba).
 */
export const ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/talk-to-nexus.page').then((m) => m.TalkToNexusPage),
    data: { title: 'Falar com a Nexus' },
  },
];

/**
 * Segunda rota base da área, montada em `/cuidador/ajuda-agora` (ver `routing/caregiver-areas.ts`). Abre SEM sessão e
 * sem consentimento (S-35).
 */
export const HELP_NOW_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/help-now.page').then((m) => m.HelpNowPage),
    data: { title: 'Ajuda agora' },
  },
];
