/**
 * Prazos de resposta (SLA) de mensagens e reclamações (RN-CAN-02 a 04, RN-POP-08, K30).
 *
 * "Horas úteis" contam só de segunda a sexta, das 8h às 18h (Brasília), sem feriados nacionais.
 * Mensagem recebida fora do expediente começa a contar na abertura seguinte (RN-CAN-03).
 */
import {
  addDays,
  compareDateTimes,
  dateOf,
  epochMs,
  fromEpochMs,
  isWeekend,
  minutesBetween,
  timeOf,
  toIsoDateTime,
  weekday,
} from '../clock/date-utils';
import { Channel, ISODate, ISODateTime } from '../models/primitives';
import { Message } from '../models/messages';

export const BUSINESS_DAY_START = '08:00';
export const BUSINESS_DAY_END = '18:00';
const START_MIN = 8 * 60;
const END_MIN = 18 * 60;
const MINUTES_PER_BUSINESS_DAY = END_MIN - START_MIN;

/** Prazos por canal, em horas úteis (RN-CAN-02). Telefone: imediato (0). */
export const DEFAULT_SLA_HOURS: Readonly<Record<Channel, number>> = {
  app: 24,
  whatsapp: 4,
  phone: 0,
  email: 48,
};

/** Prazo da reclamação formal: 5 dias úteis (RN-POP-08). */
export const COMPLAINT_DEADLINE_BUSINESS_DAYS = 5;

// ===== Feriados nacionais =====

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
function easterSunday(year: number): ISODate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Feriados nacionais do ano: fixos mais a Sexta-feira Santa. */
export function nationalHolidays(year: number): ISODate[] {
  const fixed = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'];
  return [...fixed.map((md) => `${year}-${md}`), addDays(easterSunday(year), -2)].sort();
}

export function isNationalHoliday(date: ISODate): boolean {
  return nationalHolidays(Number(date.slice(0, 4))).includes(date);
}

/** Dia útil: segunda a sexta, exceto feriado nacional. */
export function isBusinessDay(date: ISODate): boolean {
  return !isWeekend(date) && !isNationalHoliday(date);
}

/** Próximo dia útil estritamente depois de `date`. */
export function nextBusinessDay(date: ISODate): ISODate {
  let d = addDays(date, 1);
  while (!isBusinessDay(d)) {
    d = addDays(d, 1);
  }
  return d;
}

/** `date` se for dia útil; senão o próximo. */
export function onOrNextBusinessDay(date: ISODate): ISODate {
  return isBusinessDay(date) ? date : nextBusinessDay(date);
}

/** Soma dias úteis (pula fim de semana e feriado). `addBusinessDays(sexta, 1)` = segunda. */
export function addBusinessDays(date: ISODate, days: number): ISODate {
  let d = date;
  let remaining = days;
  while (remaining > 0) {
    d = nextBusinessDay(d);
    remaining -= 1;
  }
  return d;
}

/** Dias úteis entre duas datas (`from` exclusivo, `to` inclusivo). */
export function businessDaysBetween(from: ISODate, to: ISODate): number {
  let count = 0;
  let d = from;
  while (d < to) {
    d = addDays(d, 1);
    if (isBusinessDay(d)) {
      count += 1;
    }
  }
  return count;
}

// ===== Horas úteis =====

function minutesOfDay(instant: ISODateTime): number {
  const [h, m] = timeOf(instant).split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Leva o instante ao início da contagem: se estiver fora do expediente, vai à próxima abertura. */
export function normalizeToBusinessTime(instant: ISODateTime): ISODateTime {
  const date = dateOf(instant);
  const minutes = minutesOfDay(instant);
  if (isBusinessDay(date)) {
    if (minutes < START_MIN) {
      return toIsoDateTime(date, BUSINESS_DAY_START);
    }
    if (minutes < END_MIN) {
      return instant;
    }
  }
  return toIsoDateTime(nextBusinessDay(date), BUSINESS_DAY_START);
}

/**
 * Soma horas úteis a um instante. Recebido fora do expediente, a contagem começa na abertura seguinte.
 * Prazo de 0 hora (telefone, "imediato") vence no próprio instante normalizado.
 *
 * Nota: a conta é minuto a minuto. WhatsApp (4 h) recebido sexta às 17h30 vence segunda às 11h30
 * (30 min na sexta e 3h30 na segunda).
 */
export function addBusinessHours(start: ISODateTime, hours: number): ISODateTime {
  let current = normalizeToBusinessTime(start);
  let remaining = Math.round(hours * 60);
  while (remaining > 0) {
    const date = dateOf(current);
    const left = END_MIN - minutesOfDay(current);
    if (remaining <= left) {
      return fromEpochMs(epochMs(current) + remaining * 60_000);
    }
    remaining -= left;
    current = toIsoDateTime(nextBusinessDay(date), BUSINESS_DAY_START);
  }
  return current;
}

/** Minutos ÚTEIS entre dois instantes (0 se `to` não é depois de `from`). */
export function businessMinutesBetween(from: ISODateTime, to: ISODateTime): number {
  if (compareDateTimes(to, from) <= 0) {
    return 0;
  }
  let current = normalizeToBusinessTime(from);
  if (compareDateTimes(current, to) >= 0) {
    return 0;
  }
  let total = 0;
  let guard = 0;
  while (compareDateTimes(current, to) < 0 && guard < 4000) {
    guard += 1;
    const date = dateOf(current);
    const dayEnd = toIsoDateTime(date, BUSINESS_DAY_END);
    if (compareDateTimes(to, dayEnd) <= 0) {
      total += minutesBetween(current, to);
      return total;
    }
    total += minutesBetween(current, dayEnd);
    current = toIsoDateTime(nextBusinessDay(date), BUSINESS_DAY_START);
  }
  return total;
}

/** Horas úteis por dia de expediente (10). */
export const BUSINESS_HOURS_PER_DAY = MINUTES_PER_BUSINESS_DAY / 60;

// ===== Mensagens =====

/** Prazo calculado na chegada da mensagem (RN-CAN-04). */
export function messageDueAt(
  channel: Channel,
  receivedAt: ISODateTime,
  slaHours: Readonly<Record<Channel, number>> = DEFAULT_SLA_HOURS,
): ISODateTime {
  return addBusinessHours(receivedAt, slaHours[channel]);
}

/** `overdue` é DERIVADO: não respondida e agora depois do prazo. */
export function isMessageOverdue(
  message: Pick<Message, 'status' | 'dueAt' | 'direction'>,
  now: ISODateTime,
): boolean {
  return (
    message.direction === 'in' &&
    message.status !== 'answered' &&
    compareDateTimes(now, message.dueAt) > 0
  );
}

/** Estado exibido: `overdue` quando atrasada, senão o estado gravado. */
export function messageDisplayStatus(
  message: Pick<Message, 'status' | 'dueAt' | 'direction'>,
  now: ISODateTime,
): Message['status'] | 'overdue' {
  return isMessageOverdue(message, now) ? 'overdue' : message.status;
}

/** Atraso em minutos ÚTEIS (0 se não está atrasada). */
export function messageOverdueBusinessMinutes(
  message: Pick<Message, 'status' | 'dueAt' | 'direction'>,
  now: ISODateTime,
): number {
  return isMessageOverdue(message, now) ? businessMinutesBetween(message.dueAt, now) : 0;
}

/** Respondida dentro do prazo. */
export function wasAnsweredOnTime(message: Pick<Message, 'dueAt' | 'firstResponseAt'>): boolean {
  return (
    message.firstResponseAt !== undefined &&
    compareDateTimes(message.firstResponseAt, message.dueAt) <= 0
  );
}

export interface SlaChannelStat {
  channel: Channel;
  /** Mensagens consideradas: respondidas ou já vencidas. */
  considered: number;
  onTime: number;
  /** `null` se não há mensagens consideradas. */
  percent: number | null;
}

/**
 * K30: SLA por canal = respondidas no prazo / mensagens do canal x 100.
 * [suposição] Mensagens ainda dentro do prazo e sem resposta não entram na conta (não são falha nem sucesso).
 */
export function slaByChannel(messages: readonly Message[], now: ISODateTime): SlaChannelStat[] {
  const channels: Channel[] = ['app', 'whatsapp', 'phone', 'email'];
  return channels.map((channel) => {
    const inbound = messages.filter((m) => m.direction === 'in' && m.channel === channel);
    const considered = inbound.filter(
      (m) => m.status === 'answered' || compareDateTimes(now, m.dueAt) > 0,
    );
    const onTime = considered.filter((m) => m.status === 'answered' && wasAnsweredOnTime(m)).length;
    return {
      channel,
      considered: considered.length,
      onTime,
      percent:
        considered.length === 0 ? null : Math.round((onTime / considered.length) * 1000) / 10,
    };
  });
}

// ===== Reclamações =====

/** Prazo da reclamação formal: fim do expediente do 5º dia útil depois da abertura (RN-POP-08). */
export function complaintDueAt(openedAt: ISODateTime): ISODateTime {
  const openedDate = dateOf(openedAt);
  // Aberta em dia não útil, a contagem parte do próximo dia útil.
  const base = isBusinessDay(openedDate) ? openedDate : nextBusinessDay(openedDate);
  return toIsoDateTime(addBusinessDays(base, COMPLAINT_DEADLINE_BUSINESS_DAYS), BUSINESS_DAY_END);
}

/** Reclamação vencida: ainda não respondida nem encerrada e passou o prazo (AC-M11-08). */
export function isComplaintOverdue(
  complaint: {
    status: 'open' | 'in_progress' | 'answered' | 'closed' | 'dismissed';
    dueAt: ISODateTime;
  },
  now: ISODateTime,
): boolean {
  return (
    (complaint.status === 'open' || complaint.status === 'in_progress') &&
    compareDateTimes(now, complaint.dueAt) > 0
  );
}

/** Segunda a sexta (0 = domingo). Auxiliar de exibição. */
export function isoWeekdayName(date: ISODate): string {
  return (
    [
      'domingo',
      'segunda-feira',
      'terça-feira',
      'quarta-feira',
      'quinta-feira',
      'sexta-feira',
      'sábado',
    ][weekday(date)] ?? ''
  );
}
