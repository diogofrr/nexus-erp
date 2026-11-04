import { describe, expect, it } from 'vitest';
import {
  formatBytes,
  formatCount,
  formatDate,
  formatDateTime,
  formatDuration,
  formatMoney,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  formatScore,
  formatTime,
  formatYearMonth,
} from './format';
import {
  CpfMaskPipe,
  DateBrPipe,
  DateTimeBrPipe,
  MoneyPipe,
  NumberBrPipe,
  PercentBrPipe,
  TimeBrPipe,
} from './pipes';

describe('Formatação pt-BR (AC-GL-02)', () => {
  it('dinheiro em centavos vira R$ 1.234,56', () => {
    expect(formatMoney(123_456)).toBe('R$ 1.234,56');
    expect(formatMoney(4990)).toBe('R$ 49,90');
    expect(formatMoney(0)).toBe('R$ 0,00');
    expect(formatMoney(5)).toBe('R$ 0,05');
    expect(formatMoney(2_826_000)).toBe('R$ 28.260,00');
    expect(formatMoney(13_238_150)).toBe('R$ 132.381,50');
    expect(formatMoney(100_000_000)).toBe('R$ 1.000.000,00');
  });

  it('dinheiro negativo usa hífen, nunca travessão', () => {
    expect(formatMoney(-84_351)).toBe('-R$ 843,51');
    expect(formatMoney(-84_351)).not.toMatch(new RegExp('[\u2013\u2014\u2212]'));
  });

  it('vazio para valores ausentes', () => {
    expect(formatMoney(null)).toBe('');
    expect(formatMoney(undefined)).toBe('');
    expect(formatNumber(null)).toBe('');
    expect(formatPercent(undefined)).toBe('');
    expect(formatDate(null)).toBe('');
    expect(formatTime('')).toBe('');
    expect(formatDateTime(undefined)).toBe('');
  });

  it('data dd/MM/aaaa a partir de data ou instante', () => {
    expect(formatDate('2026-11-04')).toBe('04/11/2026');
    expect(formatDate('2026-11-04T23:30:00-03:00')).toBe('04/11/2026');
    expect(formatDate('2026-11-05T01:30:00Z')).toBe('04/11/2026'); // 22h30 de Brasília
  });

  it('hora HH:mm e data com hora', () => {
    expect(formatTime('2026-11-04T09:05:00-03:00')).toBe('09:05');
    expect(formatTime('14:30')).toBe('14:30');
    expect(formatDateTime('2026-11-04T09:30:00-03:00')).toBe('04/11/2026 09:30');
  });

  it('percentual com vírgula e uma casa quando fracionário', () => {
    expect(formatPercent(80)).toBe('80%');
    expect(formatPercent(86.25)).toBe('86,3%');
    expect(formatPercent(66.666)).toBe('66,7%');
    expect(formatPercent(5)).toBe('5%');
    expect(formatPercent(5, { decimals: 1 })).toBe('5,0%');
    expect(formatPercent(-21.2, { signed: true })).toBe('-21,2%');
    expect(formatPercent(12.5, { signed: true })).toBe('+12,5%');
    expect(formatPercent(0, { signed: true })).toBe('0%');
  });

  it('número com milhar e vírgula decimal, nota com 2 casas', () => {
    expect(formatNumber(1234567.891, 2)).toBe('1.234.567,89');
    expect(formatNumber(1000)).toBe('1.000');
    expect(formatNumber(-1234.5, 1)).toBe('-1.234,5');
    expect(formatScore(4.5)).toBe('4,50');
    expect(formatScore(null)).toBe('');
  });

  it('mês por extenso', () => {
    expect(formatYearMonth('2026-10')).toBe('outubro de 2026');
    expect(formatYearMonth('2026-03')).toBe('março de 2026');
  });

  it('tempo relativo a uma data de referência', () => {
    const now = '2026-11-04T12:00:00-03:00';
    expect(formatRelativeTime('2026-11-04', now)).toBe('hoje');
    expect(formatRelativeTime('2026-11-05', now)).toBe('amanhã');
    expect(formatRelativeTime('2026-11-03', now)).toBe('ontem');
    expect(formatRelativeTime('2026-11-09', now)).toBe('em 5 dias');
    expect(formatRelativeTime('2026-10-25', now)).toBe('há 10 dias');
    expect(formatRelativeTime('2026-05-01', now)).toBe('há 6 meses');
    expect(formatRelativeTime('2024-01-01', now)).toBe('há 3 anos');
    expect(formatRelativeTime('2026-11-04T12:00:20-03:00', now)).toBe('agora');
    expect(formatRelativeTime('2026-11-04T11:45:00-03:00', now)).toBe('há 15 min');
    expect(formatRelativeTime('2026-11-04T09:00:00-03:00', now)).toBe('há 3 horas');
    expect(formatRelativeTime('2026-11-04T13:00:00-03:00', now)).toBe('em 1 hora');
    expect(formatRelativeTime('2026-11-01T09:00:00-03:00', now)).toBe('há 3 dias');
    expect(formatRelativeTime(null, now)).toBe('');
  });

  it('duração, tamanho e contagem', () => {
    expect(formatDuration(150)).toBe('2 h 30 min');
    expect(formatDuration(120)).toBe('2 h');
    expect(formatDuration(45)).toBe('45 min');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2,0 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3,00 MB');
    expect(formatCount(1, 'dia', 'dias')).toBe('1 dia');
    expect(formatCount(5, 'dia', 'dias')).toBe('5 dias');
  });

  it('os pipes usam as mesmas funções', () => {
    expect(new MoneyPipe().transform(4990)).toBe('R$ 49,90');
    expect(new DateBrPipe().transform('2026-11-04')).toBe('04/11/2026');
    expect(new TimeBrPipe().transform('2026-11-04T09:30:00-03:00')).toBe('09:30');
    expect(new DateTimeBrPipe().transform('2026-11-04T09:30:00-03:00')).toBe('04/11/2026 09:30');
    expect(new PercentBrPipe().transform(86.25)).toBe('86,3%');
    expect(new NumberBrPipe().transform(1234.5, 1)).toBe('1.234,5');
    expect(new CpfMaskPipe().transform('123.456.789-00')).toBe('***.***.***-**');
  });
});
