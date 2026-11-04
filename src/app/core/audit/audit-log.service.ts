import { Injectable, inject } from '@angular/core';
import { SessionStore } from '../auth/session.store';
import { Clock } from '../clock/clock.service';
import { compareDates, dateOf } from '../clock/date-utils';
import { Database } from '../data/database';
import { AccessAction, AccessLogEntry, ID, ISODate, Role } from '../models';

/** Lançada quando uma ação que exige justificativa chega sem ela (supervisão e "revelar"). */
export class JustificationRequiredError extends Error {
  constructor(action: AccessAction) {
    super(`A ação "${action}" exige justificativa.`);
    this.name = 'JustificationRequiredError';
  }
}

export interface AuditActor {
  userId: ID;
  role: Role;
}

export interface AuditEntryInput {
  action: AccessAction;
  /** Nome da entidade ou da rota (`zarit_assessment`, `caregiver`, `route`). */
  entity: string;
  entityId?: ID;
  /** Titular afetado (id do cuidador). */
  subjectCaregiverId?: ID;
  justification?: string;
  /** Texto curto SEM conteúdo clínico (LP-16). */
  detail?: string;
  /** Ator explícito (login, logout, negação antes de haver sessão). Sem ele, usa a sessão atual. */
  actor?: AuditActor;
}

export interface AuditFilter {
  userId?: ID;
  role?: Role;
  action?: AccessAction;
  entity?: string;
  subjectCaregiverId?: ID;
  /** Data inicial (inclusive). */
  from?: ISODate;
  /** Data final (inclusive). */
  to?: ISODate;
  /** Busca no detalhe, na justificativa e na entidade. */
  text?: string;
}

/**
 * Log de auditoria (AC-GL-10, RN-LGPD-12, LP-14 a LP-16). Cada linha: perfil, usuário, ação, entidade,
 * id, titular afetado, justificativa e instante (do `Clock`). APPEND-ONLY: não existe editar nem apagar.
 *
 * Gere linha em: login e logout; acesso a dado sensível (`view`, `create`, `update`, `delete`, `export`,
 * `print`, `reveal`); supervisão (`supervise`, exige justificativa); negações (`denied`).
 */
@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly session = inject(SessionStore);

  /** Grava uma linha. Devolve `null` se não há ator (ninguém logado e nenhum informado). */
  record(input: AuditEntryInput): AccessLogEntry | null {
    const actor = input.actor ?? this.currentActor();
    if (!actor) {
      return null;
    }
    const entry: Omit<AccessLogEntry, 'id' | 'createdAt' | 'updatedAt'> = {
      at: this.clock.now(),
      userId: actor.userId,
      role: actor.role,
      action: input.action,
      entity: input.entity,
      ...(input.entityId !== undefined ? { entityId: input.entityId } : {}),
      ...(input.subjectCaregiverId !== undefined
        ? { subjectCaregiverId: input.subjectCaregiverId }
        : {}),
      ...(input.justification !== undefined ? { justification: input.justification } : {}),
      ...(input.detail !== undefined ? { detail: input.detail } : {}),
    };
    return this.db.accessLog.append(entry);
  }

  // ===== Atalhos por tipo de evento =====

  login(actor: AuditActor, detail?: string): AccessLogEntry | null {
    return this.record({
      action: 'login',
      entity: 'session',
      actor,
      ...(detail ? { detail } : {}),
    });
  }

  logout(actor: AuditActor, detail?: string): AccessLogEntry | null {
    return this.record({
      action: 'logout',
      entity: 'session',
      actor,
      ...(detail ? { detail } : {}),
    });
  }

  /** Acesso negado (AC-GL-04, AC-M01-06). Não revela se o recurso existe: guarda só a rota pedida. */
  denied(entity: string, detail?: string, actor?: AuditActor): AccessLogEntry | null {
    return this.record({
      action: 'denied',
      entity,
      ...(detail ? { detail } : {}),
      ...(actor ? { actor } : {}),
    });
  }

  /** Leitura de dado sensível (Zarit, alertas, ARBE, anotações, ocorrências, bem-estar). */
  view(
    entity: string,
    entityId?: ID,
    subjectCaregiverId?: ID,
    detail?: string,
  ): AccessLogEntry | null {
    return this.record({
      action: 'view',
      entity,
      ...(entityId ? { entityId } : {}),
      ...(subjectCaregiverId ? { subjectCaregiverId } : {}),
      ...(detail ? { detail } : {}),
    });
  }

  /** Supervisão do RT em caso que não é dele: exige justificativa (LP-14, M03-08). */
  supervise(
    entity: string,
    entityId: ID,
    subjectCaregiverId: ID | undefined,
    justification: string,
  ): AccessLogEntry | null {
    this.requireJustification('supervise', justification);
    return this.record({
      action: 'supervise',
      entity,
      entityId,
      ...(subjectCaregiverId ? { subjectCaregiverId } : {}),
      justification: justification.trim(),
    });
  }

  /** "Mostrar" um dado mascarado: exige perfil autorizado e justificativa (LP-07, RN-LGPD-26). */
  reveal(
    entity: string,
    entityId: ID,
    field: string,
    subjectCaregiverId: ID | undefined,
    justification: string,
  ): AccessLogEntry | null {
    this.requireJustification('reveal', justification);
    return this.record({
      action: 'reveal',
      entity,
      entityId,
      ...(subjectCaregiverId ? { subjectCaregiverId } : {}),
      justification: justification.trim(),
      detail: `campo: ${field}`,
    });
  }

  /** Gravação sensível (`create`, `update`, `delete`). */
  write(
    action: 'create' | 'update' | 'delete',
    entity: string,
    entityId?: ID,
    subjectCaregiverId?: ID,
    detail?: string,
  ): AccessLogEntry | null {
    return this.record({
      action,
      entity,
      ...(entityId ? { entityId } : {}),
      ...(subjectCaregiverId ? { subjectCaregiverId } : {}),
      ...(detail ? { detail } : {}),
    });
  }

  exported(entity: string, subjectCaregiverId?: ID, detail?: string): AccessLogEntry | null {
    return this.record({
      action: 'export',
      entity,
      ...(subjectCaregiverId ? { subjectCaregiverId } : {}),
      ...(detail ? { detail } : {}),
    });
  }

  printed(entity: string, entityId?: ID, subjectCaregiverId?: ID): AccessLogEntry | null {
    return this.record({
      action: 'print',
      entity,
      ...(entityId ? { entityId } : {}),
      ...(subjectCaregiverId ? { subjectCaregiverId } : {}),
    });
  }

  // ===== Consulta =====

  /** Consulta com filtros (usuário, perfil, ação, entidade, titular, período, texto). Mais recentes primeiro. */
  query(filter: AuditFilter = {}): AccessLogEntry[] {
    const text = filter.text?.trim().toLowerCase();
    return this.db.accessLog
      .query((e) => {
        if (filter.userId && e.userId !== filter.userId) {
          return false;
        }
        if (filter.role && e.role !== filter.role) {
          return false;
        }
        if (filter.action && e.action !== filter.action) {
          return false;
        }
        if (filter.entity && e.entity !== filter.entity) {
          return false;
        }
        if (filter.subjectCaregiverId && e.subjectCaregiverId !== filter.subjectCaregiverId) {
          return false;
        }
        const day = dateOf(e.at);
        if (filter.from && compareDates(day, filter.from) < 0) {
          return false;
        }
        if (filter.to && compareDates(day, filter.to) > 0) {
          return false;
        }
        if (text) {
          const haystack = `${e.entity} ${e.detail ?? ''} ${e.justification ?? ''}`.toLowerCase();
          return haystack.includes(text);
        }
        return true;
      })
      .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : b.id.localeCompare(a.id)));
  }

  /** Contagem por ação (painel do log). */
  countByAction(
    entries: readonly AccessLogEntry[] = this.db.accessLog.list(),
  ): Record<AccessAction, number> {
    const result: Record<AccessAction, number> = {
      login: 0,
      logout: 0,
      view: 0,
      create: 0,
      update: 0,
      delete: 0,
      export: 0,
      print: 0,
      reveal: 0,
      denied: 0,
      supervise: 0,
    };
    entries.forEach((e) => {
      result[e.action] += 1;
    });
    return result;
  }

  /**
   * CSV do log SEM conteúdo clínico (LP-16): o titular aparece pelo código pseudonimizado.
   * Separador `;` (Excel pt-BR), aspas duplicadas nos textos.
   */
  toCsv(entries: readonly AccessLogEntry[]): string {
    const header = [
      'data_hora',
      'usuario',
      'perfil',
      'acao',
      'entidade',
      'id',
      'titular',
      'justificativa',
      'detalhe',
    ];
    const lines = entries.map((e) => {
      const subject = e.subjectCaregiverId
        ? (this.db.caregivers.get(e.subjectCaregiverId)?.code ?? '')
        : '';
      // O id de um cuidador também sai pelo código pseudonimizado.
      const entityId = e.entityId ? (this.db.caregivers.get(e.entityId)?.code ?? e.entityId) : '';
      return [
        e.at,
        e.userId,
        e.role,
        e.action,
        e.entity,
        entityId,
        subject,
        e.justification ?? '',
        e.detail ?? '',
      ]
        .map((cell) => csvCell(String(cell)))
        .join(';');
    });
    return [header.join(';'), ...lines].join('\n');
  }

  // ===== Internos =====

  private currentActor(): AuditActor | null {
    const actor = this.session.actor();
    return actor ? { userId: actor.userId, role: actor.role } : null;
  }

  private requireJustification(action: AccessAction, justification: string): void {
    if (!justification || justification.trim().length < 3) {
      throw new JustificationRequiredError(action);
    }
  }
}

/** Escapa uma célula de CSV; neutraliza fórmulas de planilha (`=`, `+`, `-`, `@`) no início. */
export function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[;"\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
