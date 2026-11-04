import { Routes } from '@angular/router';
import { ModulePlaceholderComponent } from '../_placeholder/module-placeholder.component';

/**
 * M08 Rede credenciada, montado em `/app/rede`.
 * Telas: `prestadores`, `prestadores/:id`, `credenciamento`, `credenciamento/:id`, `solicitacoes`, `avaliacoes`, `auditoria`, `avaliacao-interna/:id`, `busca`, `sinais`.
 */
export const ROUTES: Routes = [
  {
    path: '',
    component: ModulePlaceholderComponent,
    data: { title: 'Rede credenciada', moduleId: 'M08' },
  },
];
