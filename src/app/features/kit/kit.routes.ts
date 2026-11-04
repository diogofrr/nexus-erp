import { Routes } from '@angular/router';
import { KitPage } from './kit.page';

/**
 * Página de demonstração dos componentes de `shared/ui`. O roteador central a registra em `/app/_kit`
 * (`loadChildren: () => import('./features/kit/kit.routes').then((m) => m.ROUTES)`).
 */
export const ROUTES: Routes = [{ path: '', component: KitPage, title: 'Kit de componentes' }];
