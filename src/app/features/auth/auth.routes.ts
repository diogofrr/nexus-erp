import { Routes } from '@angular/router';
import { LoginPageComponent } from './pages/login.page';
import {
  ForbiddenPageComponent,
  NotFoundPageComponent,
  SessionExpiredPageComponent,
} from './pages/system-pages';
import { TwoFactorPageComponent } from './pages/two-factor.page';

/**
 * M01 Acesso e perfis. `/login` (SCR-M01-01), `/login/2fa` (SCR-M01-02) e `/login/expirada` (sessão
 * expirada, SCR-M01-04). Montado em `app.routes.ts` com `guestGuard` e sem shell.
 */
export const ROUTES: Routes = [
  { path: '', component: LoginPageComponent, data: { title: 'Entrada' } },
  { path: '2fa', component: TwoFactorPageComponent, data: { title: 'Segundo fator' } },
  { path: 'expirada', component: SessionExpiredPageComponent, data: { title: 'Sessão expirada' } },
];

/** `/403` (SCR-M01-05): texto neutro, sem revelar o recurso, com botão para o painel. */
export const FORBIDDEN_ROUTES: Routes = [
  { path: '', component: ForbiddenPageComponent, data: { title: 'Acesso negado' } },
];

/** `**` (SCR-M01-06): página não encontrada, com link ao painel. */
export const NOT_FOUND_ROUTES: Routes = [
  { path: '', component: NotFoundPageComponent, data: { title: 'Página não encontrada' } },
];
