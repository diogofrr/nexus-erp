import { Injectable, inject } from '@angular/core';
import { AuditLogService } from '../audit/audit-log.service';
import { SessionStore } from '../auth/session.store';
import { Clock } from '../clock/clock.service';
import { Database } from '../data/database';
import { DataSubjectRequest, DsrType, ID, ISODate, ISODateTime } from '../models';
import {
  DsrDeadlineState,
  canRejectRequest,
  dsrDaysRemaining,
  dsrDeadlineLabel,
  dsrDeadlineState,
  dsrDueDate,
} from '../rules/lgpd';
import { RETENTION_BLOCK_NOTE, RetentionService } from './retention.service';

export class DataSubjectRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataSubjectRequestError';
  }
}

export interface DsrDeadline {
  state: DsrDeadlineState;
  daysRemaining: number;
  label: string;
}

/** Portabilidade: SOMENTE os dados do titular (AC-M03-13, LP-12). */
export interface SubjectExport {
  exportedAt: ISODateTime;
  format: 'nexus-erp/titular/1';
  subject: {
    code: string;
    caregiver: unknown;
    elder: unknown;
    consents: unknown[];
    consentEvents: unknown[];
    subscriptions: unknown[];
    benefitCards: unknown[];
    zaritAssessments: unknown[];
    serviceRequests: unknown[];
    messages: unknown[];
    dataSubjectRequests: unknown[];
  };
}

/**
 * Direitos do titular (RN-LGPD-20, 21; LP-17, LP-18; M12). Cada solicitação tem protocolo `DSR-0000`,
 * prazo de 15 dias corridos, contador, "vence em breve" nos últimos 3 dias e "vencida" depois.
 */
@Injectable({ providedIn: 'root' })
export class DataSubjectRequestService {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly audit = inject(AuditLogService);
  private readonly session = inject(SessionStore);
  private readonly retention = inject(RetentionService);

  // ===== Leitura =====

  list(): DataSubjectRequest[] {
    return [...this.db.dataSubjectRequests.list()].sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  }

  forCaregiver(caregiverId: ID): DataSubjectRequest[] {
    return this.db.dataSubjectRequests.query((r) => r.caregiverId === caregiverId);
  }

  /** Prazo calculado pelo relógio (`Clock`): estado, dias restantes e texto do contador. */
  deadline(request: DataSubjectRequest, today: ISODate = this.clock.today()): DsrDeadline {
    return {
      state: dsrDeadlineState(request, today, this.db.settings.get().dsrDueSoonDays),
      daysRemaining: dsrDaysRemaining(request, today),
      label: dsrDeadlineLabel(request, today),
    };
  }

  // ===== Fluxo =====

  /** Abre a solicitação: protocolo, prazo de 15 dias corridos e estado `open`. */
  open(input: { caregiverId: ID; type: DsrType; openedAt?: ISODate }): DataSubjectRequest {
    if (!this.db.caregivers.exists(input.caregiverId)) {
      throw new DataSubjectRequestError('Titular não encontrado.');
    }
    const openedAt = input.openedAt ?? this.clock.today();
    const request = this.db.dataSubjectRequests.create({
      protocol: this.nextProtocol(),
      caregiverId: input.caregiverId,
      type: input.type,
      status: 'open',
      openedAt,
      dueAt: dsrDueDate(openedAt, this.db.settings.get().dsrDeadlineDays),
    });
    this.audit.write(
      'create',
      'data_subject_request',
      request.id,
      input.caregiverId,
      request.protocol,
    );
    return request;
  }

  /** Começa a tratar. */
  start(id: ID): DataSubjectRequest {
    const request = this.requireOpenable(id);
    const userId = this.session.user()?.id;
    const updated = this.db.dataSubjectRequests.update(id, {
      status: 'in_progress',
      // Quem já está com o pedido continua com ele (CX-002).
      ...(userId && !request.handledByUserId ? { handledByUserId: userId } : {}),
    });
    this.audit.write('update', 'data_subject_request', id, request.caregiverId, 'em andamento');
    return updated;
  }

  /** Conclui, com a nota de resolução. */
  complete(
    id: ID,
    resolutionNote?: string,
    extra: { retentionBlockNote?: string } = {},
  ): DataSubjectRequest {
    const request = this.requireOpenable(id);
    const userId = this.session.user()?.id;
    // CX-002: quem conclui não troca o responsável. Sem responsável, quem conclui assume; com responsável
    // diferente, o pedido guarda os dois (`handledByUserId` e `completedByUserId`).
    const updated = this.db.dataSubjectRequests.update(id, {
      status: 'completed',
      completedAt: this.clock.today(),
      ...(userId && !request.handledByUserId ? { handledByUserId: userId } : {}),
      ...(userId && request.handledByUserId && request.handledByUserId !== userId
        ? { completedByUserId: userId }
        : {}),
      ...(resolutionNote ? { resolutionNote } : {}),
      ...(extra.retentionBlockNote ? { retentionBlockNote: extra.retentionBlockNote } : {}),
    });
    this.audit.write('update', 'data_subject_request', id, request.caregiverId, 'concluída');
    return updated;
  }

  /**
   * Desfaz uma conclusão feita há pouco (CX-003): volta a "em andamento", sem nota nem data de conclusão.
   * Só vale para pedidos concluídos que não executaram uma ação irreversível (eliminação, anonimização).
   */
  reopen(id: ID): DataSubjectRequest {
    const request = this.db.dataSubjectRequests.require(id);
    if (request.status !== 'completed') {
      throw new DataSubjectRequestError('Só dá para desfazer uma solicitação concluída.');
    }
    if (request.type === 'erasure' || request.type === 'anonymization_or_blocking') {
      throw new DataSubjectRequestError('Eliminação e anonimização não podem ser desfeitas.');
    }
    const updated = this.db.dataSubjectRequests.update(id, {
      status: 'in_progress',
      completedAt: undefined,
      resolutionNote: undefined,
      completedByUserId: undefined,
    });
    this.audit.write('update', 'data_subject_request', id, request.caregiverId, 'conclusão desfeita');
    return updated;
  }

  /** Rejeita. Exige motivo escrito (LP-18). */
  reject(id: ID, reason: string): DataSubjectRequest {
    if (!canRejectRequest(reason)) {
      throw new DataSubjectRequestError('Rejeitar uma solicitação exige o motivo por escrito.');
    }
    const request = this.requireOpenable(id);
    const updated = this.db.dataSubjectRequests.update(id, {
      status: 'rejected_with_reason',
      rejectedReason: reason.trim(),
      completedAt: this.clock.today(),
    });
    this.audit.write(
      'update',
      'data_subject_request',
      id,
      request.caregiverId,
      'rejeitada com motivo',
    );
    return updated;
  }

  /**
   * Atende um pedido de eliminação: apaga o que não é registro documental e BLOQUEIA o que é, e conclui
   * a solicitação informando motivo e prazo da retenção (RN-LGPD-24, AC-M12-04).
   */
  executeErasure(id: ID): DataSubjectRequest {
    const request = this.requireOpenable(id);
    if (request.type !== 'erasure') {
      throw new DataSubjectRequestError('Esta solicitação não é de eliminação.');
    }
    const result = this.retention.erase(request.caregiverId);
    const note = result.plan.note ?? undefined;
    return this.complete(
      id,
      `Eliminados ${result.erasedRecords} registro(s); ${result.blockedRecords} bloqueado(s) por registro documental.`,
      note ? { retentionBlockNote: note } : {},
    );
  }

  /** Atende um pedido de anonimização (irreversível, a interface confirma antes). */
  executeAnonymization(id: ID): DataSubjectRequest {
    const request = this.requireOpenable(id);
    if (request.type !== 'anonymization_or_blocking') {
      throw new DataSubjectRequestError('Esta solicitação não é de anonimização.');
    }
    this.retention.anonymize(request.caregiverId);
    return this.complete(
      id,
      'Identificadores substituídos pelo código do titular; agregados preservados.',
    );
  }

  // ===== Portabilidade e acesso =====

  /** Dados do titular, e de mais ninguém. Gera log `export`. */
  exportSubject(caregiverId: ID): SubjectExport {
    const caregiver = this.db.caregivers.require(caregiverId);
    const elder = this.db.elders.find((e) => e.caregiverId === caregiverId);
    const card = this.db.benefitCards.query((c) => c.caregiverId === caregiverId);
    const data: SubjectExport = {
      exportedAt: this.clock.now(),
      format: 'nexus-erp/titular/1',
      subject: {
        code: caregiver.code,
        caregiver,
        elder: elder ?? null,
        consents: this.db.consents.query((c) => c.caregiverId === caregiverId),
        consentEvents: this.db.consentEvents.query((e) => e.caregiverId === caregiverId),
        subscriptions: this.db.subscriptions.query((s) => s.caregiverId === caregiverId),
        benefitCards: card,
        zaritAssessments: this.db.zaritAssessments.query((z) => z.caregiverId === caregiverId),
        serviceRequests: this.db.serviceRequests.query((r) => r.caregiverId === caregiverId),
        messages: this.db.messages.query((m) => m.caregiverId === caregiverId),
        dataSubjectRequests: this.db.dataSubjectRequests.query(
          (r) => r.caregiverId === caregiverId,
        ),
      },
    };
    this.audit.exported('subject_portability', caregiverId, 'exportação do titular');
    return data;
  }

  /** JSON estruturado para baixar (portabilidade). */
  exportSubjectJson(caregiverId: ID): string {
    return JSON.stringify(this.exportSubject(caregiverId), null, 2);
  }

  /** Texto padrão do bloqueio por retenção, para telas e relatórios. */
  readonly retentionNote = RETENTION_BLOCK_NOTE;

  // ===== Internos =====

  private requireOpenable(id: ID): DataSubjectRequest {
    const request = this.db.dataSubjectRequests.require(id);
    if (request.status === 'completed' || request.status === 'rejected_with_reason') {
      throw new DataSubjectRequestError('Esta solicitação já foi encerrada.');
    }
    return request;
  }

  private nextProtocol(): string {
    const max = this.db.dataSubjectRequests
      .list()
      .reduce((acc, r) => Math.max(acc, Number(/(\d+)$/.exec(r.protocol)?.[1] ?? 0)), 0);
    return `DSR-${String(max + 1).padStart(4, '0')}`;
  }
}
