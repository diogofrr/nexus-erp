import { Directive, ElementRef, forwardRef, inject, input, numberAttribute } from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
} from '@angular/forms';
import { formatDate, formatMoney } from '@core/format';
import {
  digitsOf,
  maskCpfText,
  maskDateText,
  maskPhoneText,
  numberToText,
  parseCurrencyCents,
  parseDateText,
  parseNumberText,
  sanitizeNumberText,
} from './mask-utils';

export type NxMaskKind = 'cpf' | 'phone' | 'currency' | 'number' | 'date';

interface MaskState {
  text: string;
  value: string | number | null;
}

const DEFAULTS: Record<NxMaskKind, { placeholder: string; inputMode: string; maxLength: number | null; autocomplete: string }> = {
  cpf: { placeholder: '000.000.000-00', inputMode: 'numeric', maxLength: 14, autocomplete: 'off' },
  phone: { placeholder: '(34) 90000-0000', inputMode: 'tel', maxLength: 15, autocomplete: 'tel-national' },
  currency: { placeholder: 'R$ 0,00', inputMode: 'numeric', maxLength: 20, autocomplete: 'off' },
  number: { placeholder: '', inputMode: 'numeric', maxLength: null, autocomplete: 'off' },
  date: { placeholder: 'dd/mm/aaaa', inputMode: 'numeric', maxLength: 10, autocomplete: 'off' },
};

/**
 * Máscara de entrada com integração aos formulários reativos. Valor no modelo, por tipo:
 *
 * | `appMask`   | valor no controle                 | exemplo de texto  |
 * |------------|-----------------------------------|-------------------|
 * | `cpf`      | `string` já formatado             | `000.123.456-00`  |
 * | `phone`    | `string` já formatado             | `(34) 90000-0123` |
 * | `currency` | `number` em **centavos** ou `null`| `R$ 1.234,56`     |
 * | `number`   | `number` ou `null`                | `8,5`             |
 * | `date`     | `ISODate` (`2026-11-04`) ou `null`| `04/11/2026`      |
 *
 * Aceita colar (com ou sem pontuação). Também é validador: texto incompleto vira erro com a mensagem do
 * catálogo. Use junto de `appInput`.
 */
@Directive({
  selector: 'input[appMask]',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => NxMaskDirective), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => NxMaskDirective), multi: true },
  ],
  host: {
    '[attr.inputmode]': 'inputMode()',
    '[attr.autocomplete]': 'autocompleteValue()',
    '[attr.maxlength]': 'maxLength()',
    '[attr.placeholder]': 'placeholderText()',
    '(input)': 'handleInput()',
    '(blur)': 'handleBlur()',
  },
})
export class NxMaskDirective implements ControlValueAccessor, Validator {
  readonly kind = input.required<NxMaskKind>({ alias: 'appMask' });
  /** Casas decimais do tipo `number` (0 = inteiro). */
  readonly decimals = input(0, { transform: numberAttribute });
  /** Limites do tipo `number` e `currency` (centavos). Fora deles o controle fica com o erro `range`. */
  readonly min = input<number | undefined, unknown>(undefined, { transform: optionalNumber });
  readonly max = input<number | undefined, unknown>(undefined, { transform: optionalNumber });
  /** Frase do erro de intervalo ("As horas por dia devem ser de 0 a 24."). */
  readonly rangeMessage = input<string>();
  readonly placeholder = input<string>();

  private readonly el = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  private state: MaskState = { text: '', value: null };
  private onChange: (value: unknown) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  protected inputMode(): string {
    const kind = this.kind();
    return kind === 'number' && this.decimals() > 0 ? 'decimal' : DEFAULTS[kind].inputMode;
  }

  protected autocompleteValue(): string {
    return DEFAULTS[this.kind()].autocomplete;
  }

  protected maxLength(): number | null {
    return DEFAULTS[this.kind()].maxLength;
  }

  protected placeholderText(): string | null {
    return this.placeholder() ?? (DEFAULTS[this.kind()].placeholder || null);
  }

  // ===== ControlValueAccessor =====

  writeValue(value: unknown): void {
    this.state = this.fromModel(value);
    this.el.value = this.state.text;
  }

  registerOnChange(fn: (value: unknown) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.el.disabled = isDisabled;
  }

  // ===== Validator =====

  validate(_control: AbstractControl): ValidationErrors | null {
    const { text, value } = this.state;
    if (text === '') {
      return null;
    }
    switch (this.kind()) {
      case 'cpf':
        return text.length === 14
          ? null
          : { format: { message: 'O CPF deve estar no formato 000.000.000-00.' } };
      case 'phone': {
        const digits = digitsOf(text);
        // celular: 11 dígitos (o número começa em 9); fixo: 10
        return digits.length === 11 || (digits.length === 10 && digits.charAt(2) !== '9')
          ? null
          : { format: { message: 'O telefone deve estar no formato (34) 90000-0000.' } };
      }
      case 'date':
        return value === null
          ? { date: { message: 'A data deve estar no formato dd/mm/aaaa, por exemplo 04/11/2026.' } }
          : null;
      case 'number':
        if (value === null) {
          return { format: { message: 'Informe um número.' } };
        }
        return this.negativeError(Number(value), 'Use um número a partir de 0, sem o sinal de menos.') ?? this.rangeError(Number(value));
      case 'currency':
        if (text === '-') {
          return { format: { message: 'Informe um valor em reais.' } };
        }
        return value === null
          ? null
          : (this.negativeError(Number(value), 'O valor não pode ser negativo.') ?? this.rangeError(Number(value)));
    }
  }

  /**
   * QA-016: o sinal de menos não some em silêncio ("-1" virar 1, "-10" virar R$ 0,10). Ele fica no campo e,
   * quando o campo não aceita negativo (sem `min` abaixo de zero), o validador recusa com uma frase.
   */
  private negativeError(value: number, fallback: string): ValidationErrors | null {
    const min = this.min() ?? 0;
    if (value >= 0 || min < 0) {
      return null;
    }
    return { range: { min, max: this.max(), message: this.rangeMessage() ?? fallback } };
  }

  // ===== Eventos =====

  protected handleInput(): void {
    const raw = this.el.value;
    const digitsBeforeCaret = digitsOf(raw.slice(0, this.el.selectionStart ?? raw.length)).length;
    this.state = this.fromText(raw);
    if (this.state.text !== raw) {
      this.el.value = this.state.text;
      this.restoreCaret(digitsBeforeCaret);
    }
    this.onChange(this.state.value);
  }

  protected handleBlur(): void {
    // O tipo `number` guarda o que a pessoa digitou até sair do campo; ao sair, normaliza (`8,` vira `8`).
    if (this.kind() === 'number' && this.state.value !== null) {
      this.state = { text: numberToText(Number(this.state.value)), value: this.state.value };
      this.el.value = this.state.text;
    }
    this.onTouched();
  }

  // ===== Conversões =====

  private fromText(raw: string): MaskState {
    switch (this.kind()) {
      case 'cpf': {
        const text = maskCpfText(raw);
        return { text, value: text };
      }
      case 'phone': {
        const text = maskPhoneText(raw);
        return { text, value: text };
      }
      case 'date': {
        const text = maskDateText(raw);
        return { text, value: parseDateText(text) };
      }
      case 'currency': {
        const negative = /[-\u2212\u2013]/.test(raw);
        const cents = parseCurrencyCents(raw);
        if (cents === null) {
          return { text: negative ? '-' : '', value: null };
        }
        const signed = negative ? -cents : cents;
        return { text: formatMoney(signed), value: signed };
      }
      case 'number': {
        // O sinal de menos é mantido (QA-016); quem não aceita negativo recusa na validação.
        const text = sanitizeNumberText(raw.replace(/[\u2212\u2013]/g, '-'), this.decimals(), true);
        return { text, value: parseNumberText(text) };
      }
    }
  }

  private fromModel(model: unknown): MaskState {
    switch (this.kind()) {
      case 'cpf':
      case 'phone': {
        const text = typeof model === 'string' ? (this.kind() === 'cpf' ? maskCpfText(model) : maskPhoneText(model)) : '';
        return { text, value: text };
      }
      case 'date': {
        const iso = typeof model === 'string' && parseDateText(formatDate(model)) === model ? model : null;
        return { text: iso ? formatDate(iso) : '', value: iso };
      }
      case 'currency': {
        const cents = typeof model === 'number' && Number.isFinite(model) ? Math.round(model) : null;
        return { text: cents === null ? '' : formatMoney(cents), value: cents };
      }
      case 'number': {
        const n = typeof model === 'number' && Number.isFinite(model) ? model : null;
        return { text: n === null ? '' : numberToText(n), value: n };
      }
    }
  }

  private rangeError(value: number): ValidationErrors | null {
    const min = this.min();
    const max = this.max();
    const tooLow = min !== undefined && value < min;
    const tooHigh = max !== undefined && value > max;
    if (!tooLow && !tooHigh) {
      return null;
    }
    const isMoney = this.kind() === 'currency';
    const show = (n: number): string => (isMoney ? formatMoney(n) : String(n));
    const fallback =
      min !== undefined && max !== undefined
        ? `O valor deve ficar entre ${show(min)} e ${show(max)}.`
        : min !== undefined
          ? `O valor deve ser de pelo menos ${show(min)}.`
          : `O valor deve ser de no máximo ${show(max ?? 0)}.`;
    return { range: { min, max, message: this.rangeMessage() ?? fallback } };
  }

  private restoreCaret(digitsBefore: number): void {
    if (typeof document === 'undefined' || document.activeElement !== this.el) {
      return;
    }
    const text = this.el.value;
    if (this.kind() === 'currency' || this.kind() === 'number') {
      this.el.setSelectionRange(text.length, text.length);
      return;
    }
    let seen = 0;
    let position = text.length;
    if (digitsBefore === 0) {
      position = 0;
    } else {
      for (let i = 0; i < text.length; i += 1) {
        if (/\d/.test(text.charAt(i))) {
          seen += 1;
          if (seen === digitsBefore) {
            position = i + 1;
            break;
          }
        }
      }
    }
    this.el.setSelectionRange(position, position);
  }
}

function optionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}
