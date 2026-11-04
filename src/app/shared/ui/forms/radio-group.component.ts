import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { uniqueId } from '../util/ids';
import { NX_FIELD } from './field-context';

export interface RadioOption<T = string> {
  value: T;
  label: string;
  /** Texto de apoio abaixo do rótulo. */
  hint?: string;
  disabled?: boolean;
}

/**
 * Grupo de opção única (`.radio`, radios nativos: setas navegam, a seleção segue o foco).
 * Valor de qualquer tipo, com `[(value)]` ou `formControlName`. Nada vem pré-marcado: o valor inicial é `null`.
 *
 * ```html
 * <app-radio-group legend="Canal preferido" [options]="channels" formControlName="channel" />
 * ```
 * Dentro de `<app-form-field group label="...">` omita `legend`: o grupo usa o rótulo do campo.
 */
@Component({
  selector: 'app-radio-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => RadioGroupComponent), multi: true }],
  template: `
    <div
      role="radiogroup"
      [attr.aria-labelledby]="labelledBy()"
      [attr.aria-describedby]="field?.describedBy() ?? null"
      [attr.aria-invalid]="field?.invalid() ? 'true' : null"
    >
      @if (legend()) {
        <span class="field__label" [id]="legendId">{{ legend() }}</span>
      }
      @for (option of options(); track $index) {
        <label class="radio">
          <input
            type="radio"
            [name]="name()"
            [checked]="isSelected(option.value)"
            [disabled]="option.disabled || formDisabled()"
            (change)="select(option.value)"
            (blur)="onTouched()"
          />
          <span>
            {{ option.label }}
            @if (option.hint) {
              <small>{{ option.hint }}</small>
            }
          </span>
        </label>
      }
    </div>
  `,
})
export class RadioGroupComponent<T = string> implements ControlValueAccessor {
  protected readonly field = inject(NX_FIELD, { optional: true });
  readonly options = input.required<readonly RadioOption<T>[]>();
  readonly legend = input<string>();
  readonly value = model<T | null>(null);
  /** Nome do grupo nativo. Sem ele, o componente gera um. */
  readonly name = input(uniqueId('app-radio'));

  protected readonly legendId = uniqueId('app-radio-legend');
  protected readonly formDisabled = signal(false);
  protected readonly labelledBy = computed(() => (this.legend() ? this.legendId : (this.field?.labelId ?? null)));
  private onChange: (value: T | null) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  protected isSelected(value: T): boolean {
    return Object.is(this.value(), value);
  }

  protected select(value: T): void {
    this.value.set(value);
    this.onChange(value);
  }

  writeValue(value: T | null): void {
    this.value.set(value ?? null);
  }

  registerOnChange(fn: (value: T | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.formDisabled.set(isDisabled);
  }
}
