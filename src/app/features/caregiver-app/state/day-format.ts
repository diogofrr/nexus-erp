/**
 * Datas do aplicativo do cuidador, em linguagem de todo dia (docs/10-cuidador-ux.md, "Convenções"): "hoje",
 * "amanhã" e "ontem" para 1 dia de distância; depois "qui, 06/11"; o ano só aparece quando não é o corrente.
 * Funções puras: recebem "hoje" como argumento (do `Clock`), nunca leem o relógio.
 */
import { daysBetween, dateOf, timeOf, weekday } from '../../../core/clock/date-utils';
import { ISODate, ISODateTime } from '../../../core/models';

const WEEKDAYS_SHORT: readonly string[] = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const WEEKDAYS_LONG: readonly string[] = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
];

/** `06/11` (dia e mês) de uma data ISO. */
export function dayMonth(date: ISODate): string {
  const [, month, day] = date.split('-');
  return `${day}/${month}`;
}

/** "qui, 06/11" (com o ano, "qui, 06/11/2027", quando não é o ano de `today`). */
export function formatDayShort(date: ISODate, today: ISODate): string {
  const sameYear = date.slice(0, 4) === today.slice(0, 4);
  const [year, month, day] = date.split('-');
  const label = `${day}/${month}${sameYear ? '' : `/${year}`}`;
  return `${WEEKDAYS_SHORT[weekday(date)] ?? ''}, ${label}`;
}

/** "quarta-feira, 04/11". */
export function formatDayLong(date: ISODate): string {
  return `${WEEKDAYS_LONG[weekday(date)] ?? ''}, ${dayMonth(date)}`;
}

/** "hoje", "amanhã", "ontem" ou "qui, 06/11". */
export function relativeDay(date: ISODate, today: ISODate): string {
  switch (daysBetween(today, date)) {
    case 0:
      return 'hoje';
    case 1:
      return 'amanhã';
    case -1:
      return 'ontem';
    default:
      return formatDayShort(date, today);
  }
}

/** "hoje às 14:00", "amanhã às 09:30" ou "qui, 06/11, às 14:00". */
export function relativeDateTime(at: ISODateTime, today: ISODate): string {
  const day = relativeDay(dateOf(at), today);
  const time = timeOf(at);
  return day.includes(',') ? `${day}, às ${time}` : `${day} às ${time}`;
}
