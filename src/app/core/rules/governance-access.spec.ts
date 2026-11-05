import { describe, expect, it } from 'vitest';
import {
  canActOnPop,
  checkRiskEdit,
  controlModuleCode,
  newOccurrenceSteps,
  occurrenceClosureStatus,
  occurrenceStatusAfterStep,
  pendingAuthorities,
  popActionBlockedReason,
  popDisplayState,
  referralReminder,
  referralVisibility,
} from './governance-access';

describe('POPs: quem age e que estado aparece (RN-POP-13, 14)', () => {
  it('ações do RT só o RT; ações da gestão só a gestão; POP-04 os dois', () => {
    expect(canActOnPop('technical_lead', 'technical_lead')).toBe(true);
    expect(canActOnPop('partner', 'technical_lead')).toBe(false);
    expect(canActOnPop('partner', 'management')).toBe(true);
    expect(canActOnPop('technical_lead', 'management')).toBe(false);
    expect(canActOnPop('partner', 'management_and_technical_lead')).toBe(true);
    expect(canActOnPop('technical_lead', 'management_and_technical_lead')).toBe(true);
    expect(canActOnPop('psychologist', 'management')).toBe(false);
    expect(canActOnPop('support', 'technical_lead')).toBe(false);
  });

  it('quem não age recebe uma explicação sem culpa', () => {
    expect(popActionBlockedReason('partner', 'technical_lead')).toContain('responsável técnico');
    expect(popActionBlockedReason('technical_lead', 'management')).toContain('gestão');
    expect(popActionBlockedReason('support', 'management')).toContain('ler');
    expect(popActionBlockedReason('partner', 'management')).toBeNull();
  });

  it('o estado vem do relógio: 12 meses vira "a revisar"; a revisão acionada fica até a próxima', () => {
    expect(popDisplayState({ lastReviewedAt: '2026-05-01', reviewState: 'up_to_date' }, '2026-11-04')).toBe(
      'up_to_date',
    );
    expect(popDisplayState({ lastReviewedAt: '2025-10-01', reviewState: 'up_to_date' }, '2026-11-04')).toBe('due');
    expect(popDisplayState({ lastReviewedAt: '2026-10-05', reviewState: 'revision_triggered' }, '2026-11-04')).toBe(
      'revision_triggered',
    );
  });
});

describe('Encaminhamentos: o que cada perfil vê (RN-ENC-11, escopo 1.3)', () => {
  it('RT vê tudo; psicólogo só os casos dele', () => {
    expect(referralVisibility('technical_lead', 'rights_violation_or_neglect', false)).toBe('full');
    expect(referralVisibility('psychologist', 'psychiatric_follow_up', true)).toBe('full');
    expect(referralVisibility('psychologist', 'psychiatric_follow_up', false)).toBe('hidden');
  });

  it('a gestão vê só a contagem de risco e violência; o resto com código', () => {
    expect(referralVisibility('partner', 'severe_distress_or_suicide_risk', false)).toBe('count_only');
    expect(referralVisibility('partner', 'rights_violation_or_neglect', false)).toBe('count_only');
    expect(referralVisibility('partner', 'social_vulnerability', false)).toBe('full');
  });

  it('o atendimento não vê nada clínico, nem que existe', () => {
    expect(referralVisibility('support', 'severe_distress_or_suicide_risk', false)).toBe('hidden');
    expect(referralVisibility('support', 'psychiatric_follow_up', false)).toBe('hidden');
    expect(referralVisibility('support', 'elder_clinical_worsening', false)).toBe('hidden');
    expect(referralVisibility('support', 'caregiver_cannot_afford_care', false)).toBe('full');
  });

  it('os lembretes seguem o Quadro 12 (POP-05 e POP-07)', () => {
    expect(referralReminder('severe_distress_or_suicide_risk')).toContain('POP-05');
    expect(referralReminder('rights_violation_or_neglect')).toContain('POP-07');
    expect(referralReminder('social_vulnerability')).toBeNull();
  });
});

describe('Riscos: edição de P e I (RN-RISCO-01, 02)', () => {
  it('aceita 1 a 5 e recusa fora disso ou fracionário', () => {
    expect(checkRiskEdit({ probability: 2, impact: 5, treatment: 'Vedação' }).ok).toBe(true);
    expect(checkRiskEdit({ probability: 0, impact: 5, treatment: 'x' }).errors.probability).toBeDefined();
    expect(checkRiskEdit({ probability: 2, impact: 6, treatment: 'x' }).errors.impact).toBeDefined();
    expect(checkRiskEdit({ probability: 2.5, impact: 2, treatment: 'x' }).ok).toBe(false);
  });

  it('risco prioritário (C 12 ou mais) exige plano de tratamento', () => {
    const empty = checkRiskEdit({ probability: 5, impact: 5, treatment: '  ' });
    expect(empty.ok).toBe(false);
    expect(empty.errors.treatment).toContain('plano de tratamento');
    expect(checkRiskEdit({ probability: 2, impact: 5, treatment: '' }).ok).toBe(true);
  });

  it('extrai o módulo do controle vinculado', () => {
    expect(controlModuleCode('Log de acesso (M12)')).toBe('M12');
    expect(controlModuleCode('Conversão realizada (K03)')).toBeNull();
    expect(controlModuleCode('Registro de decisões da gestão (M13)')).toBe('M13');
  });
});

describe('Ocorrências: passos e encerramento (RN-POP-05, 07)', () => {
  it('ocorrência nova tem todos os passos pendentes: 7 no POP-05 e 5 no POP-07', () => {
    expect(newOccurrenceSteps('pop05_risk')).toHaveLength(7);
    expect(newOccurrenceSteps('pop07_violence_suspicion')).toHaveLength(5);
    expect(newOccurrenceSteps('pop05_risk').every((s) => s.doneAt === undefined)).toBe(true);
  });

  it('POP-05 só encerra com os 7 passos feitos', () => {
    const steps = newOccurrenceSteps('pop05_risk').map((s) =>
      s.n <= 6 ? { ...s, doneAt: '2026-11-04T10:00:00-03:00', byUserId: 'u2' } : s,
    );
    const blocked = occurrenceClosureStatus({ kind: 'pop05_risk', steps, authoritiesNotified: [] });
    expect(blocked.ok).toBe(false);
    expect(blocked.pendingSteps).toEqual([7]);
    const done = steps.map((s) => ({ ...s, doneAt: '2026-11-04T10:00:00-03:00', byUserId: 'u2' }));
    expect(occurrenceClosureStatus({ kind: 'pop05_risk', steps: done, authoritiesNotified: [] }).ok).toBe(true);
  });

  it('POP-07 também exige a comunicação aos órgãos registrada', () => {
    const steps = newOccurrenceSteps('pop07_violence_suspicion').map((s) => ({
      ...s,
      doneAt: '2026-11-04T10:00:00-03:00',
      byUserId: 'u2',
    }));
    const notComm = occurrenceClosureStatus({
      kind: 'pop07_violence_suspicion',
      steps,
      authoritiesNotified: [{ body: 'CREAS' }, { body: 'Disque 100' }],
    });
    expect(notComm.ok).toBe(false);
    expect(notComm.missingNotification).toBe(true);
    const comm = occurrenceClosureStatus({
      kind: 'pop07_violence_suspicion',
      steps,
      authoritiesNotified: [{ body: 'CREAS', at: '2026-11-04', protocol: 'P-1' }, { body: 'Disque 100' }],
    });
    expect(comm.ok).toBe(true);
    expect(pendingAuthorities([{ body: 'CREAS', at: '2026-11-04' }, { body: 'Disque 100' }])).toEqual([
      { body: 'Disque 100' },
    ]);
  });

  it('o estado acompanha os passos', () => {
    expect(occurrenceStatusAfterStep(newOccurrenceSteps('pop05_risk'))).toBe('open');
    expect(
      occurrenceStatusAfterStep([{ n: 1, label: 'x', doneAt: '2026-11-04T10:00:00-03:00', byUserId: 'u2' }]),
    ).toBe('in_progress');
  });
});
