import { Routes } from '@angular/router';
import { permissionGuard } from '@core/auth';
import { leaveNewCaregiverGuard } from './pages/caregiver-new.page';
import { caregiverRecordGuard } from './state/record-guards';

/**
 * M03 Cuidadores e pessoas idosas, montado em `/app/cuidadores`.
 * Telas: lista, `novo` (assistente), `:id` (perfil com abas; encerrar cadastro e exportar dados do titular
 * são gaveta e botão dentro dele) e `:id/idoso`. O psicólogo só abre os cuidadores dele (guard do registro).
 */
export const ROUTES: Routes = [
  {
    path: '',
    data: { title: 'Cuidadores' },
    loadComponent: () => import('./pages/caregiver-list.page').then((m) => m.CaregiverListPage),
  },
  {
    path: 'novo',
    canActivate: [permissionGuard('caregiver_registry', 'create')],
    canDeactivate: [leaveNewCaregiverGuard],
    data: { title: 'Novo cuidador' },
    loadComponent: () => import('./pages/caregiver-new.page').then((m) => m.CaregiverNewPage),
  },
  {
    path: ':id/idoso',
    canActivate: [permissionGuard('elder_care'), caregiverRecordGuard],
    data: { title: 'Pessoa idosa' },
    loadComponent: () => import('./pages/elder.page').then((m) => m.ElderPage),
  },
  {
    path: ':id',
    canActivate: [caregiverRecordGuard],
    data: { title: 'Perfil do cuidador' },
    loadComponent: () => import('./pages/caregiver-profile.page').then((m) => m.CaregiverProfilePage),
  },
];
