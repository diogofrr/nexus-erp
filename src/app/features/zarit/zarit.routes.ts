import { Routes } from '@angular/router';
import { zaritAreaGuard, zaritCaseGuard, zaritHomeGuard } from './state/zarit-guards';

/**
 * M06 Zarit e ARBE, montado em `/app/acompanhamento` (`moduleGuard('zarit')`).
 *
 * | Rota | Tela | Quem abre |
 * |---|---|---|
 * | `` | porta de entrada: mostra a fila (a sócia vai ao painel agregado; as chaves do sino levam à lista certa) | todos que abrem o módulo |
 * | `fila` | SCR-M06-01 Fila de acompanhamento (também SCR-M05-09, A-20) | psicólogo (os seus), RT |
 * | `zarit/:caregiverId/nova` | SCR-M06-02 Aplicar Zarit | psicólogo do caso |
 * | `zarit/:caregiverId/resultado/:id` | SCR-M06-03 Resultado e conduta | psicólogo do caso, RT com motivo |
 * | `cuidador/:id` | SCR-M06-04 Histórico do cuidador | idem |
 * | `alertas/:id` | SCR-M06-05 Alerta vermelho e SCR-M06-06 Alerta amarelo | idem |
 * | `arbe` | SCR-M06-07 ARBE (os limites, SCR-M06-08, ficam em `/app/configuracoes/arbe`) | psicólogo, RT |
 * | `revisoes` | SCR-M06-09 Pedidos de revisão | psicólogo, RT |
 * | `agregado` | SCR-M06-10 Painel agregado (mínimo de 5 por recorte) | sócia, RT, psicólogo (os seus) |
 *
 * O atendimento não abre nada daqui (o guard do módulo já o barra) e vê da Zarit só "pendente" ou "em dia"
 * nas telas de cadastro. Cuidador de outro psicólogo por URL vai a `/403` e grava `denied`.
 */
export const ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [zaritHomeGuard],
    loadComponent: () => import('./pages/queue.page').then((m) => m.QueuePageComponent),
    data: { title: 'Fila de acompanhamento', moduleId: 'M06' },
  },
  {
    path: 'fila',
    canActivate: [zaritAreaGuard('individual')],
    loadComponent: () => import('./pages/queue.page').then((m) => m.QueuePageComponent),
    data: { title: 'Fila de acompanhamento', moduleId: 'M06' },
  },
  {
    path: 'zarit/:caregiverId/nova',
    canActivate: [zaritAreaGuard('individual'), zaritCaseGuard('caregiverId', 'caregiver', 'apply')],
    loadComponent: () => import('./pages/apply.page').then((m) => m.ZaritApplyPageComponent),
    data: { title: 'Aplicar Zarit' },
  },
  {
    path: 'zarit/:caregiverId/resultado/:id',
    canActivate: [zaritAreaGuard('individual'), zaritCaseGuard('caregiverId', 'caregiver', 'view')],
    loadComponent: () => import('./pages/result.page').then((m) => m.ZaritResultPageComponent),
    data: { title: 'Resultado da escala' },
  },
  {
    path: 'cuidador/:id',
    canActivate: [zaritAreaGuard('individual'), zaritCaseGuard('id', 'caregiver', 'view')],
    loadComponent: () => import('./pages/history.page').then((m) => m.ZaritHistoryPageComponent),
    data: { title: 'Histórico do cuidador' },
  },
  {
    path: 'alertas/:id',
    canActivate: [zaritAreaGuard('individual'), zaritCaseGuard('id', 'alert', 'view')],
    loadComponent: () => import('./pages/alert.page').then((m) => m.ZaritAlertPageComponent),
    data: { title: 'Alerta' },
  },
  {
    path: 'arbe',
    canActivate: [zaritAreaGuard('individual')],
    loadComponent: () => import('./pages/arbe.page').then((m) => m.ArbePageComponent),
    data: { title: 'Alertas de esgotamento (ARBE)' },
  },
  {
    path: 'revisoes',
    canActivate: [zaritAreaGuard('individual')],
    loadComponent: () => import('./pages/reviews.page').then((m) => m.ReviewsPageComponent),
    data: { title: 'Pedidos de revisão' },
  },
  {
    path: 'agregado',
    canActivate: [zaritAreaGuard('aggregate')],
    loadComponent: () => import('./pages/aggregate.page').then((m) => m.AggregatePageComponent),
    data: { title: 'Painel agregado' },
  },
];
