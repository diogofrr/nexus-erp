/**
 * Textos de data da Agenda (UX C5): o título de cada dia da lista e a hora de um compromisso. Funções puras.
 */
import { addDays, parseIsoDate, timeOf, weekday } from '../../../../core/clock/date-utils';
import { ISODate, ISODateTime } from '../../../../core/models';
import { MONTH_NAMES, WEEKDAY_NAMES } from '../../../../core/rules/calendar-grid';
import { formatDayShort } from '../../state/day-format';

/** "Hoje, qua 04/11", "Amanhã, qui 05/11" ou, nos outros dias, "sex, 06/11" (com o ano se não é o corrente). */
export function dayHeading(date: ISODate, today: ISODate): string {
  const short = formatDayShort(date, today);
  if (date === today) {
    return `Hoje, ${short.replace(',', '')}`;
  }
  if (date === addDays(today, 1)) {
    return `Amanhã, ${short.replace(',', '')}`;
  }
  return short;
}

/** "qui, 06/11, às 15:00": o horário de um compromisso na folha de detalhe e na faixa de confirmação. */
export function whenText(at: ISODateTime, today: ISODate): string {
  return `${formatDayShort(at.slice(0, 10), today)}, às ${timeOf(at)}`;
}

/**
 * O título do dia escolhido no calendário: "Hoje, 4 de novembro", "Amanhã, 5 de novembro" ou "Sexta, 6 de novembro"
 * (com o ano, "Sexta, 8 de janeiro de 2027", quando não é o corrente).
 */
export function dayCardHeading(date: ISODate, today: ISODate): string {
  const { year, month, day } = parseIsoDate(date);
  const label = `${day} de ${MONTH_NAMES[month - 1] ?? ''}${year === Number(today.slice(0, 4)) ? '' : ` de ${year}`}`;
  if (date === today) {
    return `Hoje, ${label}`;
  }
  if (date === addDays(today, 1)) {
    return `Amanhã, ${label}`;
  }
  const name = (WEEKDAY_NAMES[weekday(date)] ?? '').replace('-feira', '');
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}, ${label}`;
}
