import { inject } from '@angular/core';
import { CanActivateFn, RedirectFunction, Router } from '@angular/router';
import { AuditLogService } from '@core/audit';
import { AuthService } from '@core/auth';
import { Database } from '@core/data';

/** Rota negada: grava `denied` e leva a `/403`, sem revelar se o recurso existe (AC-GL-04, AC-M05-12). */
function deny(url: string, why: string) {
  inject(AuditLogService).denied('route', `${why}: ${url}`);
  return inject(Router).createUrlTree(['/403']);
}

export type CareArea = 'schedule' | 'availability' | 'occupancy' | 'rooms';

/**
 * Cada tela do módulo tem a sua permissão (matriz 1.2): a sócia só abre Ocupação e Salas (horas e salas, sem
 * nenhum cuidador), o atendimento não abre Ocupação, e só o psicólogo define a própria disponibilidade.
 */
export function careAreaGuard(area: CareArea): CanActivateFn {
  return (_route, state) => {
    const auth = inject(AuthService);
    const allowed =
      area === 'schedule'
        ? auth.can('care_schedule', 'view')
        : area === 'availability'
          ? auth.hasRole('psychologist')
          : area === 'occupancy'
            ? auth.can('occupancy', 'view')
            : auth.can('rooms', 'view');
    return allowed ? true : deny(state.url, `sem permissão em ${area}`);
  };
}

/** Sessão de outro psicólogo é bloqueada para o psicólogo (AC-M05-12); o RT e o atendimento abrem. */
export function sessionAccessGuard(needsNote: boolean): CanActivateFn {
  return (route, state) => {
    const auth = inject(AuthService);
    const db = inject(Database);
    const allowed = needsNote
      ? auth.can('session_notes', 'view') || auth.can('session_notes', 'supervise')
      : auth.can('care_schedule', 'view');
    if (!allowed) {
      return deny(state.url, 'sem permissão na sessão');
    }
    const session = db.careSessions.get(route.paramMap.get('id') ?? '');
    const actor = auth.actor();
    if (session && actor?.role === 'psychologist' && actor.psychologistId !== session.psychologistId) {
      return deny(state.url, 'sessão de outro psicólogo');
    }
    return true;
  };
}

/** Porta de entrada do módulo: cada perfil cai na tela que a matriz lhe dá, e os filtros do sino levam à lista certa. */
export const careHomeRedirect: RedirectFunction = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const filtro = route.queryParams['filtro'] as string | undefined;
  if (auth.role() === 'partner' || filtro === 'minha-ocupacao') {
    return router.createUrlTree(['/app/atendimento/ocupacao']);
  }
  if (filtro === 'sem-anotacao') {
    return router.createUrlTree(['/app/atendimento/sessoes'], { queryParams: { filtro } });
  }
  return router.createUrlTree(['/app/atendimento/agenda']);
};
