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
    expect(membership.seatsTaken('act_0001')).toBe(8);
    expect(membership.seatsFree(db.activities.require('act_0001'))).toBe(0);
    expect(membership.waitlist('act_0001').map((e) => e.waitlistPosition)).toEqual([1, 2]);
    expect(membership.nextWaitlistPosition('act_0001')).toBe(3);
    const target = db.activityEnrollments.find((e) => e.activityId === 'act_0001' && e.caregiverId === 'cg_0001');
    const change = membership.cancelEnrollment(target?.id ?? '');
    expect(change.promoted.map((e) => e.caregiverId)).toEqual(['cg_0024']);
    expect(membership.waitlist('act_0001').map((e) => e.waitlistPosition)).toEqual([1]);
    expect(db.activities.get('act_0001')?.status).toBe('full');
  });

  it('o cuidador que cai de plano sai das turmas futuras; encerrada não muda', () => {
    const { db } = configureCoreTest({ seed: true });
    loginAs('u7');
    const membership = TestBed.inject(GroupMembershipService);
    const sub = db.subscriptions.find((s) => s.caregiverId === 'cg_0009');
    db.subscriptions.update(sub?.id ?? '', { planId: 'livre' });
    const touched = membership.reconcilePlanLoss('cg_0009').map((c) => c.cancelled.activityId);
    expect(touched).toEqual(expect.arrayContaining(['act_0001', 'act_0002', 'act_0008']));
    expect(db.activityEnrollments.find((e) => e.activityId === 'act_0005' && e.caregiverId === 'cg_0009')?.status).toBe('attended');
    expect(membership.reconcileAll()).toEqual([]);
  });
});
