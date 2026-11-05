import { describe, expect, it } from 'vitest';
import { evaluatePilotEligibility } from './pilot-eligibility';
import { caregiverLabel, canSeeCaregiverIdentity } from '../privacy/caregiver-label';

describe('elegibilidade ao piloto (RN-PIL-04, RN-USR-12, 13)', () => {
  it('três critérios e TCLE: elegível e pode marcar', () => {
    const r = evaluatePilotEligibility({ hasElder: true, dependency: 'partial', city: 'Uberlândia', tcleActive: true });
    expect(r.metCount).toBe(3);
    expect(r.eligible).toBe(true);
    expect(r.canEnroll).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it('Uberaba com pessoa idosa independente reprova 2 critérios (AC-M03-09)', () => {
    const r = evaluatePilotEligibility({ hasElder: true, dependency: 'independent', city: 'Uberaba', tcleActive: false });
    expect(r.metCount).toBe(1);
    expect(r.criteria.filter((c) => !c.met).map((c) => c.key)).toEqual(['dependency', 'city']);
    expect(r.canEnroll).toBe(false);
    expect(r.missing).toHaveLength(3);
    expect(r.missing[2]).toContain('TCLE');
  });

  it('sem TCLE ativo bloqueia mesmo com os três critérios', () => {
    const r = evaluatePilotEligibility({ hasElder: true, dependency: 'total', city: 'Uberlândia', tcleActive: false });
    expect(r.eligible).toBe(true);
    expect(r.canEnroll).toBe(false);
    expect(r.missing).toEqual(['Termo de consentimento do piloto (TCLE) ativo']);
  });

  it('a cidade ignora acento e caixa', () => {
    expect(evaluatePilotEligibility({ hasElder: true, dependency: 'total', city: 'uberlandia', tcleActive: true }).canEnroll).toBe(true);
  });

  it('sem pessoa idosa vinculada não é cuidador principal', () => {
    expect(evaluatePilotEligibility({ hasElder: false, dependency: undefined, city: 'Uberlândia', tcleActive: true }).eligible).toBe(false);
  });
});

describe('rótulo do cuidador por perfil (LP-08)', () => {
  const cg = { fullName: 'Ana Paula Ferraz', code: 'CUI-0001' };
  it('a gestão recebe só o código; o nome nem entra no texto', () => {
    const label = caregiverLabel('partner', cg);
    expect(label.text).toBe('CUI-0001');
    expect(label.pseudonymized).toBe(true);
    expect(JSON.stringify(label)).not.toContain('Ana');
  });
  it('atendimento, responsável técnico e psicólogo recebem o nome', () => {
    (['support', 'technical_lead', 'psychologist'] as const).forEach((role) => {
      expect(canSeeCaregiverIdentity(role)).toBe(true);
      expect(caregiverLabel(role, cg).text).toBe('Ana Paula Ferraz');
    });
    expect(caregiverLabel(null, cg).text).toBe('CUI-0001');
  });
});
