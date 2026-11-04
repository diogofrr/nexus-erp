/**
 * Contexto de geração do seed: "hoje" (D0), PRNG, ids e datas relativas.
 * `D-10` é 10 dias antes de hoje; `D+5`, 5 dias depois (escopo 5.0). Nada aqui lê o relógio.
 */
import { addDays, addMonths, toIsoDateTime } from '../clock/date-utils';
import { isBusinessDay } from '../rules/sla';
import { Audited, ISODate, ISODateTime, TimeOfDay } from '../models/primitives';
import { Rng } from './prng';

export const SEED_NAME = 'nexus-seed-1';

export function pad4(n: number): string {
  return String(n).padStart(4, '0');
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export class SeedContext {
  readonly rng = new Rng(SEED_NAME);
  private readonly counters = new Map<string, number>();

  constructor(readonly today: ISODate) {}

  /** D0 + `days`. */
  d(days: number): ISODate {
    return addDays(this.today, days);
  }

  /** D0 + `months` meses de calendário. */
  m(months: number, days = 0): ISODate {
    return addDays(addMonths(this.today, months), days);
  }

  /** Instante: data D0 + `days` na hora `time`, com o deslocamento de Brasília. */
  dt(days: number, time: TimeOfDay = '09:00'): ISODateTime {
    return toIsoDateTime(this.d(days), time);
  }

  /** Instante a partir de uma data. */
  at(date: ISODate, time: TimeOfDay = '09:00'): ISODateTime {
    return toIsoDateTime(date, time);
  }

  /** `n` dias úteis (sem fim de semana e feriado nacional) para trás a partir de hoje; n = 1 é o dia útil anterior. */
  prevBusinessDay(n: number): ISODate {
    let date = this.today;
    let remaining = n;
    while (remaining > 0) {
      date = addDays(date, -1);
      if (isBusinessDay(date)) {
        remaining -= 1;
      }
    }
    return date;
  }

  /** Reserva os `count` primeiros ids de um prefixo (usados por ids fixos), para os gerados não colidirem. */
  reserve(prefix: string, count: number): void {
    this.counters.set(prefix, Math.max(this.counters.get(prefix) ?? 0, count));
  }

  /** Id sequencial por prefixo: `zar_0001`, `zar_0002`... */
  nextId(prefix: string): string {
    const n = (this.counters.get(prefix) ?? 0) + 1;
    this.counters.set(prefix, n);
    return `${prefix}_${pad4(n)}`;
  }

  /** Monta uma entidade `Audited` com carimbos de `createdAt`. */
  entity<T extends Audited>(
    id: string,
    createdAt: ISODateTime,
    fields: Omit<T, keyof Audited>,
    updatedAt: ISODateTime = createdAt,
  ): T {
    return { id, createdAt, updatedAt, ...fields } as unknown as T;
  }
}
