import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { loginAs } from '../../shared/ui/testing/dom';
import { configureCoreTest } from '../testing/test-helpers';
import { GroupMembershipService } from './group-membership.service';

describe('vagas, lista de espera e mudança de plano (RN-GRP-13, RN-GRP-17)', () => {
  it('conta vagas, ordena a fila e promove o primeiro quando uma vaga abre', () => {
    const { db } = configureCoreTest({ seed: true });
    loginAs('u7');
    const membership = TestBed.inject(GroupMembershipService);
    expect(membership.seatsTaken('act_0001')).toBe(6);
    expect(membership.seatsFree(db.activities.require('act_0001'))).toBe(0);
    expect(membership.waitlist('act_0001').map((e) => e.waitlistPosition)).toEqual([1, 2]);
    expect(membership.nextWaitlistPosition('act_0001')).toBe(3);
    const target = db.activityEnrollments.find((e) => e.activityId === 'act_0001' && e.caregiverId === 'cg_0001');
    const change = membership.cancelEnrollment(target?.id ?? '');
    expect(change.promoted.map((e) => e.caregiverId)).toEqual(['cg_0024']);
    expect(membership.waitlist('act_0001').map((e) => e.waitlistPosition)).toEqual([1]);
    expect(db.activities.get('act_0001')?.status).toBe('full');
  });

  it('o cuidador que cai de plano sai das turmas futuras de terapia em grupo; a capacitação e a encerrada ficam (docs/20, RN-GRP-17)', () => {
    const { db } = configureCoreTest({ seed: true });
    loginAs('u7');
    const membership = TestBed.inject(GroupMembershipService);
    const sub = db.subscriptions.find((s) => s.caregiverId === 'cg_0009');
    db.subscriptions.update(sub?.id ?? '', { planId: 'livre' });
    const touched = membership.reconcilePlanLoss('cg_0009').map((c) => c.cancelled.activityId);
    expect(touched).toEqual(['act_0001']);
    expect(db.activityEnrollments.find((e) => e.activityId === 'act_0002' && e.caregiverId === 'cg_0009')?.status).toBe('enrolled');
    expect(db.activityEnrollments.find((e) => e.activityId === 'act_0005' && e.caregiverId === 'cg_0009')?.status).toBe('attended');
    expect(membership.reconcileAll()).toEqual([]);
  });
});

describe('cotas e oferta da inscrição (docs/20)', () => {
  it('Ana usa os 2 encontros de terapia em grupo de novembro na G1: a G8 fica avulsa; Maria usou as 2 capacitações; João paga a capacitação e não tem terapia em grupo', () => {
    const { db } = configureCoreTest({ seed: true });
    loginAs('u7');
    const membership = TestBed.inject(GroupMembershipService);
    expect(membership.groupTherapyQuotaOf('cg_0001')).toEqual({ limit: 2, used: 2, left: 0 });
    expect(membership.offerFor(db.activities.require('act_0008'), 'cg_0001')).toMatchObject({ kind: 'paid', priceCents: 12000 });
    expect(membership.trainingQuotaOf('cg_0002')).toEqual({ limit: 2, used: 2, left: 0 });
    expect(membership.offerFor(db.activities.require('act_0009'), 'cg_0002')).toMatchObject({ kind: 'paid', priceCents: 4500 });
    // João (Livre): nenhuma capacitação incluída; a G9 (1 encontro) e a G2 (2 encontros) saem avulsas, pelo valor de cada uma.
    expect(membership.trainingQuotaOf('cg_0003')).toEqual({ limit: 0, used: 0, left: 0 });
    expect(membership.offerFor(db.activities.require('act_0009'), 'cg_0003')).toMatchObject({ kind: 'paid', priceCents: 4500, meetings: 1 });
    expect(membership.offerFor(db.activities.require('act_0002'), 'cg_0003')).toMatchObject({ kind: 'paid', priceCents: 9500, meetings: 2 });
    // Se a equipe muda o valor da capacitação, a oferta muda junto (o número de encontros não entra na conta).
    db.activities.update('act_0002', { priceCents: 12345 });
    expect(membership.offerFor(db.activities.require('act_0002'), 'cg_0003')).toMatchObject({ kind: 'paid', priceCents: 12345, meetings: 2 });
    expect(membership.offerFor(db.activities.require('act_0009'), 'cg_0001')).toMatchObject({ kind: 'included', priceCents: 0 });
    // Sem roda de conversa: nenhum encontro sai de graça fora da cota; a terapia em grupo segue fechada para o Livre.
    expect(membership.offerFor(db.activities.require('act_0008'), 'cg_0003').kind).toBe('blocked');
    expect(db.activities.all().every((a) => a.kind === 'training' || a.kind === 'group_therapy')).toBe(true);
    expect(membership.offerFor(db.activities.require('act_0008'), 'cg_0002').kind).toBe('blocked');
  });
});
