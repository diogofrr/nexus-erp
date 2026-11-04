import { isValidIsoDate } from '@core/clock';
import type { ISODate } from '@core/models';

/** Funções puras das máscaras de entrada (testadas sem Angular). */

export function digitsOf(text: string): string {
  return text.replace(/\D/g, '');
}

/** `12345678900` vira `123.456.789-00`, progressivamente (aceita colar com ou sem pontuação). */
export function maskCpfText(raw: string): string {
  const d = digitsOf(raw).slice(0, 11);
  const [a, b, c, e] = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9), d.slice(9, 11)];
  return a + (b ? `.${b}` : '') + (c ? `.${c}` : '') + (e ? `-${e}` : '');
}

/**
 * `34900000123` vira `(34) 90000-0123` (celular: o número começa em 9, 5 + 4 dígitos);
 * `3432221111` vira `(34) 3222-1111` (fixo, 4 + 4).
 */
export function maskPhoneText(raw: string): string {
  const d = digitsOf(raw).slice(0, 11);
  if (d.length === 0) {
    return '';
  }
  if (d.length <= 2) {
    return `(${d}`;
  }
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  const split = rest.startsWith('9') ? 5 : 4;
  return rest.length <= split ? `(${ddd}) ${rest}` : `(${ddd}) ${rest.slice(0, split)}-${rest.slice(split)}`;
}

/** `04112026` vira `04/11/2026`, progressivamente (sem barra sobrando ao apagar). */
export function maskDateText(raw: string): string {
  const d = digitsOf(raw).slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter((part) => part !== '').join('/');
}

/** `04/11/2026` vira `2026-11-04`; `null` se incompleta ou se a data não existe. */
export function parseDateText(text: string): ISODate | null {
  const d = digitsOf(text);
  if (d.length !== 8) {
    return null;
  }
  const iso = `${d.slice(4, 8)}-${d.slice(2, 4)}-${d.slice(0, 2)}`;
  const year = Number(d.slice(4, 8));
  return year >= 1900 && year <= 2100 && isValidIsoDate(iso) ? iso : null;
}

/** Dígitos de dinheiro até 12 casas (R$ 9.999.999.999,99). */
const MAX_CURRENCY_DIGITS = 12;

/** Centavos a partir do que foi digitado: cada dígito entra pela direita (`5`, `53`, `530` = R$ 5,30). */
export function parseCurrencyCents(raw: string): number | null {
  const d = digitsOf(raw).slice(0, MAX_CURRENCY_DIGITS);
  return d === '' ? null : Number(d);
}

/** Limpa um número digitado: dígitos, uma vírgula (ponto vira vírgula) e, se permitido, o sinal de menos. */
export function sanitizeNumberText(raw: string, decimals: number, allowNegative: boolean): string {
  let s = raw.replace(/[^\d,.-]/g, '').replace(/\./g, ',');
  const negative = allowNegative && s.startsWith('-');
  s = s.replace(/-/g, '');
  if (decimals <= 0) {
    s = s.replace(/,/g, '');
  } else {
    const comma = s.indexOf(',');
    if (comma >= 0) {
      s = s.slice(0, comma + 1) + s.slice(comma + 1).replace(/,/g, '').slice(0, decimals);
    }
  }
  return (negative ? '-' : '') + s;
}

/** `8,5` vira `8.5`; `null` se o texto não é um número completo (`''`, `'-'`, `','`). */
export function parseNumberText(text: string): number | null {
  return /^-?\d+(,\d*)?$/.test(text) ? Number(text.replace(',', '.')) : null;
}

export function numberToText(value: number): string {
  return String(value).replace('.', ',');
}
