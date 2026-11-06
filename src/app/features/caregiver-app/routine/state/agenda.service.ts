import { Injectable, inject } from '@angular/core';
import { CaregiverOwnership } from '../../../../core/auth/caregiver-ownership';
import { Clock } from '../../../../core/clock/clock.service';
import { Database } from '../../../../core/data/database';
import { CareAppointment, ID, ISODate } from '../../../../core/models';
import {
  AppointmentDraft,
  AppointmentKind,
  AppointmentProblem,
  appointmentInstant,
  appointmentProblems,
} from '../../../../core/rules/care-agenda';

/** Compromisso que não pôde ser salvo. `problems` diz o que está errado (a tela mostra junto de cada campo). */
export class AgendaError extends Error {
  constructor(
    message: string,
    readonly problems: readonly AppointmentProblem[],
  ) {
    super(message);
    this.name = 'AgendaError';
  }
}

/** O que o formulário "Novo compromisso" entrega. */
export interface AppointmentInput {
  title: string;
  kind: AppointmentKind;
  date: ISODate;
  time: string;
  /** Onde ou com quem (opcional). */
  place: string;
  reminder: boolean;
}

/**
 * Agenda da pessoa idosa no aplicativo do cuidador (RN-USR-07, RN-USR-09): adicionar, remarcar, ligar ou desligar o
 * lembrete e tirar da agenda. Valida na borda com a regra pura do núcleo (`appointmentProblems`), então a tela e o
 * serviço dizem a mesma coisa. Tirar da agenda devolve o registro para o "Desfazer" (`restore`). O cuidador não
 * gera linha de log do próprio dado (decisão 2 do contexto).
 *
 * ```ts
 * const agenda = inject(AgendaService);
 * const created = agenda.add('el_0001', { title: 'Consulta', kind: 'medical', date: '2026-11-06', time: '15:00', place: '', reminder: true });
 * ```
 */
@Injectable({ providedIn: 'root' })
export class AgendaService {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly ownership = inject(CaregiverOwnership);

  /** Os compromissos da pessoa idosa (reativo). */
  appointmentsOf(elderId: ID): CareAppointment[] {
    if (!this.ownership.ownsElder(elderId)) {
      return [];
    }
    return this.db.careAppointments.query((a) => a.elderId === elderId);
  }

  /** O que impede de salvar (lista vazia = pode). */
  problems(input: AppointmentDraft): AppointmentProblem[] {
    return appointmentProblems(input, this.clock.now());
  }

  add(elderId: ID, input: AppointmentInput): CareAppointment {
    this.ownership.assertElder(elderId);
    this.assertValid(input);
    const place = input.place.trim();
    return this.db.careAppointments.create({
      elderId,
      title: input.title.trim(),
      at: appointmentInstant(input.date, input.time),
      kind: input.kind,
      reminder: input.reminder,
      ...(place ? { place } : {}),
    });
  }

  /** Remarca (e corrige o resto). Devolve o registro de antes, para o "Desfazer". */
  update(id: ID, input: AppointmentInput): { before: CareAppointment; after: CareAppointment } {
    this.ownership.assertAppointment(id);
    const before = this.db.careAppointments.require(id);
    this.assertValid(input);
    const place = input.place.trim();
    const after = this.db.careAppointments.update(id, {
      title: input.title.trim(),
      at: appointmentInstant(input.date, input.time),
      kind: input.kind,
      reminder: input.reminder,
      place: place ? place : undefined,
    });
    return { before, after };
  }

  /** "Lembrar de mim" ligado ou desligado, sem confirmação (é reversível). */
  setReminder(id: ID, reminder: boolean): CareAppointment {
    this.ownership.assertAppointment(id);
    return this.db.careAppointments.update(id, { reminder });
  }

  /** Tira da agenda. Devolve o registro removido para o "Desfazer". */
  remove(id: ID): CareAppointment {
    this.ownership.assertAppointment(id);
    const removed = this.db.careAppointments.require(id);
    this.db.careAppointments.remove(id);
    return removed;
  }

  /** Volta o que foi tirado (ou o horário de antes de uma remarcação), com o mesmo id. */
  restore(record: CareAppointment): CareAppointment {
    // O registro tirado da agenda já não existe: o "Desfazer" só confere a pessoa idosa. Se ele existe (remarcação
    // desfeita), tem de ser de quem está na sessão também.
    const existing = this.db.careAppointments.get(record.id);
    this.ownership.assertElder(record.elderId);
    if (existing) {
      this.ownership.assertAppointment(record.id);
    }
    const { createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = record;
    if (existing) {
      const { id: _id, ...patch } = rest;
      return this.db.careAppointments.update(record.id, { ...patch, place: record.place });
    }
    return this.db.careAppointments.create(rest);
  }

  private assertValid(input: AppointmentInput): void {
    const problems = this.problems(input);
    if (problems.length > 0) {
      throw new AgendaError('Não foi possível salvar o compromisso.', problems);
    }
  }
}
