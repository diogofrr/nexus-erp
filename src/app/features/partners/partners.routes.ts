import { Routes } from '@angular/router';
import { ModulePlaceholderComponent } from '../_placeholder/module-placeholder.component';

/**
 * M09 Parceiros do Cartão Nexus, montado em `/app/parceiros` (lista e `:id`).
 */
export const ROUTES: Routes = [
  {
    path: '',
    component: ModulePlaceholderComponent,
    data: { title: 'Parceiros do Cartão', moduleId: 'M09' },
  },
];

/**
 * M09 Canal corporativo, montado em `/app/empresas` (lista e `:id`).
 */
export const COMPANY_ROUTES: Routes = [
  { path: '', component: ModulePlaceholderComponent, data: { title: 'Empresas', moduleId: 'M09' } },
];
