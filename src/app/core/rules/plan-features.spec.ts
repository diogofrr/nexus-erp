import { describe, expect, it } from 'vitest';
import { PLAN_ORDER, canAccessActivity, hasBenefitCard } from './plans';
import { CaregiverFeature, FEATURE_LABELS, canUseFeature, featureAccess, minimumPlanForFeature, planShortName } from './plan-features';

const FEATURES = Object.keys(FEATURE_LABELS) as CaregiverFeature[];

/** A tabela do docs/20-regras-planos-v2.md, recurso por recurso: Livre, Essencial, Cuida, Sustenta. */
const TABLE: Readonly<Record<CaregiverFeature, readonly [boolean, boolean, boolean, boolean]>> = {
  organization: [true, true, true, true],
  agenda_reminders: [true, true, true, true],
  content: [true, true, true, true],
  network_search: [true, true, true, true],
  request_service: [true, true, true, true],
  open_circle: [true, true, true, true],
  training_paid: [true, true, true, true],
  training_included: [false, true, true, true],
  group_therapy: [false, false, true, true],
  groups: [false, false, true, true],
  individual_session: [false, false, true, true],
  extended_organization: [false, true, true, true],
  card: [false, true, true, true],
  exclusive_content: [false, true, true, true],
  network_conditions: [false, true, true, true],
  organization_support: [false, false, true, true],
  close_follow_up: [false, false, false, true],
  network_differentiated: [false, false, false, true],
};

describe('Acesso do cuidador por plano (docs/20, RN-PLN-01 a 08, RN-CRT-02, RN-REDE-25)', () => {
  it('cada recurso segue a tabela do docs/20 nos quatro planos', () => {
    FEATURES.forEach((f) =>
      PLAN_ORDER.forEach((plan, i) => expect(canUseFeature(plan, f), `${plan}/${f}`).toBe(TABLE[f][i])),
    );
  });

  it('roda aberta, capacitação avulsa e pedido de serviço valem para todos (S-09, docs/20)', () => {
    PLAN_ORDER.forEach((plan) => {
      expect(canUseFeature(plan, 'open_circle')).toBe(true);
      expect(canUseFeature(plan, 'training_paid')).toBe(true);
      expect(canUseFeature(plan, 'request_service')).toBe(true);
    });
  });

  it('os benefícios são progressivos: o que um plano libera, os de cima também', () => {
    PLAN_ORDER.forEach((plan, index) => {
      const next = PLAN_ORDER[index + 1];
      if (next) {
        FEATURES.filter((f) => canUseFeature(plan, f)).forEach((f) => expect(canUseFeature(next, f), `${f} em ${next}`).toBe(true));
      }
    });
  });

  it('concorda com as regras de plans.ts (Cartão e terapia de grupo)', () => {
    PLAN_ORDER.forEach((plan) => {
      expect(canUseFeature(plan, 'card'), plan).toBe(hasBenefitCard(plan));
      expect(canUseFeature(plan, 'group_therapy'), plan).toBe(canAccessActivity(plan, 'group_therapy').allowed);
    });
  });

  it('o menor plano de cada recurso', () => {
    expect(minimumPlanForFeature('card')).toBe('essencial');
    expect(minimumPlanForFeature('training_included')).toBe('essencial');
    expect(minimumPlanForFeature('individual_session')).toBe('cuida');
    expect(minimumPlanForFeature('network_differentiated')).toBe('sustenta');
    expect(minimumPlanForFeature('open_circle')).toBe('livre');
    expect(featureAccess('cuida', 'group_therapy')).toEqual({ allowed: true, minPlan: 'cuida' });
    expect(featureAccess('essencial', 'individual_session')).toMatchObject({ allowed: false, minPlan: 'cuida' });
  });

  it('RN-PLN-19: nenhum rótulo nem frase de compatibilidade fala de Zarit, alerta, ARBE, risco ou sobrecarga', () => {
    PLAN_ORDER.forEach((plan) =>
      FEATURES.forEach((f) => {
        const text = `${FEATURE_LABELS[f]} ${featureAccess(plan, f).reason ?? ''}`;
        expect(text, `${plan}/${f}`).not.toMatch(/zarit|alerta|arbe|risco|sobrecarga|pontua/i);
        expect(text).not.toContain(String.fromCharCode(0x2013));
        expect(text).not.toContain(String.fromCharCode(0x2014));
      }),
    );
  });

  it('planShortName tira o prefixo Nexus', () => {
    expect(planShortName('sustenta')).toBe('Sustenta');
    expect(planShortName('livre')).toBe('Livre');
  });
});
