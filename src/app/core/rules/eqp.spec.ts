import { describe, expect, it } from 'vitest';
import {
  buildOccupancyView,
  canReceiveRedistribution,
  hasOverloadAlert,
  isAboveThreshold,
  lastClosedMonths,
  occupancyMonths,
  occupancyPercent,
  teamExpansionRecommended,
} from './eqp';

const row = (month: string, available: number, done: number) => ({
  month,
  availableHours: available,
  doneHours: done,
});
const CURRENT = '2026-11';

describe('Ocupação da agenda (RN-EQP-01 a 08; AC-M05-01 a 05)', () => {
  it('ocupação = realizadas ÷ disponibilizadas x 100, com 1 casa (meio para cima)', () => {
    expect(occupancyPercent(160, 138)).toBe(86.3);
    expect(occupancyPercent(160, 146)).toBe(91.3);
    expect(occupancyPercent(160, 136)).toBe(85);
    expect(occupancyPercent(160, 112)).toBe(70);
    expect(occupancyPercent(160, 128)).toBe(80);
    expect(occupancyPercent(80, 40)).toBe(50);
  });

  it('sem horas disponibilizadas é n/d; extras passam de 100% (RN-EQP-08)', () => {
    expect(occupancyPercent(0, 0)).toBeNull();
    expect(occupancyPercent(100, 120)).toBe(120);
  });

  it('o limite é ESTRITAMENTE maior que 80%', () => {
    expect(isAboveThreshold(160, 128)).toBe(false);
    expect(isAboveThreshold(160, 129)).toBe(true);
    expect(isAboveThreshold(0, 0)).toBe(false);
    expect(isAboveThreshold(10000, 8001)).toBe(true);
  });

  it('Rafael Moreira: 86,3% e 91,3% dispara o alerta de dois meses seguidos', () => {
    expect(hasOverloadAlert([row('2026-09', 160, 138), row('2026-10', 160, 146)], CURRENT)).toBe(
      true,
    );
  });

  it('Letícia Amaral: 80,0% e 80,0% não dispara', () => {
    expect(hasOverloadAlert([row('2026-09', 160, 128), row('2026-10', 160, 128)], CURRENT)).toBe(
      false,
    );
  });

  it('Beatriz Nogueira: 85,0% e 70,0% não são seguidos', () => {
    expect(hasOverloadAlert([row('2026-09', 160, 136), row('2026-10', 160, 112)], CURRENT)).toBe(
      false,
    );
  });

  it('Tiago Brandão: mês -2 sem agenda (n/d) e 50% não dispara', () => {
    expect(hasOverloadAlert([row('2026-09', 0, 0), row('2026-10', 80, 40)], CURRENT)).toBe(false);
    expect(hasOverloadAlert([row('2026-10', 80, 70)], CURRENT)).toBe(false); // falta um mês
  });

  it('o mês corrente é parcial e não conta; o alerta se desfaz quando o último mês fechado fica em 80% ou menos', () => {
    expect(
      hasOverloadAlert(
        [row('2026-09', 160, 140), row('2026-10', 160, 140), row('2026-11', 40, 5)],
        CURRENT,
      ),
    ).toBe(true);
    expect(hasOverloadAlert([row('2026-09', 160, 140), row('2026-10', 160, 128)], CURRENT)).toBe(
      false,
    );
    expect(hasOverloadAlert([row('2026-08', 160, 140), row('2026-09', 160, 140)], CURRENT)).toBe(
      false,
    );
  });

  it('os meses fechados cruzam a virada do ano', () => {
    expect(lastClosedMonths('2027-01')).toEqual(['2026-11', '2026-12']);
    expect(occupancyMonths('2026-11-04')).toEqual(['2026-09', '2026-10', '2026-11']);
  });

  it('monta a visão calculada com o mês corrente marcado como parcial', () => {
    expect(buildOccupancyView('psy_1', '2026-11', 40, 10, CURRENT, false)).toEqual({
      psychologistId: 'psy_1',
      month: '2026-11',
      availableHours: 40,
      doneHours: 10,
      occupancyPercent: 25,
      isPartialMonth: true,
      overloadAlert: false,
    });
    expect(
      buildOccupancyView('psy_1', '2026-10', 0, 0, CURRENT, false).occupancyPercent,
    ).toBeNull();
  });

  it('redistribuição só para quem tem menos de 80%; ampliação só com resultado positivo', () => {
    expect(canReceiveRedistribution(50)).toBe(true);
    expect(canReceiveRedistribution(80)).toBe(false);
    expect(canReceiveRedistribution(null)).toBe(true);
    expect(teamExpansionRecommended(1)).toBe(true);
    expect(teamExpansionRecommended(0)).toBe(false);
    expect(teamExpansionRecommended(-84351)).toBe(false);
  });
});
