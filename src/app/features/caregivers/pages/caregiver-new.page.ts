import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, ValidationErrors } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CanDeactivateFn, Router, RouterLink } from '@angular/router';
import { debounceTime, merge } from 'rxjs';
import { Clock, addYears } from '@core/clock';
import { Database } from '@core/data';
import { formatDate, formatMoney, formatTime } from '@core/format';
import type { Channel, ConsentKey, Dependency, PlanId, Relationship, Sex } from '@core/models';
import { maskCpf } from '@core/privacy';
import { BENEFIT_LABELS, CONSENT_KEYS, CONSENT_LABELS, PLAN_NOT_INCLUDED_NOTICE, PLAN_ORDER, generateFictitiousCpf, generateFictitiousPhone, planBenefits } from '@core/rules';
import {
  BadgeComponent,
  CONSENT_COPY,
  DraftRecord,
  DraftService,
  ErrorSummaryComponent,
  ErrorSummaryItem,
  FormFieldComponent,
  NxInputDirective,
  NxMaskDirective,
  NxValidators,
  PageHeaderComponent,
  RadioGroupComponent,
  RadioOption,
  StepperComponent,
} from '@shared/ui';
import { BannerComponent, DialogService, DrawerComponent, ToastService, UiPrefsService } from '@shared/ui/overlay';
import { CaregiverFieldsFormComponent } from '../components/caregiver-fields-form.component';
import { CAREGIVER_FIELD_META, Literacy, caregiverFieldsGroup, errorItems } from '../state/caregiver-form';
import { DEPENDENCY_HINTS, DEPENDENCY_LABELS } from '../state/caregiver-labels';
import { CaregiverError, CaregiverService } from '../state/caregiver.service';

type Choice = 'granted' | 'refused' | 'pending';

interface DraftData {
  step: number;
  fields: Record<string, unknown>;
  cpf: string;
  elder: Record<string, unknown>;
  choices: Partial<Record<ConsentKey, Choice>>;
  channel: Channel | 'in_person';
  evidence: string;
  planId: PlanId;
}

const DRAFT_FORM = 'caregiver-new';
const STEP_TITLES = ['Quem é o cuidador?', 'Quem é a pessoa idosa?', 'O que o cuidador autoriza?', 'Qual plano o cuidador começa?', 'Confira e crie o cadastro'];
const STEP_LABELS = ['Cuidador', 'Pessoa idosa', 'Consentimentos', 'Plano', 'Resumo'];
const CHOICE_OPTIONS: RadioOption<Choice>[] = [
  { value: 'granted', label: 'Concorda' },
  { value: 'refused', label: 'Não concorda' },
  { value: 'pending', label: 'Decidir depois' },
];
const CHOICE_LABEL: Record<Choice, string> = { granted: 'Ativo', refused: 'Recusado', pending: 'Pendente' };

/** Pergunta antes de sair no meio do cadastro (UX 5.12): o rascunho já está guardado. */
export const leaveNewCaregiverGuard: CanDeactivateFn<CaregiverNewPage> = (page) => page.canLeave();

/**
 * SCR-M03-02 Novo cuidador (F02, PD-04): assistente em 5 etapas, Livre por padrão, seis consentimentos
 * independentes com três escolhas de mesmo peso (nada vem marcado), CPF fictício com "Gerar CPF fictício",
 * rascunho automático e resumo final com "Editar" por bloco. Condições de saúde e medicamentos NÃO são
 * pedidos aqui (U-08): só depois do consentimento de saúde.
 */
@Component({
  selector: 'app-caregiver-new-page',
  imports: [
    BadgeComponent,
    BannerComponent,
    CaregiverFieldsFormComponent,
    DrawerComponent,
    ErrorSummaryComponent,
    FormFieldComponent,
    NxInputDirective,
    NxMaskDirective,
    PageHeaderComponent,
    RadioGroupComponent,
    ReactiveFormsModule,
    RouterLink,
    StepperComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page--form stack stack--6">
      <app-page-header title="Novo cuidador" [description]="'Etapa ' + (step() + 1) + ' de 5: ' + stepLabels[step()]" />
      <app-stepper label="Etapas do cadastro" [steps]="stepItems" [current]="step()" />

      @if (pendingDraft(); as draft) {
        <app-banner variant="info" heading="Você tem um cadastro em andamento">
          Iniciado {{ describeDraft(draft) }}. Retomar ou começar de novo?
          <span bannerActions class="cluster">
            <button type="button" class="btn btn--sm" (click)="resumeDraft(draft)">Retomar rascunho</button>
            <button type="button" class="btn btn--sm" (click)="discardDraft()">Começar de novo</button>
          </span>
        </app-banner>
      }
      @if (failure()) {
        <app-banner variant="danger" heading="Não foi possível criar o cadastro">{{ failure() }}</app-banner>
      }

      <section class="card card--pad stack stack--6" [attr.aria-labelledby]="'nx-step-title'">
        <h2 id="nx-step-title" class="t-serif">{{ titles[step()] }}</h2>
        <app-error-summary [items]="summary()" />

        @switch (step()) {
          @case (0) {
            <app-caregiver-fields-form [form]="fields" [submitted]="submitted()">
              <app-form-field label="CPF" hint="Protótipo: use um CPF fictício. O sistema recusa números que parecem reais." controlId="nx-cg-cpf" [forceErrors]="submitted()">
                <input appInput appMask="cpf" [formControl]="cpf" />
              </app-form-field>
            </app-caregiver-fields-form>
            @if (duplicate(); as dup) {
              <p class="t-ui" role="status">Já existe um cuidador com este CPF fictício: {{ dup.code }}. <a [routerLink]="['/app/cuidadores', dup.id]">Abrir cadastro</a></p>
            }
            <div class="cluster">
              <button type="button" class="btn btn--sm" (click)="generateCpf()">Gerar CPF fictício</button>
              @if (fill()) {
                <button type="button" class="btn btn--sm" (click)="fillExample()">Preencher com exemplo</button>
              }
            </div>
          }
          @case (1) {
            <div class="form-grid" [formGroup]="elder">
              <app-form-field class="span-2" label="Nome completo da pessoa idosa" controlId="nx-el-name" [forceErrors]="submitted()">
                <input appInput formControlName="fullName" autocomplete="off" />
              </app-form-field>
              <app-form-field label="Data de nascimento" hint="Digite dia, mês e ano." controlId="nx-el-birth" [forceErrors]="submitted()">
                <input appInput appMask="date" formControlName="birthDate" />
              </app-form-field>
              <app-form-field class="span-2" label="Grau de dependência" group controlId="nx-el-dependency" [forceErrors]="submitted()">
                <app-radio-group [options]="dependencyOptions" formControlName="dependency" />
              </app-form-field>
            </div>
            <p class="t-caption">Condições de saúde e medicamentos entram depois do consentimento de saúde, na ficha da pessoa idosa.</p>
          }
          @case (2) {
            <div class="stack stack--6">
              @for (key of consentKeys; track key) {
                <section class="card card--sunken card--pad stack stack--3" [attr.id]="'nx-consent-' + key" [attr.data-key]="key" [attr.aria-label]="labels[key]">
                  <h3>{{ copy[key].question }}</h3>
                  <dl class="dl">
                    <dt>O que vamos fazer</dt><dd>{{ copy[key].what }}</dd>
                    <dt>Por quê</dt><dd>{{ copy[key].why }}</dd>
                    <dt>Se disser não</dt><dd>{{ copy[key].ifNo }}</dd>
                    <dt>Se mudar de ideia</dt><dd>{{ copy[key].change }}</dd>
                  </dl>
                  @if (key === 'health_data') {
                    <p class="t-caption">Sem este consentimento, a escala de Zarit e o atendimento clínico não acontecem, mas o plano Livre e a agenda continuam.</p>
                  } @else if (key === 'image_testimony' || key === 'whatsapp_contact') {
                    <p class="t-caption">Opcional. Recusar não afeta o uso do plano Livre.</p>
                  }
                  <button type="button" class="btn-link" (click)="termKey.set(key)">Ler o termo completo (v{{ termVersion(key) }}, {{ termDate(key) }})</button>
                  <app-radio-group [legend]="labels[key]" [options]="choiceOptions" [value]="choices()[key] ?? null" (valueChange)="setChoice(key, $event)" />
                  @if (submitted() && !choices()[key]) {
                    <span class="field__error" data-role="choice-error"><span class="sr-only">Erro: </span>{{ choiceMissing(key) }}</span>
                  }
                </section>
              }
              <div class="form-grid">
                <div class="field">
                  <label class="field__label" for="nx-consent-channel">Como foi dado o consentimento</label>
                  <select class="select" id="nx-consent-channel" (change)="onChannel($event)">
                    @for (c of channelOptions; track c.value) { <option [value]="c.value" [selected]="channel() === c.value">{{ c.label }}</option> }
                  </select>
                </div>
                <div class="field">
                  <label class="field__label" for="nx-consent-evidence">Evidência <span class="field__opt">(opcional)</span></label>
                  <input class="input" id="nx-consent-evidence" autocomplete="off" [value]="evidence()" (input)="onEvidence($event)" />
                </div>
              </div>
            </div>
          }
          @case (3) {
            <div class="stack stack--3">
              <app-radio-group legend="Plano" [options]="planOptions" [value]="planId()" (valueChange)="setPlan($event)" />
              <p class="t-ui">{{ notice }}</p>
              @if (planId() !== 'livre') {
                <p class="t-ui" role="status">O Cartão Nexus será emitido ao concluir.</p>
              }
            </div>
          }
          @case (4) {
            <div class="stack stack--6" data-role="summary">
              <section class="stack stack--3" aria-label="Cuidador">
                <div class="cluster cluster--between"><h3>Cuidador</h3><button type="button" class="btn btn--sm" (click)="goTo(0)">Editar</button></div>
                <dl class="dl">
                  <dt>Nome</dt><dd class="discreet">{{ fields.controls.fullName.value }}</dd>
                  <dt>CPF</dt><dd>{{ maskedCpf() }}</dd>
                  <dt>Nascimento</dt><dd>{{ date(fields.controls.birthDate.value) }}</dd>
                  <dt>Telefone</dt><dd>{{ fields.controls.phone.value }}</dd>
                  <dt>E-mail</dt><dd>{{ fields.controls.email.value }}</dd>
                  <dt>Horas por dia</dt><dd>{{ fields.controls.dailyCareHours.value }}</dd>
                </dl>
              </section>
              <section class="stack stack--3" aria-label="Pessoa idosa">
                <div class="cluster cluster--between"><h3>Pessoa idosa</h3><button type="button" class="btn btn--sm" (click)="goTo(1)">Editar</button></div>
                <dl class="dl">
                  <dt>Nome</dt><dd class="discreet">{{ elder.controls.fullName.value }}</dd>
                  <dt>Nascimento</dt><dd>{{ date(elder.controls.birthDate.value) }}</dd>
                  <dt>Dependência</dt><dd>{{ dependencyLabel() }}</dd>
                </dl>
              </section>
              <section class="stack stack--3" aria-label="Consentimentos e plano">
                <div class="cluster cluster--between"><h3>Consentimentos e plano</h3><button type="button" class="btn btn--sm" (click)="goTo(2)">Editar</button></div>
                <ul class="stack stack--2 list-reset">
                  @for (key of consentKeys; track key) {
                    <li class="cluster">
                      <app-badge [variant]="choiceOf(key) === 'granted' ? 'success' : choiceOf(key) === 'refused' ? 'neutral' : 'attention'" [outline]="choiceOf(key) === 'refused'" dot>{{ choiceLabel(choiceOf(key)) }}</app-badge>
                      <span>{{ labels[key] }}</span>
                    </li>
                  }
                </ul>
                <p>Plano: <strong>{{ planLabel() }}</strong> <button type="button" class="btn-link" (click)="goTo(3)">Editar</button></p>
              </section>
            </div>
          }
        }

        <div class="form-actions">
          <span class="form-actions__status" aria-live="polite">{{ draftStatus() }}</span>
          @if (step() > 0) {
            <button type="button" class="btn" (click)="back()">Voltar</button>
          }
          @if (step() < 4) {
            <button type="button" class="btn btn--primary" (click)="next()">Continuar</button>
          } @else {
            <button type="button" class="btn btn--primary" [disabled]="busy()" (click)="create()">{{ busy() ? 'Criando...' : 'Criar cadastro' }}</button>
          }
        </div>
        <p class="t-caption"><button type="button" class="btn-link" (click)="discardAndReset()">Descartar rascunho</button></p>
      </section>
    </div>

    <app-drawer [open]="termKey() !== null" (openChange)="$event || termKey.set(null)" [heading]="termTitle()" [subtitle]="'Versão ' + (termKey() ? termVersion(termKey()!) : '')">
      <p>{{ termText() }}</p>
      <ng-container drawerFooter><button type="button" class="btn" (click)="termKey.set(null)">Fechar</button></ng-container>
    </app-drawer>
  `,
})
export class CaregiverNewPage {
  private readonly clock = inject(Clock);
  private readonly db = inject(Database);
  private readonly router = inject(Router);
  private readonly service = inject(CaregiverService);
  private readonly drafts = inject(DraftService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly prefs = inject(UiPrefsService);

  protected readonly titles = STEP_TITLES;
  protected readonly stepLabels = STEP_LABELS;
  protected readonly stepItems = STEP_LABELS.map((label, i) => ({ id: `s${i}`, label }));
  protected readonly consentKeys = CONSENT_KEYS;
  protected readonly labels = CONSENT_LABELS;
  protected readonly copy = CONSENT_COPY;
  protected readonly choiceOptions = CHOICE_OPTIONS;
  protected readonly notice = PLAN_NOT_INCLUDED_NOTICE;
  protected readonly channelOptions: { value: Channel | 'in_person'; label: string }[] = [
    { value: 'in_person', label: 'Presencial' },
    { value: 'phone', label: 'Telefone' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'app', label: 'Aplicativo' },
    { value: 'email', label: 'E-mail' },
  ];
  protected readonly dependencyOptions: RadioOption<Dependency>[] = (['independent', 'partial', 'total'] as Dependency[]).map((value) => ({
    value,
    label: DEPENDENCY_LABELS[value],
    hint: DEPENDENCY_HINTS[value],
  }));
  protected readonly planOptions: RadioOption<PlanId>[] = PLAN_ORDER.map((id) => ({
    value: id,
    label: `${this.db.plans.get(id)?.name ?? id}, ${formatMoney(this.db.plans.get(id)?.monthlyPriceCents ?? 0)}`,
    hint: planBenefits(id)
      .slice(-3)
      .map((b) => BENEFIT_LABELS[b])
      .join(', '),
  }));

  protected readonly step = signal(0);
  protected readonly submitted = signal(false);
  protected readonly summary = signal<ErrorSummaryItem[]>([]);
  protected readonly failure = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly choices = signal<Partial<Record<ConsentKey, Choice>>>({});
  protected readonly channel = signal<Channel | 'in_person'>('in_person');
  protected readonly evidence = signal('');
  protected readonly planId = signal<PlanId>('livre');
  protected readonly termKey = signal<ConsentKey | null>(null);
  protected readonly savedAt = signal<string | null>(null);
  protected readonly pendingDraft = signal<DraftRecord<DraftData> | null>(this.drafts.load<DraftData>(DRAFT_FORM, 'novo'));
  private done = false;

  protected readonly fill = this.prefs.fillWithExample;
  protected readonly fields = caregiverFieldsGroup(() => this.clock.today());
  protected readonly cpf = new FormControl('', {
    nonNullable: true,
    validators: [
      NxValidators.required('o CPF'),
      NxValidators.fictitiousCpf,
      (control): ValidationErrors | null => {
        const other = this.service.findByCpf(String(control.value ?? ''));
        return other ? { duplicate: { message: `Já existe um cuidador com este CPF fictício: ${other.code}.` } } : null;
      },
    ],
  });
  protected readonly elder = new FormGroup({
    fullName: new FormControl('', { nonNullable: true, validators: [NxValidators.required('o nome completo da pessoa idosa'), NxValidators.textLength(3, 120, 'O nome')] }),
    birthDate: new FormControl<string | null>(null, [NxValidators.required('a data de nascimento da pessoa idosa')]),
    dependency: new FormControl<Dependency | null>(null, [NxValidators.required('o grau de dependência')]),
  });

  protected readonly duplicate = computed(() => {
    this.cpfValue();
    return this.service.findByCpf(this.cpf.value);
  });
  private readonly cpfValue = signal('');
  protected readonly draftStatus = computed(() => (this.savedAt() ? `Rascunho salvo às ${formatTime(this.savedAt())}` : ''));
  protected readonly maskedCpf = computed(() => {
    this.cpfValue();
    return maskCpf(this.cpf.value);
  });

  constructor() {
    // Rascunho: a cada mudança de etapa e 2 s depois da última digitação (UX 5.12).
    merge(this.fields.valueChanges, this.elder.valueChanges, this.cpf.valueChanges)
      .pipe(debounceTime(2000), takeUntilDestroyed())
      .subscribe(() => this.saveDraft());
    this.cpf.valueChanges.pipe(takeUntilDestroyed()).subscribe((v) => this.cpfValue.set(v));
    effect(() => {
      this.step();
      untracked(() => this.saveDraft());
    });
  }

  // ===== Rascunho =====

  protected describeDraft(draft: DraftRecord<DraftData>): string {
    return this.drafts.describe(draft);
  }

  private hasContent(): boolean {
    return (
      this.fields.dirty ||
      this.cpf.dirty ||
      this.elder.dirty ||
      Object.keys(this.choices()).length > 0 ||
      this.planId() !== 'livre'
    );
  }

  private saveDraft(): void {
    if (this.done || this.pendingDraft() || !this.hasContent()) {
      return;
    }
    const record = this.drafts.save<DraftData>(DRAFT_FORM, 'novo', {
      step: this.step(),
      fields: this.fields.getRawValue(),
      cpf: this.cpf.value,
      elder: this.elder.getRawValue(),
      choices: this.choices(),
      channel: this.channel(),
      evidence: this.evidence(),
      planId: this.planId(),
    });
    this.savedAt.set(record.savedAt);
  }

  protected resumeDraft(draft: DraftRecord<DraftData>): void {
    const d = draft.data;
    this.fields.patchValue(d.fields as never);
    this.cpf.setValue(d.cpf);
    this.elder.patchValue(d.elder as never);
    this.choices.set(d.choices ?? {});
    this.channel.set(d.channel ?? 'in_person');
    this.evidence.set(d.evidence ?? '');
    this.planId.set(d.planId ?? 'livre');
    this.step.set(Math.min(4, Math.max(0, d.step)));
    this.fields.markAsDirty();
    this.pendingDraft.set(null);
    this.savedAt.set(draft.savedAt);
  }

  protected discardDraft(): void {
    this.drafts.clear(DRAFT_FORM, 'novo');
    this.pendingDraft.set(null);
    this.savedAt.set(null);
  }

  protected discardAndReset(): void {
    this.discardDraft();
    this.fields.reset({ city: 'Uberlândia' });
    this.cpf.reset('');
    this.elder.reset();
    this.choices.set({});
    this.planId.set('livre');
    this.evidence.set('');
    this.channel.set('in_person');
    this.submitted.set(false);
    this.summary.set([]);
    this.step.set(0);
    this.toasts.success('Rascunho descartado.');
  }

  /** Sair no meio: o rascunho já está guardado, então a pergunta é só confirmar a saída. */
  async canLeave(): Promise<boolean> {
    if (this.done || !this.hasContent()) {
      return true;
    }
    this.pendingDraft.set(null);
    this.saveDraft();
    const { confirmed } = await this.dialogs.confirm({
      title: 'Sair do cadastro em andamento?',
      message: 'Você tem um cadastro em andamento.',
      effects: { keep: ['o que você já preencheu, guardado como rascunho para retomar depois'] },
      confirmLabel: 'Guardar rascunho e sair',
      cancelLabel: 'Continuar editando',
    });
    return confirmed;
  }

  // ===== Etapas =====

  protected next(): void {
    this.submitted.set(true);
    const items = this.validateStep(this.step());
    this.summary.set(items);
    if (items.length > 0) {
      return;
    }
    this.submitted.set(false);
    this.step.update((s) => Math.min(4, s + 1));
  }

  protected back(): void {
    this.summary.set([]);
    this.submitted.set(false);
    this.step.update((s) => Math.max(0, s - 1));
  }

  protected goTo(step: number): void {
    this.summary.set([]);
    this.submitted.set(false);
    this.step.set(step);
  }

  private validateStep(step: number): ErrorSummaryItem[] {
    if (step === 0) {
      this.fields.markAllAsTouched();
      this.cpf.markAsTouched();
      this.cpf.updateValueAndValidity();
      return errorItems([
        ...CAREGIVER_FIELD_META.slice(0, 2).map((m) => ({ id: m.id, label: m.label, control: this.fields.controls[m.key] })),
        { id: 'nx-cg-cpf', label: 'CPF', control: this.cpf },
        ...CAREGIVER_FIELD_META.slice(2).map((m) => ({ id: m.id, label: m.label, control: this.fields.controls[m.key] })),
      ]);
    }
    if (step === 1) {
      this.elder.markAllAsTouched();
      return errorItems([
        { id: 'nx-el-name', label: 'Nome da pessoa idosa', control: this.elder.controls.fullName },
        { id: 'nx-el-birth', label: 'Data de nascimento', control: this.elder.controls.birthDate },
        { id: 'nx-el-dependency', label: 'Grau de dependência', control: this.elder.controls.dependency },
      ]);
    }
    if (step === 2) {
      // CX-038: cada consentimento pede uma escolha explícita (concorda, não concorda ou decidir depois).
      return this.consentKeys
        .filter((key) => !this.choices()[key])
        .map((key) => ({ controlId: `nx-consent-${key}`, message: this.choiceMissing(key) }));
    }
    return [];
  }

  // ===== Consentimentos e plano =====

  protected choiceMissing(key: ConsentKey): string {
    return `Escolha uma opção em "${this.labels[key]}": concorda, não concorda ou decidir depois.`;
  }

  protected setChoice(key: ConsentKey, choice: Choice | null): void {
    if (choice === null) {
      return;
    }
    this.choices.update((c) => ({ ...c, [key]: choice }));
    this.saveDraft();
  }

  protected choiceOf(key: ConsentKey): Choice {
    return this.choices()[key] ?? 'pending';
  }

  protected choiceLabel(choice: Choice): string {
    return CHOICE_LABEL[choice];
  }

  protected setPlan(plan: PlanId | null): void {
    this.planId.set(plan ?? 'livre');
    this.saveDraft();
  }

  protected onChannel(event: Event): void {
    this.channel.set((event.target as HTMLSelectElement).value as Channel | 'in_person');
  }

  protected onEvidence(event: Event): void {
    this.evidence.set((event.target as HTMLInputElement).value);
  }

  protected termVersion(key: ConsentKey): string {
    return this.db.consentTerms.find((t) => t.key === key && t.active)?.version ?? '1.0';
  }

  protected termDate(key: ConsentKey): string {
    return formatDate(this.db.consentTerms.find((t) => t.key === key && t.active)?.publishedAt);
  }

  protected termTitle(): string {
    const key = this.termKey();
    return key ? (this.db.consentTerms.find((t) => t.key === key && t.active)?.title ?? CONSENT_LABELS[key]) : 'Termo';
  }

  protected termText(): string {
    const key = this.termKey();
    return key ? (this.db.consentTerms.find((t) => t.key === key && t.active)?.text ?? '') : '';
  }

  protected planLabel(): string {
    return `${this.db.plans.get(this.planId())?.name ?? this.planId()}, ${formatMoney(this.db.plans.get(this.planId())?.monthlyPriceCents ?? 0)}`;
  }

  protected dependencyLabel(): string {
    const d = this.elder.controls.dependency.value;
    return d ? DEPENDENCY_LABELS[d] : '';
  }

  protected date(value: string | null): string {
    return formatDate(value);
  }

  // ===== Exemplo e CPF =====

  protected generateCpf(): void {
    let n = Number(this.service.nextIdentity().code.slice(4)) + 500;
    while (this.service.findByCpf(generateFictitiousCpf(n))) {
      n += 1;
    }
    this.cpf.setValue(generateFictitiousCpf(n));
    this.cpf.markAsDirty();
  }

  protected fillExample(): void {
    const n = Number(this.service.nextIdentity().code.slice(4));
    const today = this.clock.today();
    this.fields.patchValue({
      fullName: `Cuidadora Exemplo ${n}`,
      birthDate: addYears(today, -45),
      email: `exemplo.${n}@exemplo.com.br`,
      phone: generateFictitiousPhone(n),
      relationship: 'daughter' as Relationship,
      sex: 'female' as Sex,
      city: 'Uberlândia',
      dailyCareHours: 6,
      preferredChannel: 'app' as Channel,
      digitalLiteracy: 'medium' as Literacy,
    });
    this.fields.markAsDirty();
    this.generateCpf();
    this.elder.patchValue({ fullName: `Pessoa Idosa Exemplo ${n}`, birthDate: addYears(today, -80), dependency: 'partial' });
    this.elder.markAsDirty();
    this.summary.set([]);
    this.toasts.success('Exemplo preenchido com dados fictícios.');
  }

  // ===== Criar =====

  protected create(): void {
    if (this.busy()) {
      return;
    }
    this.submitted.set(true);
    const problems = [...this.validateStep(0), ...this.validateStep(1)];
    if (problems.length > 0) {
      this.summary.set(problems);
      this.step.set(this.validateStep(0).length > 0 ? 0 : 1);
      return;
    }
    this.busy.set(true);
    try {
      const v = this.fields.getRawValue();
      const e = this.elder.getRawValue();
      const consents: Partial<Record<ConsentKey, 'granted' | 'refused'>> = {};
      CONSENT_KEYS.forEach((key) => {
        const c = this.choices()[key];
        if (c === 'granted' || c === 'refused') {
          consents[key] = c;
        }
      });
      const { caregiver } = this.service.create({
        fullName: v.fullName,
        birthDate: v.birthDate as string,
        cpf: this.cpf.value,
        email: v.email,
        phone: v.phone,
        ...(v.whatsapp ? { whatsapp: v.whatsapp } : {}),
        relationship: v.relationship as Relationship,
        sex: v.sex as Sex,
        city: v.city,
        dailyCareHours: v.dailyCareHours as number,
        preferredChannel: v.preferredChannel as Channel,
        digitalLiteracy: v.digitalLiteracy as Literacy,
        elder: { fullName: e.fullName, birthDate: e.birthDate as string, dependency: e.dependency as Dependency },
        consents,
        consentChannel: this.channel(),
        ...(this.evidence().trim() ? { evidence: this.evidence() } : {}),
        planId: this.planId(),
      });
      this.done = true;
      this.drafts.clear(DRAFT_FORM, 'novo');
      void this.router.navigate(['/app/cuidadores', caregiver.id], { queryParams: { novo: 1 } });
    } catch (error) {
      this.failure.set(error instanceof CaregiverError ? error.message : 'Não foi possível salvar. Tente de novo; se continuar, avise a equipe.');
    } finally {
      this.busy.set(false);
    }
  }
}

