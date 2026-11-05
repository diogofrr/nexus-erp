import { Injectable, computed, inject } from '@angular/core';
import { BookingFieldError, BookingInput, BookingQuote, SessionBookingService } from '@core/care/session-booking.service';
import { Clock, addDays, compareDateTimes, dateOf, timeOf } from '@core/clock';
import { Database } from '@core/data';
import { formatMoney } from '@core/format';
import { CareSession, ID, ISODate, PsychologistProfile, Room, SessionModality } from '@core/models';
import { isRoomBookable } from '@core/rules/rooms';
import { CaregiverContextService } from '../../state/caregiver-context.service';
import { formatDayShort, relativeDateTime } from '../../state/day-format';
import { FORMAT_LABEL, KIND_LABEL, KindChoice, SLOT_TAKEN, kindFromChoice, statusText } from './care-labels';

/** Quantos dias à frente a pessoa vê horários (UX B4: "próximos 14 dias"). */
export const WINDOW_DAYS = 14;

/** Uma conversa como a tela mostra (as do próprio cuidador, e de mais ninguém). */
export interface Conversation {
  id: ID;
  startAt: string;
  /** "qui, 06/11, às 14:00" ou "hoje às 14:00". */
  whenText: string;
  /** "qui, 06/11". */
  dayText: string;
  time: string;
  psychologistName: string;
  /** "Dra. Beatriz". */
  psychologistShort: string;
  psychologistRole: string;
  crp: string;
  format: SessionModality;
  formatLabel: string;
  kindLabel: string;
  statusText: string;
  /** Local da conversa: a sala e o endereço, ou o endereço de casa. `null` no on-line. */
  place: string | null;
  upcoming: boolean;
  /** Cancelar ou remarcar agora conta como falta (menos de 24 horas). */
  late: boolean;
  session: CareSession;
}

/** Um horário aberto que a pessoa pode escolher, sem etiqueta e sem dizer por que existe (RN-ATD-12). */
export interface SlotOption {
  slotId: ID;
  psychologistId: ID;
  psychologistName: string;
  psychologistShort: string;
  date: ISODate;
  time: string;
  /** "14:00 com a Dra. Beatriz". */
  label: string;
}

export interface DayGroup {
  date: ISODate;
  /** "qui, 06/11". */
  label: string;
  slots: SlotOption[];
}

export interface PriceView {
  baseText: string;
  /** Só quando o plano dá desconto; no Livre fica `null` e a tela mostra só o total. */
  discountText: string | null;
  totalText: string;
  discountPercent: number;
}

export interface BookRequest {
  slotId: ID;
  psychologistId: ID;
  format: SessionModality;
  kind: KindChoice;
  /** Endereço de casa, só no formato "Em casa". */
  address: string;
}

export type ConversationResult =
  { ok: true; session: CareSession } | { ok: false; error: string; field: string };

/** Primeiro nome com o tratamento: "Dra. Beatriz". */
export function shortName(displayName: string): string {
  const parts = displayName.split(/\s+/);
  return /^(dr|dra)\.?$/i.test(parts[0] ?? '') ? parts.slice(0, 2).join(' ') : (parts[0] ?? displayName);
}

function roleOf(displayName: string): string {
  return /^dra\.?\s/i.test(displayName) ? 'psicóloga' : 'psicólogo';
}

/** A frase do erro, na voz do aplicativo (sem dizer por que um horário não vale: RN-ATD-12). */
export function bookingErrorText(errors: readonly BookingFieldError[]): { field: string; error: string } {
  const first = errors[0];
  if (!first) {
    return { field: 'session', error: 'Não foi possível marcar a conversa. Tente de novo; se continuar, fale com a gente.' };
  }
  switch (first.field) {
    case 'slot':
      return first.message.includes('acabou de ser reservada')
        ? { field: 'slot', error: SLOT_TAKEN }
        : first.message.includes('já passou') || first.message.includes('ainda não passou')
          ? { field: 'slot', error: 'Esse horário já passou. Escolha outro.' }
          : first.message.includes('diferente do atual')
            ? { field: 'slot', error: 'Escolha um horário diferente do atual.' }
            : { field: 'slot', error: 'Esse horário não está disponível. Escolha outro.' };
    case 'room':
      return { field: 'room', error: 'Não há sala disponível nesse horário. Escolha outro formato ou fale com a gente.' };
    case 'homeAddress':
      return { field: 'homeAddress', error: 'Informe o endereço da conversa.' };
    case 'kind':
      return { field: 'kind', error: 'Escolha uma das opções para continuar.' };
    case 'modality':
      return { field: 'modality', error: 'Escolha como você prefere a conversa.' };
    default:
      return { field: first.field, error: first.message };
  }
}

/**
 * As conversas do cuidador com os psicólogos da Nexus (UX C8, B4; RN-ATD-02 a 05, 07, 09, 10, 12, 15, 16, 19). Lê e grava pelo
 * núcleo (`SessionBookingService`, a MESMA regra da agenda da equipe): só os psicólogos com registro ativo, só salas com
 * os 4 itens de acessibilidade, o preço com o desconto do plano, cancelar com 24 horas ou mais sem custo. A tela
 * nunca recalcula regra e NUNCA mostra por que um horário existe (prioridade de agenda, RN-ATD-12): quem não tem
 * direito a esses horários nem os vê.
 */
@Injectable({ providedIn: 'root' })
export class ConversationsService {
  private readonly ctx = inject(CaregiverContextService);
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly booking = inject(SessionBookingService);

  /** Todas as conversas da pessoa, da mais próxima para a mais antiga a partir de hoje (as futuras primeiro). */
  readonly all = computed<Conversation[]>(() => {
    const id = this.ctx.caregiverId();
    if (!id) {
      return [];
    }
    const today = this.ctx.today();
    return this.db.careSessions
      .query((s) => s.caregiverId === id)
      .map((s) => this.toConversation(s, today));
  });

  /** As que ainda vão acontecer (agendada ou confirmada, daqui para a frente), da mais próxima. */
  readonly upcoming = computed(() =>
    this.all()
      .filter((c) => c.upcoming)
      .sort((a, b) => a.startAt.localeCompare(b.startAt)),
  );

  /** "Sua próxima conversa". */
  readonly next = computed<Conversation | null>(() => this.upcoming()[0] ?? null);

  /** As anteriores, da mais recente. */
  readonly previous = computed(() =>
    this.all()
      .filter((c) => !c.upcoming)
      .sort((a, b) => b.startAt.localeCompare(a.startAt)),
  );

  /** O valor com o desconto do plano: no Livre só o total (sem convite de plano). */
  readonly price = computed<PriceView>(() => {
    const id = this.ctx.caregiverId();
    const quote: BookingQuote = id
      ? this.booking.quote(id)
      : { planId: 'livre', baseCents: 0, discountPercent: 0, discountCents: 0, totalCents: 0 };
    return {
      baseText: formatMoney(quote.baseCents),
      discountText: quote.discountPercent > 0 ? formatMoney(quote.discountCents) : null,
      totalText: formatMoney(quote.totalCents),
      discountPercent: quote.discountPercent,
    };
  });

  /** A sala do coworking que a pessoa usa: a primeira reservável (4 itens de acessibilidade, RN-ATD-10). */
  readonly room = computed<Room | null>(() => {
    const rooms = this.db.rooms
      .query((r) => isRoomBookable(r))
      .sort((a, b) => a.name.localeCompare(b.name));
    return rooms[0] ?? null;
  });

  /**
   * Horários abertos nos próximos 14 dias para o formato, agrupados por dia. Só psicólogos com registro ativo; no
   * coworking só se existe sala reservável. Os horários de prioridade aparecem como os outros (sem etiqueta) para
   * quem tem direito a eles, e não aparecem para quem não tem.
   */
  slotsFor(format: SessionModality | null): DayGroup[] {
    const id = this.ctx.caregiverId();
    if (!id || !format || (format === 'in_person_coworking' && !this.room())) {
      return [];
    }
    const today = this.ctx.today();
    const last = addDays(today, WINDOW_DAYS);
    const priority = this.booking.canSeePriority(id);
    const byDate = new Map<ISODate, SlotOption[]>();
    this.booking.activePsychologists().forEach((psy: PsychologistProfile) => {
      this.booking
        .freeSlots(psy.id, priority)
        .filter((slot) => slot.date <= last)
        .forEach((slot) => {
          const option: SlotOption = {
            slotId: slot.id,
            psychologistId: psy.id,
            psychologistName: psy.displayName,
            psychologistShort: shortName(psy.displayName),
            date: slot.date,
            time: slot.start,
            label: `${slot.start} com ${shortName(psy.displayName)}`,
          };
          byDate.set(slot.date, [...(byDate.get(slot.date) ?? []), option]);
        });
    });
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, slots]) => ({
        date,
        label: formatDayShort(date, today),
        slots: slots.sort((a, b) => a.time.localeCompare(b.time) || a.psychologistName.localeCompare(b.psychologistName)),
      }));
  }

  /** Acha o horário de uma opção (a vaga pode ter sido tomada desde que a lista abriu). */
  optionOf(slotId: ID): SlotOption | null {
    const slot = this.db.availabilitySlots.get(slotId);
    const psy = slot ? this.db.psychologists.get(slot.psychologistId) : undefined;
    if (!slot || !psy) {
      return null;
    }
    return {
      slotId: slot.id,
      psychologistId: psy.id,
      psychologistName: psy.displayName,
      psychologistShort: shortName(psy.displayName),
      date: slot.date,
      time: slot.start,
      label: `${slot.start} com ${shortName(psy.displayName)}`,
    };
  }

  psychologistLine(psychologistName: string, crp: string): string {
    return `${psychologistName}, ${roleOf(psychologistName)} (${crp}, fictício)`;
  }

  crpOf(psychologistId: ID): string {
    return this.db.psychologists.get(psychologistId)?.crp ?? '';
  }

  // ===== Gravações =====

  /** Marca a conversa. A confirmação (a folha de resumo) vem sempre antes. */
  book(request: BookRequest): ConversationResult {
    const result = this.booking.schedule(this.toInput(request));
    return result.ok ? { ok: true, session: result.value } : { ok: false, ...bookingErrorText(result.errors) };
  }

  /** Cancela a conversa da própria pessoa: com 24 horas ou mais libera o horário; com menos, vira falta. */
  cancel(conversation: Conversation): ConversationResult {
    if (!this.isMine(conversation.session)) {
      return { ok: false, field: 'session', error: 'Não encontramos esta conversa.' };
    }
    const result = this.booking.cancel(conversation.id, 'user');
    return result.ok ? { ok: true, session: result.value } : { ok: false, ...bookingErrorText(result.errors) };
  }

  /** Remarca: escolhe o horário novo e só então libera o antigo. */
  reschedule(conversation: Conversation, request: BookRequest): ConversationResult {
    if (!this.isMine(conversation.session)) {
      return { ok: false, field: 'session', error: 'Não encontramos esta conversa.' };
    }
    const result = this.booking.reschedule(conversation.id, this.toInput(request), 'user');
    return result.ok ? { ok: true, session: result.value } : { ok: false, ...bookingErrorText(result.errors) };
  }

  /** A pessoa tem direito a esta conversa? Só as dela. */
  isMine(session: Pick<CareSession, 'caregiverId'>): boolean {
    return session.caregiverId === this.ctx.caregiverId();
  }

  // ===== Internos =====

  private toInput(request: BookRequest): BookingInput {
    const caregiverId = this.ctx.requireCaregiverId();
    const room = request.format === 'in_person_coworking' ? this.room() : null;
    return {
      caregiverId,
      psychologistId: request.psychologistId,
      slotId: request.slotId,
      modality: request.format,
      kind: kindFromChoice(request.kind),
      ...(room ? { roomId: room.id } : {}),
      ...(request.format === 'in_person_home'
        ? { homeAddress: request.address, homeSafetyPending: true }
        : {}),
    };
  }

  private toConversation(session: CareSession, today: ISODate): Conversation {
    const psy = this.db.psychologists.get(session.psychologistId);
    const name = psy?.displayName ?? 'Psicólogo da Nexus';
    const room = session.roomId ? this.db.rooms.get(session.roomId) : undefined;
    const started = this.booking.hasStarted(session);
    const open = session.status === 'scheduled' || session.status === 'confirmed';
    const date = dateOf(session.startAt);
    return {
      id: session.id,
      startAt: session.startAt,
      whenText: relativeDateTime(session.startAt, today),
      dayText: formatDayShort(date, today),
      time: timeOf(session.startAt),
      psychologistName: name,
      psychologistShort: shortName(name),
      psychologistRole: roleOf(name),
      crp: psy?.crp ?? '',
      format: session.modality,
      formatLabel: FORMAT_LABEL[session.modality],
      kindLabel: KIND_LABEL[session.kind],
      statusText: statusText(session),
      place:
        session.modality === 'in_person_coworking' && room
          ? `${room.name}, ${room.address}`
          : session.modality === 'in_person_home'
            ? (session.homeAddress ?? null)
            : null,
      upcoming: open && !started && compareDateTimes(session.startAt, this.clock.now()) > 0,
      late: this.booking.isLateCancellation(session),
      session,
    };
  }
}
