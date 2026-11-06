import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject } from '@angular/core';
import { Clock, dateOf, daysBetween } from '@core/clock';
import { Database } from '@core/data';
import { downloadTextFile } from '@core/export/file-download';
import { formatDate } from '@core/format';
import { ConsentEvent, ConsentKey, ConsentStatus, DataSubjectRequest } from '@core/models';
import { ConsentService, DataSubjectRequestService } from '@core/privacy';
import { SubjectRightsService, SelfRequestType } from '@core/privacy/subject-rights.service';
import { CaregiverContextService } from '../../state/caregiver-context.service';
import { dayMonth } from '../../state/day-format';
import {
  CONSENT_NAMES,
  CONSENT_ORDER,
  REQUEST_NAMES,
  consentStateText,
  daysLeftText,
} from './privacy-copy';

/** Uma autorização como a tela mostra: nome, estado em texto (e a data) e o que se pode fazer com ela. */
export interface ConsentItem {
  key: ConsentKey;
  name: string;
  status: ConsentStatus;
  stateText: string;
  /** Data de quando a pessoa decidiu ("04/11"), se já decidiu. */
  since: string | null;
  /** Pode autorizar (ainda não decidiu, recusou ou retirou). */
  canGrant: boolean;
  /** Pode dizer "não autorizo" (só quem ainda não decidiu). */
  canRefuse: boolean;
  /** Pode retirar (está autorizado). */
  canRevoke: boolean;
  /** O botão de autorizar de novo se chama assim quando a pessoa já tinha decidido. */
  grantLabel: string;
}

export interface HistoryEntry {
  id: string;
  label: string;
  date: string;
  termVersion: string;
}

export interface RequestItem {
  id: string;
  protocol: string;
  name: string;
  /** "Pedido feito em 04/11." (o código interno do pedido não aparece na tela, CXC-009). */
  madeText: string;
  /** "Faltam 12 dias", "Concluído em 19/11/2026", "Pedido retirado por você." ou o motivo da equipe. */
  statusText: string;
  /** Aberto ou em andamento: pode retirar o pedido. */
  pending: boolean;
  /** Cópia pronta: dá para baixar o arquivo. */
  canDownload: boolean;
  /** Eliminação concluída: o que ficou guardado, com o prazo. */
  keptText: string | null;
  type: DataSubjectRequest['type'];
}

export interface SharedWithItem {
  id: string;
  name: string;
  dateLabel: string;
}

export interface PolicyView {
  version: string;
  paragraphs: string[];
  dpoName: string;
  dpoEmail: string;
}

export type PrivacyActionResult = { ok: true } | { ok: false; error: string; duplicateOf?: string };

/**
 * A tela "Privacidade e meus dados" (UX C21, B11, B12; RN-USR-15 a 17, RN-LGPD-04, 05, 14, 18 a 21, 23 a 25).
 * Lê e grava SÓ pelo núcleo: `ConsentService` (cada autorização é independente e gera o evento), `SubjectRightsService`
 * (pedir cópia, eliminação e retirar o pedido) e `DataSubjectRequestService` (arquivo do titular). A tela não recalcula
 * regra: dias restantes vêm do `Clock`, o pedido repetido é devolvido pelo serviço.
 */
@Injectable({ providedIn: 'root' })
export class PrivacyService {
  private readonly ctx = inject(CaregiverContextService);
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly doc = inject(DOCUMENT);
  private readonly consents = inject(ConsentService);
  private readonly rights = inject(SubjectRightsService);
  private readonly dsr = inject(DataSubjectRequestService);

  // ===== Autorizações =====

  /** As autorizações na ordem fixa. A do piloto só aparece para quem já decidiu sobre ela. */
  readonly items = computed<ConsentItem[]>(() => {
    const views = this.ctx.consents();
    const id = this.ctx.caregiverId();
    return CONSENT_ORDER.flatMap((key) => {
      const view = views.find((v) => v.key === key);
      const status = view?.status ?? 'pending';
      if (key === 'pilot_tcle' && status === 'pending' && !this.ctx.caregiver()?.isPilot) {
        return [];
      }
      const since = id ? this.sinceOf(id, key) : null;
      const grantable = key !== 'pilot_tcle' && status !== 'granted';
      return [
        {
          key,
          name: CONSENT_NAMES[key],
          status,
          stateText: consentStateText(status, status === 'granted' || status === 'revoked' ? since : null),
          since,
          canGrant: grantable,
          canRefuse: grantable && status === 'pending',
          canRevoke: status === 'granted',
          grantLabel: status === 'pending' ? 'Autorizar' : 'Autorizar de novo',
        },
      ];
    });
  });

  /** O histórico de uma autorização: autorizou, retirou, autorizou de novo. Só leitura (não se edita nem se apaga). */
  historyOf(key: ConsentKey): HistoryEntry[] {
    const id = this.ctx.caregiverId();
    return id ? this.consents.history(id, key).map((e) => this.toEntry(e)) : [];
  }

  grant(key: ConsentKey): PrivacyActionResult {
    return this.change(() => this.consents.grant(this.ctx.requireCaregiverId(), key, this.options()));
  }

  refuse(key: ConsentKey): PrivacyActionResult {
    return this.change(() => this.consents.refuse(this.ctx.requireCaregiverId(), key, this.options()));
  }

  revoke(key: ConsentKey): PrivacyActionResult {
    return this.change(() => this.consents.revoke(this.ctx.requireCaregiverId(), key, this.options()));
  }

  // ===== Pedidos =====

  /** Todos os pedidos da pessoa, o mais recente primeiro. */
  readonly requests = computed<RequestItem[]>(() => {
    const id = this.ctx.caregiverId();
    // O pedido de revisão de uma decisão aparece em Como estou, não aqui (UX C21, "Por pessoa").
    return id
      ? this.rights
          .requestsOf(id)
          .filter((r) => r.type !== 'decision_review')
          .map((r) => this.toRequest(r))
      : [];
  });

  /** O pedido em andamento de um tipo, para dizer "Você já tem um pedido ... em andamento (DSR-0006)". */
  pendingOf(type: SelfRequestType): RequestItem | null {
    const found = this.requests().find((r) => r.type === type && r.pending);
    return found ?? null;
  }

  requestCopy(): PrivacyActionResult {
    return this.open((id) => this.rights.requestCopy(id));
  }

  requestErasure(): PrivacyActionResult {
    return this.open((id) => this.rights.requestErasure(id));
  }

  withdraw(requestId: string): PrivacyActionResult {
    try {
      const result = this.rights.withdraw(this.ctx.requireCaregiverId(), requestId);
      return result.ok ? { ok: true } : { ok: false, error: 'Este pedido não pode mais ser retirado.' };
    } catch {
      return { ok: false, error: 'Não foi possível retirar o pedido. Tente de novo; se continuar, fale com a gente.' };
    }
  }

  /** Baixa o arquivo da cópia pronta. `false` se o navegador não deixou. */
  download(): boolean {
    const caregiver = this.ctx.requireCaregiver();
    const json = this.dsr.exportSubjectJson(caregiver.id);
    return downloadTextFile(this.doc, `meus-dados-${caregiver.code}-${this.clock.today()}.json`, json);
  }

  // ===== Com quem compartilhamos =====

  /** Os profissionais para quem o cuidador fez um pedido de serviço (RN-LGPD-13, RN-REDE-17): nome e data. */
  readonly sharedWith = computed<SharedWithItem[]>(() => {
    const id = this.ctx.caregiverId();
    if (!id) {
      return [];
    }
    return this.db.serviceRequests
      .query((r) => r.caregiverId === id)
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
      .map((r) => ({
        id: r.id,
        name: this.db.providers.get(r.providerId)?.name ?? 'Profissional da rede',
        dateLabel: formatDate(dateOf(r.requestedAt)),
      }));
  });

  // ===== Política =====

  readonly policy = computed<PolicyView | null>(() => {
    const doc = this.db.privacyDocuments.find((d) => d.kind === 'privacy_policy');
    if (!doc) {
      return null;
    }
    return {
      version: doc.version,
      paragraphs: doc.body.split(/\n{2,}/).filter((p) => p.trim().length > 0),
      dpoName: doc.dpoName,
      dpoEmail: doc.dpoEmail,
    };
  });

  // ===== Internos =====

  private options(): { channel: 'app'; registeredByUserId: string } {
    return { channel: 'app', registeredByUserId: this.ctx.requireCaregiverId() };
  }

  private change(run: () => unknown): PrivacyActionResult {
    try {
      run();
      return { ok: true };
    } catch {
      return { ok: false, error: 'Não foi possível registrar. Tente de novo; se continuar, fale com a gente.' };
    }
  }

  private open(
    run: (caregiverId: string) => ReturnType<SubjectRightsService['requestCopy']>,
  ): PrivacyActionResult {
    try {
      const result = run(this.ctx.requireCaregiverId());
      if (result.ok) {
        return { ok: true };
      }
      if (result.reason === 'duplicate') {
        return { ok: false, error: 'duplicate', duplicateOf: result.existing.protocol };
      }
      return { ok: false, error: 'Não foi possível registrar o pedido. Tente de novo; se continuar, fale com a gente.' };
    } catch {
      return { ok: false, error: 'Não foi possível registrar o pedido. Tente de novo; se continuar, fale com a gente.' };
    }
  }

  /** A data do último evento de decisão ("04/11"). */
  private sinceOf(caregiverId: string, key: ConsentKey): string | null {
    const last = this.consents.history(caregiverId, key).at(-1);
    return last ? dayMonth(dateOf(last.at)) : null;
  }

  private toEntry(event: ConsentEvent): HistoryEntry {
    const label =
      event.status === 'granted'
        ? 'Você autorizou'
        : event.status === 'revoked'
          ? 'Você retirou a autorização'
          : 'Você não autorizou';
    return { id: event.id, label, date: formatDate(dateOf(event.at)), termVersion: event.termVersion };
  }

  private toRequest(request: DataSubjectRequest): RequestItem {
    const today = this.clock.today();
    const pending = request.status === 'open' || request.status === 'in_progress';
    const withdrawn = this.rights.wasWithdrawn(request);
    let statusText: string;
    let keptText: string | null = null;
    if (pending) {
      statusText = daysLeftText(daysBetween(today, request.dueAt));
    } else if (request.status === 'completed') {
      statusText = `Concluído em ${formatDate(request.completedAt ?? request.dueAt)}`;
      keptText = request.type === 'erasure' ? (request.retentionBlockNote ?? null) : null;
    } else if (withdrawn) {
      statusText = 'Pedido retirado por você.';
    } else {
      statusText = `A equipe não pôde atender: ${request.rejectedReason ?? 'sem motivo informado'}`;
    }
    return {
      id: request.id,
      protocol: request.protocol,
      name: REQUEST_NAMES[request.type],
      madeText: `Pedido feito em ${dayMonth(request.openedAt)}.`,
      statusText,
      pending,
      canDownload: request.status === 'completed' && (request.type === 'access' || request.type === 'portability'),
      keptText,
      type: request.type,
    };
  }
}
