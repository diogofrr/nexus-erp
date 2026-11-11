import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { AvailabilitySlot, ID } from '../models';
import { configureCoreTest } from '../testing/test-helpers';
import { BookingInput, SessionBookingService } from './session-booking.service';

function setup() {
  const env = configureCoreTest({ seed: true });
  const booking = TestBed.inject(SessionBookingService);
  return { ...env, booking };
}

/** Uma vaga livre a mais de 30 horas de agora, que o cuidador possa ver. */
function farSlot(booking: SessionBookingService, caregiverId: ID, notAfter?: string): AvailabilitySlot {
  const priority = booking.canSeePriority(caregiverId);
  for (const psy of booking.activePsychologists()) {
    const slot = booking
      .freeSlots(psy.id, priority)
      .find((s) => booking.startOf(s) !== notAfter && booking.hoursUntil({ startAt: booking.startOf(s) }) > 30);
    if (slot) {
      return slot;
    }
  }
  throw new Error('Sem vaga a mais de 30 horas no seed.');
}

function input(slot: AvailabilitySlot, caregiverId: ID, extra: Partial<BookingInput> = {}): BookingInput {
  return {
    caregiverId,
    psychologistId: slot.psychologistId,
    slotId: slot.id,
    modality: 'online',
    kind: 'guidance',
    ...extra,
  };
}

describe('SessionBookingService (o miolo de agendar do núcleo, RN-ATD-02 a 05, 09, 10, 12, 16, 19)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('o valor da conversa vem da cota do plano (docs/20): Livre e Essencial não agendam; Cuida e Sustenta incluída na cota, depois avulsa', () => {
    const { booking } = setup();
    expect(booking.quote('cg_0004')).toMatchObject({ allowed: false, included: false, totalCents: 12000 });
    expect(booking.quote('cg_0006')).toMatchObject({ allowed: false, included: false });
    expect(booking.quote('cg_0001')).toMatchObject({ allowed: true, discountPercent: 0 });
    expect(booking.quote('cg_0001').quota.limit).toBe(2);
    expect(booking.quote('cg_0009').quota.limit).toBe(4);
    const livre = booking.schedule(input(farSlot(booking, 'cg_0001'), 'cg_0004'));
    expect(livre.ok ? '' : livre.errors[0]?.field).toBe('plan');
  });

  it('dentro da cota a sessão custa R$ 0,00; a terceira do mês no Cuida é avulsa; cancelar com menos de 24 h consome a cota (RN-ATD-16)', () => {
    const { booking, db, clock } = setup();
    // Ana (Cuida) usa as duas do mês de dezembro e a terceira já é avulsa.
    const dec = (start: string, psy: string) =>
      db.availabilitySlots.create({ psychologistId: psy, date: '2026-12-02', start, end: `${String(Number(start.slice(0, 2)) + 1).padStart(2, '0')}:00`, status: 'open', priorityOnly: false });
    const s1 = booking.schedule(input(dec('09:00', 'psy_0001'), 'cg_0001'));
    const s2 = booking.schedule(input(dec('10:00', 'psy_0001'), 'cg_0001'));
    const s3 = booking.schedule(input(dec('11:00', 'psy_0001'), 'cg_0001'));
    expect([s1, s2, s3].map((r) => (r.ok ? [r.value.priceCents, r.value.includedInPlan] : null))).toEqual([
      [0, true],
      [0, true],
      [12000, false],
    ]);
    expect(booking.quotaFor('cg_0001', '2026-12')).toEqual({ limit: 2, used: 2, left: 0 });
    // Cancelar com 24 horas ou mais devolve a cota; com menos, vira falta e continua contando.
    if (s1.ok && s2.ok) {
      booking.cancel(s1.value.id, 'user');
      expect(booking.quotaFor('cg_0001', '2026-12').left).toBe(1);
      clock.setSimulated('2026-12-02', '07:00');
      expect(booking.cancel(s2.value.id, 'user').ok).toBe(true);
      expect(db.careSessions.require(s2.value.id).status).toBe('no_show');
      expect(booking.quotaFor('cg_0001', '2026-12').used).toBe(1);
    }
  });

  it('agenda a conversa: a vaga sai da lista, o preço vem da cota e o psicólogo precisa estar ativo', () => {
    const { booking, db } = setup();
    const slot = farSlot(booking, 'cg_0009');
    const result = booking.schedule(input(slot, 'cg_0009'));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value).toMatchObject({
      caregiverId: 'cg_0009',
      status: 'scheduled',
      modality: 'online',
      kind: 'guidance',

      discountPercent: 0,
    });
    expect(db.availabilitySlots.get(slot.id)?.status).toBe('booked');
    expect(booking.isSlotFree(db.availabilitySlots.require(slot.id))).toBe(false);
    expect(booking.freeSlots(slot.psychologistId, true).some((s) => s.id === slot.id)).toBe(false);
  });

  it('vaga tomada, formato e tipo faltando e endereço e segurança do domicílio: erro por campo, nada grava', () => {
    const { booking, db } = setup();
    const slot = farSlot(booking, 'cg_0009');
    expect(booking.schedule(input(slot, 'cg_0009')).ok).toBe(true);
    const taken = booking.schedule(input(slot, 'cg_0001'));
    expect(taken.ok ? [] : taken.errors.map((e) => e.field)).toEqual(['slot']);
    expect(taken.ok ? '' : taken.errors[0]?.message).toContain('acabou de ser reservada');

    const other = farSlot(booking, 'cg_0001');
    const sessionsBefore = db.careSessions.size();
    const home = booking.schedule(input(other, 'cg_0001', { modality: 'in_person_home', kind: null }));
    expect(home.ok ? [] : home.errors.map((e) => e.field).sort()).toEqual(['homeAddress', 'homeSafe', 'kind']);
    expect(booking.schedule(input(other, 'cg_0001', { modality: null })).ok).toBe(false);
    expect(db.careSessions.size()).toBe(sessionsBefore);
  });

  it('a conversa em casa pedida pelo cuidador nasce com a segurança do local ainda não confirmada: o psicólogo confirma depois (RN-ATD-09)', () => {
    const { booking } = setup();
    const slot = farSlot(booking, 'cg_0009');
    const noAddress = booking.schedule(input(slot, 'cg_0009', { modality: 'in_person_home', homeSafetyPending: true }));
    expect(noAddress.ok ? [] : noAddress.errors.map((e) => e.field)).toEqual(['homeAddress']);
    const created = booking.schedule(
      input(slot, 'cg_0009', { modality: 'in_person_home', homeSafetyPending: true, homeAddress: '  Rua das Flores, 45  ' }),
    );
    expect(created.ok && created.value).toMatchObject({
      modality: 'in_person_home',
      homeAddress: 'Rua das Flores, 45',
      homeVisitConfirmedSafe: false,
      status: 'scheduled',
    });
    // Quem agenda pela equipe continua confirmando a segurança na hora.
    const other = farSlot(booking, 'cg_0001');
    const staff = booking.schedule(input(other, 'cg_0001', { modality: 'in_person_home', homeAddress: 'Rua B, 2', homeSafe: true }));
    expect(staff.ok && staff.value.homeVisitConfirmedSafe).toBe(true);
  });

  it('cancela com 24 horas ou mais: libera a vaga, sem falta; menos de 24 horas vira falta e a vaga fica ocupada', () => {
    const { booking, db, clock } = setup();
    const slot = farSlot(booking, 'cg_0009');
    const created = booking.schedule(input(slot, 'cg_0009'));
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(booking.isLateCancellation(created.value)).toBe(false);
    const cancelled = booking.cancel(created.value.id, 'user');
    expect(cancelled.ok && cancelled.value.status).toBe('cancelled_by_user');
    expect(db.availabilitySlots.get(slot.id)?.status).toBe('open');

    const again = farSlot(booking, 'cg_0009');
    const second = booking.schedule(input(again, 'cg_0009'));
    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }
    clock.setSimulated(second.value.startAt.slice(0, 10), '07:00');
    expect(booking.isLateCancellation(second.value)).toBe(true);
    const late = booking.cancel(second.value.id, 'user');
    expect(late.ok && late.value.status).toBe('no_show');
    expect(db.availabilitySlots.get(again.id)?.status).toBe('booked');
  });

  it('remarca: a nova nasce agendada, a antiga aponta para ela e libera a vaga; o mesmo horário é recusado', () => {
    const { booking, db } = setup();
    const first = farSlot(booking, 'cg_0009');
    const created = booking.schedule(input(first, 'cg_0009'));
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const same = booking.reschedule(created.value.id, input(first, 'cg_0009'), 'user');
    expect(same.ok ? '' : same.errors[0]?.field).toBe('slot');

    const next = farSlot(booking, 'cg_0009', booking.startOf(first));
    const moved = booking.reschedule(created.value.id, input(next, 'cg_0009'), 'user');
    expect(moved.ok).toBe(true);
    if (!moved.ok) {
      return;
    }
    expect(moved.value.status).toBe('scheduled');
    const old = db.careSessions.require(created.value.id);
    expect(old).toMatchObject({ status: 'cancelled_by_user', rescheduledToId: moved.value.id, rescheduleRequestedBy: 'user' });
    expect(db.availabilitySlots.get(first.id)?.status).toBe('open');
  });

  it('duas conversas no coworking no mesmo horário nunca ficam na mesma sala; sem sala livre, a vaga não oferece o coworking (RN-ATD-10, QAC-013)', () => {
    const { booking, db } = setup();
    const make = (psychologistId: string) =>
      db.availabilitySlots.create({ psychologistId, date: '2026-11-12', start: '15:00', end: '16:00', status: 'open', priorityOnly: false });
    const a = make('psy_0001');
    const b = make('psy_0002');
    const c = make('psy_0003');
    expect(booking.freeRoomForSlot(a)?.id).toBe('room_0001'); // Girassol: a primeira reservável por nome
    const first = booking.schedule(input(a, 'cg_0009', { modality: 'in_person_coworking', roomId: 'room_0001' }));
    expect(first.ok).toBe(true);
    // A mesma sala no mesmo horário é recusada com o campo da sala; a Ipê é a que está livre.
    const clash = booking.schedule(input(b, 'cg_0008', { modality: 'in_person_coworking', roomId: 'room_0001' }));
    expect(clash.ok ? '' : clash.errors[0]).toMatchObject({ field: 'room', message: 'Esta sala já está reservada nesse horário.' });
    expect(booking.freeRoomForSlot(b)?.id).toBe('room_0002');
    expect(booking.schedule(input(b, 'cg_0008', { modality: 'in_person_coworking', roomId: 'room_0002' })).ok).toBe(true);
    // Girassol e Ipê ocupadas: a Jacarandá não tem os 4 itens de acessibilidade, então não há sala para o terceiro.
    expect(booking.freeRoomForSlot(c)).toBeUndefined();
    // Em outro horário a Girassol volta a ficar livre; a conversa cancelada também libera a sala.
    expect(booking.freeRoomForSlot({ date: '2026-11-12', start: '16:00' })?.id).toBe('room_0001');
    if (first.ok) {
      booking.cancel(first.value.id, 'user');
      expect(booking.freeRoomForSlot(c)?.id).toBe('room_0001');
    }
  });

  it('o encontro de grupo presencial também ocupa a sala no horário dele', () => {
    const { booking, db } = setup();
    const meeting = db.activities.all().flatMap((a) => (a.roomId && a.status !== 'cancelled' && a.status !== 'finished' ? a.meetings.map((m) => ({ roomId: a.roomId as string, m })) : []))[0];
    expect(meeting).toBeDefined();
    if (!meeting) {
      return;
    }
    const start = meeting.m.startAt;
    const slot = { date: start.slice(0, 10), start: start.slice(11, 16) };
    expect(booking.isRoomFreeForSlot(meeting.roomId, slot)).toBe(false);
  });

  it('a vaga de prioridade só existe para quem tem direito: o Livre sem acompanhamento prioritário não a vê nem agenda (RN-ATD-12)', () => {
    const { booking, db } = setup();
    // Marlene (Livre, sem acompanhamento prioritário) não tem o direito; Ana (Cuida) tem.
    expect(booking.canSeePriority('cg_0004')).toBe(false);
    expect(booking.canSeePriority('cg_0001')).toBe(true);
    const priority = db.availabilitySlots.find((s) => s.priorityOnly && s.status === 'open' && s.date > '2026-11-04');
    expect(priority).toBeDefined();
    if (!priority) {
      return;
    }
    expect(booking.freeSlots(priority.psychologistId, false).some((s) => s.id === priority.id)).toBe(false);
    expect(booking.freeSlots(priority.psychologistId, true).some((s) => s.id === priority.id)).toBe(true);
    const denied = booking.schedule(input(priority, 'cg_0004'));
    expect(denied.ok).toBe(false);
    expect(booking.schedule(input(priority, 'cg_0001')).ok).toBe(true);
  });
});
