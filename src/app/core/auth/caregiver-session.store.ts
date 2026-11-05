import { Injectable, computed, inject, signal } from '@angular/core';
import { Database } from '../data/database';
import { Caregiver, CaregiverSession, ID } from '../models';
import { STORAGE_KEYS, StorageService } from '../storage/storage.service';
import { caregiverAccessBlock } from './caregiver-access';

/**
 * Estado da sessão do cuidador, em `sessionStorage` (`nexus-erp:caregiver-session`): fecha com a aba. Só guarda e
 * expõe o estado; o fluxo de entrar e sair fica no `CaregiverSessionService`. Existe separado dele para o
 * `AuthService` (equipe) poder encerrar a sessão do cuidador sem uma dependência circular.
 */
@Injectable({ providedIn: 'root' })
export class CaregiverSessionStore {
  private readonly storage = inject(StorageService);
  private readonly db = inject(Database);

  private readonly sessionSignal = signal<CaregiverSession | null>(
    this.storage.readSession<CaregiverSession | null>(STORAGE_KEYS.caregiverSession, null),
  );

  readonly session = this.sessionSignal.asReadonly();

  /** O cadastro da sessão, se ele existe e ainda pode entrar (cadastro encerrado, anonimizado ou eliminado não). */
  readonly caregiver = computed<Caregiver | null>(() => {
    const session = this.sessionSignal();
    const caregiver = session ? this.db.caregivers.get(session.caregiverId) : undefined;
    return caregiver && caregiverAccessBlock(caregiver) === null ? caregiver : null;
  });

  readonly caregiverId = computed<ID | null>(() => this.caregiver()?.id ?? null);
  readonly isSignedIn = computed(() => this.caregiver() !== null);

  set(session: CaregiverSession): void {
    this.sessionSignal.set(session);
    this.storage.writeSession(STORAGE_KEYS.caregiverSession, session);
  }

  clear(): void {
    this.sessionSignal.set(null);
    this.storage.removeSession(STORAGE_KEYS.caregiverSession);
  }
}
