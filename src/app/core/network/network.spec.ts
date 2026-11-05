import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Database } from '../data/database';
import { configureCoreTest } from '../testing/test-helpers';
import { NetworkService } from './network.service';
import { documentView, graveCountOf } from './provider-metrics';

describe('rede credenciada: números calculados', () => {
  let db: Database;
  let network: NetworkService;

  beforeEach(() => {
    ({ db } = configureCoreTest({ seed: true, today: '2026-11-04', time: '12:00' }));
    network = TestBed.inject(NetworkService);
  });

  it('taxa de recusa e selo de risco de saída seguem o seed (62,5%, 28,6% e 30,0%)', () => {
    const p04 = network.summaryOf('prv_04');
    expect(p04?.refusal.percent).toBe(62.5);
    expect(p04?.refusal.exitRisk).toBe(true);
    const p03 = network.summaryOf('prv_03');
    expect(p03?.refusal.percent).toBe(28.6);
    expect(p03?.refusal.exitRisk).toBe(false);
    const p06 = network.summaryOf('prv_06');
    expect(p06?.refusal.percent).toBe(30);
    expect(p06?.refusal.exitRisk).toBe(true);
  });

  it('média só com 5 avaliações, 4,50 é excelência e 4,00 é alerta', () => {
    expect(network.summaryOf('prv_13')?.average).toBeNull();
    expect(network.summaryOf('prv_13')?.band).toBe('no_average');
    expect(network.summaryOf('prv_08')?.average).toBe(4.5);
    expect(network.summaryOf('prv_08')?.band).toBe('excellence');
    expect(network.summaryOf('prv_09')?.average).toBe(4);
    expect(network.summaryOf('prv_09')?.band).toBe('alert');
    expect(network.summaryOf('prv_15')?.evaluationCount).toBe(5);
  });

  it('descredenciamento por média abaixo de 4,0 e por três reclamações graves com média 4,31', () => {
    const p10 = network.summaryOf('prv_10');
    expect(p10?.average).toBe(3.57);
    expect(p10?.band).toBe('deaccreditation');
    const p14 = network.summaryOf('prv_14');
    expect(p14?.average).toBe(4.31);
    expect(p14?.graveCount).toBe(3);
    expect(p14?.band).toBe('deaccreditation');
    expect(p14?.trigger).toBe('grave_complaints');
  });

  it('graves contam por data de classificação (a terceira entrou depois da auditoria de D-14)', () => {
    const evaluations = db.providerEvaluations.all();
    const complaints = db.complaints.all();
    expect(graveCountOf('prv_14', evaluations, complaints, '2026-10-21')).toBe(2);
    expect(graveCountOf('prv_14', evaluations, complaints)).toBe(3);
  });

  it('documento vencido, vencendo e em conferência', () => {
    expect(documentView({ status: 'expired', validUntil: '2026-10-23' }, '2026-11-04').state).toBe(
      'expired',
    );
    expect(documentView({ status: 'valid', validUntil: '2026-11-16' }, '2026-11-04')).toEqual({
      state: 'expiring',
      daysLeft: 12,
    });
    expect(documentView({ status: 'pending', validUntil: '2027-05-30' }, '2026-11-04').state).toBe(
      'in_review',
    );
    expect(documentView({ status: 'valid' }, '2026-11-04').state).toBe('valid');
  });

  it('a terceira reclamação grave suspende na hora e abre a avaliação interna (RN-ARP-10)', () => {
    const before = network.reevaluate('prv_05');
    expect(before.suspended).toBe(false);
    // Duas graves não suspendem; a terceira sim.
    const evaluations = db.providerEvaluations.query((e) => e.providerId === 'prv_05');
    evaluations.slice(0, 2).forEach((e) =>
      db.providerEvaluations.update(e.id, {
        grave: { category: 'other', classifiedBy: 'u1', classifiedAt: '2026-11-04' },
      }),
    );
    expect(network.reevaluate('prv_05').suspended).toBe(false);
    expect(db.providers.get('prv_05')?.status).toBe('active');
    const third = evaluations[2];
    expect(third).toBeDefined();
    db.providerEvaluations.update((third as { id: string }).id, {
      grave: { category: 'other', classifiedBy: 'u1', classifiedAt: '2026-11-04' },
    });
    const outcome = network.reevaluate('prv_05');
    expect(outcome.suspended).toBe(true);
    expect(db.providers.get('prv_05')?.status).toBe('suspended');
    expect(db.internalReviews.find((r) => r.providerId === 'prv_05' && !r.decision)).toBeDefined();
    expect(
      db.providerStatusEvents.find((e) => e.providerId === 'prv_05' && e.to === 'suspended'),
    ).toBeDefined();
    // Já suspenso: não repete.
    expect(network.reevaluate('prv_05').suspended).toBe(false);
  });
});
