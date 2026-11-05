/**
 * Textos de data da Agenda (UX C5): o título de cada dia da lista e a hora de um compromisso. Funções puras.
 */
import { addDays, timeOf } from '../../../../core/clock/date-utils';
import { ISODate, ISODateTime } from '../../../../core/models';
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
