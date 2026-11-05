import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuditLogService } from '@core/audit';
import { AuthService } from '@core/auth';
import { Database } from '@core/data';
import { GroupsService } from './groups.service';

function deny(url: string, why: string) {
  inject(AuditLogService).denied('route', `${why}: ${url}`);
  return inject(Router).createUrlTree(['/403']);
}

/** Nova atividade: a sócia e o psicólogo (que conduz o grupo). O RT valida o enquadramento; o atendimento só inscreve. */
export const groupsCreateGuard: CanActivateFn = (_route, state) =>
  inject(GroupsService).canCreate() ? true : deny(state.url, 'sem permissão para criar atividade');

/** Editar e marcar presença: a sócia em tudo, o psicólogo nos grupos que conduz. */
export const groupsManageGuard: CanActivateFn = (route, state) => {
  const db = inject(Database);
  const svc = inject(GroupsService);
  const activity = db.activities.get(route.paramMap.get('id') ?? '');
  return !activity || svc.canManage(activity) ? true : deny(state.url, 'sem permissão na atividade');
};

/** Indicadores: sócia e psicólogo (as suas atividades); o RT e o atendimento consultam a programação. */
export const groupsIndicatorsGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  return auth.hasRole('partner', 'psychologist', 'technical_lead') ? true : deny(state.url, 'sem permissão nos indicadores');
};
