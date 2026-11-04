import { Routes } from '@angular/router';
import { ModulePlaceholderComponent } from '../_placeholder/module-placeholder.component';

/**
 * M07 Grupos e capacitações, montado em `/app/grupos`.
 * Telas: programação, `novo`, `:id`, `:id/presenca`, `indicadores`.
 */
export const ROUTES: Routes = [
  {
    path: '',
    component: ModulePlaceholderComponent,
    data: { title: 'Grupos e capacitações', moduleId: 'M07' },
  },
];
