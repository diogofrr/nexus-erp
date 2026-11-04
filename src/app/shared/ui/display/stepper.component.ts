import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent } from './icon.component';

export interface StepItem {
  id: string;
  label: string;
}

/**
 * Indicador de etapas (PD-04). SÓ INDICATIVO, nunca clicável: voltar é pelo botão "Voltar". Máximo de 6
 * etapas. Abaixo de 768 px o desenho some e entra o texto "Etapa 2 de 5: Pessoa idosa" com a barra.
 *
 * ```html
 * <app-stepper label="Cadastro de cuidador" [steps]="steps" [current]="1" />
 * ```
 */
@Component({
  selector: 'app-stepper',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="stepper" [attr.aria-label]="label()">
      @for (step of steps(); track step.id; let i = $index) {
        <li class="stepper__item" [class.is-done]="i < current()" [attr.aria-current]="i === current() ? 'step' : null">
          <span class="stepper__dot">
            @if (i < current()) {
              <svg appIcon="check"></svg><span class="sr-only">Etapa concluída: </span>
            } @else {
              {{ i + 1 }}
            }
          </span>
          <span class="stepper__label">{{ step.label }}</span>
        </li>
      }
    </ol>
    <div class="step-counter">
      <span>Etapa <b>{{ current() + 1 }}</b> de {{ steps().length }}: {{ currentLabel() }}</span>
      <div
        class="progress"
        role="progressbar"
        aria-valuemin="1"
        [attr.aria-valuemax]="steps().length"
        [attr.aria-valuenow]="current() + 1"
        [attr.aria-label]="'Etapa ' + (current() + 1) + ' de ' + steps().length"
      >
        <span class="progress__bar" [style.--value]="percent() + '%'"></span>
      </div>
    </div>
  `,
})
export class StepperComponent {
  readonly steps = input.required<readonly StepItem[]>();
  /** Índice da etapa atual (começa em 0). */
  readonly current = input.required<number>();
  readonly label = input('Etapas');

  protected readonly currentLabel = computed(() => this.steps()[this.current()]?.label ?? '');
  protected readonly percent = computed(() => Math.round(((this.current() + 1) / Math.max(this.steps().length, 1)) * 100));
}
