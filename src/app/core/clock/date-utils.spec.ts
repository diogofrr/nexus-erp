import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMinutes,
  addMonths,
  addMonthsToYearMonth,
  addYears,
  ageInYears,
  compareDateTimes,
  dateOf,
  daysBetween,
  endOfDay,
  endOfMonth,
  fromEpochMs,
  isValidIsoDate,
  isWeekend,
  minutesBetween,
  startOfMonth,
  timeOf,
  toBrt,
  toIsoDateTime,
  weekday,
  wholeMonthsBetween,
  yearMonthOf,
} from './date-utils';

describe('date-utils', () => {
  it('valida datas civis reais', () => {
    expect(isValidIsoDate('2026-11-04')).toBe(true);
    expect(isValidIsoDate('2028-02-29')).toBe(true);
    expect(isValidIsoDate('2027-02-29')).toBe(false);
    expect(isValidIsoDate('2026-13-01')).toBe(false);
    expect(isValidIsoDate('04/11/2026')).toBe(false);
  });

  it('soma dias atravessando mês e ano', () => {
    expect(addDays('2026-11-04', 10)).toBe('2026-11-14');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-11-04', '2026-11-09')).toBe(5);
    expect(daysBetween('2026-11-09', '2026-11-04')).toBe(-5);
  });

  it('soma meses com o dia inexistente caindo no último dia do mês (RN-ZRT-05)', () => {
    expect(addMonths('2026-02-15', 3)).toBe('2026-05-15');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-11-30', 3)).toBe('2027-02-28');
    expect(addMonths('2026-11-04', -3)).toBe('2026-08-04');
    expect(addYears('2028-02-29', 1)).toBe('2029-02-28');
  });

  it('início e fim do mês, mês anterior e idade', () => {
    expect(startOfMonth('2026-11-17')).toBe('2026-11-01');
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28');
    expect(yearMonthOf('2026-11-04')).toBe('2026-11');
    expect(addMonthsToYearMonth('2026-01', -2)).toBe('2025-11');
    expect(ageInYears('2008-11-04', '2026-11-04')).toBe(18);
    expect(ageInYears('2008-11-05', '2026-11-04')).toBe(17);
    expect(wholeMonthsBetween('2025-11-04', '2026-11-04')).toBe(12);
    expect(wholeMonthsBetween('2025-11-05', '2026-11-04')).toBe(11);
  });

  it('dia da semana e fim de semana', () => {
    expect(weekday('2026-11-04')).toBe(3); // quarta-feira
    expect(weekday('1970-01-01')).toBe(4);
    expect(isWeekend('2026-11-07')).toBe(true);
    expect(isWeekend('2026-11-08')).toBe(true);
    expect(isWeekend('2026-11-09')).toBe(false);
  });

  it('instantes em Brasília', () => {
    const dt = toIsoDateTime('2026-11-04', '23:59');
    expect(dt).toBe('2026-11-04T23:59:00-03:00');
    expect(endOfDay('2026-11-04')).toBe(dt);
    expect(dateOf(dt)).toBe('2026-11-04');
    expect(timeOf(dt)).toBe('23:59');
    expect(addMinutes(dt, 2)).toBe('2026-11-05T00:01:00-03:00');
    expect(minutesBetween('2026-11-04T10:00:00-03:00', '2026-11-04T11:30:00-03:00')).toBe(90);
    expect(
      compareDateTimes('2026-11-04T10:00:00-03:00', '2026-11-04T09:00:00-03:00'),
    ).toBeGreaterThan(0);
  });

  it('normaliza para Brasília e reconhece a data civil de um instante em UTC', () => {
    expect(toBrt('2026-11-05T01:30:00Z')).toBe('2026-11-04T22:30:00-03:00');
    expect(dateOf('2026-11-05T01:30:00Z')).toBe('2026-11-04');
    expect(fromEpochMs(Date.UTC(2026, 10, 4, 12, 0, 0))).toBe('2026-11-04T09:00:00-03:00');
  });

  it('rejeita entradas inválidas', () => {
    expect(() => toIsoDateTime('2026-02-30', '10:00')).toThrow(RangeError);
    expect(() => toIsoDateTime('2026-02-20', '25')).toThrow(RangeError);
    expect(() => addDays('xx', 1)).toThrow(RangeError);
  });
});
