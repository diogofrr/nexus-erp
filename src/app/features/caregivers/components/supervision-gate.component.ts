import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Database } from '@core/data';
import type { ID } from '@core/models';
import { EmptyStateComponent, RadioGroupComponent, RadioOption } from '@shared/ui';
import {
  SUPERVISION_OTHER,
  SUPERVISION_OTHER_MIN,
  SUPERVISION_REASONS,
  SupervisionService,
} from '../state/supervision.service';

/**
 * Portão de supervisão (PD-12, F16-A): no lugar do conteúdo de um caso que não é do responsável técnico.
 * Tom neutro, sem acusação. O motivo vale 30 minutos para este caso nesta sessão; cada abertura segue
 * gerando log. Texto livre só em "Outro", com no mínimo 10 caracteres.
 */
@Component({
  selector: 'app-supervision-gate',
  imports: [EmptyStateComponent, RadioGroupComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card card--pad stack stack--3" data-role="supervision-gate">
      <app-empty-state compact kind="forbidden" title="Conteúdo supervisionado" [text]="intro()" />
      <fieldset class="stack stack--3">
        <legend class="field__label">Motivo do acesso</legend>
        <app-radio-group [options]="options" [(value)]="choice" />
        @if (choice() === other) {
          <div class="field">
            <label class="field__label" [attr.for]="otherId">Descreva o motivo</label>
            <span class="field__hint">Use ao menos {{ min }} caracteres.</span>
            <textarea class="textarea" [id]="otherId" rows="2" [value]="otherText()" (input)="onOther($event)"></textarea>
          </div>
        }
        @if (error()) {
          <span class="field__error" role="alert"><span class="sr-only">Erro: </span>{{ error() }}</span>
        }
      </fieldset>
      <div><button type="button" class="btn btn--primary" (click)="open()">Ver conteúdo</button></div>
    </div>
  `,
})
export class SupervisionGateComponent {
  private readonly db = inject(Database);
  private readonly supervision = inject(SupervisionService);

  readonly caregiverId = input.required<ID>();
  /** O que será aberto, na frase "para ver {what}". */
  readonly what = input('o acompanhamento deste cuidador');

  protected readonly options: RadioOption[] = [...SUPERVISION_REASONS, SUPERVISION_OTHER].map((value) => ({ value, label: value }));
  protected readonly other = SUPERVISION_OTHER;
  protected readonly min = SUPERVISION_OTHER_MIN;
  protected readonly otherId = 'nx-supervision-other';
  protected readonly choice = signal<string | null>(null);
  protected readonly otherText = signal('');
  protected readonly error = signal<string | null>(null);

  protected readonly psychologist = computed(() => {
    const id = this.db.caregivers.get(this.caregiverId())?.assignedPsychologistId;
    return id ? this.db.psychologists.get(id)?.displayName : undefined;
  });
  protected readonly intro = computed(
    () =>
      `${this.psychologist() ? `Este caso é acompanhado por ${this.psychologist()}.` : 'Este caso ainda não tem psicólogo responsável.'} Seu acesso será registrado no log, com o motivo que você informar, para ver ${this.what()}.`,
  );

  protected onOther(event: Event): void {
    this.otherText.set((event.target as HTMLTextAreaElement).value);
  }

  protected open(): void {
    const choice = this.choice();
    if (!choice) {
      this.error.set('Escolha o motivo do acesso.');
      return;
    }
    try {
      this.supervision.grant(this.caregiverId(), choice, this.otherText());
      this.error.set(null);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Escolha o motivo do acesso.');
    }
  }
}
