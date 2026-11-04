import { Routes } from '@angular/router';
import { ModulePlaceholderComponent } from '../_placeholder/module-placeholder.component';

/**
 * M13 Governança (POPs, riscos, encaminhamentos, ocorrências, formação), montado em `/app/governanca`.
 * Telas: `pops`, `pops/:code`, `riscos`, `riscos/:id`, `encaminhamentos`, `ocorrencias`, `ocorrencias/:id`, `formacao`, `conteudos`, `normas`.
 */
export const ROUTES: Routes = [
  {
    path: '',
    component: ModulePlaceholderComponent,
    data: { title: 'Governança', moduleId: 'M13' },
  },
];
