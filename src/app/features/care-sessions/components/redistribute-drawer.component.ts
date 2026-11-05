import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, signal, untracked } from '@angular/core';
import { Database } from '@core/data';
import { formatPercent } from '@core/format';
import { canReceiveRedistribution } from '@core/rules';
import { FormFieldComponent, IconComponent, NxInputDirective, RadioGroupComponent, RadioOption } from '@shared/ui';
import { DrawerComponent, ToastService } from '@shared/ui/overlay';
import { valueOf } from '@shared/ui/util/form-events';
import { CareSessionsService, FieldError } from '../state/care-sessions.service';

/**
 * SCR-M05-07, Redistribuir (RN-EQP-05): transfere as sessões futuras e os cuidadores de um psicólogo para
 * outro com ocupação abaixo de 80%, com motivo. Quem faz é o responsável técnico ou a gestão, que veem só as
 * quantidades: nenhum cuidador aparece nesta tela. A transferência fica no log com o motivo.
 */
@Component({
  selector: 'app-redistribute-drawer',
  imports: [DrawerComponent, FormFieldComponent, IconComponent, NxInputDirective, RadioGroupComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-drawer [(open)]="open" heading="Redistribuir a agenda" [subtitle]="fromName()">
      <div class="stack stack--6" data-role="redistribute-form">
        <div class="card card--sunken card--pad" data-role="preview">
          <p class="t-strong">
            {{ preview().caregivers }} {{ preview().caregivers === 1 ? 'cuidador' : 'cuidadores' }} e
            {{ preview().sessions }} {{ preview().sessions === 1 ? 'sessão futura' : 'sessões futuras' }}
          </p>
          <p class="t-caption">
            As sessões levam a vaga junto. Se o novo psicólogo já tem compromisso no mesmo horário, a sessão fica
            onde está.
          </p>
        </div>
        <app-form-field label="Quem recebe os casos" group controlId="redistribute-target" [error]="err('target')" hint="Só recebe quem tem ocupação abaixo de 80% no último mês fechado.">
          @if (targets().length > 0) {
            <app-radio-group [options]="targets()" [value]="target()" (valueChange)="target.set($event)" />
          } @else {
            <p class="t-ui">Nenhum outro psicólogo com CRP ativo para receber os casos.</p>
          }
        </app-form-field>
        <app-form-field label="Motivo da transferência" controlId="redistribute-reason" [error]="err('reason')">
          <textarea appInput rows="3" [value]="reason()" (input)="reason.set(valueOf($event))" data-role="reason"></textarea>
        </app-form-field>
        @if (err('redistribute'); as msg) {
          <p class="field__error" role="alert">{{ msg }}</p>
        }
      </div>
      <ng-container drawerFooter>
        <button type="button" class="btn" (click)="open.set(false)">Voltar</button>
        <button type="button" class="btn btn--primary" (click)="submit()" data-role="redistribute-submit">
          <svg appIcon="users-round" size="sm"></svg>Transferir os casos
        </button>
      </ng-container>
    </app-drawer>
  `,
})
export class RedistributeDrawerComponent {
  private readonly svc = inject(CareSessionsService);
  private readonly db = inject(Database);
  private readonly toasts = inject(ToastService);

  readonly open = model(false);
  /** Psicólogo de quem os casos saem. */
  readonly fromId = input.required<string>();

  protected readonly valueOf = valueOf;
  protected readonly target = signal<string | null>(null);
  protected readonly reason = signal('');
  protected readonly errors = signal<FieldError[]>([]);

  protected readonly fromName = computed(() => this.db.psychologists.get(this.fromId())?.displayName ?? '');
  protected readonly preview = computed(() => this.svc.redistributionPreview(this.fromId()));
  protected readonly targets = computed<RadioOption<string>[]>(() =>
    this.svc
      .activePsychologists()
      .filter((p) => p.id !== this.fromId())
      .map((p) => {
        const lastClosed = this.svc.occupancyFor(p).months[1];
        const percent = lastClosed?.occupancyPercent ?? null;
        const can = canReceiveRedistribution(percent);
        return {
          value: p.id,
          label: p.displayName,
          disabled: !can,
          hint: percent === null ? 'Sem agenda no último mês fechado' : `${formatPercent(percent)} no último mês fechado${can ? '' : ', acima do limite de 80%'}`,
        };
      }),
  );

  constructor() {
    effect(() => {
      if (this.open()) {
        untracked(() => {
          this.target.set(null);
          this.reason.set('');
          this.errors.set([]);
        });
      }
    });
  }

  protected err(field: string): string | null {
    return this.errors().find((e) => e.field === field)?.message ?? null;
  }

  protected submit(): void {
    const result = this.svc.redistribute(this.fromId(), this.target() ?? '', this.reason());
    if (!result.ok) {
      this.errors.set(result.errors);
      return;
    }
    const { caregivers, sessionsMoved, sessionsKept } = result.value;
    this.open.set(false);
    this.toasts.success(
      `${caregivers} ${caregivers === 1 ? 'cuidador transferido' : 'cuidadores transferidos'} e ${sessionsMoved} ${sessionsMoved === 1 ? 'sessão' : 'sessões'} para ${this.db.psychologists.get(this.target() ?? '')?.displayName ?? 'o novo psicólogo'}.${sessionsKept > 0 ? ` ${sessionsKept} ficaram onde estavam, por causa de horário ocupado.` : ''}`,
    );
  }
}
