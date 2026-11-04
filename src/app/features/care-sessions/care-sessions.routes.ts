import { Routes } from '@angular/router';
import { ModulePlaceholderComponent } from '../_placeholder/module-placeholder.component';

/**
 * M05 Atendimento psicológico, montado em `/app/atendimento`.
 * Telas: `agenda`, `disponibilidade`, `sessoes/:id`, `sessoes/:id/anotacao`, `ocupacao`, `salas`, `fila`.
 */
export const ROUTES: Routes = [
  {
    path: '',
    component: ModulePlaceholderComponent,
    data: { title: 'Atendimento psicológico', moduleId: 'M05' },
  },
];
