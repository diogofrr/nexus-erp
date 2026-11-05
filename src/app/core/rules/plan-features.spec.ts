import { describe, expect, it } from 'vitest';
import { PLAN_ORDER, canAccessActivity, hasBenefitCard } from './plans';
import {
  CaregiverFeature,
  FEATURE_BENEFIT,
  FEATURE_LABELS,
  canUseFeature,
  featureAccess,
  planShortName,
} from './plan-features';

const FEATURES = Object.keys(FEATURE_BENEFIT) as CaregiverFeature[];

describe('Acesso do cuidador por plano (RN-PLN-01 a 08 e 10, RN-GRP-02, RN-CRT-02, RN-REDE-25)', () => {
  it('o Livre abre organização, agenda e lembretes, conteúdos, busca e pedido de serviço na rede e a conversa com o psicólogo; o resto não', () => {
    const open: CaregiverFeature[] = [
      'organization',
      'agenda_reminders',
      'content',
      'network_search',
      'request_service',
      'psych_scheduling',
    ];
    FEATURES.forEach((f) => expect(canUseFeature('livre', f), f).toBe(open.includes(f)));
  });

  it('pedir serviço pela rede vale para todos os planos; só as condições especiais da rede começam no Essencial (S-09)', () => {
    (['livre', 'essencial', 'cuida', 'sustenta'] as const).forEach((plan) =>
      expect(canUseFeature(plan, 'request_service'), plan).toBe(true),
    );
    expect(canUseFeature('livre', 'network_conditions')).toBe(false);
    expect(featureAccess('livre', 'network_conditions').minPlan).toBe('essencial');
  });

  it('Essencial soma organização ampliada, Cartão, conteúdos exclusivos e condições na rede, mas não os grupos', () => {
    (
      ['extended_organization', 'card', 'exclusive_content', 'network_conditions'] as const
    ).forEach((f) => expect(canUseFeature('essencial', f), f).toBe(true));
    expect(canUseFeature('essencial', 'groups')).toBe(false);
    expect(canUseFeature('essencial', 'organization_support')).toBe(false);
    expect(canUseFeature('essencial', 'close_follow_up')).toBe(false);
  });

  it('Cuida soma grupos e capacitações e maior apoio à organização; Sustenta libera tudo', () => {
    expect(canUseFeature('cuida', 'groups')).toBe(true);
    expect(canUseFeature('cuida', 'organization_support')).toBe(true);
    expect(canUseFeature('cuida', 'network_benefits')).toBe(false);
    FEATURES.forEach((f) => expect(canUseFeature('sustenta', f), f).toBe(true));
  });

  it('os benefícios são progressivos: o que um plano libera, os de cima também', () => {
    PLAN_ORDER.forEach((plan, index) => {
      const next = PLAN_ORDER[index + 1];
      if (next) {
        FEATURES.filter((f) => canUseFeature(plan, f)).forEach((f) =>
          expect(canUseFeature(next, f), `${f} em ${next}`).toBe(true),
        );
      }
    });
  });

  it('concorda com as regras que já existiam em plans.ts (Cartão e grupos)', () => {
    PLAN_ORDER.forEach((plan) => {
      expect(canUseFeature(plan, 'card'), plan).toBe(hasBenefitCard(plan));
      expect(canUseFeature(plan, 'groups'), plan).toBe(
        canAccessActivity(plan, 'support_group').allowed,
      );
    });
  });

  it('featureAccess dá o menor plano e a frase do bloqueio só quando bloqueia', () => {
    expect(featureAccess('livre', 'card')).toEqual({
      allowed: false,
      minPlan: 'essencial',
      reason: 'Disponível a partir do plano Essencial.',
    });
    expect(featureAccess('essencial', 'groups')).toEqual({
      allowed: false,
      minPlan: 'cuida',
      reason: 'Disponível a partir do plano Cuida.',
    });
    expect(featureAccess('cuida', 'groups')).toEqual({ allowed: true, minPlan: 'cuida' });
    expect(featureAccess('livre', 'agenda_reminders')).toEqual({ allowed: true, minPlan: 'livre' });
    expect(featureAccess('livre', 'psych_scheduling').minPlan).toBe('livre');
    expect(featureAccess('livre', 'close_follow_up').minPlan).toBe('sustenta');
  });

  it('RN-PLN-19: nenhuma frase de bloqueio fala de Zarit, alerta, ARBE, risco ou sobrecarga', () => {
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
