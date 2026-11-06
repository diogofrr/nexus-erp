import { describe, expect, it } from 'vitest';
import { FREE_TEXT_MAX_CHARS, INVALID_DATE_TEXT, NAME_MAX_CHARS, isTooLong, tooLongText } from './text-limits';

describe('limites de texto livre (QAC-015)', () => {
  it('nomes e títulos até 120 caracteres; texto de pedido e de mensagem até 500', () => {
    expect(NAME_MAX_CHARS).toBe(120);
    expect(FREE_TEXT_MAX_CHARS).toBe(500);
  });

  it('o limite conta sem os espaços das pontas e aceita exatamente o máximo', () => {
    expect(isTooLong('x'.repeat(120), NAME_MAX_CHARS)).toBe(false);
    expect(isTooLong('x'.repeat(121), NAME_MAX_CHARS)).toBe(true);
    expect(isTooLong(`  ${'x'.repeat(120)}  `, NAME_MAX_CHARS)).toBe(false);
    expect(isTooLong('', NAME_MAX_CHARS)).toBe(false);
    expect(isTooLong('x'.repeat(10_000), FREE_TEXT_MAX_CHARS)).toBe(true);
  });

  it('as frases são humanas, sem travessão nem exclamação', () => {
    expect(tooLongText(120)).toBe('Escreva até 120 caracteres.');
    expect(INVALID_DATE_TEXT).toBe('Escolha uma data que exista.');
    [tooLongText(500), INVALID_DATE_TEXT].forEach((text) => expect(text).not.toMatch(/[\u2014\u2013!]/));
  });
});
