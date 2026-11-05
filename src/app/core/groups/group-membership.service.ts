import { Injectable, inject } from '@angular/core';
import { AuditLogService } from '../audit/audit-log.service';
import { Clock } from '../clock/clock.service';
import { compareDateTimes } from '../clock/date-utils';
import { Database } from '../data/database';
import { planIdOfCaregiver } from '../data/plan-lookup';
import { Activity, ActivityEnrollment, ID } from '../models';
import { canAccessActivity } from '../rules/plans';

export interface MembershipChange {
  /** Inscrição que foi cancelada. */
  cancelled: ActivityEnrollment;
  /** Quem saiu da lista de espera e entrou na turma por causa da vaga aberta. */
  promoted: ActivityEnrollment[];
}

/**
 * Vagas, lista de espera e perda de acesso por mudança de plano (M07, RN-GRP-13, RN-GRP-17). Fica no núcleo
 * porque a regra é disparada por mais de um módulo: a tela de grupos cancela e promove, e a mudança de plano
 * (M04) tira o cuidador das turmas futuras.
 *
 * - A turma lotada abre lista de espera; vaga liberada promove o primeiro da fila (promoção automática).
 * - `Activity.status` vai de `open` a `full` e volta conforme as vagas.
 * - Cuidador que cai de plano e perde o acesso sai das turmas que ainda não começaram; as turmas em andamento
 *   no ciclo já pago permanecem (AC-M07-09).
 *
 * O módulo de assinaturas (M04) chama `reconcilePlanLoss(caregiverId)` quando uma descida de plano ou um
 * cancelamento passa a valer (`SubscriptionService.applyDueChanges`), e o de empresas (M09) quando o contrato
 * devolve o cuidador ao Livre. As telas de grupos também conferem sozinhas ao abrir (`reconcileAll`), então o
 * estado se corrige de qualquer jeito.
 */
@Injectable({ providedIn: 'root' })
export class GroupMembershipService {
  private readonly db = inject(Database);
  private readonly audit = inject(AuditLogService);
  private readonly clock = inject(Clock);

  /** Vagas ocupadas: inscritos que continuam na turma (não conta lista de espera nem cancelados). */
  seatsTaken(activityId: ID): number {
    return this.db.activityEnrollments.count(
      (e) => e.activityId === activityId && this.holdsSeat(e),
    );
  }

  seatsFree(activity: Pick<Activity, 'id' | 'capacity'>): number {
    return Math.max(0, activity.capacity - this.seatsTaken(activity.id));
  }

  /** Lista de espera na ordem de chegada. */
  waitlist(activityId: ID): ActivityEnrollment[] {
    return this.db.activityEnrollments
      .query((e) => e.activityId === activityId && e.status === 'waitlist')
      .sort(
        (a, b) =>
          (a.waitlistPosition ?? Number.MAX_SAFE_INTEGER) -
            (b.waitlistPosition ?? Number.MAX_SAFE_INTEGER) || a.createdAt.localeCompare(b.createdAt),
      );
  }

  /** Posição que a próxima pessoa teria na lista de espera. */
  nextWaitlistPosition(activityId: ID): number {
    return this.waitlist(activityId).length + 1;
  }

  /** Confere `open` e `full` com as vagas (volta a `open` se uma vaga abre). Outros estados não mudam. */
  syncStatus(activityId: ID): Activity | undefined {
    const activity = this.db.activities.get(activityId);
    if (!activity || (activity.status !== 'open' && activity.status !== 'full')) {
      return activity;
    }
    const full = this.seatsTaken(activityId) >= activity.capacity;
    const next = full ? 'full' : 'open';
    return next === activity.status ? activity : this.db.activities.update(activityId, { status: next });
  }

  /** Cancela a inscrição e promove quem estava na fila, se uma vaga abriu. */
  cancelEnrollment(enrollmentId: ID, detail = 'inscrição cancelada'): MembershipChange {
    const enrollment = this.db.activityEnrollments.require(enrollmentId);
    const heldSeat = this.holdsSeat(enrollment);
    const cancelled = this.db.activityEnrollments.update(enrollmentId, {
      status: 'cancelled',
      waitlistPosition: undefined,
    });
    this.audit.write(
      'update',
      'activity_enrollment',
      enrollmentId,
      enrollment.caregiverId,
      detail,
    );
    const promoted = heldSeat ? this.fillSeats(enrollment.activityId) : [];
    this.renumberWaitlist(enrollment.activityId);
    this.syncStatus(enrollment.activityId);
    return { cancelled, promoted };
  }

  /** Promove, na ordem, quem está na fila enquanto houver vaga e a turma aceitar inscrições. */
  fillSeats(activityId: ID): ActivityEnrollment[] {
    const activity = this.db.activities.get(activityId);
    if (!activity || !this.acceptsEnrollment(activity)) {
      return [];
    }
    const promoted: ActivityEnrollment[] = [];
    for (const next of this.waitlist(activityId)) {
      if (this.seatsTaken(activityId) >= activity.capacity) {
        break;
      }
      promoted.push(
        this.db.activityEnrollments.update(next.id, { status: 'enrolled', waitlistPosition: undefined }),
      );
      this.audit.write('update', 'activity_enrollment', next.id, next.caregiverId, 'promovido da lista de espera');
    }
    this.renumberWaitlist(activityId);
    return promoted;
  }

  /**
   * Tira o cuidador das turmas futuras a que o plano atual não dá acesso (RN-GRP-17). Sem `caregiverId`,
   * confere todos. Turma em andamento permanece até o fim do ciclo. Devolve o que foi cancelado.
   */
  reconcilePlanLoss(caregiverId?: ID): MembershipChange[] {
    const changes: MembershipChange[] = [];
    const candidates = this.db.activityEnrollments.query(
      (e) =>
        e.caregiverId !== undefined &&
        (caregiverId === undefined || e.caregiverId === caregiverId) &&
        (e.status === 'enrolled' || e.status === 'waitlist'),
    );
    candidates.forEach((enrollment) => {
      const activity = this.db.activities.get(enrollment.activityId);
      if (!activity || !this.isFuture(activity)) {
        return;
      }
      const plan = planIdOfCaregiver(this.db, enrollment.caregiverId as ID);
      if (canAccessActivity(plan, activity.kind).allowed) {
        return;
      }
      changes.push(
        this.cancelEnrollment(enrollment.id, 'saída da turma por mudança de plano (sem acesso)'),
      );
    });
    return changes;
  }

  reconcileAll(): MembershipChange[] {
    return this.reconcilePlanLoss();
  }

  /**
   * A turma ainda não começou: rascunho, aberta ou lotada E sem encontro anterior a agora. O estado sozinho não
   * basta, porque uma turma "aberta" ou "lotada" pode já ter passado do primeiro encontro (o estado só muda
   * quando alguém o atualiza); as turmas em andamento no ciclo já pago permanecem (AC-M07-09).
   */
  isFuture(activity: Pick<Activity, 'status' | 'meetings'>): boolean {
    if (activity.status !== 'draft' && activity.status !== 'open' && activity.status !== 'full') {
      return false;
    }
    const first = [...activity.meetings].sort((a, b) => a.startAt.localeCompare(b.startAt))[0];
    return !first || compareDateTimes(first.startAt, this.clock.now()) > 0;
  }

  acceptsEnrollment(activity: Pick<Activity, 'status'>): boolean {
    return activity.status === 'open' || activity.status === 'full';
  }

  private holdsSeat(enrollment: Pick<ActivityEnrollment, 'status'>): boolean {
    return (
      enrollment.status === 'enrolled' ||
      enrollment.status === 'attended' ||
      enrollment.status === 'absent'
    );
  }

  private renumberWaitlist(activityId: ID): void {
    this.waitlist(activityId).forEach((enrollment, index) => {
      if (enrollment.waitlistPosition !== index + 1) {
        this.db.activityEnrollments.update(enrollment.id, { waitlistPosition: index + 1 });
      }
    });
  }
}
