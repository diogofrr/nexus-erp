import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '@core/auth';
import { Database } from '@core/data';
import type { Message } from '@core/models';
import {
  CheckboxComponent,
  ErrorSummaryComponent,
  ErrorSummaryItem,
  FormFieldComponent,
  NxInputDirective,
  NxValidators,
  RadioGroupComponent,
  RadioOption,
  fieldErrorMessage,
} from '@shared/ui';
import { DrawerComponent, ToastService, UiPrefsService } from '@shared/ui/overlay';
import { MessagesService } from '../state/messages.service';
import { CaregiverPickerComponent } from './caregiver-picker.component';

const CHANNEL_OPTIONS: readonly RadioOption<'phone' | 'whatsapp'>[] = [
  { value: 'phone', label: 'Telefone' },
  { value: 'whatsapp', label: 'WhatsApp' },
];

/**
 * Registrar contato (SCR-M11-03, F17): o atendimento anota, enquanto fala, o telefone ou o WhatsApp recebido
 * em nome do usuário (RN-CAN-05). A mensagem entra na caixa com o canal escolhido e o prazo do núcleo.
 * Gaveta modal: folha cheia no celular.
 */
@Component({
  selector: 'app-contact-drawer',
  imports: [
    ReactiveFormsModule,
    DrawerComponent,
    ErrorSummaryComponent,
    FormFieldComponent,
    NxInputDirective,
    RadioGroupComponent,
    CheckboxComponent,
    CaregiverPickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-drawer
      [(open)]="open"
      heading="Registrar contato"
      subtitle="Telefone ou WhatsApp recebido, registrado em nome do usuário"
    >
      <form id="nx-contact-form" class="stack stack--3" novalidate [formGroup]="form" (ngSubmit)="submit()">
        <app-error-summary [items]="errors()" />
        <app-form-field label="Canal" group controlId="contact-channel">
          <app-radio-group [options]="channels" formControlName="channel" />
        </app-form-field>
        <app-caregiver-picker
          id="contact-caregiver"
          label="Cuidador"
          hint="Busque pelo nome ou pelo código."
          [value]="form.controls.caregiverId.value"
          [error]="pickerError()"
          (valueChange)="setCaregiver($event)"
        />
        <app-form-field label="Assunto" controlId="contact-subject" [forceErrors]="submitted()">
          <input appInput formControlName="subject" maxlength="120" />
        </app-form-field>
        <app-form-field label="Resumo do contato" controlId="contact-body" [forceErrors]="submitted()">
          <textarea appInput rows="4" formControlName="body"></textarea>
        </app-form-field>
        <app-checkbox formControlName="answered" hint="O contato entra na caixa já como respondido.">
          Já respondi na ligação
        </app-checkbox>
        <app-checkbox
          formControlName="support"
          hint="Registra como pedido de apoio. A equipe técnica acompanha."
        >
          Marcar como pedido de apoio
        </app-checkbox>
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
        <button type="submit" form="nx-contact-form" class="btn btn--primary" data-role="submit-contact">
          Registrar contato
        </button>
      </ng-container>
    </app-drawer>
  `,
})
export class ContactDrawerComponent {
  private readonly db = inject(Database);
  private readonly auth = inject(AuthService);
  private readonly service = inject(MessagesService);
  private readonly toasts = inject(ToastService);
  protected readonly prefs = inject(UiPrefsService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly open = model(false);
  readonly registered = output<Message>();

  protected readonly channels = CHANNEL_OPTIONS;
  protected readonly submitted = signal(false);
  protected readonly errors = signal<ErrorSummaryItem[]>([]);

  protected readonly form = this.fb.group({
    channel: this.fb.control<'phone' | 'whatsapp'>('phone'),
    caregiverId: new FormControl<string | null>(null, NxValidators.required('o cuidador')),
    subject: this.fb.control('', NxValidators.required('o assunto do contato')),
    body: this.fb.control('', NxValidators.required('o resumo do contato')),
    answered: this.fb.control(false),
    support: this.fb.control(false),
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        untracked(() => this.reset());
      }
    });
  }

  protected pickerError(): string | null {
    return this.submitted() && !this.form.controls.caregiverId.value
      ? 'Escolha o cuidador que entrou em contato.'
      : null;
  }

  protected setCaregiver(id: string | null): void {
    this.form.controls.caregiverId.setValue(id);
    this.form.controls.caregiverId.markAsDirty();
  }

  private reset(): void {
    this.form.reset({
      channel: 'phone',
      caregiverId: null,
      subject: '',
      body: '',
      answered: false,
      support: false,
    });
    this.submitted.set(false);
    this.errors.set([]);
  }

  protected fillExample(): void {
    const sample = this.db.caregivers.get('cg_0003') ?? this.db.caregivers.all()[0];
    this.form.patchValue({
      channel: 'phone',
      caregiverId: sample?.id ?? null,
      subject: 'Dúvida sobre o grupo de apoio',
      body: 'Ligou para saber como participar do grupo de apoio e pediu o horário do próximo encontro.',
      answered: true,
    });
  }

  protected submit(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    const f = this.form.controls;
    const list: ErrorSummaryItem[] = [];
    if (!f.caregiverId.value) {
      list.push({ controlId: 'contact-caregiver', message: 'Escolha o cuidador que entrou em contato.' });
    }
    (
      [
        ['contact-subject', f.subject, 'o assunto do contato'],
        ['contact-body', f.body, 'o resumo do contato'],
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
    const message = this.service.registerContact({
      channel: value.channel,
      caregiverId: value.caregiverId as string,
      subject: value.subject,
      body: value.body,
      answeredOnCall: value.answered,
      supportRequest: value.support,
    });
    const caregiver = this.db.caregivers.get(message.caregiverId as string);
    const who = this.auth.role() === 'partner' ? caregiver?.code : caregiver?.fullName;
    this.toasts.success(
      `Contato por ${value.channel === 'phone' ? 'telefone' : 'WhatsApp'} registrado${who ? `: ${who}` : ''}. Já está na caixa.`,
    );
    this.open.set(false);
    this.registered.emit(message);
  }
}
