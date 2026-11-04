import { describe, expect, it } from 'vitest';
import {
  POP05_STEPS,
  POP07_REMINDER,
  checkOccurrenceClosure,
  checkRedAlertClosure,
  isEscalatedToTechnicalLead,
  isSameDayContact,
  redAlertDeadline,
  redAlertMinutesLeft,
  redAlertState,
  sameDayContactRate,
} from './pop05';

describe('POP-05 e alerta vermelho (RN-ZRT-13 a 15)', () => {
  it('o prazo é 23h59 do dia da aplicação', () => {
    expect(redAlertDeadline('2026-11-04')).toBe('2026-11-04T23:59:00-03:00');
  });

  it('sem contato depois das 23h59 o vermelho vira overdue e escala ao RT', () => {
    const alert = {
      status: 'open' as const,
      level: 'red' as const,
      deadlineAt: '2026-11-04T23:59:00-03:00',
    };
    expect(redAlertState(alert, '2026-11-04T23:58:00-03:00')).toBe('open');
    expect(redAlertState(alert, '2026-11-05T00:01:00-03:00')).toBe('overdue');
    expect(isEscalatedToTechnicalLead(alert, '2026-11-05T00:01:00-03:00')).toBe(true);
    expect(isEscalatedToTechnicalLead(alert, '2026-11-04T10:00:00-03:00')).toBe(false);
  });

  it('com contato registrado volta ao fluxo normal', () => {
    const alert = {
      status: 'contacted' as const,
      level: 'red' as const,
      deadlineAt: '2026-11-04T23:59:00-03:00',
      contact: { at: '2026-11-05T09:00:00-03:00', byUserId: 'u3', channel: 'phone' as const },
    };
    expect(redAlertState(alert, '2026-11-06T09:00:00-03:00')).toBe('contacted');
    expect(redAlertState({ ...alert, status: 'closed' }, '2026-11-06T09:00:00-03:00')).toBe(
      'closed',
    );
  });

  it('cronômetro: minutos até o prazo (negativo se vencido)', () => {
    const alert = { deadlineAt: '2026-11-04T23:59:00-03:00' };
    expect(redAlertMinutesLeft(alert, '2026-11-04T22:59:00-03:00')).toBe(60);
    expect(redAlertMinutesLeft(alert, '2026-11-05T00:59:00-03:00')).toBe(-60);
    expect(redAlertMinutesLeft({}, '2026-11-04T22:59:00-03:00')).toBeNull();
  });

  it('contato no mesmo dia é na mesma data civil da aplicação', () => {
    expect(isSameDayContact('2026-11-04', '2026-11-04T23:30:00-03:00')).toBe(true);
    expect(isSameDayContact('2026-11-04', '2026-11-05T00:10:00-03:00')).toBe(false);
  });

  it('não encerra sem horário, quem fez, avaliação de risco e, se necessário, encaminhamento (AC-M06-06)', () => {
    const empty = checkRedAlertClosure({ referralIds: [] }, true);
    expect(empty.ok).toBe(false);
    expect(empty.missing).toEqual(['contact_time', 'contact_by', 'risk_assessment', 'referral']);
    const complete = checkRedAlertClosure(
      {
        contact: { at: '2026-11-04T10:00:00-03:00', byUserId: 'u3', channel: 'phone' },
        riskAssessment: {
          at: '2026-11-04T10:30:00-03:00',
          byUserId: 'u3',
          level: 'moderate',
          note: 'Avaliado.',
        },
        referralIds: [],
      },
      false,
    );
    expect(complete).toEqual({ ok: true, missing: [] });
    const onlyContact = checkRedAlertClosure(
      { referralIds: [], contact: { at: 'x', byUserId: 'u3', channel: 'phone' } },
      false,
    );
    expect(onlyContact.missing).toEqual(['risk_assessment']);
  });

  it('a ocorrência POP-05 só encerra com os 7 passos, com hora e responsável', () => {
    expect(POP05_STEPS).toHaveLength(7);
    const done = POP05_STEPS.map((label, i) => ({
      n: i + 1,
      label,
      doneAt: '2026-11-04T10:00:00-03:00',
      byUserId: 'u3',
    }));
    expect(checkOccurrenceClosure(done)).toEqual({ ok: true, pendingSteps: [] });
    const partial = done.map((s, i) => (i === 2 ? { n: s.n, label: s.label } : s));
    expect(checkOccurrenceClosure(partial)).toEqual({ ok: false, pendingSteps: [3] });
    expect(checkOccurrenceClosure([]).pendingSteps).toHaveLength(7);
  });

  it('lembrete do POP-07: proteger sem abandonar quem cuida', () => {
    expect(POP07_REMINDER).toBe('Proteger a pessoa idosa sem abandonar quem cuida.');
  });
});

describe('Contato no mesmo dia (K18, RN-KPI-17; AC-M06-17)', () => {
  const day = (offset: number): string => `2026-11-${String(4 + offset).padStart(2, '0')}`;
  const alert = (id: string, applied: number, contactDay: number | null) => ({
    assessmentId: id,
    level: 'red' as const,
    deadlineAt: `${day(applied)}T23:59:00-03:00`,
    ...(contactDay === null
      ? {}
      : {
          contact: {
            at: `${day(contactDay)}T10:00:00-03:00`,
            byUserId: 'u3',
            channel: 'phone' as const,
          },
        }),
  });
  const applied: Record<string, string> = { z0: day(0), zb: day(-1), zg: day(-3), zh: day(-2) };
  const lookup = (a: { assessmentId: string }): string | undefined => applied[a.assessmentId];
  const alerts = [
    alert('z0', 0, null),
    alert('zb', -1, null),
    alert('zg', -3, -3),
    alert('zh', -2, -2),
  ];

  it('2 de 3: o vermelho de hoje só entra depois das 23h59', () => {
    expect(sameDayContactRate(alerts, lookup, '2026-11-04T12:00:00-03:00')).toEqual({
      numerator: 2,
      denominator: 3,
      percent: 66.7,
    });
    const after = sameDayContactRate(alerts, lookup, '2026-11-05T00:30:00-03:00');
    expect(after.denominator).toBe(4);
    expect(after.percent).toBe(50);
  });

  it('fora da janela de 30 dias não conta e sem vermelhos vencidos devolve null', () => {
    const old = {
      assessmentId: 'old',
      level: 'red' as const,
      deadlineAt: '2026-09-25T23:59:00-03:00',
      contact: { at: '2026-09-25T10:00:00-03:00', byUserId: 'u3', channel: 'phone' as const },
    };
    expect(
      sameDayContactRate([old], () => '2026-09-25', '2026-11-04T12:00:00-03:00').denominator,
    ).toBe(0);
    expect(sameDayContactRate([], lookup, '2026-11-04T12:00:00-03:00').percent).toBeNull();
  });
});
