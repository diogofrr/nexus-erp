/**
 * A borda de cada serviço do cuidador confere a posse (QAC-001): com a sessão de um cuidador aberta, nenhum serviço lê nem
 * grava o que é de outra pessoa, mesmo chamado direto com o id dela. O guardião (`CaregiverOwnership`) é testado em
 * `core/auth/caregiver-ownership.spec.ts`; aqui se confere que cada serviço o usa. Sem sessão de cuidador (a equipe) nada
 * muda: os serviços da equipe seguem com a checagem de perfil de sempre.
 */
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { CaregiverOwnershipError, NOT_OWNER_TEXT } from '../../../core/auth/caregiver-ownership';
import { CaregiverSessionService } from '../../../core/auth/caregiver-session.service';
import { CaregiverMessagesService } from '../../../core/care/caregiver-messages.service';
import { DoseCheckService } from '../../../core/care/dose-check.service';
import { ReviewRequestService } from '../../../core/care/review-request.service';
import { SessionBookingService } from '../../../core/care/session-booking.service';
import { WellbeingCheckService } from '../../../core/care/wellbeing-check.service';
import { SubscriptionService } from '../../../core/commerce/subscription.service';
import { CaregiverActivitiesService } from '../../../core/groups/caregiver-activities.service';
import { CaregiverNetworkService } from '../../../core/network/caregiver-network.service';
import { ConsentService } from '../../../core/privacy/consent.service';
import { DataSubjectRequestService } from '../../../core/privacy/data-subject-request.service';
import { SubjectRightsService } from '../../../core/privacy/subject-rights.service';
import { configureCoreTest } from '../../../core/testing/test-helpers';
import { AgendaService } from '../routine/state/agenda.service';
import { MedicationService } from '../routine/state/medication.service';
import { ProfileService } from '../start/state/profile.service';

const ANA = 'cg_0001';
const MARIA = 'cg_0002';

function setup(signedInAs: string | null) {
  const env = configureCoreTest({ seed: true });
  if (signedInAs) {
    expect(TestBed.inject(CaregiverSessionService).signIn(signedInAs).status).toBe('ok');
  }
  const db = env.db;
  const elderOf = (caregiverId: string) => db.elders.find((e) => e.caregiverId === caregiverId)!;
  return { ...env, db, elderOf };
}

describe('Posse na borda dos serviços do cuidador (QAC-001)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('rede e grupos: pedir serviço, inscrever, ler pedidos e inscrições em nome de outra pessoa é recusado', () => {
    const { db } = setup(ANA);
    const network = TestBed.inject(CaregiverNetworkService);
    const activities = TestBed.inject(CaregiverActivitiesService);
    const before = db.serviceRequests.count((r) => r.caregiverId === MARIA);
    expect(network.createRequest(MARIA, { providerId: 'prv_01', need: 'Fisioterapia', modality: 'home' })).toEqual({ ok: false, error: NOT_OWNER_TEXT });
    expect(db.serviceRequests.count((r) => r.caregiverId === MARIA)).toBe(before);
    expect(network.requestsOf(MARIA)).toEqual([]);
    expect(network.ordersOf(MARIA)).toEqual([]);
    expect(network.awaitingCount(MARIA)).toBe(0);
    expect(network.toEvaluateCount(MARIA)).toBe(0);
    expect(activities.enroll(MARIA, 'act_0002', { contractAccepted: true })).toEqual({ ok: false, error: NOT_OWNER_TEXT });
    expect(activities.myEnrollments(MARIA)).toEqual([]);
    // O que é dela continua funcionando.
    expect(network.requestsOf(ANA).length).toBeGreaterThanOrEqual(0);
    expect(network.createRequest(ANA, { providerId: 'prv_01', need: 'Fisioterapia em casa', modality: 'home' }).ok).toBe(true);
  });

  it('plano: trocar, manter, reativar e criar assinatura de outra pessoa lança o erro de posse e nada muda', () => {
    const { db } = setup(ANA);
    const subscriptions = TestBed.inject(SubscriptionService);
    const mariaSub = db.subscriptions.find((s) => s.caregiverId === MARIA)!;
    const before = JSON.stringify(mariaSub);
    expect(() => subscriptions.changePlan(mariaSub.id, 'sustenta')).toThrow(CaregiverOwnershipError);
    expect(() => subscriptions.keepPlan(mariaSub.id)).toThrow(CaregiverOwnershipError);
    expect(() => subscriptions.reactivate(mariaSub.id)).toThrow(CaregiverOwnershipError);
    expect(() => subscriptions.startSubscription(MARIA, 'cuida')).toThrow(CaregiverOwnershipError);
    expect(JSON.stringify(db.subscriptions.require(mariaSub.id))).toBe(before);
  });

  it('privacidade: pedir cópia, pedir eliminação, retirar pedido, baixar o arquivo e decidir autorização de outra pessoa é recusado', () => {
    const { db } = setup(ANA);
    const rights = TestBed.inject(SubjectRightsService);
    const dsr = TestBed.inject(DataSubjectRequestService);
    const consents = TestBed.inject(ConsentService);
    expect(rights.requestCopy(MARIA)).toEqual({ ok: false, reason: 'not_allowed' });
    expect(rights.requestErasure(MARIA)).toEqual({ ok: false, reason: 'not_allowed' });
    expect(rights.requestsOf(MARIA)).toEqual([]);
    expect(() => dsr.open({ caregiverId: MARIA, type: 'access' })).toThrow(CaregiverOwnershipError);
    expect(() => dsr.exportSubjectJson(MARIA)).toThrow(CaregiverOwnershipError);
    expect(() => consents.grant(MARIA, 'family_sharing', { channel: 'app', registeredByUserId: ANA })).toThrow(CaregiverOwnershipError);
    expect(() => consents.refuse(MARIA, 'image_testimony', { channel: 'app', registeredByUserId: ANA })).toThrow(CaregiverOwnershipError);
    expect(db.caregivers.require(MARIA).status).toBe('active');
    // Os dois lados: a própria pessoa pede e baixa a cópia dela.
    expect(rights.requestCopy(ANA).ok).toBe(true);
    expect(JSON.parse(dsr.exportSubjectJson(ANA)).subject.code).toBe('CUI-0001');
  });

  it('mensagens, humor, doses e pedido de revisão: ler e gravar em nome de outra pessoa é recusado', () => {
    const { db, elderOf } = setup(ANA);
    const messages = TestBed.inject(CaregiverMessagesService);
    const wellbeing = TestBed.inject(WellbeingCheckService);
    const doses = TestBed.inject(DoseCheckService);
    const reviews = TestBed.inject(ReviewRequestService);
    expect(messages.thread(MARIA)).toEqual([]);
    expect(messages.send(MARIA, { subject: '', body: 'em nome de outra pessoa' })).toEqual({ ok: false, error: NOT_OWNER_TEXT });
    expect(() => wellbeing.record(MARIA, 3)).toThrow(CaregiverOwnershipError);
    expect(wellbeing.forDay(MARIA, '2026-11-04')).toBeUndefined();
    expect(wellbeing.range(MARIA, '2026-10-01', '2026-11-04')).toEqual([]);
    expect(doses.forElder(elderOf(MARIA).id, '2026-11-04')).toEqual([]);
    expect(reviews.forCaregiver(MARIA)).toEqual([]);
    expect(reviews.register(MARIA, 'zarit_decision', 'Peço a revisão em nome dela.')).toEqual({ ok: false, reason: 'not_owner' });
    expect(db.reviewRequests.count((r) => r.caregiverId === MARIA && r.text.includes('em nome dela'))).toBe(0);
    expect(doses.forElder(elderOf(ANA).id, '2026-11-04').length).toBeGreaterThan(0);
  });

  it('remédios e agenda: ler, adicionar, editar e tirar da pessoa idosa de outra pessoa é recusado', () => {
    const { db, elderOf } = setup(ANA);
    const medications = TestBed.inject(MedicationService);
    const agenda = TestBed.inject(AgendaService);
    const maria = elderOf(MARIA);
    const med = db.medications.find((m) => m.elderId === maria.id)!;
    const appointment = db.careAppointments.find((a) => a.elderId === maria.id)!;
    expect(medications.medicationsOf(maria.id)).toEqual([]);
    expect(agenda.appointmentsOf(maria.id)).toEqual([]);
    expect(() => medications.add(maria.id, { name: 'Remédio novo', dosage: '', times: ['08:00'], active: true })).toThrow(CaregiverOwnershipError);
    expect(() => agenda.add(maria.id, { title: 'Consulta', kind: 'medical', date: '2026-11-10', time: '10:00', place: '', reminder: true })).toThrow(CaregiverOwnershipError);
    expect(() => agenda.setReminder(appointment.id, false)).toThrow(CaregiverOwnershipError);
    expect(() => agenda.restore(appointment)).toThrow(CaregiverOwnershipError);
    expect(() => medications.changeGivenTime('dose_9999', '08:00')).toThrow(CaregiverOwnershipError);
    expect(db.medications.require(med.id).name).toBe(med.name);
    expect(db.careAppointments.require(appointment.id).reminder).toBe(appointment.reminder);
    // A pessoa idosa dela: tudo funciona, e o "Desfazer" de um compromisso tirado volta o mesmo registro.
    const mine = elderOf(ANA);
    const removed = agenda.remove(db.careAppointments.find((a) => a.elderId === mine.id)!.id);
    expect(agenda.restore(removed).id).toBe(removed.id);
    expect(medications.add(mine.id, { name: 'Remédio novo', dosage: '', times: ['08:00'], active: true }).elderId).toBe(mine.id);
  });

  it('agendar, cancelar e remarcar a conversa de outra pessoa é recusado; perfil de outra pessoa também', () => {
    const { db } = setup(ANA);
    const booking = TestBed.inject(SessionBookingService);
    const profile = TestBed.inject(ProfileService);
    const slot = db.availabilitySlots.find((s) => s.status === 'open' && !s.priorityOnly)!;
    const draft = { caregiverId: MARIA, psychologistId: slot.psychologistId, slotId: slot.id, modality: 'online' as const, kind: 'guidance' as const };
    const scheduled = booking.schedule(draft);
    expect(scheduled.ok ? '' : scheduled.errors[0]).toMatchObject({ message: NOT_OWNER_TEXT });
    expect(db.availabilitySlots.require(slot.id).status).toBe('open');
    const lourdes = db.careSessions.require('ses_0062');
    expect(booking.cancel(lourdes.id, 'user').ok).toBe(false);
    expect(booking.reschedule(lourdes.id, { ...draft, caregiverId: ANA }, 'user').ok).toBe(false);
    expect(db.careSessions.require(lourdes.id).status).toBe(lourdes.status);
    expect(() => profile.updateDaily(MARIA, { hours: 3, channel: 'app', whatsapp: '' })).toThrow(CaregiverOwnershipError);
  });

  it('sem sessão de cuidador (a equipe) os mesmos serviços funcionam: a checagem de perfil é a da equipe', () => {
    const { db } = setup(null);
    const rights = TestBed.inject(SubjectRightsService);
    const messages = TestBed.inject(CaregiverMessagesService);
    expect(rights.requestCopy(MARIA).ok).toBe(true);
    expect(messages.send(MARIA, { subject: '', body: 'registrado pela equipe' }).ok).toBe(true);
    expect(TestBed.inject(SubscriptionService).planOf(MARIA)).toBe('essencial');
    expect(db.caregivers.require(MARIA).status).toBe('active');
  });
});
