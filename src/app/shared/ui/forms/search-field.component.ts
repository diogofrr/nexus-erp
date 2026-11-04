import { ChangeDetectionStrategy, Component, forwardRef, input, model, output, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { IconComponent } from '../display/icon.component';

/**
 * Campo de busca (`.input-wrap` com lupa e botão "Limpar"). Funciona com `[(value)]` ou com `formControl`.
 * O texto digitado NUNCA vai para a URL (pode ser nome de pessoa, LP-21): guarde-o em memória.
 *
 * ```html
 * <app-search-field label="Buscar cuidador" placeholder="Código ou nome" [(value)]="term" />
 * ```
 */
@Component({
  selector: 'app-search-field',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SearchFieldComponent), multi: true }],
  host: { class: 'input-wrap' },
  template: `
    <svg appIcon="search"></svg>
    <input
      class="input"
      type="search"
      autocomplete="off"
      [value]="value()"
      [attr.aria-label]="label()"
      [attr.placeholder]="placeholder() || null"
      [disabled]="disabled()"
      (input)="onInput($event)"
      (keydown.escape)="clear()"
      (blur)="onTouched()"
    />
    @if (value() && !disabled()) {
      <button type="button" class="input-wrap__action" aria-label="Limpar busca" (click)="clear()">
        <svg appIcon="x" size="sm"></svg>
      </button>
    }
  `,
})
export class SearchFieldComponent implements ControlValueAccessor {
  readonly value = model('');
  /** Nome acessível do campo (não há rótulo visível). */
  readonly label = input('Buscar');
  readonly placeholder = input('');
  /** Emite o texto atual a cada mudança (útil para quem não usa `[(value)]`). */
  readonly searched = output<string>();

  protected readonly disabled = signal(false);
  private onChange: (value: string) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  protected onInput(event: Event): void {
    this.commit((event.target as HTMLInputElement).value);
  }

  protected clear(): void {
    if (this.value()) {
      this.commit('');
    }
  }

  private commit(text: string): void {
    this.value.set(text);
    this.onChange(text);
    this.searched.emit(text);
  }

  writeValue(value: unknown): void {
    this.value.set(typeof value === 'string' ? value : '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }
}
