import { Audited, Cents, ID, ISODate } from './primitives';

export type PlanId = 'livre' | 'essencial' | 'cuida' | 'sustenta';

/** Planos pagos (os únicos com preço e Cartão Nexus). */
export type PaidPlanId = Exclude<PlanId, 'livre'>;

export type BenefitKey =
  // Livre
  | 'app_access'
  | 'basic_organization'
  | 'agenda_reminders'
  | 'content'
  | 'network_initial_access'
  // Essencial
  | 'extended_organization'
  | 'card_discounts'
  | 'exclusive_content'
  | 'network_special_conditions'
  // Cuida
  | 'greater_organization_support'
  | 'support_groups'
  | 'trainings'
  // Sustenta
  | 'close_organizational_follow_up'
  | 'higher_support_level'
  | 'network_differentiated_benefits';

/** Cores semânticas dos planos (Figura 1). O UI mapeia para tokens do design system. */
export type PlanColor = 'slate_blue' | 'light_blue' | 'medium_blue' | 'gold';

/** Plano (M04). O `id` é o próprio `PlanId`. */
export interface Plan extends Audited {
  id: PlanId;
  name: string;
  monthlyPriceCents: Cents;
  /** Acumulativo, conforme a Figura 1 (RN-PLN-03). */
  benefits: BenefitKey[];
  /** [suposição S-02] Desconto na sessão com psicólogo da Nexus: 0, 10, 15, 20. */
  psychSessionDiscountPercent: number;
  /** [suposição S-02] Prioridade de vaga: Cuida e Sustenta. */
  priorityScheduling: boolean;
  color: PlanColor;
}

export type SubscriptionStatus = 'active' | 'cancel_scheduled' | 'cancelled';

export interface Subscription extends Audited {
  caregiverId: ID;
  planId: PlanId;
  status: SubscriptionStatus;
  payer: 'self' | 'corporate';
  corporateAccountId?: ID;
  startedAt: ISODate;
  nextCycleAt?: ISODate;
  scheduledChangeAt?: ISODate;
  scheduledPlanId?: PlanId;
}

export interface PlanChange extends Audited {
  subscriptionId: ID;
  from: PlanId;
  to: PlanId;
  kind: 'upgrade' | 'downgrade' | 'cancel' | 'reactivate';
  effectiveAt: ISODate;
  byUserId: ID;
}

export interface BenefitCard extends Audited {
  caregiverId: ID;
  /** Formato `NX-0000-0000` (RN-CRT-12). */
  number: string;
  status: 'active' | 'inactive';
  issuedAt: ISODate;
  inactivatedAt?: ISODate;
}

export interface CardUsage extends Audited {
  cardId: ID;
  partnerId: ID;
  date: ISODate;
  amountCents: Cents;
  discountCents: Cents;
}
