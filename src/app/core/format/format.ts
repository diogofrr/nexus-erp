/**
 * Formatação pt-BR (AC-GL-02): dinheiro `R$ 1.234,56`, data `dd/MM/aaaa`, hora `HH:mm`, percentual com
 * vírgula (uma casa quando fracionário). Funções puras, sem `Intl` (o `Intl` usa espaço não separável e
 * muda entre navegadores): o resultado é sempre o mesmo texto ASCII.
 */
import { daysBetween, dateOf, epochMs, timeOf } from '../clock/date-utils';
import { Cents, ISODate, ISODateTime, YearMonth } from '../models/primitives';
import { roundHalfUp } from '../rules/numbers';

function groupThousands(integerPart: string): string {
  return integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Dinheiro em centavos: `123456` vira `R$ 1.234,56`; negativo vira `-R$ 843,51`. */
export function formatMoney(cents: Cents | null | undefined): string {
  if (cents === null || cents === undefined || Number.isNaN(cents)) {
    return '';
  }
  const rounded = Math.round(cents);
  const abs = Math.abs(rounded);
  const reais = Math.floor(abs / 100);
  const centavos = String(abs % 100).padStart(2, '0');
  return `${rounded < 0 ? '-' : ''}R$ ${groupThousands(String(reais))},${centavos}`;
}

/** Número com separador de milhar e vírgula decimal. */
export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '';
  }
  const rounded = roundHalfUp(value, decimals);
  const [intPart, decPart] = Math.abs(rounded).toFixed(decimals).split('.');
  const body = groupThousands(intPart as string) + (decPart ? `,${decPart}` : '');
  return `${rounded < 0 ? '-' : ''}${body}`;
}

/** `2026-11-04` ou `2026-11-04T09:30:00-03:00` vira `04/11/2026`. */
export function formatDate(value: ISODate | ISODateTime | null | undefined): string {
  if (!value) {
    return '';
  }
  const date = value.length > 10 ? dateOf(value) : value;
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

/** Hora `HH:mm` (Brasília) de um instante; texto `HH:mm` passa direto. */
export function formatTime(value: ISODateTime | string | null | undefined): string {
  if (!value) {
    return '';
  }
  return /^\d{2}:\d{2}$/.test(value) ? value : timeOf(value);
}

/** `04/11/2026 09:30`. */
export function formatDateTime(value: ISODateTime | null | undefined): string {
  return value ? `${formatDate(value)} ${formatTime(value)}` : '';
}

export interface PercentOptions {
  /** Casas decimais fixas. Sem isso: nenhuma se for inteiro, uma se for fracionário. */
  decimals?: number;
  /** Sinal explícito (+/-) para variações. */
  signed?: boolean;
}

/** Percentual com vírgula: `80` vira `80%`, `86.25` vira `86,3%`, `-21.2` com sinal vira `-21,2%`. */
export function formatPercent(
  value: number | null | undefined,
  options: PercentOptions = {},
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '';
  }
  const decimals = options.decimals ?? (Number.isInteger(value) ? 0 : 1);
  const rounded = roundHalfUp(value, decimals);
  const body = Math.abs(rounded).toFixed(decimals).replace('.', ',');
  const sign = rounded < 0 ? '-' : options.signed && rounded > 0 ? '+' : '';
  return `${sign}${body}%`;
}

/** Nota com vírgula e duas casas: `4.5` vira `4,50`. */
export function formatScore(value: number | null | undefined, decimals = 2): string {
  return value === null || value === undefined ? '' : formatNumber(value, decimals);
}

/** `2026-10` vira `outubro de 2026`. */
const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

export function formatYearMonth(value: YearMonth): string {
  const [y, m] = value.split('-');
  return `${MONTHS[Number(m) - 1] ?? ''} de ${y}`;
}

function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

/**
 * Tempo relativo a `now`: "hoje", "ontem", "amanhã", "há 3 dias", "em 5 dias", "há 2 horas", "há 15 min",
 * "agora". Data sem hora compara só dias; instante com hora também mostra horas e minutos.
 */
export function formatRelativeTime(
  value: ISODate | ISODateTime | null | undefined,
  now: ISODateTime,
): string {
  if (!value) {
    return '';
  }
  if (value.length === 10) {
    return relativeDays(daysBetween(dateOf(now), value));
  }
  const minutes = Math.round((epochMs(value) - epochMs(now)) / 60_000);
  const abs = Math.abs(minutes);
  if (abs < 1) {
    return 'agora';
  }
  const future = minutes > 0;
  if (abs < 60) {
    return `${future ? 'em' : 'há'} ${abs} min`;
  }
  if (abs < 60 * 24) {
    const hours = Math.floor(abs / 60);
    return `${future ? 'em' : 'há'} ${plural(hours, 'hora', 'horas')}`;
  }
  return relativeDays(daysBetween(dateOf(now), dateOf(value)));
}

function relativeDays(days: number): string {
  if (days === 0) {
    return 'hoje';
  }
  if (days === 1) {
    return 'amanhã';
  }
  if (days === -1) {
    return 'ontem';
  }
  const abs = Math.abs(days);
  const prefix = days > 0 ? 'em' : 'há';
  if (abs < 60) {
    return `${prefix} ${abs} dias`;
  }
  if (abs < 730) {
    return `${prefix} ${plural(Math.round(abs / 30), 'mês', 'meses')}`;
  }
  return `${prefix} ${Math.round(abs / 365)} anos`;
}

/** `150` vira `2 h 30 min`. */
export function formatDuration(totalMinutes: number): string {
  const sign = totalMinutes < 0 ? '-' : '';
  const abs = Math.round(Math.abs(totalMinutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) {
    return `${sign}${m} min`;
  }
  return m === 0 ? `${sign}${h} h` : `${sign}${h} h ${m} min`;
}

/** Tamanho de armazenamento: `2048` vira `2,0 KB`. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${formatNumber(bytes / 1024, 1)} KB`;
  }
  return `${formatNumber(bytes / (1024 * 1024), 2)} MB`;
}

/** Contagem com singular e plural: `formatCount(1, 'dia', 'dias')` resulta `1 dia`. */
export function formatCount(n: number, singular: string, pluralForm: string): string {
  return plural(n, singular, pluralForm);
}
