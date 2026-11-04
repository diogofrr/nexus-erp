/**
 * Funções PURAS de data. Todas recebem a data como argumento: nenhuma lê o relógio.
 * O calendário é o de Brasília (UTC-03:00, sem horário de verão desde 2019).
 *
 * Regra do projeto: `Date.now()` e `new Date()` (sem argumentos) só existem em `clock.service.ts`.
 * Aqui só se constrói `Date` a partir de valores explícitos, para fazer conta de calendário.
 */
import { ISODate, ISODateTime, TimeOfDay, YearMonth } from '../models/primitives';

/** Deslocamento fixo de Brasília. */
export const BRT_OFFSET = '-03:00';
const BRT_OFFSET_MS = -3 * 60 * 60 * 1000;
const MS_PER_DAY = 86_400_000;
const MS_PER_MINUTE = 60_000;

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface YmdParts {
  year: number;
  month: number;
  day: number;
}

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  const table = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return table[month - 1] ?? 30;
}

/** `true` se a string é uma data civil real no formato `YYYY-MM-DD`. */
export function isValidIsoDate(value: string): boolean {
  const m = ISO_DATE_RE.exec(value);
  if (!m) {
    return false;
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

export function parseIsoDate(value: ISODate): YmdParts {
  if (!isValidIsoDate(value)) {
    throw new RangeError(`Data inválida: "${value}" (esperado YYYY-MM-DD)`);
  }
  const m = ISO_DATE_RE.exec(value) as RegExpExecArray;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export function formatIsoDate(parts: YmdParts): ISODate {
  return `${String(parts.year).padStart(4, '0')}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

/** Número de dias desde 1970-01-01 (calendário civil, sem fuso). */
export function toDayNumber(date: ISODate): number {
  const { year, month, day } = parseIsoDate(date);
  return Math.round(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

export function fromDayNumber(dayNumber: number): ISODate {
  const d = new Date(dayNumber * MS_PER_DAY);
  return formatIsoDate({
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  });
}

export function addDays(date: ISODate, days: number): ISODate {
  return fromDayNumber(toDayNumber(date) + days);
}

/** Soma meses de calendário. Dia inexistente cai no último dia do mês (15/02 + 3 = 15/05; 31/01 + 1 = 28/02). */
export function addMonths(date: ISODate, months: number): ISODate {
  const { year, month, day } = parseIsoDate(date);
  const total = year * 12 + (month - 1) + months;
  const newYear = Math.floor(total / 12);
  const newMonth = (((total % 12) + 12) % 12) + 1;
  return formatIsoDate({
    year: newYear,
    month: newMonth,
    day: Math.min(day, daysInMonth(newYear, newMonth)),
  });
}

export function addYears(date: ISODate, years: number): ISODate {
  return addMonths(date, years * 12);
}

export function startOfMonth(date: ISODate): ISODate {
  const { year, month } = parseIsoDate(date);
  return formatIsoDate({ year, month, day: 1 });
}

export function endOfMonth(date: ISODate): ISODate {
  const { year, month } = parseIsoDate(date);
  return formatIsoDate({ year, month, day: daysInMonth(year, month) });
}

/** Dias de `from` até `to` (positivo se `to` é depois). */
export function daysBetween(from: ISODate, to: ISODate): number {
  return toDayNumber(to) - toDayNumber(from);
}

/** 0 = domingo ... 6 = sábado. */
export function weekday(date: ISODate): number {
  // 1970-01-01 foi uma quinta-feira (4).
  return (((toDayNumber(date) + 4) % 7) + 7) % 7;
}

export function isWeekend(date: ISODate): boolean {
  const w = weekday(date);
  return w === 0 || w === 6;
}

export function compareDates(a: ISODate, b: ISODate): number {
  return toDayNumber(a) - toDayNumber(b);
}

export function yearMonthOf(date: ISODate): YearMonth {
  const { year, month } = parseIsoDate(date);
  return `${String(year).padStart(4, '0')}-${pad2(month)}`;
}

export function addMonthsToYearMonth(yearMonth: YearMonth, months: number): YearMonth {
  return yearMonthOf(addMonths(`${yearMonth}-01`, months));
}

export function firstDayOfYearMonth(yearMonth: YearMonth): ISODate {
  return `${yearMonth}-01`;
}

export function lastDayOfYearMonth(yearMonth: YearMonth): ISODate {
  return endOfMonth(`${yearMonth}-01`);
}

/** Idade completa em anos na data `today`. */
export function ageInYears(birthDate: ISODate, today: ISODate): number {
  const b = parseIsoDate(birthDate);
  const t = parseIsoDate(today);
  let age = t.year - b.year;
  if (t.month < b.month || (t.month === b.month && t.day < b.day)) {
    age -= 1;
  }
  return age;
}

/** Meses completos entre duas datas (para regras de "12 meses ou mais"). */
export function wholeMonthsBetween(from: ISODate, to: ISODate): number {
  const a = parseIsoDate(from);
  const b = parseIsoDate(to);
  let months = (b.year - a.year) * 12 + (b.month - a.month);
  if (b.day < a.day) {
    months -= 1;
  }
  return months;
}

// ===== Instantes (ISODateTime em Brasília) =====

/** Junta uma data e uma hora `HH:mm` em ISO com o deslocamento de Brasília. */
export function toIsoDateTime(date: ISODate, time: TimeOfDay = '00:00', seconds = 0): ISODateTime {
  if (!isValidIsoDate(date)) {
    throw new RangeError(`Data inválida: "${date}"`);
  }
  if (!/^\d{2}:\d{2}$/.test(time)) {
    throw new RangeError(`Hora inválida: "${time}" (esperado HH:mm)`);
  }
  return `${date}T${time}:${pad2(seconds)}${BRT_OFFSET}`;
}

/** Instante em milissegundos desde a época (UTC). */
export function epochMs(value: ISODateTime): number {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    throw new RangeError(`Data e hora inválidas: "${value}"`);
  }
  return ms;
}

/** Converte milissegundos para ISO em Brasília (sempre com `-03:00`). */
export function fromEpochMs(ms: number): ISODateTime {
  const shifted = new Date(ms + BRT_OFFSET_MS).toISOString(); // 2026-11-04T12:30:15.123Z (já em hora de Brasília)
  return `${shifted.slice(0, 19)}${BRT_OFFSET}`;
}

/** Data civil (Brasília) de um instante. */
export function dateOf(value: ISODateTime): ISODate {
  return fromEpochMs(epochMs(value)).slice(0, 10);
}

/** Hora `HH:mm` (Brasília) de um instante. */
export function timeOf(value: ISODateTime): TimeOfDay {
  return fromEpochMs(epochMs(value)).slice(11, 16);
}

export function addMinutes(value: ISODateTime, minutes: number): ISODateTime {
  return fromEpochMs(epochMs(value) + minutes * MS_PER_MINUTE);
}

export function addHours(value: ISODateTime, hours: number): ISODateTime {
  return addMinutes(value, hours * 60);
}

/** Minutos de `from` até `to` (positivo se `to` é depois). */
export function minutesBetween(from: ISODateTime, to: ISODateTime): number {
  return (epochMs(to) - epochMs(from)) / MS_PER_MINUTE;
}

export function compareDateTimes(a: ISODateTime, b: ISODateTime): number {
  return epochMs(a) - epochMs(b);
}

/** 23:59 do dia (prazo do alerta vermelho, RN-ZRT-14). */
export function endOfDay(date: ISODate): ISODateTime {
  return toIsoDateTime(date, '23:59', 0);
}

/** 00:00 do dia. */
export function startOfDay(date: ISODate): ISODateTime {
  return toIsoDateTime(date, '00:00', 0);
}

/** Normaliza qualquer ISO com deslocamento para Brasília. */
export function toBrt(value: ISODateTime): ISODateTime {
  return fromEpochMs(epochMs(value));
}

/** Converte data (início do dia em Brasília) para `Date` do JS, útil para APIs de exibição. */
export function dateToJs(value: ISODate | ISODateTime): Date {
  return new Date(value.length === 10 ? epochMs(startOfDay(value)) : epochMs(value));
}
