import { addDays, isWeekend, weekday } from '@core/clock';
import { formatDate } from '@core/format';
import { ISODate } from '@core/models';
import { weekdayName } from './care-labels';

/** Segunda-feira da semana que contém `date`; sábado e domingo mostram a semana seguinte. */
export function mondayOf(date: ISODate): ISODate {
  const w = weekday(date);
  if (isWeekend(date)) {
    return addDays(date, w === 6 ? 2 : 1);
  }
  return addDays(date, -(w - 1));
}

/** As cinco datas da semana (segunda a sexta). */
export function weekDaysFrom(monday: ISODate): ISODate[] {
  return [0, 1, 2, 3, 4].map((offset) => addDays(monday, offset));
}

/** "Agenda da semana de 02 a 06 de novembro" para a grade e o leitor de tela. */
export function weekCaption(days: readonly ISODate[]): string {
  const first = days[0] ?? '';
  const last = days[days.length - 1] ?? '';
  const months = [
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
  const monthOf = (d: ISODate): string => months[Number(d.slice(5, 7)) - 1] ?? '';
  const sameMonth = first.slice(0, 7) === last.slice(0, 7);
  return sameMonth
    ? `Agenda da semana de ${first.slice(8)} a ${last.slice(8)} de ${monthOf(last)}`
    : `Agenda da semana de ${first.slice(8)} de ${monthOf(first)} a ${last.slice(8)} de ${monthOf(last)}`;
}

/** "quinta, 06/11" a partir de uma data ISO. */
export function dayAndMonth(date: ISODate): string {
  return `${weekdayName(weekday(date))}, ${formatDate(date).slice(0, 5)}`;
}

/** "quinta, 06/11, às 14:00". */
export function dayAndTime(date: ISODate, time: string): string {
  return `${dayAndMonth(date)}, às ${time}`;
}
