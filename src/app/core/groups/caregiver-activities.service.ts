import { Injectable, inject } from '@angular/core';
import { AuditLogService } from '../audit/audit-log.service';
import { CaregiverOwnership, NOT_OWNER_TEXT } from '../auth/caregiver-ownership';
import { Clock } from '../clock/clock.service';
import { compareDateTimes } from '../clock/date-utils';
import { Database } from '../data/database';
import { planIdOfCaregiver } from '../data/plan-lookup';
import { Activity, ActivityEnrollment, ActivityMeeting, ID, ISODateTime } from '../models';
import { canAccessActivity } from '../rules/plans';
import { GroupMembershipService } from './group-membership.service';

/** Situação da pessoa diante de uma atividade (para a tela decidir o botão, sem recalcular regra). */
export type ActivityStanding =
  /** O plano não inclui (grupo de apoio e capacitação são do Cuida em diante, RN-GRP-02). */
  | { kind: 'plan_locked' }
  /** Já está inscrita. */
  | { kind: 'enrolled'; enrollment: ActivityEnrollment }
  /** Está na lista de espera, com a posição (S-20). */
  | { kind: 'waitlist'; enrollment: ActivityEnrollment; position: number }
  /** A atividade começou: as inscrições estão encerradas. */
  | { kind: 'in_progress' }
  /** Terapia de grupo: só entra com a indicação do psicólogo (RN-GRP-14); a tela não diz o motivo clínico. */
  | { kind: 'needs_indication' }
  /** Pode entrar; `full` diz se o botão é "Entrar na lista de espera", com a posição que a pessoa teria. */
  | { kind: 'can_join'; full: boolean; position: number | null };

export type EnrollOutcome = { ok: true; waitlisted: boolean; enrollment: ActivityEnrollment; position: number | null } | { ok: false; error: string };

/**
 * Grupos e capacitações vistos pelo cuidador (RN-GRP-01 a 03, 09, 13, 14, 16, 17, RN-PLN-10, RN-PLN-19). O miolo das
 * vagas, da lista de espera e da perda de acesso por plano continua sendo do `GroupMembershipService`; aqui ficam a
 * leitura "como o cuidador vê" e a inscrição feita por ele mesmo, sem a checagem de perfil da equipe.
 *
 * - Só aparecem atividades abertas, lotadas ou em andamento (rascunho, cancelada e encerrada não).
 * - Grupo de apoio e capacitação exigem o plano Cuida ou acima; a roda aberta vale para todos (`canAccessActivity`).
 * - O aceite do contrato de sigilo é obrigatório e é gravado com data e hora (RN-GRP-09).
 * - Terapia de grupo só com a indicação do psicólogo do caso (RN-GRP-14): sem inscrição feita pelo psicólogo, o
 *   cuidador não entra sozinho. Nenhuma frase fala de pontuação, faixa ou alerta (RN-PLN-19).
 */
@Injectable({ providedIn: 'root' })
export class CaregiverActivitiesService {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly audit = inject(AuditLogService);
  private readonly membership = inject(GroupMembershipService);
  private readonly ownership = inject(CaregiverOwnership);

  // ===== Leitura =====

  /** A programação: atividades abertas, lotadas e em andamento, a mais próxima primeiro. */
  programme(): Activity[] {
    return this.db.activities
      .query((a) => a.status === 'open' || a.status === 'full' || a.status === 'in_progress')
      .sort((a, b) => this.sortKey(a).localeCompare(this.sortKey(b)) || a.id.localeCompare(b.id));
  }

  /** Uma atividade da programação; `undefined` para rascunho, cancelada, encerrada ou inexistente. */
  visible(activityId: ID): Activity | undefined {
    const activity = this.db.activities.get(activityId);
    return activity && (activity.status === 'open' || activity.status === 'full' || activity.status === 'in_progress')
      ? activity
      : undefined;
  }

  /** Próximo encontro que ainda não aconteceu. */
  nextMeeting(activity: Activity): ActivityMeeting | undefined {
    const now = this.clock.now();
    return [...activity.meetings]
      .filter((m) => !m.done && compareDateTimes(m.startAt, now) >= 0)
      .sort((a, b) => a.startAt.localeCompare(b.startAt))[0];
  }

  seatsFree(activity: Pick<Activity, 'id' | 'capacity'>): number {
    return this.membership.seatsFree(activity);
  }

  /** Inscrições ativas (inscrita ou em lista de espera) do cuidador, em atividades da programação. */
  myEnrollments(caregiverId: ID): { activity: Activity; enrollment: ActivityEnrollment }[] {
    if (!this.ownership.ownsCaregiver(caregiverId)) {
      return [];
    }
    return this.db.activityEnrollments
      .query((e) => e.caregiverId === caregiverId && (e.status === 'enrolled' || e.status === 'waitlist'))
      .flatMap((enrollment) => {
        const activity = this.visible(enrollment.activityId);
        return activity ? [{ activity, enrollment }] : [];
      })
      .sort((a, b) => this.sortKey(a.activity).localeCompare(this.sortKey(b.activity)));
  }

  /** A situação da pessoa nesta atividade. */
  standingOf(caregiverId: ID, activity: Activity): ActivityStanding {
    const mine = this.db.activityEnrollments.find(
      (e) => e.activityId === activity.id && e.caregiverId === caregiverId && (e.status === 'enrolled' || e.status === 'waitlist'),
    );
    if (mine?.status === 'enrolled') {
      return { kind: 'enrolled', enrollment: mine };
    }
    if (mine?.status === 'waitlist') {
      return { kind: 'waitlist', enrollment: mine, position: mine.waitlistPosition ?? this.membership.nextWaitlistPosition(activity.id) };
    }
    if (!canAccessActivity(planIdOfCaregiver(this.db, caregiverId), activity.kind).allowed) {
      return { kind: 'plan_locked' };
    }
    if (!this.membership.acceptsEnrollment(activity)) {
      return { kind: 'in_progress' };
    }
    if (activity.kind === 'group_therapy') {
      return { kind: 'needs_indication' };
    }
    const full = this.membership.seatsFree(activity) === 0;
    return { kind: 'can_join', full, position: full ? this.membership.nextWaitlistPosition(activity.id) : null };
  }

  // ===== Ações =====

  /**
   * O cuidador entra na atividade (ou na lista de espera, se estiver lotada). `acceptedAt` é o instante em que a caixa
   * do contrato de sigilo foi marcada; sem ele vale agora. Lotada, entra na fila sem tirar ninguém (RN-GRP-13).
   */
  enroll(caregiverId: ID, activityId: ID, options: { contractAccepted: boolean; acceptedAt?: ISODateTime }): EnrollOutcome {
    if (!this.ownership.ownsCaregiver(caregiverId)) {
      return { ok: false, error: NOT_OWNER_TEXT };
    }
    const activity = this.visible(activityId);
    const caregiver = this.db.caregivers.get(caregiverId);
    if (!activity || !caregiver || caregiver.status === 'closed') {
      return { ok: false, error: 'Não encontramos esta atividade.' };
    }
    const standing = this.standingOf(caregiverId, activity);
    if (standing.kind === 'plan_locked') {
      return { ok: false, error: 'Esta atividade faz parte do plano Cuida. Veja os planos para saber mais.' };
    }
    if (standing.kind === 'enrolled' || standing.kind === 'waitlist') {
      return { ok: false, error: 'Você já está nesta atividade.' };
    }
    if (standing.kind === 'in_progress') {
      return { ok: false, error: 'Esta atividade já começou. As inscrições estão encerradas.' };
    }
    if (standing.kind === 'needs_indication') {
      return { ok: false, error: 'Esta atividade começa com a indicação do seu psicólogo. Fale com a gente.' };
    }
    if (!options.contractAccepted) {
      return { ok: false, error: 'Marque que você leu o contrato de sigilo para entrar.' };
    }
    const full = standing.full;
    const enrollment = this.db.activityEnrollments.create({
      activityId: activity.id,
      caregiverId,
      status: full ? 'waitlist' : 'enrolled',
      ...(full ? { waitlistPosition: this.membership.nextWaitlistPosition(activity.id) } : {}),
      confidentialityAcceptedAt: options.acceptedAt ?? this.clock.now(),
      attendance: [],
    });
    this.membership.syncStatus(activity.id);
    this.audit.write(
      'create',
      'activity_enrollment',
      enrollment.id,
      caregiverId,
      full ? 'entrada na lista de espera pelo cuidador' : 'inscrição feita pelo cuidador',
    );
    return { ok: true, waitlisted: full, enrollment, position: full ? (enrollment.waitlistPosition ?? null) : null };
  }

  /** O cuidador sai da atividade ou da lista de espera; a vaga volta e o primeiro da fila é promovido (RN-GRP-13). */
  leave(caregiverId: ID, enrollmentId: ID): { ok: true; promoted: ActivityEnrollment[] } | { ok: false; error: string } {
    const enrollment = this.db.activityEnrollments.get(enrollmentId);
    if (!enrollment || enrollment.caregiverId !== caregiverId || !this.ownership.ownsCaregiver(caregiverId)) {
      return { ok: false, error: 'Não encontramos esta inscrição.' };
    }
    if (enrollment.status !== 'enrolled' && enrollment.status !== 'waitlist') {
      return { ok: false, error: 'Você já não está nesta atividade.' };
    }
    const change = this.membership.cancelEnrollment(enrollmentId, 'saída pedida pelo cuidador');
    return { ok: true, promoted: change.promoted };
  }

  private sortKey(activity: Activity): string {
    const meeting = this.nextMeeting(activity);
    // Em andamento sem encontro futuro vai para o fim; as demais pela data do próximo encontro.
    return meeting ? meeting.startAt : '9999';
  }
}
