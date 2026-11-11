/**
 * Planos, benefícios, Cartão Nexus e valores (RN-PLN-01 a 22, RN-CRT-*, A.1, A.2).
 * Preços em centavos. Os benefícios são progressivos: cada plano pago inclui o do anterior.
 */
import { addMonths, compareDates } from '../clock/date-utils';
import { ActivityKind } from '../models/groups';
import { BenefitKey, PaidPlanId, Plan, PlanId } from '../models/plans';
import { Cents, ISODate } from '../models/primitives';
import { roundHalfUp } from './numbers';
import { PLAN_QUOTAS } from './plan-quotas';

export const PLAN_ORDER: readonly PlanId[] = ['livre', 'essencial', 'cuida', 'sustenta'];
export const PAID_PLAN_IDS: readonly PaidPlanId[] = ['essencial', 'cuida', 'sustenta'];

/** Plano sem carimbos: o `Database` os preenche ao gravar o seed. */
export type PlanDefinition = Omit<Plan, 'createdAt' | 'updatedAt'>;

const LIVRE_BENEFITS: BenefitKey[] = [
  'app_access',
  'basic_organization',
  'agenda_reminders',
  'content',
  'network_initial_access',
];
const ESSENCIAL_EXTRA: BenefitKey[] = [
  'extended_organization',
  'card_discounts',
  'exclusive_content',
  'network_special_conditions',
];
const CUIDA_EXTRA: BenefitKey[] = ['greater_organization_support', 'support_groups', 'trainings'];
const SUSTENTA_EXTRA: BenefitKey[] = [
  'close_organizational_follow_up',
  'higher_support_level',
  'network_differentiated_benefits',
];

/** Catálogo padrão (Figura 1). Descontos e prioridade de agenda são suposições S-02, editáveis em M15. */
export const DEFAULT_PLANS: readonly PlanDefinition[] = [
  {
    id: 'livre',
    name: 'Nexus Livre',
    monthlyPriceCents: 0,
    benefits: [...LIVRE_BENEFITS],
    psychSessionDiscountPercent: 0,
    priorityScheduling: false,
    color: 'slate_blue',
  },
  {
    id: 'essencial',
    name: 'Nexus Essencial',
    monthlyPriceCents: 4990,
    benefits: [...LIVRE_BENEFITS, ...ESSENCIAL_EXTRA],
    psychSessionDiscountPercent: 10,
    priorityScheduling: false,
    color: 'light_blue',
  },
  {
    id: 'cuida',
    name: 'Nexus Cuida',
    monthlyPriceCents: 11990,
    benefits: [...LIVRE_BENEFITS, ...ESSENCIAL_EXTRA, ...CUIDA_EXTRA],
    psychSessionDiscountPercent: 15,
    priorityScheduling: true,
    color: 'medium_blue',
  },
  {
    id: 'sustenta',
    name: 'Nexus Sustenta',
    monthlyPriceCents: 14990,
    benefits: [...LIVRE_BENEFITS, ...ESSENCIAL_EXTRA, ...CUIDA_EXTRA, ...SUSTENTA_EXTRA],
    psychSessionDiscountPercent: 20,
    priorityScheduling: true,
    color: 'gold',
  },
];

/** Rótulos em pt-BR dos benefícios (Figura 1), sem jargão. */
export const BENEFIT_LABELS: Readonly<Record<BenefitKey, string>> = {
  app_access: 'Acesso ao aplicativo',
  basic_organization: 'Organização básica',
  agenda_reminders: 'Agenda e lembretes',
  content: 'Conteúdos',
  network_initial_access: 'Acesso inicial à rede',
  extended_organization: 'Organização ampliada',
  card_discounts: 'Descontos exclusivos do Cartão Nexus',
  exclusive_content: 'Conteúdos exclusivos',
  network_special_conditions: 'Condições especiais na rede',
  greater_organization_support: 'Maior suporte à organização',
  support_groups: 'Terapia de grupo',
  trainings: 'Capacitações',
  close_organizational_follow_up: 'Acompanhamento organizacional mais próximo',
  higher_support_level: 'Maior nível de suporte',
  network_differentiated_benefits: 'Benefícios diferenciados na rede',
};

/**
 * Aviso obrigatório na contratação (RN-PLN-22). Desde o docs/20 o atendimento psicológico individual FAZ parte dos planos
 * Cuida e Sustenta (com cota mensal), então o aviso só fala dos serviços da rede.
 */
export const PLAN_NOT_INCLUDED_NOTICE = 'A mensalidade não inclui os serviços da rede.';

function definition(
  planId: PlanId,
  plans: readonly PlanDefinition[] = DEFAULT_PLANS,
): PlanDefinition {
  return plans.find((p) => p.id === planId) as PlanDefinition;
}

export function planRank(planId: PlanId): number {
  return PLAN_ORDER.indexOf(planId);
}

export function isPaidPlan(planId: PlanId): planId is PaidPlanId {
  return planId !== 'livre';
}

export function planPriceCents(
  planId: PlanId,
  plans: readonly PlanDefinition[] = DEFAULT_PLANS,
): Cents {
  return definition(planId, plans).monthlyPriceCents;
}

export function planBenefits(
  planId: PlanId,
  plans: readonly PlanDefinition[] = DEFAULT_PLANS,
): readonly BenefitKey[] {
  return definition(planId, plans).benefits;
}

export function planHasBenefit(
  planId: PlanId,
  benefit: BenefitKey,
  plans: readonly PlanDefinition[] = DEFAULT_PLANS,
): boolean {
  return planBenefits(planId, plans).includes(benefit);
}

/** Benefícios que o Livre não tem: exclusivos de plano pago (RN-PLN-09). */
export function paidOnlyBenefits(): BenefitKey[] {
  const free = new Set(planBenefits('livre'));
  return [...planBenefits('sustenta')].filter((b) => !free.has(b));
}

/** O menor plano que inclui o benefício. */
export function minimumPlanFor(benefit: BenefitKey): PlanId {
  return PLAN_ORDER.find((p) => planHasBenefit(p, benefit)) ?? 'sustenta';
}

/** Descontos do Cartão Nexus: só assinatura paga (RN-PLN-08, RN-CRT-02). */
export function hasBenefitCard(planId: PlanId): boolean {
  return planHasBenefit(planId, 'card_discounts');
}

/** Terapia de grupo: só Cuida e Sustenta (docs/20; RN-GRP-02 lida à luz do docs/20). */
export function canAccessGroupTherapy(planId: PlanId): boolean {
  return PLAN_QUOTAS[planId].groupTherapyPerMonth > 0;
}

export interface ActivityAccess {
  allowed: boolean;
  /** Mensagem de bloqueio (só para a equipe e para o domínio; o app do cuidador não anuncia o que o plano não inclui). */
  reason?: string;
  /** Compatibilidade: a terapia de grupo não exige mais indicação do psicólogo (docs/20). Sempre `false`. */
  requiresEligibility: false;
  /** Plano mínimo da atividade (`null` = qualquer plano). */
  minPlan: 'cuida' | null;
}

/** Plano mínimo por tipo de atividade (docs/20): só a terapia de grupo é do Cuida em diante. */
export function activityMinPlan(kind: ActivityKind): 'cuida' | null {
  return kind === 'group_therapy' ? 'cuida' : null;
}

/**
 * Acesso do plano ao tipo de atividade (docs/20): roda aberta para todos; capacitação para todos os cadastrados (incluída
 * ou avulsa, ver `enrollmentOffer`); terapia de grupo só Cuida e Sustenta.
 */
export function canAccessActivity(planId: PlanId, kind: ActivityKind): ActivityAccess {
  const minPlan = activityMinPlan(kind);
  if (minPlan === 'cuida' && !canAccessGroupTherapy(planId)) {
    return {
      allowed: false,
      reason: 'A terapia de grupo faz parte dos planos Cuida e Sustenta.',
      requiresEligibility: false,
      minPlan,
    };
  }
  return { allowed: true, requiresEligibility: false, minPlan };
}

export type PlanChangeKind = 'upgrade' | 'downgrade' | 'same';

export function classifyPlanChange(from: PlanId, to: PlanId): PlanChangeKind {
  const diff = planRank(to) - planRank(from);
  return diff > 0 ? 'upgrade' : diff < 0 ? 'downgrade' : 'same';
}

/** Quando a troca vale (RN-PLN-14): upgrade na hora; downgrade e cancelamento no fim do ciclo; mesmo plano é bloqueado. */
export function planChangeTiming(
  from: PlanId,
  to: PlanId,
): 'immediate' | 'end_of_cycle' | 'blocked' {
  const kind = classifyPlanChange(from, to);
  return kind === 'same' ? 'blocked' : kind === 'upgrade' ? 'immediate' : 'end_of_cycle';
}

/** Vagas prioritárias: Cuida e Sustenta, ou cuidador em alerta amarelo, inclusive no Livre (AC-M05-13, RN-ATD-12). */
export function canSeePrioritySlots(
  planId: PlanId,
  hasYellowAlert: boolean,
  plans: readonly PlanDefinition[] = DEFAULT_PLANS,
): boolean {
  return definition(planId, plans).priorityScheduling || hasYellowAlert;
}

// ===== Valores =====

/** Mix de assinantes pagos em pontos-base (10000 = 100%). */
function mixBasisPoints(mix: Readonly<Record<PaidPlanId, number>>): Record<PaidPlanId, number> {
  return {
    essencial: Math.round(mix.essencial * 10000),
    cuida: Math.round(mix.cuida * 10000),
    sustenta: Math.round(mix.sustenta * 10000),
  };
}

export const DEFAULT_PLAN_MIX: Readonly<Record<PaidPlanId, number>> = {
  essencial: 0.4,
  cuida: 0.3,
  sustenta: 0.3,
};
export const DEFAULT_PLAN_PRICES: Readonly<Record<PaidPlanId, Cents>> = {
  essencial: 4990,
  cuida: 11990,
  sustenta: 14990,
};
/** Impostos e taxas das plataformas de pagamento (RN-PLN-17). */
export const DEFAULT_FEES_RATE = 0.11;

/**
 * Valor médio pago por assinante (Quadro 4): 4 Essencial + 3 Cuida + 3 Sustenta = R$ 1.009,00 por 10,
 * ou seja, R$ 100,90 (10090 centavos).
 */
export function averageGrossPerSubscriberCents(
  prices: Readonly<Record<PaidPlanId, Cents>> = DEFAULT_PLAN_PRICES,
  mix: Readonly<Record<PaidPlanId, number>> = DEFAULT_PLAN_MIX,
): Cents {
  const bp = mixBasisPoints(mix);
  const totalBp = bp.essencial + bp.cuida + bp.sustenta;
  if (totalBp === 0) {
    return 0;
  }
  const weighted =
    bp.essencial * prices.essencial + bp.cuida * prices.cuida + bp.sustenta * prices.sustenta;
  return roundHalfUp(weighted / totalBp, 0);
}

/** Líquido médio por assinante: bruto x (1 - 11%) = R$ 89,80 (8980 centavos). */
export function averageNetPerSubscriberCents(
  prices: Readonly<Record<PaidPlanId, Cents>> = DEFAULT_PLAN_PRICES,
  mix: Readonly<Record<PaidPlanId, number>> = DEFAULT_PLAN_MIX,
  feesRate: number = DEFAULT_FEES_RATE,
): Cents {
  return roundHalfUp(averageGrossPerSubscriberCents(prices, mix) * (1 - feesRate), 0);
}

/**
 * Valor da sessão com um desconto percentual (RN-ATD-05 antiga). Desde o docs/20 o preço da sessão vem da cota
 * (`plan-quotas.ts`): dentro dela R$ 0,00, fora dela o avulso. Mantida só como conta genérica.
 */
export function sessionPriceCents(baseCents: Cents, discountPercent: number): Cents {
  return roundHalfUp(baseCents * (1 - discountPercent / 100), 0);
}

/** Desconto do Cartão Nexus sobre um valor (R$ 100,00 a 10% = R$ 10,00, AC-M04-07). */
export function cardDiscountCents(amountCents: Cents, discountPercent: number): Cents {
  return roundHalfUp((amountCents * discountPercent) / 100, 0);
}

/**
 * Próxima data de cobrança de uma assinatura paga, SEMPRE depois de `after` (RN-PLN-14, QAC-004). O dia de cobrança é o
 * do início, cortado só nos meses curtos: quem assinou em 31/01 paga em 28/02 e volta a pagar em 31/03, 30/04... O ciclo
 * é calculado do início (`addMonths(startedAt, n)`) e nunca da data anterior já cortada, senão o dia escorrega para o 28
 * e não volta mais.
 */
export function nextBillingDate(startedAt: ISODate, after: ISODate): ISODate {
  let months = 1;
  let next = addMonths(startedAt, months);
  // O limite protege de um início absurdamente antigo; 1200 meses são 100 anos de assinatura.
  while (compareDates(next, after) <= 0 && months < 1200) {
    months += 1;
    next = addMonths(startedAt, months);
  }
  return next;
}

/** Número do cartão fictício `NX-0000-0000` (RN-CRT-12) a partir de um sequencial. */
export function formatCardNumber(sequence: number): string {
  const padded = String(Math.abs(Math.trunc(sequence)) % 100_000_000).padStart(8, '0');
  return `NX-${padded.slice(0, 4)}-${padded.slice(4)}`;
}
