import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { uniqueId } from '../util/ids';
import { NX_FIELD } from './field-context';

/**
 * Nota de 1 a 5 (avaliação da rede, ARP): cinco botões NUMERADOS de 44 px (rádio nativo), nunca só estrelas,
 * com os extremos escritos ("Ruim" e "Excelente"). Valor `number | null`; nada vem pré-marcado.
 *
 * ```html
 * <app-rating label="Nota do atendimento" formControlName="serviceScore" />
 * ```
 */
@Component({
  selector: 'app-rating',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => RatingComponent), multi: true }],
  template: `
    <div
      class="rating"
      role="radiogroup"
      [attr.aria-label]="field?.labelId ? null : label()"
      [attr.aria-labelledby]="field?.labelId ?? null"
      [attr.aria-describedby]="field?.describedBy() ?? null"
    >
      @for (n of scale; track n) {
        <label class="rating__option">
          <input
            type="radio"
            [name]="name"
            [checked]="value() === n"
            [disabled]="disabled()"
            [attr.aria-label]="optionLabel(n)"
            (change)="select(n)"
            (blur)="onTouched()"
          />
          {{ n }}
        </label>
      }
    </div>
    <div class="rating__ends" aria-hidden="true">
      <span>{{ ends()[0] }}</span>
      <span>{{ ends()[1] }}</span>
    </div>
  `,
})
export class RatingComponent implements ControlValueAccessor {
  protected readonly field = inject(NX_FIELD, { optional: true });
  readonly value = model<number | null>(null);
  /** Nome acessível do grupo quando não há `app-form-field` por perto. */
  readonly label = input('Nota');
  /** Rótulos dos extremos. */
  readonly ends = input<readonly [string, string]>(['Ruim', 'Excelente']);

  protected readonly scale = [1, 2, 3, 4, 5] as const;
  protected readonly name = uniqueId('app-rating');
  protected readonly disabled = signal(false);
  private onChange: (value: number | null) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  protected optionLabel(n: number): string {
    const [low, high] = this.ends();
    return n === 1 ? `1, ${low.toLowerCase()}` : n === 5 ? `5, ${high.toLowerCase()}` : String(n);
  }

  protected select(n: number): void {
    this.value.set(n);
    this.onChange(n);
  }

  writeValue(value: unknown): void {
    this.value.set(typeof value === 'number' ? value : null);
  }

  registerOnChange(fn: (value: number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }
}
