import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  booleanAttribute,
  computed,
  forwardRef,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { NX_FIELD } from './field-context';

/**
 * Interruptor (`.switch`, `role="switch"`). O rótulo diz o EFEITO, não só "ligado"
 * ("Avançar automaticamente ao responder"). Valor booleano, com `[(checked)]` ou `formControlName`.
 *
 * ```html
 * <app-switch [(checked)]="auto">Avançar automaticamente ao responder</app-switch>
 * ```
 */
@Component({
  selector: 'app-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SwitchComponent), multi: true }],
  template: `
    <label class="switch">
      <input
        #control
        type="checkbox"
        role="switch"
        [checked]="checked()"
        [disabled]="isDisabled()"
        [attr.aria-describedby]="field?.describedBy() ?? null"
        (change)="onToggle($event)"
        (blur)="onTouched()"
      />
      <span><ng-content /></span>
    </label>
  `,
})
export class SwitchComponent implements ControlValueAccessor {
  protected readonly field = inject(NX_FIELD, { optional: true });
  readonly checked = model(false);
  readonly disabled = input(false, { transform: booleanAttribute });

  private readonly formDisabled = signal(false);
  protected readonly isDisabled = computed(() => this.disabled() || this.formDisabled());
  private readonly control = viewChild.required<ElementRef<HTMLInputElement>>('control');
  private onChange: (value: boolean) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  /** Devolve o interruptor ao valor do modelo (quando quem usa recusa uma mudança, por exemplo pedindo confirmação). */
  sync(): void {
    this.control().nativeElement.checked = this.checked();
  }

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
