/**
 * Campos, opções e validadores que o Começar (cadastro) e o Meu perfil dividem (docs/10-cuidador-ux.md, C2 e C22).
 * As frases de erro seguem o catálogo do UX (A.2.9) na voz do "você". A regra de verdade (18 anos, formatos fictícios,
 * horas de 0 a 24) é a do núcleo (`core/rules/validators.ts`); aqui só se escolhe a frase.
 */
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { isValidIsoDate } from '../../../../core/clock/date-utils';
import { ISODate } from '../../../../core/models';
import type { Channel, Dependency, Relationship } from '../../../../core/models';
import { INVALID_DATE_TEXT, NAME_MAX_CHARS, isTooLong, tooLongText } from '../../../../core/rules/text-limits';
import { validateAdult, validateFictitiousPhone } from '../../../../core/rules/validators';
import { NxValidators, fieldErrorMessage } from '../../../../shared/ui/forms/form-errors';
import type { ErrorSummaryItem } from '../../../../shared/ui/forms/error-summary.component';
import type { CgChoice } from '../../ui/cg-choice-group.component';

export const DEFAULT_CITY = 'Uberlândia';

export const RELATIONSHIP_OPTIONS: readonly { value: Relationship; label: string }[] = [
  { value: 'daughter', label: 'Filha' },
  { value: 'son', label: 'Filho' },
  { value: 'spouse', label: 'Esposa ou marido' },
  { value: 'daughter_in_law', label: 'Nora' },
  { value: 'grandchild', label: 'Neto ou neta' },
  { value: 'other', label: 'Outro' },
];

/** "Como está a rotina dela?": três cartões, nada marcado (RN-USR-09: sem condição de saúde, só o grau de ajuda). */
export const DEPENDENCY_CHOICES: readonly CgChoice<Dependency>[] = [
  { value: 'independent', label: 'Faz quase tudo sem ajuda' },
  { value: 'partial', label: 'Precisa de ajuda em algumas tarefas' },
  { value: 'total', label: 'Precisa de ajuda em quase tudo' },
];

/** "Como você prefere que a gente fale com você?" (RN-CAN-01, RN-USR-18). */
export const CHANNEL_CHOICES: readonly CgChoice<Channel>[] = [
  { value: 'app', label: 'Pelo aplicativo' },
  { value: 'whatsapp', label: 'Pelo WhatsApp' },
  { value: 'phone', label: 'Por telefone' },
];

const CHANNEL_LABEL: Readonly<Record<Channel, string>> = {
  app: 'Pelo aplicativo',
  whatsapp: 'Pelo WhatsApp',
  phone: 'Por telefone',
  email: 'Por e-mail',
};

export function channelLabel(channel: Channel): string {
  return CHANNEL_LABEL[channel];
}

export function relationshipLabel(value: Relationship): string {
  return RELATIONSHIP_OPTIONS.find((o) => o.value === value)?.label ?? 'Outro';
}

export function dependencyLabel(value: Dependency): string {
  return DEPENDENCY_CHOICES.find((o) => o.value === value)?.label ?? '';
}

/** 18 anos ou mais (RN-USR-14), na voz do aplicativo: "Você precisa ter 18 anos ou mais." */
export function adultYou(today: () => ISODate): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as unknown;
    if (typeof value !== 'string' || value === '') {
      return null;
    }
    const result = validateAdult(value, today());
    if (result.valid) {
      return null;
    }
    return {
      minor: {
        message:
          result.code === 'minor'
            ? 'Você precisa ter 18 anos ou mais.'
            : result.code === 'birth_invalid'
              ? INVALID_DATE_TEXT
              : result.message,
      },
    };
  };
}

/** Data de nascimento da pessoa idosa: precisa existir e não pode ser no futuro. */
export function notFuture(today: () => ISODate, what: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as unknown;
    if (typeof value !== 'string' || value === '') {
      return null;
    }
    if (!isValidIsoDate(value)) {
      return { invalidDate: { message: INVALID_DATE_TEXT } };
    }
    return value > today() ? { future: { message: `A data de nascimento ${what} não pode ser no futuro.` } } : null;
  };
}

/** Texto de no máximo `max` caracteres (QAC-015): "Escreva até 120 caracteres." junto do campo. */
export function maxChars(max: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as unknown;
    return typeof value === 'string' && isTooLong(value, max) ? { tooLong: { message: tooLongText(max) } } : null;
  };
}

/** Celular ou telefone do protótipo: `(34) 90000-0000` a `(34) 90000-0999`. */
export const phoneYou: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value as unknown;
  if (typeof value !== 'string' || value.length < 14) {
    return null;
  }
  return validateFictitiousPhone(value).valid
    ? null
    : { phone: { message: 'O telefone deve ter o formato (34) 90000-0000.' } };
};

/** Validadores comuns de "Sobre você" (nome, nascimento, celular, e-mail, cidade). */
export const YOU_VALIDATORS = {
  fullName: [NxValidators.required('o nome completo'), NxValidators.textLength(3, 120, 'O nome')],
  birthDate: (today: () => ISODate): ValidatorFn[] => [NxValidators.required('a data de nascimento'), adultYou(today)],
  phone: [NxValidators.required('o celular'), phoneYou],
  email: [NxValidators.required('o e-mail'), NxValidators.fictitiousEmail],
  city: [NxValidators.required('a cidade'), maxChars(NAME_MAX_CHARS)],
};

export const ELDER_VALIDATORS = {
  fullName: [NxValidators.required('o nome da pessoa'), NxValidators.textLength(3, 120, 'O nome')],
  birthDate: (today: () => ISODate): ValidatorFn[] => [
    NxValidators.required('a data de nascimento dela'),
    notFuture(today, 'dela'),
  ],
};

export const HOURS_VALIDATORS: ValidatorFn[] = [
  NxValidators.required('as horas por dia'),
  NxValidators.range(0, 24, 'As horas por dia'),
];

/** Resumo de erros ("Há 2 pontos para corrigir") com a MESMA frase de cada campo. */
export function summaryOf(
  entries: readonly { id: string; label: string; control: AbstractControl }[],
): ErrorSummaryItem[] {
  return entries.flatMap((entry) => {
    const message = fieldErrorMessage(entry.control.errors, entry.label);
    return message ? [{ controlId: entry.id, message }] : [];
  });
}
