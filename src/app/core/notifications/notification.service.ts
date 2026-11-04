import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { ModuleKey } from '../auth/module-map';
import { Clock } from '../clock/clock.service';
import { Database } from '../data/database';
import { NotificationDraft, NotificationGroup, generateNotifications } from './notification-rules';

/** Notificação como a tela mostra: o rascunho da regra mais o estado "vista". */
export interface NotificationItem extends NotificationDraft {
  seen: boolean;
}

export interface NavCounter {
  count: number;
  /** Texto para leitor de tela ("3 mensagens atrasadas"). */
  label: string;
}

const NAV_LABELS: Partial<Record<ModuleKey, (n: number) => string>> = {
  zarit: (n) => `${n} ${n === 1 ? 'contato pendente' : 'contatos pendentes'} hoje`,
  messages: (n) => `${n} ${n === 1 ? 'mensagem atrasada' : 'mensagens atrasadas'}`,
  privacy: (n) =>
    `${n} ${n === 1 ? 'solicitação do titular vencendo' : 'solicitações do titular vencendo'}`,
};

/**
 * Notificações do sino (M02, SCR-M02-03). Pendência gerada por regra a partir do banco, por perfil e
 * usuário, que some sozinha quando a causa some. As regras estão em `notification-rules.ts`.
 *
 * - `items()`: o que o usuário atual tem, na ordem do sino (ação hoje primeiro).
 * - Lidas e não lidas ficam gravadas no banco (`db.notifications`), por usuário: marcar como vista grava
 *   um registro `seen` com a chave da pendência; quando a causa some, o registro vira `resolved`.
 * - O texto descreve a TAREFA. Nunca escore, faixa ou condição (U-03).
 *
 * ```ts
 * const notifications = inject(NotificationService);
 * notifications.unreadCount();        // número do sino
 * notifications.markSeen(item.key);   // "Marcar como vista"
 * notifications.counterFor('messages'); // contador do menu lateral
 * ```
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly db = inject(Database);
  private readonly auth = inject(AuthService);
  private readonly clock = inject(Clock);

  private readonly announcementSignal = signal('');
  /** Texto para a região `aria-live` quando uma pendência é resolvida ("Pendência resolvida"). */
  readonly announcement = this.announcementSignal.asReadonly();

  /** Pendências do usuário atual com o estado "vista". Vazio sem sessão. */
  readonly items = computed<readonly NotificationItem[]>(() => {
    const actor = this.auth.actor();
    if (!actor || !this.auth.isAuthenticated()) {
      return [];
    }
    const drafts = generateNotifications({
      db: this.db,
      actor,
      now: this.clock.now(),
      today: this.clock.today(),
    });
    const seen = new Set(
      this.db.notifications
        .query((n) => n.userId === actor.userId && n.status === 'seen')
        .map((n) => n.kind),
    );
    return drafts.map((d) => ({ ...d, seen: seen.has(d.key) }));
  });

  /** Número do sino: pendências ainda não vistas. */
  readonly unreadCount = computed(() => this.items().filter((i) => !i.seen).length);

  /** "Precisa de ação hoje" (não vistas e vistas), na ordem do sino. */
  readonly actionToday = computed(() => this.byGroup('action_today'));
  /** "Para acompanhar". */
  readonly toFollow = computed(() => this.byGroup('to_follow'));
  /** "Vistas" (grupo recolhido do painel). */
  readonly seenItems = computed(() => this.items().filter((i) => i.seen));

  /** Contadores do menu lateral, só onde há ação (UX 3.2): por módulo. */
  readonly navCounters = computed(() => {
    const counters: Partial<Record<ModuleKey, NavCounter>> = {};
    this.items().forEach((item) => {
      if (!item.navModule || item.seen) {
        return;
      }
      const label = NAV_LABELS[item.navModule];
      const count = (counters[item.navModule]?.count ?? 0) + item.count;
      counters[item.navModule] = { count, label: label ? label(count) : String(count) };
    });
    return counters;
  });

  counterFor(module: ModuleKey): NavCounter | null {
    return this.navCounters()[module] ?? null;
  }

  /** "Marcar como vista": grava (ou atualiza) o registro do usuário. */
  markSeen(key: string): void {
    const actor = this.auth.actor();
    const item = this.items().find((i) => i.key === key);
    if (!actor || !item || item.seen) {
      return;
    }
    this.writeSeen(actor.userId, actor.role, item);
    this.reconcile();
  }

  /** "Marcar todas como vistas". */
  markAllSeen(): void {
    const actor = this.auth.actor();
    if (!actor) {
      return;
    }
    this.items()
      .filter((i) => !i.seen)
      .forEach((item) => this.writeSeen(actor.userId, actor.role, item));
    this.reconcile();
  }

  /**
   * Marca como `resolved` os registros "vistos" cuja causa sumiu e avisa o leitor de tela. Chame ao abrir o
   * painel; é chamado também depois de cada "marcar como vista".
   */
  reconcile(): void {
    const actor = this.auth.actor();
    if (!actor) {
      return;
    }
    const live = new Set(this.items().map((i) => i.key));
    const stale = this.db.notifications.query(
      (n) => n.userId === actor.userId && n.status === 'seen' && !live.has(n.kind),
    );
    if (stale.length === 0) {
      return;
    }
    this.db.notifications.updateWhere(
      (n) => n.userId === actor.userId && n.status === 'seen' && !live.has(n.kind),
      { status: 'resolved' },
    );
    this.announcementSignal.set(
      stale.length === 1 ? 'Pendência resolvida.' : `${stale.length} pendências resolvidas.`,
    );
  }

  private byGroup(group: NotificationGroup): NotificationItem[] {
    return this.items().filter((i) => i.group === group);
  }

  private writeSeen(userId: string, role: string, item: NotificationItem): void {
    const existing = this.db.notifications.find((n) => n.userId === userId && n.kind === item.key);
    if (existing) {
      this.db.notifications.update(existing.id, {
        status: 'seen',
        title: item.title,
        at: this.clock.now(),
      });
      return;
    }
    this.db.notifications.create({
      role,
      userId,
      kind: item.key,
      title: item.title,
      status: 'seen',
      link: item.link,
      at: this.clock.now(),
    });
  }
}
