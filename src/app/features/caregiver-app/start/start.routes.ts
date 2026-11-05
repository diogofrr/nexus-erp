import { Routes } from '@angular/router';

/**
 * Área "Começar e perfil" do aplicativo do cuidador (P1). Montada em `/cuidador/comecar` por
 * `routing/caregiver-areas.ts`, com carregamento sob demanda (rota aberta: abre sem sessão). O título da aba vem de
 * `data.title`.
 */
export const ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/start.page').then((m) => m.StartPage),
    data: { title: 'Começar' },
  },
];

/**
 * Segunda rota base da área, montada em `/cuidador/mais/perfil` (ver `routing/caregiver-areas.ts`): Meu perfil.
 */
export const PROFILE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/profile.page').then((m) => m.ProfilePage),
    data: { title: 'Meu perfil' },
  },
];
