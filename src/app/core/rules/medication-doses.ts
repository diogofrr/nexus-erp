/**
 * Doses de remédio de um dia (RN-USR-07: o aplicativo oferece lembretes de remédio e registro de remédios).
 * Funções PURAS: recebem os medicamentos e as marcações ("dei") e devolvem a lista do dia. Quem decide se um
 * horário já passou é a tela, com o `Clock` (a regra não lê o relógio).
 *
 * Cada horário de cada medicamento ativo é uma dose por dia. A dose está dada se existe uma marcação com o
 * mesmo medicamento, dia e horário. Medicamento inativo não gera dose.
 */
import { DoseCheck, Medication } from '../models/caregivers';
import { ID, ISODate, ISODateTime, TimeOfDay } from '../models/primitives';

export interface DoseSlot {
  /** Chave estável: `med_0001@2026-11-04@08:00`. */
  key: string;
  medicationId: ID;
  medicationName: string;
  dosage: string;
  date: ISODate;
  /** Horário previsto (`HH:mm`). */
  time: TimeOfDay;
  given: boolean;
  /** Marcação, quando a dose foi dada (para desfazer). */
  checkId?: ID;
  givenAt?: ISODateTime;
}

export function doseKey(medicationId: ID, date: ISODate, time: TimeOfDay): string {
  return `${medicationId}@${date}@${time}`;
}

/** As doses do dia, em ordem de horário (e de nome do remédio, no mesmo horário). */
export function dosesForDate(
  date: ISODate,
  medications: readonly Medication[],
  checks: readonly DoseCheck[],
): DoseSlot[] {
  const given = new Map<string, DoseCheck>();
  checks.forEach((check) => {
    if (check.date === date) {
      given.set(doseKey(check.medicationId, check.date, check.time), check);
    }
  });
  const slots: DoseSlot[] = [];
  medications
    .filter((m) => m.active)
    .forEach((m) => {
      [...new Set(m.times)].forEach((time) => {
        const key = doseKey(m.id, date, time);
        const check = given.get(key);
        slots.push({
          key,
          medicationId: m.id,
          medicationName: m.name,
          dosage: m.dosage,
          date,
          time,
          given: check !== undefined,
          ...(check ? { checkId: check.id, givenAt: check.givenAt } : {}),
        });
      });
    });
  return slots.sort(
    (a, b) => a.time.localeCompare(b.time) || a.medicationName.localeCompare(b.medicationName, 'pt-BR'),
  );
}

export interface DoseProgress {
  given: number;
  total: number;
  /** `true` quando há doses e todas foram dadas. */
  complete: boolean;
}

/** "2 de 3 remédios dados" do dia. */
export function doseProgress(slots: readonly DoseSlot[]): DoseProgress {
  const given = slots.filter((s) => s.given).length;
  return { given, total: slots.length, complete: slots.length > 0 && given === slots.length };
}
