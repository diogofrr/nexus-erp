import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Database } from '../data/database';
import { configureCoreTest } from '../testing/test-helpers';
import { CaregiverActivitiesService } from './caregiver-activities.service';

describe('grupos e capacitações vistos pelo cuidador (RN-GRP-02, 09, 13, 14, 17)', () => {
  let db: Database;
  let service: CaregiverActivitiesService;

  beforeEach(() => {
    ({ db } = configureCoreTest({ seed: true, today: '2026-11-04', time: '12:00' }));
    service = TestBed.inject(CaregiverActivitiesService);
  });

  const standing = (caregiverId: string, activityId: string) =>
    service.standingOf(caregiverId, db.activities.require(activityId));

  it('a programação só tem atividades abertas, lotadas e em andamento, a mais próxima primeiro', () => {
    const programme = service.programme();
    // Próximos encontros: act_0003 hoje às 16:00, act_0001 em 07/11, act_0008 em 10/11, act_0002 em 14/11, act_0004 em 19/11.
    expect(programme.map((a) => a.id)).toEqual(['act_0003', 'act_0001', 'act_0008', 'act_0002', 'act_0004']);
    ['act_0005', 'act_0006', 'act_0007'].forEach((id) => {
      expect(programme.map((a) => a.id)).not.toContain(id);
      expect(service.visible(id)).toBeUndefined();
    });
    expect(service.visible('act_0001')?.status).toBe('full');
  });

  it('grupo de apoio e capacitação são do plano Cuida; a roda aberta vale para todos (o mesmo para todo o mesmo plano)', () => {
    // Maria (Essencial), João (Livre) e Marcos (Essencial): travado. Ana (Cuida) e Elza (Sustenta): liberado.
    ['cg_0002', 'cg_0003', 'cg_0026', 'cg_0016'].forEach((id) => {
      expect(standing(id, 'act_0008').kind).toBe('plan_locked');
      expect(standing(id, 'act_0002').kind).toBe('plan_locked');
    });
    expect(standing('cg_0002', 'act_0004')).toEqual({ kind: 'can_join', full: false, position: null });
    expect(standing('cg_0003', 'act_0004').kind).toBe('enrolled');
    expect(standing('cg_0027', 'act_0008')).toEqual({ kind: 'can_join', full: false, position: null });
  });

  it('mostra se está inscrita, a posição na lista de espera e quando a atividade já começou', () => {
    expect(standing('cg_0001', 'act_0001').kind).toBe('enrolled');
    expect(standing('cg_0024', 'act_0001')).toMatchObject({ kind: 'waitlist', position: 1 });
    expect(standing('cg_0027', 'act_0001')).toMatchObject({ kind: 'waitlist', position: 2 });
    expect(standing('cg_0002', 'act_0003').kind).toBe('in_progress');
    expect(standing('cg_0004', 'act_0003').kind).toBe('enrolled');
  });

  it('terapia de grupo só com a indicação do psicólogo: sem inscrição feita por ele, o cuidador não entra sozinho (RN-GRP-14)', () => {
    db.activities.update('act_0003', { status: 'open' });
    expect(standing('cg_0002', 'act_0003').kind).toBe('needs_indication');
    const refused = service.enroll('cg_0002', 'act_0003', { contractAccepted: true });
    expect(refused).toEqual({ ok: false, error: 'Esta atividade começa com a indicação do seu psicólogo. Fale com a gente.' });
    expect(db.activityEnrollments.count((e) => e.activityId === 'act_0003' && e.caregiverId === 'cg_0002')).toBe(0);
  });

  it('minhas inscrições: inscrita e em lista de espera, só em atividades da programação', () => {
    const mine = service.myEnrollments('cg_0001').map((m) => m.activity.id).sort();
    // act_0005 (encerrada) não entra.
    expect(mine).toEqual(['act_0001', 'act_0002']);
    expect(service.myEnrollments('cg_0024').map((m) => [m.activity.id, m.enrollment.status])).toEqual([['act_0001', 'waitlist']]);
    expect(service.myEnrollments('cg_0002')).toEqual([]);
  });

  it('entra com o aceite do sigilo, gravado com data e hora; sem o aceite, não entra', () => {
    expect(service.enroll('cg_0027', 'act_0008', { contractAccepted: false })).toEqual({
      ok: false,
      error: 'Marque que você leu o contrato de sigilo para entrar.',
    });
    expect(db.activityEnrollments.count((e) => e.activityId === 'act_0008' && e.caregiverId === 'cg_0027')).toBe(0);
    const ok = service.enroll('cg_0027', 'act_0008', { contractAccepted: true, acceptedAt: '2026-11-04T09:42:00-03:00' });
    expect(ok).toMatchObject({ ok: true, waitlisted: false, position: null });
    const saved = db.activityEnrollments.find((e) => e.activityId === 'act_0008' && e.caregiverId === 'cg_0027');
    expect(saved).toMatchObject({ status: 'enrolled', confidentialityAcceptedAt: '2026-11-04T09:42:00-03:00' });
    expect(service.enroll('cg_0027', 'act_0008', { contractAccepted: true })).toEqual({ ok: false, error: 'Você já está nesta atividade.' });
  });

  it('lotada, entra na lista de espera na próxima posição; o grupo continua lotado', () => {
    // act_0001 está lotada (8 de 8) e a fila já tem 2 pessoas; Terezinha (Essencial) passa ao Cuida para poder entrar.
    expect(standing('cg_0008', 'act_0001').kind).toBe('enrolled');
    const sub = db.subscriptions.find((s) => s.caregiverId === 'cg_0012');
    db.subscriptions.update(sub?.id ?? '', { planId: 'cuida' });
    expect(standing('cg_0012', 'act_0001')).toEqual({ kind: 'can_join', full: true, position: 3 });
    const result = service.enroll('cg_0012', 'act_0001', { contractAccepted: true });
    expect(result).toMatchObject({ ok: true, waitlisted: true, position: 3 });
    expect(standing('cg_0012', 'act_0001')).toMatchObject({ kind: 'waitlist', position: 3 });
    expect(db.activities.require('act_0001').status).toBe('full');
  });

  it('plano que não inclui não inscreve; atividade em andamento não aceita inscrição', () => {
    expect(service.enroll('cg_0002', 'act_0008', { contractAccepted: true })).toMatchObject({ ok: false });
    expect(db.activityEnrollments.count((e) => e.activityId === 'act_0008' && e.caregiverId === 'cg_0002')).toBe(0);
    expect(service.enroll('cg_0002', 'act_0003', { contractAccepted: true })).toEqual({
      ok: false,
      error: 'Esta atividade já começou. As inscrições estão encerradas.',
    });
    expect(service.enroll('cg_0002', 'act_0005', { contractAccepted: true })).toEqual({ ok: false, error: 'Não encontramos esta atividade.' });
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
    expect(service.leave('cg_0001', mine?.id ?? '')).toEqual({ ok: false, error: 'Você já não está nesta atividade.' });
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
