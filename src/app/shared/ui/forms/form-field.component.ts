import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  contentChild,
  effect,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { NgControl } from '@angular/forms';
import { IconComponent } from '../display/icon.component';
import { uniqueId } from '../util/ids';
import { FieldContext, NX_FIELD } from './field-context';
import { fieldErrorMessage } from './form-errors';

/**
 * Campo de formulário: rótulo sempre visível, dica ACIMA do controle e erro ABAIXO (design system 4.5).
 * Liga rótulo, dica e erro ao controle por `for`, `aria-describedby` e `aria-invalid`. O erro aparece quando o
 * controle é inválido E já foi tocado (saiu do campo); depois disso, a cada tecla. Nunca limpa o que foi digitado.
 *
 * ```html
 * <app-form-field label="CPF fictício" hint="Use um CPF fictício.">
 *   <input appInput appMask="cpf" formControlName="cpf" />
 * </app-form-field>
 * ```
 *
 * O próprio host é o `.field` do design system, então `.form-grid > app-form-field` alinha rótulo, dica e erro.
 * Para grupos (radio, caixas) use `group`: o rótulo vira `<span>` e o grupo se liga por `aria-labelledby`.
 */
@Component({
  selector: 'app-form-field',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NX_FIELD, useExisting: forwardRef(() => FormFieldComponent) }],
  host: {
    class: 'field',
    '[class.field--error]': 'showError()',
    // Em grupo o id fica no próprio campo, para o resumo de erros apontar (o foco vai ao 1º controle).
    '[attr.id]': 'group() ? controlId() : null',
  },
  template: `
    @if (label()) {
      @if (group()) {
        <span class="field__label" [id]="labelId">
          {{ label() }}@if (optional()) {<span class="field__opt"> (opcional)</span>}
        </span>
      } @else {
        <label class="field__label" [id]="labelId" [attr.for]="controlId()">
          {{ label() }}@if (optional()) {<span class="field__opt"> (opcional)</span>}
        </label>
      }
    }
    @if (hint()) {
      <span class="field__hint" [id]="hintId">{{ hint() }}</span>
    }
    <ng-content />
    @if (showError()) {
      <span class="field__error" [id]="errorId">
        <svg appIcon="circle-alert" size="sm"></svg>
        <span><span class="sr-only">Erro: </span>{{ errorText() }}</span>
      </span>
    }
  `,
})
export class FormFieldComponent implements FieldContext {
  /** Rótulo visível (obrigatório por acessibilidade). */
  readonly label = input.required<string>();
  /** Dica curta, mostrada acima do controle. */
  readonly hint = input<string>();
  /** Erro explícito (por exemplo, vindo do servidor). Tem prioridade sobre o erro do controle. */
  readonly error = input<string | null>(null);
  /** Marca "(opcional)" no rótulo. Obrigatórios não levam asterisco. */
  readonly optional = input(false, { transform: booleanAttribute });
  /** Rótulo de grupo (radio, caixas): não aponta `for` para um controle só. */
  readonly group = input(false, { transform: booleanAttribute });
  /** Mostra o erro mesmo sem o campo ter sido tocado (use depois de tentar enviar). */
  readonly forceErrors = input(false, { transform: booleanAttribute });
  /** Id do controle, para o resumo de erros apontar. Sem ele, o campo gera um. */
  readonly id = input<string | undefined>(undefined, { alias: 'controlId' });

  private readonly ownId = uniqueId('app-field');
  readonly labelId = `${this.ownId}-label`;
  protected readonly hintId = `${this.ownId}-hint`;
  protected readonly errorId = `${this.ownId}-error`;

  private readonly ngControl = contentChild(NgControl);
  /** Sobe a cada evento do controle (valor, estado, tocado) para os `computed` reavaliarem. */
  private readonly tick = signal(0);

  readonly controlId = computed(() => this.id() ?? `${this.ownId}-control`);

  readonly showError = computed(() => {
    this.tick();
    if (this.error()) {
      return true;
    }
    const control = this.ngControl()?.control;
    return !!control && control.invalid && (control.touched || this.forceErrors());
  });

  readonly errorText = computed(() => {
    this.tick();
    const explicit = this.error();
    if (explicit) {
      return explicit;
    }
    return fieldErrorMessage(this.ngControl()?.control?.errors ?? null, this.label());
  });

  readonly invalid = computed(() => this.showError());
  readonly required = computed(() => !this.optional());

  readonly describedBy = computed(() => {
    const ids = [this.hint() ? this.hintId : null, this.showError() ? this.errorId : null].filter(
      (id): id is string => id !== null,
    );
    return ids.length > 0 ? ids.join(' ') : null;
  });

  constructor() {
    effect((onCleanup) => {
      const control = this.ngControl()?.control;
      if (!control) {
        return;
      }
      const sub = control.events.subscribe(() => this.tick.update((n) => n + 1));
      this.tick.update((n) => n + 1);
      onCleanup(() => sub.unsubscribe());
    });
  }
}
