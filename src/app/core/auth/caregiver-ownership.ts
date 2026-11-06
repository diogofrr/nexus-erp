import { Injectable, inject } from '@angular/core';
import { Database } from '../data/database';
import { ID } from '../models';
import { CaregiverSessionStore } from './caregiver-session.store';

/** Frase para a tela quando o registro não é de quem está na sessão (a mesma de "não existe": não revela nada). */
export const NOT_OWNER_TEXT = 'Não encontramos este registro na sua conta.';

/** O registro é de outro cuidador: a gravação (ou a leitura) foi recusada na borda do serviço. */
export class CaregiverOwnershipError extends Error {
  constructor(message: string = NOT_OWNER_TEXT) {
    super(message);
    this.name = 'CaregiverOwnershipError';
  }
}

/**
 * Guardião de posse do aplicativo do cuidador (docs/11, seção 11: "a checagem de perfil fica na borda"; QAC-001).
 *
 * Quem está na sessão do cuidador só lê e grava o que é dele, mesmo chamando o serviço direto com o id de outra pessoa:
 * a tela passa o id da sessão, mas o serviço nunca pode confiar no parâmetro. A regra é uma só e fica aqui; cada serviço
 * do cuidador chama o guardião na sua borda em vez de copiar um `if`.
 *
 * - Com sessão de cuidador aberta, só vale o registro do dono da sessão (cadastro, pessoa idosa, remédio, compromisso,
 *   marcação de dose ou conversa dele).
 * - Sem sessão de cuidador (a equipe, o Começar, os testes do núcleo) o guardião deixa passar: a equipe tem a própria
 *   checagem de perfil na borda dos serviços dela, e só existe uma sessão por vez (`AuthService.selectProfile` e
 *   `CaregiverSessionService.signIn` encerram a outra).
 * - Registro que não existe conta como "de outro": a frase é a mesma e nada se revela.
 *
 * ```ts
 * private readonly ownership = inject(CaregiverOwnership);
 * this.ownership.assertMedication(medicationId);          // lança CaregiverOwnershipError
 * if (!this.ownership.ownsCaregiver(caregiverId)) { ... } // serviço que devolve { ok: false }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class CaregiverOwnership {
  private readonly db = inject(Database);
  private readonly store = inject(CaregiverSessionStore);

  /**
   * O cuidador da sessão, ou `null` sem sessão de cuidador. Lê a sessão guardada, não o cadastro: uma sessão que deixou de
   * poder entrar (cadastro encerrado no meio do uso) continua sem poder agir sobre os outros.
   */
  actorId(): ID | null {
    return this.store.session()?.caregiverId ?? null;
  }

  // ===== Perguntar =====

  /** O cadastro é de quem está na sessão (ou não há sessão de cuidador)? */
  ownsCaregiver(caregiverId: ID | null | undefined): boolean {
    const actor = this.actorId();
    return actor === null || (caregiverId !== null && caregiverId !== undefined && caregiverId === actor);
  }

  /** A pessoa idosa é de quem está na sessão? */
  ownsElder(elderId: ID | null | undefined): boolean {
    return this.actorId() === null || this.ownsCaregiver(this.db.elders.get(elderId ?? '')?.caregiverId);
  }

  /** O remédio é da pessoa idosa de quem está na sessão? */
  ownsMedication(medicationId: ID | null | undefined): boolean {
    return this.actorId() === null || this.ownsElder(this.db.medications.get(medicationId ?? '')?.elderId);
  }

  /** A marcação de dose é de um remédio de quem está na sessão? */
  ownsDoseCheck(doseCheckId: ID | null | undefined): boolean {
    return this.actorId() === null || this.ownsMedication(this.db.doseChecks.get(doseCheckId ?? '')?.medicationId);
  }

  /** O compromisso é da pessoa idosa de quem está na sessão? */
  ownsAppointment(appointmentId: ID | null | undefined): boolean {
    return this.actorId() === null || this.ownsElder(this.db.careAppointments.get(appointmentId ?? '')?.elderId);
  }

  /** A conversa com o psicólogo é de quem está na sessão? */
  ownsCareSession(sessionId: ID | null | undefined): boolean {
    return this.actorId() === null || this.ownsCaregiver(this.db.careSessions.get(sessionId ?? '')?.caregiverId);
  }

  // ===== Exigir (lançam `CaregiverOwnershipError`) =====

  assertCaregiver(caregiverId: ID | null | undefined): void {
    this.require(this.ownsCaregiver(caregiverId));
  }

  assertElder(elderId: ID | null | undefined): void {
    this.require(this.ownsElder(elderId));
  }

  assertMedication(medicationId: ID | null | undefined): void {
    this.require(this.ownsMedication(medicationId));
  }

  assertDoseCheck(doseCheckId: ID | null | undefined): void {
    this.require(this.ownsDoseCheck(doseCheckId));
  }

  assertAppointment(appointmentId: ID | null | undefined): void {
    this.require(this.ownsAppointment(appointmentId));
  }

  assertCareSession(sessionId: ID | null | undefined): void {
    this.require(this.ownsCareSession(sessionId));
  }

  private require(owns: boolean): void {
    if (!owns) {
      throw new CaregiverOwnershipError();
    }
  }
}
