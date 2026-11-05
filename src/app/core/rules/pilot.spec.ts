import { describe, expect, it } from 'vitest';
import { PilotEnrollment } from '../models/finance';
import {
  eligibleCaregiverIds,
  evolutionAggregate,
  latestTotals,
  zaritSeriesByCaregiver,
} from './indicators';
import {
  PILOT_INDICATORS,
  checkGoalJustification,
  pilotGoalsEditableDirectly,
  pilotMonthOf,
  summarizePilot,
} from './pilot';

describe('Indicadores agregados: quem entra e como se agrega', () => {
  it('só entra quem tem saúde E People Analytics concedidos e cadastro vivo', () => {
    const caregivers = [
      { id: 'a', status: 'active' as const },
      { id: 'b', status: 'active' as const },
      { id: 'c', status: 'closed' as const },
      { id: 'd', status: 'active' as const },
    ];
    const consents = [
      { caregiverId: 'a', key: 'health_data' as const, status: 'granted' as const },
      { caregiverId: 'a', key: 'people_analytics' as const, status: 'granted' as const },
      { caregiverId: 'b', key: 'health_data' as const, status: 'granted' as const },
      { caregiverId: 'b', key: 'people_analytics' as const, status: 'refused' as const },
      { caregiverId: 'c', key: 'health_data' as const, status: 'granted' as const },
      { caregiverId: 'c', key: 'people_analytics' as const, status: 'granted' as const },
      { caregiverId: 'd', key: 'health_data' as const, status: 'revoked' as const },
      { caregiverId: 'd', key: 'people_analytics' as const, status: 'granted' as const },
    ];
    expect([...eligibleCaregiverIds(caregivers, consents)]).toEqual(['a']);
  });

  it('as séries saem em ordem de sequência e só com aplicações concluídas', () => {
    const series = zaritSeriesByCaregiver([
      { caregiverId: 'a', sequence: 1, status: 'completed', total: 28 },
      { caregiverId: 'a', sequence: 0, status: 'completed', total: 40 },
      { caregiverId: 'a', sequence: 2, status: 'scheduled' },
      { caregiverId: 'b', sequence: 0, status: 'completed', total: 12 },
    ]);
    expect(series.get('a')).toEqual([40, 28]);
    expect(latestTotals(series, new Set(['a', 'b']))).toEqual([28, 12]);
  });

  it('a evolução média só aparece com 5 ou mais cuidadores na conta', () => {
    const four = [[40, 30], [20, 10], [50, 25], [60, 30]];
    const small = evolutionAggregate(four);
    expect(small.sufficient).toBe(false);
    const five = [...four, [80, 40]];
    const ok = evolutionAggregate(five);
    expect(ok.sufficient).toBe(true);
    if (ok.sufficient) {
      expect(ok.value).toBe(-45);
    }
  });

  it('adesão zero não entra na conta (divisão por zero)', () => {
    const list = [[0, 12], [40, 20], [40, 20], [40, 20], [40, 20], [40, 20]];
    const result = evolutionAggregate(list);
    expect(result.sufficient).toBe(true);
    if (result.sufficient) {
      expect(result.n).toBe(5);
    }
  });
});

function enrollment(
  id: string,
  extra: Partial<PilotEnrollment> = {},
  windows: ('done' | 'pending' | 'missed')[] = ['done', 'done', 'pending'],
): PilotEnrollment {
  return {
    id: `pil_${id}`,
    createdAt: '2026-01-01T00:00:00-03:00',
    updatedAt: '2026-01-01T00:00:00-03:00',
    caregiverId: id,
    enrolledAt: '2026-07-01',
    tcleConsentEventId: 'ce_1',
    windows: [
      { name: 'enrollment', dueDate: '2026-07-01', status: windows[0] as 'done' },
      { name: 'month3', dueDate: '2026-10-01', status: windows[1] as 'done' },
      { name: 'month6', dueDate: '2027-01-01', status: windows[2] as 'done' },
    ],
    ...extra,
  };
}

describe('Piloto: resumo da coorte (RN-PIL-05, 09, 10)', () => {
  const goals = { zaritReductionPercent: 10, satisfactionMin: 4, conversionPercent: 3 };

  it('os 7 indicadores do Quadro 10 estão definidos com instrumento e momento', () => {
    expect(PILOT_INDICATORS).toHaveLength(7);
    expect(PILOT_INDICATORS[0]?.moment).toBe('Na adesão, aos 3 e aos 6 meses');
    expect(PILOT_INDICATORS.every((i) => i.instrument.length > 0 && i.moment.length > 0)).toBe(true);
  });

  it('conta as janelas e mostra "menos de 5" nos recortes pequenos', () => {
    const list = ['a', 'b', 'c'].map((id) =>
      enrollment(id, { satisfaction: 5, wouldRecommend: true }),
    );
    const summary = summarizePilot({
      enrollments: list,
      zaritSeries: new Map([['a', [40, 30]], ['b', [40, 30]], ['c', [40, 30]]]),
      usage: [{ accesses30d: 3 }, { accesses30d: 0 }, { accesses30d: 5 }],
      paidCaregiverIds: new Set(['a']),
      evaluationScores: [4.5],
      goals,
    });
    expect(summary.cohort).toBe(3);
    expect(summary.windows[0]).toEqual({ name: 'enrollment', done: 3, pending: 0, missed: 0 });
    expect(summary.windows[2]).toEqual({ name: 'month6', done: 0, pending: 3, missed: 0 });
    expect(summary.zaritMean.enrollment.sufficient).toBe(false);
    expect(summary.satisfaction.sufficient).toBe(false);
    expect(summary.goals.zaritReduction.status).toBe('insufficient');
    expect(summary.goals.satisfaction.status).toBe('insufficient');
    expect(summary.conversion).toEqual({ paid: 1, total: 3, percent: 33.3 });
  });

  it('com 5 ou mais, calcula médias e compara com as metas (indício, não prova)', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const list = ids.map((id, i) =>
      enrollment(id, {
        satisfaction: i % 2 === 0 ? 5 : 4,
        wouldRecommend: i !== 4,
        weeklyHoursStart: 10,
        weeklyHoursEnd: 7,
        chosenPlan: 'essencial',
      }),
    );
    const summary = summarizePilot({
      enrollments: list,
      zaritSeries: new Map(ids.map((id) => [id, [50, 40]] as [string, number[]])),
      usage: ids.map(() => ({ accesses30d: 4 })),
      paidCaregiverIds: new Set(['a', 'b']),
      evaluationScores: [5, 4, 4.5, 4.5, 5],
      goals,
    });
    expect(summary.zaritMean.enrollment).toMatchObject({ sufficient: true, value: 50 });
    expect(summary.zaritMean.month3).toMatchObject({ sufficient: true, value: 40 });
    expect(summary.zaritMean.month6.sufficient).toBe(false);
    expect(summary.weeklyHoursDelta).toMatchObject({ sufficient: true, value: -3 });
    expect(summary.satisfaction).toMatchObject({ sufficient: true, value: 4.6 });
    expect(summary.recommendation).toMatchObject({ sufficient: true, value: 80 });
    expect(summary.goals.zaritReduction).toMatchObject({ status: 'reached', value: 20 });
    expect(summary.goals.satisfaction.status).toBe('reached');
    expect(summary.goals.conversion).toMatchObject({ status: 'reached', value: 40 });
    expect(summary.networkRating).toMatchObject({ sufficient: true, value: 4.6 });
    expect(summary.chosenPlans.essencial).toMatchObject({ sufficient: true, value: 5 });
  });

  it('meta de satisfação não atingida aparece como não atingida', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const summary = summarizePilot({
      enrollments: ids.map((id) => enrollment(id, { satisfaction: 3 })),
      zaritSeries: new Map(),
      usage: [],
      paidCaregiverIds: new Set(),
      evaluationScores: [],
      goals,
    });
    expect(summary.goals.satisfaction).toMatchObject({ status: 'not_reached', value: 3 });
    expect(summary.goals.conversion).toMatchObject({ status: 'not_reached', value: 0 });
  });
});

describe('Piloto: metas editáveis e travadas (AC-M10-14)', () => {
  it('antes do início edita direto; depois exige justificativa de verdade', () => {
    expect(pilotGoalsEditableDirectly({ goalsLocked: false })).toBe(true);
    expect(pilotGoalsEditableDirectly({ startedAt: '2026-06-01', goalsLocked: true })).toBe(false);
    expect(checkGoalJustification({ goalsLocked: false }, '')).toEqual({ ok: true, message: null });
    expect(checkGoalJustification({ startedAt: '2026-06-01', goalsLocked: true }, 'curto').ok).toBe(false);
    expect(
      checkGoalJustification(
        { startedAt: '2026-06-01', goalsLocked: true },
        'Ajuste pedido pela reunião dos sócios.',
      ).ok,
    ).toBe(true);
  });

  it('o mês do piloto vai de 1 a 6', () => {
    expect(pilotMonthOf('2026-07-15', '2026-07-20')).toBe(1);
    expect(pilotMonthOf('2026-07-15', '2026-11-04')).toBe(4);
    expect(pilotMonthOf('2026-01-01', '2026-11-04')).toBe(6);
  });
});
