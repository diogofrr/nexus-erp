import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { uniqueId } from '../../../shared/ui/util/ids';

export interface CgChoice<T> {
  value: T;
  label: string;
  /** Apoio de uma linha, em linguagem simples. */
  hint?: string;
}

/**
 * Cartões de escolha (UX A.2.9): opção única em linhas grandes (56 a 72 px), a linha inteira é o alvo. O
 * selecionado ganha borda de 3 px e o `circle-dot` preenchido (não só cor). Nada vem marcado. Rádio nativo por
 * baixo: setas, foco e leitor de tela funcionam sozinhos.
 *
 * ```html
 * <app-cg-choice-group legend="Quem você cuida" [options]="options" [(value)]="who" />
 * ```
 */
@Component({
  selector: 'app-cg-choice-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset class="cg-choices">
      <legend class="cg-choices__legend">{{ legend() }}</legend>
      @for (option of options(); track option.label) {
        <label class="cg-choice" [class.is-selected]="value() === option.value">
          <input
            class="cg-choice__input"
            type="radio"
            [name]="name"
            [checked]="value() === option.value"
            (change)="value.set(option.value)"
          />
          <span class="cg-choice__mark" aria-hidden="true"></span>
          <span class="cg-choice__text">
            <span class="cg-choice__label">{{ option.label }}</span>
            @if (option.hint) {
              <span class="cg-choice__hint">{{ option.hint }}</span>
            }
          </span>
        </label>
      }
    </fieldset>
  `,
})
export class CgChoiceGroupComponent<T> {
  readonly legend = input.required<string>();
  readonly options = input.required<readonly CgChoice<T>[]>();
  readonly value = model<T | null>(null);

  protected readonly name = uniqueId('cg-choice');
}
