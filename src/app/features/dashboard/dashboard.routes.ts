import { Routes } from '@angular/router';
import { ModulePlaceholderComponent } from '../_placeholder/module-placeholder.component';

/**
 * M02 Painel por perfil, montado em `/app/painel` (SCR-M02-01 a 03: painel, busca global Ctrl+K, notificações).
 */
export const ROUTES: Routes = [
  { path: '', component: ModulePlaceholderComponent, data: { title: 'Painel', moduleId: 'M02' } },
];
