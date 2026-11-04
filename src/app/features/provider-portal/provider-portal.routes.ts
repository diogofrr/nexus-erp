import { Routes } from '@angular/router';
import { ModulePlaceholderComponent } from '../_placeholder/module-placeholder.component';

/**
 * M14 Portal do profissional credenciado, montado em `/portal` (só `provider`).
 * Telas: painel, `perfil`, `disponibilidade`, `solicitacoes`, `solicitacoes/:id`, `avaliacao`, `documentos`, `integracao`, `avaliacao-interna`, `mensagens`, `privacidade`.
 */
export const ROUTES: Routes = [
  {
    path: '',
    component: ModulePlaceholderComponent,
    data: { title: 'Portal do profissional credenciado', moduleId: 'M14' },
  },
];
