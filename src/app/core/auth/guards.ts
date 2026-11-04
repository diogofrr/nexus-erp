/**
 * Guards funcionais de rota (AC-GL-04, AC-M01-06). Rota sem permissão leva a `/403` e grava `denied` no log,
 * sem revelar se o recurso existe.
 */
import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuditLogService } from '../audit/audit-log.service';
import { PermissionAction, Resource, Role } from '../models';
import { AuthService } from './auth.service';
import { ModuleKey, canAccessModule, homePathFor, moduleByKey } from './module-map';
import { can, canOpenRoute } from './permissions';

const FORBIDDEN_PATH = '/403';

function toLogin(router: Router, auth: AuthService, targetUrl: string): UrlTree {
  if (auth.isPendingTwoFactor()) {
    return router.createUrlTree(['/login', '2fa']);
  }
  auth.setReturnUrl(targetUrl);
  return router.createUrlTree(['/login']);
}

function deny(router: Router, audit: AuditLogService, url: string, why: string): UrlTree {
  audit.denied('route', `${why}: ${url}`);
  return router.createUrlTree([FORBIDDEN_PATH]);
}

/** Exige sessão completa (e 2FA, quando o perfil exige). Sem sessão, vai a `/login`. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? true : toLogin(router, auth, state.url);
};

/** Só para quem NÃO está logado (a entrada): quem já entrou vai à sua tela inicial. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const role = auth.role();
  return auth.isAuthenticated() && role ? router.createUrlTree([homePathFor(role)]) : true;
};

/**
 * Exige que o perfil possa abrir a TELA do recurso e, se informada, executar a ação.
 * `permissionGuard('zarit_individual')`, `permissionGuard('lgpd_audit_log', 'view')`.
 */
export function permissionGuard(
  resource: Resource,
  action: PermissionAction = 'view',
): CanActivateFn {
  return (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const audit = inject(AuditLogService);
    if (!auth.isAuthenticated()) {
      return toLogin(router, auth, state.url);
    }
    const role = auth.role() as Role;
    const allowed =
      canOpenRoute(role, resource) &&
      (action === 'view'
        ? can(role, resource, 'view') || can(role, resource, 'view_aggregate')
        : can(role, resource, action));
    return allowed ? true : deny(router, audit, state.url, `sem permissão em ${resource}`);
  };
}

/** Exige um dos perfis informados: `roleGuard('provider')` para o portal. */
export function roleGuard(...roles: Role[]): CanActivateFn {
  return (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const audit = inject(AuditLogService);
    if (!auth.isAuthenticated()) {
      return toLogin(router, auth, state.url);
    }
    return auth.hasRole(...roles) ? true : deny(router, audit, state.url, 'perfil não permitido');
  };
}

/** Exige acesso ao módulo do mapa (seção 2), pela matriz de permissões. É o guard das rotas `/app/*`. */
export function moduleGuard(key: ModuleKey): CanActivateFn {
  return (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const audit = inject(AuditLogService);
    if (!auth.isAuthenticated()) {
      return toLogin(router, auth, state.url);
    }
    const role = auth.role() as Role;
    return canAccessModule(role, moduleByKey(key))
      ? true
      : deny(router, audit, state.url, `sem acesso ao módulo ${key}`);
  };
}
