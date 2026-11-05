import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import type { Partner, PartnerCategory, PartnerRemuneration } from '@core/models';
import {
  ErrorSummaryComponent,
  ErrorSummaryItem,
  FormFieldComponent,
  NxInputDirective,
  NxMaskDirective,
  NxValidators,
  RadioGroupComponent,
  RadioOption,
} from '@shared/ui';
import { BannerComponent, DialogService, DrawerComponent, ToastService, UiPrefsService } from '@shared/ui/overlay';
import { FieldRef, collectErrors, notTaken } from '../state/form-helpers';
import {
  PARTNER_CATEGORIES,
  PARTNER_CATEGORY_LABEL,
  REMUNERATION_LABEL,
  REMUNERATION_MODELS,
} from '../state/partner-labels';
import { modelChangeSendsBackToReview } from '../state/partner-rules';
import { PartnerInput, PartnersService } from '../state/partners.service';

const MODEL_HINT: Readonly<Record<PartnerRemuneration['model'], string>> = {
  none: 'Não precisa de validação jurídica e ética.',
  fixed_fee: 'Exige a validação jurídica e a ética antes de ativar.',
  commission_non_psychological: 'Exige a validação jurídica e a ética antes de ativar.',
};

/**
 * Gaveta do parceiro (SCR-M09-01 "Novo parceiro" e SCR-M09-02 "Editar dados"): dados, desconto de 0 a 100
 * com uma casa decimal e modelo de remuneração. Não existe opção de remuneração sobre atendimento
 * psicológico (RN-CRT-07). Valida em linha, mostra o resumo de erros e nunca limpa o que foi digitado.
 */
@Component({
  selector: 'app-partner-form-drawer',
  imports: [
    ReactiveFormsModule,
    BannerComponent,
    DrawerComponent,
    ErrorSummaryComponent,
    FormFieldComponent,
    NxInputDirective,
    NxMaskDirective,
    RadioGroupComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-drawer
      [(open)]="open"
      [heading]="partner() ? 'Editar dados do parceiro' : 'Novo parceiro'"
      [subtitle]="partner() ? partner()!.name : 'Entra em Prospecção'"
    >
      <form id="pf-form" class="stack stack--3" novalidate [formGroup]="form" (ngSubmit)="submit()">
        <app-error-summary [items]="summary()" />
        @if (serverError()) {
          <app-banner variant="danger" heading="Não foi possível salvar" liveRole="alert">
            {{ serverError() }}
          </app-banner>
        }
        <div class="form-grid">
          <app-form-field class="span-2" label="Nome do parceiro" controlId="pf-name" [forceErrors]="submitted()">
            <input appInput formControlName="name" autocomplete="off" />
          </app-form-field>
          <app-form-field label="Categoria" controlId="pf-category">
            <select appInput formControlName="category">
              @for (option of categories; track option.value) {
                <option [value]="option.value">{{ option.label }}</option>
              }
            </select>
          </app-form-field>
          <app-form-field label="Cidade" controlId="pf-city" [forceErrors]="submitted()">
            <input appInput formControlName="city" autocomplete="off" />
          </app-form-field>
          <app-form-field label="Nome do contato" controlId="pf-contact" [forceErrors]="submitted()">
            <input appInput formControlName="contactName" autocomplete="off" />
          </app-form-field>
          <app-form-field
            label="E-mail do contato"
            hint="Termina em @exemplo.com.br."
            controlId="pf-email"
            [forceErrors]="submitted()"
          >
            <input appInput type="email" formControlName="contactEmail" autocomplete="off" />
          </app-form-field>
          <app-form-field
            label="Desconto no Cartão Nexus (%)"
            hint="De 0 a 100, com uma casa decimal."
            controlId="pf-discount"
            [forceErrors]="submitted()"
          >
            <input
              appInput
              class="input--num"
              appMask="number"
              decimals="1"
              min="0"
              max="100"
              rangeMessage="O desconto deve ficar entre 0 e 100."
              formControlName="discountPercent"
            />
          </app-form-field>
        </div>
        <app-form-field
          label="Remuneração do parceiro"
          hint="Vale só para serviços que não são privativos da Psicologia."
          group
          controlId="pf-model"
        >
          <app-radio-group [options]="modelOptions" formControlName="model" />
        </app-form-field>
        <app-form-field label="Observações" hint="Combinados com o parceiro. Não escreva dados pessoais." controlId="pf-notes" optional>
          <textarea appInput formControlName="notes" rows="3"></textarea>
        </app-form-field>
      </form>
      <ng-container drawerFooter>
        @if (!partner() && prefs.fillWithExample()) {
          <button type="button" class="btn btn--ghost" data-role="fill-example" (click)="fillExample()">
            Preencher com exemplo
          </button>
        }
        <button type="button" class="btn" (click)="open.set(false)">Cancelar</button>
        <button type="submit" form="pf-form" class="btn btn--primary" data-role="save-partner" [attr.aria-busy]="busy() ? 'true' : null">
          {{ partner() ? 'Salvar dados' : 'Cadastrar parceiro' }}
        </button>
      </ng-container>
    </app-drawer>
  `,
})
export class PartnerFormDrawerComponent {
  private readonly service = inject(PartnersService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly prefs = inject(UiPrefsService);

  readonly open = model(false);
  /** Parceiro em edição; `null` cria um novo. */
  readonly partner = input<Partner | null>(null);
  /** Id do parceiro criado ou editado. */
  readonly saved = output<string>();

  protected readonly categories = PARTNER_CATEGORIES.map((value) => ({
    value,
    label: PARTNER_CATEGORY_LABEL[value],
  }));
  protected readonly modelOptions: RadioOption<PartnerRemuneration['model']>[] =
    REMUNERATION_MODELS.map((value) => ({
      value,
      label: REMUNERATION_LABEL[value],
      hint: MODEL_HINT[value],
    }));

  protected readonly submitted = signal(false);
  protected readonly summary = signal<readonly ErrorSummaryItem[]>([]);
  protected readonly serverError = signal<string | null>(null);
  protected readonly busy = signal(false);
  private readonly editingId = computed(() => this.partner()?.id);

  protected readonly form = this.fb.group({
    name: this.fb.control('', [
      NxValidators.required('o nome do parceiro'),
      notTaken((v) => this.service.nameTaken(v, this.editingId()), 'Já existe um parceiro com este nome.'),
    ]),
    category: this.fb.control<PartnerCategory>('pharmacy'),
    city: this.fb.control('', [NxValidators.required('a cidade')]),
    contactName: this.fb.control('', [NxValidators.required('o nome do contato')]),
    contactEmail: this.fb.control('', [
      NxValidators.required('o e-mail do contato'),
      NxValidators.fictitiousEmail,
    ]),
    discountPercent: new FormControl<number | null>(null, {
      validators: [NxValidators.required('o desconto')],
    }),
    model: this.fb.control<PartnerRemuneration['model']>('none'),
    notes: this.fb.control(''),
  });

  private readonly fields: readonly FieldRef[] = [
    { controlId: 'pf-name', label: 'Nome do parceiro', control: this.form.controls.name },
    { controlId: 'pf-city', label: 'Cidade', control: this.form.controls.city },
    { controlId: 'pf-contact', label: 'Nome do contato', control: this.form.controls.contactName },
    { controlId: 'pf-email', label: 'E-mail do contato', control: this.form.controls.contactEmail },
    { controlId: 'pf-discount', label: 'Desconto', control: this.form.controls.discountPercent },
  ];

  constructor() {
    effect(() => {
      if (this.open()) {
        untracked(() => this.load());
      }
    });
  }

  private load(): void {
    const partner = this.partner();
    this.submitted.set(false);
    this.summary.set([]);
    this.serverError.set(null);
    this.form.reset({
      name: partner?.name ?? '',
      category: partner?.category ?? 'pharmacy',
      city: partner?.city ?? 'Uberlândia',
      contactName: partner?.contactName ?? '',
      contactEmail: partner?.contactEmail ?? '',
      discountPercent: partner?.discountPercent ?? null,
      model: partner?.remuneration.model ?? 'none',
      notes: partner?.remuneration.notes ?? '',
    });
  }

  protected fillExample(): void {
    let name = 'Farmácia Exemplo Saúde';
    let n = 1;
    while (this.service.nameTaken(name)) {
      n += 1;
      name = `Farmácia Exemplo Saúde ${n}`;
    }
    this.form.patchValue({
      name,
      category: 'pharmacy',
      city: 'Uberlândia',
      contactName: 'Maria das Dores Souza',
      contactEmail: 'maria.souza@exemplo.com.br',
      discountPercent: 8,
      model: 'none',
      notes: 'Desconto combinado para todos os planos pagos.',
    });
    this.summary.set([]);
    this.serverError.set(null);
  }

  protected async submit(): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.submitted.set(true);
    this.form.markAllAsTouched();
    const errors = collectErrors(this.fields);
    this.summary.set(errors);
    if (errors.length > 0) {
      return;
    }
    const value = this.form.getRawValue();
    const input: PartnerInput = {
      name: value.name,
      category: value.category,
      city: value.city,
      contactName: value.contactName,
      contactEmail: value.contactEmail,
      discountPercent: value.discountPercent ?? 0,
      model: value.model,
      notes: value.notes,
    };
    const current = this.partner();
    this.busy.set(true);
    try {
      if (!current) {
        const result = this.service.create(input);
        if (!result.ok) {
          this.serverError.set(result.message);
          return;
        }
        this.toasts.success(`${result.value.name} entrou em Prospecção.`);
        this.open.set(false);
        this.saved.emit(result.value.id);
        return;
      }
      if (modelChangeSendsBackToReview(current.status, current.remuneration.model, input.model)) {
        const { confirmed } = await this.dialogs.confirm({
          title: `Mudar a remuneração de ${current.name}?`,
          message:
            'O novo modelo só vale depois da validação jurídica e ética. As validações do modelo anterior deixam de valer.',
          effects: {
            block: ['o parceiro na lista do Cartão até as duas validações novas'],
            keep: ['o histórico de usos do cartão'],
          },
          confirmLabel: 'Mudar e voltar à validação',
        });
        if (!confirmed) {
          return;
        }
      }
      const result = this.service.update(current.id, input);
      if (!result.ok) {
        this.serverError.set(result.message);
        return;
      }
      this.toasts.success(
        result.value.movedBack
          ? 'Dados salvos. O parceiro voltou à validação jurídica e ética.'
          : 'Dados do parceiro salvos.',
      );
      this.open.set(false);
      this.saved.emit(current.id);
    } finally {
      this.busy.set(false);
    }
  }
}
