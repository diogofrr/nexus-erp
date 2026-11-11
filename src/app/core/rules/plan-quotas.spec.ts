import { describe, expect, it } from 'vitest';
import { Activity, ActivityEnrollment, CareSession } from '../models';
import {
  PLAN_QUOTAS,
  SINGLE_PRICES_CENTS,
  enrollmentOffer,
  groupTherapyQuota,
  includedSentence,
  individualSessionQuota,
  limitText,
  meetingsInMonth,
  quotaLeft,
  quotaSentence,
  singlePriceText,
  trainingQuota,
} from './plan-quotas';

const session = (startAt: string, status: CareSession['status'], includedInPlan = true): Pick<CareSession, 'startAt' | 'status' | 'includedInPlan'> => ({
  startAt,
  status,
  includedInPlan,
});

const act = (id: string, kind: Activity['kind'], dates: string[]): Pick<Activity, 'id' | 'kind' | 'meetings'> => ({
  id,
  kind,
  meetings: dates.map((d, i) => ({ id: `${id}_m${i}`, startAt: `${d}T14:00:00-03:00`, endAt: `${d}T16:00:00-03:00`, done: false })),
});

const enr = (activityId: string, status: ActivityEnrollment['status'] = 'enrolled', includedInPlan = true): Pick<ActivityEnrollment, 'activityId' | 'status' | 'includedInPlan'> => ({
  activityId,
  status,
  includedInPlan,
});

describe('cotas mensais por plano (docs/20)', () => {
  it('a tabela: sessões 0, 0, 2, 4; terapia de grupo 0, 0, 2, 2; capacitações 0, 2, todas, todas', () => {
    expect([PLAN_QUOTAS.livre, PLAN_QUOTAS.essencial, PLAN_QUOTAS.cuida, PLAN_QUOTAS.sustenta].map((q) => q.individualSessionsPerMonth)).toEqual([0, 0, 2, 4]);
    expect([PLAN_QUOTAS.livre, PLAN_QUOTAS.essencial, PLAN_QUOTAS.cuida, PLAN_QUOTAS.sustenta].map((q) => q.groupTherapyPerMonth)).toEqual([0, 0, 2, 2]);
    expect([PLAN_QUOTAS.livre, PLAN_QUOTAS.essencial, PLAN_QUOTAS.cuida, PLAN_QUOTAS.sustenta].map((q) => q.trainingsPerMonth)).toEqual([0, 2, 'all', 'all']);
    expect(PLAN_QUOTAS.livre.card).toBe(false);
    expect(PLAN_QUOTAS.essencial.card && PLAN_QUOTAS.essencial.exclusiveContent && PLAN_QUOTAS.essencial.networkConditions).toBe(true);
    expect(PLAN_QUOTAS.cuida.networkDifferentiated).toBe(false);
    expect(PLAN_QUOTAS.sustenta.networkDifferentiated).toBe(true);
  });

  it('avulsos: sessão R$ 120,00, terapia de grupo R$ 60,00 e capacitação R$ 40,00 por encontro', () => {
    expect(SINGLE_PRICES_CENTS).toEqual({ individual_session: 12000, group_therapy: 6000, training: 4000 });
    expect(singlePriceText('training')).toBe('R$ 40,00 por encontro');
    expect(singlePriceText('individual_session')).toBe('R$ 120,00 por sessão');
  });

  it('a cota é do mês e não acumula: o que sobrou em outubro não passa para novembro', () => {
    const sessions = [session('2026-10-05T10:00:00-03:00', 'done')];
    expect(individualSessionQuota('cuida', '2026-11', sessions)).toEqual({ limit: 2, used: 0, left: 2 });
    expect(individualSessionQuota('cuida', '2026-10', sessions)).toEqual({ limit: 2, used: 1, left: 1 });
    expect(quotaLeft(2, 5)).toBe(0);
    expect(quotaLeft('all', 9)).toBe('all');
  });

  it('cancelar com menos de 24 h (falta) consome a cota; cancelar antes devolve; avulsa não conta (RN-ATD-16)', () => {
    const sessions = [
      session('2026-11-05T10:00:00-03:00', 'no_show'),
      session('2026-11-06T10:00:00-03:00', 'cancelled_by_user'),
      session('2026-11-07T10:00:00-03:00', 'scheduled', false),
    ];
    expect(individualSessionQuota('cuida', '2026-11', sessions)).toEqual({ limit: 2, used: 1, left: 1 });
    expect(individualSessionQuota('livre', '2026-11', sessions).left).toBe(0);
  });

  it('a cota de encontros conta os encontros do mês das turmas incluídas; lista de espera não conta', () => {
    const activities = [act('g1', 'group_therapy', ['2026-11-07', '2026-11-21', '2026-12-05']), act('t1', 'training', ['2026-11-14'])];
    expect(meetingsInMonth(activities[0]!, '2026-11')).toBe(2);
    expect(groupTherapyQuota('cuida', '2026-11', [enr('g1')], activities)).toEqual({ limit: 2, used: 2, left: 0 });
    expect(groupTherapyQuota('cuida', '2026-11', [enr('g1', 'waitlist')], activities).used).toBe(0);
    expect(trainingQuota('essencial', '2026-11', [enr('t1')], activities)).toEqual({ limit: 2, used: 1, left: 1 });
    expect(trainingQuota('sustenta', '2026-11', [enr('t1')], activities)).toEqual({ limit: 'all', used: 1, left: 'all' });
  });

  it('a oferta da inscrição: roda aberta grátis; terapia de grupo bloqueada no Livre, incluída na cota e avulsa além dela', () => {
    const g1 = act('g1', 'group_therapy', ['2026-11-07', '2026-11-21']);
    const g2 = act('g2', 'group_therapy', ['2026-11-10', '2026-11-24']);
    const circle = act('c1', 'open_circle', ['2026-11-19']);
    expect(enrollmentOffer('livre', circle, '2026-11', [], [circle]).kind).toBe('free');
    expect(enrollmentOffer('essencial', g1, '2026-11', [], [g1]).kind).toBe('blocked');
    expect(enrollmentOffer('cuida', g1, '2026-11', [], [g1, g2])).toMatchObject({ kind: 'included', priceCents: 0, meetings: 2 });
    expect(enrollmentOffer('cuida', g2, '2026-11', [enr('g1')], [g1, g2])).toMatchObject({ kind: 'paid', priceCents: 12000 });
  });

  it('a oferta da capacitação: Livre paga avulsa; Essencial incluída até 2 encontros no mês; Cuida sempre incluída', () => {
    const t1 = act('t1', 'training', ['2026-11-14', '2026-11-21']);
    const t2 = act('t2', 'training', ['2026-11-12']);
    expect(enrollmentOffer('livre', t1, '2026-11', [], [t1])).toMatchObject({ kind: 'paid', priceCents: 8000 });
    expect(enrollmentOffer('essencial', t1, '2026-11', [], [t1, t2])).toMatchObject({ kind: 'included', priceCents: 0 });
    expect(enrollmentOffer('essencial', t2, '2026-11', [enr('t1')], [t1, t2])).toMatchObject({ kind: 'paid', priceCents: 4000 });
    expect(enrollmentOffer('cuida', t2, '2026-11', [enr('t1')], [t1, t2]).kind).toBe('included');
  });

  it('as frases: "Neste mês: 1 de 2 sessões usadas", "Incluída no seu plano (1 de 2 neste mês)", "2 sessões por mês"', () => {
    expect(quotaSentence({ limit: 2, used: 1, left: 1 }, 'sessões')).toBe('Neste mês: 1 de 2 sessões usadas');
    expect(quotaSentence({ limit: 2, used: 0, left: 2 }, 'encontros')).toBe('Neste mês: 0 de 2 encontros usados');
    expect(includedSentence({ limit: 2, used: 0, left: 2 })).toBe('Incluída no seu plano (1 de 2 neste mês)');
    expect(includedSentence({ limit: 'all', used: 3, left: 'all' })).toBe('Incluída no seu plano');
    expect(limitText(2, 'sessões')).toBe('2 sessões por mês');
    expect(limitText(0, 'encontros')).toBe('Não inclui');
    expect(limitText('all', 'capacitações')).toBe('Todas as do mês');
  });
});
