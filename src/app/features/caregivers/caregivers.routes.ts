import { Routes } from '@angular/router';
import { ModulePlaceholderComponent } from '../_placeholder/module-placeholder.component';

/**
 * M03 Cuidadores e pessoas idosas, montado em `/app/cuidadores`.
 * Telas (escopo, seção 3): lista, `novo`, `:id` (perfil com abas), `:id/idoso`, encerrar cadastro (modal), elegibilidade ao piloto, exportar dados do titular.
 */
export const ROUTES: Routes = [
  {
    path: '',
    component: ModulePlaceholderComponent,
    data: { title: 'Cuidadores e pessoas idosas', moduleId: 'M03' },
  },
];
