import { describe, expect, it } from 'vitest';
import {
  APPOINTMENT_KINDS,
  APPOINTMENT_KIND_LABELS,
  appointmentInstant,
  appointmentProblems,
  betweenDates,
  groupByDay,
  isPastTime,
  isTimeOfDay,
  nextOne,
  onDate,
  sortByTime,
  windowEnd,
} from './care-agenda';

const NOW = '2026-11-04T12:00:00-03:00';
const at = (date: string, time: string): { at: string; label: string } => ({
  at: `${date}T${time}:00-03:00`,
  label: `${date} ${time}`,
});

describe('Agenda da pessoa idosa (RN-USR-07, RN-USR-09)', () => {
  it('os quatro tipos do formulário na ordem da tela', () => {
    expect(APPOINTMENT_KINDS.map((k) => APPOINTMENT_KIND_LABELS[k])).toEqual([
      'Consulta',
      'Fisioterapia',
      'Psicologia',
      'Outro',
    ]);
  });

  it('reconhece a hora HH:mm', () => {
    expect(['00:00', '08:30', '23:59'].every(isTimeOfDay)).toBe(true);
    expect(['24:00', '8:30', '08:60', '', 'abc'].some(isTimeOfDay)).toBe(false);
  });

  describe('problemas do formulário', () => {
    it('compromisso completo e futuro não tem problema', () => {
      expect(appointmentProblems({ title: 'Consulta', date: '2026-11-06', time: '15:00' }, NOW)).toEqual([]);
    });

    it('título vazio, dia e hora em branco', () => {
      expect(appointmentProblems({ title: '  ', date: null, time: null }, NOW)).toEqual([
        'title_required',
        'date_required',
        'time_required',
      ]);
    });

    it('dia que já passou e dia que não existe', () => {
      expect(appointmentProblems({ title: 'x', date: '2026-11-03', time: '10:00' }, NOW)).toEqual(['date_past']);
      expect(appointmentProblems({ title: 'x', date: '2026-02-31', time: '10:00' }, NOW)).toEqual(['date_invalid']);
    });

    it('hoje vale; hoje com hora que já passou não vale; hoje na hora exata vale', () => {
      expect(appointmentProblems({ title: 'x', date: '2026-11-04', time: '14:00' }, NOW)).toEqual([]);
      expect(appointmentProblems({ title: 'x', date: '2026-11-04', time: '11:59' }, NOW)).toEqual(['time_past']);
      expect(appointmentProblems({ title: 'x', date: '2026-11-04', time: '12:00' }, NOW)).toEqual([]);
    });

    it('hora fora do formato', () => {
      expect(appointmentProblems({ title: 'x', date: '2026-11-06', time: '25:00' }, NOW)).toEqual(['time_format']);
    });

    it('a hora de um dia futuro nunca é "já passou"', () => {
      expect(appointmentProblems({ title: 'x', date: '2026-11-05', time: '07:00' }, NOW)).toEqual([]);
    });
  });

  describe('ordem, dia, intervalo e próximo', () => {
    const items = [at('2026-11-06', '10:00'), at('2026-11-04', '16:00'), at('2026-11-04', '09:00'), at('2026-11-05', '09:30')];

    it('ordena por data e hora', () => {
      expect(sortByTime(items).map((i) => i.label)).toEqual([
        '2026-11-04 09:00',
        '2026-11-04 16:00',
        '2026-11-05 09:30',
        '2026-11-06 10:00',
      ]);
    });

    it('os de um dia, em ordem', () => {
      expect(onDate(items, '2026-11-04').map((i) => i.label)).toEqual(['2026-11-04 09:00', '2026-11-04 16:00']);
      expect(onDate(items, '2026-11-09')).toEqual([]);
    });

    it('os do intervalo, nas duas pontas inclusive', () => {
      expect(betweenDates(items, '2026-11-05', '2026-11-06').map((i) => i.label)).toEqual([
        '2026-11-05 09:30',
        '2026-11-06 10:00',
      ]);
    });

    it('o próximo é o mais perto que ainda não passou', () => {
      expect(nextOne(items, NOW)?.label).toBe('2026-11-04 16:00');
      expect(nextOne(items, '2026-11-04T16:00:00-03:00')?.label).toBe('2026-11-04 16:00');
      expect(nextOne(items, '2026-11-07T08:00:00-03:00')).toBeUndefined();
      expect(nextOne([], NOW)).toBeUndefined();
    });

    it('agrupa por dia e o dia vazio não aparece', () => {
      const groups = groupByDay(items);
      expect(groups.map((g) => g.date)).toEqual(['2026-11-04', '2026-11-05', '2026-11-06']);
      expect(groups[0]?.items).toHaveLength(2);
    });

    it('sabe se o horário já passou', () => {
      expect(isPastTime('2026-11-04T09:00:00-03:00', NOW)).toBe(true);
      expect(isPastTime('2026-11-04T12:00:00-03:00', NOW)).toBe(false);
    });
  });

  it('a janela de 14 dias vai de hoje até hoje mais 13', () => {
    expect(windowEnd('2026-11-04', 14)).toBe('2026-11-17');
    expect(windowEnd('2026-11-04', 1)).toBe('2026-11-04');
  });

  it('junta dia e hora num instante de Brasília', () => {
    expect(appointmentInstant('2026-11-06', '15:00')).toBe('2026-11-06T15:00:00-03:00');
  });
});
