/**
 * Calendário de um mês, em linguagem de todo dia (aplicativo do cuidador, Agenda). Funções PURAS: recebem o mês e
 * "hoje" (que vem do `Clock`, nunca de `new Date()`) e devolvem a grade, os nomes em português e para onde vai o foco
 * quando a pessoa usa o teclado. Nada lê o relógio, o banco nem o navegador.
 *
 * A semana começa no **domingo**, como o calendário brasileiro. A grade tem sempre 5 ou 6 linhas: dias do mês anterior
 * e do seguinte completam as pontas (`isOtherMonth`), e um mês que cabe em 4 linhas ganha a quinta para a tela não
 * pular de altura ao trocar de mês.
 */
import {
  addDays,
  addMonths,
  daysInMonth,
  firstDayOfYearMonth,
  isValidIsoDate,
  parseIsoDate,
  weekday,
  yearMonthOf,
} from '../clock/date-utils';
import { ISODate, YearMonth } from '../models/primitives';

export const MONTH_NAMES: readonly string[] = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

/** Domingo (0) a sábado (6), como em `weekday()` de `date-utils`. */
export const WEEKDAY_NAMES: readonly string[] = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
];

export const WEEKDAY_ABBREVIATIONS: readonly string[] = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** O calendário não anda além destes anos (segurar uma tecla de mês não leva a uma data que não existe). */
export const CALENDAR_MIN_YEAR = 1900;
export const CALENDAR_MAX_YEAR = 2200;

/** Menor número de linhas da grade. */
export const CALENDAR_MIN_ROWS = 5;

export interface CalendarCell {
  date: ISODate;
  /** Dia do mês (1 a 31). */
  day: number;
  /** 0 = domingo ... 6 = sábado. */
  weekday: number;
  isToday: boolean;
  /** Dia do mês anterior ou do seguinte, que só completa a linha. */
  isOtherMonth: boolean;
}

export interface CalendarGrid {
  yearMonth: YearMonth;
  year: number;
  /** 1 a 12. */
  month: number;
  /** "novembro de 2026". */
  title: string;
  /** Primeiro e último dia do mês (não das pontas da grade). */
  first: ISODate;
  last: ISODate;
  /** 5 ou 6 semanas de 7 dias, começando no domingo. */
  weeks: CalendarCell[][];
}

/** O ano de um mês `YYYY-MM`. */
function yearOf(yearMonth: YearMonth): number {
  return parseIsoDate(firstDayOfYearMonth(yearMonth)).year;
}

/** O mês cabe no que o calendário mostra? */
export function isCalendarMonth(yearMonth: YearMonth): boolean {
  if (!/^\d{4}-\d{2}$/.test(yearMonth) || !isValidIsoDate(firstDayOfYearMonth(yearMonth))) {
    return false;
  }
  const year = yearOf(yearMonth);
  return year >= CALENDAR_MIN_YEAR && year <= CALENDAR_MAX_YEAR;
}

/** "novembro de 2026". */
export function monthTitle(yearMonth: YearMonth): string {
  const { year, month } = parseIsoDate(firstDayOfYearMonth(yearMonth));
  return `${MONTH_NAMES[month - 1] ?? ''} de ${year}`;
}

/** O mês antes (de janeiro vai a dezembro do ano anterior). No começo do calendário, fica onde está. */
export function previousMonth(yearMonth: YearMonth): YearMonth {
  const target = yearMonthOf(addMonths(firstDayOfYearMonth(yearMonth), -1));
  return isCalendarMonth(target) ? target : yearMonth;
}

/** O mês depois (de dezembro vai a janeiro do ano seguinte). No fim do calendário, fica onde está. */
export function nextMonth(yearMonth: YearMonth): YearMonth {
  const target = yearMonthOf(addMonths(firstDayOfYearMonth(yearMonth), 1));
  return isCalendarMonth(target) ? target : yearMonth;
}

/** A grade do mês: semanas de domingo a sábado, com os dias vizinhos esmaecidos nas pontas. */
export function buildMonthGrid(yearMonth: YearMonth, today: ISODate): CalendarGrid {
  const first = firstDayOfYearMonth(yearMonth);
  const { year, month } = parseIsoDate(first);
  const length = daysInMonth(year, month);
  const lead = weekday(first);
  const rows = Math.max(CALENDAR_MIN_ROWS, Math.ceil((lead + length) / 7));
  const start = addDays(first, -lead);
  const weeks: CalendarCell[][] = [];
  for (let row = 0; row < rows; row += 1) {
    const week: CalendarCell[] = [];
    for (let column = 0; column < 7; column += 1) {
      const date = addDays(start, row * 7 + column);
      week.push({
        date,
        day: Number(date.slice(8, 10)),
        weekday: column,
        isToday: date === today,
        isOtherMonth: yearMonthOf(date) !== yearMonth,
      });
    }
    weeks.push(week);
  }
  const lastDay = `${yearMonth}-${String(length).padStart(2, '0')}`;
  return { yearMonth, year, month, title: monthTitle(yearMonth), first, last: lastDay, weeks };
}

/** "6 de novembro, sexta-feira": o dia por extenso, para leitor de tela e para o texto. */
export function dayLabel(date: ISODate): string {
  const { month, day } = parseIsoDate(date);
  return `${day} de ${MONTH_NAMES[month - 1] ?? ''}, ${WEEKDAY_NAMES[weekday(date)] ?? ''}`;
}

/** Para onde o foco vai com a tecla (setas, Home, End, PageUp e PageDown), ou `null` se a tecla não move. */
export function calendarKeyTarget(date: ISODate, key: string): ISODate | null {
  let target: ISODate;
  switch (key) {
    case 'ArrowLeft':
      target = addDays(date, -1);
      break;
    case 'ArrowRight':
      target = addDays(date, 1);
      break;
    case 'ArrowUp':
      target = addDays(date, -7);
      break;
    case 'ArrowDown':
      target = addDays(date, 7);
      break;
    case 'Home':
      // Começo da semana (domingo).
      target = addDays(date, -weekday(date));
      break;
    case 'End':
      // Fim da semana (sábado).
      target = addDays(date, 6 - weekday(date));
      break;
    case 'PageUp':
      target = addMonths(date, -1);
      break;
    case 'PageDown':
      target = addMonths(date, 1);
      break;
    default:
      return null;
  }
  return isCalendarMonth(yearMonthOf(target)) ? target : null;
}

/** As marcas de um dia: no máximo `maxShown` espaços; passando disso, mostra uma a menos e conta as outras. */
export interface MarkSummary<K> {
  total: number;
  shown: K[];
  /** Quantos compromissos a mais do que as marcas mostradas ("+2"). */
  more: number;
}

/**
 * Resume as marcas de um dia. Até 3 compromissos, uma marca por compromisso; de 4 em diante, 2 marcas e a contagem
 * do que falta ("4 compromissos" vira duas marcas e "+2"), para a célula de 44 px nunca transbordar.
 */
export function summarizeMarks<K>(kinds: readonly K[], maxShown = 3): MarkSummary<K> {
  const total = kinds.length;
  if (total <= maxShown) {
    return { total, shown: [...kinds], more: 0 };
  }
  const shown = kinds.slice(0, maxShown - 1);
  return { total, shown, more: total - shown.length };
}

/** Os tipos de cada dia, na ordem em que os compromissos vieram. */
export function marksByDate<K>(events: readonly { date: ISODate; kind: K }[]): Map<ISODate, K[]> {
  const byDate = new Map<ISODate, K[]>();
  events.forEach((event) => {
    const list = byDate.get(event.date);
    if (list) {
      list.push(event.kind);
    } else {
      byDate.set(event.date, [event.kind]);
    }
  });
  return byDate;
}

/** "a", "a e b", "a, b e c". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) {
    return names[0] ?? '';
  }
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
}
