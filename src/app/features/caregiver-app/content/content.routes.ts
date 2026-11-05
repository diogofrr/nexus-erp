import { Routes } from '@angular/router';

/**
 * Área "Conteúdos" do aplicativo do cuidador (P3, UX C11). Montada em `/cuidador/cuidar-de-mim/conteudos` por
 * `routing/caregiver-areas.ts`, com carregamento sob demanda. A leitura abre em folha de tela cheia com `?conteudo=`
 * (S-21), sem rota filha.
 */
export const ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/content.page').then((m) => m.ContentPage),
    data: { title: 'Conteúdos' },
  },
];
