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
import {
  AbstractControl,
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
} from '@angular/forms';
import type { CorporateAccount, PaidPlanId } from '@core/models';
import { generateFictitiousCnpj, validateFictitiousCnpj } from '@core/rules';
import {
  ErrorSummaryComponent,
  ErrorSummaryItem,
  FormFieldComponent,
  NxInputDirective,
  NxMaskDirective,
  NxValidators,
  PLAN_NAMES,
} from '@shared/ui';
import { BannerComponent, DialogService, DrawerComponent, ToastService, UiPrefsService } from '@shared/ui/overlay';
import { CompaniesService, CompanyInput } from '../state/companies.service';
import { FieldRef, collectErrors, maskCnpj } from '../state/form-helpers';

const PLANS: readonly PaidPlanId[] = ['essencial', 'cuida', 'sustenta'];

/**
 * Gaveta do contrato corporativo (SCR-M09-03 "Nova empresa" e SCR-M09-04 "Editar contrato"): empresa, CNPJ
 * fictício, contato de RH, plano pago por vaga, vagas contratadas e preço por vaga, que não faz parte da
 * projeção do plano (RN-CORP-05). As vagas não ficam abaixo das ocupadas.
 */
@Component({
  selector: 'app-company-form-drawer',
  imports: [
    ReactiveFormsModule,
    BannerComponent,
    DrawerComponent,
    ErrorSummaryComponent,
    FormFieldComponent,
    NxInputDirective,
    NxMaskDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-drawer
      [(open)]="open"
      [heading]="account() ? 'Editar contrato' : 'Nova empresa'"
      [subtitle]="account() ? account()!.companyName : 'Entra em Prospecção'"
    >
      <form id="cf-form" class="stack stack--3" novalidate [formGroup]="form" (ngSubmit)="submit()">
        <app-error-summary [items]="summary()" />
        @if (serverError()) {
          <app-banner variant="danger" heading="Não foi possível salvar" liveRole="alert">
            {{ serverError() }}
          </app-banner>
        }
        <div class="form-grid">
          <app-form-field class="span-2" label="Nome da empresa" controlId="cf-name" [forceErrors]="submitted()">
            <input appInput formControlName="companyName" autocomplete="off" />
          </app-form-field>
          <app-form-field
            label="CNPJ fictício"
            hint="Use um CNPJ fictício. O sistema rejeita números válidos."
            controlId="cf-cnpj"
            [forceErrors]="submitted()"
          >
            <input appInput formControlName="cnpj" inputmode="numeric" maxlength="18" autocomplete="off" placeholder="00.000.000/0000-00" (input)="onCnpjInput($event)" />
          </app-form-field>
          <div class="field">
            <span class="field__label">&nbsp;</span>
            <button type="button" class="btn" data-role="generate-cnpj" (click)="generateCnpj()">Gerar CNPJ fictício</button>
          </div>
          <app-form-field label="Contato de RH" controlId="cf-hr" [forceErrors]="submitted()">
            <input appInput formControlName="hrContactName" autocomplete="off" />
          </app-form-field>
          <app-form-field label="E-mail do RH" hint="Termina em @exemplo.com.br." controlId="cf-hr-email" [forceErrors]="submitted()">
            <input appInput type="email" formControlName="hrContactEmail" autocomplete="off" />
          </app-form-field>
          <app-form-field label="Plano pago por vaga" controlId="cf-plan">
            <select appInput formControlName="planId">
              @for (plan of plans; track plan.value) {
                <option [value]="plan.value">{{ plan.label }}</option>
              }
            </select>
          </app-form-field>
          <app-form-field
            label="Vagas contratadas"
            [hint]="occupied() > 0 ? 'Ao menos ' + occupied() + ' (as vagas ocupadas).' : 'Quantos colaboradores o contrato cobre.'"
            controlId="cf-seats"
            [forceErrors]="submitted()"
          >
            <input appInput class="input--num" appMask="number" min="1" max="1000" rangeMessage="As vagas devem ser de 1 a 1000." formControlName="seats" />
          </app-form-field>
          <app-form-field
            class="span-2"
            label="Preço por vaga (por mês)"
            hint="Não faz parte da projeção do plano. É um valor de negociação."
            controlId="cf-price"
            [forceErrors]="submitted()"
          >
            <input appInput class="input--num" appMask="currency" formControlName="seatPriceCents" />
          </app-form-field>
        </div>
      </form>
      <ng-container drawerFooter>
        @if (!account() && prefs.fillWithExample()) {
          <button type="button" class="btn btn--ghost" data-role="fill-example" (click)="fillExample()">
            Preencher com exemplo
          </button>
        }
        <button type="button" class="btn" (click)="open.set(false)">Cancelar</button>
        <button type="submit" form="cf-form" class="btn btn--primary" data-role="save-company" [attr.aria-busy]="busy() ? 'true' : null">
          {{ account() ? 'Salvar contrato' : 'Cadastrar empresa' }}
        </button>
      </ng-container>
    </app-drawer>
  `,
})
export class CompanyFormDrawerComponent {
  private readonly service = inject(CompaniesService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly prefs = inject(UiPrefsService);

  readonly open = model(false);
  /** Contrato em edição; `null` cadastra uma nova empresa. */
  readonly account = input<CorporateAccount | null>(null);
  readonly saved = output<string>();

  protected readonly plans = PLANS.map((value) => ({ value, label: PLAN_NAMES[value] }));
  protected readonly submitted = signal(false);
  protected readonly summary = signal<readonly ErrorSummaryItem[]>([]);
  protected readonly serverError = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected readonly occupied = computed(() => {
    const a = this.account();
    return a ? this.service.countsOf(a.id).occupied : 0;
  });

  protected readonly form = this.fb.group({
    companyName: this.fb.control('', [NxValidators.required('o nome da empresa')]),
    cnpj: this.fb.control('', [
      NxValidators.required('o CNPJ'),
      (control: AbstractControl): ValidationErrors | null => {
        const value = typeof control.value === 'string' ? control.value : '';
        if (value === '' || value.length < 18) {
          return value === '' ? null : { format: { message: 'O CNPJ deve estar no formato 00.000.000/0000-00.' } };
        }
        const result = validateFictitiousCnpj(value);
        return result.valid ? null : { cnpj: { message: result.message } };
      },
    ]),
    hrContactName: this.fb.control('', [NxValidators.required('o nome do contato de RH')]),
    hrContactEmail: this.fb.control('', [
      NxValidators.required('o e-mail do RH'),
      NxValidators.fictitiousEmail,
    ]),
    planId: this.fb.control<PaidPlanId>('cuida'),
    seats: new FormControl<number | null>(null, {
      validators: [
        NxValidators.required('as vagas contratadas'),
        (control: AbstractControl): ValidationErrors | null => {
          const value = control.value as number | null;
          const min = this.occupied();
          return value !== null && min > 0 && value < min
            ? { seats: { message: `As vagas não podem ficar abaixo das ${min} ocupadas.` } }
            : null;
        },
      ],
    }),
    seatPriceCents: new FormControl<number | null>(null, {
      validators: [NxValidators.required('o preço por vaga')],
    }),
  });

  private readonly fields: readonly FieldRef[] = [
    { controlId: 'cf-name', label: 'Nome da empresa', control: this.form.controls.companyName },
    { controlId: 'cf-cnpj', label: 'CNPJ fictício', control: this.form.controls.cnpj },
    { controlId: 'cf-hr', label: 'Contato de RH', control: this.form.controls.hrContactName },
    { controlId: 'cf-hr-email', label: 'E-mail do RH', control: this.form.controls.hrContactEmail },
    { controlId: 'cf-seats', label: 'Vagas contratadas', control: this.form.controls.seats },
    { controlId: 'cf-price', label: 'Preço por vaga', control: this.form.controls.seatPriceCents },
  ];

  constructor() {
    effect(() => {
      if (this.open()) {
        untracked(() => this.load());
      }
    });
  }

  private load(): void {
    const a = this.account();
    this.submitted.set(false);
    this.summary.set([]);
    this.serverError.set(null);
    this.form.reset({
      companyName: a?.companyName ?? '',
      cnpj: a?.cnpj ?? '',
      hrContactName: a?.hrContactName ?? '',
      hrContactEmail: a?.hrContactEmail ?? '',
      planId: a?.planId ?? 'cuida',
      seats: a?.seats ?? null,
      seatPriceCents: a?.seatPriceCents ?? null,
    });
  }

  protected onCnpjInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const masked = maskCnpj(target.value);
    if (masked !== target.value) {
      target.value = masked;
    }
    this.form.controls.cnpj.setValue(masked);
  }

  protected generateCnpj(): void {
    let n = this.service.accounts().length + 1;
    let cnpj = generateFictitiousCnpj(n);
    while (this.service.accounts().some((a) => a.cnpj === cnpj)) {
      n += 1;
      cnpj = generateFictitiousCnpj(n);
    }
    this.form.controls.cnpj.setValue(cnpj);
    this.form.controls.cnpj.markAsTouched();
  }

  protected fillExample(): void {
    this.generateCnpj();
    this.form.patchValue({
      companyName: 'Transportes Exemplo Ltda.',
      hrContactName: 'Patrícia Gomes Lima',
      hrContactEmail: 'rh@exemplo.com.br',
      planId: 'cuida',
      seats: 10,
      seatPriceCents: 9900,
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
    const input: CompanyInput = {
      companyName: value.companyName,
      cnpj: value.cnpj,
      hrContactName: value.hrContactName,
      hrContactEmail: value.hrContactEmail,
      planId: value.planId,
      seats: value.seats ?? 0,
      seatPriceCents: value.seatPriceCents ?? 0,
    };
    const current = this.account();
    this.busy.set(true);
    try {
      if (!current) {
        const result = this.service.create(input);
        if (!result.ok) {
          this.serverError.set(result.message);
          return;
        }
        this.toasts.success(`${result.value.companyName} entrou em Prospecção.`);
        this.open.set(false);
        this.saved.emit(result.value.id);
        return;
      }
      const activeSeats = this.service.countsOf(current.id).active;
      if (current.planId !== input.planId && activeSeats > 0) {
        const { confirmed } = await this.dialogs.confirm({
          title: `Trocar o plano por vaga de ${current.companyName}?`,
          message: `O plano dos ${activeSeats} colaboradores ativos passa para ${PLAN_NAMES[input.planId]}.`,
          effects: { keep: ['o cartão e o histórico de trocas de plano'] },
          confirmLabel: 'Trocar o plano dos colaboradores',
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
      this.toasts.success('Contrato salvo.');
      this.open.set(false);
      this.saved.emit(current.id);
    } finally {
      this.busy.set(false);
    }
  }
}
