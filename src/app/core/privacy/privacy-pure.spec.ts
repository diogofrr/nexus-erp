import { describe, expect, it } from 'vitest';
import {
  INSUFFICIENT_DATA_LABEL,
  LESS_THAN_MIN_LABEL,
  MIN_GROUP_SIZE,
  aggregateByKey,
  aggregateCount,
  aggregateDistribution,
  aggregateMean,
  aggregateValue,
  displayAggregate,
  isSufficient,
} from './aggregation';
import { CPF_MASK, isMasked, maskCpf, maskEmail, maskName, maskPhone, maskValue } from './masks';
import {
  IDENTIFYING_FIELDS,
  caregiverCode,
  isCaregiverCode,
  parseCaregiverCode,
  pseudonymFromId,
  pseudonymizeCaregiver,
} from './pseudonym';

describe('Máscaras (LP-07, RN-LGPD-26)', () => {
  it('CPF vira ***.***.***-**', () => {
    expect(maskCpf('000.000.042-00')).toBe('***.***.***-**');
    expect(CPF_MASK).toBe('***.***.***-**');
    expect(maskCpf('')).toBe('');
    expect(maskCpf(undefined)).toBe('');
  });

  it('telefone mantém o DDD e os 4 últimos dígitos', () => {
    expect(maskPhone('(34) 90000-0123')).toBe('(34) 9****-0123');
    expect(maskPhone('(34) 3212-0123')).toBe('(34) ****-0123');
    expect(maskPhone('123')).toBe('****');
    expect(maskPhone(null)).toBe('');
  });

  it('e-mail mantém a primeira letra e o domínio', () => {
    expect(maskEmail('ana.ferraz@exemplo.com.br')).toBe('a***@exemplo.com.br');
    expect(maskEmail('semarroba')).toBe('***');
    expect(maskEmail('')).toBe('');
  });

  it('nome mantém o primeiro nome e as iniciais', () => {
    expect(maskName('Ana Paula Ferraz')).toBe('Ana P. F.');
    expect(maskName('Cuidadora')).toBe('Cuidadora');
    expect(maskName('  Maria   Aparecida  Lemos ')).toBe('Maria A. L.');
    expect(maskName(undefined)).toBe('');
  });

  it('maskValue escolhe pelo tipo e isMasked reconhece a máscara', () => {
    expect(maskValue('cpf', '123.456.789-00')).toBe(CPF_MASK);
    expect(maskValue('phone', '(34) 90000-0001')).toBe('(34) 9****-0001');
    expect(maskValue('email', 'a@exemplo.com.br')).toBe('a***@exemplo.com.br');
    expect(maskValue('name', 'Ana Paula')).toBe('Ana P.');
    expect(isMasked('a***@x.com')).toBe(true);
    expect(isMasked('Ana')).toBe(false);
  });
});

describe('Pseudonimização (RN-LGPD-09, LP-08)', () => {
  it('o código é determinístico: CUI-0042', () => {
    expect(caregiverCode(42)).toBe('CUI-0042');
    expect(caregiverCode(1)).toBe('CUI-0001');
    expect(caregiverCode(340)).toBe('CUI-0340');
    expect(caregiverCode(42)).toBe(caregiverCode(42));
    expect(parseCaregiverCode('CUI-0042')).toBe(42);
    expect(parseCaregiverCode('CUI-42')).toBeNull();
    expect(isCaregiverCode('CUI-0001')).toBe(true);
    expect(isCaregiverCode('cg_0001')).toBe(false);
  });

  it('a partir de um id, usa o número final ou um hash estável', () => {
    expect(pseudonymFromId('cg_0042')).toBe('CUI-0042');
    expect(pseudonymFromId('abc')).toBe(pseudonymFromId('abc'));
    expect(pseudonymFromId('abc')).toMatch(/^CUI-\d{4}$/);
    expect(pseudonymFromId('abc')).not.toBe(pseudonymFromId('abd'));
  });

  it('a visão da gestão tem só código, status, plano e piloto: nenhum identificador', () => {
    const caregiver = {
      id: 'cg_0042',
      code: 'CUI-0042',
      status: 'active' as const,
      isPilot: false,
    };
    const view = pseudonymizeCaregiver(caregiver, 'cuida');
    expect(view).toEqual({
      id: 'cg_0042',
      code: 'CUI-0042',
      status: 'active',
      planId: 'cuida',
      isPilot: false,
    });
    IDENTIFYING_FIELDS.forEach((field) => expect(Object.keys(view)).not.toContain(field));
    expect(pseudonymizeCaregiver(caregiver)).not.toHaveProperty('planId');
  });
});

describe('Agregação com mínimo de 5 (RN-KPI-02, LP-09)', () => {
  it('abaixo de 5 devolve "dado insuficiente" sem revelar o número', () => {
    expect(MIN_GROUP_SIZE).toBe(5);
    expect(isSufficient(4)).toBe(false);
    expect(isSufficient(5)).toBe(true);
    const small = aggregateCount(4);
    expect(small).toEqual({
      sufficient: false,
      label: INSUFFICIENT_DATA_LABEL,
      shortLabel: 'menos de 5',
    });
    expect(INSUFFICIENT_DATA_LABEL).toBe('dado insuficiente');
    expect(LESS_THAN_MIN_LABEL).toBe('menos de 5');
    expect(JSON.stringify(small)).not.toMatch(/"(n|value)"/);
    expect(aggregateCount(5)).toEqual({ sufficient: true, value: 5, n: 5 });
  });

  it('o valor só é calculado quando o recorte é suficiente', () => {
    let calls = 0;
    expect(
      aggregateValue(3, () => {
        calls += 1;
        return 7;
      }),
    ).toMatchObject({ sufficient: false });
    expect(calls).toBe(0);
    expect(aggregateValue(8, () => 7)).toMatchObject({ sufficient: true, value: 7, n: 8 });
  });

  it('média protegida, agrupamento por chave e distribuição com chaves vazias', () => {
    expect(aggregateMean([1, 2, 3])).toMatchObject({ sufficient: false });
    expect(aggregateMean([2, 4, 6, 8, 10])).toMatchObject({ sufficient: true, value: 6 });
    const grouped = aggregateByKey(['a', 'a', 'a', 'a', 'a', 'b', 'b'], (x) => x);
    expect(grouped['a']).toMatchObject({ sufficient: true, value: 5 });
    expect(grouped['b']).toMatchObject({ sufficient: false });
    const dist = aggregateDistribution(['x', 'y', 'z'] as const, { x: 12, y: 2 });
    expect(displayAggregate(dist.x)).toBe('12');
    expect(displayAggregate(dist.y)).toBe('menos de 5');
    expect(displayAggregate(dist.z)).toBe('menos de 5');
    expect(aggregateCount(3, 3)).toMatchObject({ sufficient: true });
  });
});
