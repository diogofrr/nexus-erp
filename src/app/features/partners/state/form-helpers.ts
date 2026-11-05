import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { ErrorSummaryItem, fieldErrorMessage } from '@shared/ui';

export interface FieldRef {
  controlId: string;
  label: string;
  control: AbstractControl;
}

/** Itens do resumo de erros: a MESMA frase que aparece embaixo do campo (UX 5.9). */
export function collectErrors(fields: readonly FieldRef[]): ErrorSummaryItem[] {
  return fields.flatMap((f): ErrorSummaryItem[] => {
    const message = fieldErrorMessage(f.control.errors, f.label);
    return message ? [{ controlId: f.controlId, message }] : [];
  });
}

/** Validador de duplicidade: `isTaken` recebe o texto e diz se já existe. */
export function notTaken(isTaken: (value: string) => boolean, message: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = typeof control.value === 'string' ? control.value.trim() : '';
    return value !== '' && isTaken(value) ? { duplicate: { message } } : null;
  };
}

/** Máscara de CNPJ `00.000.000/0000-00` enquanto a pessoa digita ou cola. */
export function maskCnpj(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 14);
  const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 8), d.slice(8, 12), d.slice(12, 14)];
  let out = parts[0] ?? '';
  if (parts[1]) {
    out += `.${parts[1]}`;
  }
  if (parts[2]) {
    out += `.${parts[2]}`;
  }
  if (parts[3]) {
    out += `/${parts[3]}`;
  }
  if (parts[4]) {
    out += `-${parts[4]}`;
  }
  return out;
}
