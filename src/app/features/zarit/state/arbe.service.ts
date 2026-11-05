import { Injectable, inject } from '@angular/core';
import { AuditLogService } from '@core/audit';
import { Clock, dateOf } from '@core/clock';
import { Database } from '@core/data';
import { ArbeAlert, ID } from '@core/models';
import { ConsentService } from '@core/privacy/consent.service';
import { countSupportRequests, evaluateArbe, isArbeAlertOpen } from '@core/rules';
import { ZaritAccessService } from './zarit-access.service';

export interface ArbeFieldError {
  field: string;
  message: string;
}

export type ArbeResult<T> = { ok: true; value: T } | { ok: false; errors: ArbeFieldError[] };

/** Marca dos descartes feitos pelo próprio sistema ao recalcular com limites novos. */
const AUTO_DISCARD_PREFIX = 'Limites da ARBE alterados';

function fail<T>(field: string, message: string): ArbeResult<T> {
  return { ok: false, errors: [{ field, message }] };
}

/**
 * ARBE (RN-ARBE-01 a 10): cruza horas diárias de cuidado, pedidos de apoio e a última Zarit. O alerta nasce
 * `generated` por regra e só vira `confirmed` quando um psicólogo o revisa; depois vem o contato e o
 * encerramento, ou o descarte com motivo. Não é diagnóstico: é um sinal para a escuta clínica.
 *
 * O cálculo usa os limites de `AppSettings.arbe` (editáveis pelo RT em M15). `recomputeAll` é idempotente:
 * não gera alerta novo enquanto houver um aberto do mesmo nível (RN-ARBE-08), nem repete o alerta já tratado
 * para a mesma aplicação da escala. Cuidador sem consentimento de saúde ou pausado sai do cálculo (RN-ARBE-09).
 */
@Injectable({ providedIn: 'root' })
export class ArbeService {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly audit = inject(AuditLogService);
  private readonly consent = inject(ConsentService);
  private readonly access = inject(ZaritAccessService);

  /** Confere um cuidador com os limites atuais. Devolve o alerta gerado agora, se houve. */
  evaluateCaregiver(caregiverId: ID): ArbeAlert | null {
    const caregiver = this.db.caregivers.get(caregiverId);
    const existing = this.db.arbeAlerts.query((a) => a.caregiverId === caregiverId);
    if (
      !caregiver ||
      caregiver.status !== 'active' ||
      !caregiver.assignedPsychologistId ||
      !this.consent.isActive(caregiverId, 'health_data')
    ) {
      return null;
    }
    const settings = this.db.settings.get().arbe;
    const today = this.clock.today();
    const completed = this.db.zaritAssessments
      .query((z) => z.caregiverId === caregiverId && z.status === 'completed' && z.total !== undefined)
      .sort((a, b) => (a.appliedAt ?? '').localeCompare(b.appliedAt ?? ''));
    const last = completed.at(-1);
    const result = evaluateArbe(
      {
        dailyCareHours: caregiver.dailyCareHours,
        supportRequestsInWindow: countSupportRequests(
          this.db.messages.list(),
          caregiverId,
          today,
          settings.windowDays,
        ),
        lastZarit: last?.total ?? null,
      },
      settings,
    );
    // Alertas ainda não revisados que não valem mais (limites novos, outro nível) saem de cena com motivo.
    existing
      .filter((a) => a.status === 'generated' && (!result || a.level !== result.level))
      .forEach((a) =>
        this.db.arbeAlerts.update(a.id, {
          status: 'discarded',
          discardReason: `${AUTO_DISCARD_PREFIX}: os critérios do nível ${a.level === 'critical' ? 'crítico' : 'de atenção'} deixaram de ser atendidos.`,
        }),
      );
    if (!result) {
      return null;
    }
    const appliedOn = last?.appliedAt ?? '';
    const covered = existing.some(
      (a) =>
        a.level === result.level &&
        (isArbeAlertOpen(a) ||
          (!(a.status === 'discarded' && a.discardReason?.startsWith(AUTO_DISCARD_PREFIX)) &&
            dateOf(a.generatedAt) >= appliedOn)),
    );
    if (covered) {
      return null;
    }
    const now = this.clock.now();
    return this.db.arbeAlerts.create({
      caregiverId,
      level: result.level,
      generatedAt: now,
      criteria: result.criteria,
      status: 'generated',
    });
  }

  /** Recalcula todos os cuidadores (limites novos, aplicação nova, pedido de apoio novo). Devolve quantos alertas nasceram. */
  recomputeAll(): number {
    let created = 0;
    this.db.caregivers.list().forEach((caregiver) => {
      if (this.evaluateCaregiver(caregiver.id)) {
        created += 1;
      }
    });
    return created;
  }

  // ===== Transições =====

  private guard(alert: ArbeAlert): ArbeResult<never> | null {
    if (!this.access.canAct(alert.caregiverId)) {
      return fail('alert', 'Só o psicólogo do caso e o responsável técnico tratam este alerta.');
    }
    return null;
  }

  /** `generated` para `confirmed`: o psicólogo revisou o alerta (RN-ARBE-04). */
  confirm(alertId: ID): ArbeResult<ArbeAlert> {
    const alert = this.db.arbeAlerts.require(alertId);
    const blocked = this.guard(alert);
    if (blocked) {
      return blocked;
    }
    if (alert.status !== 'generated') {
      return fail('alert', 'Só um alerta gerado pode ser confirmado.');
    }
    const updated = this.db.arbeAlerts.update(alertId, {
      status: 'confirmed',
      reviewedByUserId: this.access.actorUserId(),
    });
    this.audit.write('update', 'arbe_alert', alertId, alert.caregiverId, 'alerta confirmado');
    return { ok: true, value: updated };
  }

  /** `confirmed` para `contacted`: o contato com o cuidador foi feito. */
  registerContact(alertId: ID): ArbeResult<ArbeAlert> {
    const alert = this.db.arbeAlerts.require(alertId);
    const blocked = this.guard(alert);
    if (blocked) {
      return blocked;
    }
    if (alert.status !== 'confirmed') {
      return fail('alert', 'Confirme o alerta antes de registrar o contato.');
    }
    const updated = this.db.arbeAlerts.update(alertId, {
      status: 'contacted',
      contactedAt: this.clock.now(),
    });
    this.audit.write('update', 'arbe_alert', alertId, alert.caregiverId, 'contato registrado');
    return { ok: true, value: updated };
  }

  close(alertId: ID, note: string): ArbeResult<ArbeAlert> {
    const alert = this.db.arbeAlerts.require(alertId);
    const blocked = this.guard(alert);
    if (blocked) {
      return blocked;
    }
    if (alert.status !== 'contacted') {
      return fail('alert', 'Registre o contato antes de encerrar o alerta.');
    }
    if (note.trim().length < 3) {
      return fail('note', 'Escreva como o caso ficou antes de encerrar.');
    }
    const updated = this.db.arbeAlerts.update(alertId, {
      status: 'closed',
      closedAt: this.clock.now(),
      closureReason: note.trim(),
    });
    this.audit.write('update', 'arbe_alert', alertId, alert.caregiverId, 'alerta encerrado');
    return { ok: true, value: updated };
  }

  /** Descartar exige motivo escrito (`generated` ou `confirmed`, RN-ARBE-08). */
  discard(alertId: ID, reason: string): ArbeResult<ArbeAlert> {
    const alert = this.db.arbeAlerts.require(alertId);
    const blocked = this.guard(alert);
    if (blocked) {
      return blocked;
    }
    if (alert.status !== 'generated' && alert.status !== 'confirmed') {
      return fail('alert', 'Só um alerta gerado ou confirmado pode ser descartado.');
    }
    if (reason.trim().length < 5) {
      return fail('reason', 'Escreva o motivo do descarte.');
    }
    const updated = this.db.arbeAlerts.update(alertId, {
      status: 'discarded',
      discardReason: reason.trim(),
      reviewedByUserId: this.access.actorUserId(),
    });
    this.audit.write('update', 'arbe_alert', alertId, alert.caregiverId, 'alerta descartado');
    return { ok: true, value: updated };
  }
}
