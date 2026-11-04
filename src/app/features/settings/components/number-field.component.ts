import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  effect,
  inject,
  input,
} from '@angular/core';
import {
  AbstractControl,
  FormControl,
  ReactiveFormsModule,
  ValidationErrors,
} from '@angular/forms';
import { GlyphComponent } from '../../../shared/ui/overlay/glyph.component';

/** Valida número inteiro (os parâmetros do protótipo são todos inteiros). */
export function integerValidator(control: AbstractControl): ValidationErrors | null {
  const value: unknown = control.value;
  return typeof value === 'number' && !Number.isInteger(value) ? { integer: true } : null;
}

let sequence = 0;

/**
 * Campo numérico dos formulários de Configurações: rótulo sempre visível, dica acima, unidade ao lado e erro
 * abaixo, com ícone e o prefixo oculto "Erro:" (design system 4.5). A mesma frase serve ao resumo de erros.
 * Mensagens do catálogo (7.4): vazio ("Informe o limite de horas.") e fora do intervalo ("O limite de horas
 * deve ser de 1 a 24.").
 */
@Component({
  selector: 'app-number-field',
  imports: [ReactiveFormsModule, GlyphComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="field" [class.field--error]="showError()">
      <label class="field__label" [for]="id">{{ label() }}</label>
      @if (hint()) {
        <span class="field__hint" [id]="id + '-hint'">{{ hint() }}</span>
      }
      <div class="cluster cluster--nowrap">
        <input
          class="input input--num"
          type="number"
          inputmode="numeric"
          [id]="id"
          [formControl]="control()"
          [attr.min]="min()"
          [attr.max]="max()"
          [attr.readonly]="readonly() ? '' : null"
          [attr.aria-invalid]="showError() ? 'true' : null"
          [attr.aria-describedby]="describedBy()"
        />
        @if (unit()) {
          <span class="t-muted t-ui">{{ unit() }}</span>
        }
      </div>
      @if (showError()) {
        <span class="field__error" [id]="id + '-error'">
          <svg appGlyph="circle-alert"></svg>
          <span><span class="sr-only">Erro: </span>{{ message() }}</span>
        </span>
      }
    </div>
  `,
})
export class NumberFieldComponent {
  private readonly cdr = inject(ChangeDetectorRef);

  readonly control = input.required<FormControl<number>>();
  readonly label = input.required<string>();
  /** Nome do que se informa, em minúsculas, para as mensagens ("o limite de horas"). */
  readonly noun = input('o valor');
  readonly hint = input('');
  readonly unit = input('');
  readonly min = input(0);
  readonly max = input(100);
  readonly readonly = input(false);
  /** Frase própria para um erro de validação específico (por exemplo, uma regra entre dois campos). */
  readonly errorTexts = input<Record<string, string>>({});

  protected readonly id = `nx-num-${++sequence}`;

  constructor() {
    // Os estados do controle (tocado, inválido) não são signals: pede nova verificação a cada evento deles.
    effect((onCleanup) => {
      const sub = this.control().events.subscribe(() => this.cdr.markForCheck());
      onCleanup(() => sub.unsubscribe());
    });
  }

  protected showError(): boolean {
    const c = this.control();
    return c.invalid && (c.touched || c.dirty);
  }

  protected describedBy(): string | null {
    const ids = [
      this.hint() ? `${this.id}-hint` : '',
      this.showError() ? `${this.id}-error` : '',
    ].filter((v) => v.length > 0);
    return ids.length > 0 ? ids.join(' ') : null;
  }

  /** A frase do erro (a mesma do resumo de erros). */
  protected message(): string {
    const errors = this.control().errors;
    if (!errors) {
      return '';
    }
    const custom = Object.keys(errors).find((key) => this.errorTexts()[key] !== undefined);
    if (custom) {
      return this.errorTexts()[custom] as string;
    }
    return errors['required']
      ? `Informe ${this.noun()}.`
      : `${this.capitalized()} deve ser um número inteiro de ${this.min()} a ${this.max()}.`;
  }

  private capitalized(): string {
    const text = this.noun();
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
}

/** Frase de erro de um controle numérico, para o resumo de erros do topo. */
export function numberErrorText(
  control: AbstractControl,
  noun: string,
  min: number,
  max: number,
): string | null {
  const errors = control.errors;
  if (!errors) {
    return null;
  }
  if (errors['required']) {
    return `Informe ${noun}.`;
  }
  return `${noun.charAt(0).toUpperCase()}${noun.slice(1)} deve ser um número inteiro de ${min} a ${max}.`;
}
