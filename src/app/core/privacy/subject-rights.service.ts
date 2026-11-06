import { Injectable, inject } from '@angular/core';
import { AuditLogService } from '../audit/audit-log.service';
import { CaregiverOwnership } from '../auth/caregiver-ownership';
import { Clock } from '../clock/clock.service';
import { Database } from '../data/database';
import { Channel, DataSubjectRequest, DsrType, ID } from '../models';
import { isConsentActive } from '../rules/lgpd';
import { DataSubjectRequestService } from './data-subject-request.service';

/** Os dois pedidos que o próprio titular faz pelo aplicativo: uma cópia dos dados e a eliminação (RN-LGPD-18, 20, 21). */
export type SelfRequestType = Extract<DsrType, 'access' | 'erasure'>;

export type SelfRequestResult =
  | { ok: true; request: DataSubjectRequest }
  | { ok: false; reason: 'duplicate'; existing: DataSubjectRequest }
  | { ok: false; reason: 'not_allowed' };

export const WITHDRAWN_BY_SUBJECT = 'Retirado pelo titular.';

/** Como a eliminação é pedida: o titular pelo aplicativo (padrão) ou a equipe em nome dele (CaregiverService.requestClosure). */
export interface ErasureOptions {
  /** Canal por onde o pedido chegou (padrão: o aplicativo). */
  channel?: Channel | 'in_person';
  /** O que o titular pediu, em palavras simples. */
  description?: string;
  /** Já havendo pedido de eliminação em andamento, reaproveita o pedido e leva o cadastro ao encerramento (a equipe faz assim). */
  reuseOpen?: boolean;
}

/**
 * Os pedidos do titular feitos por ele mesmo, pelo aplicativo do cuidador (M12, RN-LGPD-18, 20, 21, 24):
 * pedir uma cópia dos dados, pedir a eliminação e retirar o pedido enquanto a equipe não concluiu. Usa o
 * `DataSubjectRequestService` (protocolo `DSR-0000` e prazo de 15 dias corridos pelo `Clock`) e NÃO duplica o
 * tratamento: a equipe é quem conclui, e a eliminação nunca apaga na hora.
 *
 * - Um pedido aberto por tipo: pedir de novo devolve o que já existe (`duplicate`).
 * - Pedir a eliminação leva o cadastro a `closure_requested` e a pessoa continua usando o aplicativo; retirar o pedido
 *   devolve o cadastro ao estado de antes (`active`, ou `paused_by_consent_revocation` se a autorização de saúde
 *   continua retirada) e encerra o pedido como "retirado pelo titular". Nada é eliminado antes de a equipe concluir.
 * - Quem encerra o cadastro pela equipe (`CaregiverService.requestClosure`) usa este mesmo miolo, com
 *   `reuseOpen`: um pedido de eliminação aberto é reaproveitado em vez de devolver "já existe".
 */
@Injectable({ providedIn: 'root' })
export class SubjectRightsService {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly dsr = inject(DataSubjectRequestService);
  private readonly audit = inject(AuditLogService);
  private readonly ownership = inject(CaregiverOwnership);

  /** Todos os pedidos do titular, o mais recente primeiro. */
  requestsOf(caregiverId: ID): DataSubjectRequest[] {
    if (!this.ownership.ownsCaregiver(caregiverId)) {
      return [];
    }
    return this.dsr
      .forCaregiver(caregiverId)
      .sort((a, b) => b.openedAt.localeCompare(a.openedAt) || b.protocol.localeCompare(a.protocol));
  }

  /** O pedido em andamento de um tipo, se houver (aberto ou sendo tratado). */
  pendingOf(caregiverId: ID, type: DsrType): DataSubjectRequest | undefined {
    return this.requestsOf(caregiverId).find(
      (r) => r.type === type && (r.status === 'open' || r.status === 'in_progress'),
    );
  }

  /** Pede uma cópia dos dados (a equipe prepara o arquivo em até 15 dias corridos). */
  requestCopy(caregiverId: ID): SelfRequestResult {
    return this.open(caregiverId, 'access', 'Cópia dos dados pedida pelo aplicativo.', 'app');
  }

  /** Pede a eliminação dos dados: o cadastro vai a `closure_requested` (POP-10) e a pessoa continua usando o aplicativo. */
  requestErasure(caregiverId: ID, options: ErasureOptions = {}): SelfRequestResult {
    const opened = this.open(
      caregiverId,
      'erasure',
      options.description ?? 'Eliminação dos dados pedida pelo aplicativo (POP-10).',
      options.channel ?? 'app',
    );
    const outcome: SelfRequestResult =
      !opened.ok && opened.reason === 'duplicate' && options.reuseOpen
        ? { ok: true, request: opened.existing }
        : opened;
    if (!outcome.ok) {
      return outcome;
    }
    const caregiver = this.db.caregivers.require(caregiverId);
    if (caregiver.status !== 'closed' && caregiver.status !== 'closure_requested') {
      this.db.caregivers.update(caregiverId, {
        status: 'closure_requested',
        closureRequestedAt: this.clock.today(),
      });
      this.audit.write('update', 'caregiver', caregiverId, caregiverId, 'encerramento pedido (POP-10)');
    }
    return outcome;
  }

  /**
   * Retira o pedido enquanto a equipe não concluiu. O pedido é encerrado como "retirado pelo titular", sem efeito
   * nenhum nos dados, e o cadastro volta ao estado de antes se era só este pedido que o mantinha em encerramento.
   */
  withdraw(caregiverId: ID, requestId: ID): SelfRequestResult {
    if (!this.ownership.ownsCaregiver(caregiverId)) {
      return { ok: false, reason: 'not_allowed' };
    }
    const request = this.db.dataSubjectRequests.get(requestId);
    if (
      !request ||
      request.caregiverId !== caregiverId ||
      (request.status !== 'open' && request.status !== 'in_progress')
    ) {
      return { ok: false, reason: 'not_allowed' };
    }
    const updated = this.db.dataSubjectRequests.update(requestId, {
      status: 'rejected_with_reason',
      rejectedReason: WITHDRAWN_BY_SUBJECT,
      completedAt: this.clock.today(),
    });
    this.audit.write('update', 'data_subject_request', requestId, caregiverId, 'retirada pelo titular');
    if (request.type === 'erasure') {
      this.restoreAfterClosure(caregiverId);
    }
    return { ok: true, request: updated };
  }

  /** O pedido foi retirado pelo próprio titular (e não recusado pela equipe)? */
  wasWithdrawn(request: Pick<DataSubjectRequest, 'status' | 'rejectedReason'>): boolean {
    return request.status === 'rejected_with_reason' && request.rejectedReason === WITHDRAWN_BY_SUBJECT;
  }

  // ===== Internos =====

  private open(
    caregiverId: ID,
    type: SelfRequestType,
    description: string,
    channel: Channel | 'in_person',
  ): SelfRequestResult {
    const caregiver = this.db.caregivers.get(caregiverId);
    // Só se pede cópia ou eliminação dos dados da própria pessoa (QAC-001).
    if (
      !this.ownership.ownsCaregiver(caregiverId) ||
      !caregiver ||
      caregiver.status === 'closed' ||
      caregiver.erasedAt ||
      caregiver.anonymizedAt
    ) {
      return { ok: false, reason: 'not_allowed' };
    }
    const existing = this.pendingOf(caregiverId, type);
    if (existing) {
      return { ok: false, reason: 'duplicate', existing };
    }
    const opened = this.dsr.open({ caregiverId, type });
    const request = this.db.dataSubjectRequests.update(opened.id, { channel, description });
    return { ok: true, request };
  }

  private restoreAfterClosure(caregiverId: ID): void {
    const caregiver = this.db.caregivers.get(caregiverId);
    const stillPending = this.pendingOf(caregiverId, 'erasure');
    if (!caregiver || caregiver.status !== 'closure_requested' || stillPending) {
      return;
    }
    const health = this.db.consents.find((c) => c.caregiverId === caregiverId && c.key === 'health_data');
    const healthActive = health ? isConsentActive(health.status) : false;
    const wasRevoked = health?.status === 'revoked';
    this.db.caregivers.update(caregiverId, {
      status: healthActive || !wasRevoked ? 'active' : 'paused_by_consent_revocation',
      closureRequestedAt: undefined,
    });
    this.audit.write('update', 'caregiver', caregiverId, caregiverId, 'pedido de encerramento retirado');
  }
}
