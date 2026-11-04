/**
 * Validadores de entrada (LP-02, AC-GL-12, RN-USR-14, RN-ATD-06).
 * Dados 100% fictícios: CPF válido é REJEITADO; e-mail só `@exemplo.com.br`; telefone só `(34) 90000-0000` a `(34) 90000-0999`.
 */
import { ISODate } from '../models/primitives';
import { ageInYears, isValidIsoDate } from '../clock/date-utils';
import { isIntegerInRange } from './numbers';

export type ValidationResult = { valid: true } | { valid: false; code: string; message: string };

const OK: ValidationResult = { valid: true };

function fail(code: string, message: string): ValidationResult {
  return { valid: false, code, message };
}

export const FICTITIOUS_EMAIL_DOMAIN = 'exemplo.com.br';

// ===== CPF e CNPJ =====

const CPF_FORMAT = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
const CNPJ_FORMAT = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;

function onlyDigits(text: string): number[] {
  return text
    .replace(/\D/g, '')
    .split('')
    .map((c) => Number(c));
}

function cpfCheckDigit(digits: readonly number[], length: number): number {
  let total = 0;
  for (let i = 0; i < length; i += 1) {
    total += (digits[i] ?? 0) * (length + 1 - i);
  }
  const rest = (total * 10) % 11;
  return rest === 10 ? 0 : rest;
}

/** Os dois dígitos verificadores corretos para os 9 primeiros dígitos. */
export function cpfCheckDigits(first9: readonly number[]): [number, number] {
  const d1 = cpfCheckDigit(first9, 9);
  const d2 = cpfCheckDigit([...first9, d1], 10);
  return [d1, d2];
}

/** `true` se o CPF tem dígitos verificadores corretos (CPF "real"). Sequências repetidas são inválidas. */
export function isCpfChecksumValid(cpf: string): boolean {
  const digits = onlyDigits(cpf);
  if (digits.length !== 11 || digits.every((d) => d === digits[0])) {
    return false;
  }
  const [d1, d2] = cpfCheckDigits(digits.slice(0, 9));
  return digits[9] === d1 && digits[10] === d2;
}

/**
 * RN-USR-14 / AC-M03-01: o CPF precisa ter o formato `000.000.000-00` e dígitos verificadores INVÁLIDOS.
 * CPF matematicamente válido é rejeitado.
 */
export function validateFictitiousCpf(cpf: string): ValidationResult {
  if (!CPF_FORMAT.test(cpf)) {
    return fail('cpf_format', 'Use o formato 000.000.000-00.');
  }
  if (isCpfChecksumValid(cpf)) {
    return fail('cpf_looks_real', 'Parece um CPF real. Use um CPF fictício.');
  }
  return OK;
}

/** Gera um CPF fictício `000.000.NNN-DD` determinístico, com dígitos verificadores inválidos. */
export function generateFictitiousCpf(n: number): string {
  const seq = Math.abs(Math.trunc(n)) % 1_000_000;
  const mid = String(Math.floor(seq / 1000)).padStart(3, '0');
  const last = String(seq % 1000).padStart(3, '0');
  const first9 = `000${mid}${last}`.split('').map((c) => Number(c));
  const [d1, d2] = cpfCheckDigits(first9);
  // Dígitos "00" por padrão; se coincidirem com os corretos, troca para "01".
  const fake = d1 === 0 && d2 === 0 ? '01' : '00';
  return `000.${mid}.${last}-${fake}`;
}

function cnpjCheckDigit(digits: readonly number[], weights: readonly number[]): number {
  const total = weights.reduce((acc, w, i) => acc + (digits[i] ?? 0) * w, 0);
  const rest = total % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function isCnpjChecksumValid(cnpj: string): boolean {
  const digits = onlyDigits(cnpj);
  if (digits.length !== 14 || digits.every((d) => d === digits[0])) {
    return false;
  }
  const d1 = cnpjCheckDigit(digits, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = cnpjCheckDigit([...digits.slice(0, 12), d1], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return digits[12] === d1 && digits[13] === d2;
}

export function validateFictitiousCnpj(cnpj: string): ValidationResult {
  if (!CNPJ_FORMAT.test(cnpj)) {
    return fail('cnpj_format', 'Use o formato 00.000.000/0000-00.');
  }
  if (isCnpjChecksumValid(cnpj)) {
    return fail('cnpj_looks_real', 'Parece um CNPJ real. Use um CNPJ fictício.');
  }
  return OK;
}

/** CNPJ fictício `00.000.NNN/0001-00` determinístico, com dígitos verificadores inválidos. */
export function generateFictitiousCnpj(n: number): string {
  const seq = String(Math.abs(Math.trunc(n)) % 1000).padStart(3, '0');
  const base = `00000${seq}0001`.split('').map((c) => Number(c));
  const d1 = cnpjCheckDigit(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = cnpjCheckDigit([...base, d1], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const fake = d1 === 0 && d2 === 0 ? '01' : '00';
  return `00.000.${seq}/0001-${fake}`;
}

// ===== E-mail e telefone =====

const EMAIL_SHAPE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

/** Valida a forma de um e-mail (qualquer domínio). */
export function isEmailShapeValid(email: string): boolean {
  return EMAIL_SHAPE.test(email);
}

/** LP-02: só e-mail `@exemplo.com.br`. */
export function validateFictitiousEmail(email: string): ValidationResult {
  if (!isEmailShapeValid(email)) {
    return fail('email_format', 'Informe um e-mail válido, por exemplo nome@exemplo.com.br.');
  }
  if (!email.toLowerCase().endsWith(`@${FICTITIOUS_EMAIL_DOMAIN}`)) {
    return fail(
      'email_not_fictitious',
      `Use dados fictícios: o e-mail deve terminar em @${FICTITIOUS_EMAIL_DOMAIN}.`,
    );
  }
  return OK;
}

const FICTITIOUS_PHONE = /^\(34\) 90000-0\d{3}$/;
const PHONE_SHAPE = /^\(\d{2}\) 9?\d{4}-\d{4}$/;

export function isPhoneShapeValid(phone: string): boolean {
  return PHONE_SHAPE.test(phone);
}

/** LP-02: telefone no padrão `(34) 90000-0000` a `(34) 90000-0999`. */
export function validateFictitiousPhone(phone: string): ValidationResult {
  if (!isPhoneShapeValid(phone)) {
    return fail('phone_format', 'Use o formato (34) 90000-0000.');
  }
  if (!FICTITIOUS_PHONE.test(phone)) {
    return fail(
      'phone_not_fictitious',
      'Use dados fictícios: telefone de (34) 90000-0000 a (34) 90000-0999.',
    );
  }
  return OK;
}

/** Telefone fictício determinístico `(34) 90000-0NNN`. */
export function generateFictitiousPhone(n: number): string {
  return `(34) 90000-0${String(Math.abs(Math.trunc(n)) % 1000).padStart(3, '0')}`;
}

// ===== Conselhos de classe =====

export type CouncilKind = 'CRP' | 'CRO' | 'CREFITO' | 'COREN' | 'CRN' | 'OAB';

const COUNCIL_PATTERNS: Record<CouncilKind, { regex: RegExp; example: string }> = {
  CRP: { regex: /^CRP-\d{2}\/\d{5}$/, example: 'CRP-04/00102' },
  CRO: { regex: /^CRO-[A-Z]{2} \d{5}$/, example: 'CRO-MG 00000' },
  CREFITO: { regex: /^CREFITO-\d{1,2}\/\d{5}(-[FTO])?$/, example: 'CREFITO-4/00000-F' },
  COREN: { regex: /^COREN-[A-Z]{2} \d{6}$/, example: 'COREN-MG 000000' },
  CRN: { regex: /^CRN-\d{1,2}\/\d{5}$/, example: 'CRN-9/00000' },
  OAB: { regex: /^OAB\/[A-Z]{2} \d{5}$/, example: 'OAB/MG 00000' },
};

/** Valida o formato do registro no conselho (`CRP-04/00102`, `CRO-MG 00000`...). Não consulta nenhum conselho. */
export function validateCouncilRegistration(
  kind: CouncilKind,
  registration: string,
): ValidationResult {
  const pattern = COUNCIL_PATTERNS[kind];
  return pattern.regex.test(registration)
    ? OK
    : fail('council_format', `Use o formato do ${kind}, por exemplo ${pattern.example}.`);
}

export const validateCrp = (registration: string): ValidationResult =>
  validateCouncilRegistration('CRP', registration);
export const validateCro = (registration: string): ValidationResult =>
  validateCouncilRegistration('CRO', registration);

/** Registro ativo e dentro da validade (RN-REDE-03, RN-REDE-22). */
export function validateCouncilValidity(
  status: 'active' | 'inactive' | 'not_applicable',
  validUntil: ISODate | undefined,
  today: ISODate,
): ValidationResult {
  if (status === 'not_applicable') {
    return OK;
  }
  if (status !== 'active') {
    return fail('council_inactive', 'O registro no conselho precisa estar ativo.');
  }
  if (!validUntil || !isValidIsoDate(validUntil)) {
    return fail('council_validity_missing', 'Informe a validade do registro.');
  }
  return validUntil < today ? fail('council_expired', 'O registro no conselho está vencido.') : OK;
}

// ===== Cuidador =====

/** RN-USR-14: maioridade (18 anos completos hoje é aceito). */
export function validateAdult(birthDate: ISODate, today: ISODate): ValidationResult {
  if (!isValidIsoDate(birthDate)) {
    return fail('birth_invalid', 'Informe uma data de nascimento válida.');
  }
  if (birthDate > today) {
    return fail('birth_future', 'A data de nascimento não pode ser no futuro.');
  }
  return ageInYears(birthDate, today) >= 18
    ? OK
    : fail('minor', 'O cuidador precisa ter 18 anos ou mais.');
}

/** RN-USR-04: horas diárias de cuidado, inteiro de 0 a 24. */
export function validateDailyCareHours(hours: unknown): ValidationResult {
  return isIntegerInRange(hours, 0, 24)
    ? OK
    : fail('hours_range', 'Informe um número inteiro de horas, de 0 a 24.');
}

export function validateRequiredText(value: string, label: string): ValidationResult {
  return value.trim().length > 0 ? OK : fail('required', `${label} é obrigatório.`);
}

/** Percentual de desconto do parceiro: 0 a 100 com no máximo uma casa decimal (RN-CRT-11). */
export function validateDiscountPercent(value: number): ValidationResult {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    return fail('discount_range', 'O desconto deve ficar entre 0 e 100.');
  }
  return Math.abs(value * 10 - Math.round(value * 10)) < 1e-9
    ? OK
    : fail('discount_decimals', 'Use no máximo uma casa decimal.');
}

/** As duas notas da ARP são obrigatórias, inteiras, de 1 a 5 (RN-ARP-02). */
export function validateEvaluationScores(
  technical: unknown,
  punctuality: unknown,
): ValidationResult {
  if (!isIntegerInRange(technical, 1, 5) || !isIntegerInRange(punctuality, 1, 5)) {
    return fail('score_range', 'As duas notas são obrigatórias e vão de 1 a 5.');
  }
  return OK;
}
