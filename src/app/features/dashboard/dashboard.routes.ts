import { Routes } from '@angular/router';
import { DashboardPageComponent } from './pages/dashboard.page';

/**
 * M02 Painel por perfil, montado em `/app/painel` (SCR-M02-01). A busca global (`Ctrl+K`, SCR-M02-02) e as
 * notificações (sino, SCR-M02-03) são do shell e do núcleo (`core/search`, `core/notifications`); o painel só
 * liga cada item à tela certa do módulo, com o filtro `?filtro=` aplicado.
 */
export const ROUTES: Routes = [
  { path: '', component: DashboardPageComponent, data: { title: 'Painel', moduleId: 'M02' } },
];
