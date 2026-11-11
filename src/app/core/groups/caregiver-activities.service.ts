import { Injectable, inject } from '@angular/core';
import { AuditLogService } from '../audit/audit-log.service';
import { CaregiverOwnership, NOT_OWNER_TEXT } from '../auth/caregiver-ownership';
import { Clock } from '../clock/clock.service';
import { compareDateTimes } from '../clock/date-utils';
import { Database } from '../data/database';
import { planIdOfCaregiver } from '../data/plan-lookup';
import { Activity, ActivityEnrollment, ActivityKind, ActivityMeeting, ID, ISODateTime } from '../models';
import { EnrollmentOffer } from '../rules/plan-quotas';
import { canAccessActivity } from '../rules/plans';
import { GroupMembershipService } from './group-membership.service';

/** Situação da pessoa diante de um encontro (para a tela decidir o botão, sem recalcular regra). */
export type ActivityStanding =
  /** O plano não inclui o tipo (terapia de grupo no Livre e no Essencial). A tela nem lista esses encontros. */
  | { kind: 'plan_locked' }
  /** Já está inscrita. */
  | { kind: 'enrolled'; enrollment: ActivityEnrollment }
  /** Está na lista de espera, com a posição (S-20). */
  | { kind: 'waitlist'; enrollment: ActivityEnrollment; position: number }
  /** O encontro começou: as inscrições estão encerradas. */
  | { kind: 'in_progress' }
  /** Pode entrar; `full` diz se o botão é "Entrar na lista de espera", com a posição que a pessoa teria; `offer` diz se é incluída, avulsa ou grátis. */
  | { kind: 'can_join'; full: boolean; position: number | null; offer: EnrollmentOffer };

export type EnrollOutcome =
  | { ok: true; waitlisted: boolean; enrollment: ActivityEnrollment; position: number | null; offer: EnrollmentOffer }
  | { ok: false; error: string };

/** Mensagem do domínio quando o plano não inclui a terapia de grupo. A tela do cuidador não a mostra (regra de exibição 1). */
export const GROUP_THERAPY_PLAN_BLOCKED = 'A terapia de grupo faz parte dos planos Cuida e Sustenta.';

/**
 * Encontros vistos pelo cuidador (docs/20-regras-planos-v2.md; RN-GRP-03, 09, 13, 17, RN-PLN-19). O miolo das vagas, da
 * lista de espera, das cotas e da perda de acesso por plano é do `GroupMembershipService`; aqui ficam a leitura "como o
 * cuidador vê" e a inscrição feita por ele mesmo, sem a checagem de perfil da equipe.
 *
 * - Só aparecem encontros abertos, lotados ou em andamento (rascunho, cancelado e encerrado não).
 * - **Regra de exibição 2 do docs/20**: o que o plano não dá acesso NÃO é listado (nem como vitrine). Livre e Essencial
 *   veem rodas abertas e capacitações; Cuida e Sustenta veem tudo. Quem já está inscrita vê o que é dela (RN-GRP-17).
 * - Roda aberta: todos, sem cota. Capacitação: todos os cadastrados, incluída quando cabe na cota, senão avulsa a R$ 40,00
 *   o encontro (pagamento simulado). Terapia de grupo: só Cuida e Sustenta, 2 encontros por mês na cota, além dela avulsa.
 * - O aceite do contrato de sigilo é obrigatório e é gravado com data e hora (RN-GRP-09).
 * - Nenhuma frase fala de pontuação, faixa ou alerta (RN-PLN-19).
 */
@Injectable({ providedIn: 'root' })
export class CaregiverActivitiesService {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly audit = inject(AuditLogService);
  private readonly membership = inject(GroupMembershipService);
  private readonly ownership = inject(CaregiverOwnership);

  // ===== Leitura =====

  /** Toda a programação: encontros abertos, lotados e em andamento, o mais próximo primeiro (sem filtro de plano). */
  programme(): Activity[] {
    return this.db.activities
      .query((a) => a.status === 'open' || a.status === 'full' || a.status === 'in_progress')
      .sort((a, b) => this.sortKey(a).localeCompare(this.sortKey(b)) || a.id.localeCompare(b.id));
  }

  /** A programação que ESTA pessoa pode ver (docs/20, regra 2): só os tipos que o plano dá acesso, mais o que ela já tem. */
  visibleProgramme(caregiverId: ID): Activity[] {
    const planId = planIdOfCaregiver(this.db, caregiverId);
    const mine = new Set(this.myEnrollments(caregiverId).map((m) => m.activity.id));
    return this.programme().filter((a) => mine.has(a.id) || canAccessActivity(planId, a.kind).allowed);
  }

  /** Os tipos de encontro que a pessoa pode ver (para a tela montar as seções e o filtro). */
  visibleKinds(caregiverId: ID): ActivityKind[] {
    const planId = planIdOfCaregiver(this.db, caregiverId);
    return (['open_circle', 'training', 'group_therapy'] as const).filter((kind) => canAccessActivity(planId, kind).allowed);
  }

  /** Um encontro da programação; `undefined` para rascunho, cancelado, encerrado ou inexistente. */
  visible(activityId: ID): Activity | undefined {
    const activity = this.db.activities.get(activityId);
    return activity && (activity.status === 'open' || activity.status === 'full' || activity.status === 'in_progress')
      ? activity
      : undefined;
  }

  /** Um encontro que ESTA pessoa pode abrir: da programação e do tipo que o plano dá acesso (ou em que ela já está). */
  visibleTo(caregiverId: ID, activityId: ID): Activity | undefined {
    const activity = this.visible(activityId);
    if (!activity) {
      return undefined;
    }
    const enrolled = this.myEnrollments(caregiverId).some((m) => m.activity.id === activity.id);
    return enrolled || canAccessActivity(planIdOfCaregiver(this.db, caregiverId), activity.kind).allowed ? activity : undefined;
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

  /** O que a inscrição custa para esta pessoa (incluída, avulsa, grátis ou bloqueada). */
  offerFor(caregiverId: ID, activity: Activity): EnrollmentOffer {
    return this.membership.offerFor(activity, caregiverId);
  }

  /** Inscrições ativas (inscrita ou em lista de espera) do cuidador, em encontros da programação. */
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

  /** A situação da pessoa neste encontro. */
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
    const full = this.membership.seatsFree(activity) === 0;
    return {
      kind: 'can_join',
      full,
      position: full ? this.membership.nextWaitlistPosition(activity.id) : null,
      offer: this.membership.offerFor(activity, caregiverId),
    };
  }

  // ===== Ações =====

  /**
   * O cuidador entra no encontro (ou na lista de espera, se estiver lotado). `acceptedAt` é o instante em que a caixa do
   * contrato de sigilo foi marcada; sem ele vale agora. Lotado, entra na fila sem tirar ninguém (RN-GRP-13). A inscrição
   * grava se consome a cota (`includedInPlan`) ou se é avulsa (`paid`, com o valor; pagamento simulado).
   */
  enroll(caregiverId: ID, activityId: ID, options: { contractAccepted: boolean; acceptedAt?: ISODateTime }): EnrollOutcome {
    if (!this.ownership.ownsCaregiver(caregiverId)) {
      return { ok: false, error: NOT_OWNER_TEXT };
    }
    const activity = this.visible(activityId);
    const caregiver = this.db.caregivers.get(caregiverId);
    if (!activity || !caregiver || caregiver.status === 'closed') {
      return { ok: false, error: 'Não encontramos este encontro.' };
    }
    const standing = this.standingOf(caregiverId, activity);
    if (standing.kind === 'plan_locked') {
      return { ok: false, error: GROUP_THERAPY_PLAN_BLOCKED };
    }
    if (standing.kind === 'enrolled' || standing.kind === 'waitlist') {
      return { ok: false, error: 'Você já está neste encontro.' };
    }
    if (standing.kind === 'in_progress') {
      return { ok: false, error: 'Este encontro já começou. As inscrições estão encerradas.' };
    }
    if (!options.contractAccepted) {
      return { ok: false, error: 'Marque que você leu o contrato de sigilo para entrar.' };
    }
    const full = standing.full;
    const offer = standing.offer;
    const enrollment = this.db.activityEnrollments.create({
      activityId: activity.id,
      caregiverId,
      status: full ? 'waitlist' : 'enrolled',
      ...(full ? { waitlistPosition: this.membership.nextWaitlistPosition(activity.id) } : {}),
      confidentialityAcceptedAt: options.acceptedAt ?? this.clock.now(),
      includedInPlan: offer.kind === 'included',
      paid: offer.kind === 'paid',
      priceCents: offer.priceCents,
      attendance: [],
    });
    this.membership.syncStatus(activity.id);
    this.audit.write(
      'create',
      'activity_enrollment',
      enrollment.id,
      caregiverId,
      full
        ? 'entrada na lista de espera pelo cuidador'
        : offer.kind === 'paid'
          ? 'inscrição avulsa feita pelo cuidador (pagamento simulado)'
          : 'inscrição feita pelo cuidador',
    );
    return { ok: true, waitlisted: full, enrollment, position: full ? (enrollment.waitlistPosition ?? null) : null, offer };
  }

  /** O cuidador sai do encontro ou da lista de espera; a vaga volta e o primeiro da fila é promovido (RN-GRP-13). */
  leave(caregiverId: ID, enrollmentId: ID): { ok: true; promoted: ActivityEnrollment[] } | { ok: false; error: string } {
    const enrollment = this.db.activityEnrollments.get(enrollmentId);
    if (!enrollment || enrollment.caregiverId !== caregiverId || !this.ownership.ownsCaregiver(caregiverId)) {
      return { ok: false, error: 'Não encontramos esta inscrição.' };
    }
    if (enrollment.status !== 'enrolled' && enrollment.status !== 'waitlist') {
      return { ok: false, error: 'Você já não está neste encontro.' };
    }
    const change = this.membership.cancelEnrollment(enrollmentId, 'saída pedida pelo cuidador');
    return { ok: true, promoted: change.promoted };
  }

  private sortKey(activity: Activity): string {
    const meeting = this.nextMeeting(activity);
    // Em andamento sem encontro futuro vai para o fim; os demais pela data do próximo encontro.
    return meeting ? meeting.startAt : '9999';
  }
}
