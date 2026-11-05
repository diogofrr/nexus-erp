/**
 * Agenda da pessoa idosa no aplicativo do cuidador (RN-USR-07: o aplicativo oferece agenda e lembretes de consulta;
 * RN-USR-09: guarda só o necessário). Funções PURAS: recebem os compromissos e "agora" (do `Clock`) e devolvem a
 * lista, o agrupamento por dia ou os problemas de um formulário. Nada lê o relógio nem o banco.
 *
 * Servem a Hoje (próximo compromisso), a Agenda (lista, validação do formulário) e a Família (texto para copiar).
 */
import {
  addDays,
  compareDateTimes,
  dateOf,
  isValidIsoDate,
  timeOf,
  toIsoDateTime,
} from '../clock/date-utils';
import { CareAppointment } from '../models/caregivers';
import { ISODate, ISODateTime } from '../models/primitives';

export type AppointmentKind = CareAppointment['kind'];

/** Os 4 tipos do formulário, na ordem da tela (UX C5): Consulta, Fisioterapia, Psicologia, Outro. */
export const APPOINTMENT_KINDS: readonly AppointmentKind[] = ['medical', 'physio', 'psychological', 'other'];

export const APPOINTMENT_KIND_LABELS: Readonly<Record<AppointmentKind, string>> = {
  medical: 'Consulta',
  physio: 'Fisioterapia',
  psychological: 'Psicologia',
  other: 'Outro',
};

/** Tudo o que tem hora: compromisso da pessoa idosa ou conversa do cuidador com o psicólogo. */
export interface Timed {
  at: ISODateTime;
}

const TIME_FORMAT = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isTimeOfDay(value: string): boolean {
  return TIME_FORMAT.test(value);
}

export type AppointmentProblem =
  | 'title_required'
  | 'date_required'
  | 'date_invalid'
  | 'date_past'
  | 'time_required'
  | 'time_format'
  | 'time_past';

export interface AppointmentDraft {
  title: string;
  date: ISODate | null;
  time: string | null;
}

/**
 * O que está errado num compromisso novo ou remarcado: título vazio, dia que não existe ou já passou, hora fora do
 * formato ou de hoje que já passou. Lista vazia = pode salvar.
 */
export function appointmentProblems(draft: AppointmentDraft, now: ISODateTime): AppointmentProblem[] {
  const problems: AppointmentProblem[] = [];
  if (draft.title.trim() === '') {
    problems.push('title_required');
  }
  const today = dateOf(now);
  let dateOk = false;
  if (!draft.date) {
    problems.push('date_required');
  } else if (!isValidIsoDate(draft.date)) {
    problems.push('date_invalid');
  } else if (draft.date < today) {
    problems.push('date_past');
  } else {
    dateOk = true;
  }
  if (!draft.time) {
    problems.push('time_required');
  } else if (!isTimeOfDay(draft.time)) {
    problems.push('time_format');
  } else if (dateOk && draft.date === today && draft.time < timeOf(now)) {
    problems.push('time_past');
  }
  return problems;
}

/** Em ordem de data e hora (os de mesmo horário ficam na ordem em que vieram). */
export function sortByTime<T extends Timed>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => compareDateTimes(a.at, b.at));
}

/** Os que acontecem em um dia. */
export function onDate<T extends Timed>(items: readonly T[], date: ISODate): T[] {
  return sortByTime(items.filter((item) => dateOf(item.at) === date));
}

/** Os do intervalo de dias, inclusive nas duas pontas. */
export function betweenDates<T extends Timed>(items: readonly T[], from: ISODate, to: ISODate): T[] {
  return sortByTime(items.filter((item) => dateOf(item.at) >= from && dateOf(item.at) <= to));
}

/** O mais próximo que ainda não passou (a partir de agora, inclusive). */
export function nextOne<T extends Timed>(items: readonly T[], now: ISODateTime): T | undefined {
  return sortByTime(items).find((item) => compareDateTimes(item.at, now) >= 0);
}

/** O horário já passou? */
export function isPastTime(at: ISODateTime, now: ISODateTime): boolean {
  return compareDateTimes(at, now) < 0;
}

export interface DayGroup<T extends Timed> {
  date: ISODate;
  items: T[];
}

/** Agrupa por dia, em ordem; só entram os dias que têm item (dia vazio não aparece). */
export function groupByDay<T extends Timed>(items: readonly T[]): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  sortByTime(items).forEach((item) => {
    const date = dateOf(item.at);
    const last = groups[groups.length - 1];
    if (last && last.date === date) {
      last.items.push(item);
    } else {
      groups.push({ date, items: [item] });
    }
  });
  return groups;
}

/** Último dia da janela "próximos N dias" a partir de hoje (14 dias valem de hoje até hoje + 13). */
export function windowEnd(today: ISODate, days: number): ISODate {
  return addDays(today, days - 1);
}

/** `ISODateTime` de um dia e uma hora escolhidos na tela. */
export function appointmentInstant(date: ISODate, time: string): ISODateTime {
  return toIsoDateTime(date, time);
}
