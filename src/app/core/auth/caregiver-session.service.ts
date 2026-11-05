import { Injectable, inject, signal } from '@angular/core';
import { Clock } from '../clock/clock.service';
import { Database } from '../data/database';
import { Caregiver, ID } from '../models';
import { AuthService } from './auth.service';
import { CaregiverAccessBlock, caregiverAccessBlock } from './caregiver-access';
import { CaregiverSessionStore } from './caregiver-session.store';

export type CaregiverSignInOutcome =
  { status: 'ok'; caregiver: Caregiver } | { status: 'denied'; reason: CaregiverAccessBlock };

/**
 * Entrada do cuidador no aplicativo (docs/10, "Entrada"). Não há senha nem segundo fator: a pessoa escolhe um
 * cadastro de demonstração (ou acabou de criar o seu). A sessão fica em `sessionStorage`, na chave
 * `nexus-erp:caregiver-session`, separada da sessão da equipe, e fecha com a aba.
 *
 * Uma sessão por vez: entrar como cuidador encerra a sessão da equipe (com o log de troca de perfil) e entrar
 * como equipe encerra a do cuidador (`AuthService.selectProfile`). Cadastro encerrado, anonimizado ou eliminado
 * não entra. O log de auditoria registra o acesso da equipe; o cuidador não gera linha do próprio dado.
 *
 * ```ts
 * const session = inject(CaregiverSessionService);
 * session.signIn('cg_0001');      // { status: 'ok', caregiver } ou { status: 'denied', reason }
 * session.isSignedIn();           // signal
 * session.signOut();
 * ```
 */
@Injectable({ providedIn: 'root' })
export class CaregiverSessionService {
  private readonly db = inject(Database);
  private readonly store = inject(CaregiverSessionStore);
  private readonly auth = inject(AuthService);
  private readonly clock = inject(Clock);

  /** Id do cuidador com sessão aberta (ou `null`). Sessão de cadastro que deixou de poder entrar conta como `null`. */
  readonly caregiverId = this.store.caregiverId;
  readonly caregiver = this.store.caregiver;
  readonly isSignedIn = this.store.isSignedIn;

  private readonly endedByUser = signal(false);
  /** `true` logo depois de a pessoa sair ('Você saiu. Até a próxima.' na entrada); volta a `false` ao entrar. */
  readonly justSignedOut = this.endedByUser.asReadonly();

  /** Entra como o cuidador. Recusa cadastro inexistente, encerrado, anonimizado ou eliminado. */
  signIn(caregiverId: ID): CaregiverSignInOutcome {
    const caregiver = this.db.caregivers.get(caregiverId);
    const block = caregiverAccessBlock(caregiver);
    if (block !== null || !caregiver) {
      return { status: 'denied', reason: block ?? 'unknown' };
    }
    if (this.auth.session()) {
      // Nunca duas sessões ao mesmo tempo: a da equipe sai primeiro (e grava o logout, se havia).
      this.auth.logout('switch_profile');
    }
    this.store.set({ caregiverId: caregiver.id, startedAt: this.clock.realNow() });
    this.endedByUser.set(false);
    return { status: 'ok', caregiver };
  }

  /** Sai do aplicativo. A sessão da equipe, se houver, não é tocada. */
  signOut(): void {
    this.store.clear();
    this.endedByUser.set(true);
  }
}
