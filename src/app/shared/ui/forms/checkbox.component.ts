import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  forwardRef,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { NX_FIELD } from './field-context';

/**
 * Caixa de seleção (`.check`): a linha inteira é clicável, 44 px de altura. Valor booleano.
 * Funciona com `[(checked)]` ou com `formControlName`. O texto do rótulo é o conteúdo.
 *
 * ```html
 * <app-checkbox formControlName="accepted" hint="Opcional, não muda o plano.">Aceito receber avisos</app-checkbox>
 * ```
 */
@Component({
  selector: 'app-checkbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CheckboxComponent), multi: true }],
  template: `
    <label class="check">
      <input
        type="checkbox"
        [checked]="checked()"
        [indeterminate]="indeterminate()"
        [disabled]="isDisabled()"
        [attr.aria-describedby]="field?.describedBy() ?? null"
        [attr.aria-invalid]="field?.invalid() ? 'true' : null"
        (change)="onToggle($event)"
        (blur)="onTouched()"
      />
      <span>
        <ng-content />
        @if (hint()) {
          <small>{{ hint() }}</small>
        }
      </span>
    </label>
  `,
})
export class CheckboxComponent implements ControlValueAccessor {
  protected readonly field = inject(NX_FIELD, { optional: true });
  readonly checked = model(false);
  /** Estado misto (por exemplo, "selecionar todos" com parte marcada). */
  readonly indeterminate = input(false, { transform: booleanAttribute });
  readonly hint = input<string>();
  readonly disabled = input(false, { transform: booleanAttribute });

  private readonly formDisabled = signal(false);
  protected readonly isDisabled = computed(() => this.disabled() || this.formDisabled());
  private onChange: (value: boolean) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  protected onToggle(event: Event): void {
    const value = (event.target as HTMLInputElement).checked;
    this.checked.set(value);
    this.onChange(value);
  }

  writeValue(value: unknown): void {
    this.checked.set(value === true);
  }

  registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.formDisabled.set(isDisabled);
  }
}
