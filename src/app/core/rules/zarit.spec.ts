import { describe, expect, it } from 'vitest';
import {
  ZARIT_BANDS,
  ZARIT_ITEM_COUNT,
  ZARIT_NOT_DIAGNOSIS_NOTE,
  ZaritError,
  formatEvolutionPercent,
  nextZaritDueDate,
  validateZaritAnswers,
  zaritAlertLevel,
  zaritAssessmentState,
  zaritBand,
  zaritBandInfo,
  zaritConduct,
  zaritEvolution,
  zaritEvolutionSeries,
  zaritStatusForSupport,
  zaritTotal,
} from './zarit';
import { ZARIT_DEMO_ITEMS } from './zarit-items';

const all = (value: number): number[] => new Array<number>(ZARIT_ITEM_COUNT).fill(value);

describe('Zarit: itens e total (RN-ZRT-02, 03, 25)', () => {
  it('tem 22 enunciados de demonstração e a nota de que não é diagnóstico', () => {
    expect(ZARIT_DEMO_ITEMS).toHaveLength(22);
    expect(ZARIT_NOT_DIAGNOSIS_NOTE).toContain('Não é um diagnóstico');
  });

  it('o total é a soma dos 22 itens, de 0 a 88', () => {
    expect(zaritTotal(all(0))).toBe(0);
    expect(zaritTotal(all(4))).toBe(88);
    expect(zaritTotal([...all(0).slice(0, 21), 3])).toBe(3);
  });

  it('exige os 22 itens, inteiros de 0 a 4', () => {
    expect(validateZaritAnswers(all(2)).valid).toBe(true);
    const missing = validateZaritAnswers([...all(2).slice(0, 21), undefined]);
    expect(missing.valid).toBe(false);
    expect(missing.invalidItems).toEqual([21]);
    expect(validateZaritAnswers(all(2).slice(0, 20)).valid).toBe(false);
    expect(validateZaritAnswers([...all(1).slice(0, 21), 5]).invalidItems).toEqual([21]);
    expect(validateZaritAnswers([...all(1).slice(0, 21), -1]).valid).toBe(false);
    expect(validateZaritAnswers([...all(1).slice(0, 21), 2.5]).valid).toBe(false);
    expect(() => zaritTotal([...all(1).slice(0, 21), 5])).toThrow(ZaritError);
  });
});

describe('Zarit: faixas e conduta (RN-ZRT-08 a 13, A.5)', () => {
  const cases: [number, string, 'yellow' | 'red' | null][] = [
    [0, 'Sobrecarga ausente ou pequena', null],
    [20, 'Sobrecarga ausente ou pequena', null],
    [21, 'Sobrecarga moderada', null],
    [40, 'Sobrecarga moderada', null],
    [41, 'Sobrecarga moderada a severa', 'yellow'],
    [60, 'Sobrecarga moderada a severa', 'yellow'],
    [61, 'Sobrecarga severa', 'red'],
    [88, 'Sobrecarga severa', 'red'],
  ];
  it.each(cases)(
    'total %i é "%s" com alerta %s (valores de fronteira, AC-M06-01)',
    (total, label, alert) => {
      expect(zaritBandInfo(total).label).toBe(label);
      expect(zaritAlertLevel(total)).toBe(alert);
    },
  );

  it('mapeia cada faixa e rejeita totais impossíveis', () => {
    expect(zaritBand(0)).toBe('absent_or_small');
    expect(zaritBand(30)).toBe('moderate');
    expect(zaritBand(50)).toBe('moderate_to_severe');
    expect(zaritBand(70)).toBe('severe');
    expect(() => zaritBand(89)).toThrow(ZaritError);
    expect(() => zaritBand(-1)).toThrow(ZaritError);
    expect(() => zaritBand(10.5)).toThrow(ZaritError);
    expect(ZARIT_BANDS).toHaveLength(4);
  });

  it('a conduta da equipe segue a tabela A.5', () => {
    expect(zaritConduct(10)).toContain('grupos de apoio');
    expect(zaritConduct(30)).toContain('atendimento psicológico');
    expect(zaritConduct(45)).toContain('Alerta amarelo');
    expect(zaritConduct(45)).toContain('rede de apoio');
    expect(zaritConduct(70)).toContain('mesmo dia');
    expect(zaritConduct(70)).toContain('POP-05');
  });
});

describe('Zarit: evolução percentual (RN-ZRT-16, 17; AC-M06-08)', () => {
  it('João: 66 para 52 resulta -21,2%', () => {
    expect(zaritEvolution(66, 52)).toMatchObject({
      kind: 'percent',
      value: -21.2,
      display: '-21,2%',
    });
  });

  it('Maria: 40, 28, 18 resulta -55,0% no último ponto', () => {
    const series = zaritEvolutionSeries([40, 28, 18]);
    expect(series[0]).toEqual({ kind: 'reference', display: 'referência' });
    expect(series[1]).toMatchObject({ kind: 'percent', value: -30 });
    expect(series[2]).toMatchObject({ kind: 'percent', value: -55, display: '-55,0%' });
  });

  it('adesão 0 mostra "n/d" com a diferença em pontos', () => {
    expect(zaritEvolution(0, 12)).toEqual({ kind: 'not_defined', pointsDelta: 12, display: 'n/d' });
  });

  it('formata com sinal explícito e vírgula', () => {
    expect(formatEvolutionPercent(12.5)).toBe('+12,5%');
    expect(formatEvolutionPercent(-3)).toBe('-3,0%');
    expect(formatEvolutionPercent(0)).toBe('0,0%');
    expect(zaritEvolution(40, 50).display).toBe('+25,0%');
  });
});

describe('Zarit: vencimento (RN-ZRT-05, 24)', () => {
  it('a próxima aplicação vence 3 meses depois, com o dia caindo no fim do mês', () => {
    expect(nextZaritDueDate('2026-02-15')).toBe('2026-05-15');
    expect(nextZaritDueDate('2026-11-30')).toBe('2027-02-28');
    expect(nextZaritDueDate('2026-08-31')).toBe('2026-11-30');
  });

  it('estado derivado: scheduled, due (até 14 dias), overdue e completed', () => {
    const today = '2026-11-04';
    expect(zaritAssessmentState('2026-12-20', today, false)).toBe('scheduled');
    expect(zaritAssessmentState('2026-11-18', today, false)).toBe('due'); // exatamente 14 dias
    expect(zaritAssessmentState('2026-11-19', today, false)).toBe('scheduled'); // 15 dias
    expect(zaritAssessmentState('2026-11-04', today, false)).toBe('due'); // vence hoje
    expect(zaritAssessmentState('2026-11-03', today, false)).toBe('overdue');
    expect(zaritAssessmentState('2026-11-03', today, true)).toBe('completed');
  });

  it('vence em 7 dias vira overdue 8 dias depois (AC-M15-04)', () => {
    expect(zaritAssessmentState('2026-11-11', '2026-11-04', false)).toBe('due');
    expect(zaritAssessmentState('2026-11-11', '2026-11-12', false)).toBe('overdue');
  });

  it('para o atendimento só aparece "pendente" ou "em dia", sem resultado (E-05)', () => {
    expect(zaritStatusForSupport('2026-11-11', '2026-11-04')).toMatchObject({
      status: 'pending',
      label: 'Aplicação pendente',
    });
    expect(zaritStatusForSupport('2027-01-31', '2026-11-04')).toMatchObject({
      status: 'up_to_date',
      label: 'Em dia',
    });
  });
});
