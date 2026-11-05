import { Routes } from '@angular/router';
import { groupsCreateGuard, groupsIndicatorsGuard, groupsManageGuard } from './state/groups-guards';

/**
 * M07 Grupos e capacitações, montado em `/app/grupos` (`moduleGuard('groups')`).
 *
 * | Rota | Tela | Quem abre |
 * |---|---|---|
 * | `` | SCR-M07-01 Programação (lista e calendário) | sócia, RT, psicólogo, atendimento |
 * | `novo` | SCR-M07-02 Nova atividade | sócia e psicólogo (que conduz) |
 * | `indicadores` | SCR-M07-06 Indicadores de participação | sócia, RT e psicólogo (as suas) |
 * | `:id` | SCR-M07-03 Detalhe da atividade (com SCR-M07-04 Inscrever, em gaveta) | todos |
 * | `:id/editar` | edição de rascunho ou atividade aberta | sócia e psicólogo que conduz |
 * | `:id/presenca` | SCR-M07-05 Presença | sócia e psicólogo que conduz |
 *
 * As rotas fixas (`novo`, `indicadores`) vêm antes de `:id`.
 */
export const ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./pages/program.page').then((m) => m.ProgramPageComponent),
    data: { title: 'Grupos e capacitações', moduleId: 'M07' },
  },
  {
    path: 'novo',
    canActivate: [groupsCreateGuard],
    loadComponent: () => import('./pages/new-activity.page').then((m) => m.NewActivityPageComponent),
    data: { title: 'Nova atividade' },
  },
  {
    path: 'indicadores',
    canActivate: [groupsIndicatorsGuard],
    loadComponent: () => import('./pages/indicators.page').then((m) => m.IndicatorsPageComponent),
    data: { title: 'Indicadores de participação' },
  },
  {
    path: ':id/editar',
    canActivate: [groupsManageGuard],
    loadComponent: () => import('./pages/new-activity.page').then((m) => m.NewActivityPageComponent),
    data: { title: 'Editar atividade' },
  },
  {
    path: ':id/presenca',
    canActivate: [groupsManageGuard],
    loadComponent: () => import('./pages/attendance.page').then((m) => m.AttendancePageComponent),
    data: { title: 'Presença' },
  },
  {
    path: ':id',
    loadComponent: () => import('./pages/activity-detail.page').then((m) => m.ActivityDetailPageComponent),
    data: { title: 'Detalhe da atividade' },
  },
];
