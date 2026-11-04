import { Routes } from '@angular/router';
import { ModulePlaceholderComponent } from '../_placeholder/module-placeholder.component';

/**
 * M06 Zarit e ARBE, montado em `/app/acompanhamento`.
 * Telas: `fila`, `zarit/:caregiverId/nova`, `cuidador/:id`, `alertas/:id`, `arbe`, `revisoes`, `agregado`.
 */
export const ROUTES: Routes = [
  {
    path: '',
    component: ModulePlaceholderComponent,
    data: { title: 'Acompanhamento (Zarit e ARBE)', moduleId: 'M06' },
  },
];
