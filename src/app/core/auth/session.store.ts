import { Injectable, computed, inject, signal } from '@angular/core';
import { Database } from '../data/database';
import { AppUser, AuthSession, Role } from '../models/access';
import { STORAGE_KEYS, StorageService } from '../storage/storage.service';
import { Actor } from './permissions';

/**
 * Estado da sessão simulada, em `sessionStorage` (`nexus-erp:session`): fecha com a aba (AC-M01-04).
 * Só guarda e expõe o estado; os fluxos (login, 2FA, logout, log de auditoria) ficam no `AuthService`.
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly storage = inject(StorageService);
  private readonly db = inject(Database);

  private readonly sessionSignal = signal<AuthSession | null>(
    this.storage.readSession<AuthSession | null>(STORAGE_KEYS.session, null),
  );
  private readonly expiringSignal = signal(false);

  readonly session = this.sessionSignal.asReadonly();
  /** `true` entre os 28 e os 30 minutos de inatividade (aviso de expiração, SCR-M01-04). */
  readonly expiring = this.expiringSignal.asReadonly();

  /** Usuário da sessão (ou `null`). Reage à troca do seed. */
  readonly user = computed<AppUser | null>(() => {
    const s = this.sessionSignal();
    return s ? (this.db.users.get(s.userId) ?? null) : null;
  });

  readonly role = computed<Role | null>(() => this.sessionSignal()?.role ?? null);

  /** Sessão completa: perfil escolhido e, quando exigido, segundo fator confirmado. */
  readonly isAuthenticated = computed(() => {
    const s = this.sessionSignal();
    return s !== null && s.twoFactorVerified && this.user() !== null;
  });

  /** Perfil escolhido, mas o segundo fator ainda não foi confirmado. */
  readonly isPendingTwoFactor = computed(() => {
    const s = this.sessionSignal();
    return s !== null && !s.twoFactorVerified;
  });

  /** Quem está agindo, para `isOwnRecord` e `canOnRecord`. */
  readonly actor = computed<Actor | null>(() => {
    const user = this.user();
    const s = this.sessionSignal();
    if (!user || !s) {
      return null;
    }
    const actor: Actor = { userId: user.id, role: s.role };
    if (user.psychologistId) {
      actor.psychologistId = user.psychologistId;
    }
    if (user.providerId) {
      actor.providerId = user.providerId;
    }
    return actor;
  });

  set(session: AuthSession): void {
    this.sessionSignal.set(session);
    this.storage.writeSession(STORAGE_KEYS.session, session);
  }

  patch(partial: Partial<AuthSession>): void {
    const current = this.sessionSignal();
    if (current) {
      this.set({ ...current, ...partial });
    }
  }

  clear(): void {
    this.sessionSignal.set(null);
    this.expiringSignal.set(false);
    this.storage.removeSession(STORAGE_KEYS.session);
  }

  setExpiring(value: boolean): void {
    this.expiringSignal.set(value);
  }
}
