import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Clock } from '../clock/clock.service';
import { Database } from '../data/database';
import { configureCoreTest } from '../testing/test-helpers';
import { PlanChangeScheduler } from './plan-change-scheduler';

describe('PlanChangeScheduler (M04: mudança agendada sem depender de uma tela)', () => {
  let db: Database;
  let clock: Clock;
  let scheduler: PlanChangeScheduler;

  beforeEach(() => {
    const env = configureCoreTest({ seed: true, today: '2026-11-04', time: '12:00' });
    db = env.db;
    clock = env.clock;
    scheduler = TestBed.inject(PlanChangeScheduler);
  });

  const subOf = (caregiverId: string) => db.subscriptions.find((s) => s.caregiverId === caregiverId)!;

  it('na inicialização aplica o que já venceu (cancelamento agendado do C26)', () => {
    const due = subOf('cg_0026').scheduledChangeAt as string;
    clock.setSimulated(due, '12:00');
    expect(subOf('cg_0026').status).toBe('cancel_scheduled');
    expect(scheduler.start()).toBeGreaterThanOrEqual(1);
    expect(subOf('cg_0026').planId).toBe('livre');
    expect(subOf('cg_0026').status).toBe('active');
    expect(db.benefitCards.find((c) => c.caregiverId === 'cg_0026')?.status).toBe('inactive');
  });

  it('antes do ciclo nada muda, e depois que o relógio simulado avança o aplicativo aplica sozinho', () => {
    expect(scheduler.start()).toBe(0);
    TestBed.tick();
    expect(subOf('cg_0026').status).toBe('cancel_scheduled');
    // O tique periódico do relógio não muda o dia: nada acontece.
    clock.tick();
    TestBed.tick();
    expect(subOf('cg_0026').status).toBe('cancel_scheduled');

    clock.setSimulated(subOf('cg_0026').scheduledChangeAt as string, '12:00');
    TestBed.tick();
    expect(subOf('cg_0026').planId).toBe('livre');
    expect(db.benefitCards.find((c) => c.caregiverId === 'cg_0026')?.status).toBe('inactive');
  });

  it('é idempotente: ligar duas vezes não aplica duas vezes', () => {
    clock.setSimulated(subOf('cg_0026').scheduledChangeAt as string, '12:00');
    expect(scheduler.start()).toBeGreaterThanOrEqual(1);
    expect(scheduler.start()).toBe(0);
  });
});
