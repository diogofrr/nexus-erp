import { describe, expect, it } from 'vitest';
import { ArpSnapshot } from '../models/network';
import { Complaint } from '../models/messages';
import { DataSubjectRequest } from '../models/lgpd';
import {
  appUsageStats,
  averageEvolutionPercent,
  complaintStats,
  countFreeUsers,
  countPriorityRisks,
  countSubscribers,
  dsrCounts,
  openArbeByLevel,
  openZaritAlertsByLevel,
  participationStats,
  pilotGoalReached,
  pilotStats,
  popsToReview,
  providersByBand,
  zaritBandCounts,
  zaritDistribution,
} from './kpi';

describe('KPIs comerciais (K01 a K03)', () => {
  it('assinantes: planos pagos active ou cancel_scheduled, inclusive os pagos por empresa', () => {
    const subs = [
      { planId: 'essencial', status: 'active', payer: 'self' },
      { planId: 'essencial', status: 'cancel_scheduled', payer: 'self' },
      { planId: 'cuida', status: 'active', payer: 'corporate' },
      { planId: 'sustenta', status: 'active', payer: 'self' },
      { planId: 'sustenta', status: 'cancelled', payer: 'self' },
      { planId: 'livre', status: 'active', payer: 'self' },
    ] as const;
    const counts = countSubscribers(subs);
    expect(counts).toEqual({
      total: 4,
      byPlan: { essencial: 2, cuida: 1, sustenta: 1 },
      corporate: 1,
    });
  });

  it('usuários gratuitos acumulados excluem cadastros encerrados', () => {
    expect(
      countFreeUsers([
        { status: 'active' },
        { status: 'paused_by_consent_revocation' },
        { status: 'closed' },
      ]),
    ).toBe(2);
  });
});

describe('KPIs de saúde, sempre agregados (K15 a K19)', () => {
  it('distribuição da Zarit por faixa com mínimo de 5 por recorte (AC-M06-11, AC-M10-11)', () => {
    const totals = [
      ...new Array(24).fill(10),
      ...new Array(46).fill(30),
      ...new Array(36).fill(50),
      ...new Array(4).fill(70),
    ];
    const dist = zaritDistribution(totals);
    expect(dist.absent_or_small).toMatchObject({ sufficient: true, value: 24 });
    expect(dist.moderate).toMatchObject({ sufficient: true, value: 46 });
    expect(dist.moderate_to_severe).toMatchObject({ sufficient: true, value: 36 });
    expect(dist.severe).toMatchObject({
      sufficient: false,
      label: 'dado insuficiente',
      shortLabel: 'menos de 5',
    });
    expect(JSON.stringify(dist.severe)).not.toContain('4');
    expect(zaritBandCounts(totals).severe).toBe(4);
  });

  it('evolução média: só cuidadores com 2 ou mais aplicações e adesão maior que 0', () => {
    expect(averageEvolutionPercent([[40, 28, 18], [66, 52], [0, 12], [30]])).toBe(-38.1); // média de -55 e -21,2
    expect(averageEvolutionPercent([[0, 12], [30]])).toBeNull();
  });

  it('alertas abertos por nível (status diferente de encerrado) e ARBE abertos', () => {
    expect(
      openZaritAlertsByLevel([
        { level: 'red', status: 'open' },
        { level: 'red', status: 'contacted' },
        { level: 'yellow', status: 'risk_assessed' },
        { level: 'yellow', status: 'closed' },
      ]),
    ).toEqual({ yellow: 1, red: 2 });
    expect(
      openArbeByLevel([
        { level: 'critical', status: 'generated' },
        { level: 'critical', status: 'closed' },
        { level: 'attention', status: 'discarded' },
        { level: 'attention', status: 'confirmed' },
      ]),
    ).toEqual({ attention: 1, critical: 1 });
  });
});

describe('KPIs da rede, grupos e atendimento', () => {
  const snapshot = (
    providerId: string,
    auditDate: string,
    band: ArpSnapshot['band'],
  ): ArpSnapshot =>
    ({
      id: `${providerId}${auditDate}`,
      createdAt: '',
      updatedAt: '',
      providerId,
      auditDate,
      average: null,
      evaluationCount: 0,
      band,
      graveComplaintCount: 0,
      auditedBy: 'u1',
    }) as ArpSnapshot;

  it('prestadores por faixa pelo ÚLTIMO instantâneo de cada um (K23)', () => {
    const result = providersByBand([
      snapshot('p1', '2026-10-07', 'alert'),
      snapshot('p1', '2026-10-21', 'excellence'),
      snapshot('p2', '2026-10-21', 'deaccreditation'),
      snapshot('p3', '2026-10-07', 'no_average'),
    ]);
    expect(result).toEqual({ excellence: 1, alert: 0, deaccreditation: 1, no_average: 1 });
  });

  it('participação: presença = presentes ÷ inscritos; preenchimento = inscritos ÷ vagas (K28)', () => {
    const stats = participationStats(
      [
        { id: 'a1', capacity: 12 },
        { id: 'a2', capacity: 8 },
      ],
      [
        ...new Array(9).fill({ activityId: 'a1', status: 'attended' }),
        ...new Array(2).fill({ activityId: 'a1', status: 'absent' }),
        { activityId: 'a1', status: 'cancelled' },
        { activityId: 'a1', status: 'waitlist' },
      ],
    );
    expect(stats[0]).toMatchObject({
      enrolled: 11,
      present: 9,
      attendancePercent: 81.8,
      fillPercent: 91.7,
    });
    expect(stats[1]).toMatchObject({ enrolled: 0, attendancePercent: null, fillPercent: 0 });
  });

  it('reclamações do mês: recebidas, abertas, resolvidas e tempo até a primeira resposta (K29)', () => {
    const complaint = (
      openedAt: string,
      status: Complaint['status'],
      firstReplyHours?: number,
    ): Complaint =>
      ({
        id: openedAt,
        createdAt: '',
        updatedAt: '',
        openedAt,
        status,
        events:
          firstReplyHours === undefined
            ? []
            : [
                {
                  at: new Date(Date.parse(openedAt) + firstReplyHours * 3_600_000).toISOString(),
                  byUserId: 'u7',
                  text: 'ok',
                },
              ],
      }) as unknown as Complaint;
    const stats = complaintStats(
      [
        complaint('2026-11-01T10:00:00-03:00', 'open'),
        complaint('2026-11-02T10:00:00-03:00', 'closed', 4),
        complaint('2026-11-03T10:00:00-03:00', 'answered', 6),
        complaint('2026-10-30T10:00:00-03:00', 'open'),
      ],
      '2026-11',
    );
    expect(stats).toEqual({ received: 3, open: 1, resolved: 2, averageFirstResponseHours: 5 });
  });
});

describe('KPIs de LGPD, governança e piloto', () => {
  const dsr = (dueAt: string, status: DataSubjectRequest['status']): DataSubjectRequest =>
    ({ dueAt, status }) as DataSubjectRequest;

  it('solicitações do titular: abertas, vencendo em até 3 dias e vencidas (K33)', () => {
    const counts = dsrCounts(
      [
        dsr('2026-11-09', 'open'),
        dsr('2026-11-06', 'in_progress'),
        dsr('2026-11-01', 'open'),
        dsr('2026-11-01', 'completed'),
      ],
      '2026-11-04',
    );
    expect(counts).toEqual({ open: 3, dueSoon: 1, overdue: 1 });
  });

  it('POPs a revisar e riscos prioritários (K34, K35)', () => {
    expect(
      popsToReview([
        { reviewState: 'due' },
        { reviewState: 'revision_triggered' },
        { reviewState: 'up_to_date' },
      ]),
    ).toBe(2);
    const risks = [
      [4, 5],
      [4, 4],
      [4, 4],
      [3, 5],
      [3, 5],
      [3, 4],
      [4, 3],
      [3, 4],
      [2, 5],
      [2, 5],
      [3, 3],
      [2, 4],
    ].map(
      ([probability, impact]) =>
        ({ probability, impact }) as { probability: 1 | 2 | 3 | 4 | 5; impact: 1 | 2 | 3 | 4 | 5 },
    );
    expect(countPriorityRisks(risks)).toBe(8);
  });

  it('piloto: satisfação média, recomendação e variação das horas semanais (K37, K38)', () => {
    const stats = pilotStats([
      { satisfaction: 5, wouldRecommend: true, weeklyHoursStart: 12, weeklyHoursEnd: 7 },
      { satisfaction: 4, wouldRecommend: true, weeklyHoursStart: 8, weeklyHoursEnd: 6 },
      { satisfaction: 4, wouldRecommend: false },
      {},
    ]);
    expect(stats).toEqual({
      cohort: 4,
      satisfactionAverage: 4.33,
      recommendationPercent: 66.7,
      weeklyHoursDeltaAverage: -3.5,
    });
    expect(pilotStats([]).satisfactionAverage).toBeNull();
  });

  it('meta de redução da Zarit do piloto (indício, não prova)', () => {
    expect(pilotGoalReached(-12, 10)).toBe(true);
    expect(pilotGoalReached(-9.9, 10)).toBe(false);
    expect(pilotGoalReached(null, 10)).toBe(false);
  });

  it('uso do aplicativo: % ativos, acessos e funções distintas (K31)', () => {
    const stats = appUsageStats([
      { accesses30d: 10, distinctFeatures: ['a', 'b'] },
      { accesses30d: 0, distinctFeatures: [] },
      { accesses30d: 5, distinctFeatures: ['a', 'b', 'c', 'd'] },
      { accesses30d: 1, distinctFeatures: ['a'] },
    ]);
    expect(stats).toEqual({
      users: 4,
      activePercent: 75,
      averageAccesses: 4,
      averageDistinctFeatures: 1.8,
    });
  });
});
