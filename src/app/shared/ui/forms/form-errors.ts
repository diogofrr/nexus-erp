import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import type { ISODate } from '@core/models';
import {
  validateAdult,
  validateFictitiousCpf,
  validateFictitiousEmail,
  validateFictitiousPhone,
} from '@core/rules';

/**
 * Catálogo de mensagens de erro (design system, seção 7.4). Uma por tipo, a mesma frase no campo e no resumo.
 * Fórmula: o que houve e como resolver. Sem "inválido", sem "por favor", sem código técnico.
 */
export const ERROR_MESSAGES = {
  /** Vazio: "Informe a data de nascimento." */
  required: (what: string): string => `Informe ${what}.`,
  /** Formato: "O telefone deve estar no formato (34) 90000-0000." */
  format: (subject: string, example: string): string =>
    `${subject} deve estar no formato ${example}.`,
  minor: 'A pessoa cuidadora deve ter 18 anos ou mais.',
  realCpf: 'Parece um CPF real. Use um CPF fictício.',
  email: 'Use um e-mail que termine em @exemplo.com.br.',
  emailShape: 'Informe um e-mail válido, por exemplo nome@exemplo.com.br.',
  phone: 'Use um telefone de (34) 90000-0000 a (34) 90000-0999.',
  /** Fora do intervalo: "As horas por dia devem ser de 0 a 24." */
  range: (subject: string, min: number, max: number): string =>
    `${subject} devem ser de ${min} a ${max}.`,
  duplicate: 'Já existe um cadastro com este código.',
  system: 'Não foi possível salvar. Tente de novo; se continuar, avise a equipe.',
} as const;

interface MessageError {
  message: string;
}

function hasMessage(value: unknown): value is MessageError {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { message?: unknown }).message === 'string'
  );
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function numberOf(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

/**
 * Texto do primeiro erro de um controle. Erros criados pelo `NxValidators` e pelas máscaras já trazem a
 * `message`; os validadores nativos do Angular (`required`, `email`, `minlength`...) viram frases do catálogo.
 * `label` é o rótulo do campo, usado nas frases genéricas.
 */
export function fieldErrorMessage(errors: ValidationErrors | null, label = 'o campo'): string | null {
  if (!errors) {
    return null;
  }
  const first = Object.entries(errors)[0];
  if (!first) {
    return null;
  }
  const [key, value] = first;
  if (hasMessage(value)) {
    return value.message;
  }
  const detail = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  switch (key) {
    case 'required':
      return ERROR_MESSAGES.required(lowerFirst(label));
    case 'email':
      return ERROR_MESSAGES.emailShape;
    case 'minlength':
      return `${label} deve ter pelo menos ${numberOf(detail['requiredLength']) ?? 1} caracteres.`;
    case 'maxlength':
      return `${label} deve ter no máximo ${numberOf(detail['requiredLength']) ?? 1} caracteres.`;
    case 'min':
      return `O valor deve ser de pelo menos ${numberOf(detail['min']) ?? 0}.`;
    case 'max':
      return `O valor deve ser de no máximo ${numberOf(detail['max']) ?? 0}.`;
    case 'pattern':
      return `Confira o formato de ${lowerFirst(label)}.`;
    default:
      return `Confira ${lowerFirst(label)} e tente de novo.`;
  }
}

function isEmpty(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0)
  );
}

/**
 * Validadores do Nexus, todos com mensagem do catálogo. Constantes não recebem argumentos
 * (`NxValidators.fictitiousCpf`); funções são fábricas (`NxValidators.required('a data de nascimento')`).
 * Todos ignoram o valor vazio (use `required` para exigir) e o valor incompleto (a máscara já avisa).
 */
export const NxValidators = {
  /** Obrigatório, com o complemento já no gênero certo: `required('a data de nascimento')`. */
  required:
    (what: string): ValidatorFn =>
    (control: AbstractControl): ValidationErrors | null =>
      isEmpty(control.value) ? { required: { message: ERROR_MESSAGES.required(what) } } : null,

  /** CPF no formato `000.000.000-00` com dígitos verificadores INVÁLIDOS (dado fictício, AC-GL-12). */
  fictitiousCpf: ((control: AbstractControl): ValidationErrors | null => {
    const value = control.value as unknown;
    if (typeof value !== 'string' || value.length !== 14) {
      return null;
    }
    const result = validateFictitiousCpf(value);
    return result.valid ? null : { realCpf: { message: ERROR_MESSAGES.realCpf } };
  }) as ValidatorFn,

  /** E-mail terminado em `@exemplo.com.br`. */
  fictitiousEmail: ((control: AbstractControl): ValidationErrors | null => {
    const value = control.value as unknown;
    if (isEmpty(value) || typeof value !== 'string') {
      return null;
    }
    const result = validateFictitiousEmail(value.trim());
    if (result.valid) {
      return null;
    }
    return {
      email: {
        message: result.code === 'email_format' ? ERROR_MESSAGES.emailShape : ERROR_MESSAGES.email,
      },
    };
  }) as ValidatorFn,

  /** Telefone de `(34) 90000-0000` a `(34) 90000-0999`. */
  fictitiousPhone: ((control: AbstractControl): ValidationErrors | null => {
    const value = control.value as unknown;
    if (typeof value !== 'string' || value.length < 14) {
      return null;
    }
    return validateFictitiousPhone(value).valid ? null : { phone: { message: ERROR_MESSAGES.phone } };
  }) as ValidatorFn,

  /** Maioridade (18 anos). Recebe a data de hoje do `Clock`: `adult(() => clock.today())`. */
  adult:
    (today: () => ISODate): ValidatorFn =>
    (control: AbstractControl): ValidationErrors | null => {
      const value = control.value as unknown;
      if (typeof value !== 'string' || value === '') {
        return null;
      }
      const result = validateAdult(value, today());
      return result.valid ? null : { minor: { message: ERROR_MESSAGES.minor } };
    },

  /** Intervalo numérico. `subject` é o sujeito plural da frase: `range(0, 24, 'As horas por dia')`. */
  range:
    (min: number, max: number, subject = 'Os valores'): ValidatorFn =>
    (control: AbstractControl): ValidationErrors | null => {
      const value = control.value as unknown;
      if (typeof value !== 'number') {
        return null;
      }
      return value < min || value > max
        ? { range: { min, max, message: ERROR_MESSAGES.range(subject, min, max) } }
        : null;
    },

  /**
   * Tamanho do texto digitado (QA-016): nome de uma letra ou de 600 caracteres não passa.
   * `textLength(3, 120, 'O nome')`. Ignora o vazio (use `required`) e conta sem os espaços das pontas.
   */
  textLength:
    (min: number, max: number, subject: string): ValidatorFn =>
    (control: AbstractControl): ValidationErrors | null => {
      const value = control.value as unknown;
      if (typeof value !== 'string' || value.trim() === '') {
        return null;
      }
      const size = value.trim().length;
      return size < min || size > max
        ? { length: { min, max, message: `${subject} deve ter de ${min} a ${max} caracteres.` } }
        : null;
    },

  /** Marca o campo como duplicado quando `isTaken` devolve verdadeiro. */
  unique:
    (isTaken: (value: unknown) => boolean): ValidatorFn =>
    (control: AbstractControl): ValidationErrors | null =>
      !isEmpty(control.value) && isTaken(control.value)
        ? { duplicate: { message: ERROR_MESSAGES.duplicate } }
        : null,
} as const;
