import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Clock } from '../../../../core/clock/clock.service';
import { formatDate } from '../../../../core/format';
import type { Channel, Dependency, Relationship } from '../../../../core/models';
import { validateFictitiousPhone } from '../../../../core/rules/validators';
import { ErrorSummaryComponent, ErrorSummaryItem } from '../../../../shared/ui/forms/error-summary.component';
import { FormFieldComponent } from '../../../../shared/ui/forms/form-field.component';
import { NxInputDirective } from '../../../../shared/ui/forms/input.directive';
import { NxMaskDirective } from '../../../../shared/ui/forms/mask.directive';
import { ToastService } from '../../../../shared/ui/overlay/toast.service';
import { CaregiverContextService } from '../../state/caregiver-context.service';
import { ContactDialogService } from '../../state/contact-dialog.service';
import { CgCardComponent } from '../../ui/cg-card.component';
import { CgChoiceGroupComponent } from '../../ui/cg-choice-group.component';
import { CgNoteComponent } from '../../ui/cg-note.component';
import { CgHeroComponent } from '../../ui/cg-hero.component';
import { CgSheetComponent } from '../../ui/cg-sheet.component';
import { CgTextSizeComponent } from '../../ui/cg-text-size.component';
import { ProfileError, ProfileService } from '../state/profile.service';
import {
  CHANNEL_CHOICES,
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
import type { CgChoice } from '../../ui/cg-choice-group.component';

type Section = 'you' | 'elder' | 'daily';

const SAVE_FAILED = 'Não foi possível salvar. Tente de novo; se continuar, fale com a gente.';

const chosen =
  (message: string): ValidatorFn =>
  (control: AbstractControl): ValidationErrors | null =>
    control.value === null || control.value === '' ? { required: { message } } : null;

/**
 * Meu perfil (UX C22, `/cuidador/mais/perfil`): os dados de quem usa e de quem é cuidado, em 3 cartões (Você, Quem
 * você cuida, Seu dia a dia) com **Editar** que abre uma folha SÓ daquela seção, e o tamanho da letra embaixo. O CPF
 * aparece inteiro (é o dado da própria pessoa) e não se edita aqui (S-31: "Para corrigir o CPF, fale com a gente.").
 * A tela não pede nem mostra condição de saúde, remédio ou diagnóstico, nem dado de atendimento, grupo ou escala
 * (RN-USR-09). Se o canal preferido é o WhatsApp e não há número, uma nota avisa (CX-041).
 */
@Component({
  selector: 'app-profile-page',
  imports: [
    CgCardComponent,
    CgChoiceGroupComponent,
    CgNoteComponent,
    CgHeroComponent,
    CgSheetComponent,
    CgTextSizeComponent,
    ErrorSummaryComponent,
    FormFieldComponent,
    NxInputDirective,
    NxMaskDirective,
    ReactiveFormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .profile-dl {
      display: grid;
      gap: 0.25rem 1rem;
      margin: 0;
    }
    .profile-dl dt {
      color: var(--cg-text-soft);
      font-size: var(--cg-fs-small);
    }
    .profile-dl dd {
      margin: 0 0 0.5rem;
      overflow-wrap: anywhere;
    }
    .profile-fields {
      display: grid;
      gap: 1.25rem;
    }
    .profile-inline {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem 1rem;
    }
    .profile-hours {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .profile-hours input {
      flex: 1 1 6rem;
      min-width: 0;
    }
    .profile-cpf {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0 0.75rem;
    }
    .profile-hours .btn {
      min-width: var(--cg-target-lg);
      padding-inline: 0;
    }
    .profile-select {
      width: 100%;
    }
    .profile-error {
      margin: 0;
      color: var(--cg-error-fg);
      font-size: var(--cg-fs-small);
    }
    .profile-p {
      margin: 0;
    }
  `,
  template: `
    <app-cg-hero title="Meu perfil" illustration="welcome" backLink="/cuidador/mais" backLabel="Mais" />

    <div class="cg-stack cg-reading">
      <app-cg-card title="Você" icon="user-round">
        <dl class="profile-dl">
          <dt>Nome</dt>
          <dd>{{ caregiver()?.fullName }}</dd>
          <dt>Nascimento</dt>
          <dd>{{ date(caregiver()?.birthDate) }}</dd>
          <dt>CPF</dt>
          <dd class="profile-cpf">
            <!-- O CPF fica recolhido: quem olha o perfil por cima do ombro não o vê (CXC-024). A pessoa o mostra com um toque. -->
            <span data-role="cpf">{{ showCpf() ? caregiver()?.cpf : '•••.•••.•••-••' }}</span>
            <button type="button" class="cg-link-btn" data-role="toggle-cpf" [attr.aria-expanded]="showCpf()" (click)="showCpf.set(!showCpf())">
              {{ showCpf() ? 'Esconder' : 'Mostrar' }}<span class="sr-only"> o CPF</span>
            </button>
          </dd>
          <dt>Celular</dt>
          <dd>{{ caregiver()?.phone }}</dd>
          <dt>E-mail</dt>
          <dd>{{ caregiver()?.email }}</dd>
          <dt>Cidade</dt>
          <dd>{{ caregiver()?.city }}</dd>
        </dl>
        <div cgCardFooter class="profile-inline">
          <button type="button" class="cg-link-btn" (click)="open('you')">Editar<span class="sr-only"> os seus dados</span></button>
          <button type="button" class="cg-link-btn" (click)="contact.open()">Para corrigir o CPF, fale com a gente.</button>
        </div>
      </app-cg-card>

      <app-cg-card title="Quem você cuida" icon="users">
        <dl class="profile-dl">
          <dt>Nome</dt>
          <dd>{{ elder()?.fullName }}</dd>
          <dt>Nascimento</dt>
          <dd>{{ date(elder()?.birthDate) }}</dd>
          <dt>Quem é para você</dt>
          <dd>{{ relationshipText() }}</dd>
          <dt>Rotina</dt>
          <dd>{{ dependencyText() }}</dd>
        </dl>
        <button cgCardFooter type="button" class="cg-link-btn" (click)="open('elder')">Editar<span class="sr-only"> quem você cuida</span></button>
      </app-cg-card>

      <app-cg-card title="Seu dia a dia" icon="clock">
        <dl class="profile-dl">
          <dt>Horas por dia dedicadas ao cuidado</dt>
          <dd>{{ caregiver()?.dailyCareHours }}</dd>
          <dt>Como falamos com você</dt>
          <dd>{{ channelText() }}</dd>
          <dt>WhatsApp</dt>
          <dd>{{ caregiver()?.whatsapp ?? 'Não informado' }}</dd>
        </dl>
        @if (needsWhatsappNumber()) {
          <app-cg-note variant="info">
            Você prefere o WhatsApp, mas não informou o número. Informe para a equipe poder falar com você.
            <button cgNoteActions type="button" class="cg-link-btn" (click)="open('daily', true)">Informar o número</button>
          </app-cg-note>
        }
        <button cgCardFooter type="button" class="cg-link-btn" (click)="open('daily')">Editar<span class="sr-only"> o seu dia a dia</span></button>
      </app-cg-card>

      <section aria-labelledby="profile-text-title">
        <h2 class="cg-section__title" id="profile-text-title">Tamanho da letra</h2>
        <app-cg-text-size />
      </section>
    </div>

    <app-cg-sheet [heading]="sheetTitle()" [(open)]="sheetOpen">
      <app-error-summary short [items]="errors()" />
      @if (failure(); as text) {
        <app-cg-note variant="error">{{ text }}</app-cg-note>
      }

      @switch (section()) {
        @case ('you') {
          <div class="profile-fields" [formGroup]="you">
            <app-form-field label="Nome completo" controlId="pf-name" [forceErrors]="submitted()">
              <input appInput formControlName="fullName" autocomplete="name" />
            </app-form-field>
            <app-form-field label="Data de nascimento" controlId="pf-birth" [forceErrors]="submitted()">
              <input appInput type="date" formControlName="birthDate" autocomplete="bday" />
            </app-form-field>
            <app-form-field label="Celular" hint="Exemplo: (34) 90000-0000" controlId="pf-phone" [forceErrors]="submitted()">
              <input appInput appMask="phone" formControlName="phone" />
            </app-form-field>
            <app-form-field
              label="E-mail"
              hint="Use um e-mail que termine em @exemplo.com.br"
              controlId="pf-email"
              [forceErrors]="submitted()"
            >
              <input appInput type="email" formControlName="email" autocomplete="email" inputmode="email" />
            </app-form-field>
            <app-form-field label="Cidade" controlId="pf-city" [forceErrors]="submitted()">
              <input appInput formControlName="city" autocomplete="address-level2" />
            </app-form-field>
          </div>
        }
        @case ('elder') {
          <div class="profile-fields" [formGroup]="elderForm">
            <app-form-field label="Nome da pessoa idosa" controlId="pf-elder-name" [forceErrors]="submitted()">
              <input appInput formControlName="fullName" autocomplete="off" />
            </app-form-field>
            <app-form-field label="Data de nascimento dela" controlId="pf-elder-birth" [forceErrors]="submitted()">
              <input appInput type="date" formControlName="birthDate" autocomplete="off" />
            </app-form-field>
            <app-form-field label="Quem é essa pessoa para você?" controlId="pf-relationship" [forceErrors]="submitted()">
              <select appInput class="profile-select" formControlName="relationship">
                <option [ngValue]="null">Escolha uma opção</option>
                @for (option of relationshipOptions; track option.value) {
                  <option [ngValue]="option.value">{{ option.label }}</option>
                }
              </select>
            </app-form-field>
            <div id="pf-dependency">
              <app-cg-choice-group
                legend="Como está a rotina dela?"
                [options]="dependencyChoices"
                [value]="elderForm.controls.dependency.value"
                (valueChange)="elderForm.controls.dependency.setValue($event)"
              />
              @if (submitted() && elderForm.controls.dependency.invalid) {
                <p class="profile-error"><span class="sr-only">Erro: </span>Escolha como está a rotina dela.</p>
              }
            </div>
          </div>
        }
        @case ('daily') {
          <div class="profile-fields" [formGroup]="daily">
            <!-- O rótulo fica em cima da linha toda (menos, número, mais), não ao lado do botão (CXC-024). -->
            <app-form-field
              label="Quantas horas por dia você dedica ao cuidado?"
              hint="Pode mudar quando quiser."
              controlId="pf-hours"
              [forceErrors]="submitted()"
            >
              <div class="profile-hours">
                <button type="button" class="btn" aria-label="Menos uma hora por dia" (click)="stepHours(-1)">&minus;</button>
                <input appInput type="number" inputmode="numeric" formControlName="hours" min="0" max="24" />
                <button type="button" class="btn" aria-label="Mais uma hora por dia" (click)="stepHours(1)">+</button>
              </div>
            </app-form-field>
            <div id="pf-channel">
              <app-cg-choice-group
                legend="Como você prefere que a gente fale com você?"
                [options]="channelChoices()"
                [value]="daily.controls.channel.value"
                (valueChange)="daily.controls.channel.setValue($event)"
              />
              @if (submitted() && daily.controls.channel.invalid) {
                <p class="profile-error"><span class="sr-only">Erro: </span>Escolha como você prefere que a gente fale com você.</p>
              }
            </div>
            @if (daily.controls.channel.value === 'whatsapp') {
              <app-form-field label="Número do WhatsApp" controlId="pf-whatsapp" [forceErrors]="submitted()">
                <input appInput appMask="phone" formControlName="whatsapp" />
              </app-form-field>
              @if (!ctx.hasConsent('whatsapp_contact')) {
                <app-cg-note variant="info">
                  Para falar pelo WhatsApp, precisamos da sua autorização. Você pode dar em Privacidade.
                </app-cg-note>
              }
            }
          </div>
        }
      }

      <ng-container cgSheetActions>
        <button type="button" class="btn btn--primary" (click)="save()">Salvar alterações</button>
        <button type="button" class="cg-link-btn" (click)="sheetOpen.set(false)">Voltar</button>
      </ng-container>
    </app-cg-sheet>
  `,
})
export class ProfilePage {
  protected readonly ctx = inject(CaregiverContextService);
  protected readonly contact = inject(ContactDialogService);
  private readonly profile = inject(ProfileService);
  private readonly toasts = inject(ToastService);
  private readonly clock = inject(Clock);

  protected readonly relationshipOptions = RELATIONSHIP_OPTIONS;
  protected readonly dependencyChoices = DEPENDENCY_CHOICES;

  protected readonly caregiver = this.ctx.caregiver;
  protected readonly elder = this.ctx.elder;

  protected readonly section = signal<Section>('you');
  /** O CPF começa recolhido (CXC-024). */
  protected readonly showCpf = signal(false);
  protected readonly sheetOpen = signal(false);
  protected readonly submitted = signal(false);
  protected readonly errors = signal<ErrorSummaryItem[]>([]);
  protected readonly failure = signal<string | null>(null);

  private readonly today = (): string => this.clock.today();

  protected readonly you = new FormGroup({
    fullName: new FormControl('', { nonNullable: true, validators: YOU_VALIDATORS.fullName }),
    birthDate: new FormControl('', { nonNullable: true, validators: YOU_VALIDATORS.birthDate(this.today) }),
    phone: new FormControl('', { nonNullable: true, validators: YOU_VALIDATORS.phone }),
    email: new FormControl('', { nonNullable: true, validators: YOU_VALIDATORS.email }),
    city: new FormControl('', { nonNullable: true, validators: YOU_VALIDATORS.city }),
  });
  protected readonly elderForm = new FormGroup({
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

  /** O canal que a pessoa já tem fica na lista mesmo que seja o e-mail (o cadastro da equipe pode ter esse canal). */
  protected readonly channelChoices = computed<readonly CgChoice<Channel>[]>(() =>
    this.caregiver()?.preferredChannel === 'email'
      ? [...CHANNEL_CHOICES, { value: 'email', label: channelLabel('email') }]
      : CHANNEL_CHOICES,
  );

  protected readonly sheetTitle = computed(() => {
    switch (this.section()) {
      case 'you':
        return 'Editar: Você';
      case 'elder':
        return 'Editar: Quem você cuida';
      default:
        return 'Editar: Seu dia a dia';
    }
  });

  /** CX-041: prefere o WhatsApp mas não informou o número. */
  protected readonly needsWhatsappNumber = computed(() => {
    const caregiver = this.caregiver();
    return caregiver?.preferredChannel === 'whatsapp' && !(caregiver.whatsapp ?? '').trim();
  });

  protected date(iso: string | undefined): string {
    return iso ? formatDate(iso) : '';
  }

  protected relationshipText(): string {
    const value = this.caregiver()?.relationship;
    return value ? relationshipLabel(value) : '';
  }

  protected dependencyText(): string {
    const value = this.elder()?.dependency;
    return value ? dependencyLabel(value) : '';
  }

  protected channelText(): string {
    const value = this.caregiver()?.preferredChannel;
    return value ? channelLabel(value) : '';
  }

  // ===== Editar uma seção =====

  protected open(section: Section, whatsapp = false): void {
    const caregiver = this.caregiver();
    const elder = this.elder();
    this.submitted.set(false);
    this.errors.set([]);
    this.failure.set(null);
    this.section.set(section);
    if (section === 'you' && caregiver) {
      this.you.reset({
        fullName: caregiver.fullName,
        birthDate: caregiver.birthDate,
        phone: caregiver.phone,
        email: caregiver.email,
        city: caregiver.city,
      });
    } else if (section === 'elder' && caregiver && elder) {
      this.elderForm.reset({
        fullName: elder.fullName,
        birthDate: elder.birthDate,
        relationship: caregiver.relationship,
        dependency: elder.dependency,
      });
    } else if (section === 'daily' && caregiver) {
      this.daily.reset({
        hours: caregiver.dailyCareHours,
        channel: whatsapp ? 'whatsapp' : caregiver.preferredChannel,
        whatsapp: caregiver.whatsapp ?? (whatsapp ? caregiver.phone : ''),
      });
    }
    this.sheetOpen.set(true);
  }

  protected stepHours(delta: number): void {
    const current = this.daily.controls.hours.value ?? 0;
    this.daily.controls.hours.setValue(Math.min(24, Math.max(0, current + delta)));
  }

  private entries(): { id: string; label: string; control: AbstractControl }[] {
    switch (this.section()) {
      case 'you':
        return [
          { id: 'pf-name', label: 'Nome completo', control: this.you.controls.fullName },
          { id: 'pf-birth', label: 'Data de nascimento', control: this.you.controls.birthDate },
          { id: 'pf-phone', label: 'Celular', control: this.you.controls.phone },
          { id: 'pf-email', label: 'E-mail', control: this.you.controls.email },
          { id: 'pf-city', label: 'Cidade', control: this.you.controls.city },
        ];
      case 'elder':
        return [
          { id: 'pf-elder-name', label: 'Nome da pessoa idosa', control: this.elderForm.controls.fullName },
          { id: 'pf-elder-birth', label: 'Data de nascimento dela', control: this.elderForm.controls.birthDate },
          { id: 'pf-relationship', label: 'Quem é essa pessoa para você', control: this.elderForm.controls.relationship },
          { id: 'pf-dependency', label: 'Como está a rotina dela', control: this.elderForm.controls.dependency },
        ];
      default:
        return [
          { id: 'pf-hours', label: 'Horas por dia', control: this.daily.controls.hours },
          { id: 'pf-channel', label: 'Como falamos com você', control: this.daily.controls.channel },
          { id: 'pf-whatsapp', label: 'Número do WhatsApp', control: this.daily.controls.whatsapp },
        ];
    }
  }

  protected save(): void {
    this.failure.set(null);
    const entries = this.entries();
    entries.forEach((e) => {
      e.control.markAsTouched();
      e.control.updateValueAndValidity();
    });
    this.submitted.set(true);
    const items = summaryOf(entries);
    this.errors.set(items);
    if (items.length > 0) {
      return;
    }
    const id = this.ctx.requireCaregiverId();
    try {
      let changed: boolean;
      if (this.section() === 'you') {
        changed = this.profile.updateYou(id, this.you.getRawValue());
      } else if (this.section() === 'elder') {
        const raw = this.elderForm.getRawValue();
        changed = this.profile.updateElder(id, {
          fullName: raw.fullName,
          birthDate: raw.birthDate,
          relationship: raw.relationship ?? 'other',
          dependency: raw.dependency ?? 'partial',
        });
      } else {
        const raw = this.daily.getRawValue();
        changed = this.profile.updateDaily(id, {
          hours: raw.hours ?? 0,
          channel: raw.channel ?? 'app',
          whatsapp: raw.whatsapp,
        });
      }
      this.sheetOpen.set(false);
      this.toasts.show({ message: changed ? 'Dados salvos.' : 'Nada mudou.', durationMs: 8000 });
    } catch (error) {
      this.failure.set(error instanceof ProfileError ? error.message : SAVE_FAILED);
    }
  }
}
