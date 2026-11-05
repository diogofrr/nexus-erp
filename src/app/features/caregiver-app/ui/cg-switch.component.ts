import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { IconComponent } from '../../../shared/ui/display/icon.component';

/**
 * Chave de liga e desliga grande (UX A.2.10): efeito imediato (lembrete de compromisso, "este remédio está em
 * uso", compartilhar um item). Linha de 64 px, a linha inteira é o alvo, e o ESTADO fica escrito ("Ligado" e
 * "Desligado", ou o efeito: `onText="Você autorizou"`). `role="switch"` com `aria-checked`; o texto de estado
 * faz parte do nome e é anunciado em `aria-live="polite"`.
 *
 * Consentimento NÃO usa a chave sozinha: retirar um consentimento abre a folha de efeito (tela Privacidade).
 *
 * ```html
 * <app-cg-switch label="Lembrar deste compromisso" hint="Aviso um dia antes." [(checked)]="remind" />
 * ```
 */
@Component({
  selector: 'app-cg-switch',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="cg-switch"
      role="switch"
      [attr.aria-checked]="checked()"
      [disabled]="disabled()"
      (click)="toggle()"
    >
      <span class="cg-switch__text">
        <span class="cg-switch__label">{{ label() }}</span>
        @if (hint(); as text) {
          <span class="cg-switch__hint">{{ text }}</span>
        }
        <span class="cg-switch__state" aria-live="polite">{{ checked() ? onText() : offText() }}</span>
      </span>
      <span class="cg-switch__track" aria-hidden="true">
        <span class="cg-switch__thumb">
          @if (checked()) {
            <svg appIcon="check" size="sm"></svg>
          }
        </span>
      </span>
    </button>
  `,
})
export class CgSwitchComponent {
  readonly label = input.required<string>();
  readonly hint = input<string>();
  readonly onText = input('Ligado');
  readonly offText = input('Desligado');
  readonly disabled = input(false);
  readonly checked = model(false);

  protected toggle(): void {
    this.checked.update((on) => !on);
  }
}
