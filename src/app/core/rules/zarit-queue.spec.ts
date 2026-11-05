import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ConsentService } from '../privacy/consent.service';
import { configureCoreTest } from '../testing/test-helpers';
import { BAND_ORDER, buildAggregate } from './zarit-aggregate';
import { QUEUE_RANK, buildQueue, matchesFilter } from './zarit-queue';

function setup() {
  const { db, clock } = configureCoreTest({ seed: true, today: '2026-11-04', time: '12:00' });
  const consent = TestBed.inject(ConsentService);
  const build = () =>
    buildQueue({
      caregivers: db.caregivers.list(),
      alerts: db.zaritAlerts.list(),
      arbe: db.arbeAlerts.list(),
      assessments: db.zaritAssessments.list(),
      consentActive: (id) => consent.isActive(id, 'health_data'),
      now: clock.now(),
      today: clock.today(),
    });
  const aggregate = (min: number) =>
    buildAggregate({
      caregivers: db.caregivers.list(),
      assessments: db.zaritAssessments.list(),
      alerts: db.zaritAlerts.list(),
      arbe: db.arbeAlerts.list(),
      eligible: (id) => consent.isActive(id, 'health_data') && consent.isActive(id, 'people_analytics'),
      min,
      now: clock.now(),
      today: clock.today(),
    });
  return { db, consent, build, aggregate };
}

describe('fila de acompanhamento (AC-M06-16)', () => {
  it('ordena vermelho vencido, vermelho do dia, ARBE crítico, amarelo, Zarit vencida e a vencer', () => {
    const rows = setup().build();
    expect(rows[0]?.caregiverId).toBe('cg_0002');
    expect(rows[0]?.reason).toBe('red_overdue');
    expect(rows[1]?.caregiverId).toBe('cg_0001');
    expect(rows[1]?.reason).toBe('red_today');
    const ranks = rows.map((r) => r.rank);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
    expect(QUEUE_RANK.red_overdue).toBeLessThan(QUEUE_RANK.red_today);
    expect(QUEUE_RANK.red_today).toBeLessThan(QUEUE_RANK.arbe_critical);
    expect(QUEUE_RANK.arbe_critical).toBeLessThan(QUEUE_RANK.yellow);
    expect(QUEUE_RANK.yellow).toBeLessThan(QUEUE_RANK.zarit_overdue);
    expect(QUEUE_RANK.zarit_overdue).toBeLessThan(QUEUE_RANK.zarit_due);
  });

  it('as chaves do sino filtram a fila', () => {
    const rows = setup().build();
    expect(rows.filter((r) => matchesFilter(r, 'contato-vencido')).map((r) => r.caregiverId)).toEqual(['cg_0002']);
    expect(rows.filter((r) => matchesFilter(r, 'contato-hoje')).map((r) => r.caregiverId)).toEqual(['cg_0001']);
    expect(rows.filter((r) => matchesFilter(r, 'amarelos')).length).toBeGreaterThan(0);
    expect(rows.filter((r) => matchesFilter(r, 'tarefas')).map((r) => r.caregiverId)).toContain('cg_0008');
    expect(rows.every((r) => matchesFilter(r, null))).toBe(true);
  });

  it('cuidador sem consentimento de saúde não entra na fila', () => {
    const { build, consent } = setup();
    expect(build().some((r) => r.caregiverId === 'cg_0016')).toBe(false);
    expect(build().some((r) => r.caregiverId === 'cg_0001')).toBe(true);
    consent.revoke('cg_0001', 'health_data', { channel: 'phone', registeredByUserId: 'u7' });
    expect(build().some((r) => r.caregiverId === 'cg_0001')).toBe(false);
  });
});

describe('painel agregado (K15 a K19, RN-KPI-02, A-30)', () => {
  it('suprime recorte com menos de 5 e conta o contato no mesmo dia: 2 de 3', () => {
    const { aggregate } = setup();
    const result = aggregate(5);
    expect(result.alerts.red.sufficient).toBe(false);
    expect(result.sameDay.numerator).toBe(2);
    expect(result.sameDay.denominator).toBe(3);
    expect(result.sameDay.percent).toBe(66.7);
    BAND_ORDER.forEach((band) => {
      const cell = result.bands[band];
      expect(cell.sufficient ? cell.value >= 5 : true).toBe(true);
    });
    expect(result.anySuppressed).toBe(BAND_ORDER.some((band) => !result.bands[band].sufficient));
  });

  it('com o mínimo de 1 nada é suprimido e a soma das faixas fecha com o total', () => {
    const open = setup().aggregate(1);
    const sum = BAND_ORDER.reduce((n, band) => {
      const cell = open.bands[band];
      return n + (cell.sufficient ? cell.value : 0);
    }, 0);
    expect(open.anySuppressed).toBe(false);
    expect(sum).toBe(open.people);
  });
});
