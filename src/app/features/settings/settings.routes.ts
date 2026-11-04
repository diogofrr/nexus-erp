import { Routes } from '@angular/router';
import { ModulePlaceholderComponent } from '../_placeholder/module-placeholder.component';

/**
 * M15 Configurações e dados de demonstração, montado em `/app/configuracoes`.
 * Telas: `dados`, `relogio`, `parametros`, `arbe`, `usuarios`, `suposicoes`, `sobre`, `beneficios`.
 */
export const ROUTES: Routes = [
  {
    path: '',
    component: ModulePlaceholderComponent,
    data: { title: 'Configurações', moduleId: 'M15' },
  },
];
