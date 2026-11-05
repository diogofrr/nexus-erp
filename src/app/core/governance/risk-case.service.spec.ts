import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { loginAs } from '../../shared/ui/testing/dom';
import { configureCoreTest } from '../testing/test-helpers';
import { RiskCaseService } from './risk-case.service';

describe('casos de risco (POP-05, RN-ZRT-15, A-29)', () => {
  it('abre a ocorrência com 7 passos, restrita ao RT e ao psicólogo do caso, uma só por alerta', () => {
    const { db } = configureCoreTest({ seed: true, today: '2026-11-04', time: '12:00' });
    loginAs('u3');
    const risk = TestBed.inject(RiskCaseService);
    const first = risk.openPop05({ caregiverId: 'cg_0005', sourceAlertId: 'zal_x' });
    expect(first.kind).toBe('pop05_risk');
    expect(first.steps).toHaveLength(7);
    expect([...first.restrictedToUserIds].sort()).toEqual(['u2', 'u3']);
    expect(risk.openPop05({ caregiverId: 'cg_0005', sourceAlertId: 'zal_x' }).id).toBe(first.id);
    expect(db.occurrences.count((o) => o.sourceAlertId === 'zal_x')).toBe(1);
  });

  it('marca o passo com hora e responsável sem sobrescrever o que já foi feito, e não reabre ocorrência encerrada', () => {
    const { db } = configureCoreTest({ seed: true, today: '2026-11-04', time: '12:00' });
    loginAs('u3');
    const risk = TestBed.inject(RiskCaseService);
    const occurrence = risk.openPop05({ caregiverId: 'cg_0005' });
    const done = risk.stepDone(occurrence.id, 2, { byUserId: 'u3', at: '2026-11-04T10:42:00-03:00', note: 'Contato feito.' });
    expect(done?.status).toBe('in_progress');
    expect(done?.steps[1]).toMatchObject({ doneAt: '2026-11-04T10:42:00-03:00', byUserId: 'u3', note: 'Contato feito.' });
    const again = risk.stepDone(occurrence.id, 2, { byUserId: 'u2', at: '2026-11-04T11:00:00-03:00', note: 'Texto de outra pessoa.' });
    expect(again?.steps[1]?.byUserId).toBe('u3');
    expect(again?.steps[1]?.doneAt).toBe('2026-11-04T10:42:00-03:00');
    // CX-017: o texto de quem veio depois não é gravado num passo que outra pessoa já concluiu.
    expect(again?.steps[1]?.note).toBe('Contato feito.');
    db.occurrences.update(occurrence.id, { status: 'closed' });
    const closed = risk.stepDone(occurrence.id, 3, { byUserId: 'u3' });
    expect(closed?.status).toBe('closed');
    expect(closed?.steps[2]?.doneAt).toBeUndefined();
  });

  it('registra o encaminhamento ligado à ocorrência e ao cuidador', () => {
    const { db } = configureCoreTest({ seed: true });
    loginAs('u3');
    const risk = TestBed.inject(RiskCaseService);
    const occurrence = risk.openPop05({ caregiverId: 'cg_0005' });
    const referral = risk.registerReferral({
      caregiverId: 'cg_0005',
      category: 'severe_distress_or_suicide_risk',
      destinations: ['CVV (188)'],
      byUserId: 'u3',
      occurrenceId: occurrence.id,
    });
    expect(referral.status).toBe('registered');
    expect(db.referrals.get(referral.id)?.occurrenceId).toBe(occurrence.id);
    expect(db.accessLog.list().some((e) => e.entity === 'referral' && e.action === 'create')).toBe(true);
  });
});
