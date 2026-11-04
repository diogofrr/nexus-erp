import { describe, expect, it } from 'vitest';
import {
  cpfCheckDigits,
  generateFictitiousCnpj,
  generateFictitiousCpf,
  generateFictitiousPhone,
  isCnpjChecksumValid,
  isCpfChecksumValid,
  isEmailShapeValid,
  validateAdult,
  validateCouncilRegistration,
  validateCouncilValidity,
  validateCrp,
  validateCro,
  validateDailyCareHours,
  validateDiscountPercent,
  validateEvaluationScores,
  validateFictitiousCnpj,
  validateFictitiousCpf,
  validateFictitiousEmail,
  validateFictitiousPhone,
  validateRequiredText,
} from './validators';

const message = (result: { valid: boolean } & { message?: string }): string | undefined =>
  result.message;

describe('CPF fictício (LP-02, AC-M03-01)', () => {
  it('um CPF matematicamente válido é REJEITADO', () => {
    // 529.982.247-25 é o exemplo clássico de CPF com dígitos verificadores corretos.
    expect(isCpfChecksumValid('529.982.247-25')).toBe(true);
    const result = validateFictitiousCpf('529.982.247-25');
    expect(result.valid).toBe(false);
    expect(message(result)).toBe('Parece um CPF real. Use um CPF fictício.');
  });

  it('um CPF com dígitos verificadores inválidos é aceito', () => {
    expect(validateFictitiousCpf('000.000.001-00')).toEqual({ valid: true });
    expect(validateFictitiousCpf('123.456.789-00')).toEqual({ valid: true });
  });

  it('exige o formato 000.000.000-00', () => {
    expect(validateFictitiousCpf('12345678900').valid).toBe(false);
    expect(validateFictitiousCpf('123.456.789-0').valid).toBe(false);
    expect(message(validateFictitiousCpf('abc'))).toContain('formato');
  });

  it('sequências repetidas não são CPF válido', () => {
    expect(isCpfChecksumValid('111.111.111-11')).toBe(false);
    expect(isCpfChecksumValid('000.000.000-00')).toBe(false);
  });

  it('calcula os dígitos verificadores', () => {
    expect(cpfCheckDigits([5, 2, 9, 9, 8, 2, 2, 4, 7])).toEqual([2, 5]);
  });

  it('o gerador devolve CPFs 000.000.NNN-00, determinísticos e sempre inválidos', () => {
    expect(generateFictitiousCpf(42)).toMatch(/^000\.000\.042-0[01]$/);
    expect(generateFictitiousCpf(42)).toBe(generateFictitiousCpf(42));
    for (let n = 0; n < 1000; n += 1) {
      const cpf = generateFictitiousCpf(n);
      expect(isCpfChecksumValid(cpf), cpf).toBe(false);
      expect(validateFictitiousCpf(cpf).valid).toBe(true);
    }
    expect(generateFictitiousCpf(123_456)).toMatch(/^000\.123\.456-0[01]$/);
  });
});

describe('CNPJ fictício', () => {
  it('rejeita CNPJ com dígitos válidos e aceita o fictício', () => {
    expect(isCnpjChecksumValid('11.222.333/0001-81')).toBe(true);
    expect(message(validateFictitiousCnpj('11.222.333/0001-81'))).toContain('CNPJ real');
    expect(validateFictitiousCnpj(generateFictitiousCnpj(1)).valid).toBe(true);
    expect(validateFictitiousCnpj('123').valid).toBe(false);
    for (let n = 0; n < 200; n += 1) {
      expect(isCnpjChecksumValid(generateFictitiousCnpj(n))).toBe(false);
    }
  });
});

describe('E-mail e telefone fictícios (AC-GL-12)', () => {
  it('e-mail só @exemplo.com.br', () => {
    expect(validateFictitiousEmail('ana@exemplo.com.br').valid).toBe(true);
    expect(validateFictitiousEmail('ANA@EXEMPLO.COM.BR').valid).toBe(true);
    expect(message(validateFictitiousEmail('ana@gmail.com'))).toContain('@exemplo.com.br');
    expect(message(validateFictitiousEmail('ana'))).toContain('e-mail válido');
    expect(isEmailShapeValid('a@b.co')).toBe(true);
    expect(isEmailShapeValid('a@b')).toBe(false);
  });

  it('telefone (34) 90000-0000 a (34) 90000-0999', () => {
    expect(validateFictitiousPhone('(34) 90000-0000').valid).toBe(true);
    expect(validateFictitiousPhone('(34) 90000-0999').valid).toBe(true);
    expect(validateFictitiousPhone('(34) 90000-1000').valid).toBe(false);
    expect(validateFictitiousPhone('(11) 90000-0001').valid).toBe(false);
    expect(validateFictitiousPhone('34900000001').valid).toBe(false);
    expect(generateFictitiousPhone(7)).toBe('(34) 90000-0007');
    expect(generateFictitiousPhone(1234)).toBe('(34) 90000-0234');
  });
});

describe('Registro em conselho (RN-ATD-06, RN-REDE-03, 22)', () => {
  it('CRP e CRO no formato fictício', () => {
    expect(validateCrp('CRP-04/00102').valid).toBe(true);
    expect(validateCrp('CRP-4/102').valid).toBe(false);
    expect(validateCro('CRO-MG 00000').valid).toBe(true);
    expect(validateCro('CRO-MG00000').valid).toBe(false);
    expect(validateCouncilRegistration('CREFITO', 'CREFITO-4/00000-F').valid).toBe(true);
    expect(validateCouncilRegistration('COREN', 'COREN-MG 000123').valid).toBe(true);
    expect(validateCouncilRegistration('CRN', 'CRN-9/00231').valid).toBe(true);
    expect(validateCouncilRegistration('OAB', 'OAB/MG 00314').valid).toBe(true);
    expect(message(validateCouncilRegistration('OAB', 'MG 00314'))).toContain('OAB/MG 00000');
  });

  it('o registro precisa estar ativo e dentro da validade', () => {
    expect(validateCouncilValidity('active', '2027-01-01', '2026-11-04').valid).toBe(true);
    expect(validateCouncilValidity('active', '2026-11-04', '2026-11-04').valid).toBe(true);
    expect(message(validateCouncilValidity('active', '2026-10-23', '2026-11-04'))).toContain(
      'vencido',
    );
    expect(message(validateCouncilValidity('inactive', '2027-01-01', '2026-11-04'))).toContain(
      'ativo',
    );
    expect(validateCouncilValidity('not_applicable', undefined, '2026-11-04').valid).toBe(true);
    expect(message(validateCouncilValidity('active', undefined, '2026-11-04'))).toContain(
      'validade',
    );
  });
});

describe('Cuidador e demais campos', () => {
  it('maioridade: 18 anos completos hoje é aceito; um dia a menos, não (AC-M03-03)', () => {
    expect(validateAdult('2008-11-04', '2026-11-04').valid).toBe(true);
    expect(message(validateAdult('2008-11-05', '2026-11-04'))).toContain('18 anos');
    expect(validateAdult('1980-01-01', '2026-11-04').valid).toBe(true);
    expect(validateAdult('2027-01-01', '2026-11-04').valid).toBe(false);
    expect(validateAdult('2026-02-30', '2026-11-04').valid).toBe(false);
  });

  it('horas diárias de cuidado: inteiro de 0 a 24', () => {
    [0, 8, 24].forEach((h) => expect(validateDailyCareHours(h).valid).toBe(true));
    [-1, 25, 8.5, NaN, '8'].forEach((h) => expect(validateDailyCareHours(h).valid).toBe(false));
  });

  it('desconto de 0 a 100 com uma casa decimal', () => {
    expect(validateDiscountPercent(12.5).valid).toBe(true);
    expect(validateDiscountPercent(0).valid).toBe(true);
    expect(validateDiscountPercent(100).valid).toBe(true);
    expect(validateDiscountPercent(100.1).valid).toBe(false);
    expect(validateDiscountPercent(-1).valid).toBe(false);
    expect(validateDiscountPercent(12.55).valid).toBe(false);
  });

  it('as duas notas da avaliação são obrigatórias, inteiras, de 1 a 5 (AC-M08-11)', () => {
    expect(validateEvaluationScores(5, 4).valid).toBe(true);
    expect(validateEvaluationScores(0, 4).valid).toBe(false);
    expect(validateEvaluationScores(6, 4).valid).toBe(false);
    expect(validateEvaluationScores(undefined, 4).valid).toBe(false);
    expect(validateEvaluationScores(4, 3.5).valid).toBe(false);
  });

  it('texto obrigatório', () => {
    expect(validateRequiredText('  ', 'Nome').valid).toBe(false);
    expect(message(validateRequiredText('', 'Nome'))).toBe('Nome é obrigatório.');
    expect(validateRequiredText('Ana', 'Nome').valid).toBe(true);
  });
});
