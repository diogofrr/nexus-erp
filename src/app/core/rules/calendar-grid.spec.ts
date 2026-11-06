import { describe, expect, it } from 'vitest';
import { addDays, daysInMonth, weekday } from '../clock/date-utils';
import {
  CALENDAR_MAX_YEAR,
  CALENDAR_MIN_YEAR,
  MONTH_NAMES,
  WEEKDAY_ABBREVIATIONS,
  WEEKDAY_NAMES,
  buildMonthGrid,
  calendarKeyTarget,
  dayLabel,
  isCalendarMonth,
  joinNames,
  marksByDate,
  monthTitle,
  nextMonth,
  previousMonth,
  summarizeMarks,
} from './calendar-grid';

const TODAY = '2026-11-04';

const flat = (grid: ReturnType<typeof buildMonthGrid>): string[] => grid.weeks.flat().map((c) => c.date);

describe('Calendário do mês (aplicativo do cuidador, Agenda)', () => {
  describe('nomes em português', () => {
    it('12 meses, 7 dias da semana por extenso e 7 abreviações, começando no domingo', () => {
      expect(MONTH_NAMES).toHaveLength(12);
      expect(MONTH_NAMES[0]).toBe('janeiro');
      expect(MONTH_NAMES[2]).toBe('março');
      expect(MONTH_NAMES[11]).toBe('dezembro');
      expect(WEEKDAY_NAMES).toHaveLength(7);
      expect(WEEKDAY_NAMES[0]).toBe('domingo');
      expect(WEEKDAY_NAMES[5]).toBe('sexta-feira');
      expect(WEEKDAY_ABBREVIATIONS).toEqual(['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']);
    });

    it('o título do mês é o mês e o ano por extenso', () => {
      expect(monthTitle('2026-11')).toBe('novembro de 2026');
      expect(monthTitle('2027-01')).toBe('janeiro de 2027');
      expect(monthTitle('2026-03')).toBe('março de 2026');
    });

    it('o dia por extenso: dia, mês e dia da semana', () => {
      expect(dayLabel('2026-11-06')).toBe('6 de novembro, sexta-feira');
      expect(dayLabel('2026-11-01')).toBe('1 de novembro, domingo');
      expect(dayLabel('2026-02-28')).toBe('28 de fevereiro, sábado');
      expect(dayLabel('2027-01-31')).toBe('31 de janeiro, domingo');
    });

    it('nenhum nome tem travessão', () => {
      expect([...MONTH_NAMES, ...WEEKDAY_NAMES, ...WEEKDAY_ABBREVIATIONS].join(' ')).not.toMatch(/[\u2013\u2014]/);
    });
  });

  describe('a grade do mês', () => {
    it('novembro de 2026 começa no domingo e tem 30 dias: 5 linhas, a primeira célula é o dia 1', () => {
      const grid = buildMonthGrid('2026-11', TODAY);
      expect(grid.title).toBe('novembro de 2026');
      expect(grid.year).toBe(2026);
      expect(grid.month).toBe(11);
      expect(grid.first).toBe('2026-11-01');
      expect(grid.last).toBe('2026-11-30');
      expect(grid.weeks).toHaveLength(5);
      expect(grid.weeks.every((w) => w.length === 7)).toBe(true);
      expect(grid.weeks[0]?.[0]?.date).toBe('2026-11-01');
      expect(grid.weeks[0]?.[0]?.isOtherMonth).toBe(false);
      // O domingo é a primeira coluna e o sábado a última, em todas as linhas.
      expect(grid.weeks.every((w) => w[0]?.weekday === 0 && w[6]?.weekday === 6)).toBe(true);
      // 30 dias do mês e 5 do seguinte (1 a 5 de dezembro).
      expect(grid.weeks.flat().filter((c) => !c.isOtherMonth)).toHaveLength(30);
      expect(grid.weeks[4]?.[6]?.date).toBe('2026-12-05');
      expect(grid.weeks[4]?.[6]?.isOtherMonth).toBe(true);
    });

    it('mês de 28 dias que começa no domingo (fevereiro de 2026): ganha a quinta linha, com março esmaecido', () => {
      expect(daysInMonth(2026, 2)).toBe(28);
      expect(weekday('2026-02-01')).toBe(0);
      const grid = buildMonthGrid('2026-02', TODAY);
      expect(grid.weeks).toHaveLength(5);
      expect(grid.weeks[3]?.[6]?.date).toBe('2026-02-28');
      expect(grid.weeks[4]?.map((c) => c.date)).toEqual([
        '2026-03-01',
        '2026-03-02',
        '2026-03-03',
        '2026-03-04',
        '2026-03-05',
        '2026-03-06',
        '2026-03-07',
      ]);
      expect(grid.weeks[4]?.every((c) => c.isOtherMonth)).toBe(true);
    });

    it('mês de 29 dias (fevereiro de 2024, ano bissexto): 29 células do mês e 5 linhas', () => {
      const grid = buildMonthGrid('2024-02', TODAY);
      expect(grid.last).toBe('2024-02-29');
      expect(grid.weeks.flat().filter((c) => !c.isOtherMonth)).toHaveLength(29);
      expect(grid.weeks).toHaveLength(5);
      // 1.º de fevereiro de 2024 foi uma quinta-feira: quatro dias de janeiro antes.
      expect(grid.weeks[0]?.map((c) => c.date)).toEqual([
        '2024-01-28',
        '2024-01-29',
        '2024-01-30',
        '2024-01-31',
        '2024-02-01',
        '2024-02-02',
        '2024-02-03',
      ]);
    });

    it('mês de 30 dias (abril de 2026): 30 células do mês', () => {
      const grid = buildMonthGrid('2026-04', TODAY);
      expect(grid.last).toBe('2026-04-30');
      expect(grid.weeks.flat().filter((c) => !c.isOtherMonth)).toHaveLength(30);
      expect(grid.weeks).toHaveLength(5);
    });

    it('mês de 31 dias que começa no sábado (agosto de 2026): 6 linhas, a primeira com seis dias de julho', () => {
      expect(weekday('2026-08-01')).toBe(6);
      const grid = buildMonthGrid('2026-08', TODAY);
      expect(grid.weeks).toHaveLength(6);
      expect(grid.weeks[0]?.map((c) => c.isOtherMonth)).toEqual([true, true, true, true, true, true, false]);
      expect(grid.weeks[0]?.[0]?.date).toBe('2026-07-26');
      expect(grid.weeks[0]?.[6]?.date).toBe('2026-08-01');
      expect(grid.weeks.flat().filter((c) => !c.isOtherMonth)).toHaveLength(31);
      // A última linha tem só o dia 31 e dias de setembro.
      expect(grid.weeks[5]?.[0]?.date).toBe('2026-08-30');
      expect(grid.weeks[5]?.map((c) => c.isOtherMonth)).toEqual([false, false, true, true, true, true, true]);
    });

    it('mês de 31 dias que começa no domingo (janeiro de 2023): 5 linhas, sem dia do mês anterior', () => {
      const grid = buildMonthGrid('2023-01', TODAY);
      expect(weekday('2023-01-01')).toBe(0);
      expect(grid.weeks).toHaveLength(5);
      expect(grid.weeks[0]?.every((c) => !c.isOtherMonth)).toBe(true);
    });

    it('virada de ano: dezembro termina em janeiro e janeiro começa em dezembro', () => {
      const december = buildMonthGrid('2026-12', TODAY);
      expect(december.weeks[0]?.[0]?.date).toBe('2026-11-29');
      expect(december.weeks[0]?.[0]?.isOtherMonth).toBe(true);
      expect(december.weeks[4]?.[6]?.date).toBe('2027-01-02');
      expect(december.weeks[4]?.[6]?.isOtherMonth).toBe(true);
      const january = buildMonthGrid('2027-01', TODAY);
      expect(january.weeks[0]?.[0]?.date).toBe('2026-12-27');
      expect(january.weeks).toHaveLength(6);
      expect(january.year).toBe(2027);
    });

    it('hoje: só a célula de hoje é marcada, e vale também no dia esmaecido de outro mês', () => {
      const november = buildMonthGrid('2026-11', TODAY);
      const marked = november.weeks.flat().filter((c) => c.isToday);
      expect(marked.map((c) => c.date)).toEqual([TODAY]);
      expect(marked[0]?.isOtherMonth).toBe(false);
      expect(marked[0]?.day).toBe(4);
      // Dezembro de 2026 começa em 29 de novembro: se hoje é 30 de novembro, aparece na grade de dezembro, esmaecido.
      const december = buildMonthGrid('2026-12', '2026-11-30');
      const inDecember = december.weeks.flat().find((c) => c.isToday);
      expect(inDecember?.date).toBe('2026-11-30');
      expect(inDecember?.isOtherMonth).toBe(true);
      // Um mês longe não tem hoje.
      expect(buildMonthGrid('2027-06', TODAY).weeks.flat().some((c) => c.isToday)).toBe(false);
    });

    it('em qualquer mês de 2024 a 2028: 5 ou 6 linhas de 7, domingo primeiro, dias seguidos e os do mês todos presentes', () => {
      for (let year = 2024; year <= 2028; year += 1) {
        for (let month = 1; month <= 12; month += 1) {
          const ym = `${year}-${String(month).padStart(2, '0')}`;
          const grid = buildMonthGrid(ym, TODAY);
          const dates = flat(grid);
          expect([5, 6], ym).toContain(grid.weeks.length);
          expect(dates, ym).toHaveLength(grid.weeks.length * 7);
          expect(weekday(dates[0] ?? ''), ym).toBe(0);
          dates.forEach((date, i) => {
            if (i > 0) {
              expect(date, ym).toBe(addDays(dates[i - 1] ?? '', 1));
            }
          });
          expect(grid.weeks.flat().filter((c) => !c.isOtherMonth), ym).toHaveLength(daysInMonth(year, month));
          expect(grid.weeks.flat().filter((c) => !c.isOtherMonth).map((c) => c.day), ym).toEqual(
            Array.from({ length: daysInMonth(year, month) }, (_v, i) => i + 1),
          );
        }
      }
    });
  });

  describe('mês anterior e seguinte', () => {
    it('anda um mês, e a virada do ano troca o ano', () => {
      expect(previousMonth('2026-11')).toBe('2026-10');
      expect(nextMonth('2026-11')).toBe('2026-12');
      expect(previousMonth('2027-01')).toBe('2026-12');
      expect(nextMonth('2026-12')).toBe('2027-01');
      expect(previousMonth('2026-03')).toBe('2026-02');
      expect(nextMonth('2026-02')).toBe('2026-03');
    });

    it('ida e volta de 24 meses volta ao mesmo mês', () => {
      let ym = '2026-11';
      for (let i = 0; i < 24; i += 1) {
        ym = nextMonth(ym);
      }
      expect(ym).toBe('2028-11');
      for (let i = 0; i < 24; i += 1) {
        ym = previousMonth(ym);
      }
      expect(ym).toBe('2026-11');
    });

    it('não passa do começo nem do fim do calendário', () => {
      expect(previousMonth(`${CALENDAR_MIN_YEAR}-01`)).toBe(`${CALENDAR_MIN_YEAR}-01`);
      expect(nextMonth(`${CALENDAR_MAX_YEAR}-12`)).toBe(`${CALENDAR_MAX_YEAR}-12`);
      expect(nextMonth(`${CALENDAR_MAX_YEAR}-11`)).toBe(`${CALENDAR_MAX_YEAR}-12`);
    });

    it('reconhece um mês que o calendário mostra', () => {
      expect(isCalendarMonth('2026-11')).toBe(true);
      expect(isCalendarMonth('2026-13')).toBe(false);
      expect(isCalendarMonth('2026-00')).toBe(false);
      expect(isCalendarMonth('26-11')).toBe(false);
      expect(isCalendarMonth('1800-01')).toBe(false);
      expect(isCalendarMonth('2300-01')).toBe(false);
    });
  });

  describe('teclado: para onde o foco vai', () => {
    it('setas andam um dia e uma semana, atravessando o mês e o ano', () => {
      expect(calendarKeyTarget('2026-11-04', 'ArrowRight')).toBe('2026-11-05');
      expect(calendarKeyTarget('2026-11-04', 'ArrowLeft')).toBe('2026-11-03');
      expect(calendarKeyTarget('2026-11-04', 'ArrowDown')).toBe('2026-11-11');
      expect(calendarKeyTarget('2026-11-04', 'ArrowUp')).toBe('2026-10-28');
      expect(calendarKeyTarget('2026-11-30', 'ArrowRight')).toBe('2026-12-01');
      expect(calendarKeyTarget('2026-01-01', 'ArrowLeft')).toBe('2025-12-31');
      expect(calendarKeyTarget('2026-12-31', 'ArrowRight')).toBe('2027-01-01');
    });

    it('Home vai ao domingo e End ao sábado da mesma semana', () => {
      // 04/11/2026 é quarta-feira.
      expect(calendarKeyTarget('2026-11-04', 'Home')).toBe('2026-11-01');
      expect(calendarKeyTarget('2026-11-04', 'End')).toBe('2026-11-07');
      expect(calendarKeyTarget('2026-11-01', 'Home')).toBe('2026-11-01');
      expect(calendarKeyTarget('2026-11-07', 'End')).toBe('2026-11-07');
      // A semana pode cruzar o mês.
      expect(calendarKeyTarget('2026-12-02', 'Home')).toBe('2026-11-29');
      expect(calendarKeyTarget('2026-12-31', 'End')).toBe('2027-01-02');
    });

    it('PageUp e PageDown andam um mês; o dia que não existe cai no último do mês', () => {
      expect(calendarKeyTarget('2026-11-15', 'PageDown')).toBe('2026-12-15');
      expect(calendarKeyTarget('2026-11-15', 'PageUp')).toBe('2026-10-15');
      expect(calendarKeyTarget('2026-12-15', 'PageDown')).toBe('2027-01-15');
      expect(calendarKeyTarget('2027-01-15', 'PageUp')).toBe('2026-12-15');
      expect(calendarKeyTarget('2026-01-31', 'PageDown')).toBe('2026-02-28');
      expect(calendarKeyTarget('2026-03-31', 'PageUp')).toBe('2026-02-28');
    });

    it('outras teclas não movem, e o fim do calendário não anda', () => {
      expect(calendarKeyTarget('2026-11-04', 'a')).toBeNull();
      expect(calendarKeyTarget('2026-11-04', 'Enter')).toBeNull();
      expect(calendarKeyTarget('2026-11-04', 'Tab')).toBeNull();
      expect(calendarKeyTarget(`${CALENDAR_MAX_YEAR}-12-31`, 'ArrowRight')).toBeNull();
      expect(calendarKeyTarget(`${CALENDAR_MIN_YEAR}-01-01`, 'ArrowLeft')).toBeNull();
    });
  });

  describe('marcas de cada dia', () => {
    it('até 3 compromissos: uma marca por compromisso, sem contagem', () => {
      expect(summarizeMarks([])).toEqual({ total: 0, shown: [], more: 0 });
      expect(summarizeMarks(['medical'])).toEqual({ total: 1, shown: ['medical'], more: 0 });
      expect(summarizeMarks(['medical', 'physio', 'other'])).toEqual({
        total: 3,
        shown: ['medical', 'physio', 'other'],
        more: 0,
      });
    });

    it('de 4 em diante: duas marcas e a contagem do que falta', () => {
      expect(summarizeMarks(['a', 'b', 'c', 'd'])).toEqual({ total: 4, shown: ['a', 'b'], more: 2 });
      expect(summarizeMarks(['a', 'b', 'c', 'd', 'e', 'f'])).toEqual({ total: 6, shown: ['a', 'b'], more: 4 });
    });

    it('agrupa os tipos por dia, na ordem em que vieram', () => {
      const byDate = marksByDate([
        { date: '2026-11-05', kind: 'medical' },
        { date: '2026-11-06', kind: 'physio' },
        { date: '2026-11-05', kind: 'other' },
      ]);
      expect(byDate.get('2026-11-05')).toEqual(['medical', 'other']);
      expect(byDate.get('2026-11-06')).toEqual(['physio']);
      expect(byDate.get('2026-11-07')).toBeUndefined();
    });

    it('junta nomes com vírgula e "e"', () => {
      expect(joinNames([])).toBe('');
      expect(joinNames(['Consulta'])).toBe('Consulta');
      expect(joinNames(['Consulta', 'Fisioterapia'])).toBe('Consulta e Fisioterapia');
      expect(joinNames(['Consulta', 'Fisioterapia', 'Para você'])).toBe('Consulta, Fisioterapia e Para você');
    });
  });
});
