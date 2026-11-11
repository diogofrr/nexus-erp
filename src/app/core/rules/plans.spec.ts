import { describe, expect, it } from 'vitest';
import {
  BENEFIT_LABELS,
  DEFAULT_PLANS,
  PLAN_NOT_INCLUDED_NOTICE,
  PLAN_ORDER,
  averageGrossPerSubscriberCents,
  averageNetPerSubscriberCents,
  canAccessActivity,
  canAccessGroupTherapy,
  canSeePrioritySlots,
  cardDiscountCents,
  classifyPlanChange,
  formatCardNumber,
  hasBenefitCard,
  isPaidPlan,
  minimumPlanFor,
  nextBillingDate,
  paidOnlyBenefits,
  planBenefits,
  planChangeTiming,
  planHasBenefit,
  planPriceCents,
  sessionPriceCents,
} from './plans';

describe('Planos (RN-PLN-01 a 10; Figura 1)', () => {
  it('são quatro planos, nesta ordem e com estes preços; não existe plano Integral nem R$ 169,90', () => {
    expect(PLAN_ORDER).toEqual(['livre', 'essencial', 'cuida', 'sustenta']);
    expect(DEFAULT_PLANS.map((p) => p.monthlyPriceCents)).toEqual([0, 4990, 11990, 14990]);
    expect(DEFAULT_PLANS.map((p) => p.name)).toEqual([
      'Nexus Livre',
      'Nexus Essencial',
      'Nexus Cuida',
      'Nexus Sustenta',
    ]);
    expect(DEFAULT_PLANS.some((p) => p.monthlyPriceCents === 16990)).toBe(false);
    expect(planPriceCents('cuida')).toBe(11990);
  });

  it('os benefícios são progressivos (cada plano inclui o anterior)', () => {
    expect(planBenefits('livre')).toHaveLength(5);
    expect(planBenefits('essencial')).toHaveLength(9);
    expect(planBenefits('cuida')).toHaveLength(12);
    expect(planBenefits('sustenta')).toHaveLength(15);
    PLAN_ORDER.slice(1).forEach((plan, i) => {
      const previous = planBenefits(PLAN_ORDER[i] as never);
      previous.forEach((b) => expect(planBenefits(plan)).toContain(b));
    });
    Object.keys(BENEFIT_LABELS).forEach((key) =>
      expect(planBenefits('sustenta')).toContain(key as never),
    );
  });

  it('o que é exclusivo de plano pago: cartão, organização ampliada, conteúdos exclusivos, condições na rede, grupos e capacitações', () => {
    const paidOnly = paidOnlyBenefits();
    [
      'card_discounts',
      'extended_organization',
      'exclusive_content',
      'network_special_conditions',
      'support_groups',
      'trainings',
    ].forEach((b) => expect(paidOnly).toContain(b as never));
    expect(paidOnly).not.toContain('content' as never);
    expect(minimumPlanFor('card_discounts')).toBe('essencial');
    expect(minimumPlanFor('support_groups')).toBe('cuida');
    expect(minimumPlanFor('network_differentiated_benefits')).toBe('sustenta');
    expect(planHasBenefit('livre', 'network_initial_access')).toBe(true);
    expect(planHasBenefit('livre', 'card_discounts')).toBe(false);
  });

  it('cartão só com plano pago (RN-CRT-02) e terapia de grupo só a partir do Cuida (docs/20)', () => {
    expect(hasBenefitCard('livre')).toBe(false);
    expect(hasBenefitCard('essencial')).toBe(true);
    expect(canAccessGroupTherapy('essencial')).toBe(false);
    expect(canAccessGroupTherapy('cuida')).toBe(true);
    expect(canAccessGroupTherapy('sustenta')).toBe(true);
    expect(isPaidPlan('livre')).toBe(false);
    expect(isPaidPlan('sustenta')).toBe(true);
  });

  it('elegibilidade por tipo de encontro (docs/20): roda aberta e capacitação para todos, terapia de grupo só Cuida e Sustenta', () => {
    expect(canAccessActivity('essencial', 'group_therapy')).toMatchObject({
      allowed: false,
      reason: 'A terapia de grupo faz parte dos planos Cuida e Sustenta.',
      minPlan: 'cuida',
    });
    expect(canAccessActivity('livre', 'group_therapy').allowed).toBe(false);
    expect(canAccessActivity('cuida', 'group_therapy')).toMatchObject({ allowed: true, requiresEligibility: false });
    expect(canAccessActivity('sustenta', 'group_therapy').allowed).toBe(true);
    (['livre', 'essencial', 'cuida', 'sustenta'] as const).forEach((plan) => {
      expect(canAccessActivity(plan, 'training')).toMatchObject({ allowed: true, minPlan: null });
      expect(canAccessActivity(plan, 'open_circle')).toMatchObject({ allowed: true, minPlan: null });
    });
  });

  it('troca de plano: upgrade na hora, downgrade no fim do ciclo, mesmo plano bloqueado (RN-PLN-14)', () => {
    expect(classifyPlanChange('livre', 'essencial')).toBe('upgrade');
    expect(classifyPlanChange('cuida', 'essencial')).toBe('downgrade');
    expect(planChangeTiming('livre', 'essencial')).toBe('immediate');
    expect(planChangeTiming('cuida', 'essencial')).toBe('end_of_cycle');
    expect(planChangeTiming('cuida', 'cuida')).toBe('blocked');
  });

  it('vagas prioritárias: Cuida, Sustenta ou alerta amarelo, inclusive no Livre (AC-M05-13)', () => {
    expect(canSeePrioritySlots('cuida', false)).toBe(true);
    expect(canSeePrioritySlots('sustenta', false)).toBe(true);
    expect(canSeePrioritySlots('livre', true)).toBe(true);
    expect(canSeePrioritySlots('livre', false)).toBe(false);
    expect(canSeePrioritySlots('essencial', false)).toBe(false);
  });

  it('o aviso obrigatório da contratação está no texto (RN-PLN-22; desde o docs/20 o atendimento psicológico entra no Cuida e no Sustenta)', () => {
    expect(PLAN_NOT_INCLUDED_NOTICE).toBe(
      'A mensalidade não inclui os serviços da rede.',
    );
  });
});

describe('Valores (Quadro 4, RN-FIN-08, 09)', () => {
  it('valor médio por assinante é R$ 100,90 e o líquido, com 11%, é R$ 89,80', () => {
    expect(averageGrossPerSubscriberCents()).toBe(10090);
    expect(averageNetPerSubscriberCents()).toBe(8980);
  });

  it('4 Essencial + 3 Cuida + 3 Sustenta = R$ 1.009,00 por 10 assinantes', () => {
    expect(4 * 4990 + 3 * 11990 + 3 * 14990).toBe(100_900);
  });

  it('mudar o preço recalcula média e líquido (AC-M10-06)', () => {
    const prices = { essencial: 5990, cuida: 11990, sustenta: 14990 };
    expect(averageGrossPerSubscriberCents(prices)).toBe(10490);
    expect(averageNetPerSubscriberCents(prices)).toBe(9336);
  });

  it('mix com frações imprecisas é normalizado', () => {
    expect(
      averageGrossPerSubscriberCents(
        { essencial: 4990, cuida: 11990, sustenta: 14990 },
        { essencial: 4, cuida: 3, sustenta: 3 },
      ),
    ).toBe(10090);
    expect(
      averageGrossPerSubscriberCents(
        { essencial: 4990, cuida: 11990, sustenta: 14990 },
        { essencial: 0, cuida: 0, sustenta: 0 },
      ),
    ).toBe(0);
  });

  it('sessão de R$ 120,00 com desconto de 0%, 10%, 15% e 20% (RN-ATD-05)', () => {
    expect(
      DEFAULT_PLANS.map((p) => sessionPriceCents(12000, p.psychSessionDiscountPercent)),
    ).toEqual([12000, 10800, 10200, 9600]);
    expect(DEFAULT_PLANS.map((p) => p.priorityScheduling)).toEqual([false, false, true, true]);
  });

  it('desconto do cartão: R$ 100,00 a 10% resulta R$ 10,00 (AC-M04-07)', () => {
    expect(cardDiscountCents(10000, 10)).toBe(1000);
    expect(cardDiscountCents(3350, 12)).toBe(402);
    expect(cardDiscountCents(10000, 0)).toBe(0);
  });

  it('número do cartão fictício no formato NX-0000-0000', () => {
    expect(formatCardNumber(1)).toBe('NX-0000-0001');
    expect(formatCardNumber(12345678)).toBe('NX-1234-5678');
    expect(formatCardNumber(1007)).toMatch(/^NX-\d{4}-\d{4}$/);
  });
});

describe('data de cobrança (RN-PLN-14, QAC-004)', () => {
  it('o dia de cobrança é o do início, cortado só nos meses curtos, e volta ao dia certo depois', () => {
    // Início em 31/01: 28/02, 31/03, 30/04, 31/05 (nunca "escorrega" para o 28).
    expect(nextBillingDate('2026-01-31', '2026-01-31')).toBe('2026-02-28');
    expect(nextBillingDate('2026-01-31', '2026-02-28')).toBe('2026-03-31');
    expect(nextBillingDate('2026-01-31', '2026-03-31')).toBe('2026-04-30');
    expect(nextBillingDate('2026-01-31', '2026-04-30')).toBe('2026-05-31');
  });

  it('é sempre depois da data de referência, mesmo com meses de atraso, e conta o ano bissexto', () => {
    expect(nextBillingDate('2026-01-31', '2026-03-01')).toBe('2026-03-31');
    expect(nextBillingDate('2026-01-31', '2026-06-15')).toBe('2026-06-30');
    expect(nextBillingDate('2027-01-31', '2028-01-31')).toBe('2028-02-29');
    expect(nextBillingDate('2026-11-04', '2026-11-04')).toBe('2026-12-04');
    expect(nextBillingDate('2026-11-04', '2026-12-03')).toBe('2026-12-04');
  });
});
