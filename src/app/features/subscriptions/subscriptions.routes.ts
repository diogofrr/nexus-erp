import { Routes } from '@angular/router';
import { ModulePlaceholderComponent } from '../_placeholder/module-placeholder.component';

/**
 * M04 Planos, assinaturas e Cartão Nexus, montado em `/app/assinaturas`.
 * Telas: `planos`, lista, `:id`, `cartoes`, registrar uso do cartão (modal).
 */
export const ROUTES: Routes = [
  {
    path: '',
    component: ModulePlaceholderComponent,
    data: { title: 'Planos e assinaturas', moduleId: 'M04' },
  },
];
