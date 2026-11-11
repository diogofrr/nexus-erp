import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { CaregiverContextService } from '../state/caregiver-context.service';

/**
 * O atendimento psicológico individual é de Cuida e Sustenta (docs/20). Decisão do líder: no Livre e no Essencial a rota
 * `/atendimento` **redireciona** para a porta de Cuidar de mim, sem página intermediária (a porta já não mostra o ladrilho).
 */
export const sessionPlanGuard: CanActivateFn = () =>
  inject(CaregiverContextService).canUse('individual_session') ? true : inject(Router).parseUrl('/cuidador/cuidar-de-mim');

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
    canActivate: [sessionPlanGuard],
    loadComponent: () => import('./pages/psychologist.page').then((m) => m.PsychologistPage),
    data: { title: 'Conversar com um psicólogo' },
  },
];
