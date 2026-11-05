import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CaregiverError } from '../../../../core/care/caregiver-registration.service';
import { Clock } from '../../../../core/clock/clock.service';
import { formatDate, formatTime } from '../../../../core/format';
import type { Channel, ConsentKey, Dependency, Relationship } from '../../../../core/models';
import { validateFictitiousPhone } from '../../../../core/rules/validators';
import { StepItem, StepperComponent } from '../../../../shared/ui/display/stepper.component';
import { CONSENT_COPY } from '../../../../shared/ui/forms/consent-copy';
import { CheckboxComponent } from '../../../../shared/ui/forms/checkbox.component';
import { DraftRecord, DraftService } from '../../../../shared/ui/forms/draft.service';
import { ErrorSummaryComponent, ErrorSummaryItem } from '../../../../shared/ui/forms/error-summary.component';
import { NxValidators } from '../../../../shared/ui/forms/form-errors';
import { FormFieldComponent } from '../../../../shared/ui/forms/form-field.component';
import { NxInputDirective } from '../../../../shared/ui/forms/input.directive';
import { NxMaskDirective } from '../../../../shared/ui/forms/mask.directive';
import { CaregiverContextService } from '../../state/caregiver-context.service';
import { CgCardComponent } from '../../ui/cg-card.component';
import { CgChoiceGroupComponent } from '../../ui/cg-choice-group.component';
import { CgEmergencyNoteComponent } from '../../ui/cg-emergency-note.component';
import { CgNoteComponent } from '../../ui/cg-note.component';
import { CgPageHeaderComponent } from '../../ui/cg-page-header.component';
import { CgRowComponent } from '../../ui/cg-row.component';
import { CgTextSizeComponent } from '../../ui/cg-text-size.component';
import { BannerComponent } from '../../../../shared/ui/overlay/banner.component';
import { PROTOTYPE_NOTICE } from '../../../../core/privacy/browser-data.service';
import {
  CHANNEL_CHOICES,
  DEFAULT_CITY,
  DEPENDENCY_CHOICES,
  ELDER_VALIDATORS,
  HOURS_VALIDATORS,
  RELATIONSHIP_OPTIONS,
  YOU_VALIDATORS,
  channelLabel,
  dependencyLabel,
  relationshipLabel,
  summaryOf,
} from '../state/start-fields';
import { ConsentChoice, SIGNUP_CONSENTS, SignupData, SignupService } from '../state/signup.service';

type Phase = 'welcome' | 'step' | 'done';

const DRAFT_FORM = 'caregiver-start';
const DRAFT_ID = 'novo';

const STEPS: readonly StepItem[] = [
  { id: 'you', label: 'Sobre você' },
  { id: 'elder', label: 'Quem você cuida' },
  { id: 'daily', label: 'Seu dia a dia' },
  { id: 'consents', label: 'O que você autoriza' },
  { id: 'review', label: 'Confira e termine' },
];
const LAST_STEP = STEPS.length - 1;

/** Nome curto de cada autorização, para a legenda da resposta e para o resumo. */
const CONSENT_SHORT: Readonly<Partial<Record<ConsentKey, string>>> = {
  health_data: 'Dados de saúde',
  people_analytics: 'Números somados',
  family_sharing: 'Família',
  image_testimony: 'Imagem e depoimento',
  whatsapp_contact: 'WhatsApp',
};

const CHOICE_OPTIONS = [
  { value: 'granted' as ConsentChoice, label: 'Concordo' },
  { value: 'refused' as ConsentChoice, label: 'Não concordo' },
  { value: 'pending' as ConsentChoice, label: 'Decidir depois' },
];
const CHOICE_TEXT: Readonly<Record<ConsentChoice, string>> = {
  granted: 'Concordo',
  refused: 'Não concordo',
  pending: 'Decidir depois',
};

const HEALTH_REFUSED_NOTE =
  'Tudo bem. A agenda, os remédios e os conteúdos continuam. A conversa de acompanhamento só acontece com a sua autorização.';
const SAVE_FAILED = 'Não foi possível salvar. Tente de novo; se continuar, fale com a gente.';

/** Escolha obrigatória (cartões e lista): a frase diz o que escolher. */
const chosen =
  (message: string): ValidatorFn =>
  (control: AbstractControl): ValidationErrors | null =>
    control.value === null || control.value === '' ? { required: { message } } : null;

interface Draft {
  step: number;
  you: { fullName: string; birthDate: string; cpf: string; phone: string; email: string; city: string };
  elder: { fullName: string; birthDate: string; relationship: Relationship | null; dependency: Dependency | null };
  daily: { hours: number | null; channel: Channel | null; whatsapp: string };
  choices: Partial<Record<ConsentKey, ConsentChoice>>;
}

/**
 * Começar (UX C2, `/cuidador/comecar`): o cadastro de quem é novo, em 5 etapas curtas que se podem pausar. Abre sem
 * sessão, em modo foco (cabeçalho com "Ajuda agora", sem barra inferior). Boas-vindas, depois as etapas Sobre você,
 * Quem você cuida, Seu dia a dia, O que você autoriza e Confira e termine, e a tela "Tudo pronto". Uma pergunta por
 * assunto; nada de condição de saúde nem de remédio (RN-USR-09); nada de cartão nem pagamento (o plano Livre não
 * custa nada). O rascunho é guardado a cada etapa. Os 5 consentimentos são independentes e nada vem marcado: quem
 * não escolhe fica em "Decidir depois". Criar a conta usa o miolo do núcleo (o mesmo do "Novo cuidador" da equipe),
 * então a pessoa aparece na lista do ERP, e entra com a conta nova.
 */
@Component({
  selector: 'app-start-page',
  imports: [
    BannerComponent,
    CgCardComponent,
    CgChoiceGroupComponent,
    CgEmergencyNoteComponent,
    CgNoteComponent,
    CgPageHeaderComponent,
    CgRowComponent,
    CgTextSizeComponent,
    CheckboxComponent,
    ErrorSummaryComponent,
    FormFieldComponent,
    NxInputDirective,
    NxMaskDirective,
    ReactiveFormsModule,
    RouterLink,
    StepperComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .start-flow {
      display: grid;
      gap: var(--cg-gap-block);
      grid-template-columns: minmax(0, 1fr);
    }
    .start-flow .cg-actions {
      margin-top: 0;
    }
    .start-fields {
      display: grid;
      gap: 1.25rem;
    }
    .start-list {
      display: grid;
      gap: 0.75rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .start-list li {
      display: flex;
      gap: 0.75rem;
      align-items: flex-start;
    }
    .start-lead {
      margin: 0;
      color: var(--cg-text-soft);
    }
    .start-p {
      margin: 0;
    }
    .start-actions-inline {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem 1rem;
    }
    .start-bar.cg-action-bar {
      bottom: 0;
    }
    .start-status {
      margin: 0;
      color: var(--cg-text-soft);
      font-size: var(--cg-fs-caption);
    }
    .start-pair {
      display: grid;
      gap: 0.75rem;
    }
    .start-pair .btn {
      width: 100%;
    }
    @media (min-width: 48rem) {
      .start-pair {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    .start-hours {
      display: flex;
      align-items: flex-end;
      gap: 0.75rem;
    }
    .start-hours app-form-field {
      flex: 1 1 8rem;
    }
    .start-hours .btn {
      min-width: var(--cg-target-lg);
      padding-inline: 0;
    }
    .start-dl {
      display: grid;
      gap: 0.25rem 1rem;
      margin: 0;
    }
    .start-dl dt {
      color: var(--cg-text-soft);
      font-size: var(--cg-fs-small);
    }
    .start-dl dd {
      margin: 0 0 0.5rem;
      overflow-wrap: anywhere;
    }
    .start-consent {
      display: grid;
      gap: 0.75rem;
    }
    .start-consent h3 {
      margin: 0;
      font-size: var(--cg-fs-lead);
    }
    .start-error {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      margin: 0;
      color: var(--cg-error-fg);
      font-size: var(--cg-fs-small);
    }
    .start-select {
      width: 100%;
    }
  `,
  template: `
    <app-cg-page-header [title]="title()" />
    <p class="sr-only" aria-live="polite">{{ announcement() }}</p>

    <div class="start-flow cg-reading">
      @switch (phase()) {
        @case ('welcome') {
          <app-banner variant="prototype">{{ prototypeNotice }}</app-banner>

          @if (pendingDraft(); as draft) {
            <app-cg-note variant="info" heading="Você tem um cadastro em andamento">
              Retomar ou começar de novo? O rascunho foi guardado {{ describeDraft(draft) }}.
            </app-cg-note>
            <div class="start-pair">
              <button type="button" class="btn" (click)="resume(draft)">Retomar</button>
              <button type="button" class="btn" (click)="startOver()">Começar de novo</button>
            </div>
          }

          <ul class="start-list">
            <li>Leva uns 5 minutos. Você pode parar e continuar depois.</li>
            <li>Você escolhe o que autoriza e pode mudar quando quiser.</li>
            <li>O plano Livre não custa nada e não pede cartão.</li>
          </ul>

          <div class="cg-actions">
            <button type="button" class="btn btn--primary" (click)="begin()">Começar</button>
            <a class="cg-link-btn" routerLink="/login">Já tenho conta</a>
          </div>
        }

        @case ('step') {
          <app-stepper label="Etapas do cadastro" [steps]="steps" [current]="step()" />
          <app-error-summary [items]="errors()" />
          @if (failure(); as text) {
            <app-cg-note variant="error">{{ text }}</app-cg-note>
          }

          @switch (step()) {
            @case (0) {
              <div class="start-fields" [formGroup]="you">
                <div class="start-actions-inline">
                  <button type="button" class="cg-link-btn" (click)="fillExample()">Preencher com dados de exemplo</button>
                </div>
                <app-form-field label="Nome completo" controlId="st-name" [forceErrors]="submitted()">
                  <input appInput formControlName="fullName" autocomplete="name" />
                </app-form-field>
                <app-form-field label="Data de nascimento" controlId="st-birth" [forceErrors]="submitted()">
                  <input appInput type="date" formControlName="birthDate" autocomplete="bday" />
                </app-form-field>
                <app-form-field label="CPF" hint="Protótipo: use um CPF fictício." controlId="st-cpf" [forceErrors]="submitted()">
                  <input appInput appMask="cpf" formControlName="cpf" />
                </app-form-field>
                <div class="start-actions-inline">
                  <button type="button" class="btn" (click)="generateCpf()">Gerar CPF fictício</button>
                </div>
                <app-form-field label="Celular" hint="Exemplo: (34) 90000-0000" controlId="st-phone" [forceErrors]="submitted()">
                  <input appInput appMask="phone" formControlName="phone" />
                </app-form-field>
                <app-form-field
                  label="E-mail"
                  hint="Use um e-mail que termine em @exemplo.com.br"
                  controlId="st-email"
                  [forceErrors]="submitted()"
                >
                  <input appInput type="email" formControlName="email" autocomplete="email" inputmode="email" />
                </app-form-field>
                <app-form-field label="Cidade" controlId="st-city" [forceErrors]="submitted()">
                  <input appInput formControlName="city" autocomplete="address-level2" />
                </app-form-field>
              </div>
            }

            @case (1) {
              <div class="start-fields" [formGroup]="elder">
                <app-form-field label="Nome da pessoa idosa" controlId="st-elder-name" [forceErrors]="submitted()">
                  <input appInput formControlName="fullName" autocomplete="off" />
                </app-form-field>
                <app-form-field label="Data de nascimento dela" controlId="st-elder-birth" [forceErrors]="submitted()">
                  <input appInput type="date" formControlName="birthDate" autocomplete="off" />
                </app-form-field>
                <app-form-field label="Quem é essa pessoa para você?" controlId="st-relationship" [forceErrors]="submitted()">
                  <select appInput class="start-select" formControlName="relationship">
                    <option [ngValue]="null">Escolha uma opção</option>
                    @for (option of relationshipOptions; track option.value) {
                      <option [ngValue]="option.value">{{ option.label }}</option>
                    }
                  </select>
                </app-form-field>
                <div id="st-dependency">
                  <app-cg-choice-group
                    legend="Como está a rotina dela?"
                    [options]="dependencyChoices"
                    [value]="elder.controls.dependency.value"
                    (valueChange)="elder.controls.dependency.setValue($event)"
                  />
                  @if (submitted() && elder.controls.dependency.invalid) {
                    <p class="start-error"><span class="sr-only">Erro: </span>Escolha como está a rotina dela.</p>
                  }
                </div>
                <p class="start-lead">Os remédios você cadastra depois, em Rotina.</p>
              </div>
            }

            @case (2) {
              <div class="start-fields" [formGroup]="daily">
                <div class="start-hours">
                  <button type="button" class="btn" aria-label="Menos uma hora por dia" (click)="stepHours(-1)">&minus;</button>
                  <app-form-field
                    label="Quantas horas por dia você dedica ao cuidado?"
                    hint="Pode mudar depois."
                    controlId="st-hours"
                    [forceErrors]="submitted()"
                  >
                    <input appInput type="number" inputmode="numeric" formControlName="hours" min="0" max="24" />
                  </app-form-field>
                  <button type="button" class="btn" aria-label="Mais uma hora por dia" (click)="stepHours(1)">+</button>
                </div>
                <div id="st-channel">
                  <app-cg-choice-group
                    legend="Como você prefere que a gente fale com você?"
                    [options]="channelChoices"
                    [value]="daily.controls.channel.value"
                    (valueChange)="chooseChannel($event)"
                  />
                  @if (submitted() && daily.controls.channel.invalid) {
                    <p class="start-error"><span class="sr-only">Erro: </span>Escolha como você prefere que a gente fale com você.</p>
                  }
                </div>
                @if (daily.controls.channel.value === 'whatsapp') {
                  <app-form-field label="Número do WhatsApp" controlId="st-whatsapp" [forceErrors]="submitted()">
                    <input appInput appMask="phone" formControlName="whatsapp" />
                  </app-form-field>
                }
                <div>
                  <h2 class="cg-section__title">Tamanho da letra</h2>
                  <app-cg-text-size />
                </div>
              </div>
            }

            @case (3) {
              <p class="start-lead">
                Você escolhe cada item separado. Pode mudar quando quiser, em Mais, Privacidade e meus dados. O plano Livre
                continua em qualquer caso.
              </p>
              @for (key of consentKeys; track key) {
                <app-cg-card [title]="copy[key].question" [variant]="key === 'health_data' ? 'care' : 'default'" [attr.data-consent]="key">
                  <div class="start-consent">
                    @if (key === 'health_data' || expanded().has(key)) {
                      <dl class="start-dl">
                        <dt>O que vamos fazer</dt>
                        <dd>{{ copy[key].what }}</dd>
                        <dt>Por quê</dt>
                        <dd>{{ copy[key].why }}</dd>
                        <dt>Quem vê</dt>
                        <dd>{{ copy[key].who }}</dd>
                        <dt>Se você disser não</dt>
                        <dd>{{ copy[key].ifNo }}</dd>
                        <dt>Se mudar de ideia</dt>
                        <dd>{{ copy[key].change }}</dd>
                      </dl>
                    }
                    @if (key === 'whatsapp_contact' && daily.controls.channel.value === 'whatsapp') {
                      <p class="start-p">
                        Você escolheu o WhatsApp como o jeito de falarmos com você. Sem esta autorização, falamos pelo aplicativo.
                      </p>
                    }
                    <app-cg-choice-group
                      [legend]="'Sua resposta: ' + short[key]"
                      [options]="choiceOptions"
                      [value]="choices()[key] ?? null"
                      (valueChange)="setChoice(key, $event)"
                    />
                    @if (key !== 'health_data') {
                      <div class="start-actions-inline">
                        <button
                          type="button"
                          class="cg-link-btn"
                          [attr.aria-expanded]="expanded().has(key)"
                          (click)="toggleMore(key)"
                        >
                          {{ expanded().has(key) ? 'Ler menos' : 'Ler mais' }}
                        </button>
                      </div>
                    }
                  </div>
                </app-cg-card>
                @if (key === 'health_data' && (choices().health_data === 'refused' || choices().health_data === 'pending')) {
                  <app-cg-note variant="info">{{ healthNote }}</app-cg-note>
                }
              }
            }

            @case (4) {
              <app-cg-card title="Você">
                <dl class="start-dl">
                  <dt>Nome</dt>
                  <dd>{{ you.controls.fullName.value }}</dd>
                  <dt>Nascimento</dt>
                  <dd>{{ date(you.controls.birthDate.value) }}</dd>
                  <dt>CPF</dt>
                  <dd>{{ you.controls.cpf.value }}</dd>
                  <dt>Celular</dt>
                  <dd>{{ you.controls.phone.value }}</dd>
                  <dt>E-mail</dt>
                  <dd>{{ you.controls.email.value }}</dd>
                  <dt>Cidade</dt>
                  <dd>{{ you.controls.city.value }}</dd>
                </dl>
                <button cgCardFooter type="button" class="cg-link-btn" (click)="goTo(0)">Editar<span class="sr-only"> os seus dados</span></button>
              </app-cg-card>
              <app-cg-card title="Quem você cuida">
                <dl class="start-dl">
                  <dt>Nome</dt>
                  <dd>{{ elder.controls.fullName.value }}</dd>
                  <dt>Nascimento</dt>
                  <dd>{{ date(elder.controls.birthDate.value) }}</dd>
                  <dt>Quem é para você</dt>
                  <dd>{{ relationshipText() }}</dd>
                  <dt>Rotina</dt>
                  <dd>{{ dependencyText() }}</dd>
                </dl>
                <button cgCardFooter type="button" class="cg-link-btn" (click)="goTo(1)">Editar<span class="sr-only"> quem você cuida</span></button>
              </app-cg-card>
              <app-cg-card title="Seu dia a dia">
                <dl class="start-dl">
                  <dt>Horas por dia</dt>
                  <dd>{{ daily.controls.hours.value }}</dd>
                  <dt>Como falamos com você</dt>
                  <dd>{{ channelText() }}</dd>
                  @if (daily.controls.channel.value === 'whatsapp') {
                    <dt>WhatsApp</dt>
                    <dd>{{ daily.controls.whatsapp.value }}</dd>
                  }
                </dl>
                <button cgCardFooter type="button" class="cg-link-btn" (click)="goTo(2)">Editar<span class="sr-only"> o seu dia a dia</span></button>
              </app-cg-card>
              <app-cg-card title="O que você autoriza">
                <dl class="start-dl">
                  @for (key of consentKeys; track key) {
                    <dt>{{ short[key] }}</dt>
                    <dd>{{ choiceText(key) }}</dd>
                  }
                </dl>
                <button cgCardFooter type="button" class="cg-link-btn" (click)="goTo(3)">Editar<span class="sr-only"> o que você autoriza</span></button>
              </app-cg-card>

              <app-cg-emergency-note />
              <div id="st-notice">
                <app-checkbox [checked]="noticeAccepted()" (checkedChange)="noticeAccepted.set($event)">
                  Li e entendi o aviso de emergência e dos canais.
                </app-checkbox>
                @if (noticeMissing()) {
                  <p class="start-error"><span class="sr-only">Erro: </span>Marque que você leu o aviso para criar a conta.</p>
                }
              </div>
            }
          }

          <div class="cg-action-bar start-bar">
            @if (step() < lastStep) {
              <button type="button" class="btn btn--primary" (click)="next()">Continuar</button>
            } @else {
              <button type="button" class="btn btn--primary" (click)="create()">Criar minha conta</button>
            }
            @if (step() > 0) {
              <button type="button" class="cg-link-btn" (click)="back()">Voltar</button>
            }
            @if (savedAt(); as saved) {
              <p class="start-status" role="status">Rascunho salvo às {{ time(saved) }}</p>
            }
          </div>
        }

        @case ('done') {
          <p class="start-lead">Sua conta no plano Livre está criada.</p>
          @if (healthChoice() === 'granted') {
            <app-cg-note variant="care">
              Se você autorizou o acompanhamento, a equipe de psicologia entra em contato para uma primeira conversa.
            </app-cg-note>
          } @else {
            <app-cg-note variant="info">{{ healthNote }}</app-cg-note>
          }
          <ul class="cg-list">
            <li><app-cg-row title="Cadastrar os remédios" icon="pill" link="/cuidador/rotina/remedios" /></li>
            <li><app-cg-row title="Adicionar um compromisso" icon="calendar" link="/cuidador/rotina/agenda" /></li>
            <li><app-cg-row title="Conhecer o Cuidar de mim" icon="hand-heart" link="/cuidador/cuidar-de-mim" /></li>
          </ul>
          <div class="cg-actions">
            <a class="btn btn--primary" routerLink="/cuidador/hoje">Ir para Hoje</a>
          </div>
        }
      }
    </div>
  `,
})
export class StartPage {
  private readonly ctx = inject(CaregiverContextService);
  private readonly clock = inject(Clock);
  private readonly drafts = inject(DraftService);
  private readonly signup = inject(SignupService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly steps = STEPS;
  protected readonly lastStep = LAST_STEP;
  protected readonly relationshipOptions = RELATIONSHIP_OPTIONS;
  protected readonly dependencyChoices = DEPENDENCY_CHOICES;
  protected readonly channelChoices = CHANNEL_CHOICES;
  protected readonly choiceOptions = CHOICE_OPTIONS;
  protected readonly consentKeys = SIGNUP_CONSENTS;
  protected readonly copy = CONSENT_COPY;
  protected readonly short = CONSENT_SHORT as Readonly<Record<ConsentKey, string>>;
  protected readonly healthNote = HEALTH_REFUSED_NOTE;
  protected readonly prototypeNotice = PROTOTYPE_NOTICE;

  protected readonly phase = signal<Phase>('welcome');
  protected readonly step = signal(0);
  protected readonly submitted = signal(false);
  protected readonly errors = signal<ErrorSummaryItem[]>([]);
  protected readonly failure = signal<string | null>(null);
  protected readonly choices = signal<Partial<Record<ConsentKey, ConsentChoice>>>({});
  protected readonly expanded = signal<ReadonlySet<ConsentKey>>(new Set());
  protected readonly noticeAccepted = signal(false);
  protected readonly noticeMissing = signal(false);
  protected readonly savedAt = signal<string | null>(null);
  protected readonly pendingDraft = signal<DraftRecord<Draft> | null>(this.loadDraft());
  private readonly createdName = signal('');

  private readonly today = (): string => this.clock.today();

  protected readonly you = new FormGroup({
    fullName: new FormControl('', { nonNullable: true, validators: YOU_VALIDATORS.fullName }),
    birthDate: new FormControl('', { nonNullable: true, validators: YOU_VALIDATORS.birthDate(this.today) }),
    cpf: new FormControl('', {
      nonNullable: true,
      validators: [
        NxValidators.required('o CPF'),
        NxValidators.fictitiousCpf,
        (control: AbstractControl): ValidationErrors | null =>
          this.signup.cpfTaken(String(control.value ?? ''))
            ? { duplicate: { message: 'Já existe uma conta com este CPF fictício. Gere outro.' } }
            : null,
      ],
    }),
    phone: new FormControl('', { nonNullable: true, validators: YOU_VALIDATORS.phone }),
    email: new FormControl('', { nonNullable: true, validators: YOU_VALIDATORS.email }),
    city: new FormControl(DEFAULT_CITY, { nonNullable: true, validators: YOU_VALIDATORS.city }),
  });

  protected readonly elder = new FormGroup({
    fullName: new FormControl('', { nonNullable: true, validators: ELDER_VALIDATORS.fullName }),
    birthDate: new FormControl('', { nonNullable: true, validators: ELDER_VALIDATORS.birthDate(this.today) }),
    relationship: new FormControl<Relationship | null>(null, [chosen('Escolha quem é essa pessoa para você.')]),
    dependency: new FormControl<Dependency | null>(null, [chosen('Escolha como está a rotina dela.')]),
  });

  protected readonly daily = new FormGroup({
    hours: new FormControl<number | null>(null, HOURS_VALIDATORS),
    channel: new FormControl<Channel | null>(null, [chosen('Escolha como você prefere que a gente fale com você.')]),
    whatsapp: new FormControl('', {
      nonNullable: true,
      validators: [
        (control: AbstractControl): ValidationErrors | null => {
          if (this.daily?.controls.channel.value !== 'whatsapp') {
            return null;
          }
          const value = String(control.value ?? '');
          if (value === '') {
            return { required: { message: 'Informe o número do WhatsApp.' } };
          }
          return value.length < 14 || validateFictitiousPhone(value).valid
            ? null
            : { phone: { message: 'O telefone deve ter o formato (34) 90000-0000.' } };
        },
      ],
    }),
  });

  protected readonly title = computed(() => {
    const phase = this.phase();
    if (phase === 'welcome') {
      return 'Vamos começar';
    }
    if (phase === 'done') {
      return `Tudo pronto, ${this.createdName()}.`;
    }
    return STEPS[this.step()]?.label ?? '';
  });
  protected readonly announcement = computed(() =>
    this.phase() === 'step' ? `Etapa ${this.step() + 1} de ${STEPS.length}` : '',
  );
  protected readonly healthChoice = computed(() => this.choices().health_data ?? 'pending');

  constructor() {
    // Quem já tem conta não precisa se cadastrar: vai a Hoje (decisão 1 da Base, doc 11 seção 14).
    if (this.ctx.isSignedIn()) {
      void this.router.navigateByUrl('/cuidador/hoje', { replaceUrl: true });
    }
    // Ao escolher WhatsApp, o número já vem preenchido com o celular (editável).
    this.daily.controls.channel.valueChanges.subscribe((channel) => {
      if (channel === 'whatsapp' && this.daily.controls.whatsapp.value === '') {
        this.daily.controls.whatsapp.setValue(this.you.controls.phone.value);
      }
      this.daily.controls.whatsapp.updateValueAndValidity();
    });
  }

  // ===== Boas-vindas e rascunho =====

  private loadDraft(): DraftRecord<Draft> | null {
    const draft = this.drafts.load<Draft>(DRAFT_FORM, DRAFT_ID);
    return draft && draft.data ? draft : null;
  }

  protected describeDraft(draft: DraftRecord<Draft>): string {
    return this.drafts.describe(draft);
  }

  protected time(at: string): string {
    return formatTime(at);
  }

  protected date(iso: string | null): string {
    return iso ? formatDate(iso) : '';
  }

  protected begin(): void {
    this.phase.set('step');
    this.step.set(0);
    this.focusTitle();
  }

  protected resume(draft: DraftRecord<Draft>): void {
    const d = draft.data;
    this.you.patchValue(d.you);
    this.elder.patchValue(d.elder);
    this.daily.patchValue({ hours: d.daily.hours, channel: d.daily.channel, whatsapp: d.daily.whatsapp });
    this.choices.set(d.choices ?? {});
    this.pendingDraft.set(null);
    this.savedAt.set(draft.savedAt);
    this.phase.set('step');
    this.step.set(Math.min(LAST_STEP, Math.max(0, d.step)));
    this.focusTitle();
  }

  protected startOver(): void {
    this.drafts.clear(DRAFT_FORM, DRAFT_ID);
    this.pendingDraft.set(null);
    this.savedAt.set(null);
  }

  private saveDraft(): void {
    const draft: Draft = {
      step: this.step(),
      you: this.you.getRawValue(),
      elder: this.elder.getRawValue(),
      daily: this.daily.getRawValue(),
      choices: this.choices(),
    };
    this.savedAt.set(this.drafts.save(DRAFT_FORM, DRAFT_ID, draft).savedAt);
  }

  // ===== Etapas =====

  protected fillExample(): void {
    const example = this.signup.example();
    this.you.patchValue({
      fullName: example.fullName,
      birthDate: example.birthDate,
      cpf: example.cpf,
      phone: example.phone,
      email: example.email,
      city: example.city,
    });
    this.elder.patchValue({
      fullName: example.elderName,
      birthDate: example.elderBirthDate,
      relationship: example.relationship,
      dependency: example.dependency,
    });
    this.daily.patchValue({ hours: example.hours, channel: example.channel });
    this.errors.set([]);
  }

  protected generateCpf(): void {
    this.you.controls.cpf.setValue(this.signup.freeCpf());
    this.you.controls.cpf.markAsTouched();
  }

  protected stepHours(delta: number): void {
    const current = this.daily.controls.hours.value ?? 0;
    this.daily.controls.hours.setValue(Math.min(24, Math.max(0, current + delta)));
    this.daily.controls.hours.markAsDirty();
  }

  protected chooseChannel(channel: Channel | null): void {
    this.daily.controls.channel.setValue(channel);
    this.daily.controls.channel.markAsDirty();
  }

  protected setChoice(key: ConsentKey, choice: ConsentChoice | null): void {
    if (choice) {
      this.choices.update((current) => ({ ...current, [key]: choice }));
    }
  }

  protected toggleMore(key: ConsentKey): void {
    this.expanded.update((current) => {
      const next = new Set(current);
      if (!next.delete(key)) {
        next.add(key);
      }
      return next;
    });
  }

  /** Os campos de cada etapa, para o resumo de erros apontar para o campo certo. */
  private stepEntries(step: number): { id: string; label: string; control: AbstractControl }[] {
    switch (step) {
      case 0:
        return [
          { id: 'st-name', label: 'Nome completo', control: this.you.controls.fullName },
          { id: 'st-birth', label: 'Data de nascimento', control: this.you.controls.birthDate },
          { id: 'st-cpf', label: 'CPF', control: this.you.controls.cpf },
          { id: 'st-phone', label: 'Celular', control: this.you.controls.phone },
          { id: 'st-email', label: 'E-mail', control: this.you.controls.email },
          { id: 'st-city', label: 'Cidade', control: this.you.controls.city },
        ];
      case 1:
        return [
          { id: 'st-elder-name', label: 'Nome da pessoa idosa', control: this.elder.controls.fullName },
          { id: 'st-elder-birth', label: 'Data de nascimento dela', control: this.elder.controls.birthDate },
          { id: 'st-relationship', label: 'Quem é essa pessoa para você', control: this.elder.controls.relationship },
          { id: 'st-dependency', label: 'Como está a rotina dela', control: this.elder.controls.dependency },
        ];
      case 2:
        return [
          { id: 'st-hours', label: 'Horas por dia', control: this.daily.controls.hours },
          { id: 'st-channel', label: 'Como falamos com você', control: this.daily.controls.channel },
          { id: 'st-whatsapp', label: 'Número do WhatsApp', control: this.daily.controls.whatsapp },
        ];
      default:
        return [];
    }
  }

  /** Confere a etapa: mostra os erros junto do campo e no resumo, sem apagar nada. `true` se pode seguir. */
  private validateStep(step: number): boolean {
    const entries = this.stepEntries(step);
    entries.forEach((e) => {
      e.control.markAsTouched();
      e.control.updateValueAndValidity();
    });
    this.submitted.set(true);
    const items = summaryOf(entries);
    this.errors.set(items);
    return items.length === 0;
  }

  protected next(): void {
    this.failure.set(null);
    if (!this.validateStep(this.step())) {
      return;
    }
    this.moveTo(this.step() + 1);
  }

  protected back(): void {
    this.failure.set(null);
    this.moveTo(this.step() - 1);
  }

  protected goTo(step: number): void {
    this.failure.set(null);
    this.moveTo(step);
  }

  private moveTo(step: number): void {
    this.step.set(Math.min(LAST_STEP, Math.max(0, step)));
    this.submitted.set(false);
    this.errors.set([]);
    this.noticeMissing.set(false);
    this.saveDraft();
    this.focusTitle();
  }

  // ===== Resumo =====

  protected relationshipText(): string {
    const value = this.elder.controls.relationship.value;
    return value ? relationshipLabel(value) : '';
  }

  protected dependencyText(): string {
    const value = this.elder.controls.dependency.value;
    return value ? dependencyLabel(value) : '';
  }

  protected channelText(): string {
    const value = this.daily.controls.channel.value;
    return value ? channelLabel(value) : '';
  }

  /** O que a pessoa respondeu em cada autorização ("Decidir depois" para quem não escolheu). */
  protected choiceText(key: ConsentKey): string {
    return CHOICE_TEXT[this.choices()[key] ?? 'pending'];
  }

  // ===== Criar a conta =====

  protected create(): void {
    this.failure.set(null);
    // Todas as etapas precisam estar certas: se o "Editar" deixou algo ruim para trás, volta para lá.
    for (const step of [0, 1, 2]) {
      if (!this.validateStep(step)) {
        this.step.set(step);
        this.focusTitle();
        return;
      }
    }
    this.submitted.set(true);
    this.errors.set([]);
    if (!this.noticeAccepted()) {
      this.noticeMissing.set(true);
      this.errors.set([{ controlId: 'st-notice', message: 'Marque que você leu o aviso para criar a conta.' }]);
      return;
    }
    this.noticeMissing.set(false);
    try {
      const data = this.signupData();
      const { caregiver } = this.signup.create(data, this.clock.now());
      this.drafts.clear(DRAFT_FORM, DRAFT_ID);
      this.savedAt.set(null);
      this.createdName.set(caregiver.fullName.split(/\s+/)[0] ?? caregiver.fullName);
      this.phase.set('done');
      this.focusTitle();
    } catch (error) {
      if (error instanceof CaregiverError) {
        this.you.controls.cpf.updateValueAndValidity();
        this.step.set(0);
        this.submitted.set(true);
        this.errors.set(summaryOf(this.stepEntries(0)));
        this.failure.set(error.message);
        return;
      }
      this.failure.set(SAVE_FAILED);
    }
  }

  private signupData(): SignupData {
    const you = this.you.getRawValue();
    const elder = this.elder.getRawValue();
    const daily = this.daily.getRawValue();
    return {
      fullName: you.fullName,
      birthDate: you.birthDate,
      cpf: you.cpf,
      phone: you.phone,
      email: you.email,
      city: you.city,
      elderName: elder.fullName,
      elderBirthDate: elder.birthDate,
      relationship: elder.relationship ?? 'other',
      dependency: elder.dependency ?? 'partial',
      hours: daily.hours ?? 0,
      channel: daily.channel ?? 'app',
      whatsapp: daily.channel === 'whatsapp' ? daily.whatsapp : '',
      choices: this.choices(),
    };
  }

  /** O foco vai ao h1 da etapa (leitor de tela) quando a etapa muda. */
  private focusTitle(): void {
    afterNextRender(
      () => {
        const heading = this.host.nativeElement.querySelector<HTMLElement>('h1');
        if (heading) {
          heading.setAttribute('tabindex', '-1');
          heading.focus();
        }
      },
      { injector: this.injector },
    );
  }
}
