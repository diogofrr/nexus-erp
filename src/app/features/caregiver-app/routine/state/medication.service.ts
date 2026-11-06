import { Injectable, inject } from '@angular/core';
import { CaregiverOwnership } from '../../../../core/auth/caregiver-ownership';
import { Clock } from '../../../../core/clock/clock.service';
import { dateOf, timeOf, toIsoDateTime } from '../../../../core/clock/date-utils';
import { Database } from '../../../../core/data/database';
import { DoseCheck, ID, Medication } from '../../../../core/models';
import { isTimeOfDay } from '../../../../core/rules/care-agenda';
import { NAME_MAX_CHARS, isTooLong } from '../../../../core/rules/text-limits';

/** Os horários prontos do formulário (UX C6): Manhã, Tarde e Noite. */
export const MEDICATION_PRESET_TIMES: readonly { time: string; label: string }[] = [
  { time: '08:00', label: 'Manhã 08:00' },
  { time: '14:00', label: 'Tarde 14:00' },
  { time: '20:00', label: 'Noite 20:00' },
];

export type MedicationProblem =
  | 'name_required'
  | 'name_too_long'
  | 'dosage_too_long'
  | 'times_required'
  | 'time_format';

/** O que o formulário "Novo remédio" entrega. */
export interface MedicationInput {
  name: string;
  /** Como está na receita (opcional): "50 mg", "1 comprimido". */
  dosage: string;
  times: readonly string[];
  /** "Este remédio está em uso". Desligado = em pausa (o remédio nunca é apagado, S-32). */
  active: boolean;
}

/**
 * O que está errado num remédio: sem nome, nome ou receita longos demais (120 caracteres), sem horário ou com hora fora
 * do formato (UX C6, erros).
 */
export function medicationProblems(
  input: Pick<MedicationInput, 'name' | 'times'> & Partial<Pick<MedicationInput, 'dosage'>>,
): MedicationProblem[] {
  const problems: MedicationProblem[] = [];
  if (input.name.trim() === '') {
    problems.push('name_required');
  } else if (isTooLong(input.name, NAME_MAX_CHARS)) {
    problems.push('name_too_long');
  }
  if (isTooLong(input.dosage ?? '', NAME_MAX_CHARS)) {
    problems.push('dosage_too_long');
  }
  if (input.times.length === 0) {
    problems.push('times_required');
  } else if (input.times.some((t) => !isTimeOfDay(t))) {
    problems.push('time_format');
  }
  return problems;
}

/** Horários sem repetição e em ordem. */
export function normalizeTimes(times: readonly string[]): string[] {
  return [...new Set(times)].sort();
}

export class MedicationError extends Error {
  constructor(
    message: string,
    readonly problems: readonly MedicationProblem[] = [],
  ) {
    super(message);
    this.name = 'MedicationError';
  }
}

/**
 * Remédios da pessoa idosa no aplicativo do cuidador (RN-USR-07, RN-USR-09, S-32). O app só ajuda a lembrar: não
 * orienta dose, não pede motivo nem condição de saúde. **Nunca apaga um remédio**: pausa (`active: false`) e mantém
 * as marcações do passado. "Dei em outro horário" muda só o `givenAt` de uma marcação que já existe (S-06); marcar,
 * desfazer e a lista do dia são do `DoseCheckService` do núcleo.
 */
@Injectable({ providedIn: 'root' })
export class MedicationService {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly ownership = inject(CaregiverOwnership);

  /** Todos os remédios da pessoa idosa, em uso e em pausa (reativo). */
  medicationsOf(elderId: ID): Medication[] {
    if (!this.ownership.ownsElder(elderId)) {
      return [];
    }
    return this.db.medications
      .query((m) => m.elderId === elderId)
      .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'pt-BR'));
  }

  add(elderId: ID, input: MedicationInput): Medication {
    this.ownership.assertElder(elderId);
    this.assertValid(input);
    return this.db.medications.create({
      elderId,
      name: input.name.trim(),
      dosage: input.dosage.trim(),
      times: normalizeTimes(input.times),
      active: input.active,
    });
  }

  update(id: ID, input: MedicationInput): Medication {
    this.ownership.assertMedication(id);
    this.db.medications.require(id);
    this.assertValid(input);
    return this.db.medications.update(id, {
      name: input.name.trim(),
      dosage: input.dosage.trim(),
      times: normalizeTimes(input.times),
      active: input.active,
    });
  }

  /**
   * "Dei em outro horário": troca a hora em que a dose foi dada. Não dá para dar uma dose de hoje depois de agora.
   * A dose continua a mesma (mesmo remédio, dia e horário previsto).
   */
  changeGivenTime(checkId: ID, time: string): DoseCheck {
    this.ownership.assertDoseCheck(checkId);
    const check = this.db.doseChecks.require(checkId);
    if (!isTimeOfDay(time)) {
      throw new MedicationError('Informe uma hora no formato 08:00.', ['time_format']);
    }
    const givenAt = toIsoDateTime(check.date, time);
    const now = this.clock.now();
    if (dateOf(now) === check.date && time > timeOf(now)) {
      throw new MedicationError('Escolha uma hora que já passou.');
    }
    return this.db.doseChecks.update(checkId, { givenAt });
  }

  private assertValid(input: MedicationInput): void {
    const problems = medicationProblems(input);
    if (problems.length > 0) {
      throw new MedicationError('Não foi possível salvar o remédio.', problems);
    }
  }
}
