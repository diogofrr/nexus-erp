import { Injectable, inject, signal } from '@angular/core';
import { AuditLogService } from '@core/audit';
import { Clock } from '@core/clock';
import { formatTime } from '@core/format';
import type { ID, ISODateTime } from '@core/models';
import { StorageService } from '@core/storage';

/** Motivos prontos da supervisão (UX 6.5): evitam justificativas inúteis como "a" ou "ok". */
export const SUPERVISION_REASONS: readonly string[] = [
  'Supervisão de caso com alerta',
  'Revisão de ocorrência',
  'Pedido de revisão do cuidador',
  'Auditoria de qualidade',
];
export const SUPERVISION_OTHER = 'Outro (descreva)';
export const SUPERVISION_OTHER_MIN = 10;
/** A justificativa vale 30 minutos por caso, nesta sessão (U-13). */
export const SUPERVISION_WINDOW_MINUTES = 30;

interface Grant {
  reason: string;
  /** Instante REAL em que passa a valer de novo a pergunta (a simulação do relógio não mexe nisso). */
  untilMs: number;
  /** Quando foi registrada, em horário do sistema, para a faixa "Supervisão registrada às 10:15". */
  at: ISODateTime;
}

const STORAGE_NAME = 'supervision-grants';

/**
 * Portão de supervisão (PD-12, F16-A): o responsável técnico que abre caso de outro psicólogo informa um
 * motivo; ele vale 30 minutos para aquele caso nesta sessão, mas CADA abertura continua gerando log
 * `supervise` com o mesmo motivo (AC-M03-08). O motivo fica só na sessão da aba.
 */
@Injectable({ providedIn: 'root' })
export class SupervisionService {
  private readonly audit = inject(AuditLogService);
  private readonly clock = inject(Clock);
  private readonly storage = inject(StorageService);

  private readonly grants = signal<Readonly<Record<ID, Grant>>>(
    this.storage.readSession<Record<ID, Grant>>(STORAGE_NAME, {}),
  );

  /** Há justificativa vigente para o caso? */
  isGranted(caregiverId: ID): boolean {
    const grant = this.grants()[caregiverId];
    return !!grant && grant.untilMs > this.clock.realNowMs();
  }

  /** Motivo vigente e hora do registro, para a faixa discreta no caso. */
  info(caregiverId: ID): { reason: string; atLabel: string } | null {
    const grant = this.grants()[caregiverId];
    return grant && this.isGranted(caregiverId)
      ? { reason: grant.reason, atLabel: formatTime(grant.at) }
      : null;
  }

  /** Valida o motivo e abre a janela de 30 minutos. Lança sem motivo válido. O log sai em cada abertura (`record`). */
  grant(caregiverId: ID, choice: string, otherText = ''): void {
    const reason = choice === SUPERVISION_OTHER ? otherText.trim() : choice;
    if (!reason || (choice === SUPERVISION_OTHER && reason.length < SUPERVISION_OTHER_MIN)) {
      throw new Error(`Descreva o motivo com ao menos ${SUPERVISION_OTHER_MIN} caracteres.`);
    }
    const grant: Grant = {
      reason,
      untilMs: this.clock.realNowMs() + SUPERVISION_WINDOW_MINUTES * 60_000,
      at: this.clock.now(),
    };
    const next = { ...this.grants(), [caregiverId]: grant };
    this.grants.set(next);
    this.storage.writeSession(STORAGE_NAME, next);
  }

  /**
   * Cada abertura de conteúdo supervisionado grava `supervise` com o motivo vigente e a leitura (`view`),
   * como pede AC-M03-08 (log de leitura com perfil de supervisão).
   */
  record(caregiverId: ID, entity: string): void {
    const grant = this.grants()[caregiverId];
    if (grant && this.isGranted(caregiverId)) {
      this.audit.supervise(entity, caregiverId, caregiverId, grant.reason);
      this.audit.view(entity, caregiverId, caregiverId, 'leitura em supervisão');
    }
  }
}
