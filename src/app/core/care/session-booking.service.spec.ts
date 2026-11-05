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

  it('o valor da conversa vem do plano: Livre 120, Essencial 108, Cuida 102, Sustenta 96 (RN-ATD-05)', () => {
    const { booking } = setup();
    expect(booking.quote('cg_0004').totalCents).toBe(12000);
    expect(booking.quote('cg_0006').totalCents).toBe(10800);
    expect(booking.quote('cg_0001')).toMatchObject({ totalCents: 10200, discountCents: 1800, discountPercent: 15 });
    expect(booking.quote('cg_0009').totalCents).toBe(9600);
  });

  it('agenda a conversa: a vaga sai da lista, o preço é o do plano e o psicólogo precisa estar ativo', () => {
    const { booking, db } = setup();
    const slot = farSlot(booking, 'cg_0003');
    const result = booking.schedule(input(slot, 'cg_0003'));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value).toMatchObject({
      caregiverId: 'cg_0003',
      status: 'scheduled',
      modality: 'online',
      kind: 'guidance',
      priceCents: 12000,
      discountPercent: 0,
    });
    expect(db.availabilitySlots.get(slot.id)?.status).toBe('booked');
    expect(booking.isSlotFree(db.availabilitySlots.require(slot.id))).toBe(false);
    expect(booking.freeSlots(slot.psychologistId, true).some((s) => s.id === slot.id)).toBe(false);
  });

  it('vaga tomada, formato e tipo faltando e endereço e segurança do domicílio: erro por campo, nada grava', () => {
    const { booking, db } = setup();
    const slot = farSlot(booking, 'cg_0003');
    expect(booking.schedule(input(slot, 'cg_0003')).ok).toBe(true);
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
    const slot = farSlot(booking, 'cg_0003');
    const noAddress = booking.schedule(input(slot, 'cg_0003', { modality: 'in_person_home', homeSafetyPending: true }));
    expect(noAddress.ok ? [] : noAddress.errors.map((e) => e.field)).toEqual(['homeAddress']);
    const created = booking.schedule(
      input(slot, 'cg_0003', { modality: 'in_person_home', homeSafetyPending: true, homeAddress: '  Rua das Flores, 45  ' }),
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
    const slot = farSlot(booking, 'cg_0003');
    const created = booking.schedule(input(slot, 'cg_0003'));
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(booking.isLateCancellation(created.value)).toBe(false);
    const cancelled = booking.cancel(created.value.id, 'user');
    expect(cancelled.ok && cancelled.value.status).toBe('cancelled_by_user');
    expect(db.availabilitySlots.get(slot.id)?.status).toBe('open');

    const again = farSlot(booking, 'cg_0003');
    const second = booking.schedule(input(again, 'cg_0003'));
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
    const first = farSlot(booking, 'cg_0003');
    const created = booking.schedule(input(first, 'cg_0003'));
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const same = booking.reschedule(created.value.id, input(first, 'cg_0003'), 'user');
    expect(same.ok ? '' : same.errors[0]?.field).toBe('slot');

    const next = farSlot(booking, 'cg_0003', booking.startOf(first));
    const moved = booking.reschedule(created.value.id, input(next, 'cg_0003'), 'user');
    expect(moved.ok).toBe(true);
    if (!moved.ok) {
      return;
    }
    expect(moved.value.status).toBe('scheduled');
    const old = db.careSessions.require(created.value.id);
    expect(old).toMatchObject({ status: 'cancelled_by_user', rescheduledToId: moved.value.id, rescheduleRequestedBy: 'user' });
    expect(db.availabilitySlots.get(first.id)?.status).toBe('open');
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
