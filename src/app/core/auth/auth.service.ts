import { Injectable, computed, inject, signal } from '@angular/core';
import { AuditLogService } from '../audit/audit-log.service';
import { Clock } from '../clock/clock.service';
import { Database } from '../data/database';
import { AppUser, AuthState, PermissionAction, Resource, Role } from '../models';
import { OwnershipSubject, PermissionContext, can, canOnRecord } from './permissions';
import { SessionStore } from './session.store';

/** Código do segundo fator simulado, exibido na tela (E-01). */
export const TWO_FACTOR_CODE = '123456';
/** Três erros seguidos no segundo fator voltam à entrada (AC-M01-03). */
export const MAX_TWO_FACTOR_FAILURES = 3;

export type LoginOutcome =
  | { status: 'authenticated'; user: AppUser }
  | { status: 'needs_two_factor'; user: AppUser; code: string }
  | { status: 'denied'; reason: 'unknown_user' | 'inactive_user' };

export type TwoFactorOutcome =
  | { status: 'ok'; user: AppUser }
  | { status: 'invalid_format' }
  | { status: 'wrong_code'; attemptsLeft: number }
  | { status: 'too_many_attempts' }
  | { status: 'no_pending_session' };

export type SessionEndReason = 'user' | 'switch_profile' | 'inactivity' | 'two_factor_failures';

/**
 * Login simulado por perfil de demonstração (M01). Não há senha: escolhe-se um dos 8 usuários da equipe.
 * Todos os perfis exigem o código `123456` (E-02: o perfil do prestador credenciado foi removido).
 * Cada login, logout e acesso negado gera linha no log (AC-M01-05).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly db = inject(Database);
  private readonly store = inject(SessionStore);
  private readonly audit = inject(AuditLogService);
  private readonly clock = inject(Clock);

  private readonly endReasonSignal = signal<SessionEndReason | null>(null);
  private returnUrlValue: string | null = null;

  readonly session = this.store.session;
  readonly user = this.store.user;
  readonly role = this.store.role;
  readonly actor = this.store.actor;
  readonly isAuthenticated = this.store.isAuthenticated;
  readonly isPendingTwoFactor = this.store.isPendingTwoFactor;
  /** Por que a última sessão terminou (para a mensagem na tela de entrada). */
  readonly endReason = this.endReasonSignal.asReadonly();

  /** Estado do ciclo: anonymous, pending_2fa, authenticated, expiring ou expired (M01). */
  readonly state = computed<AuthState>(() => {
    if (this.store.isPendingTwoFactor()) {
      return 'pending_2fa';
    }
    if (this.store.isAuthenticated()) {
      return this.store.expiring() ? 'expiring' : 'authenticated';
    }
    return this.endReasonSignal() === 'inactivity' ? 'expired' : 'anonymous';
  });

  /** Código a exibir na tela de segundo fator; `null` fora dessa etapa. */
  readonly pendingTwoFactorCode = computed(() =>
    this.store.isPendingTwoFactor() ? TWO_FACTOR_CODE : null,
  );

  /** Os usuários de demonstração, para os cartões da entrada (AC-M01-01). */
  demoUsers(): readonly AppUser[] {
    return this.db.users.list();
  }

  /** Escolhe um perfil de demonstração. Usuário inativo não entra (M01). */
  selectProfile(userId: string): LoginOutcome {
    const user = this.db.users.get(userId);
    if (!user) {
      return { status: 'denied', reason: 'unknown_user' };
    }
    if (this.store.session()) {
      this.logout('switch_profile');
    }
    if (!user.active) {
      this.audit.denied('session', 'Usuário inativo tentou entrar', {
        userId: user.id,
        role: user.role,
      });
      return { status: 'denied', reason: 'inactive_user' };
    }
    this.endReasonSignal.set(null);
    const now = this.clock.realNow();
    if (user.requiresTwoFactor) {
      this.store.set({
        userId: user.id,
        role: user.role,
        startedAt: now,
        lastActivityAt: now,
        twoFactorVerified: false,
        twoFactorFailures: 0,
      });
      return { status: 'needs_two_factor', user, code: TWO_FACTOR_CODE };
    }
    this.store.set({
      userId: user.id,
      role: user.role,
      startedAt: now,
      lastActivityAt: now,
      twoFactorVerified: true,
      twoFactorFailures: 0,
    });
    this.audit.login({ userId: user.id, role: user.role });
    return { status: 'authenticated', user };
  }

  /**
   * Confirma o segundo fator. Exatamente 6 dígitos e igual ao exibido. O terceiro erro seguido encerra a
   * sessão e volta à entrada (AC-M01-03).
   */
  verifyTwoFactor(code: string): TwoFactorOutcome {
    const session = this.store.session();
    const user = this.store.user();
    if (!session || session.twoFactorVerified || !user) {
      return { status: 'no_pending_session' };
    }
    if (!/^\d{6}$/.test(code)) {
      return { status: 'invalid_format' };
    }
    if (code === TWO_FACTOR_CODE) {
      const now = this.clock.realNow();
      this.store.set({
        ...session,
        twoFactorVerified: true,
        twoFactorFailures: 0,
        lastActivityAt: now,
      });
      this.audit.login({ userId: user.id, role: user.role }, 'segundo fator confirmado');
      return { status: 'ok', user };
    }
    const failures = session.twoFactorFailures + 1;
    if (failures >= MAX_TWO_FACTOR_FAILURES) {
      this.audit.denied('session', 'Três erros seguidos no segundo fator', {
        userId: user.id,
        role: user.role,
      });
      this.store.clear();
      this.endReasonSignal.set('two_factor_failures');
      return { status: 'too_many_attempts' };
    }
    this.store.set({ ...session, twoFactorFailures: failures });
    return { status: 'wrong_code', attemptsLeft: MAX_TWO_FACTOR_FAILURES - failures };
  }

  /** "Voltar" na tela do segundo fator: descarta a sessão pendente sem registrar logout. */
  cancelPendingTwoFactor(): void {
    if (this.store.isPendingTwoFactor()) {
      this.store.clear();
    }
  }

  /** Encerra a sessão e grava o logout. Trocar de perfil = sair e escolher outro (SCR-M01-03). */
  logout(reason: SessionEndReason = 'user'): void {
    const user = this.store.user();
    const session = this.store.session();
    if (user && session?.twoFactorVerified) {
      this.audit.logout({ userId: user.id, role: user.role }, reasonText(reason));
    }
    this.store.clear();
    this.endReasonSignal.set(reason);
  }

  /** Troca de perfil: encerra a sessão atual (a entrada mostra os cartões de novo). */
  switchProfile(): void {
    this.logout('switch_profile');
  }

  /** Registra atividade do usuário (atualiza `lastActivityAt`, relógio REAL). */
  touch(): void {
    if (this.store.isAuthenticated()) {
      this.store.patch({ lastActivityAt: this.clock.realNow() });
    }
  }

  // ===== Permissões do usuário atual =====

  /** `can` para o perfil logado. Sem sessão, nega. */
  can(resource: Resource, action: PermissionAction, context?: PermissionContext): boolean {
    const role = this.role();
    return role !== null && this.isAuthenticated() && can(role, resource, action, context);
  }

  /** `can` sobre um registro (resolve "próprio" com `isOwnRecord`). */
  canOnRecord(resource: Resource, action: PermissionAction, record: OwnershipSubject): boolean {
    const actor = this.actor();
    return actor !== null && this.isAuthenticated() && canOnRecord(actor, resource, action, record);
  }

  hasRole(...roles: Role[]): boolean {
    const role = this.role();
    return role !== null && roles.includes(role);
  }

  // ===== Retorno após o login (em memória, nunca na URL: LP-21) =====

  setReturnUrl(url: string | null): void {
    this.returnUrlValue = url;
  }

  /** Devolve e limpa a rota pedida antes do login. */
  consumeReturnUrl(): string | null {
    const url = this.returnUrlValue;
    this.returnUrlValue = null;
    return url;
  }
}

function reasonText(reason: SessionEndReason): string {
  switch (reason) {
    case 'inactivity':
      return 'sessão expirada por inatividade';
    case 'switch_profile':
      return 'troca de perfil';
    case 'two_factor_failures':
      return 'erros no segundo fator';
    default:
      return 'saída pelo usuário';
  }
}
