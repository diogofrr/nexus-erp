import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Database } from '../data/database';
import { configureCoreTest } from '../testing/test-helpers';
import { CaregiverOwnership, CaregiverOwnershipError, NOT_OWNER_TEXT } from './caregiver-ownership';
import { CaregiverSessionService } from './caregiver-session.service';

const ANA = 'cg_0001';
const MARIA = 'cg_0002';

function setup(signedInAs: string | null) {
  const env = configureCoreTest({ seed: true });
  if (signedInAs) {
    expect(TestBed.inject(CaregiverSessionService).signIn(signedInAs).status).toBe('ok');
  }
  const db = TestBed.inject(Database);
  const own = (caregiverId: string) => {
    const elder = db.elders.find((e) => e.caregiverId === caregiverId)!;
    return {
      elder,
      medication: db.medications.find((m) => m.elderId === elder.id)!,
      appointment: db.careAppointments.find((a) => a.elderId === elder.id)!,
    };
  };
  return { ...env, ownership: TestBed.inject(CaregiverOwnership), own };
}

describe('CaregiverOwnership (guardião de posse, QAC-001)', () => {
  it('sem sessão de cuidador deixa passar (a equipe confere o perfil na borda dos serviços dela)', () => {
    const { ownership, own } = setup(null);
    expect(ownership.actorId()).toBeNull();
    expect(ownership.ownsCaregiver(MARIA)).toBe(true);
    expect(ownership.ownsElder(own(MARIA).elder.id)).toBe(true);
    expect(ownership.ownsMedication(own(MARIA).medication.id)).toBe(true);
    expect(() => ownership.assertCaregiver(MARIA)).not.toThrow();
  });

  it('com a sessão da Ana, o que é dela passa e o que é da Maria é recusado em cada tipo de registro', () => {
    const { ownership, own, db } = setup(ANA);
    const ana = own(ANA);
    const maria = own(MARIA);
    expect(ownership.actorId()).toBe(ANA);
    expect(ownership.ownsCaregiver(ANA)).toBe(true);
    expect(ownership.ownsElder(ana.elder.id)).toBe(true);
    expect(ownership.ownsMedication(ana.medication.id)).toBe(true);
    expect(ownership.ownsAppointment(ana.appointment.id)).toBe(true);

    expect(ownership.ownsCaregiver(MARIA)).toBe(false);
    expect(ownership.ownsElder(maria.elder.id)).toBe(false);
    expect(ownership.ownsMedication(maria.medication.id)).toBe(false);
    expect(ownership.ownsAppointment(maria.appointment.id)).toBe(false);

    const check = db.doseChecks.create({ medicationId: maria.medication.id, date: '2026-11-04', time: maria.medication.times[0]!, givenAt: '2026-11-04T08:00:00-03:00' });
    expect(ownership.ownsDoseCheck(check.id)).toBe(false);
    // A conversa da Lourdes (ses_0062) não é da Ana.
    const session = db.careSessions.require('ses_0062');
    expect(session.caregiverId).not.toBe(ANA);
    expect(ownership.ownsCareSession(session.id)).toBe(false);
    const mine = db.careSessions.find((s) => s.caregiverId === ANA)!;
    expect(ownership.ownsCareSession(mine.id)).toBe(true);
  });

  it('as versões que lançam usam o erro de domínio com a frase única', () => {
    const { ownership, own } = setup(ANA);
    expect(() => ownership.assertCaregiver(MARIA)).toThrow(CaregiverOwnershipError);
    expect(() => ownership.assertMedication(own(MARIA).medication.id)).toThrow(NOT_OWNER_TEXT);
    expect(() => ownership.assertElder(own(MARIA).elder.id)).toThrow(CaregiverOwnershipError);
    expect(() => ownership.assertAppointment(own(MARIA).appointment.id)).toThrow(CaregiverOwnershipError);
    expect(() => ownership.assertCaregiver(ANA)).not.toThrow();
    expect(NOT_OWNER_TEXT).not.toMatch(/\u2014|\u2013|!/);
  });

  it('registro que não existe conta como de outro, com a mesma frase (nada se revela)', () => {
    const { ownership } = setup(ANA);
    expect(ownership.ownsMedication('med_9999')).toBe(false);
    expect(ownership.ownsElder(undefined)).toBe(false);
    expect(ownership.ownsCaregiver(null)).toBe(false);
    expect(() => ownership.assertCareSession('ses_9999')).toThrow(NOT_OWNER_TEXT);
  });

  it('uma sessão cujo cadastro deixou de poder entrar continua sem poder agir sobre os outros', () => {
    const { ownership, db } = setup(ANA);
    db.caregivers.update(ANA, { status: 'closed' });
    expect(ownership.actorId()).toBe(ANA);
    expect(ownership.ownsCaregiver(MARIA)).toBe(false);
  });

  it('sair da sessão do cuidador devolve o comportamento sem sessão', () => {
    const { ownership } = setup(ANA);
    expect(ownership.ownsCaregiver(MARIA)).toBe(false);
    TestBed.inject(CaregiverSessionService).signOut();
    expect(ownership.actorId()).toBeNull();
    expect(ownership.ownsCaregiver(MARIA)).toBe(true);
  });
});
