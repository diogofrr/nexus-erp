import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuditLogService } from '@core/audit';
import { AuthService } from '@core/auth';
import { Database } from '@core/data';

/**
 * Registro de um cuidador (AC-M03-07): o psicólogo só abre os cuidadores atribuídos a ele. Link direto
 * para o de outro psicólogo, ou para um que não existe, mostra "Acesso negado" sem revelar se o recurso
 * existe e grava `denied` no log. Os outros perfis passam (a matriz e o módulo já foram checados acima).
 */
export const caregiverRecordGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const db = inject(Database);
  const audit = inject(AuditLogService);
  const router = inject(Router);
  if (auth.role() !== 'psychologist') {
    return true;
  }
  const mine = auth.actor()?.psychologistId;
  const caregiver = db.caregivers.get(route.paramMap.get('id') ?? '');
  if (caregiver && mine && caregiver.assignedPsychologistId === mine) {
    return true;
  }
  audit.denied('route', `caso de outro psicólogo: ${state.url.split('?')[0]}`);
  return router.createUrlTree(['/403']);
};
