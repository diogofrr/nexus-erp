import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Database } from '@core/data';
import { formatDate } from '@core/format';
import { ProviderCategory, ServiceRequest } from '@core/models';
import { isSearchable } from '@core/rules';
import {
  ErrorSummaryComponent,
  ErrorSummaryItem,
  FormFieldComponent,
  NxInputDirective,
  NxValidators,
  RadioGroupComponent,
  RadioOption,
  RatingComponent,
  fieldErrorMessage,
} from '@shared/ui';
import { DrawerComponent, ToastService, UiPrefsService } from '@shared/ui/overlay';
import { NetworkAdminService } from '../state/network-admin.service';
import { categoryLabel } from '../state/network-labels';
import { CaregiverPickerComponent } from './caregiver-picker.component';

const MODALITIES: readonly RadioOption<ServiceRequest['modality']>[] = [
  { value: 'at_provider', label: 'No local do prestador' },
  { value: 'home', label: 'Em domicílio' },
];

/**
 * Registrar solicitação (RN-CAN-05): o atendimento ou a gestão anota o pedido que o usuário fez por telefone ou
 * WhatsApp. Só prestadores na busca (ativos e em monitoramento) podem receber o pedido, e o atendimento em
 * domicílio só vale para quem atende em domicílio.
 */
@Component({
  selector: 'app-request-create-drawer',
  imports: [
    ReactiveFormsModule,
    CaregiverPickerComponent,
    DrawerComponent,
    ErrorSummaryComponent,
    FormFieldComponent,
    NxInputDirective,
    RadioGroupComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-drawer [(open)]="open" heading="Registrar solicitação" subtitle="Pedido feito pelo usuário, registrado em nome dele">
      <form id="nx-request-form" class="stack stack--3" novalidate [formGroup]="form" (ngSubmit)="submit()">
        <app-error-summary [items]="errors()" />
        <app-caregiver-picker
          label="Cuidador"
          hint="Quem fez o pedido."
          controlId="rq-caregiver"
          [value]="form.controls.caregiverId.value"
          [error]="submitted() && !form.controls.caregiverId.value ? 'Escolha o cuidador que fez o pedido.' : null"
          (valueChange)="setCaregiver($event)"
        />
        <app-form-field label="Prestador" controlId="rq-provider" [forceErrors]="submitted()">
          <select appInput formControlName="providerId">
            <option value="">Escolha o prestador</option>
            @for (group of providerGroups(); track group.label) {
              <optgroup [label]="group.label">
                @for (provider of group.items; track provider.id) {
                  <option [value]="provider.id">{{ provider.name }}</option>
                }
              </optgroup>
            }
          </select>
        </app-form-field>
        <app-form-field label="Necessidade" controlId="rq-need" [forceErrors]="submitted()">
          <textarea appInput rows="3" formControlName="need" placeholder="Descreva o serviço que o usuário procura"></textarea>
        </app-form-field>
        <app-form-field label="Onde será o atendimento" group controlId="rq-modality">
          <app-radio-group [options]="modalityOptions()" formControlName="modality" />
        </app-form-field>
        @if (serverError()) {
          <p class="field__error" role="alert" data-role="server-error">{{ serverError() }}</p>
        }
        @if (prefs.fillWithExample()) {
          <div>
            <button type="button" class="btn btn--ghost btn--sm" data-role="fill-example" (click)="fillExample()">
              Preencher com exemplo
            </button>
          </div>
        }
      </form>
      <ng-container drawerFooter>
        <button type="button" class="btn" (click)="open.set(false)">Voltar</button>
        <button type="submit" form="nx-request-form" class="btn btn--primary" data-role="submit-request">
          Registrar solicitação
        </button>
      </ng-container>
    </app-drawer>
  `,
})
export class RequestCreateDrawerComponent {
  private readonly db = inject(Database);
  private readonly admin = inject(NetworkAdminService);
  private readonly toasts = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly prefs = inject(UiPrefsService);

  readonly open = model(false);
  readonly created = output<string>();

  protected readonly submitted = signal(false);
  protected readonly errors = signal<ErrorSummaryItem[]>([]);
  protected readonly serverError = signal<string | null>(null);
  private readonly providerId = signal('');

  protected readonly form = this.fb.group({
    caregiverId: new FormControl<string | null>(null),
    providerId: this.fb.control('', NxValidators.required('o prestador')),
    need: this.fb.control('', NxValidators.required('a necessidade do serviço')),
    modality: this.fb.control<ServiceRequest['modality']>('at_provider'),
  });

  protected readonly providerGroups = computed(() => {
    const groups = new Map<ProviderCategory, { id: string; name: string }[]>();
    this.db.providers
      .all()
      .filter((p) => isSearchable(p.status))
      .forEach((p) => groups.set(p.category, [...(groups.get(p.category) ?? []), { id: p.id, name: p.name }]));
    return [...groups.entries()]
      .map(([category, items]) => ({ label: categoryLabel(category), items }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  });

  protected readonly modalityOptions = computed<RadioOption<ServiceRequest['modality']>[]>(() => {
    const provider = this.db.providers.get(this.providerId());
    return MODALITIES.map((o) =>
      o.value === 'home' && provider && !provider.homeCare
        ? { ...o, disabled: true, hint: 'Este prestador não atende em domicílio.' }
        : o,
    );
  });

  constructor() {
    this.form.controls.providerId.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      this.providerId.set(id);
      const provider = this.db.providers.get(id);
      if (provider && !provider.homeCare && this.form.controls.modality.value === 'home') {
        this.form.controls.modality.setValue('at_provider');
      }
    });
    effect(() => {
      if (this.open()) {
        untracked(() => {
          this.form.reset({ caregiverId: null, providerId: '', need: '', modality: 'at_provider' });
          this.submitted.set(false);
          this.errors.set([]);
          this.serverError.set(null);
        });
      }
    });
  }

  protected setCaregiver(id: string | null): void {
    this.form.controls.caregiverId.setValue(id);
  }

  protected fillExample(): void {
    const provider = this.db.providers.all().find((p) => p.status === 'active' && p.category === 'physiotherapy') ?? this.db.providers.all().find((p) => isSearchable(p.status));
    this.form.patchValue({
      caregiverId: this.db.caregivers.get('cg_0003')?.id ?? this.db.caregivers.all()[0]?.id ?? null,
      providerId: provider?.id ?? '',
      need: 'Sessões de fisioterapia para a pessoa idosa, duas vezes por semana',
      modality: provider?.homeCare ? 'home' : 'at_provider',
    });
  }

  protected submit(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    const f = this.form.controls;
    const list: ErrorSummaryItem[] = [];
    if (!f.caregiverId.value) {
      list.push({ controlId: 'rq-caregiver', message: 'Escolha o cuidador que fez o pedido.' });
    }
    (
      [
        ['rq-provider', f.providerId, 'o prestador'],
        ['rq-need', f.need, 'a necessidade do serviço'],
      ] as const
    ).forEach(([id, control, label]) => {
      const message = fieldErrorMessage(control.errors, label);
      if (message) {
        list.push({ controlId: id, message });
      }
    });
    this.errors.set(list);
    if (list.length > 0) {
      return;
    }
    const value = this.form.getRawValue();
    const result = this.admin.createRequest({
      caregiverId: value.caregiverId as string,
      providerId: value.providerId,
      need: value.need,
      modality: value.modality,
    });
    if (!result.ok) {
      this.serverError.set(result.error);
      return;
    }
    this.open.set(false);
    this.toasts.success('Solicitação registrada. Ela aguarda a resposta do prestador.');
    this.created.emit(result.value.id);
  }
}

/**
 * Registrar avaliação em nome do usuário (F08, RN-ARP-02): duas notas inteiras de 1 a 5, obrigatórias, mais
 * um comentário opcional. A nota da avaliação é a média das duas. Só serviço concluído e uma avaliação por serviço.
 */
@Component({
  selector: 'app-evaluation-drawer',
  imports: [ReactiveFormsModule, DrawerComponent, ErrorSummaryComponent, FormFieldComponent, NxInputDirective, RatingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-drawer [(open)]="open" heading="Registrar avaliação" [subtitle]="subtitle()">
      <form id="nx-evaluation-form" class="stack stack--3" novalidate [formGroup]="form" (ngSubmit)="submit()">
        <app-error-summary [items]="errors()" />
        <p class="t-ui">A nota da avaliação é a média das duas.</p>
        <app-form-field label="Qualidade técnica" group controlId="ev-technical" [forceErrors]="submitted()" [error]="technicalError()">
          <app-rating label="Qualidade técnica" [ends]="['Muito abaixo', 'Excelente']" formControlName="technical" />
        </app-form-field>
        <app-form-field label="Pontualidade e cordialidade" group controlId="ev-punctuality" [forceErrors]="submitted()" [error]="punctualityError()">
          <app-rating label="Pontualidade e cordialidade" [ends]="['Muito abaixo', 'Excelente']" formControlName="punctuality" />
        </app-form-field>
        <app-form-field label="Comentário" optional controlId="ev-comment">
          <textarea appInput rows="3" formControlName="comment" maxlength="400"></textarea>
        </app-form-field>
        @if (serverError()) {
          <p class="field__error" role="alert" data-role="server-error">{{ serverError() }}</p>
        }
      </form>
      <ng-container drawerFooter>
        <button type="button" class="btn" (click)="open.set(false)">Voltar</button>
        <button type="submit" form="nx-evaluation-form" class="btn btn--primary" data-role="submit-evaluation">
          Registrar avaliação
        </button>
      </ng-container>
    </app-drawer>
  `,
})
export class EvaluationDrawerComponent {
  private readonly db = inject(Database);
  private readonly admin = inject(NetworkAdminService);
  private readonly toasts = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly open = model(false);
  readonly requestId = input<string | null>(null);
  readonly registered = output<string>();

  protected readonly submitted = signal(false);
  protected readonly errors = signal<ErrorSummaryItem[]>([]);
  protected readonly serverError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    technical: new FormControl<number | null>(null),
    punctuality: new FormControl<number | null>(null),
    comment: this.fb.control(''),
  });

  protected readonly subtitle = computed(() => {
    const request = this.requestId() ? this.db.serviceRequests.get(this.requestId() as string) : undefined;
    const provider = request ? this.db.providers.get(request.providerId) : undefined;
    return provider ? `${provider.name}, serviço concluído${request?.completedAt ? ` em ${formatDate(request.completedAt)}` : ''}` : '';
  });

  protected technicalError(): string | null {
    return this.submitted() && this.form.controls.technical.value === null
      ? 'Escolha uma nota de 1 a 5 para a qualidade técnica.'
      : null;
  }

  protected punctualityError(): string | null {
    return this.submitted() && this.form.controls.punctuality.value === null
      ? 'Escolha uma nota de 1 a 5 para a pontualidade e a cordialidade.'
      : null;
  }

  constructor() {
    effect(() => {
      if (this.open()) {
        untracked(() => {
          this.form.reset({ technical: null, punctuality: null, comment: '' });
          this.submitted.set(false);
          this.errors.set([]);
          this.serverError.set(null);
        });
      }
    });
  }

  protected submit(): void {
    this.submitted.set(true);
    const list: ErrorSummaryItem[] = [];
    const technical = this.technicalError();
    const punctuality = this.punctualityError();
    if (technical) {
      list.push({ controlId: 'ev-technical', message: technical });
    }
    if (punctuality) {
      list.push({ controlId: 'ev-punctuality', message: punctuality });
    }
    this.errors.set(list);
    const id = this.requestId();
    if (list.length > 0 || !id) {
      return;
    }
    const value = this.form.getRawValue();
    const result = this.admin.registerEvaluation(id, {
      technical: value.technical,
      punctuality: value.punctuality,
      comment: value.comment,
    });
    if (!result.ok) {
      this.serverError.set(result.error);
      return;
    }
    this.open.set(false);
    this.toasts.success('Avaliação registrada. Ela entra na nota do prestador na próxima auditoria.');
    this.registered.emit(result.value.id);
  }
}
