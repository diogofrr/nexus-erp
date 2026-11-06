import { Injectable, inject } from '@angular/core';
import { AuditLogService } from '../audit/audit-log.service';
import { CaregiverOwnership, NOT_OWNER_TEXT } from '../auth/caregiver-ownership';
import { Clock } from '../clock/clock.service';
import { addMinutes, compareDateTimes, minutesBetween, toIsoDateTime } from '../clock/date-utils';
import { Database, NewEntity } from '../data';
import { planIdOfCaregiver } from '../data/plan-lookup';
import {
  AvailabilitySlot,
  CareSession,
  ID,
  PlanId,
  PsychologistProfile,
  Room,
  SessionModality,
} from '../models';
import { canSeePrioritySlots, sessionPriceCents } from '../rules/plans';
import { NAME_MAX_CHARS, isTooLong, tooLongText } from '../rules/text-limits';
import {
  RoomBooking,
  firstFreeRoom,
  isRoomBookable,
  isRoomFreeAt,
  roomBlockReason,
} from '../rules/rooms';

export interface BookingFieldError {
  field: string;
  message: string;
}

export type BookingResult<T> = { ok: true; value: T } | { ok: false; errors: BookingFieldError[] };

function fail<T>(field: string, message: string): BookingResult<T> {
  return { ok: false, errors: [{ field, message }] };
}

export interface BookingInput {
  caregiverId: ID;
  psychologistId: ID;
  slotId: ID;
  modality: SessionModality | null;
  roomId?: ID | null;
  homeAddress?: string;
  /** RN-ATD-09: "domicílio adequado e seguro". */
  homeSafe?: boolean;
  /**
   * Pedido feito pelo próprio cuidador no aplicativo: quem confirma que o local é adequado e seguro é o psicólogo, antes
   * de confirmar a conversa (RN-ATD-09). A sessão nasce com a segurança NÃO confirmada, e `CareSessionsService.confirm`
   * continua exigindo essa confirmação.
   */
  homeSafetyPending?: boolean;
  /** RN-ATD-19: obrigatório, sem opção pré-marcada. */
  kind: CareSession['kind'] | null;
}

export interface BookingQuote {
  planId: PlanId;
  baseCents: number;
  discountPercent: number;
  discountCents: number;
  totalCents: number;
}

/** Duração da sessão (hoje sempre 1 hora). */
const SESSION_MINUTES = 60;

/** Sessões que ocupam a vaga (a cancelada libera). */
const ACTIVE_STATUSES: readonly CareSession['status'][] = ['scheduled', 'confirmed', 'done', 'no_show'];

/**
 * O miolo de agendar, cancelar e remarcar uma sessão (RN-ATD-02 a 05, 07, 09, 10, 12, 15, 16, 19), SEM checagem de
 * perfil. Existe no núcleo para que a equipe (`CareSessionsService`, que confere o perfil na borda e delega) e o
 * aplicativo do cuidador (que agenda a própria sessão) usem a MESMA regra, sem copiá-la.
 *
 * - Quem chama é responsável pela permissão de PERFIL (a equipe confere na borda dela). Com a sessão de um cuidador aberta,
 *   este serviço também confere a POSSE: o cuidador só agenda, cancela e remarca a própria conversa (QAC-001).
 * - Prazos usam o `Clock`; o desconto do plano vem do quadro de planos (RN-ATD-05); a vaga de prioridade só
 *   existe para quem tem direito (RN-ATD-12) e a tela não diz o motivo.
 * - O log de auditoria só grava quando há uma pessoa da equipe na sessão: o cuidador não gera linha própria.
 */
@Injectable({ providedIn: 'root' })
export class SessionBookingService {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly audit = inject(AuditLogService);
  private readonly ownership = inject(CaregiverOwnership);

  // ===== Leitura =====

  /** Psicólogos com CRP ativo: só eles aparecem na agenda (RN-ATD-06). */
  activePsychologists(): PsychologistProfile[] {
    return this.db.psychologists.query((p) => p.crpStatus === 'active');
  }

  startOf(slot: Pick<AvailabilitySlot, 'date' | 'start'>): string {
    return toIsoDateTime(slot.date, slot.start);
  }

  /** Sessão que de fato ocupa a vaga (cancelada libera a vaga). */
  activeSessionOfSlot(slotId: ID): CareSession | undefined {
    return this.db.careSessions.find((s) => s.slotId === slotId && ACTIVE_STATUSES.includes(s.status));
  }

  isSlotFree(slot: AvailabilitySlot): boolean {
    return slot.status === 'open' || (slot.status === 'booked' && !this.activeSessionOfSlot(slot.id));
  }

  hasYellowAlert(caregiverId: ID): boolean {
    return (
      this.db.zaritAlerts.count(
        (a) => a.caregiverId === caregiverId && a.level === 'yellow' && a.status !== 'closed',
      ) > 0
    );
  }

  // ===== Salas do coworking (RN-ATD-10) =====

  /**
   * As salas ocupadas: as conversas presenciais que ainda ocupam a vaga e os encontros de grupo que não foram cancelados nem
   * encerrados. Serve para duas conversas nunca caírem na mesma sala ao mesmo tempo (QAC-013).
   */
  roomBookings(): RoomBooking[] {
    const sessions = this.db.careSessions
      .query((s) => !!s.roomId && ACTIVE_STATUSES.includes(s.status))
      .map((s) => ({ roomId: s.roomId as ID, startAt: s.startAt, endAt: addMinutes(s.startAt, s.durationMin) }));
    const meetings = this.db.activities
      .query((a) => !!a.roomId && a.status !== 'cancelled' && a.status !== 'finished')
      .flatMap((a) => a.meetings.map((m) => ({ roomId: a.roomId as ID, startAt: m.startAt, endAt: m.endAt })));
    return [...sessions, ...meetings];
  }

  /** A sala está livre na vaga? (a vaga dura 1 hora, como a sessão). */
  isRoomFreeForSlot(roomId: ID, slot: Pick<AvailabilitySlot, 'date' | 'start'>): boolean {
    const startAt = this.startOf(slot);
    return isRoomFreeAt(roomId, startAt, addMinutes(startAt, SESSION_MINUTES), this.roomBookings());
  }

  /** A primeira sala reservável e livre no horário da vaga; `undefined` se todas estão ocupadas (sem sala, sem coworking). */
  freeRoomForSlot(slot: Pick<AvailabilitySlot, 'date' | 'start'>): Room | undefined {
    const startAt = this.startOf(slot);
    return firstFreeRoom(this.db.rooms.all(), startAt, addMinutes(startAt, SESSION_MINUTES), this.roomBookings());
  }

  /** Vagas prioritárias: Cuida e Sustenta, ou acompanhamento prioritário, inclusive no Livre (RN-ATD-12). */
  canSeePriority(caregiverId: ID): boolean {
    return canSeePrioritySlots(
      planIdOfCaregiver(this.db, caregiverId),
      this.hasYellowAlert(caregiverId),
      this.db.plans.list(),
    );
  }

  /** Vagas livres e futuras do psicólogo, na ordem do calendário. */
  freeSlots(psychologistId: ID, canSeePriority: boolean): AvailabilitySlot[] {
    const now = this.clock.now();
    return this.db.availabilitySlots
      .query(
        (s) =>
          s.psychologistId === psychologistId &&
          this.isSlotFree(s) &&
          (canSeePriority || !s.priorityOnly) &&
          compareDateTimes(this.startOf(s), now) > 0,
      )
      .sort((a, b) => this.startOf(a).localeCompare(this.startOf(b)));
  }

  /** Valor da sessão com o desconto do plano (RN-ATD-05): base e descontos vêm do quadro de planos (M15). */
  quote(caregiverId: ID): BookingQuote {
    const planId = planIdOfCaregiver(this.db, caregiverId);
    const baseCents = this.db.settings.get().sessionBasePriceCents;
    const discountPercent = this.db.plans.get(planId)?.psychSessionDiscountPercent ?? 0;
    const totalCents = sessionPriceCents(baseCents, discountPercent);
    return { planId, baseCents, discountPercent, discountCents: baseCents - totalCents, totalCents };
  }

  /** Horas até o início da sessão (negativo = já começou). */
  hoursUntil(session: Pick<CareSession, 'startAt'>): number {
    return minutesBetween(this.clock.now(), session.startAt) / 60;
  }

  hasStarted(session: Pick<CareSession, 'startAt'>): boolean {
    return compareDateTimes(session.startAt, this.clock.now()) <= 0;
  }

  /** Cancelar ou remarcar com menos horas que o limite (24) vira falta (RN-ATD-16). */
  isLateCancellation(session: Pick<CareSession, 'startAt'>): boolean {
    return this.hoursUntil(session) < this.db.settings.get().sessionCancellationHours;
  }

  /** Limite de cancelamento sem falta, em horas (RN-ATD-16). */
  cancellationHours(): number {
    return this.db.settings.get().sessionCancellationHours;
  }

  // ===== Agendar =====

  schedule(input: BookingInput): BookingResult<CareSession> {
    // Com a sessão de um cuidador aberta, só se agenda a própria conversa (QAC-001).
    if (!this.ownership.ownsCaregiver(input.caregiverId)) {
      return fail('caregiver', NOT_OWNER_TEXT);
    }
    const errors: BookingFieldError[] = [];
    const caregiver = this.db.caregivers.get(input.caregiverId);
    if (!caregiver || caregiver.status === 'closed') {
      errors.push({ field: 'caregiver', message: 'Escolha o cuidador da sessão.' });
    }
    const psychologist = this.db.psychologists.get(input.psychologistId);
    if (!psychologist || psychologist.crpStatus !== 'active') {
      errors.push({ field: 'psychologist', message: 'Escolha um psicólogo com CRP ativo.' });
    }
    const slot = this.db.availabilitySlots.get(input.slotId);
    if (!slot || slot.psychologistId !== input.psychologistId) {
      errors.push({ field: 'slot', message: 'Escolha uma vaga aberta.' });
    } else if (!this.isSlotFree(slot)) {
      errors.push({
        field: 'slot',
        message: 'Essa vaga acabou de ser reservada. Escolha outro horário.',
      });
    } else if (compareDateTimes(this.startOf(slot), this.clock.now()) <= 0) {
      errors.push({ field: 'slot', message: 'Escolha uma vaga que ainda não passou.' });
    } else if (slot.priorityOnly && caregiver && !this.canSeePriority(caregiver.id)) {
      errors.push({
        field: 'slot',
        message: 'Essa vaga não está disponível para este cuidador. Escolha outro horário.',
      });
    }
    if (!input.modality) {
      errors.push({ field: 'modality', message: 'Escolha como a sessão acontece.' });
    }
    let room: Room | undefined;
    if (input.modality === 'in_person_coworking') {
      room = input.roomId ? this.db.rooms.get(input.roomId) : undefined;
      if (!room) {
        errors.push({ field: 'room', message: 'Escolha a sala do coworking.' });
      } else if (!isRoomBookable(room)) {
        errors.push({ field: 'room', message: roomBlockReason(room) ?? 'Sala indisponível.' });
      } else if (slot && slot.psychologistId === input.psychologistId && !this.isRoomFreeForSlot(room.id, slot)) {
        errors.push({ field: 'room', message: 'Esta sala já está reservada nesse horário.' });
      }
    }
    if (input.modality === 'in_person_home') {
      if (!input.homeAddress?.trim()) {
        errors.push({ field: 'homeAddress', message: 'Informe o endereço do atendimento.' });
      } else if (isTooLong(input.homeAddress, NAME_MAX_CHARS)) {
        errors.push({ field: 'homeAddress', message: tooLongText(NAME_MAX_CHARS) });
      }
      if (!input.homeSafe && !input.homeSafetyPending) {
        errors.push({
          field: 'homeSafe',
          message: 'Confirme que o domicílio é adequado e seguro.',
        });
      }
    }
    if (!input.kind) {
      errors.push({
        field: 'kind',
        message: 'Escolha o tipo de atendimento: psicoterapia ou orientação.',
      });
    }
    if (errors.length > 0 || !slot || !caregiver || !input.modality || !input.kind) {
      return { ok: false, errors };
    }
    const quote = this.quote(caregiver.id);
    const draft: NewEntity<CareSession> = {
      caregiverId: caregiver.id,
      psychologistId: input.psychologistId,
      slotId: slot.id,
      startAt: this.startOf(slot),
      durationMin: 60,
      modality: input.modality,
      kind: input.kind,
      status: 'scheduled',
      priceCents: quote.totalCents,
      discountPercent: quote.discountPercent,
      ...(room ? { roomId: room.id } : {}),
      ...(input.modality === 'in_person_home'
        ? { homeAddress: (input.homeAddress as string).trim(), homeVisitConfirmedSafe: input.homeSafe === true }
        : {}),
    };
    const session = this.db.careSessions.create(draft);
    this.db.availabilitySlots.update(slot.id, { status: 'booked' });
    this.audit.write('create', 'care_session', session.id, caregiver.id, 'sessão agendada');
    return { ok: true, value: session };
  }

  // ===== Cancelar e remarcar =====

  /**
   * Cancelar (RN-ATD-16). Pelo cuidador com menos de 24 horas (`settings.sessionCancellationHours`) vira
   * `no_show`, sem cobrança no protótipo; com mais, `cancelled_by_user` e a vaga volta a ficar aberta.
   * Pelo psicólogo é sempre `cancelled_by_psychologist` e a vaga volta a ficar aberta.
   */
  cancel(sessionId: ID, by: 'user' | 'psychologist'): BookingResult<CareSession> {
    if (!this.ownership.ownsCareSession(sessionId)) {
      return fail('session', NOT_OWNER_TEXT);
    }
    const session = this.db.careSessions.require(sessionId);
    if (session.status !== 'scheduled' && session.status !== 'confirmed') {
      return fail('session', 'Só uma sessão agendada ou confirmada pode ser cancelada.');
    }
    if (this.hasStarted(session)) {
      return fail('session', 'Esta sessão já começou. Marque como falta ou realizada.');
    }
    const late = by === 'user' && this.isLateCancellation(session);
    const status: CareSession['status'] = late
      ? 'no_show'
      : by === 'user'
        ? 'cancelled_by_user'
        : 'cancelled_by_psychologist';
    const updated = this.db.careSessions.update(sessionId, { status, cancelledAt: this.clock.now() });
    if (!late) {
      this.db.availabilitySlots.update(session.slotId, { status: 'open' });
    }
    this.audit.write(
      'update',
      'care_session',
      sessionId,
      session.caregiverId,
      late ? 'cancelamento com menos de 24 horas: falta' : 'sessão cancelada',
    );
    return { ok: true, value: updated };
  }

  /**
   * Remarcar (CX-026, CX-027): escolhe a vaga nova e só então libera a antiga, sem passar por "cancelar". A sessão
   * antiga fica "remarcada" e guarda quem pediu. Se o cuidador pede a menos de 24 horas, vale a regra do
   * cancelamento (RN-ATD-16) e a antiga conta como falta; se foi o psicólogo, nunca é falta.
   */
  reschedule(sessionId: ID, input: BookingInput, by: 'user' | 'psychologist'): BookingResult<CareSession> {
    if (!this.ownership.ownsCareSession(sessionId) || !this.ownership.ownsCaregiver(input.caregiverId)) {
      return fail('session', NOT_OWNER_TEXT);
    }
    const session = this.db.careSessions.get(sessionId);
    if (!session) {
      return fail('session', 'Não encontramos esta sessão.');
    }
    if (session.status !== 'scheduled' && session.status !== 'confirmed') {
      return fail('session', 'Só uma sessão agendada ou confirmada pode ser remarcada.');
    }
    if (this.hasStarted(session)) {
      return fail('session', 'Esta sessão já começou. Marque como falta ou realizada.');
    }
    if (input.slotId === session.slotId) {
      return fail('slot', 'Escolha um horário diferente do atual.');
    }
    const created = this.schedule(input);
    if (!created.ok) {
      return created;
    }
    const late = by === 'user' && this.isLateCancellation(session);
    const status: CareSession['status'] = late
      ? 'no_show'
      : by === 'user'
        ? 'cancelled_by_user'
        : 'cancelled_by_psychologist';
    this.db.careSessions.update(sessionId, {
      status,
      cancelledAt: this.clock.now(),
      rescheduledToId: created.value.id,
      rescheduleRequestedBy: by,
    });
    if (!late) {
      this.db.availabilitySlots.update(session.slotId, { status: 'open' });
    }
    this.audit.write(
      'update',
      'care_session',
      sessionId,
      session.caregiverId,
      late
        ? 'sessão remarcada a menos de 24 horas: falta'
        : `sessão remarcada a pedido ${by === 'user' ? 'do cuidador' : 'do psicólogo'}`,
    );
    return created;
  }
}
