import { Injectable, inject, signal } from '@angular/core';
import { SessionStore } from '../auth/session.store';
import { Clock } from '../clock/clock.service';
import { minutesBetween } from '../clock/date-utils';
import { formatTime } from '../format/format';
import { ID, ISODateTime } from '../models';
import { StorageService } from '../storage/storage.service';
import { AuditLogService } from './audit-log.service';

/** Motivos prontos de supervisão (UX 6.5): reduzem o clique e evitam justificativas inúteis. */
export const SUPERVISION_REASONS: readonly string[] = [
  'Supervisão de caso com alerta',
  'Revisão de ocorrência',
  'Pedido de revisão do cuidador',
  'Auditoria de qualidade',
];
export const SUPERVISION_OTHER = 'Outro (descreva)';
/** A justificativa vale 30 minutos por caso e por sessão (U-13). */
export const SUPERVISION_WINDOW_MINUTES = 30;
/** Mínimo de caracteres do motivo "Outro" (UX 6.5). */
export const SUPERVISION_OTHER_MIN_CHARS = 10;

interface SupervisionGrant {
  reason: string;
  /** Quando foi registrada, no horário do sistema (relógio simulado, se houver). */
  at: ISODateTime;
}

/** Nome do item em `sessionStorage`: some ao fechar a aba, como a sessão (AC-M01-04). */
const STORAGE_NAME = 'supervision-grants';

/**
 * Janela de supervisão do responsável técnico (F16, LP-14, U-13). É o ÚNICO serviço de supervisão do ERP:
 * abrir um caso que não é dele exige um motivo; o motivo vale 30 minutos para aquele caso nesta sessão (conta
 * pelo relógio do sistema, então o relógio simulado do M15 permite testar a expiração), mas CADA abertura
 * continua gerando uma linha `supervise` no log com o mesmo motivo. A janela fica só na sessão da aba
 * (sobrevive a recarregar a página e some ao trocar de usuário ou fechar a aba).
 *
 * ```ts
 * if (supervision.access('zarit_alert', alert.id, alert.caregiverId) === 'needs_reason') { ...mostra o portão... }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class SupervisionWindowService {
  private readonly clock = inject(Clock);
  private readonly audit = inject(AuditLogService);
  private readonly session = inject(SessionStore);
  private readonly storage = inject(StorageService);

  /** Concessões por `usuário:sessão:caso`. Em signal para que telas reajam à liberação. */
  private readonly windows = signal<Readonly<Record<string, SupervisionGrant>>>(
    this.storage.readSession<Record<string, SupervisionGrant>>(STORAGE_NAME, {}),
  );

  /** O motivo vale agora para este caso? */
  isOpen(caseId: ID): boolean {
    const found = this.windows()[this.keyOf(caseId)];
    return (
      found !== undefined && minutesBetween(found.at, this.clock.now()) <= SUPERVISION_WINDOW_MINUTES
    );
  }

  /** Motivo e horário da supervisão registrada (para a faixa discreta "Supervisão registrada às 10:15"). */
  current(caseId: ID): { reason: string; at: ISODateTime } | null {
    return this.isOpen(caseId) ? (this.windows()[this.keyOf(caseId)] ?? null) : null;
  }

  /** Motivo vigente e a hora para exibir, ou `null` sem janela aberta. */
  info(caseId: ID): { reason: string; atLabel: string } | null {
    const found = this.current(caseId);
    return found ? { reason: found.reason, atLabel: formatTime(found.at) } : null;
  }

  /**
   * Abertura de um registro do caso. Com a janela aberta, grava `supervise` com o motivo guardado e devolve
   * `open`; sem ela, devolve `needs_reason` e nada é lido.
   */
  access(entity: string, entityId: ID, caseId: ID): 'open' | 'needs_reason' {
    const found = this.current(caseId);
    if (!found) {
      return 'needs_reason';
    }
    this.audit.supervise(entity, entityId, caseId, found.reason);
    return 'open';
  }

  /** Registra o motivo (e a primeira abertura) e abre a janela de 30 minutos para o caso. */
  grant(entity: string, entityId: ID, caseId: ID, reason: string): void {
    const clean = reason.trim();
    this.audit.supervise(entity, entityId, caseId, clean);
    const now = this.clock.now();
    const next: Record<string, SupervisionGrant> = {};
    // Descarta o que já venceu, para o item da aba não crescer sem fim.
    Object.entries(this.windows()).forEach(([key, grant]) => {
      if (minutesBetween(grant.at, now) <= SUPERVISION_WINDOW_MINUTES) {
        next[key] = grant;
      }
    });
    next[this.keyOf(caseId)] = { reason: clean, at: now };
    this.windows.set(next);
    this.storage.writeSession(STORAGE_NAME, next);
  }

  /** Motivo válido? Os prontos valem; "Outro" exige ao menos 10 caracteres. */
  static isValidReason(choice: string | null, other: string): boolean {
    if (!choice) {
      return false;
    }
    return choice === SUPERVISION_OTHER ? other.trim().length >= SUPERVISION_OTHER_MIN_CHARS : true;
  }

  private keyOf(caseId: ID): string {
    const session = this.session.session();
    return `${session?.userId ?? 'anon'}:${session?.startedAt ?? ''}:${caseId}`;
  }
}
