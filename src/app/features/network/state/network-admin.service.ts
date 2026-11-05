import { Injectable, inject } from '@angular/core';
import { AuditLogService } from '@core/audit';
import { AuthService, canWriteSubArea } from '@core/auth';
import { Clock, addDays, daysBetween, weekday } from '@core/clock';
import { Database } from '@core/data';
import { formatDate } from '@core/format';
import {
  Accreditation,
  ArpBand,
  ChecklistKey,
  ChecklistStatus,
  GraveCategory,
  ID,
  InternalReview,
  ISODate,
  Provider,
  ProviderCategory,
  ProviderCouncil,
  ProviderDocument,
  ProviderEvaluation,
  ServiceRequest,
} from '@core/models';
import { NetworkService, ProviderSummary, ReevaluationOutcome } from '@core/network';
import {
  ACCREDITATION_CHECKLIST_KEYS,
  ApprovalCheck,
  CHECKLIST_LABELS,
  canActivateProvider,
  checkAccreditationApproval,
  evaluationEditableUntil,
  evaluationScore,
  isSearchable,
  shouldSuspendForExpiredDocument,
} from '@core/rules';
import { isValidRating, serviceRequestProblem } from '@core/rules/service-requests';
import { DOCUMENT_KIND_LABEL } from './network-labels';

export type Result<T = void> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = <T = void>(error: string): Result<T> => ({ ok: false, error });

/** Uma linha da auditoria quinzenal (prévia ou resultado). */
export interface AuditRow {
  summary: ProviderSummary;
  previousBand: ArpBand | null;
  nextBand: ArpBand;
  /** O que a auditoria faz com o prestador. */
  action: 'suspend' | 'suspend_document' | 'to_monitoring' | 'to_active' | 'none';
  /** Texto do motivo, quando suspende. */
  reason: string | null;
}

export interface AuditPreview {
  rows: AuditRow[];
  willSuspend: AuditRow[];
  /** Data da última auditoria gravada (qualquer dia). */
  lastAuditDate: ISODate | undefined;
  /** Já existe auditoria gravada hoje: rodar de novo pergunta se deve substituir. */
  alreadyRanToday: boolean;
}

export interface AuditResult {
  auditDate: ISODate;
  snapshots: number;
  suspended: string[];
  replaced: boolean;
}

export interface NewProcessInput {
  name: string;
  personType: Provider['personType'];
  category: ProviderCategory;
  specialtyLabel: string;
  council: ProviderCouncil;
  city: string;
  homeCare: boolean;
  conditionsForNexusUsers: string;
  email: string;
  phone: string;
}

export const COMPANY_ONLY_CATEGORIES: readonly ProviderCategory[] = [
  'pharmacy',
  'clinic',
  'home_care',
  'specialized_service',
];

/** Dias que o prestador tem para regularizar um documento vencido antes da suspensão (RN-REDE-22). */
export const DOCUMENT_GRACE = 30;

/**
 * Tudo o que a gestão grava na rede credenciada (M08): processo de credenciamento, documentos, ativação,
 * auditoria quinzenal, avaliação interna, solicitações e avaliações em nome do usuário. Cada método valida a
 * regra do documento, grava pelo `Database`, registra o histórico e devolve `Result` com a frase de erro pronta
 * para a tela. Quem pode o quê vem da matriz: `partner` grava tudo; `support` só registra solicitações e
 * avaliações (RN-CAN-05); `technical_lead` só valida o registro de psicólogos da rede.
 */
@Injectable({ providedIn: 'root' })
export class NetworkAdminService {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly auth = inject(AuthService);
  private readonly audit = inject(AuditLogService);
  private readonly network = inject(NetworkService);

  // ===== Quem pode o quê =====

  isManager(): boolean {
    return this.auth.hasRole('partner');
  }

  canRegisterRequests(): boolean {
    const role = this.auth.role();
    return this.isManager() || (role !== null && canWriteSubArea(role, 'network', 'service_requests'));
  }

  canRegisterEvaluations(): boolean {
    const role = this.auth.role();
    return this.isManager() || (role !== null && canWriteSubArea(role, 'network', 'evaluations'));
  }

  canValidateCouncil(provider: Pick<Provider, 'category'>): boolean {
    const role = this.auth.role();
    if (this.isManager()) {
      return true;
    }
    return (
      role !== null &&
      provider.category === 'psychology' &&
      canWriteSubArea(role, 'network', 'psychologist_registry_validation')
    );
  }

  /** Como o cuidador aparece: a gestão só vê o código; o atendimento vê o nome (RN-ARP-18). */
  caregiverLabel(caregiverId: ID): { text: string; pseudonym: boolean } {
    const caregiver = this.db.caregivers.get(caregiverId);
    if (!caregiver) {
      return { text: 'Cuidador não encontrado', pseudonym: false };
    }
    return this.auth.hasRole('partner')
      ? { text: caregiver.code, pseudonym: true }
      : { text: caregiver.fullName, pseudonym: false };
  }

  today(): ISODate {
    return this.clock.today();
  }

  private userId(): ID {
    return this.network.actorId();
  }

  // ===== Leitura =====

  accreditationOf(providerId: ID): Accreditation | undefined {
    return this.db.accreditations.find((a) => a.providerId === providerId);
  }

  documentsOf(providerId: ID): ProviderDocument[] {
    return this.db.providerDocuments.query((d) => d.providerId === providerId);
  }

  approvalCheck(accreditation: Accreditation): ApprovalCheck {
    return checkAccreditationApproval(
      accreditation,
      this.documentsOf(accreditation.providerId),
      this.today(),
    );
  }

  /** Frase "Para aprovar falta: ..." ou `null` quando já dá para aprovar. */
  approvalBlocker(accreditation: Accreditation): string | null {
    const check = this.approvalCheck(accreditation);
    if (check.canApprove) {
      return null;
    }
    const parts: string[] = [
      ...check.missingCriteria.map((k) => CHECKLIST_LABELS[k].toLowerCase()),
      ...check.expiredDocuments.map((d) => `${DOCUMENT_KIND_LABEL[d.kind].toLowerCase()} vencido`),
    ];
    return `Para aprovar falta: ${parts.join('; ')}.`;
  }

  /** O que falta para ativar (integração, POPs, vedação de captação paralela), RN-REDE-24. */
  activationBlockers(provider: Provider): string[] {
    const accreditation = this.accreditationOf(provider.id);
    const check = canActivateProvider(provider, accreditation?.status ?? 'requested');
    const text = {
      approved: 'aprovação do credenciamento',
      integration: 'integração concluída',
      pops: 'ciência dos procedimentos (POPs)',
      parallel_ban: 'aceite de não captar usuários por fora',
    } as const;
    return check.missing.map((m) => text[m]);
  }

  /** Dias que faltam para a suspensão por documento vencido, ou `null` se não há documento vencido. */
  documentGraceLeft(providerId: ID): number | null {
    const expired = this.documentsOf(providerId).filter(
      (d) => d.validUntil !== undefined && daysBetween(d.validUntil, this.today()) > 0,
    );
    const first = expired.map((d) => d.validUntil as ISODate).sort()[0];
    return first === undefined ? null : DOCUMENT_GRACE - daysBetween(first, this.today());
  }

  // ===== Credenciamento =====

  openProcess(input: NewProcessInput): Result<Provider> {
    if (!this.isManager()) {
      return fail('Só a gestão abre um processo de credenciamento.');
    }
    const today = this.today();
    const provider = this.db.providers.create({
      ...input,
      status: 'candidate',
      accreditationId: '',
      availability: [],
      highlight: false,
    });
    const hasCouncil = input.council.body !== 'NONE';
    const pending = { status: 'pending' as ChecklistStatus };
    const checklist = Object.fromEntries(
      ACCREDITATION_CHECKLIST_KEYS.map((key) => [
        key,
        key === 'council_registry' && !hasCouncil ? { status: 'not_applicable' as const } : pending,
      ]),
    ) as Accreditation['checklist'];
    const accreditation = this.db.accreditations.create({
      providerId: provider.id,
      status: 'requested',
      checklist,
    });
    const saved = this.db.providers.update(provider.id, { accreditationId: accreditation.id });
    this.db.providerStatusEvents.create({
      providerId: provider.id,
      from: null,
      to: 'candidate',
      reason: `Credenciamento solicitado em ${formatDate(today)}`,
      byUserId: this.userId(),
    });
    this.audit.write('create', 'accreditation', accreditation.id);
    return ok(saved);
  }

  /** Confere um dos 5 critérios (RN-REDE-03). O registro no conselho aceita "não se aplica". */
  setChecklist(
    accreditationId: ID,
    key: ChecklistKey,
    status: ChecklistStatus,
    note?: string,
  ): Result {
    const accreditation = this.db.accreditations.get(accreditationId);
    if (!accreditation) {
      return fail('Não encontramos este credenciamento.');
    }
    const provider = this.db.providers.require(accreditation.providerId);
    if (!this.isManager() && !(key === 'council_registry' && this.canValidateCouncil(provider))) {
      return fail('Este perfil não confere este critério.');
    }
    if (status === 'not_applicable' && key !== 'council_registry') {
      return fail('Só o registro no conselho pode ficar como "não se aplica".');
    }
    if (accreditation.status === 'approved' || accreditation.status === 'rejected' || accreditation.status === 'active') {
      return fail('Este processo já foi decidido. Abra um novo credenciamento para mudar os critérios.');
    }
    const cleanNote = note?.trim();
    this.db.accreditations.update(accreditationId, {
      status: accreditation.status === 'requested' ? 'in_review' : accreditation.status,
      checklist: {
        ...accreditation.checklist,
        [key]: {
          status,
          checkedBy: this.userId(),
          checkedAt: this.today(),
          ...(cleanNote ? { note: cleanNote } : {}),
        },
      },
    });
    this.audit.write('update', 'accreditation', accreditationId, undefined, `critério: ${key}`);
    return ok(undefined);
  }

  /** O RT valida o registro no CRP de psicólogos da rede (AC-M08-14). */
  validateCouncil(providerId: ID): Result {
    const provider = this.db.providers.get(providerId);
    const accreditation = provider ? this.accreditationOf(providerId) : undefined;
    if (!provider || !accreditation) {
      return fail('Não encontramos este prestador.');
    }
    if (!this.canValidateCouncil(provider)) {
      return fail('Este perfil não valida o registro no conselho deste prestador.');
    }
    this.db.accreditations.update(accreditation.id, {
      checklist: {
        ...accreditation.checklist,
        council_registry: {
          status: 'ok',
          checkedBy: this.userId(),
          checkedAt: this.today(),
          note: 'Registro no conselho validado.',
        },
      },
    });
    this.db.providers.update(providerId, {
      council: { ...provider.council, status: 'active' },
    });
    this.audit.write('update', 'accreditation', accreditation.id, undefined, 'registro validado');
    return ok(undefined);
  }

  /** Anexa um documento (simulado: só o nome do arquivo) e substitui o anterior do mesmo tipo. */
  attachDocument(
    providerId: ID,
    input: { kind: ProviderDocument['kind']; fileName: string; validUntil?: ISODate },
  ): Result<ProviderDocument> {
    const provider = this.db.providers.get(providerId);
    if (!provider) {
      return fail('Não encontramos este prestador.');
    }
    if (!this.isManager()) {
      return fail('Só a gestão anexa documentos.');
    }
    const fileName = input.fileName.trim();
    if (!fileName) {
      return fail('Informe o nome do arquivo do documento.');
    }
    const needsValidity = input.kind === 'council_registry' && provider.council.body !== 'NONE';
    if (needsValidity && !input.validUntil) {
      return fail('Informe a validade do registro no conselho.');
    }
    if (input.validUntil && input.validUntil < this.today()) {
      return fail('A validade informada já passou. Anexe um documento dentro da validade.');
    }
    this.db.providerDocuments.removeWhere((d) => d.providerId === providerId && d.kind === input.kind);
    const document = this.db.providerDocuments.create({
      providerId,
      kind: input.kind,
      fileName,
      issuedAt: this.today(),
      ...(input.validUntil ? { validUntil: input.validUntil } : {}),
      status: 'valid',
    });
    if (input.kind === 'council_registry' && input.validUntil && provider.council.body !== 'NONE') {
      this.db.providers.update(providerId, {
        council: { ...provider.council, validUntil: input.validUntil, status: 'active' },
      });
    }
    const accreditation = this.accreditationOf(providerId);
    if (accreditation?.status === 'pending_documents') {
      const stillExpired = this.documentsOf(providerId).some(
        (d) => d.validUntil !== undefined && d.validUntil < this.today(),
      );
      if (!stillExpired) {
        this.db.accreditations.update(accreditation.id, { status: 'in_review' });
      }
    }
    this.audit.write('create', 'provider_document', document.id);
    return ok(document);
  }

  approve(accreditationId: ID): Result {
    const accreditation = this.db.accreditations.get(accreditationId);
    if (!accreditation) {
      return fail('Não encontramos este credenciamento.');
    }
    if (!this.isManager()) {
      return fail('Só a gestão decide o credenciamento.');
    }
    const blocker = this.approvalBlocker(accreditation);
    if (blocker) {
      return fail(blocker);
    }
    this.db.accreditations.update(accreditationId, {
      status: 'approved',
      decidedAt: this.today(),
      decidedBy: this.userId(),
    });
    this.audit.write('update', 'accreditation', accreditationId, undefined, 'aprovado');
    return ok(undefined);
  }

  reject(accreditationId: ID, reason: string): Result {
    const accreditation = this.db.accreditations.get(accreditationId);
    const text = reason.trim();
    if (!accreditation) {
      return fail('Não encontramos este credenciamento.');
    }
    if (!this.isManager()) {
      return fail('Só a gestão decide o credenciamento.');
    }
    if (!text) {
      return fail('Escreva o motivo da reprovação.');
    }
    this.db.accreditations.update(accreditationId, {
      status: 'rejected',
      rejectionReason: text,
      decidedAt: this.today(),
      decidedBy: this.userId(),
    });
    this.network.changeStatus(accreditation.providerId, 'rejected', `Reprovado: ${text}`);
    return ok(undefined);
  }

  /** Pede documentos: o processo vai a "Documentos pendentes" e o texto do e-mail fica registrado. */
  requestDocuments(
    accreditationId: ID,
    kinds: readonly ProviderDocument['kind'][],
    emailText: string,
  ): Result {
    const accreditation = this.db.accreditations.get(accreditationId);
    const text = emailText.trim();
    if (!accreditation) {
      return fail('Não encontramos este credenciamento.');
    }
    if (!this.isManager()) {
      return fail('Só a gestão decide o credenciamento.');
    }
    if (kinds.length === 0) {
      return fail('Marque ao menos um documento para pedir.');
    }
    if (!text) {
      return fail('Escreva o texto do e-mail que será registrado.');
    }
    this.db.accreditations.update(accreditationId, { status: 'pending_documents' });
    const list = kinds.map((k) => DOCUMENT_KIND_LABEL[k].toLowerCase()).join(', ');
    this.db.providerStatusEvents.create({
      providerId: accreditation.providerId,
      from: 'candidate',
      to: 'candidate',
      reason: `Documentos pedidos (${list}). E-mail registrado: ${text}`,
      byUserId: this.userId(),
    });
    this.audit.write('update', 'accreditation', accreditationId, undefined, 'documentos pedidos');
    return ok(undefined);
  }

  // ===== Integração e ativação =====

  private mark(
    providerId: ID,
    field: 'integrationDoneAt' | 'popsAcknowledgedAt' | 'parallelSolicitationBanAcceptedAt' | 'dataProtectionClauseSignedAt',
    detail: string,
  ): Result {
    if (!this.isManager()) {
      return fail('Só a gestão registra a integração.');
    }
    const provider = this.db.providers.get(providerId);
    if (!provider) {
      return fail('Não encontramos este prestador.');
    }
    this.db.providers.update(providerId, { [field]: this.today() } as Partial<Pick<Provider, typeof field>>);
    this.audit.write('update', 'provider', providerId, undefined, detail);
    return ok(undefined);
  }

  recordIntegration(providerId: ID): Result {
    return this.mark(providerId, 'integrationDoneAt', 'integração concluída');
  }

  recordPops(providerId: ID): Result {
    const result = this.mark(providerId, 'popsAcknowledgedAt', 'ciência dos POPs');
    if (result.ok) {
      this.db.pops.list().forEach((pop) => {
        const known = this.db.popAcknowledgements.find(
          (a) => a.popCode === pop.code && a.personId === providerId,
        );
        if (!known) {
          this.db.popAcknowledgements.create({
            popCode: pop.code,
            personType: 'provider',
            personId: providerId,
            at: this.today(),
          });
        }
      });
    }
    return result;
  }

  recordParallelBan(providerId: ID): Result {
    return this.mark(providerId, 'parallelSolicitationBanAcceptedAt', 'vedação de captação paralela');
  }

  /** RN-LGPD-13: sem a cláusula registrada a Nexus não repassa dados de usuários ao prestador. */
  recordClause(providerId: ID): Result {
    return this.mark(providerId, 'dataProtectionClauseSignedAt', 'cláusula de proteção de dados');
  }

  activate(providerId: ID): Result {
    const provider = this.db.providers.get(providerId);
    const accreditation = provider ? this.accreditationOf(providerId) : undefined;
    if (!provider || !accreditation) {
      return fail('Não encontramos este prestador.');
    }
    if (!this.isManager()) {
      return fail('Só a gestão ativa o prestador.');
    }
    const check = canActivateProvider(provider, accreditation.status);
    if (!check.canActivate) {
      return fail(`Para ativar falta: ${this.activationBlockers(provider).join('; ')}.`);
    }
    this.db.accreditations.update(accreditation.id, { status: 'active' });
    this.network.changeStatus(providerId, 'active', 'Credenciamento aprovado e integração concluída');
    return ok(undefined);
  }

  // ===== Estado do prestador =====

  suspend(providerId: ID, reason: string): Result {
    const provider = this.db.providers.get(providerId);
    const text = reason.trim();
    if (!provider) {
      return fail('Não encontramos este prestador.');
    }
    if (!this.isManager()) {
      return fail('Só a gestão suspende prestadores.');
    }
    if (!isSearchable(provider.status)) {
      return fail('Só dá para suspender um prestador ativo ou em monitoramento.');
    }
    if (!text) {
      return fail('Escreva o motivo da suspensão.');
    }
    this.network.changeStatus(providerId, 'suspended', text);
    this.network.openInternalReview(providerId, 'manual');
    return ok(undefined);
  }

  /** Registra um contato com prestador em monitoramento (RN-ARP-07). */
  registerMonitoringContact(providerId: ID, note: string): Result {
    const provider = this.db.providers.get(providerId);
    const text = note.trim();
    if (!provider || provider.status !== 'monitoring') {
      return fail('O contato de monitoramento vale para prestador em monitoramento.');
    }
    if (!this.isManager()) {
      return fail('Só a gestão registra o contato de monitoramento.');
    }
    if (!text) {
      return fail('Escreva o que ficou combinado no contato.');
    }
    this.db.providerStatusEvents.create({
      providerId,
      from: 'monitoring',
      to: 'monitoring',
      reason: `Contato registrado: ${text}`,
      byUserId: this.userId(),
    });
    return ok(undefined);
  }

  /** O prestador em monitoramento já foi contatado depois da última auditoria? */
  wasContactedSinceAudit(providerId: ID, lastAuditDate: ISODate | undefined): boolean {
    return (
      this.db.providerStatusEvents.count(
        (e) =>
          e.providerId === providerId &&
          e.from === 'monitoring' &&
          e.to === 'monitoring' &&
          e.reason.startsWith('Contato registrado') &&
          (lastAuditDate === undefined || e.createdAt.slice(0, 10) >= lastAuditDate),
      ) > 0
    );
  }

  /** Registra os horários publicados na semana corrente (RN-REDE-29). */
  registerAvailability(providerId: ID, slots: number): Result {
    const provider = this.db.providers.get(providerId);
    if (!provider) {
      return fail('Não encontramos este prestador.');
    }
    if (!this.isManager()) {
      return fail('Só a gestão registra a disponibilidade.');
    }
    if (!Number.isInteger(slots) || slots < 0 || slots > 80) {
      return fail('Os horários da semana devem ser de 0 a 80.');
    }
    const monday = addDays(this.today(), -((weekday(this.today()) + 6) % 7));
    const others = provider.availability.filter((w) => w.weekStart !== monday);
    this.db.providers.update(providerId, {
      availability: [...others, { weekStart: monday, slots }].sort((a, b) =>
        a.weekStart.localeCompare(b.weekStart),
      ),
    });
    this.audit.write('update', 'provider', providerId, undefined, 'disponibilidade da semana');
    return ok(undefined);
  }

  // ===== Avaliação interna =====

  registerJustification(reviewId: ID, text: string): Result {
    const review = this.db.internalReviews.get(reviewId);
    const body = text.trim();
    if (!review) {
      return fail('Não encontramos esta avaliação interna.');
    }
    if (!this.isManager()) {
      return fail('Só a gestão registra a justificativa recebida.');
    }
    if (review.decision) {
      return fail('Esta avaliação interna já tem decisão.');
    }
    if (body.length < 10) {
      return fail('Escreva a justificativa com ao menos 10 caracteres.');
    }
    this.db.internalReviews.update(reviewId, {
      justification: body,
      justificationAt: this.clock.now(),
    });
    this.audit.write('update', 'internal_review', reviewId, undefined, 'justificativa registrada');
    return ok(undefined);
  }

  decideReview(
    reviewId: ID,
    decision: NonNullable<InternalReview['decision']>,
    input: { note?: string; email?: { to: string; subject: string; body: string } },
  ): Result {
    const review = this.db.internalReviews.get(reviewId);
    if (!review) {
      return fail('Não encontramos esta avaliação interna.');
    }
    if (!this.isManager()) {
      return fail('Só a gestão decide a avaliação interna.');
    }
    if (review.decision) {
      return fail('Esta avaliação interna já tem decisão.');
    }
    const note = input.note?.trim();
    const providerId = review.providerId;
    if (decision === 'confirm_deaccreditation') {
      const email = input.email;
      if (!email || !email.body.trim()) {
        return fail('Escreva o texto do e-mail de encerramento. Ele fica registrado no histórico.');
      }
      this.db.internalReviews.update(reviewId, {
        decision,
        decidedBy: this.userId(),
        decidedAt: this.today(),
        ...(note ? { decisionNote: note } : {}),
        closureEmail: {
          to: email.to,
          subject: email.subject,
          body: email.body.trim(),
          sentAt: this.clock.now(),
        },
      });
      this.network.changeStatus(providerId, 'deaccredited', 'Descredenciamento confirmado na avaliação interna');
      return ok(undefined);
    }
    if (decision === 'reinstate') {
      if (!note) {
        return fail('Escreva o motivo da reinstalação.');
      }
      const summary = this.network.summaryOf(providerId);
      const to = summary && (summary.band === 'excellence' || summary.band === 'no_average') ? 'active' : 'monitoring';
      this.db.internalReviews.update(reviewId, {
        decision,
        decidedBy: this.userId(),
        decidedAt: this.today(),
        decisionNote: note,
      });
      this.network.changeStatus(providerId, to, `Reinstalado na avaliação interna: ${note}`);
      return ok(undefined);
    }
    this.db.internalReviews.update(reviewId, {
      decision,
      decidedBy: this.userId(),
      decidedAt: this.today(),
      ...(note ? { decisionNote: note } : {}),
    });
    this.network.changeStatus(providerId, 'monitoring', 'Mantido em monitoramento na avaliação interna');
    return ok(undefined);
  }

  // ===== Auditoria quinzenal (RN-ARP-05) =====

  private auditRows(): AuditRow[] {
    return this.network
      .summaries()
      .filter(
        (s) =>
          s.provider.status === 'active' ||
          s.provider.status === 'monitoring' ||
          s.provider.status === 'suspended',
      )
      .map((summary): AuditRow => {
        const { provider } = summary;
        const inOperation = provider.status === 'active' || provider.status === 'monitoring';
        const documentOverdue = summary.expiredDocuments.some((d) =>
          shouldSuspendForExpiredDocument(d.validUntil as ISODate, this.today()),
        );
        let action: AuditRow['action'] = 'none';
        let reason: string | null = null;
        if (inOperation && summary.band === 'deaccreditation') {
          action = 'suspend';
          reason =
            summary.trigger === 'grave_complaints'
              ? 'Três reclamações graves registradas'
              : 'Média abaixo de 4,0';
        } else if (inOperation && documentOverdue) {
          action = 'suspend_document';
          reason = 'Documento vencido';
        } else if (provider.status === 'active' && summary.band === 'alert') {
          action = 'to_monitoring';
        } else if (provider.status === 'monitoring' && summary.band === 'excellence') {
          action = 'to_active';
        }
        return {
          summary,
          previousBand: summary.lastSnapshot?.band ?? null,
          nextBand: summary.band,
          action,
          reason,
        };
      })
      .sort((a, b) => a.summary.provider.name.localeCompare(b.summary.provider.name, 'pt-BR'));
  }

  /** Prévia sem gravar (A-34): a classificação que sairia e quem seria suspenso agora. */
  previewAudit(): AuditPreview {
    const rows = this.auditRows();
    const dates = this.db.arpSnapshots.all().map((s) => s.auditDate).sort();
    return {
      rows,
      willSuspend: rows.filter((r) => r.action === 'suspend' || r.action === 'suspend_document'),
      lastAuditDate: dates.at(-1),
      alreadyRanToday: dates.includes(this.today()),
    };
  }

  /** Grava um instantâneo por prestador e aplica as mudanças de estado. Rodar de novo no dia substitui. */
  runAudit(): Result<AuditResult> {
    if (!this.isManager()) {
      return fail('Só a gestão roda a auditoria.');
    }
    const today = this.today();
    const rows = this.auditRows();
    const replaced = this.db.arpSnapshots.count((s) => s.auditDate === today) > 0;
    this.db.arpSnapshots.removeWhere((s) => s.auditDate === today);
    this.db.arpSnapshots.createMany(
      rows.map((r) => ({
        providerId: r.summary.provider.id,
        auditDate: today,
        average: r.summary.average,
        evaluationCount: r.summary.evaluationCount,
        band: r.summary.band,
        graveComplaintCount: r.summary.graveCount,
        auditedBy: this.userId(),
      })),
    );
    const suspended: string[] = [];
    rows.forEach((row) => {
      const { provider } = row.summary;
      if (row.action === 'suspend' || row.action === 'suspend_document') {
        this.network.changeStatus(provider.id, 'suspended', row.reason ?? 'Auditoria quinzenal');
        this.network.openInternalReview(
          provider.id,
          row.action === 'suspend_document' ? 'manual' : (row.summary.trigger ?? 'manual'),
        );
        suspended.push(provider.name);
      } else if (row.action === 'to_monitoring') {
        this.network.changeStatus(provider.id, 'monitoring', 'Média na zona de alerta na auditoria quinzenal');
      } else if (row.action === 'to_active') {
        this.network.changeStatus(provider.id, 'active', 'Média voltou à zona de excelência na auditoria quinzenal');
      }
      const current = this.db.providers.require(provider.id);
      const highlight = current.status === 'active' && row.summary.band === 'excellence';
      if (current.highlight !== highlight) {
        this.db.providers.update(provider.id, { highlight });
      }
    });
    this.audit.write('create', 'arp_audit', undefined, undefined, `${rows.length} instantâneos`);
    return ok({ auditDate: today, snapshots: rows.length, suspended, replaced });
  }

  // ===== Solicitações de serviço =====

  createRequest(input: {
    caregiverId: ID;
    providerId: ID;
    need: string;
    modality: ServiceRequest['modality'];
  }): Result<ServiceRequest> {
    if (!this.canRegisterRequests()) {
      return fail('Este perfil não registra solicitações.');
    }
    const provider = this.db.providers.get(input.providerId);
    const need = input.need.trim();
    if (!this.db.caregivers.exists(input.caregiverId)) {
      return fail('Escolha o cuidador que fez o pedido.');
    }
    // A regra é a mesma do aplicativo do cuidador (`core/rules/service-requests.ts`); aqui só a frase da equipe.
    const problem = serviceRequestProblem(provider, input.need, input.modality);
    if (problem === 'no_provider' || !provider) {
      return fail('Escolha o prestador do serviço.');
    }
    if (problem === 'not_searchable') {
      return fail('Este prestador não está na busca. Escolha outro da mesma especialidade.');
    }
    if (problem === 'no_need') {
      return fail('Descreva a necessidade do serviço.');
    }
    if (problem === 'home_not_offered') {
      return fail('Este prestador não atende em domicílio. Escolha o atendimento no local do prestador.');
    }
    const created = this.db.serviceRequests.create({
      caregiverId: input.caregiverId,
      providerId: provider.id,
      specialty: provider.category,
      need,
      modality: input.modality,
      status: 'requested',
      requestedAt: this.clock.now(),
    });
    this.audit.write('create', 'service_request', created.id, input.caregiverId);
    return ok(created);
  }

  /** Registra a resposta do prestador (aceite ou recusa com motivo), RN-REDE-26. */
  respond(requestId: ID, answer: { accept: true } | { accept: false; reason: string }): Result {
    const request = this.db.serviceRequests.get(requestId);
    if (!request) {
      return fail('Não encontramos esta solicitação.');
    }
    if (!this.isManager()) {
      return fail('Só a gestão registra a resposta do prestador.');
    }
    if (request.status !== 'requested') {
      return fail('Só uma solicitação aguardando resposta pode ser aceita ou recusada.');
    }
    if (answer.accept) {
      this.db.serviceRequests.update(requestId, { status: 'accepted', respondedAt: this.clock.now() });
    } else {
      const reason = answer.reason.trim();
      if (!reason) {
        return fail('Escreva o motivo da recusa.');
      }
      this.db.serviceRequests.update(requestId, {
        status: 'refused_by_provider',
        respondedAt: this.clock.now(),
        reason,
      });
    }
    this.audit.write('update', 'service_request', requestId, request.caregiverId);
    return ok(undefined);
  }

  /** Cancela a pedido do usuário ou pelo prestador, sempre com motivo. */
  cancel(requestId: ID, by: 'user' | 'provider', reason: string): Result {
    const request = this.db.serviceRequests.get(requestId);
    const text = reason.trim();
    if (!request) {
      return fail('Não encontramos esta solicitação.');
    }
    if (by === 'provider' && !this.isManager()) {
      return fail('Só a gestão registra o cancelamento feito pelo prestador.');
    }
    if (!this.canRegisterRequests()) {
      return fail('Este perfil não registra solicitações.');
    }
    const allowed =
      by === 'user'
        ? request.status === 'requested' || request.status === 'accepted'
        : request.status === 'accepted';
    if (!allowed) {
      return fail('Esta solicitação não pode mais ser cancelada desse modo.');
    }
    if (!text) {
      return fail('Escreva o motivo do cancelamento.');
    }
    this.db.serviceRequests.update(requestId, {
      status: by === 'user' ? 'cancelled_by_user' : 'cancelled_by_provider',
      reason: text,
      respondedAt: request.respondedAt ?? this.clock.now(),
    });
    this.audit.write('update', 'service_request', requestId, request.caregiverId);
    return ok(undefined);
  }

  complete(requestId: ID): Result {
    const request = this.db.serviceRequests.get(requestId);
    if (!request) {
      return fail('Não encontramos esta solicitação.');
    }
    if (!this.isManager()) {
      return fail('Só a gestão registra a conclusão.');
    }
    if (request.status !== 'accepted') {
      return fail('Só uma solicitação aceita pode ser concluída.');
    }
    this.db.serviceRequests.update(requestId, { status: 'completed', completedAt: this.clock.now() });
    this.audit.write('update', 'service_request', requestId, request.caregiverId);
    return ok(undefined);
  }

  // ===== Avaliações =====

  /** Duas notas inteiras de 1 a 5, só para serviço concluído, uma por serviço (RN-ARP-02 e 16). */
  registerEvaluation(
    requestId: ID,
    input: { technical: number | null; punctuality: number | null; comment?: string },
  ): Result<ProviderEvaluation> {
    if (!this.canRegisterEvaluations()) {
      return fail('Este perfil não registra avaliações.');
    }
    const request = this.db.serviceRequests.get(requestId);
    if (!request) {
      return fail('Não encontramos este serviço.');
    }
    if (!isValidRating(input.technical)) {
      return fail('Escolha uma nota de 1 a 5 para a qualidade técnica.');
    }
    if (!isValidRating(input.punctuality)) {
      return fail('Escolha uma nota de 1 a 5 para a pontualidade e a cordialidade.');
    }
    if (request.evaluationId || request.status === 'evaluated') {
      const previous = request.evaluationId ? this.db.providerEvaluations.get(request.evaluationId) : undefined;
      return fail(
        `Este serviço já foi avaliado${previous ? ` em ${formatDate(previous.createdAt)}` : ''}. Cada serviço tem uma avaliação.`,
      );
    }
    if (request.status !== 'completed') {
      return fail('Só dá para avaliar um serviço concluído.');
    }
    const comment = input.comment?.trim();
    const evaluation = this.db.providerEvaluations.create({
      serviceRequestId: request.id,
      providerId: request.providerId,
      caregiverId: request.caregiverId,
      technicalQuality: input.technical,
      punctualityCourtesy: input.punctuality,
      ...(comment ? { comment } : {}),
      score: evaluationScore(input.technical, input.punctuality),
      editableUntil: evaluationEditableUntil(this.today()),
    });
    this.db.serviceRequests.update(request.id, { status: 'evaluated', evaluationId: evaluation.id });
    this.audit.write('create', 'provider_evaluation', evaluation.id, request.caregiverId);
    return ok(evaluation);
  }

  /** Classifica a avaliação como reclamação grave (RN-ARP-09) e reaplica a regra de suspensão. */
  classifyGrave(evaluationId: ID, category: GraveCategory): Result<ReevaluationOutcome> {
    const evaluation = this.db.providerEvaluations.get(evaluationId);
    if (!evaluation) {
      return fail('Não encontramos esta avaliação.');
    }
    if (!this.isManager()) {
      return fail('Só a gestão classifica uma reclamação como grave.');
    }
    if (evaluation.grave) {
      return fail('Esta avaliação já está classificada como grave.');
    }
    this.db.providerEvaluations.update(evaluationId, {
      grave: { category, classifiedBy: this.userId(), classifiedAt: this.today() },
    });
    this.audit.write('update', 'provider_evaluation', evaluationId, evaluation.caregiverId, 'classificada como grave');
    return ok(this.network.reevaluate(evaluation.providerId));
  }

  /** Texto "Faltam N critérios" do quadro de credenciamento. */
  missingCount(accreditation: Accreditation): number {
    const check = this.approvalCheck(accreditation);
    return check.missingCriteria.length + check.expiredDocuments.length;
  }
}
