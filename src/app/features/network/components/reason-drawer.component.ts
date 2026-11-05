import { ChangeDetectionStrategy, Component, effect, input, model, output, signal, untracked } from '@angular/core';
import { FormFieldComponent, NxInputDirective, RadioGroupComponent, RadioOption } from '@shared/ui';
import { DrawerComponent } from '@shared/ui/overlay';

export interface ReasonSubmit {
  choice: string | null;
  text: string;
}

/**
 * Gaveta curta de decisão: uma escolha opcional (opção única) e um texto (motivo, nota, e-mail). Serve a todas
 * as decisões da rede que pedem motivo (reprovar, suspender, recusar, cancelar, reinstalar, registrar
 * justificativa, conferir critério). A tela que a usa grava e fecha; se a regra recusar, passe a frase em
 * `error` e a gaveta continua aberta, com o texto preservado.
 */
@Component({
  selector: 'app-reason-drawer',
  imports: [DrawerComponent, FormFieldComponent, NxInputDirective, RadioGroupComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-drawer [(open)]="open" [heading]="heading()" [subtitle]="subtitle()">
      <form class="stack stack--3" novalidate [id]="formId" (submit)="submit($event)">
        @if (effect()) {
          <p class="t-ui" data-role="effect">{{ effect() }}</p>
        }
        @if (options()) {
          <app-form-field [label]="optionsLabel()" group [controlId]="formId + '-choice'" [error]="choiceError()">
            <app-radio-group [options]="options() ?? []" [value]="choice()" (valueChange)="choice.set($event)" />
          </app-form-field>
        }
        <app-form-field
          [label]="label()"
          [hint]="hint()"
          [optional]="!textRequired()"
          [controlId]="formId + '-text'"
          [error]="textError()"
        >
          <textarea
            appInput
            [rows]="rows()"
            [value]="text()"
            (input)="onText($event)"
          ></textarea>
        </app-form-field>
        @if (error()) {
          <p class="field__error" role="alert" data-role="server-error">{{ error() }}</p>
        }
      </form>
      <ng-container drawerFooter>
        <button type="button" class="btn" (click)="open.set(false)">Voltar</button>
        <button
          type="submit"
          class="btn"
          [class.btn--primary]="!danger()"
          [class.btn--danger]="danger()"
          [attr.form]="formId"
          data-role="confirm-reason"
        >
          {{ confirmLabel() }}
        </button>
      </ng-container>
    </app-drawer>
  `,
})
export class ReasonDrawerComponent {
  private static sequence = 0;

  readonly open = model(false);
  readonly heading = input.required<string>();
  readonly subtitle = input('');
  readonly label = input('Motivo');
  readonly hint = input('');
  readonly confirmLabel = input.required<string>();
  /** O que acontece ao confirmar, em uma frase com números e nomes reais. */
  readonly effect = input<string | null>(null);
  readonly textRequired = input(true);
  readonly minLength = input(1);
  readonly requiredMessage = input('Escreva o motivo.');
  readonly rows = input(4);
  readonly danger = input(false);
  /** Texto que já vem preenchido (por exemplo, o modelo do e-mail). */
  readonly initialText = input('');
  readonly options = input<readonly RadioOption<string>[] | null>(null);
  readonly optionsLabel = input('Escolha uma opção');
  readonly optionRequiredMessage = input('Escolha uma opção.');
  readonly initialChoice = input<string | null>(null);
  /** Frase de erro vinda da regra de negócio. */
  readonly error = input<string | null>(null);
  readonly submitted = output<ReasonSubmit>();

  protected readonly formId = `nx-reason-${++ReasonDrawerComponent.sequence}`;
  protected readonly text = signal('');
  protected readonly choice = signal<string | null>(null);
  private readonly tried = signal(false);

  constructor() {
    effect(() => {
      if (this.open()) {
        untracked(() => {
          this.text.set(this.initialText());
          this.choice.set(this.initialChoice());
          this.tried.set(false);
        });
      }
    });
  }

  protected textError(): string | null {
    if (!this.tried() || !this.textRequired()) {
      return null;
    }
    return this.text().trim().length < this.minLength() ? this.requiredMessage() : null;
  }

  protected choiceError(): string | null {
    return this.tried() && this.options() && !this.choice() ? this.optionRequiredMessage() : null;
  }

  protected onText(event: Event): void {
    this.text.set((event.target as HTMLTextAreaElement).value);
  }

  protected submit(event: Event): void {
    event.preventDefault();
    this.tried.set(true);
    if (this.textError() || this.choiceError()) {
      return;
    }
    this.submitted.emit({ choice: this.choice(), text: this.text().trim() });
  }
}
