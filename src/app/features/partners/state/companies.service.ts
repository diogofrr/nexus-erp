import { Injectable, computed, inject } from '@angular/core';
import { AuditLogService } from '@core/audit';
import { AuthService } from '@core/auth';
import { Clock, addMonths } from '@core/clock';
import { Database } from '@core/data';
import type {
  BenefitCard,
  Caregiver,
  CorporateAccount,
  CorporateSeat,
  Cents,
  ID,
  ISODate,
  PaidPlanId,
  Subscription,
} from '@core/models';
import { Aggregate, aggregateCount } from '@core/privacy';
import {
  classifyPlanChange,
  formatCardNumber,
  validateFictitiousCnpj,
  validateFictitiousEmail,
} from '@core/rules';
import { CORPORATE_STATUS_LABEL } from './partner-labels';
import {
  CORPORATE_TRANSITIONS,
  SeatCounts,
  checkInvite,
  inviteEmailError,
  seatCounts,
} from './partner-rules';
import type { ActionResult } from './partners.service';

/** Dados do formulário do contrato (criar e editar). */
export interface CompanyInput {
  companyName: string;
  cnpj: string;
  hrContactName: string;
  hrContactEmail: string;
  planId: PaidPlanId;
  seats: number;
  seatPriceCents: Cents;
}

/** Adesão agregada da empresa: nunca mostra dado individual (RN-CORP-08). */
export interface Adhesion {
  counts: SeatCounts;
  /**
   * Colaboradores que participaram de grupos ou capacitações. `private` quando há menos de 5
   * colaboradores ativos (o recorte identificaria pessoas); senão o agregado com mínimo de 5.
   */
  participation: { kind: 'private' } | { kind: 'aggregate'; value: Aggregate<number> };
}

export interface CompanyHistoryEntry {
  id: string;
  at: string;
  title: string;
  text?: string;
}

export interface EndPreview {
  activeSeats: number;
  invitedSeats: number;
  cardsToInactivate: number;
}

export interface EndOutcome extends EndPreview {
  moved: number;
}

/**
 * Canal corporativo (M09, POP-03 e RN-CORP-*): contratos, vagas e colaboradores. A empresa paga o plano; o
 * colaborador ativo tem assinatura paga com pagador "empresa" e conta como assinante (RN-CORP-07). Encerrar
 * o contrato (ou remover o colaborador) leva-o ao Livre e inativa o cartão (RN-CRT-03).
 */
@Injectable({ providedIn: 'root' })
export class CompaniesService {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly auth = inject(AuthService);
  private readonly audit = inject(AuditLogService);

  readonly accounts = this.db.corporateAccounts.all;
  readonly canWrite = computed(() => this.auth.can('partners_corporate', 'update'));

  // ===== Leitura =====

  get(id: ID): CorporateAccount | undefined {
    return this.db.corporateAccounts.get(id);
  }

  /** Vagas da empresa (sem as removidas). */
  seatsOf(accountId: ID): CorporateSeat[] {
    return this.db.corporateSeats
      .all()
      .filter((s) => s.corporateAccountId === accountId && s.status !== 'removed');
  }

  countsOf(accountId: ID): SeatCounts {
    const account = this.db.corporateAccounts.get(accountId);
    return seatCounts({ seats: account?.seats ?? 0 }, this.seatsOf(accountId));
  }

  inviteCheck(accountId: ID): { ok: true } | { ok: false; message: string } {
    const account = this.db.corporateAccounts.get(accountId);
    if (!account) {
      return { ok: false, message: 'Não encontramos esta empresa.' };
    }
    return checkInvite(account, this.seatsOf(accountId));
  }

  /** Código pseudonimizado do colaborador (a empresa e a gestão nunca veem o nome). */
  codeOfSeat(seat: CorporateSeat): string | null {
    return seat.caregiverId ? (this.db.caregivers.get(seat.caregiverId)?.code ?? null) : null;
  }

  adhesionOf(accountId: ID): Adhesion {
    const counts = this.countsOf(accountId);
    if (counts.active < 5) {
      return { counts, participation: { kind: 'private' } };
    }
    const members = new Set(
      this.seatsOf(accountId)
        .filter((s) => s.status === 'active' && s.caregiverId !== undefined)
        .map((s) => s.caregiverId as ID),
    );
    const participants = new Set(
      this.db.activityEnrollments
        .all()
        .filter(
          (e) =>
            e.caregiverId !== undefined &&
            members.has(e.caregiverId) &&
            (e.status === 'enrolled' || e.status === 'attended'),
        )
        .map((e) => e.caregiverId as ID),
    );
    return {
      counts,
      participation: { kind: 'aggregate', value: aggregateCount(participants.size) },
    };
  }

  /** Data de hoje (do `Clock`). */
  today(): ISODate {
    return this.clock.today();
  }

  /** Eventos da ficha: o que está nos registros mais o que foi feito aqui (log). */
  historyOf(accountId: ID): CompanyHistoryEntry[] {
    const account = this.db.corporateAccounts.get(accountId);
    if (!account) {
      return [];
    }
    const seatIds = new Set(
      this.db.corporateSeats
        .all()
        .filter((s) => s.corporateAccountId === accountId)
        .map((s) => s.id),
    );
    const entries: CompanyHistoryEntry[] = [
      { id: 'created', at: account.createdAt, title: 'Empresa cadastrada' },
    ];
    if (account.startDate) {
      entries.push({
        id: 'start',
        at: `${account.startDate}T09:00:00-03:00`,
        title: 'Contrato iniciado',
      });
    }
    this.db.accessLog
      .all()
      .filter(
        (e) =>
          e.action === 'update' &&
          e.entityId !== undefined &&
          ((e.entity === 'corporate_account' && e.entityId === accountId) ||
            (e.entity === 'corporate_seat' && seatIds.has(e.entityId))),
      )
      .forEach((e) =>
        entries.push({
          id: e.id,
          at: e.at,
          title: 'Alteração registrada',
          ...(e.detail ? { text: e.detail } : {}),
        }),
      );
    return entries.sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
  }

  endPreview(accountId: ID): EndPreview {
    const seats = this.seatsOf(accountId);
    const active = seats.filter((s) => s.status === 'active');
    const cards = active.filter((s) => {
      const card = s.caregiverId ? this.activeCardOf(s.caregiverId) : undefined;
      return card !== undefined;
    });
    return {
      activeSeats: active.length,
      invitedSeats: seats.filter((s) => s.status === 'invited').length,
      cardsToInactivate: cards.length,
    };
  }

  /** Dá para usar a "Registrar adesão" com este código? Devolve o motivo quando não. */
  adhesionCodeError(code: string): string | null {
    const caregiver = this.caregiverByCode(code);
    if (!caregiver) {
      return 'Não encontramos este código. Use o formato CUI-0000.';
    }
    if (caregiver.status !== 'active') {
      return 'Este cadastro não está ativo.';
    }
    if (caregiver.corporateAccountId || this.inAnySeat(caregiver.id)) {
      return 'Este colaborador já está em uma vaga de empresa.';
    }
    return null;
  }

  // ===== Escrita: contrato =====

  create(input: CompanyInput): ActionResult<CorporateAccount> {
    const denied = this.deny();
    if (denied) {
      return denied;
    }
    const invalid = this.validate(input);
    if (invalid) {
      return { ok: false, message: invalid };
    }
    if (this.cnpjTaken(input.cnpj)) {
      return { ok: false, message: 'Já existe uma empresa com este CNPJ.' };
    }
    const account = this.db.corporateAccounts.create({
      companyName: input.companyName.trim(),
      cnpj: input.cnpj.trim(),
      hrContactName: input.hrContactName.trim(),
      hrContactEmail: input.hrContactEmail.trim(),
      status: 'prospect',
      planId: input.planId,
      seats: input.seats,
      seatPriceCents: input.seatPriceCents,
    });
    this.audit.write('create', 'corporate_account', account.id, undefined, 'empresa cadastrada');
    return { ok: true, value: account };
  }

  /** Edita o contrato. As vagas não ficam abaixo das ocupadas; trocar o plano troca o dos colaboradores ativos. */
  update(id: ID, input: CompanyInput): ActionResult<CorporateAccount> {
    const denied = this.deny();
    if (denied) {
      return denied;
    }
    const current = this.db.corporateAccounts.get(id);
    if (!current) {
      return { ok: false, message: 'Não encontramos esta empresa.' };
    }
    if (current.status === 'ended') {
      return { ok: false, message: 'Contrato encerrado não recebe alterações.' };
    }
    const invalid = this.validate(input);
    if (invalid) {
      return { ok: false, message: invalid };
    }
    if (this.cnpjTaken(input.cnpj, id)) {
      return { ok: false, message: 'Já existe uma empresa com este CNPJ.' };
    }
    const occupied = this.countsOf(id).occupied;
    if (input.seats < occupied) {
      return {
        ok: false,
        message: `As vagas não podem ficar abaixo das ${occupied} ocupadas. Remova colaboradores antes.`,
      };
    }
    const account = this.db.corporateAccounts.update(id, {
      companyName: input.companyName.trim(),
      cnpj: input.cnpj.trim(),
      hrContactName: input.hrContactName.trim(),
      hrContactEmail: input.hrContactEmail.trim(),
      planId: input.planId,
      seats: input.seats,
      seatPriceCents: input.seatPriceCents,
    });
    const changes = ['contrato atualizado'];
    if (current.seats !== input.seats) {
      changes.push(`vagas: ${current.seats} para ${input.seats}`);
    }
    if (current.planId !== input.planId) {
      changes.push(`plano por vaga: ${input.planId}`);
      this.seatsOf(id)
        .filter((s) => s.status === 'active' && s.caregiverId)
        .forEach((s) => {
          const caregiver = this.db.caregivers.get(s.caregiverId as ID);
          if (caregiver) {
            this.putOnCompanyPlan(caregiver, account);
          }
        });
    }
    this.audit.write('update', 'corporate_account', id, undefined, changes.join('; '));
    return { ok: true, value: account };
  }

  /** Move no funil. Ativar exige vagas e preço por vaga; encerrar passa pelo `endContract`. */
  moveTo(id: ID, to: CorporateAccount['status']): ActionResult<CorporateAccount> {
    const denied = this.deny();
    if (denied) {
      return denied;
    }
    const current = this.db.corporateAccounts.get(id);
    if (!current) {
      return { ok: false, message: 'Não encontramos esta empresa.' };
    }
    if (to === 'ended') {
      const outcome = this.endContract(id);
      return outcome.ok ? { ok: true, value: this.db.corporateAccounts.require(id) } : outcome;
    }
    if (!CORPORATE_TRANSITIONS[current.status].includes(to)) {
      return { ok: false, message: 'Este passo não existe a partir do estado atual.' };
    }
    if (to === 'active' && (current.seats < 1 || current.seatPriceCents <= 0)) {
      return { ok: false, message: 'Para ativar falta: vagas contratadas e preço por vaga.' };
    }
    const account = this.db.corporateAccounts.update(id, {
      status: to,
      ...(to === 'active' && !current.startDate ? { startDate: this.clock.today() } : {}),
    });
    this.audit.write(
      'update',
      'corporate_account',
      id,
      undefined,
      `de ${CORPORATE_STATUS_LABEL[current.status]} para ${CORPORATE_STATUS_LABEL[to]}`,
    );
    return { ok: true, value: account };
  }

  /**
   * Encerra o contrato: os colaboradores ativos passam ao Livre, os cartões são inativados no mesmo
   * instante (RN-CRT-03, RN-CORP-07) e os convites em aberto são cancelados.
   */
  endContract(id: ID): ActionResult<EndOutcome> {
    const denied = this.deny();
    if (denied) {
      return denied;
    }
    const current = this.db.corporateAccounts.get(id);
    if (!current) {
      return { ok: false, message: 'Não encontramos esta empresa.' };
    }
    if (current.status === 'ended') {
      return { ok: false, message: 'Este contrato já está encerrado.' };
    }
    const preview = this.endPreview(id);
    let moved = 0;
    this.seatsOf(id).forEach((seat) => {
      if (seat.status === 'active' && seat.caregiverId) {
        this.putOnFreePlan(seat.caregiverId, 'contrato encerrado');
        moved += 1;
      }
      this.db.corporateSeats.update(seat.id, { status: 'removed' });
    });
    this.db.corporateAccounts.update(id, { status: 'ended', endDate: this.clock.today() });
    this.audit.write(
      'update',
      'corporate_account',
      id,
      undefined,
      `contrato encerrado: ${moved} colaboradores ao Livre`,
    );
    return { ok: true, value: { ...preview, moved } };
  }

  // ===== Escrita: vagas e colaboradores =====

  /** Convida um colaborador por e-mail. Bloqueado quando as vagas contratadas estão ocupadas. */
  invite(accountId: ID, email: string): ActionResult<CorporateSeat> {
    const denied = this.deny();
    if (denied) {
      return denied;
    }
    const check = this.inviteCheck(accountId);
    if (!check.ok) {
      return check;
    }
    const emailError = inviteEmailError(email);
    if (emailError) {
      return { ok: false, message: emailError };
    }
    const wanted = email.trim().toLowerCase();
    if (this.seatsOf(accountId).some((s) => s.invitedEmail.toLowerCase() === wanted)) {
      return { ok: false, message: 'Este e-mail já tem uma vaga nesta empresa.' };
    }
    const seat = this.db.corporateSeats.create({
      corporateAccountId: accountId,
      invitedEmail: email.trim(),
      status: 'invited',
    });
    this.audit.write('create', 'corporate_seat', seat.id, undefined, 'colaborador convidado');
    return { ok: true, value: seat };
  }

  /**
   * Registra a adesão de quem foi convidado (o aceite acontece fora do ERP): liga a vaga ao cadastro pelo
   * código, põe a assinatura no plano da empresa (pagador "empresa") e emite ou reativa o cartão.
   */
  registerAdhesion(seatId: ID, code: string): ActionResult<CorporateSeat> {
    const denied = this.deny();
    if (denied) {
      return denied;
    }
    const seat = this.db.corporateSeats.get(seatId);
    if (!seat || seat.status !== 'invited') {
      return { ok: false, message: 'Só um convite em aberto recebe a adesão.' };
    }
    const account = this.db.corporateAccounts.get(seat.corporateAccountId);
    if (!account || account.status !== 'active') {
      return { ok: false, message: 'Só um contrato ativo recebe colaboradores.' };
    }
    const error = this.adhesionCodeError(code);
    if (error) {
      return { ok: false, message: error };
    }
    const caregiver = this.caregiverByCode(code) as Caregiver;
    this.putOnCompanyPlan(caregiver, account);
    const updated = this.db.corporateSeats.update(seatId, {
      caregiverId: caregiver.id,
      status: 'active',
    });
    this.audit.write(
      'update',
      'corporate_seat',
      seatId,
      caregiver.id,
      'adesão registrada: plano da empresa ativo',
    );
    return { ok: true, value: updated };
  }

  /** Remove o colaborador (ou cancela o convite). Quem estava ativo passa ao Livre e perde o cartão. */
  removeSeat(seatId: ID): ActionResult<CorporateSeat> {
    const denied = this.deny();
    if (denied) {
      return denied;
    }
    const seat = this.db.corporateSeats.get(seatId);
    if (!seat || seat.status === 'removed') {
      return { ok: false, message: 'Esta vaga não está mais ocupada.' };
    }
    if (seat.status === 'active' && seat.caregiverId) {
      this.putOnFreePlan(seat.caregiverId, 'colaborador removido da vaga');
    }
    const updated = this.db.corporateSeats.update(seatId, { status: 'removed' });
    this.audit.write(
      'update',
      'corporate_seat',
      seatId,
      seat.caregiverId,
      seat.status === 'invited' ? 'convite cancelado' : 'colaborador removido',
    );
    return { ok: true, value: updated };
  }

  // ===== Internos: assinatura e cartão =====

  private deny(): { ok: false; message: string } | null {
    return this.canWrite()
      ? null
      : { ok: false, message: 'O seu perfil só pode consultar as empresas.' };
  }

  private validate(input: CompanyInput): string | null {
    if (!input.companyName.trim()) {
      return 'Informe o nome da empresa.';
    }
    const cnpj = validateFictitiousCnpj(input.cnpj.trim());
    if (!cnpj.valid) {
      return cnpj.message;
    }
    if (!input.hrContactName.trim()) {
      return 'Informe o nome do contato de RH.';
    }
    const email = validateFictitiousEmail(input.hrContactEmail.trim());
    if (!email.valid) {
      return email.message;
    }
    if (!Number.isInteger(input.seats) || input.seats < 1) {
      return 'Informe ao menos 1 vaga.';
    }
    if (!Number.isFinite(input.seatPriceCents) || input.seatPriceCents < 0) {
      return 'Informe o preço por vaga.';
    }
    return null;
  }

  private cnpjTaken(cnpj: string, exceptId?: ID): boolean {
    return this.db.corporateAccounts
      .all()
      .some((a) => a.id !== exceptId && a.cnpj === cnpj.trim());
  }

  private caregiverByCode(code: string): Caregiver | undefined {
    const wanted = code.trim().toUpperCase();
    return this.db.caregivers.find((c) => c.code === wanted);
  }

  private inAnySeat(caregiverId: ID): boolean {
    return this.db.corporateSeats
      .all()
      .some((s) => s.caregiverId === caregiverId && s.status !== 'removed');
  }

  private subscriptionOf(caregiverId: ID): Subscription | undefined {
    return this.db.subscriptions.find(
      (s) => s.caregiverId === caregiverId && s.status !== 'cancelled',
    );
  }

  private cardOf(caregiverId: ID): BenefitCard | undefined {
    return this.db.benefitCards.find((c) => c.caregiverId === caregiverId);
  }

  private activeCardOf(caregiverId: ID): BenefitCard | undefined {
    return this.db.benefitCards.find((c) => c.caregiverId === caregiverId && c.status === 'active');
  }

  /** Assinatura no plano da empresa, pagador "empresa", cartão ativo e histórico da troca. */
  private putOnCompanyPlan(caregiver: Caregiver, account: CorporateAccount): void {
    const today = this.clock.today();
    const subscription = this.subscriptionOf(caregiver.id);
    const from = subscription?.planId ?? 'livre';
    let subscriptionId: ID;
    if (subscription) {
      this.db.subscriptions.update(subscription.id, {
        planId: account.planId,
        payer: 'corporate',
        corporateAccountId: account.id,
        status: 'active',
        nextCycleAt: subscription.nextCycleAt ?? addMonths(today, 1),
        scheduledChangeAt: undefined,
        scheduledPlanId: undefined,
      });
      subscriptionId = subscription.id;
    } else {
      subscriptionId = this.db.subscriptions.create({
        caregiverId: caregiver.id,
        planId: account.planId,
        status: 'active',
        payer: 'corporate',
        corporateAccountId: account.id,
        startedAt: today,
        nextCycleAt: addMonths(today, 1),
      }).id;
    }
    const card = this.cardOf(caregiver.id);
    if (card) {
      if (card.status !== 'active') {
        this.db.benefitCards.update(card.id, { status: 'active', inactivatedAt: undefined });
      }
    } else {
      this.db.benefitCards.create({
        caregiverId: caregiver.id,
        number: this.nextCardNumber(),
        status: 'active',
        issuedAt: today,
      });
    }
    this.db.caregivers.update(caregiver.id, { corporateAccountId: account.id });
    if (from !== account.planId) {
      this.db.planChanges.create({
        subscriptionId,
        from,
        to: account.planId,
        kind: classifyPlanChange(from, account.planId) === 'upgrade' ? 'upgrade' : 'downgrade',
        effectiveAt: today,
        byUserId: this.auth.user()?.id ?? 'system',
      });
    }
    this.audit.write(
      'update',
      'subscription',
      subscriptionId,
      caregiver.id,
      'plano pago pela empresa',
    );
  }

  /** Volta ao Livre: pagador próprio, sem ciclo de cobrança e cartão inativado no mesmo instante. */
  private putOnFreePlan(caregiverId: ID, reason: string): void {
    const today = this.clock.today();
    const subscription = this.subscriptionOf(caregiverId);
    if (subscription) {
      const from = subscription.planId;
      this.db.subscriptions.update(subscription.id, {
        planId: 'livre',
        payer: 'self',
        corporateAccountId: undefined,
        nextCycleAt: undefined,
        scheduledChangeAt: undefined,
        scheduledPlanId: undefined,
        status: 'active',
      });
      if (from !== 'livre') {
        this.db.planChanges.create({
          subscriptionId: subscription.id,
          from,
          to: 'livre',
          kind: 'downgrade',
          effectiveAt: today,
          byUserId: this.auth.user()?.id ?? 'system',
        });
      }
      this.audit.write('update', 'subscription', subscription.id, caregiverId, `plano Livre: ${reason}`);
    }
    const card = this.activeCardOf(caregiverId);
    if (card) {
      this.db.benefitCards.update(card.id, { status: 'inactive', inactivatedAt: today });
    }
    this.db.caregivers.update(caregiverId, { corporateAccountId: undefined });
  }

  private nextCardNumber(): string {
    const used = new Set(this.db.benefitCards.all().map((c) => c.number));
    let sequence = 1000 + (this.db.benefitCards.size() + 1) * 7;
    let number = formatCardNumber(sequence);
    while (used.has(number)) {
      sequence += 1;
      number = formatCardNumber(sequence);
    }
    return number;
  }
}
