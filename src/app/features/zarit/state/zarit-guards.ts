import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuditLogService } from '@core/audit';
import { AuthService } from '@core/auth';
import { Database } from '@core/data';

function deny(url: string, why: string) {
  inject(AuditLogService).denied('route', `${why}: ${url}`);
  return inject(Router).createUrlTree(['/403']);
}

/**
 * `individual`: resultado e alertas de um cuidador (psicólogo do caso e RT, matriz 1.2). `aggregate`: painel
 * agregado (sócia, RT e psicólogo, sempre com mínimo de 5 por recorte). O atendimento não abre nenhum dos dois.
 */
export function zaritAreaGuard(area: 'individual' | 'aggregate'): CanActivateFn {
  return (_route, state) => {
    const auth = inject(AuthService);
    const allowed =
      area === 'individual' ? auth.can('zarit_individual', 'view') : auth.can('zarit_aggregate', 'view_aggregate');
    return allowed ? true : deny(state.url, `sem permissão em ${area}`);
  };
}

/**
 * Caso de outro psicólogo por URL: bloqueia e grava `denied` (AC-M06-15). `param` é o parâmetro da rota e
 * `source` diz se ele traz o id do cuidador ou o do alerta. Em `apply`, só o psicólogo do caso passa (o RT supervisiona
 * e não aplica a escala, RN-ZRT-04).
 */
export function zaritCaseGuard(
  param: string,
  source: 'caregiver' | 'alert',
  mode: 'view' | 'apply',
): CanActivateFn {
  return (route, state) => {
    const auth = inject(AuthService);
    const db = inject(Database);
    const raw = route.paramMap.get(param) ?? '';
    const caregiverId = source === 'alert' ? db.zaritAlerts.get(raw)?.caregiverId : raw;
    const caregiver = caregiverId ? db.caregivers.get(caregiverId) : undefined;
    const actor = auth.actor();
    if (!auth.can('zarit_individual', 'view')) {
      return deny(state.url, 'sem permissão no acompanhamento');
    }
    if (actor?.role === 'psychologist' && caregiver && caregiver.assignedPsychologistId !== actor.psychologistId) {
      return deny(state.url, 'caso de outro psicólogo');
    }
    if (mode === 'apply' && actor?.role !== 'psychologist') {
      return deny(state.url, 'só o psicólogo do caso aplica a escala');
    }
    return true;
  };
}

/**
 * Porta de entrada (`/app/acompanhamento`): mostra a fila para o psicólogo e o RT; a sócia vai ao painel agregado;
 * as chaves do sino (`?filtro=`) que pertencem a outra lista levam a ela.
 */
export const zaritHomeGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const filtro = route.queryParamMap.get('filtro');
  if (auth.role() === 'partner') {
    return router.createUrlTree(['/app/acompanhamento/agregado']);
  }
  if (!auth.can('zarit_individual', 'view')) {
    return deny(state.url, 'sem permissão no acompanhamento');
  }
  if (filtro === 'pedidos-de-revisao') {
    return router.createUrlTree(['/app/acompanhamento/revisoes']);
  }
  if (filtro === 'alertas-a-confirmar') {
    return router.createUrlTree(['/app/acompanhamento/arbe']);
  }
  return true;
};
