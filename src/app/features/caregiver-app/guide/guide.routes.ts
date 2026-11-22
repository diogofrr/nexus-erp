import { Routes } from '@angular/router';

/**
 * Área "Guia" do aplicativo do cuidador: "Começando a cuidar" (os primeiros passos de quem acabou de virar cuidador) e
 * "Perguntas frequentes". Montada em `/cuidador/mais/guia` por `routing/caregiver-areas.ts`, com carregamento sob
 * demanda. Cada rota MANTÉM `data.title` (vira o título da aba).
 */
export const ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/first-steps.page').then((m) => m.GuideFirstStepsPage),
    data: { title: 'Começando a cuidar' },
  },
  {
    path: 'perguntas',
    loadComponent: () => import('./pages/faq.page').then((m) => m.GuideFaqPage),
    data: { title: 'Perguntas frequentes' },
  },
];
