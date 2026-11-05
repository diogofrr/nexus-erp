import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Clock } from '@core/clock';
import { Database } from '@core/data';
import { CouncilBody, ProviderCategory } from '@core/models';
import {
  CheckboxComponent,
  ErrorSummaryComponent,
  ErrorSummaryItem,
  FormFieldComponent,
  NxInputDirective,
  NxMaskDirective,
  NxValidators,
  PageHeaderComponent,
  RadioGroupComponent,
  RadioOption,
  fieldErrorMessage,
} from '@shared/ui';
import { ToastService, UiPrefsService } from '@shared/ui/overlay';
import { NetworkAdminService } from '../state/network-admin.service';
import { categoryLabel } from '../state/network-labels';

const PERSON_OPTIONS: readonly RadioOption<'person' | 'company'>[] = [
  { value: 'person', label: 'Pessoa' },
  { value: 'company', label: 'Empresa' },
];

const DEFAULT_CONDITIONS =
  'Horário prioritário e condições combinadas para usuários da Nexus. O pagamento é feito direto ao profissional.';

/**
 * Novo credenciamento (abrir processo, escopo M08 "Abrir processo"): cadastra o candidato com os dados que a
 * Nexus precisa para conferir os 5 critérios. Dados 100% fictícios (e-mail @exemplo.com.br, telefone de
 * (34) 90000-0000 a (34) 90000-0999). Não existe campo de valor por atendimento (RN-REDE-12).
 */
@Component({
  selector: 'app-network-accreditation-new-page',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    CheckboxComponent,
    ErrorSummaryComponent,
    FormFieldComponent,
    NxInputDirective,
    NxMaskDirective,
    PageHeaderComponent,
    RadioGroupComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page--form">
      <app-page-header
        title="Novo credenciamento"
        description="Cadastre o candidato. Depois você confere os 5 critérios e decide."
        [breadcrumbs]="[{ label: 'Credenciamento', link: '/app/rede/credenciamento' }, { label: 'Novo credenciamento' }]"
      />
      <form class="stack stack--6" novalidate [formGroup]="form" (ngSubmit)="submit()" data-role="new-process-form">
        <app-error-summary [items]="errors()" />
        <div class="form-grid">
          <app-form-field class="span-2" label="Nome do prestador" controlId="np-name" [forceErrors]="tried()">
            <input appInput formControlName="name" maxlength="120" autocomplete="off" />
          </app-form-field>
          <app-form-field label="Tipo" group controlId="np-person">
            <app-radio-group [options]="personOptions" formControlName="personType" />
          </app-form-field>
          <app-form-field label="Categoria" controlId="np-category" [forceErrors]="tried()">
            <select appInput formControlName="category">
              <option value="">Escolha a categoria</option>
              @for (option of categories(); track option.value) {
                <option [value]="option.value">{{ option.label }}</option>
              }
            </select>
          </app-form-field>
          <app-form-field class="span-2" label="Especialidade" controlId="np-specialty" [forceErrors]="tried()">
            <input appInput formControlName="specialtyLabel" maxlength="120" />
          </app-form-field>
          <app-form-field
            label="Conselho de classe"
            hint="Sem conselho, o primeiro critério fica como não se aplica."
            controlId="np-council"
          >
            <select appInput formControlName="councilBody">
              <option value="NONE">Sem conselho de classe</option>
              @for (body of councilBodies(); track body) {
                <option [value]="body">{{ body }}</option>
              }
            </select>
          </app-form-field>
          @if (hasCouncil()) {
            <app-form-field label="Número do registro" controlId="np-council-number" [forceErrors]="tried()">
              <input appInput formControlName="councilNumber" maxlength="30" />
            </app-form-field>
            <app-form-field label="Estado do registro" controlId="np-council-state" [forceErrors]="tried()">
              <input appInput formControlName="councilState" maxlength="2" />
            </app-form-field>
            <app-form-field
              label="Registro válido até"
              hint="Digite a data no formato 31/12/2027."
              controlId="np-council-valid"
              [forceErrors]="tried()"
            >
              <input appInput appMask="date" inputmode="numeric" formControlName="councilValidUntil" />
            </app-form-field>
          }
          <app-form-field label="Cidade" controlId="np-city" [forceErrors]="tried()">
            <input appInput formControlName="city" maxlength="60" />
          </app-form-field>
          <app-form-field
            label="E-mail"
            hint="Use um e-mail que termine em @exemplo.com.br."
            controlId="np-email"
            [forceErrors]="tried()"
          >
            <input appInput type="email" formControlName="email" autocomplete="off" />
          </app-form-field>
          <app-form-field
            label="Telefone"
            hint="Use um telefone de (34) 90000-0000 a (34) 90000-0999."
            controlId="np-phone"
            [forceErrors]="tried()"
          >
            <input appInput appMask="phone" inputmode="tel" formControlName="phone" />
          </app-form-field>
          <div class="span-2">
            <app-checkbox formControlName="homeCare">Atende em domicílio</app-checkbox>
          </div>
          <app-form-field class="span-2" label="Condições para usuários Nexus" controlId="np-conditions" [forceErrors]="tried()">
            <textarea appInput rows="3" formControlName="conditions"></textarea>
          </app-form-field>
        </div>

        <div class="form-actions">
          @if (prefs.fillWithExample()) {
            <button type="button" class="btn btn--ghost" data-role="fill-example" (click)="fillExample()">
              Preencher com exemplo
            </button>
          }
          <a class="btn" routerLink="/app/rede/credenciamento">Voltar</a>
          <button type="submit" class="btn btn--primary" data-role="submit-process" [attr.aria-busy]="saving()">
            Abrir processo de credenciamento
          </button>
        </div>
      </form>
    </div>
  `,
})
export class AccreditationNewPage {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly router = inject(Router);
  private readonly admin = inject(NetworkAdminService);
  private readonly toasts = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly prefs = inject(UiPrefsService);

  protected readonly personOptions = PERSON_OPTIONS;
  protected readonly tried = signal(false);
  protected readonly saving = signal(false);
  protected readonly errors = signal<ErrorSummaryItem[]>([]);

  protected readonly form = this.fb.group({
    name: this.fb.control('', NxValidators.required('o nome do prestador')),
    personType: this.fb.control<'person' | 'company'>('person'),
    category: this.fb.control('', NxValidators.required('a categoria do prestador')),
    specialtyLabel: this.fb.control('', NxValidators.required('a especialidade')),
    councilBody: this.fb.control<string>('NONE'),
    councilNumber: this.fb.control(''),
    councilState: this.fb.control('MG'),
    councilValidUntil: new FormControl<string | null>(null),
    city: this.fb.control('Uberlândia', NxValidators.required('a cidade')),
    homeCare: this.fb.control(false),
    email: this.fb.control('', [NxValidators.required('o e-mail do prestador'), NxValidators.fictitiousEmail]),
    phone: this.fb.control('', [NxValidators.required('o telefone do prestador'), NxValidators.fictitiousPhone]),
    conditions: this.fb.control(DEFAULT_CONDITIONS, NxValidators.required('as condições para usuários Nexus')),
  });

  protected readonly categories = computed(() => {
    const present = new Set<ProviderCategory>(this.db.providers.all().map((p) => p.category));
    return [...present]
      .map((value) => ({ value, label: categoryLabel(value) }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  });

  protected readonly councilBodies = computed(() => {
    const present = new Set<CouncilBody>(this.db.providers.all().map((p) => p.council.body));
    present.delete('NONE');
    return [...present].sort();
  });

  private readonly councilBody = signal<string>('NONE');
  protected readonly hasCouncil = computed(() => this.councilBody() !== 'NONE');

  constructor() {
    this.form.controls.councilBody.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.councilBody.set(value));
  }

  protected fillExample(): void {
    this.form.patchValue({
      name: 'Dra. Helena Duarte',
      personType: 'person',
      category: this.categories().find((c) => c.value === 'physiotherapy')?.value ?? this.categories()[0]?.value ?? '',
      specialtyLabel: 'Fisioterapia geriátrica',
      councilBody: this.councilBodies().includes('CREFITO') ? 'CREFITO' : 'NONE',
      councilNumber: '00099-F',
      councilState: 'MG',
      councilValidUntil: this.clock.addDays(365),
      city: 'Uberlândia',
      homeCare: true,
      email: 'helena.duarte@exemplo.com.br',
      phone: '(34) 90000-0321',
    });
  }

  protected submit(): void {
    this.tried.set(true);
    this.form.markAllAsTouched();
    const f = this.form.controls;
    const list: ErrorSummaryItem[] = [];
    (
      [
        ['np-name', f.name, 'o nome do prestador'],
        ['np-category', f.category, 'a categoria'],
        ['np-specialty', f.specialtyLabel, 'a especialidade'],
        ['np-city', f.city, 'a cidade'],
        ['np-email', f.email, 'o e-mail'],
        ['np-phone', f.phone, 'o telefone'],
        ['np-conditions', f.conditions, 'as condições'],
      ] as const
    ).forEach(([id, control, label]) => {
      const message = fieldErrorMessage(control.errors, label);
      if (message) {
        list.push({ controlId: id, message });
      }
    });
    if (this.hasCouncil()) {
      if (!f.councilNumber.value.trim()) {
        list.push({ controlId: 'np-council-number', message: 'Informe o número do registro no conselho.' });
      }
      if (!f.councilValidUntil.value) {
        list.push({ controlId: 'np-council-valid', message: 'Informe até quando o registro é válido.' });
      }
    }
    this.errors.set(list);
    if (list.length > 0) {
      return;
    }
    this.saving.set(true);
    const value = this.form.getRawValue();
    const hasCouncil = value.councilBody !== 'NONE';
    const result = this.admin.openProcess({
      name: value.name.trim(),
      personType: value.personType,
      category: value.category as ProviderCategory,
      specialtyLabel: value.specialtyLabel.trim(),
      council: hasCouncil
        ? {
            body: value.councilBody as CouncilBody,
            number: value.councilNumber.trim(),
            state: value.councilState.trim().toUpperCase(),
            status: 'active',
            ...(value.councilValidUntil ? { validUntil: value.councilValidUntil } : {}),
            fictitious: true,
          }
        : { body: 'NONE', status: 'not_applicable' },
      city: value.city.trim(),
      homeCare: value.homeCare,
      conditionsForNexusUsers: value.conditions.trim(),
      email: value.email.trim(),
      phone: value.phone,
    });
    this.saving.set(false);
    if (!result.ok) {
      this.errors.set([{ controlId: 'np-name', message: result.error }]);
      return;
    }
    const accreditationId = result.value.accreditationId;
    this.toasts.success(`Processo de ${result.value.name} aberto. Confira os 5 critérios.`);
    void this.router.navigate(['/app/rede/credenciamento', accreditationId]);
  }
}
