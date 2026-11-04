import { describe, expect, it } from 'vitest';
import { RiskItem } from '../models/governance';
import {
  EMERGENCY_NOTICE,
  PRIORITY_RISK_THRESHOLD,
  REFERRAL_TABLE,
  isPriorityRisk,
  popReviewState,
  rankRisks,
  riskCriticality,
  riskMatrixCell,
  validateReferral,
} from './governance';
import {
  CADASTRE_RETENTION_DAYS,
  CONSENT_EFFECTS,
  CONSENT_KEYS,
  DOCUMENTARY_RETENTION_YEARS,
  DSR_TYPE_LABELS,
  cadastreErasureDate,
  canRejectRequest,
  dsrDaysRemaining,
  dsrDeadlineLabel,
  dsrDeadlineState,
  dsrDueDate,
  eligibleForAggregates,
  isConsentActive,
  isConsentOutdated,
  isRetentionExpired,
  retentionBlockUntil,
} from './lgpd';
import { isIntegerInRange, mean, percentOf, roundHalfUp } from './numbers';

describe('Números', () => {
  it('arredonda meio para cima sem o erro do ponto flutuante', () => {
    expect(roundHalfUp(86.25, 1)).toBe(86.3);
    expect(roundHalfUp(1.005, 2)).toBe(1.01);
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(-2.5)).toBe(-3);
    expect(roundHalfUp(-21.2121, 1)).toBe(-21.2);
    expect(roundHalfUp(0.000001, 2)).toBe(0);
    expect(roundHalfUp(Infinity)).toBe(Infinity);
  });

  it('percentual, média e intervalo', () => {
    expect(percentOf(2, 3)).toBe(66.7);
    expect(percentOf(1, 0)).toBeNull();
    expect(mean([1, 2, 3])).toBe(2);
    expect(mean([])).toBeNull();
    expect(isIntegerInRange(3, 1, 5)).toBe(true);
    expect(isIntegerInRange(3.5, 1, 5)).toBe(false);
    expect(isIntegerInRange('3', 1, 5)).toBe(false);
  });
});

describe('Solicitação do titular: 15 dias corridos (RN-LGPD-21; AC-M12-03)', () => {
  it('o prazo é a abertura mais 15 dias', () => {
    expect(dsrDueDate('2026-10-25')).toBe('2026-11-09');
    expect(dsrDueDate('2026-10-25', 10)).toBe('2026-11-04');
  });

  it('vence em 5 dias é "no prazo"; faltando 3 dias ou menos é "vence em breve"; depois do prazo, "vencida"', () => {
    const today = '2026-11-04';
    const req = (dueAt: string, status: 'open' | 'completed' = 'open') => ({ dueAt, status });
    expect(dsrDeadlineState(req('2026-11-09'), today)).toBe('on_time');
    expect(dsrDeadlineState(req('2026-11-07'), today)).toBe('due_soon'); // 3 dias
    expect(dsrDeadlineState(req('2026-11-06'), today)).toBe('due_soon'); // 2 dias
    expect(dsrDeadlineState(req('2026-11-04'), today)).toBe('due_soon'); // hoje
    expect(dsrDeadlineState(req('2026-11-03'), today)).toBe('overdue');
    expect(dsrDeadlineState(req('2026-10-01', 'completed'), today)).toBe('done');
    expect(dsrDaysRemaining(req('2026-11-09'), today)).toBe(5);
  });

  it('o contador em texto', () => {
    const today = '2026-11-04';
    expect(dsrDeadlineLabel({ dueAt: '2026-11-09', status: 'open' }, today)).toBe(
      'Vence em 5 dias',
    );
    expect(dsrDeadlineLabel({ dueAt: '2026-11-06', status: 'in_progress' }, today)).toBe(
      'Vence em breve (2 dias)',
    );
    expect(dsrDeadlineLabel({ dueAt: '2026-11-05', status: 'open' }, today)).toBe(
      'Vence em breve (1 dia)',
    );
    expect(dsrDeadlineLabel({ dueAt: '2026-11-04', status: 'open' }, today)).toBe('Vence hoje');
    expect(dsrDeadlineLabel({ dueAt: '2026-11-03', status: 'open' }, today)).toBe(
      'Vencida há 1 dia',
    );
    expect(dsrDeadlineLabel({ dueAt: '2026-10-30', status: 'open' }, today)).toBe(
      'Vencida há 5 dias',
    );
    expect(dsrDeadlineLabel({ dueAt: '2026-10-30', status: 'completed' }, today)).toBe('Concluída');
  });

  it('rejeitar exige motivo escrito (LP-18) e há rótulos para os 8 direitos', () => {
    expect(canRejectRequest('  ')).toBe(false);
    expect(canRejectRequest(undefined)).toBe(false);
    expect(canRejectRequest('Pedido duplicado.')).toBe(true);
    expect(Object.keys(DSR_TYPE_LABELS)).toHaveLength(8);
  });
});

describe('Consentimento (RN-LGPD-05, 14; LP-05, LP-06)', () => {
  it('são seis consentimentos independentes, cada um com efeito de recusa e de revogação', () => {
    expect(CONSENT_KEYS).toEqual([
      'health_data',
      'people_analytics',
      'family_sharing',
      'image_testimony',
      'whatsapp_contact',
      'pilot_tcle',
    ]);
    CONSENT_KEYS.forEach((key) => {
      expect(CONSENT_EFFECTS[key].ifRefused.length).toBeGreaterThan(0);
      expect(CONSENT_EFFECTS[key].ifRevoked.length).toBeGreaterThan(0);
    });
    expect(CONSENT_EFFECTS.health_data.ifRevoked.join(' ')).toContain('consentimento revogado');
  });

  it('só concedido está em vigor; versão antiga fica "desatualizada"', () => {
    expect(isConsentActive('granted')).toBe(true);
    (['pending', 'refused', 'revoked'] as const).forEach((s) =>
      expect(isConsentActive(s)).toBe(false),
    );
    expect(isConsentOutdated('1.0', '1.1')).toBe(true);
    expect(isConsentOutdated('1.0', '1.0')).toBe(false);
  });

  it('entra nos agregados só com saúde E People Analytics concedidos', () => {
    expect(eligibleForAggregates({ health_data: 'granted', people_analytics: 'granted' })).toBe(
      true,
    );
    expect(eligibleForAggregates({ health_data: 'granted', people_analytics: 'refused' })).toBe(
      false,
    );
    expect(eligibleForAggregates({ health_data: 'revoked', people_analytics: 'granted' })).toBe(
      false,
    );
    expect(eligibleForAggregates({})).toBe(false);
  });
});

describe('Retenção (RN-LGPD-23, 24)', () => {
  it('registro documental por 5 anos; cadastro, 30 dias depois do encerramento', () => {
    expect(DOCUMENTARY_RETENTION_YEARS).toBe(5);
    expect(CADASTRE_RETENTION_DAYS).toBe(30);
    expect(retentionBlockUntil('2026-11-04')).toBe('2031-11-04');
    expect(cadastreErasureDate('2026-11-04')).toBe('2026-12-04');
    expect(isRetentionExpired('2031-11-04', '2031-11-03')).toBe(false);
    expect(isRetentionExpired('2031-11-04', '2031-11-04')).toBe(true);
  });
});

describe('Riscos (RN-RISCO-01, 02, 15; AC-M13-03)', () => {
  const risk = (
    code: RiskItem['code'],
    probability: RiskItem['probability'],
    impact: RiskItem['impact'],
  ): RiskItem =>
    ({
      id: code,
      createdAt: '',
      updatedAt: '',
      code,
      title: code,
      category: 'x',
      probability,
      impact,
      treatment: '',
      controls: [],
    }) as RiskItem;

  it('C = P x I, com P e I de 1 a 5; prioritário a partir de 12', () => {
    expect(riskCriticality(4, 5)).toBe(20);
    expect(PRIORITY_RISK_THRESHOLD).toBe(12);
    expect(isPriorityRisk(12)).toBe(true);
    expect(isPriorityRisk(11)).toBe(false);
    expect(() => riskCriticality(0, 5)).toThrow(RangeError);
    expect(() => riskCriticality(2, 6)).toThrow(RangeError);
    expect(() => riskCriticality(2.5, 3)).toThrow(RangeError);
  });

  it('o registro ordena por criticidade e R1 (20) fica no topo; mudar P de R9 de 2 para 5 o torna prioritário', () => {
    const risks = [risk('R9', 2, 5), risk('R1', 4, 5), risk('R2', 4, 4), risk('R12', 2, 4)];
    const ranked = rankRisks(risks);
    expect(ranked.map((r) => r.risk.code)).toEqual(['R1', 'R2', 'R9', 'R12']);
    expect(ranked[2]).toMatchObject({ criticality: 10, priority: false });
    const changed = rankRisks([risk('R9', 5, 5)]);
    expect(changed[0]).toMatchObject({ criticality: 25, priority: true });
    expect(riskMatrixCell(risk('R4', 3, 5))).toEqual({ row: 3, column: 5 });
  });
});

describe('POPs (RN-POP-12, 13; AC-M13-02)', () => {
  it('em dia com menos de 12 meses; vencido a partir de 12; revisão acionada por incidente', () => {
    const today = '2026-11-04';
    expect(popReviewState('2026-04-18', today, false)).toBe('up_to_date');
    expect(popReviewState('2025-11-05', today, false)).toBe('up_to_date');
    expect(popReviewState('2025-11-04', today, false)).toBe('due');
    expect(popReviewState('2025-10-01', today, false)).toBe('due');
    expect(popReviewState('2026-10-05', today, true)).toBe('revision_triggered');
  });
});

describe('Encaminhamentos (Quadro 12; RN-ENC-01 a 11; AC-M13-05, 09)', () => {
  it('o quadro tem as 7 situações', () => {
    expect(REFERRAL_TABLE).toHaveLength(7);
    expect(EMERGENCY_NOTICE).toContain('SAMU (192)');
  });

  it('risco de suicídio oferece rede de urgência e CVV (188), conforme POP-05', () => {
    const rule = REFERRAL_TABLE.find((r) => r.category === 'severe_distress_or_suicide_risk');
    expect(rule?.destinations).toEqual(['Rede de urgência em saúde mental', 'CVV (188)']);
    expect(rule?.observation).toBe('Conforme POP-05');
  });

  it('destinos só da própria categoria; agravamento clínico exige "família comunicada"', () => {
    expect(validateReferral('social_vulnerability', ['CRAS do território'], undefined).valid).toBe(
      true,
    );
    expect(validateReferral('social_vulnerability', ['CREAS'], undefined).valid).toBe(false);
    expect(validateReferral('social_vulnerability', [], undefined).errors).toContain(
      'Informe ao menos um destino.',
    );
    expect(validateReferral('elder_clinical_worsening', ['UBS de referência'], false).valid).toBe(
      false,
    );
    expect(validateReferral('elder_clinical_worsening', ['UBS de referência'], true).valid).toBe(
      true,
    );
    expect(
      validateReferral('caregiver_cannot_afford_care', ['Clínicas-escola'], undefined).valid,
    ).toBe(true);
  });

  it('nenhuma categoria tem campo de valor ou comissão (RN-ENC-10)', () => {
    expect(JSON.stringify(REFERRAL_TABLE).toLowerCase()).not.toMatch(/comiss|valor|repasse/);
  });
});
