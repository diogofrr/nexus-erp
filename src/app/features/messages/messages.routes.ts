import { Routes } from '@angular/router';
import { ModulePlaceholderComponent } from '../_placeholder/module-placeholder.component';

/**
 * M11 Caixa de mensagens, montado em `/app/mensagens`.
 * Telas: caixa de entrada, `:id`, registrar contato (modal), `modelos`.
 */
export const ROUTES: Routes = [
  {
    path: '',
    component: ModulePlaceholderComponent,
    data: { title: 'Mensagens', moduleId: 'M11' },
  },
];

/**
 * M11 Reclamações, montado em `/app/reclamacoes` (lista e `:id`).
 */
export const COMPLAINT_ROUTES: Routes = [
  {
    path: '',
    component: ModulePlaceholderComponent,
    data: { title: 'Reclamações', moduleId: 'M11' },
  },
];
