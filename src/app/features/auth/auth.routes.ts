import { Routes } from '@angular/router';
import { ModulePlaceholderComponent } from '../_placeholder/module-placeholder.component';

/** `/login` (SCR-M01-01) e `/login/2fa` (SCR-M01-02). Montado em `app.routes.ts` com `guestGuard`. */
export const ROUTES: Routes = [
  { path: '', component: ModulePlaceholderComponent, data: { title: 'Entrada', moduleId: 'M01' } },
  {
    path: '2fa',
    component: ModulePlaceholderComponent,
    data: { title: 'Segundo fator', moduleId: 'M01' },
  },
];

/** `/403` (SCR-M01-05): texto neutro, sem revelar o recurso, com botão para o painel. */
export const FORBIDDEN_ROUTES: Routes = [
  {
    path: '',
    component: ModulePlaceholderComponent,
    data: { title: 'Acesso negado', moduleId: 'M01' },
  },
];

/** `**` (SCR-M01-06): página não encontrada, com link ao painel. */
export const NOT_FOUND_ROUTES: Routes = [
  {
    path: '',
    component: ModulePlaceholderComponent,
    data: { title: 'Página não encontrada', moduleId: 'M01' },
  },
];
