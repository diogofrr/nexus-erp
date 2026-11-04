import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { canOpenRoute, canUseSubArea } from '../../../core/auth/permissions';
import { AuditLogService } from '../../../core/audit/audit-log.service';
import { Role } from '../../../core/models/access';

/**
 * Guarda de uma área de Configurações (M15). A sócia abre todas; o responsável técnico só `arbe` e
 * `guidance_content` (matriz do escopo, 1.2: "apenas ARBE e conteúdos"). Quem não pode vai a `/403` e
 * grava `denied`, sem revelar se a tela existe (AC-GL-04, AC-M15-08).
 */
export function settingsAreaGuard(area: string): CanActivateFn {
  return (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const audit = inject(AuditLogService);
    if (!auth.isAuthenticated()) {
      auth.setReturnUrl(state.url);
      return router.createUrlTree(['/login']);
    }
    const role = auth.role() as Role;
    if (canOpenRoute(role, 'settings') && canUseSubArea(role, 'settings', area)) {
      return true;
    }
    audit.denied('route', `sem acesso à área ${area} de configurações: ${state.url}`);
    return router.createUrlTree(['/403']);
  };
}
