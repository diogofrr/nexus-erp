import { describe, expect, it } from 'vitest';
import { Message } from '../models/messages';
import {
  DEFAULT_ARBE_SETTINGS,
  arbeContactDeadline,
  countSupportRequests,
  evaluateArbe,
  isArbeAlertOpen,
  isArbeContactLate,
  shouldGenerateArbeAlert,
} from './arbe';

type Row = Pick<Message, 'caregiverId' | 'isSupportRequest' | 'receivedAt' | 'direction'>;

describe('ARBE (RN-ARBE-05, 06, 08)', () => {
  it('limites padrão: 8 h, 3 pedidos em 30 dias, Zarit 41 e crítico a partir de 61', () => {
    expect(DEFAULT_ARBE_SETTINGS).toEqual({
      hoursThreshold: 8,
      supportRequestsThreshold: 3,
      windowDays: 30,
      zaritThreshold: 41,
      criticalZarit: 61,
    });
  });

  it('Ana (11 h, 4 pedidos, Zarit 63) é crítica (AC-M06-12)', () => {
    const r = evaluateArbe({ dailyCareHours: 11, supportRequestsInWindow: 4, lastZarit: 63 });
    expect(r?.level).toBe('critical');
    expect(r?.metCount).toBe(3);
  });

  it('9 h, 3 pedidos e Zarit 35 é atenção: 2 de 3 critérios', () => {
    const r = evaluateArbe({ dailyCareHours: 9, supportRequestsInWindow: 3, lastZarit: 35 });
    expect(r?.level).toBe('attention');
    expect(r?.criteria.zarit.met).toBe(false);
    expect(r?.metCount).toBe(2);
  });

  it('os limites são "maior ou igual": 8 h, 3 pedidos e Zarit 41 cumprem', () => {
    expect(
      evaluateArbe({ dailyCareHours: 8, supportRequestsInWindow: 3, lastZarit: 41 })?.level,
    ).toBe('critical');
    expect(
      evaluateArbe({ dailyCareHours: 7, supportRequestsInWindow: 2, lastZarit: 40 }),
    ).toBeNull();
  });

  it('só um critério não gera alerta; Zarit 61 ou mais é crítico sozinho', () => {
    expect(
      evaluateArbe({ dailyCareHours: 10, supportRequestsInWindow: 0, lastZarit: 20 }),
    ).toBeNull();
    expect(
      evaluateArbe({ dailyCareHours: 2, supportRequestsInWindow: 0, lastZarit: 61 })?.level,
    ).toBe('critical');
    expect(
      evaluateArbe({ dailyCareHours: 2, supportRequestsInWindow: 0, lastZarit: 60 }),
    ).toBeNull();
  });

  it('sem Zarit, o critério da escala não conta', () => {
    expect(
      evaluateArbe({ dailyCareHours: 9, supportRequestsInWindow: 3, lastZarit: null })?.level,
    ).toBe('attention');
    expect(
      evaluateArbe({ dailyCareHours: 9, supportRequestsInWindow: 1, lastZarit: null }),
    ).toBeNull();
  });

  it('mudar os limites recalcula (AC-M06-13)', () => {
    const input = { dailyCareHours: 6, supportRequestsInWindow: 2, lastZarit: 45 };
    expect(evaluateArbe(input)).toBeNull();
    expect(
      evaluateArbe(input, {
        ...DEFAULT_ARBE_SETTINGS,
        hoursThreshold: 6,
        supportRequestsThreshold: 2,
      })?.level,
    ).toBe('critical');
  });

  it('conta pedidos de apoio só dentro da janela de 30 dias', () => {
    const row = (receivedAt: string, support = true, caregiverId = 'cg_1'): Row => ({
      caregiverId,
      isSupportRequest: support,
      receivedAt,
      direction: 'in',
    });
    const messages = [
      row('2026-11-03T10:00:00-03:00'),
      row('2026-10-25T10:00:00-03:00'),
      row('2026-10-15T10:00:00-03:00'),
      row('2026-11-03T11:00:00-03:00', false),
      row('2026-10-01T10:00:00-03:00'), // fora da janela
    ];
    expect(countSupportRequests(messages, 'cg_1', '2026-11-04', 30)).toBe(3);
    expect(countSupportRequests(messages, 'cg_2', '2026-11-04', 30)).toBe(0);
  });

  it('não gera novo alerta do mesmo nível enquanto houver um aberto (RN-ARBE-08)', () => {
    const existing = [
      { caregiverId: 'cg_1', level: 'critical' as const, status: 'confirmed' as const },
    ];
    expect(shouldGenerateArbeAlert(existing, 'cg_1', 'critical')).toBe(false);
    expect(shouldGenerateArbeAlert(existing, 'cg_1', 'attention')).toBe(true);
    expect(
      shouldGenerateArbeAlert(
        [{ caregiverId: 'cg_1', level: 'critical', status: 'closed' }],
        'cg_1',
        'critical',
      ),
    ).toBe(true);
    expect(isArbeAlertOpen({ status: 'discarded' })).toBe(false);
  });

  it('prazo de contato: crítico em 1 dia útil e atenção em 5 dias úteis (RN-ARBE-06)', () => {
    expect(arbeContactDeadline('critical', '2026-11-06T10:00:00-03:00')).toBe('2026-11-09'); // sexta vai para segunda
    expect(arbeContactDeadline('attention', '2026-11-04T10:00:00-03:00')).toBe('2026-11-11');
    const alert = {
      level: 'critical' as const,
      generatedAt: '2026-11-03T10:00:00-03:00',
      status: 'generated' as const,
    };
    expect(isArbeContactLate(alert, '2026-11-04T12:00:00-03:00')).toBe(false);
    expect(isArbeContactLate(alert, '2026-11-05T09:00:00-03:00')).toBe(true);
    expect(isArbeContactLate({ ...alert, status: 'contacted' }, '2026-11-10T09:00:00-03:00')).toBe(
      false,
    );
  });
});
