import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Database } from '../data/database';
import { configureCoreTest } from '../testing/test-helpers';
import { CaregiverActivitiesService, GROUP_THERAPY_PLAN_BLOCKED } from './caregiver-activities.service';

describe('encontros vistos pelo cuidador (docs/20; RN-GRP-03, 09, 13, 17)', () => {
  let db: Database;
  let service: CaregiverActivitiesService;

  beforeEach(() => {
    ({ db } = configureCoreTest({ seed: true, today: '2026-11-04', time: '12:00' }));
    service = TestBed.inject(CaregiverActivitiesService);
  });

  const standing = (caregiverId: string, activityId: string) =>
    service.standingOf(caregiverId, db.activities.require(activityId));

  it('a programação só tem encontros abertos, lotados e em andamento, o mais próximo primeiro', () => {
    const programme = service.programme();
    // Próximos encontros: G1 07/11, G8 10/11, G3 11/11, G9 12/11, G2 14/11, G10 16/11, G4 19/11, G11 26/11.
    expect(programme.map((a) => a.id)).toEqual(['act_0001', 'act_0008', 'act_0003', 'act_0009', 'act_0002', 'act_0010', 'act_0004', 'act_0011']);
    ['act_0005', 'act_0006', 'act_0007'].forEach((id) => {
      expect(programme.map((a) => a.id)).not.toContain(id);
      expect(service.visible(id)).toBeUndefined();
    });
    expect(service.visible('act_0001')?.status).toBe('full');
  });

  it('regra de exibição 2: Livre e Essencial não veem terapia de grupo em lugar nenhum; Cuida e Sustenta veem tudo', () => {
    ['cg_0002', 'cg_0003', 'cg_0026'].forEach((id) => {
      expect(service.visibleKinds(id)).toEqual(['open_circle', 'training']);
      expect(service.visibleProgramme(id).some((a) => a.kind === 'group_therapy')).toBe(false);
      expect(service.visibleTo(id, 'act_0008')).toBeUndefined();
      expect(service.visibleTo(id, 'act_0009')?.id).toBe('act_0009');
    });
    expect(service.visibleKinds('cg_0001')).toEqual(['open_circle', 'training', 'group_therapy']);
    expect(service.visibleProgramme('cg_0027').map((a) => a.id)).toContain('act_0008');
  });

  it('roda aberta grátis para todos; capacitação incluída ou avulsa; terapia de grupo travada no Livre e no Essencial', () => {
    expect(standing('cg_0002', 'act_0004')).toMatchObject({ kind: 'can_join', full: false, offer: { kind: 'free' } });
    expect(standing('cg_0003', 'act_0004').kind).toBe('enrolled');
    expect(standing('cg_0003', 'act_0009')).toMatchObject({ kind: 'can_join', offer: { kind: 'paid', priceCents: 4000 } });
    expect(standing('cg_0001', 'act_0009')).toMatchObject({ kind: 'can_join', offer: { kind: 'included', priceCents: 0 } });
    ['cg_0002', 'cg_0003', 'cg_0026', 'cg_0016'].forEach((id) => expect(standing(id, 'act_0008').kind).toBe('plan_locked'));
    // Ana já usou os 2 encontros de terapia de grupo de novembro na G1: a G8 sai avulsa (R$ 60,00 por encontro).
    expect(standing('cg_0001', 'act_0008')).toMatchObject({ kind: 'can_join', offer: { kind: 'paid', priceCents: 12000 } });
    expect(standing('cg_0027', 'act_0008')).toMatchObject({ kind: 'can_join', full: false });
  });

  it('mostra se está inscrita, a posição na lista de espera e quando o encontro já começou', () => {
    expect(standing('cg_0001', 'act_0001').kind).toBe('enrolled');
    expect(standing('cg_0024', 'act_0001')).toMatchObject({ kind: 'waitlist', position: 1 });
    expect(standing('cg_0027', 'act_0001')).toMatchObject({ kind: 'waitlist', position: 2 });
    expect(standing('cg_0009', 'act_0003').kind).toBe('in_progress');
    expect(standing('cg_0024', 'act_0003').kind).toBe('enrolled');
  });

  it('terapia de grupo não exige indicação do psicólogo (docs/20): Cuida e Sustenta entram com o sigilo', () => {
    db.activities.update('act_0003', { status: 'open' });
    const ok = service.enroll('cg_0009', 'act_0003', { contractAccepted: true });
    expect(ok).toMatchObject({ ok: true, waitlisted: false });
    expect(service.enroll('cg_0002', 'act_0003', { contractAccepted: true })).toEqual({ ok: false, error: GROUP_THERAPY_PLAN_BLOCKED });
  });

  it('minhas inscrições: inscrita e em lista de espera, só em encontros da programação', () => {
    expect(service.myEnrollments('cg_0001').map((m) => m.activity.id).sort()).toEqual(['act_0001', 'act_0002']);
    expect(service.myEnrollments('cg_0024').map((m) => [m.activity.id, m.enrollment.status])).toEqual([
      ['act_0001', 'waitlist'],
      ['act_0003', 'enrolled'],
    ]);
    expect(service.myEnrollments('cg_0002').map((m) => m.activity.id)).toEqual(['act_0002']);
    expect(service.myEnrollments('cg_0003').map((m) => m.activity.id)).toEqual(['act_0004', 'act_0011']);
  });

  it('entra com o aceite do sigilo, gravado com data e hora, e grava se é incluída ou avulsa', () => {
    expect(service.enroll('cg_0027', 'act_0008', { contractAccepted: false })).toEqual({
      ok: false,
      error: 'Marque que você leu o contrato de sigilo para entrar.',
    });
    const ok = service.enroll('cg_0027', 'act_0009', { contractAccepted: true, acceptedAt: '2026-11-04T09:42:00-03:00' });
    expect(ok).toMatchObject({ ok: true, waitlisted: false, position: null });
    expect(db.activityEnrollments.find((e) => e.activityId === 'act_0009' && e.caregiverId === 'cg_0027')).toMatchObject({
      status: 'enrolled',
      confidentialityAcceptedAt: '2026-11-04T09:42:00-03:00',
      includedInPlan: true,
      paid: false,
      priceCents: 0,
    });
    // João (Livre) paga a capacitação avulsa (pagamento simulado).
    service.enroll('cg_0003', 'act_0009', { contractAccepted: true });
    expect(db.activityEnrollments.find((e) => e.activityId === 'act_0009' && e.caregiverId === 'cg_0003')).toMatchObject({
      includedInPlan: false,
      paid: true,
      priceCents: 4000,
    });
    expect(service.enroll('cg_0027', 'act_0009', { contractAccepted: true })).toEqual({ ok: false, error: 'Você já está neste encontro.' });
  });

  it('lotado, entra na lista de espera na próxima posição; o grupo continua lotado', () => {
    expect(standing('cg_0008', 'act_0001').kind).toBe('enrolled');
    expect(standing('cg_0017', 'act_0001')).toMatchObject({ kind: 'can_join', full: true, position: 3 });
    const result = service.enroll('cg_0017', 'act_0001', { contractAccepted: true });
    expect(result).toMatchObject({ ok: true, waitlisted: true, position: 3 });
    expect(standing('cg_0017', 'act_0001')).toMatchObject({ kind: 'waitlist', position: 3 });
    expect(db.activities.require('act_0001').status).toBe('full');
  });

  it('plano que não inclui não inscreve; encontro em andamento não aceita inscrição', () => {
    expect(service.enroll('cg_0002', 'act_0008', { contractAccepted: true })).toMatchObject({ ok: false });
    expect(db.activityEnrollments.count((e) => e.activityId === 'act_0008' && e.caregiverId === 'cg_0002')).toBe(0);
    expect(service.enroll('cg_0009', 'act_0003', { contractAccepted: true })).toEqual({
      ok: false,
      error: 'Este encontro já começou. As inscrições estão encerradas.',
    });
    expect(service.enroll('cg_0002', 'act_0005', { contractAccepted: true })).toEqual({ ok: false, error: 'Não encontramos este encontro.' });
  });

  it('ao sair, a vaga volta e o primeiro da fila é promovido (RN-GRP-13)', () => {
    const mine = db.activityEnrollments.find((e) => e.activityId === 'act_0001' && e.caregiverId === 'cg_0001');
    const result = service.leave('cg_0001', mine?.id ?? '');
    expect(result.ok && result.promoted.map((e) => e.caregiverId)).toEqual(['cg_0024']);
    expect(db.activityEnrollments.require(mine?.id ?? '').status).toBe('cancelled');
    expect(standing('cg_0024', 'act_0001').kind).toBe('enrolled');
    expect(standing('cg_0027', 'act_0001')).toMatchObject({ kind: 'waitlist', position: 1 });
  });

  it('só o dono sai da inscrição, e só uma que está ativa', () => {
    const mine = db.activityEnrollments.find((e) => e.activityId === 'act_0001' && e.caregiverId === 'cg_0001');
    expect(service.leave('cg_0002', mine?.id ?? '')).toEqual({ ok: false, error: 'Não encontramos esta inscrição.' });
    expect(service.leave('cg_0001', mine?.id ?? '').ok).toBe(true);
    expect(service.leave('cg_0001', mine?.id ?? '')).toEqual({ ok: false, error: 'Você já não está neste encontro.' });
  });

  it('nenhuma frase de resposta fala de pontuação, faixa, alerta ou risco (RN-PLN-19)', () => {
    const answers = [
      service.enroll('cg_0002', 'act_0008', { contractAccepted: true }),
      service.enroll('cg_0002', 'act_0003', { contractAccepted: true }),
      service.enroll('cg_0002', 'act_0004', { contractAccepted: false }),
    ].map((r) => (r.ok ? '' : r.error.toLowerCase()));
    answers.forEach((a) => expect(a).not.toMatch(/zarit|pontua|faixa|alerta|risco|arbe/));
  });
});
