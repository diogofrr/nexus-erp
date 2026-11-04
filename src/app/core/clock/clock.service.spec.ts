import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CROSS_TAB_SUBSCRIBE,
  LOCAL_STORAGE_BACKEND,
  SESSION_STORAGE_BACKEND,
} from '../storage/storage-tokens';
import { CrossTabBus, FakeStorage, configureCoreTest } from '../testing/test-helpers';
import { Clock } from './clock.service';

describe('Clock', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sem simulação, devolve o momento real em horário de Brasília', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-05T01:30:00Z')); // 22h30 de 04/11 em Brasília
    const { clock } = configureCoreTest();
    clock.resetToReal();
    expect(clock.isSimulated()).toBe(false);
    expect(clock.now()).toBe('2026-11-04T22:30:00-03:00');
    expect(clock.today()).toBe('2026-11-04');
    expect(clock.realNowMs()).toBe(Date.parse('2026-11-05T01:30:00Z'));
  });

  it('com data simulada, today() e now() seguem a simulação, mas o tempo real não muda', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-04T15:00:00Z')); // 12h real
    const { clock } = configureCoreTest();
    clock.setSimulated('2027-02-10');
    expect(clock.isSimulated()).toBe(true);
    expect(clock.simulatedDate()).toBe('2027-02-10');
    expect(clock.today()).toBe('2027-02-10');
    expect(clock.now()).toBe('2027-02-10T12:00:00-03:00'); // hora real do dia, data simulada
    expect(clock.realNow()).toBe('2026-11-04T12:00:00-03:00');
    expect(clock.nowDate().getTime()).toBe(Date.parse('2027-02-10T12:00:00-03:00'));
  });

  it('com hora fixa, now() não anda (útil para prazos como 23h59)', () => {
    const { clock } = configureCoreTest();
    clock.setSimulated('2026-11-04', '23:59');
    expect(clock.now()).toBe('2026-11-04T23:59:00-03:00');
  });

  it('aritmética a partir de hoje', () => {
    const { clock } = configureCoreTest({ today: '2026-11-04' });
    expect(clock.addDays(10)).toBe('2026-11-14');
    expect(clock.addDays(-1)).toBe('2026-11-03');
    expect(clock.addMonths(3)).toBe('2027-02-04');
    expect(clock.startOfMonth()).toBe('2026-11-01');
    expect(clock.endOfMonth()).toBe('2026-11-30');
    expect(clock.currentMonth()).toBe('2026-11');
    expect(clock.daysUntil('2026-11-09')).toBe(5);
    expect(clock.isPast('2026-11-03')).toBe(true);
    expect(clock.isPast('2026-11-04')).toBe(false);
    expect(clock.isBeforeNow('2026-11-04T11:59:00-03:00')).toBe(true);
    expect(clock.isBeforeNow('2026-11-04T12:01:00-03:00')).toBe(false);
  });

  it('avançar o relógio: +1 dia, +7 dias, +1 mês (M15)', () => {
    const { clock } = configureCoreTest({ today: '2026-11-04' });
    clock.advanceDays(1);
    expect(clock.today()).toBe('2026-11-05');
    clock.advanceDays(7);
    expect(clock.today()).toBe('2026-11-12');
    clock.advanceMonths(1);
    expect(clock.today()).toBe('2026-12-12');
    expect(clock.now()).toBe('2026-12-12T12:00:00-03:00');
  });

  it('a data simulada é guardada em nexus-erp:clock e sobrevive a uma nova instância', () => {
    const { local } = configureCoreTest();
    expect(JSON.parse(local.data.get('nexus-erp:clock') as string)).toEqual({
      demoToday: '2026-11-04',
      fixedTime: '12:00',
    });
    TestBed.resetTestingModule();
    configureCoreTest({ local, today: '2030-01-01' });
    const clock = TestBed.inject(Clock);
    expect(clock.today()).toBe('2030-01-01');
  });

  it('voltar ao relógio real apaga a chave', () => {
    const { clock, local } = configureCoreTest();
    clock.resetToReal();
    expect(local.data.has('nexus-erp:clock')).toBe(false);
    expect(clock.simulatedDate()).toBeNull();
  });

  it('ignora um valor inválido guardado em nexus-erp:clock', () => {
    const local = new FakeStorage();
    local.data.set('nexus-erp:clock', JSON.stringify({ demoToday: '2026-02-31' }));
    TestBed.configureTestingModule({
      providers: [
        { provide: LOCAL_STORAGE_BACKEND, useValue: local },
        { provide: SESSION_STORAGE_BACKEND, useValue: new FakeStorage() },
        { provide: CROSS_TAB_SUBSCRIBE, useValue: new CrossTabBus().subscribe },
      ],
    });
    expect(TestBed.inject(Clock).isSimulated()).toBe(false);
  });

  it('rejeita data simulada inválida', () => {
    const { clock } = configureCoreTest();
    expect(() => clock.setSimulated('2026-02-30')).toThrow(RangeError);
    expect(() => clock.setSimulated('04/11/2026')).toThrow(RangeError);
  });

  it('o tique força a reavaliação de quem lê o relógio', () => {
    vi.useFakeTimers();
    const { clock } = configureCoreTest();
    clock.startTicker(1000);
    clock.tick();
    clock.stopTicker();
    expect(clock.now()).toBeTruthy();
  });
});
