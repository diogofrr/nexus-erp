import { ChangeDetectionStrategy, Component, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Clock } from '@core/clock';
import type { ConsentKey } from '@core/models';
import {
  CheckboxComponent,
  ConsentToggleComponent,
  DescriptionListComponent,
  ERROR_MESSAGES,
  ErrorSummaryComponent,
  ErrorSummaryItem,
  FormFieldComponent,
  MaskedFieldComponent,
  NxInputDirective,
  NxMaskDirective,
  NxValidators,
  RadioGroupComponent,
  RadioOption,
  RatingComponent,
  RevokeRequest,
  SearchFieldComponent,
  SwitchComponent,
  fieldErrorMessage,
} from '@shared/ui';

interface FieldRef {
  controlId: string;
  label: string;
  control: AbstractControl;
}

/**
 * Formulários do kit: campo com rótulo, dica e erro; entradas com máscara; caixa, opção única, interruptor,
 * nota e busca; resumo de erros; campo mascarado e consentimento (ligados ao núcleo).
 */
@Component({
  selector: 'app-kit-forms',
  imports: [
    ReactiveFormsModule,
    CheckboxComponent,
    ConsentToggleComponent,
    DescriptionListComponent,
    ErrorSummaryComponent,
    FormFieldComponent,
    MaskedFieldComponent,
    NxInputDirective,
    NxMaskDirective,
    RadioGroupComponent,
    RatingComponent,
    SearchFieldComponent,
    SwitchComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'stack stack--8' },
  template: `
    <section class="stack stack--6" aria-labelledby="kit-forms-title">
      <div class="section-head">
        <h2 id="kit-forms-title">Formulários</h2>
        <p>Rótulo sempre visível, dica acima, erro abaixo com o mesmo texto do resumo. Nada é limpo ao errar.</p>
      </div>

      <div class="layout-main-aside">
        <form class="card card--pad stack stack--6" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <app-error-summary [items]="summary()" />
          <div class="form-grid">
            <app-form-field label="Nome completo" hint="Como está no documento." controlId="kit-name" [forceErrors]="submitted()">
              <input appInput formControlName="name" autocomplete="off" />
            </app-form-field>
            <app-form-field label="CPF fictício" hint="Use um CPF fictício. O sistema rejeita números válidos." controlId="kit-cpf" [forceErrors]="submitted()">
              <input appInput appMask="cpf" formControlName="cpf" />
            </app-form-field>
            <app-form-field label="Telefone" controlId="kit-phone" [forceErrors]="submitted()">
              <input appInput appMask="phone" formControlName="phone" />
            </app-form-field>
            <app-form-field label="E-mail" hint="Termina em @exemplo.com.br." controlId="kit-email" [forceErrors]="submitted()">
              <input appInput type="email" formControlName="email" autocomplete="off" />
            </app-form-field>
            <app-form-field label="Data de nascimento" hint="Digite dia, mês e ano." controlId="kit-birth" [forceErrors]="submitted()">
              <input appInput appMask="date" formControlName="birth" />
            </app-form-field>
            <app-form-field label="Horas de cuidado por dia" controlId="kit-hours" [forceErrors]="submitted()">
              <input appInput class="input--num" appMask="number" min="0" max="24" rangeMessage="As horas por dia devem ser de 0 a 24." formControlName="hours" />
            </app-form-field>
            <app-form-field label="Valor da sessão" hint="O modelo guarda centavos." controlId="kit-price" optional>
              <input appInput class="input--num" appMask="currency" formControlName="price" />
            </app-form-field>
            <app-form-field label="Plano" controlId="kit-plan">
              <select appInput formControlName="plan">
                <option value="livre">Livre</option>
                <option value="essencial">Essencial</option>
                <option value="cuida">Cuida</option>
                <option value="sustenta">Sustenta</option>
              </select>
            </app-form-field>
            <app-form-field class="span-2" label="Observação" hint="Não escreva dados de saúde aqui." controlId="kit-note" optional>
              <textarea appInput formControlName="note"></textarea>
            </app-form-field>
            <app-form-field class="span-2" label="Canal preferido de contato" group controlId="kit-channel" [forceErrors]="submitted()">
              <app-radio-group [options]="channels" formControlName="channel" />
            </app-form-field>
          </div>
          <div class="stack stack--2">
            <app-checkbox formControlName="notices" hint="Opcional, não muda o plano.">Aceito receber avisos por e-mail</app-checkbox>
            <app-switch formControlName="auto">Avançar automaticamente ao responder</app-switch>
          </div>
          <app-form-field label="Nota do atendimento" group optional>
            <app-rating formControlName="score" />
          </app-form-field>
          <div class="form-actions">
            <span class="form-actions__status" aria-live="polite">{{ status() }}</span>
            <button type="button" class="btn" (click)="fill()">Preencher exemplo</button>
            <button type="submit" class="btn btn--primary">Criar cadastro</button>
          </div>
        </form>

        <aside class="stack stack--6" aria-label="Busca e estados">
          <div class="card card--pad stack stack--3">
            <h3>Busca</h3>
            <app-search-field label="Buscar cuidador" placeholder="Código ou nome" [(value)]="term" />
            <p class="t-caption" aria-live="polite">{{ term() ? 'Buscando por "' + term() + '"' : 'O texto digitado não vai para a URL.' }}</p>
          </div>
          <div class="card card--pad stack stack--3">
            <h3>Campos desabilitado, somente leitura e com erro de servidor</h3>
            <app-form-field label="Código" hint="Gerado pelo sistema.">
              <input appInput value="CUI-0042" readonly />
            </app-form-field>
            <app-form-field label="Plano atual">
              <input appInput value="Cuida" disabled />
            </app-form-field>
            <app-form-field label="Código de indicação" [error]="duplicate">
              <input appInput value="CUI-0001" />
            </app-form-field>
          </div>
        </aside>
      </div>
    </section>

    <section class="stack stack--6" aria-labelledby="kit-masked-title">
      <div class="section-head">
        <h2 id="kit-masked-title">Dado sensível</h2>
        <p>
          O que aparece depende do perfil que está logado: o atendimento vê "Mostrar" (pede motivo, mostra por 30 s e
          grava no log), a gestão vê só o código, o credenciado vê só o mascarado.
        </p>
      </div>
      <div class="layout-main-aside">
        <div class="card card--pad">
          <app-description-list [items]="maskedItems()" />
          <ng-template #cpf>
            <app-masked-field kind="cpf" label="CPF" value="000.123.456-00" entity="caregiver" entityId="cg_0042" field="cpf" subjectId="cg_0042" />
          </ng-template>
          <ng-template #phone>
            <app-masked-field kind="phone" label="Telefone" value="(34) 90000-0123" entity="caregiver" entityId="cg_0042" field="phone" subjectId="cg_0042" />
          </ng-template>
          <ng-template #email>
            <app-masked-field kind="email" label="E-mail" value="ana.ferraz@exemplo.com.br" entity="caregiver" entityId="cg_0042" field="email" subjectId="cg_0042" />
          </ng-template>
          <ng-template #nothing>
            <app-masked-field kind="phone" label="WhatsApp" [value]="null" entity="caregiver" entityId="cg_0042" field="whatsapp" />
          </ng-template>
        </div>
        <div class="card card--pad stack stack--3">
          <h3>Como a gestão vê</h3>
          <p class="t-caption">Exemplo estático: o valor real nem entra no DOM.</p>
          <span class="code-chip">CUI-0042</span>
        </div>
      </div>
    </section>

    <section class="stack stack--6" aria-labelledby="kit-consent-title">
      <div class="section-head">
        <h2 id="kit-consent-title">Consentimento</h2>
        <p>Um por finalidade, em linguagem simples. Ligar concede; desligar pede o diálogo de efeito.</p>
      </div>
      @if (revoking(); as request) {
        <div class="banner banner--attention" role="status">
          <div class="banner__body">
            <span class="banner__title">Aqui abriria o diálogo de efeito antes de revogar</span>
            <span class="banner__text">{{ request.effects.join(' ') }}</span>
            <span class="banner__actions"><button type="button" class="btn btn--sm" (click)="revoking.set(null)">Voltar</button></span>
          </div>
        </div>
      }
      <div class="list-card">
        @for (key of consentKeys; track key) {
          <app-consent-toggle [caregiverId]="caregiverId" [key]="key" (revokeRequested)="revoking.set($event)" />
        }
      </div>
    </section>
  `,
})
export class KitFormsSection {
  private readonly clock = inject(Clock);

  protected readonly channels: RadioOption[] = [
    { value: 'app', label: 'Aplicativo' },
    { value: 'phone', label: 'Telefone', hint: 'De segunda a sexta, das 8h às 18h' },
    { value: 'whatsapp', label: 'WhatsApp' },
  ];
  protected readonly consentKeys: ConsentKey[] = ['health_data', 'people_analytics', 'whatsapp_contact'];
  protected readonly caregiverId = 'cg_0017';
  protected readonly duplicate = ERROR_MESSAGES.duplicate;
  protected readonly term = signal('');
  protected readonly revoking = signal<RevokeRequest | null>(null);
  protected readonly submitted = signal(false);
  protected readonly status = signal('');

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [NxValidators.required('o nome completo')] }),
    cpf: new FormControl('', { nonNullable: true, validators: [NxValidators.required('o CPF'), NxValidators.fictitiousCpf] }),
    phone: new FormControl('', { nonNullable: true, validators: [NxValidators.fictitiousPhone] }),
    email: new FormControl('', { nonNullable: true, validators: [NxValidators.fictitiousEmail] }),
    birth: new FormControl<string | null>(null, [NxValidators.required('a data de nascimento'), NxValidators.adult(() => this.clock.today())]),
    hours: new FormControl<number | null>(null, [NxValidators.required('as horas de cuidado por dia')]),
    price: new FormControl<number | null>(null),
    plan: new FormControl('livre', { nonNullable: true }),
    note: new FormControl('', { nonNullable: true }),
    channel: new FormControl<string | null>(null, [NxValidators.required('o canal preferido')]),
    notices: new FormControl(false, { nonNullable: true }),
    auto: new FormControl(false, { nonNullable: true }),
    score: new FormControl<number | null>(null),
  });

  private readonly fields: FieldRef[] = [
    { controlId: 'kit-name', label: 'Nome completo', control: this.form.controls.name },
    { controlId: 'kit-cpf', label: 'CPF fictício', control: this.form.controls.cpf },
    { controlId: 'kit-phone', label: 'Telefone', control: this.form.controls.phone },
    { controlId: 'kit-email', label: 'E-mail', control: this.form.controls.email },
    { controlId: 'kit-birth', label: 'Data de nascimento', control: this.form.controls.birth },
    { controlId: 'kit-hours', label: 'Horas de cuidado por dia', control: this.form.controls.hours },
    { controlId: 'kit-channel', label: 'Canal preferido de contato', control: this.form.controls.channel },
  ];

  protected readonly summary = signal<readonly ErrorSummaryItem[]>([]);
  private readonly cpfTemplate = viewChild.required<TemplateRef<unknown>>('cpf');
  private readonly phoneTemplate = viewChild.required<TemplateRef<unknown>>('phone');
  private readonly emailTemplate = viewChild.required<TemplateRef<unknown>>('email');
  private readonly emptyTemplate = viewChild.required<TemplateRef<unknown>>('nothing');
  protected readonly maskedItems = computed(() => [
    { label: 'Nome', value: 'Ana Paula Ferraz' },
    { label: 'CPF', template: this.cpfTemplate() },
    { label: 'Telefone', template: this.phoneTemplate() },
    { label: 'E-mail', template: this.emailTemplate() },
    { label: 'WhatsApp', template: this.emptyTemplate() },
    { label: 'Cidade', value: 'Uberlândia' },
  ]);

  protected submit(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    const items = this.fields.flatMap((f): ErrorSummaryItem[] => {
      const message = fieldErrorMessage(f.control.errors, f.label);
      return message ? [{ controlId: f.controlId, message }] : [];
    });
    this.summary.set(items);
    this.status.set(items.length > 0 ? '' : 'Cadastro de exemplo válido. Nada foi gravado.');
  }

  protected fill(): void {
    this.form.patchValue({
      name: 'Ana Paula Ferraz',
      cpf: '000.123.456-00',
      phone: '(34) 90000-0123',
      email: 'ana.ferraz@exemplo.com.br',
      birth: '1980-03-09',
      hours: 8,
      price: 12000,
      channel: 'app',
    });
    this.summary.set([]);
    this.status.set('Exemplo preenchido.');
  }
}
