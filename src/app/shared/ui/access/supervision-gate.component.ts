import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Database } from '@core/data';
import {
  SUPERVISION_OTHER,
  SUPERVISION_OTHER_MIN_CHARS,
  SUPERVISION_REASONS,
  SupervisionWindowService,
} from '@core/audit/supervision-window.service';
import { FormFieldComponent } from '../forms/form-field.component';
import { NxInputDirective } from '../forms/input.directive';
import { RadioGroupComponent, RadioOption } from '../forms/radio-group.component';
import { IconComponent } from '../display/icon.component';

/**
 * Portão de supervisão (PD-12, F16-A): no lugar do conteúdo de um caso que não é do usuário, pede o motivo,
 * grava `supervise` no log e libera por 30 minutos para aquele caso. Tom neutro, sem acusação. O motivo
 * "Outro" exige ao menos 10 caracteres. O conteúdo NÃO é montado antes da liberação: quem usa o portão faz
 * `@if (liberado) { conteúdo } @else { <app-supervision-gate ... /> }`. É o único portão de supervisão do
 * ERP (cadastro de cuidadores, Zarit e sessões usam este mesmo).
 *
 * ```html
 * <app-supervision-gate entity="zarit_alert" [entityId]="alert.id" [caregiverId]="alert.caregiverId"
 *   what="o acompanhamento deste cuidador" (granted)="open.set(true)" />
 * ```
 *
 * Quem acompanha o caso vem do cadastro do cuidador (`ownerName` só é preciso quando é outra pessoa, como o
 * autor de uma anotação).
 */
@Component({
  selector: 'app-supervision-gate',
  imports: [FormFieldComponent, NxInputDirective, RadioGroupComponent, ReactiveFormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card card--pad stack stack--3" aria-labelledby="gate-title" data-role="supervision-gate">
      <h2 id="gate-title" class="card__title"><svg appIcon="lock" size="sm"></svg> Acesso com registro</h2>
      <p data-role="gate-intro">{{ intro() }}</p>
      <app-form-field label="Motivo do acesso" group [forceErrors]="tried()">
        <app-radio-group [options]="reasons" [formControl]="reason" />
      </app-form-field>
      @if (reason.value === other) {
        <app-form-field
          label="Descreva o motivo"
          [hint]="'Use ao menos ' + minChars + ' caracteres.'"
          [forceErrors]="tried()"
        >
          <textarea appInput rows="2" [formControl]="otherText"></textarea>
        </app-form-field>
      }
      @if (tried() && !valid()) {
        <p class="field__error" role="alert" data-role="gate-error">
          {{ reason.value === other ? 'Descreva o motivo com ao menos ' + minChars + ' caracteres.' : 'Escolha o motivo do acesso.' }}
        </p>
      }
      <div class="cluster">
        <button type="button" class="btn btn--primary" data-role="gate-open" (click)="open()">
          <svg appIcon="eye" size="sm"></svg>Ver conteúdo
        </button>
      </div>
    </section>
  `,
})
export class SupervisionGateComponent {
  private readonly supervision = inject(SupervisionWindowService);
  private readonly db = inject(Database);

  /** Entidade registrada no log (`zarit_alert`, `session_note`). */
  readonly entity = input.required<string>();
  readonly entityId = input.required<string>();
  /** O titular do caso (id do cuidador). */
  readonly caregiverId = input.required<string>();
  /** Nome de quem acompanha o caso ("Dra. Beatriz Nogueira"). Sem ele, vem do psicólogo do cuidador. */
  readonly ownerName = input<string | null>(null);
  /** O que será aberto, na frase "para ver {what}". */
  readonly what = input('');
  readonly granted = output<void>();

  protected readonly other = SUPERVISION_OTHER;
  protected readonly minChars = SUPERVISION_OTHER_MIN_CHARS;
  protected readonly reasons: RadioOption<string>[] = [...SUPERVISION_REASONS, SUPERVISION_OTHER].map(
    (label) => ({ value: label, label }),
  );
  protected readonly reason = new FormControl<string | null>(null);
  protected readonly otherText = new FormControl('', { nonNullable: true });
  protected readonly tried = signal(false);

  protected readonly owner = computed(() => {
    const given = this.ownerName();
    if (given) {
      return given;
    }
    const psychologistId = this.db.caregivers.get(this.caregiverId())?.assignedPsychologistId;
    return psychologistId ? (this.db.psychologists.get(psychologistId)?.displayName ?? null) : null;
  });
  protected readonly intro = computed(() => {
    const owner = this.owner();
    const who = owner
      ? `Este caso é acompanhado ${owner.startsWith('Dra.') ? 'pela' : 'pelo'} ${owner}.`
      : 'Este caso ainda não tem psicólogo responsável.';
    const what = this.what();
    return `${who} Seu acesso será registrado no log, com o motivo que você informar${what ? `, para ver ${what}` : ''}.`;
  });

  protected valid(): boolean {
    return SupervisionWindowService.isValidReason(this.reason.value, this.otherText.value);
  }

  protected open(): void {
    this.tried.set(true);
    this.reason.markAsTouched();
    if (!this.valid()) {
      return;
    }
    const choice = this.reason.value as string;
    const text = choice === SUPERVISION_OTHER ? this.otherText.value.trim() : choice;
    this.supervision.grant(this.entity(), this.entityId(), this.caregiverId(), text);
    this.granted.emit();
  }
}
