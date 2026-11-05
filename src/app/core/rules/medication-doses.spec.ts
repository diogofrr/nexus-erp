import { describe, expect, it } from 'vitest';
import { DoseCheck, Medication } from '../models';
import { doseKey, doseProgress, dosesForDate } from './medication-doses';

const stamp = { createdAt: '2026-11-01T09:00:00-03:00', updatedAt: '2026-11-01T09:00:00-03:00' };
const med = (id: string, name: string, times: string[], active = true): Medication => ({
  id,
  elderId: 'el_0001',
  name,
  dosage: '10 mg',
  times,
  active,
  ...stamp,
});
const check = (id: string, medicationId: string, date: string, time: string): DoseCheck => ({
  id,
  medicationId,
  date,
  time,
  givenAt: `${date}T${time}:00-03:00`,
  ...stamp,
});

describe('Doses do dia (RN-USR-07)', () => {
  const meds = [
    med('med_1', 'Losartana', ['08:00', '20:00']),
    med('med_2', 'Metformina', ['12:00']),
    med('med_3', 'Antigo', ['09:00'], false),
  ];

  it('cada horário de cada remédio ativo é uma dose, em ordem de horário; remédio inativo não entra', () => {
    const slots = dosesForDate('2026-11-04', meds, []);
    expect(slots.map((s) => `${s.time} ${s.medicationName}`)).toEqual([
      '08:00 Losartana',
      '12:00 Metformina',
      '20:00 Losartana',
    ]);
    expect(slots.every((s) => !s.given)).toBe(true);
    expect(slots[0]?.key).toBe(doseKey('med_1', '2026-11-04', '08:00'));
  });

  it('a dose está dada quando há marcação do mesmo remédio, dia e horário; marcação de outro dia não conta', () => {
    const slots = dosesForDate('2026-11-04', meds, [
      check('dose_1', 'med_1', '2026-11-04', '08:00'),
      check('dose_2', 'med_2', '2026-11-03', '12:00'),
      check('dose_3', 'med_2', '2026-11-04', '13:00'),
    ]);
    expect(slots.map((s) => s.given)).toEqual([true, false, false]);
    expect(slots[0]).toMatchObject({ checkId: 'dose_1', givenAt: '2026-11-04T08:00:00-03:00' });
    expect(slots[1]?.checkId).toBeUndefined();
  });

  it('horários repetidos no mesmo remédio viram uma dose só', () => {
    expect(dosesForDate('2026-11-04', [med('m', 'X', ['08:00', '08:00'])], [])).toHaveLength(1);
  });

  it('o progresso conta dadas e total; sem doses não está completo', () => {
    const slots = dosesForDate('2026-11-04', meds, [check('d', 'med_1', '2026-11-04', '08:00')]);
    expect(doseProgress(slots)).toEqual({ given: 1, total: 3, complete: false });
    expect(doseProgress([])).toEqual({ given: 0, total: 0, complete: false });
    const all = dosesForDate(
      '2026-11-04',
      [med('m', 'X', ['08:00'])],
      [check('d', 'm', '2026-11-04', '08:00')],
    );
    expect(doseProgress(all).complete).toBe(true);
  });
});
