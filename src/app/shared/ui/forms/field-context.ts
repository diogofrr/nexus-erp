import { InjectionToken, Signal } from '@angular/core';

/**
 * Contexto que o `app-form-field` oferece aos controles projetados dentro dele (`appInput`, `app-checkbox`,
 * `app-radio-group`...). Assim cada controle liga sozinho `id`, `aria-describedby`, `aria-invalid` e
 * `aria-required`, sem o dev de módulo repetir nada.
 */
export interface FieldContext {
  /** Id que o rótulo (`for`) aponta; o controle principal usa este id. */
  readonly controlId: Signal<string>;
  /** Id do rótulo (para `aria-labelledby` em grupos). */
  readonly labelId: string;
  /** Ids da dica e do erro, separados por espaço (ou `null`). */
  readonly describedBy: Signal<string | null>;
  /** O erro está visível? */
  readonly invalid: Signal<boolean>;
  /** Obrigatório (o campo não foi marcado como opcional). */
  readonly required: Signal<boolean>;
}

export const NX_FIELD = new InjectionToken<FieldContext>('NX_FIELD');
