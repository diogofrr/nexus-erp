import { Routes } from '@angular/router';
import { ModulePlaceholderComponent } from '../_placeholder/module-placeholder.component';

/**
 * M10 Financeiro, montado em `/app/financeiro`.
 * Telas: visão financeira, `projecao`, `parametros`, `investimento`, `custos`.
 */
export const ROUTES: Routes = [
  {
    path: '',
    component: ModulePlaceholderComponent,
    data: { title: 'Financeiro', moduleId: 'M10' },
  },
];

/**
 * M10 Indicadores (People Analytics), montado em `/app/indicadores`.
 */
export const INDICATORS_ROUTES: Routes = [
  {
    path: '',
    component: ModulePlaceholderComponent,
    data: { title: 'Indicadores', moduleId: 'M10' },
  },
];

/**
 * M10 Piloto (MVP), montado em `/app/piloto`.
 */
export const PILOT_ROUTES: Routes = [
  { path: '', component: ModulePlaceholderComponent, data: { title: 'Piloto', moduleId: 'M10' } },
];
