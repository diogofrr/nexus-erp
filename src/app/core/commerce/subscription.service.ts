import { Injectable, inject } from '@angular/core';
import { AuditLogService } from '../audit/audit-log.service';
import { SessionStore } from '../auth/session.store';
import { Clock } from '../clock/clock.service';
import { addMonths, compareDates, dateOf } from '../clock/date-utils';
import { Database } from '../data/database';
import { formatDate } from '../format/format';
import { GroupMembershipService } from '../groups/group-membership.service';
import {
  Activity,
  BenefitCard,
  CardUsage,
  ID,
  ISODate,
  Partner,
  PlanChange,
  PlanId,
  Subscription,
} from '../models';
import {
  canAccessGroupsAndTrainings,
  cardDiscountCents,
  classifyPlanChange,
  formatCardNumber,
  isPaidPlan,
} from '../rules/plans';

/** Nomes curtos dos planos para frases ("Cuida para Essencial"). */
export const PLAN_SHORT_NAMES: Readonly<Record<PlanId, string>> = {
  livre: 'Livre',
  essencial: 'Essencial',
  cuida: 'Cuida',
  sustenta: 'Sustenta',
};

/** Troca ou cancelamento que já foi pedido e ainda não valeu (A-18: rótulo derivado). */
export interface ScheduledChange {
  kind: 'cancel' | 'change';
  from: PlanId;
  to: PlanId;
  at: ISODate;
  /** "Mudança agendada: Cuida para Essencial em 18/11/2026" ou "Cancelamento agendado para 18/11/2026". */
  label: string;
}

export type SubscriptionDisplay = 'active' | 'change_scheduled' | 'cancel_scheduled' | 'cancelled';

export const SUBSCRIPTION_DISPLAY_LABELS: Readonly<Record<SubscriptionDisplay, string>> = {
  active: 'Ativa',
  change_scheduled: 'Mudança agendada',
  cancel_scheduled: 'Cancelamento agendado',
  cancelled: 'Cancelada',
};

/** Estado mostrado ao usuário. O modelo guarda a descida de plano como `cancel_scheduled`; a tela não (A-18). */
export function subscriptionDisplay(
  sub: Pick<Subscription, 'status' | 'scheduledPlanId'>,
): SubscriptionDisplay {
  if (sub.status === 'cancelled') {
    return 'cancelled';
  }
  if (sub.status === 'cancel_scheduled') {
    return sub.scheduledPlanId === 'livre' || sub.scheduledPlanId === undefined
      ? 'cancel_scheduled'
      : 'change_scheduled';
  }
  return 'active';
}

export function scheduledChangeOf(
  sub: Pick<Subscription, 'status' | 'planId' | 'scheduledPlanId' | 'scheduledChangeAt'>,
): ScheduledChange | null {
  if (sub.status !== 'cancel_scheduled' || !sub.scheduledChangeAt) {
    return null;
  }
  const to = sub.scheduledPlanId ?? 'livre';
  const cancel = to === 'livre';
  return {
    kind: cancel ? 'cancel' : 'change',
    from: sub.planId,
    to,
    at: sub.scheduledChangeAt,
    label: cancel
      ? `Cancelamento agendado para ${formatDate(sub.scheduledChangeAt)}`
      : `Mudança agendada: ${PLAN_SHORT_NAMES[sub.planId]} para ${PLAN_SHORT_NAMES[to]} em ${formatDate(sub.scheduledChangeAt)}`,
  };
}

export class SubscriptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SubscriptionError';
  }
}

export interface LostGroup {
  activityId: ID;
  title: string;
  startDate: ISODate;
}

/** O que acontece se a troca for confirmada, para mostrar ANTES (F03, passo 3). */
export interface ChangeQuote {
  from: PlanId;
  to: PlanId;
  kind: 'upgrade' | 'downgrade' | 'cancel' | 'same';
  timing: 'immediate' | 'end_of_cycle' | 'blocked';
  /** Quando vale. */
  effectiveAt: ISODate;
  /** Quando a cobrança do novo valor começa (só no upgrade). */
  billingFrom?: ISODate;
  blockedReason?: string;
  issuesCard: boolean;
  inactivatesCard: boolean;
  /** Turmas que o cuidador deixa (só em descida ou cancelamento). */
  lostGroups: LostGroup[];
  /** A frase do efeito, pronta para o painel. */
  effect: string;
  /** Texto do botão: "Fazer upgrade para o Cuida", "Agendar mudança para o Essencial". */
  actionLabel: string;
}

export interface ChangeResult {
  subscription: Subscription;
  kind: ChangeQuote['kind'];
  /** Mensagem do toast: "Plano alterado para Cuida. Cartão NX-0000-0042 emitido." */
  message: string;
  card?: BenefitCard;
}

export interface CardUsageInput {
  cardId: ID;
  partnerId: ID;
  date: ISODate;
  amountCents: number;
}

/**
 * Assinaturas, troca de plano e Cartão Nexus (M04, RN-PLN-14, RN-CRT-02, 03, 10 a 12). Regras:
 * upgrade vale na hora e emite o cartão; descida e cancelamento valem no fim do ciclo; o plano pago por
 * empresa só muda pelo contrato; troca para o mesmo plano é bloqueada. A cobrança é SIMULADA: não há
 * pagamento, só o valor e a data do próximo ciclo.
 */
@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly audit = inject(AuditLogService);
  private readonly session = inject(SessionStore);
  private readonly membership = inject(GroupMembershipService);

  // ===== Leitura =====

  /** A assinatura vigente do cuidador (a não cancelada mais recente; senão a mais recente). */
  current(caregiverId: ID): Subscription | undefined {
    const all = this.db.subscriptions.query((s) => s.caregiverId === caregiverId);
    const live = all.filter((s) => s.status !== 'cancelled');
    const pool = live.length > 0 ? live : all;
    return [...pool].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  }

  planOf(caregiverId: ID): PlanId {
    const sub = this.current(caregiverId);
    return sub && sub.status !== 'cancelled' ? sub.planId : 'livre';
  }

  /** O cartão do cuidador (o ativo, ou o último). */
  cardOf(caregiverId: ID): BenefitCard | undefined {
    const cards = this.db.benefitCards.query((c) => c.caregiverId === caregiverId);
    return (
      cards.find((c) => c.status === 'active') ??
      [...cards].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))[0]
    );
  }

  /** Histórico de trocas, da mais recente para a mais antiga. */
  historyOf(subscriptionId: ID): PlanChange[] {
    return this.db.planChanges
      .query((p) => p.subscriptionId === subscriptionId)
      .sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt) || b.id.localeCompare(a.id));
  }

  usagesOf(cardId: ID): CardUsage[] {
    return this.db.cardUsages
      .query((u) => u.cardId === cardId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  /** Parceiros que aceitam o cartão: só `active` (RN-CRT-10, AC-M04-07). */
  activePartners(): Partner[] {
    return this.db.partners
      .query((p) => p.status === 'active')
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  /** Nome da empresa que paga o plano, se for o caso. */
  payerCompany(sub: Subscription): string | null {
    if (sub.payer !== 'corporate') {
      return null;
    }
    const id = sub.corporateAccountId;
    return (id ? this.db.corporateAccounts.get(id)?.companyName : undefined) ?? 'a empresa';
  }

  // ===== Antes de confirmar =====

  quote(sub: Subscription, to: PlanId): ChangeQuote {
    const today = this.clock.today();
    const from = sub.planId;
    const raw = classifyPlanChange(from, to);
    const kind: ChangeQuote['kind'] =
      raw === 'same' ? 'same' : raw === 'upgrade' ? 'upgrade' : to === 'livre' ? 'cancel' : 'downgrade';
    const cycle = sub.nextCycleAt ?? addMonths(today, 1);
    const base: ChangeQuote = {
      from,
      to,
      kind,
      timing: kind === 'upgrade' ? 'immediate' : 'end_of_cycle',
      effectiveAt: kind === 'upgrade' ? today : cycle,
      issuesCard: false,
      inactivatesCard: false,
      lostGroups: [],
      effect: '',
      actionLabel: '',
    };
    const blocked = this.blockedReason(sub, kind);
    if (blocked) {
      return { ...base, timing: 'blocked', blockedReason: blocked, effect: blocked };
    }
    if (kind === 'upgrade') {
      const billingFrom = isPaidPlan(from) ? cycle : addMonths(today, 1);
      const hasCard = this.hasActiveCard(sub.caregiverId);
      return {
        ...base,
        billingFrom,
        issuesCard: !hasCard,
        effect: `Vale hoje.${hasCard ? '' : ' O Cartão Nexus é emitido agora.'} A cobrança de ${this.priceText(to)} começa no próximo ciclo, em ${formatDate(billingFrom)}.`,
        actionLabel: `Fazer upgrade para o ${PLAN_SHORT_NAMES[to]}`,
      };
    }
    const lostGroups = this.groupsLostAfter(sub.caregiverId, cycle, to);
    const lostText =
      lostGroups.length > 0
        ? ` Ao mudar, o cuidador sai das turmas que começam depois dessa data: ${lostGroups
            .map((g) => `${g.title} (${formatDate(g.startDate)})`)
            .join(', ')}. As turmas em andamento continuam.`
        : '';
    if (kind === 'cancel') {
      return {
        ...base,
        inactivatesCard: true,
        lostGroups,
        effect: `O cancelamento fica agendado para ${formatDate(cycle)}. Nessa data o cartão deixa de valer e o plano vira Livre.${lostText}`,
        actionLabel: 'Agendar cancelamento',
      };
    }
    return {
      ...base,
      lostGroups,
      effect: `Vale no fim do ciclo, em ${formatDate(cycle)}. Até lá, o ${PLAN_SHORT_NAMES[from]} continua${canAccessGroupsAndTrainings(from) ? ', inclusive os grupos' : ''}.${lostText}`,
      actionLabel: `Agendar mudança para o ${PLAN_SHORT_NAMES[to]}`,
    };
  }

  // ===== Ações =====

  /**
   * Troca, agenda ou cancela conforme a regra. Lança `SubscriptionError` com a frase para a tela. `author` é quem
   * fez a troca no histórico (o aplicativo do cuidador passa o id do cuidador); sem ele vale a sessão da equipe, senão `system`.
   */
  changePlan(subscriptionId: ID, to: PlanId, author?: ID): ChangeResult {
    const sub = this.db.subscriptions.require(subscriptionId);
    const quote = this.quote(sub, to);
    if (quote.timing === 'blocked') {
      throw new SubscriptionError(quote.blockedReason ?? 'Esta troca não é possível agora.');
    }
    const today = this.clock.today();
    const byUserId = author ?? this.session.user()?.id ?? 'system';
    this.removeFutureChanges(sub.id);
    if (quote.kind === 'upgrade') {
      const wasFree = sub.planId === 'livre';
      const updated = this.db.subscriptions.update(sub.id, {
        planId: to,
        status: 'active',
        ...(wasFree ? { startedAt: today } : {}),
        nextCycleAt: wasFree ? addMonths(today, 1) : (sub.nextCycleAt ?? addMonths(today, 1)),
        scheduledChangeAt: undefined,
        scheduledPlanId: undefined,
      });
      this.recordChange(sub.id, sub.planId, to, 'upgrade', today, byUserId);
      const card = this.ensureActiveCard(sub.caregiverId);
      this.audit.write(
        'update',
        'subscription',
        sub.id,
        sub.caregiverId,
        `upgrade de ${PLAN_SHORT_NAMES[sub.planId]} para ${PLAN_SHORT_NAMES[to]}`,
      );
      return {
        subscription: updated,
        kind: 'upgrade',
        card,
        message: `Plano alterado para ${PLAN_SHORT_NAMES[to]}. ${quote.issuesCard ? `Cartão ${card.number} emitido.` : `Cartão ${card.number} segue ativo.`}`,
      };
    }
    const updated = this.db.subscriptions.update(sub.id, {
      status: 'cancel_scheduled',
      scheduledChangeAt: quote.effectiveAt,
      scheduledPlanId: to,
    });
    this.recordChange(
      sub.id,
      sub.planId,
      to,
      quote.kind === 'cancel' ? 'cancel' : 'downgrade',
      quote.effectiveAt,
      byUserId,
    );
    this.audit.write(
      'update',
      'subscription',
      sub.id,
      sub.caregiverId,
      quote.kind === 'cancel' ? 'cancelamento agendado' : 'mudança de plano agendada',
    );
    return {
      subscription: updated,
      kind: quote.kind,
      message:
        quote.kind === 'cancel'
          ? `Cancelamento agendado para ${formatDate(quote.effectiveAt)}.`
          : `Mudança para o ${PLAN_SHORT_NAMES[to]} agendada para ${formatDate(quote.effectiveAt)}.`,
    };
  }

  /** "Manter o plano atual": desiste da mudança ou do cancelamento agendado (reversível, sem diálogo). `author` como em `changePlan`. */
  keepPlan(subscriptionId: ID, author?: ID): Subscription {
    const sub = this.db.subscriptions.require(subscriptionId);
    if (sub.status !== 'cancel_scheduled') {
      throw new SubscriptionError('Não há mudança agendada para desfazer.');
    }
    this.removeFutureChanges(sub.id);
    const updated = this.db.subscriptions.update(sub.id, {
      status: 'active',
      scheduledChangeAt: undefined,
      scheduledPlanId: undefined,
    });
    this.recordChange(
      sub.id,
      sub.planId,
      sub.planId,
      'reactivate',
      this.clock.today(),
      author ?? this.session.user()?.id ?? 'system',
    );
    this.audit.write('update', 'subscription', sub.id, sub.caregiverId, 'plano mantido');
    return updated;
  }

  /** Reativar uma assinatura cancelada cria uma assinatura nova no Livre (escopo M04, estados). `author` como em `changePlan`. */
  reactivate(subscriptionId: ID, author?: ID): Subscription {
    const old = this.db.subscriptions.require(subscriptionId);
    const caregiver = this.db.caregivers.require(old.caregiverId);
    if (old.status !== 'cancelled') {
      throw new SubscriptionError('Só uma assinatura cancelada pode ser reativada.');
    }
    if (caregiver.status === 'closed' || caregiver.status === 'closure_requested') {
      throw new SubscriptionError('O cadastro está encerrado ou com encerramento pedido.');
    }
    const fresh = this.db.subscriptions.create({
      caregiverId: old.caregiverId,
      planId: 'livre',
      status: 'active',
      payer: 'self',
      startedAt: this.clock.today(),
    });
    this.recordChange(
      fresh.id,
      'livre',
      'livre',
      'reactivate',
      this.clock.today(),
      author ?? this.session.user()?.id ?? 'system',
    );
    this.audit.write('create', 'subscription', fresh.id, old.caregiverId, 'assinatura reativada');
    return fresh;
  }

  /** Assinatura de um cadastro novo: Livre por padrão, ou plano pago com cartão emitido (F02, etapa 4). `author` como em `changePlan`. */
  startSubscription(caregiverId: ID, planId: PlanId = 'livre', author?: ID): Subscription {
    const today = this.clock.today();
    const sub = this.db.subscriptions.create({
      caregiverId,
      planId,
      status: 'active',
      payer: 'self',
      startedAt: today,
      ...(planId !== 'livre' ? { nextCycleAt: addMonths(today, 1) } : {}),
    });
    if (planId !== 'livre') {
      this.recordChange(sub.id, 'livre', planId, 'upgrade', today, author ?? this.session.user()?.id ?? 'system');
      this.ensureActiveCard(caregiverId);
    }
    this.audit.write('create', 'subscription', sub.id, caregiverId, `plano ${PLAN_SHORT_NAMES[planId]}`);
    return sub;
  }

  /**
   * Aplica o que já venceu pelo relógio (inclusive o simulado): descida e cancelamento no fim do ciclo
   * (cartão inativado, turmas liberadas pelo M07) e avanço do ciclo das assinaturas pagas. Devolve quantas
   * mudanças valeram. Telas de assinatura e de cadastro chamam ao abrir; o aplicativo também chama ao iniciar
   * e quando a data (real ou simulada) muda (`PlanChangeScheduler`).
   */
  applyDueChanges(): number {
    const today = this.clock.today();
    let applied = 0;
    this.db.subscriptions
      .query(
        (s) =>
          s.status === 'cancel_scheduled' &&
          !!s.scheduledChangeAt &&
          compareDates(s.scheduledChangeAt, today) <= 0,
      )
      .forEach((sub) => {
        const at = sub.scheduledChangeAt as ISODate;
        const to = sub.scheduledPlanId ?? 'livre';
        this.db.subscriptions.update(sub.id, {
          planId: to,
          status: 'active',
          scheduledChangeAt: undefined,
          scheduledPlanId: undefined,
          nextCycleAt: to === 'livre' ? undefined : this.rollForward(addMonths(at, 1), today),
        });
        if (to === 'livre') {
          this.db.benefitCards.updateWhere(
            (c) => c.caregiverId === sub.caregiverId && c.status === 'active',
            { status: 'inactive', inactivatedAt: at },
          );
        }
        // O plano caiu: o M07 tira o cuidador das turmas futuras a que o novo plano não dá acesso (AC-M07-09).
        this.membership.reconcilePlanLoss(sub.caregiverId);
        this.audit.write(
          'update',
          'subscription',
          sub.id,
          sub.caregiverId,
          `valeu a mudança de ${PLAN_SHORT_NAMES[sub.planId]} para ${PLAN_SHORT_NAMES[to]}`,
        );
        applied += 1;
      });
    this.db.subscriptions
      .query(
        (s) =>
          s.status === 'active' &&
          isPaidPlan(s.planId) &&
          !!s.nextCycleAt &&
          compareDates(s.nextCycleAt, today) <= 0,
      )
      .forEach((sub) => {
        this.db.subscriptions.update(sub.id, {
          nextCycleAt: this.rollForward(sub.nextCycleAt as ISODate, today),
        });
      });
    return applied;
  }

  /** Registra o uso do cartão: o desconto vem do parceiro (RN-CRT-11); só parceiro `active` (AC-M04-07). */
  registerCardUsage(input: CardUsageInput): CardUsage {
    const card = this.db.benefitCards.require(input.cardId);
    const partner = this.db.partners.require(input.partnerId);
    if (card.status !== 'active') {
      throw new SubscriptionError('Este cartão está inativo.');
    }
    if (partner.status !== 'active') {
      throw new SubscriptionError('Só parceiros ativos aceitam o cartão.');
    }
    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
      throw new SubscriptionError('Informe o valor da compra.');
    }
    if (compareDates(input.date, this.clock.today()) > 0) {
      throw new SubscriptionError('A data do uso não pode ser no futuro.');
    }
    const usage = this.db.cardUsages.create({
      cardId: card.id,
      partnerId: partner.id,
      date: input.date,
      amountCents: input.amountCents,
      discountCents: cardDiscountCents(input.amountCents, partner.discountPercent),
    });
    this.audit.write('create', 'card_usage', usage.id, card.caregiverId, 'uso do cartão registrado');
    return usage;
  }

  // ===== Internos =====

  private priceText(plan: PlanId): string {
    const cents = this.db.plans.get(plan)?.monthlyPriceCents ?? 0;
    return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
  }

  private hasActiveCard(caregiverId: ID): boolean {
    return this.db.benefitCards.count((c) => c.caregiverId === caregiverId && c.status === 'active') > 0;
  }

  private blockedReason(sub: Subscription, kind: ChangeQuote['kind']): string | null {
    const caregiver = this.db.caregivers.get(sub.caregiverId);
    if (kind === 'same') {
      return 'O cuidador já está neste plano.';
    }
    if (sub.status === 'cancelled') {
      return 'Esta assinatura está cancelada. Reative para voltar a ter um plano.';
    }
    if (caregiver && (caregiver.status === 'closed' || caregiver.status === 'closure_requested')) {
      return 'O cadastro está encerrado ou com encerramento pedido. O plano não muda.';
    }
    if (sub.payer === 'corporate') {
      const company = (this.payerCompany(sub) ?? 'a empresa').replace(/\.$/, '');
      const account = sub.corporateAccountId
        ? this.db.corporateAccounts.get(sub.corporateAccountId)
        : undefined;
      return account?.status === 'suspended'
        ? `O contrato com ${company} está suspenso. O plano pago pela empresa não pode mudar.`
        : `Este plano é pago pela empresa ${company}. A mudança é feita pelo contrato.`;
    }
    return null;
  }

  /** Turmas (grupos e capacitações, a partir do Cuida) que o cuidador perde se mudar para `to`. */
  private groupsLostAfter(caregiverId: ID, effectiveAt: ISODate, to: PlanId): LostGroup[] {
    if (canAccessGroupsAndTrainings(to)) {
      return [];
    }
    return this.db.activityEnrollments
      .query(
        (e) =>
          e.caregiverId === caregiverId && (e.status === 'enrolled' || e.status === 'waitlist'),
      )
      .flatMap((e) => {
        const activity = this.db.activities.get(e.activityId);
        const start = activity ? this.firstMeetingDate(activity) : null;
        return activity && activity.minPlan === 'cuida' && start && compareDates(start, effectiveAt) > 0
          ? [{ activityId: activity.id, title: activity.title, startDate: start }]
          : [];
      });
  }

  private firstMeetingDate(activity: Activity): ISODate | null {
    const first = [...activity.meetings].sort((a, b) => a.startAt.localeCompare(b.startAt))[0];
    return first ? dateOf(first.startAt) : null;
  }

  private rollForward(date: ISODate, today: ISODate): ISODate {
    let next = date;
    let guard = 0;
    while (compareDates(next, today) <= 0 && guard < 600) {
      next = addMonths(next, 1);
      guard += 1;
    }
    return next;
  }

  private removeFutureChanges(subscriptionId: ID): void {
    const today = this.clock.today();
    this.db.planChanges.removeWhere(
      (p) => p.subscriptionId === subscriptionId && compareDates(p.effectiveAt, today) > 0,
    );
  }

  private recordChange(
    subscriptionId: ID,
    from: PlanId,
    to: PlanId,
    kind: PlanChange['kind'],
    effectiveAt: ISODate,
    byUserId: ID,
  ): void {
    this.db.planChanges.create({ subscriptionId, from, to, kind, effectiveAt, byUserId });
  }

  /** Cartão ativo do cuidador: reativa o último inativo ou emite um número novo `NX-0000-0000`. */
  private ensureActiveCard(caregiverId: ID): BenefitCard {
    const active = this.db.benefitCards.find(
      (c) => c.caregiverId === caregiverId && c.status === 'active',
    );
    if (active) {
      return active;
    }
    const previous = this.db.benefitCards
      .query((c) => c.caregiverId === caregiverId)
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))[0];
    if (previous) {
      return this.db.benefitCards.update(previous.id, { status: 'active', inactivatedAt: undefined });
    }
    const highest = this.db.benefitCards
      .list()
      .reduce((max, c) => Math.max(max, Number(c.number.replace(/\D/g, '')) || 0), 0);
    return this.db.benefitCards.create({
      caregiverId,
      number: formatCardNumber(highest + 7),
      status: 'active',
      issuedAt: this.clock.today(),
    });
  }
}
