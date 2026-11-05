import { describe, expect, it } from 'vitest';
import { formatSpan } from './span';

describe('Prazo legível (QA-018)', () => {
  it('usa minutos, horas e minutos, e dias conforme a grandeza', () => {
    expect(formatSpan(0)).toBe('0 min');
    expect(formatSpan(45)).toBe('45 min');
    expect(formatSpan(60)).toBe('1 h');
    expect(formatSpan(150)).toBe('2 h 30 min');
    expect(formatSpan(23 * 60 + 59)).toBe('23 h 59 min');
  });

  it('um dia ou mais mostra os dias (e as horas só até 3 dias)', () => {
    expect(formatSpan(24 * 60)).toBe('1 dia');
    expect(formatSpan(25 * 60)).toBe('1 dia 1 h');
    expect(formatSpan(2 * 24 * 60 + 5 * 60)).toBe('2 dias 5 h');
    expect(formatSpan(3 * 24 * 60 + 5 * 60)).toBe('3 dias');
  });

  it('370 h 24 min viram "15 dias" e o sinal é ignorado', () => {
    expect(formatSpan(370 * 60 + 24)).toBe('15 dias');
    expect(formatSpan(-(370 * 60 + 24))).toBe('15 dias');
  });
});
