import { Injectable, inject } from '@angular/core';
import { AuditLogService } from '@core/audit';
import { AuthService } from '@core/auth';
import {
  Clock,
  addDays,
  compareDateTimes,
  dateOf,
  minutesBetween,
  toIsoDateTime,
  yearMonthOf,
} from '@core/clock';
import { Database, NewEntity } from '@core/data';
import { planIdOfCaregiver } from '@core/data/plan-lookup';
import { RiskCaseService } from '@core/governance';
import {
  AvailabilitySlot,
  CareSession,
  ID,
  ISODate,
  OccupancyView,
  PlanId,
  PsychologistMonthSummary,
  PsychologistProfile,
  Room,
  SessionModality,
  SessionNote,
  YearMonth,
} from '@core/models';
import {
  buildOccupancyView,
  canSeePrioritySlots,
  hasOverloadAlert,
  lastClosedMonths,
  sessionPriceCents,
  validateReferral,
} from '@core/rules';
import { isRoomBookable, roomBlockReason } from './care-labels';

export interface FieldError {
  field: string;
  message: string;
}

export type OpResult<T> = { ok: true; value: T } | { ok: false; errors: FieldError[] };

function fail<T>(field: string, message: string): OpResult<T> {
  return { ok: false, errors: [{ field, message }] };
}

export interface ScheduleInput {
  caregiverId: ID;
  psychologistId: ID;
  slotId: ID;
  modality: SessionModality | null;
  roomId?: ID | null;
  homeAddress?: string;
  /** RN-ATD-09: "domicílio adequado e seguro". */
  homeSafe?: boolean;
  /** RN-ATD-19: obrigatório, sem opção pré-marcada. */
  kind: CareSession['kind'] | null;
}

export interface PriceQuote {
  planId: PlanId;
  baseCents: number;
  discountPercent: number;
  discountCents: number;
  totalCents: number;
}

export type SlotState = 'none' | 'open' | 'priority' | 'blocked';

export interface OccupancyRow {
  psychologist: PsychologistProfile;
  months: OccupancyView[];
  /** Mais de 80% nos dois últimos meses fechados (RN-EQP-04). */
  overload: boolean;
}

export interface RedistributionPreview {
  caregivers: number;
  sessions: number;
}

export interface RedistributionResult {
  caregivers: number;
  sessionsMoved: number;
  sessionsKept: number;
}

/** Horas da agenda (uma vaga por hora, 08h às 18h, RN-ATD-14). */
export const AGENDA_HOURS: readonly string[] = [
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
];

export function slotEnd(start: string): string {
  return `${String(Number(start.slice(0, 2)) + 1).padStart(2, '0')}:00`;
}

const ACTIVE_STATUSES: readonly CareSession['status'][] = ['scheduled', 'confirmed', 'done', 'no_show'];

/**
 * Agenda e sessões (M05, RN-ATD-01 a 20, RN-EQP-01 a 09). Tudo grava pelo `Database`; as telas só leem os
 * signals dos repositórios. Regras de prazo usam o `Clock`.
 *
 * Permissões: a tela esconde o que o perfil não pode, e este serviço confere de novo (`can`/`canOnRecord`).
 * Dado clínico nunca entra no log: o `detail` das linhas só diz o que aconteceu ("sessão agendada").
 */
@Injectable({ providedIn: 'root' })
export class CareSessionsService {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly audit = inject(AuditLogService);
  private readonly auth = inject(AuthService);
  private readonly risk = inject(RiskCaseService);

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
    return this.db.zaritAlerts.count(
      (a) => a.caregiverId === caregiverId && a.level === 'yellow' && a.status !== 'closed',
    ) > 0;
  }

  /** Vagas prioritárias: Cuida e Sustenta, ou alerta amarelo, inclusive no Livre (AC-M05-13, RN-ATD-12). */
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

  /** Valor da sessão com o desconto do plano (RN-ATD-05, AC-M05-14): base e descontos vêm de M15. */
  quote(caregiverId: ID): PriceQuote {
    const planId = planIdOfCaregiver(this.db, caregiverId);
    const baseCents = this.db.settings.get().sessionBasePriceCents;
    const discountPercent = this.db.plans.get(planId)?.psychSessionDiscountPercent ?? 0;
    const totalCents = sessionPriceCents(baseCents, discountPercent);
    return { planId, baseCents, discountPercent, discountCents: baseCents - totalCents, totalCents };
  }

  /** Tipo de atendimento da última sessão do cuidador, para pré-preencher quando o atendimento agenda (U-09). */
  lastKind(caregiverId: ID): CareSession['kind'] | null {
    const last = this.db.careSessions
      .query((s) => s.caregiverId === caregiverId)
      .sort((a, b) => b.startAt.localeCompare(a.startAt))[0];
    return last?.kind ?? null;
  }

  /** Quando o psicólogo é o responsável pelo caso. */
  psychologistOfCaregiver(caregiverId: ID): ID | undefined {
    return this.db.caregivers.get(caregiverId)?.assignedPsychologistId;
  }

  noteOf(sessionId: ID): SessionNote | undefined {
    return this.db.sessionNotes.find((n) => n.sessionId === sessionId);
  }

  /** Horas até o início da sessão (negativo = já começou). */
  hoursUntil(session: Pick<CareSession, 'startAt'>): number {
    return minutesBetween(this.clock.now(), session.startAt) / 60;
  }

  hasStarted(session: Pick<CareSession, 'startAt'>): boolean {
    return compareDateTimes(session.startAt, this.clock.now()) <= 0;
  }

  // ===== Agendar =====

  schedule(input: ScheduleInput): OpResult<CareSession> {
    const actor = this.auth.actor();
    const own = actor?.psychologistId === input.psychologistId;
    if (!this.auth.can('care_schedule', 'create', { own })) {
      return fail('slot', 'Seu perfil não agenda sessões nesta agenda.');
    }
    const errors: FieldError[] = [];
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
      }
    }
    if (input.modality === 'in_person_home') {
      if (!input.homeAddress?.trim()) {
        errors.push({ field: 'homeAddress', message: 'Informe o endereço do atendimento.' });
      }
      if (!input.homeSafe) {
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
        ? { homeAddress: (input.homeAddress as string).trim(), homeVisitConfirmedSafe: true }
        : {}),
    };
    const session = this.db.careSessions.create(draft);
    this.db.availabilitySlots.update(slot.id, { status: 'booked' });
    this.audit.write('create', 'care_session', session.id, caregiver.id, 'sessão agendada');
    return { ok: true, value: session };
  }

  // ===== Transições da sessão =====

  private canChange(session: CareSession): boolean {
    const actor = this.auth.actor();
    return (
      actor !== null &&
      this.auth.can('care_schedule', 'update', { own: actor.psychologistId === session.psychologistId })
    );
  }

  /** Só o psicólogo da sessão marca realizada, falta e escreve anotação. */
  private isOwnPsychologist(session: Pick<CareSession, 'psychologistId'>): boolean {
    const actor = this.auth.actor();
    return actor?.role === 'psychologist' && actor.psychologistId === session.psychologistId;
  }

  /** Confirmar: `scheduled` para `confirmed` enquanto a sessão não começou (RN-ATD-15). */
  confirm(sessionId: ID, homeSafe?: boolean): OpResult<CareSession> {
    const session = this.db.careSessions.require(sessionId);
    if (!this.canChange(session)) {
      return fail('session', 'Seu perfil não confirma esta sessão.');
    }
    if (session.status !== 'scheduled') {
      return fail('session', 'Só uma sessão agendada pode ser confirmada.');
    }
    if (this.hasStarted(session)) {
      return fail('session', 'Esta sessão já começou. Marque como realizada ou falta.');
    }
    if (session.modality === 'in_person_home' && !session.homeVisitConfirmedSafe && !homeSafe) {
      return fail('homeSafe', 'Confirme que o domicílio é adequado e seguro antes de confirmar a sessão.');
    }
    const updated = this.db.careSessions.update(sessionId, {
      status: 'confirmed',
      ...(session.modality === 'in_person_home' ? { homeVisitConfirmedSafe: true } : {}),
    });
    this.audit.write('update', 'care_session', sessionId, session.caregiverId, 'sessão confirmada');
    return { ok: true, value: updated };
  }

  /**
   * Cancelar (RN-ATD-16). Pelo cuidador com menos de 24 horas (`settings.sessionCancellationHours`) vira
   * `no_show`, sem cobrança no protótipo; com mais, `cancelled_by_user` e a vaga volta a ficar aberta.
   * Pelo psicólogo é sempre `cancelled_by_psychologist` e a vaga volta a ficar aberta.
   */
  cancel(sessionId: ID, by: 'user' | 'psychologist'): OpResult<CareSession> {
    const session = this.db.careSessions.require(sessionId);
    if (!this.canChange(session)) {
      return fail('session', 'Seu perfil não cancela esta sessão.');
    }
    if (by === 'psychologist' && this.auth.role() === 'support') {
      return fail('session', 'Só o psicólogo cancela pelo psicólogo. Registre o cancelamento pelo cuidador.');
    }
    if (session.status !== 'scheduled' && session.status !== 'confirmed') {
      return fail('session', 'Só uma sessão agendada ou confirmada pode ser cancelada.');
    }
    if (this.hasStarted(session)) {
      return fail('session', 'Esta sessão já começou. Marque como falta ou realizada.');
    }
    const limit = this.db.settings.get().sessionCancellationHours;
    const late = by === 'user' && this.hoursUntil(session) < limit;
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

  /** Mensagem do efeito do cancelamento, mostrada ANTES de confirmar (A-23). */
  cancelEffect(session: CareSession, by: 'user' | 'psychologist'): string {
    const limit = this.db.settings.get().sessionCancellationHours;
    const hours = this.hoursUntil(session);
    if (by === 'user' && hours < limit) {
      const left = Math.max(0, Math.floor(hours));
      return `Faltam ${left} ${left === 1 ? 'hora' : 'horas'} para a sessão. Cancelar agora registra falta, conforme a regra de ${limit} horas.`;
    }
    return 'Cancelar a sessão libera a vaga para outra pessoa.';
  }

  /**
   * Marcar realizada. Online exige a confirmação de que o formato remoto é pertinente (RN-ATD-07). Se o
   * psicólogo marcar "há risco, violência ou urgência", exige o encaminhamento e abre a ocorrência POP-05.
   */
  markDone(
    sessionId: ID,
    input: { remoteConfirmed?: boolean; risk?: { destinations: readonly string[] } | null },
  ): OpResult<CareSession> {
    const session = this.db.careSessions.require(sessionId);
    if (!this.isOwnPsychologist(session)) {
      return fail('session', 'Só o psicólogo da sessão a marca como realizada.');
    }
    if (session.status !== 'confirmed' && session.status !== 'scheduled') {
      return fail('session', 'Só uma sessão confirmada pode ser marcada como realizada.');
    }
    if (!this.hasStarted(session)) {
      return fail('session', 'A sessão ainda não começou. Marque como realizada depois do horário.');
    }
    const errors: FieldError[] = [];
    if (session.modality === 'online' && !input.remoteConfirmed) {
      errors.push({
        field: 'remote',
        message: 'Confirme que o formato remoto é pertinente para marcar a sessão como realizada.',
      });
    }
    if (input.risk) {
      const check = validateReferral('severe_distress_or_suicide_risk', input.risk.destinations, undefined);
      if (!check.valid) {
        errors.push({
          field: 'referral',
          message:
            input.risk.destinations.length === 0
              ? 'Escolha ao menos um destino do encaminhamento à rede presencial.'
              : check.errors.join(' '),
        });
      }
    }
    if (errors.length > 0) {
      return { ok: false, errors };
    }
    const updated = this.db.careSessions.update(sessionId, {
      status: 'done',
      ...(session.modality === 'online' ? { remoteFormatConfirmedPertinent: true } : {}),
      ...(input.risk ? { riskFlag: true } : {}),
    });
    this.audit.write('update', 'care_session', sessionId, session.caregiverId, 'sessão realizada');
    if (input.risk) {
      this.openRiskCase(updated, input.risk.destinations);
    }
    return { ok: true, value: updated };
  }

  markNoShow(sessionId: ID): OpResult<CareSession> {
    const session = this.db.careSessions.require(sessionId);
    if (!this.isOwnPsychologist(session)) {
      return fail('session', 'Só o psicólogo da sessão registra a falta.');
    }
    if (session.status !== 'confirmed' && session.status !== 'scheduled') {
      return fail('session', 'Só uma sessão confirmada pode virar falta.');
    }
    if (!this.hasStarted(session)) {
      return fail('session', 'A sessão ainda não começou.');
    }
    const updated = this.db.careSessions.update(sessionId, { status: 'no_show' });
    this.audit.write('update', 'care_session', sessionId, session.caregiverId, 'falta registrada');
    return { ok: true, value: updated };
  }

  /** Risco marcado em sessão: encaminhamento à rede presencial e ocorrência POP-05 (RN-ATD-07, RN-POP-05). */
  private openRiskCase(session: CareSession, destinations: readonly string[]): void {
    const actor = this.auth.actor();
    const byUserId = actor?.userId ?? '';
    const occurrence = this.risk.openPop05({ caregiverId: session.caregiverId });
    const done = (n: number, note?: string): void => {
      this.risk.stepDone(occurrence.id, n, { byUserId, ...(note ? { note } : {}) });
    };
    done(1, 'Acolhimento durante a sessão.');
    done(2, 'Contato feito na própria sessão.');
    this.risk.registerReferral({
      caregiverId: session.caregiverId,
      category: 'severe_distress_or_suicide_risk',
      destinations,
      byUserId,
      occurrenceId: occurrence.id,
    });
    done(4, 'Encaminhamento à rede de urgência registrado. Em emergência, SAMU 192; CVV 188.');
    if (session.modality === 'online') {
      done(5, 'Atendimento remoto encaminhado à rede presencial.');
    }
    done(6, 'Ocorrência e encaminhamento registrados.');
  }

  // ===== Anotação sigilosa (F18) =====

  private isNoteAuthor(note: Pick<SessionNote, 'authorPsychologistId'>): boolean {
    const actor = this.auth.actor();
    return actor?.role === 'psychologist' && actor.psychologistId === note.authorPsychologistId;
  }

  /** Salva o rascunho. Cria a anotação na primeira vez. Anotação assinada não muda. */
  saveDraft(sessionId: ID, content: string): OpResult<SessionNote> {
    const session = this.db.careSessions.require(sessionId);
    if (!this.isOwnPsychologist(session)) {
      return fail('note', 'Só o psicólogo da sessão escreve a anotação.');
    }
    const existing = this.noteOf(sessionId);
    if (existing?.status === 'signed') {
      return fail('note', 'A anotação já foi assinada. Correções entram como adendo.');
    }
    if (existing) {
      return { ok: true, value: this.db.sessionNotes.update(existing.id, { content }) };
    }
    const note = this.db.sessionNotes.create({
      sessionId,
      authorPsychologistId: session.psychologistId,
      content,
      status: 'draft',
      addenda: [],
    });
    this.audit.write('create', 'session_note', note.id, session.caregiverId, 'rascunho de anotação');
    return { ok: true, value: note };
  }

  /** Assina: depois disso a anotação é imutável (RN-ATD-08). */
  sign(sessionId: ID, content: string): OpResult<SessionNote> {
    const saved = this.saveDraft(sessionId, content);
    if (!saved.ok) {
      return saved;
    }
    if (content.trim().length < 10) {
      return fail('note', 'Escreva a anotação antes de assinar.');
    }
    const note = saved.value;
    const session = this.db.careSessions.require(sessionId);
    const signed = this.db.sessionNotes.update(note.id, {
      content: content.trim(),
      status: 'signed',
      signedAt: this.clock.now(),
    });
    this.audit.write('update', 'session_note', note.id, session.caregiverId, 'anotação assinada');
    return { ok: true, value: signed };
  }

  /** Adendo datado a uma anotação assinada (nunca edita o texto original). */
  addAddendum(sessionId: ID, content: string): OpResult<SessionNote> {
    const note = this.noteOf(sessionId);
    if (!note || !this.isNoteAuthor(note)) {
      return fail('addendum', 'Só o psicólogo autor adiciona adendo.');
    }
    if (note.status !== 'signed') {
      return fail('addendum', 'O adendo só vale para anotação assinada.');
    }
    if (content.trim().length < 3) {
      return fail('addendum', 'Escreva o adendo antes de salvar.');
    }
    const updated = this.db.sessionNotes.update(note.id, {
      addenda: [...note.addenda, { at: this.clock.now(), content: content.trim() }],
    });
    const session = this.db.careSessions.require(sessionId);
    this.audit.write('update', 'session_note', note.id, session.caregiverId, 'adendo à anotação');
    return { ok: true, value: updated };
  }

  // ===== Disponibilidade (SCR-M05-02) =====

  slotAt(psychologistId: ID, date: ISODate, start: string): AvailabilitySlot | undefined {
    return this.db.availabilitySlots.find(
      (s) => s.psychologistId === psychologistId && s.date === date && s.start === start,
    );
  }

  private canEditAvailability(psychologistId: ID): boolean {
    const actor = this.auth.actor();
    return actor?.role === 'psychologist' && actor.psychologistId === psychologistId;
  }

  /** Abre, fecha, bloqueia ou marca como prioritária uma vaga futura. Vaga reservada não muda. */
  setSlotState(psychologistId: ID, date: ISODate, start: string, state: SlotState): OpResult<null> {
    if (!this.canEditAvailability(psychologistId)) {
      return fail('slot', 'Só o psicólogo define a própria disponibilidade.');
    }
    if (compareDateTimes(toIsoDateTime(date, start), this.clock.now()) <= 0) {
      return fail('slot', 'Não dá para mudar uma vaga que já passou.');
    }
    const current = this.slotAt(psychologistId, date, start);
    if (current && !this.isSlotFree(current) && current.status === 'booked') {
      return fail('slot', 'Esta vaga está reservada. Cancele a sessão para liberá-la.');
    }
    if (state === 'none') {
      if (current) {
        this.db.availabilitySlots.remove(current.id);
      }
      return { ok: true, value: null };
    }
    const patch = {
      status: state === 'blocked' ? ('blocked' as const) : ('open' as const),
      priorityOnly: state === 'priority',
    };
    if (current) {
      this.db.availabilitySlots.update(current.id, patch);
    } else {
      this.db.availabilitySlots.create({
        psychologistId,
        date,
        start,
        end: slotEnd(start),
        ...patch,
      });
    }
    return { ok: true, value: null };
  }

  /** Copia o desenho da semana (vagas abertas, prioritárias e bloqueadas) para outra semana, sem pisar no que existe. */
  copyWeek(psychologistId: ID, fromMonday: ISODate, toMonday: ISODate): OpResult<number> {
    if (!this.canEditAvailability(psychologistId)) {
      return fail('slot', 'Só o psicólogo define a própria disponibilidade.');
    }
    let created = 0;
    for (let d = 0; d < 5; d += 1) {
      const from = addDays(fromMonday, d);
      const to = addDays(toMonday, d);
      this.db.availabilitySlots
        .query((s) => s.psychologistId === psychologistId && s.date === from)
        .forEach((source) => {
          if (this.slotAt(psychologistId, to, source.start)) {
            return;
          }
          if (compareDateTimes(toIsoDateTime(to, source.start), this.clock.now()) <= 0) {
            return;
          }
          const blocked = source.status === 'blocked';
          this.db.availabilitySlots.create({
            psychologistId,
            date: to,
            start: source.start,
            end: source.end,
            status: blocked ? 'blocked' : 'open',
            priorityOnly: source.priorityOnly,
          });
          created += 1;
        });
    }
    return { ok: true, value: created };
  }

  // ===== Ocupação (SCR-M05-06, RN-EQP-01 a 08) =====

  /** Mês corrente (parcial): vagas abertas e reservadas contam como disponibilizadas; só `done` conta como realizada. */
  private currentMonthHours(psychologistId: ID, month: YearMonth): { available: number; done: number } {
    const available = this.db.availabilitySlots.count(
      (s) =>
        s.psychologistId === psychologistId &&
        yearMonthOf(s.date) === month &&
        (s.status === 'open' || s.status === 'booked'),
    );
    const done = this.db.careSessions.count(
      (s) =>
        s.psychologistId === psychologistId &&
        s.status === 'done' &&
        yearMonthOf(dateOf(s.startAt)) === month,
    );
    return { available, done };
  }

  occupancyFor(psychologist: PsychologistProfile): OccupancyRow {
    const current = this.clock.currentMonth();
    const summaries = this.db.monthSummaries.query((s) => s.psychologistId === psychologist.id);
    const overload = hasOverloadAlert(summaries, current);
    const closed = lastClosedMonths(current).map((month) => {
      const row: Pick<PsychologistMonthSummary, 'availableHours' | 'doneHours'> | undefined =
        summaries.find((s) => s.month === month);
      return buildOccupancyView(
        psychologist.id,
        month,
        row?.availableHours ?? 0,
        row?.doneHours ?? 0,
        current,
        overload,
      );
    });
    const now = this.currentMonthHours(psychologist.id, current);
    return {
      psychologist,
      months: [...closed, buildOccupancyView(psychologist.id, current, now.available, now.done, current, overload)],
      overload,
    };
  }

  // ===== Redistribuição (SCR-M05-07, RN-EQP-05) =====

  private futureSessionsOf(psychologistId: ID): CareSession[] {
    return this.db.careSessions.query(
      (s) =>
        s.psychologistId === psychologistId &&
        (s.status === 'scheduled' || s.status === 'confirmed') &&
        !this.hasStarted(s),
    );
  }

  redistributionPreview(fromPsychologistId: ID): RedistributionPreview {
    return {
      caregivers: this.db.caregivers.count((c) => c.assignedPsychologistId === fromPsychologistId),
      sessions: this.futureSessionsOf(fromPsychologistId).length,
    };
  }

  /**
   * Transfere os cuidadores e as sessões futuras de um psicólogo para outro, com motivo. A vaga acompanha a
   * sessão: a agenda de quem sai diminui e a ocupação dele cai no cálculo seguinte. Se o destino já tem
   * compromisso no mesmo horário, a sessão fica onde está e entra no relatório. Quem faz: RT ou gestão.
   */
  redistribute(fromId: ID, toId: ID, reason: string): OpResult<RedistributionResult> {
    const role = this.auth.role();
    if (role !== 'technical_lead' && role !== 'partner') {
      return fail('redistribute', 'Só o responsável técnico ou a gestão redistribuem a agenda.');
    }
    const from = this.db.psychologists.get(fromId);
    const to = this.db.psychologists.get(toId);
    if (!from || !to || from.id === to.id) {
      return fail('target', 'Escolha o psicólogo que recebe os casos.');
    }
    if (to.crpStatus !== 'active') {
      return fail('target', 'O psicólogo que recebe precisa ter CRP ativo.');
    }
    if (reason.trim().length < 5) {
      return fail('reason', 'Escreva o motivo da transferência.');
    }
    const caregivers = this.db.caregivers.updateWhere((c) => c.assignedPsychologistId === fromId, {
      assignedPsychologistId: toId,
    });
    let moved = 0;
    let kept = 0;
    this.futureSessionsOf(fromId).forEach((session) => {
      const slot = this.db.availabilitySlots.get(session.slotId);
      if (!slot) {
        kept += 1;
        return;
      }
      const onTarget = this.slotAt(toId, slot.date, slot.start);
      if (!onTarget) {
        this.db.availabilitySlots.update(slot.id, { psychologistId: toId });
      } else if (this.isSlotFree(onTarget)) {
        this.db.availabilitySlots.update(onTarget.id, { status: 'booked' });
        this.db.availabilitySlots.remove(slot.id);
        this.db.careSessions.update(session.id, { slotId: onTarget.id });
      } else {
        kept += 1;
        return;
      }
      this.db.careSessions.update(session.id, { psychologistId: toId });
      moved += 1;
    });
    // O novo psicólogo recebe o caso por inteiro: aplicações agendadas, pedidos de revisão e ocorrências.
    this.db.zaritAssessments.updateWhere(
      (a) => a.psychologistId === fromId && a.status === 'scheduled',
      { psychologistId: toId },
    );
    this.db.reviewRequests.updateWhere((r) => r.psychologistId === fromId && !r.answeredAt, {
      psychologistId: toId,
    });
    const caseIds = new Set(this.db.caregivers.query((c) => c.assignedPsychologistId === toId).map((c) => c.id));
    this.db.occurrences
      .query((o) => o.status !== 'closed' && caseIds.has(o.caregiverId))
      .forEach((o) => {
        const users = o.restrictedToUserIds.filter((id) => id !== from.userId);
        if (!users.includes(to.userId)) {
          users.push(to.userId);
        }
        this.db.occurrences.update(o.id, { restrictedToUserIds: users });
      });
    this.audit.record({
      action: 'update',
      entity: 'psychologist_redistribution',
      entityId: fromId,
      justification: reason.trim(),
      detail: `transferência para ${toId}: ${caregivers} cuidadores e ${moved} sessões futuras`,
    });
    return { ok: true, value: { caregivers, sessionsMoved: moved, sessionsKept: kept } };
  }

  // ===== Salas (SCR-M05-08) =====

  saveRoom(
    roomId: ID | null,
    data: Pick<Room, 'name' | 'address' | 'accessibility' | 'active'>,
  ): OpResult<Room> {
    if (!this.auth.can('rooms', 'update')) {
      return fail('room', 'Só a gestão edita as salas.');
    }
    if (!data.name.trim()) {
      return fail('name', 'Informe o nome da sala.');
    }
    if (!data.address.trim()) {
      return fail('address', 'Informe o endereço da sala.');
    }
    const clean = { ...data, name: data.name.trim(), address: data.address.trim() };
    const room = roomId
      ? this.db.rooms.update(roomId, clean)
      : this.db.rooms.create(clean);
    return { ok: true, value: room };
  }
}
