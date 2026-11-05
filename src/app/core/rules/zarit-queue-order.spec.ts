import { describe, expect, it } from 'vitest';
import { configureCoreTest } from '../testing/test-helpers';
import { buildQueue } from './zarit-queue';

describe('Fila de acompanhamento: ordem por gravidade e atraso (CX-028)', () => {
  it('dentro de cada motivo, a pontuação mais alta vem primeiro; em empate, o mais atrasado', () => {
    const { db, clock } = configureCoreTest({ seed: true, today: '2026-11-04', time: '12:00' });
    const rows = buildQueue({
      caregivers: db.caregivers.list(),
      alerts: db.zaritAlerts.list(),
      arbe: db.arbeAlerts.list(),
      assessments: db.zaritAssessments.list(),
      consentActive: () => true,
      now: clock.now(),
      today: clock.today(),
    });
    // A prioridade entre motivos continua a do AC-M06-16.
    const ranks = rows.map((r) => r.rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    // Dentro do mesmo grupo não vermelho, a pontuação nunca sobe de uma linha para a seguinte.
    const byReason = new Map<string, number[]>();
    rows
      .filter((r) => r.reason !== 'red_overdue' && r.reason !== 'red_today')
      .forEach((r) => byReason.set(r.reason, [...(byReason.get(r.reason) ?? []), r.score ?? -1]));
    byReason.forEach((scores) => {
      expect(scores).toEqual([...scores].sort((a, b) => b - a));
    });
    const overdue = rows.filter((r) => r.reason === 'zarit_overdue');
    expect(overdue.length).toBeGreaterThan(3);
    // A pessoa com a pontuação mais alta e escala vencida abre o grupo, não fica em sétimo.
    const highest = Math.max(...overdue.map((r) => r.score ?? -1));
    expect(overdue[0]?.score).toBe(highest);
  });
});
