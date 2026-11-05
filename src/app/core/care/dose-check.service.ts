import { Injectable, inject } from '@angular/core';
import { Clock } from '../clock/clock.service';
import { compareDates } from '../clock/date-utils';
import { Database } from '../data/database';
import { DoseCheck, ID, ISODate, TimeOfDay } from '../models';
import { DoseSlot, dosesForDate } from '../rules/medication-doses';

/** Marcação que não vale (horário que o remédio não tem, dia que ainda não chegou). A frase é para a tela. */
export class DoseCheckError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DoseCheckError';
  }
}

/**
 * Tomadas de remédio marcadas pelo cuidador ("dei", RN-USR-07: registro de remédios). Uma marcação por
 * medicamento, dia e horário previsto: marcar de novo não duplica e desmarcar apaga a linha. Não dá para marcar
 * dose de um dia que ainda não chegou (suposição de protótipo: o registro é do que já foi dado).
 *
 * A lista do dia (`forElder`) vem da regra pura `dosesForDate`; o relógio é o `Clock`, nunca `Date`.
 *
 * ```ts
 * const doses = inject(DoseCheckService);
 * doses.forElder('el_0001', clock.today());     // DoseSlot[] em ordem de horário
 * doses.mark('med_0001', clock.today(), '08:00');
 * doses.unmark('med_0001', clock.today(), '08:00');
 * ```
 */
@Injectable({ providedIn: 'root' })
export class DoseCheckService {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);

  /** Doses do dia da pessoa idosa, com o que já foi dado (reativo: lê as coleções por signals). */
  forElder(elderId: ID, date: ISODate): DoseSlot[] {
    const medications = this.db.medications.query((m) => m.elderId === elderId);
    const ids = new Set(medications.map((m) => m.id));
    const checks = this.db.doseChecks.query((d) => d.date === date && ids.has(d.medicationId));
    return dosesForDate(date, medications, checks);
  }

  /** Marca a dose como dada. Idempotente: se já estava marcada, devolve a marcação existente. */
  mark(medicationId: ID, date: ISODate, time: TimeOfDay): DoseCheck {
    const medication = this.db.medications.get(medicationId);
    if (!medication || !medication.active) {
      throw new DoseCheckError('Este remédio não está na lista de agora.');
    }
    if (!medication.times.includes(time)) {
      throw new DoseCheckError('Este horário não faz parte dos horários do remédio.');
    }
    if (compareDates(date, this.clock.today()) > 0) {
      throw new DoseCheckError('Só dá para marcar o remédio de hoje ou de um dia que já passou.');
    }
    const existing = this.find(medicationId, date, time);
    if (existing) {
      return existing;
    }
    return this.db.doseChecks.create({ medicationId, date, time, givenAt: this.clock.now() });
  }

  /** Desfaz a marcação ("não dei"). Devolve `false` se não havia marcação. */
  unmark(medicationId: ID, date: ISODate, time: TimeOfDay): boolean {
    const existing = this.find(medicationId, date, time);
    return existing ? this.db.doseChecks.remove(existing.id) : false;
  }

  isGiven(medicationId: ID, date: ISODate, time: TimeOfDay): boolean {
    return this.find(medicationId, date, time) !== undefined;
  }

  private find(medicationId: ID, date: ISODate, time: TimeOfDay): DoseCheck | undefined {
    return this.db.doseChecks.find(
      (d) => d.medicationId === medicationId && d.date === date && d.time === time,
    );
  }
}
