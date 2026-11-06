import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { CaregiverSessionService } from '../../../../core/auth/caregiver-session.service';
import { configureCoreTest } from '../../../../core/testing/test-helpers';
import { ConversationsService } from './conversations.service';

const ANA = 'cg_0001';

function setup() {
  const env = configureCoreTest({ seed: true, today: '2026-11-04', time: '12:00' });
  expect(TestBed.inject(CaregiverSessionService).signIn(ANA).status).toBe('ok');
  const make = (psychologistId: string, start = '15:00', end = '16:00') =>
    env.db.availabilitySlots.create({ psychologistId, date: '2026-11-12', start, end, status: 'open', priorityOnly: false });
  return { ...env, conversations: TestBed.inject(ConversationsService), make };
}

const slotIds = (days: { slots: { slotId: string }[] }[]) => days.flatMap((d) => d.slots.map((s) => s.slotId));

describe('ConversationsService: sala do coworking livre no horário (RN-ATD-10, QAC-013)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('a sala é a primeira reservável livre no horário: a Girassol, e a Ipê quando a Girassol já está em uso', () => {
    const { conversations, make, db } = setup();
    const a = make('psy_0001');
    const b = make('psy_0002');
    expect(conversations.roomForSlot(a.id)?.name).toBe('Sala Girassol');
    const booked = conversations.book({ slotId: a.id, psychologistId: 'psy_0001', format: 'in_person_coworking', kind: 'guidance', address: '' });
    expect(booked.ok).toBe(true);
    expect(db.careSessions.require(booked.ok ? booked.session.id : '').roomId).toBe('room_0001');
    expect(conversations.roomForSlot(b.id)?.name).toBe('Sala Ipê');
    // Outro horário não é afetado.
    const later = make('psy_0001', '16:00', '17:00');
    expect(conversations.roomForSlot(later.id)?.name).toBe('Sala Girassol');
  });

  it('sem sala livre no horário, o coworking não é oferecido para ele (os outros formatos seguem) e o agendamento é recusado', () => {
    const { conversations, make, db } = setup();
    const a = make('psy_0001');
    const b = make('psy_0002');
    const startAt = '2026-11-12T15:00:00-03:00';
    // Duas outras pessoas ocupam a Girassol e a Ipê neste horário; a Jacarandá não tem os 4 itens de acessibilidade.
    ['room_0001', 'room_0002'].forEach((roomId, i) =>
      db.careSessions.create({
        caregiverId: `cg_00${30 + i}`,
        psychologistId: 'psy_0003',
        slotId: `slt_fake_${i}`,
        startAt,
        durationMin: 60,
        modality: 'in_person_coworking',
        roomId,
        kind: 'guidance',
        status: 'scheduled',
        priceCents: 12000,
        discountPercent: 0,
      }),
    );
    expect(conversations.roomForSlot(b.id)).toBeNull();
    expect(slotIds(conversations.slotsFor('in_person_coworking'))).not.toContain(a.id);
    expect(slotIds(conversations.slotsFor('in_person_coworking'))).not.toContain(b.id);
    expect(slotIds(conversations.slotsFor('online'))).toEqual(expect.arrayContaining([a.id, b.id]));
    const refused = conversations.book({ slotId: b.id, psychologistId: 'psy_0002', format: 'in_person_coworking', kind: 'guidance', address: '' });
    expect(refused).toMatchObject({ ok: false, field: 'room' });
    expect(db.careSessions.count((s) => s.slotId === b.id)).toBe(0);
  });

  it('o encontro de grupo presencial também ocupa a sala no horário dele', () => {
    const { conversations, db } = setup();
    const group = db.activities.all().find((a) => a.roomId && a.status !== 'cancelled' && a.status !== 'finished' && a.meetings.length > 0)!;
    const meeting = group.meetings[0]!;
    const slot = db.availabilitySlots.create({
      psychologistId: 'psy_0001',
      date: meeting.startAt.slice(0, 10),
      start: meeting.startAt.slice(11, 16),
      end: meeting.endAt.slice(11, 16),
      status: 'open',
      priorityOnly: false,
    });
    // A sala do grupo nunca é a escolhida para a conversa no mesmo horário (outra sala, ou nenhuma).
    expect(conversations.roomForSlot(slot.id)?.id).not.toBe(group.roomId);
  });
});

describe('ConversationsService: posse da conversa (QAC-001)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('isMine confere o registro guardado pelo id, não o objeto recebido', () => {
    const { conversations } = setup();
    const mine = conversations.next()!;
    expect(conversations.isMine({ id: mine.id })).toBe(true);
    expect(conversations.isMine({ id: 'ses_0062' })).toBe(false); // da Lourdes
    expect(conversations.isMine({ id: 'ses_9999' })).toBe(false);
  });
});
