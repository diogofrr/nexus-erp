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
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors } from '@angular/forms';
import type { ID } from '@core/models';
import {
  ErrorSummaryComponent,
  ErrorSummaryItem,
  FormFieldComponent,
  NxInputDirective,
  NxValidators,
  PLAN_NAMES,
} from '@shared/ui';
import { BannerComponent, DrawerComponent, ToastService } from '@shared/ui/overlay';
import { CompaniesService } from '../state/companies.service';
import { collectErrors } from '../state/form-helpers';
import { inviteEmailError } from '../state/partner-rules';

/**
 * SCR-M09-05 Convidar colaborador: e-mail do colaborador, vínculo à vaga e ao plano da empresa. Bloqueia
 * quando as vagas contratadas já estão ocupadas (AC-M09-04), com o motivo escrito.
 */
@Component({
  selector: 'app-invite-seat-drawer',
  imports: [
    ReactiveFormsModule,
    BannerComponent,
    DrawerComponent,
    ErrorSummaryComponent,
    FormFieldComponent,
    NxInputDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-drawer [(open)]="open" heading="Convidar colaborador" [subtitle]="subtitle()">
      <form id="is-form" class="stack stack--3" novalidate [formGroup]="form" (ngSubmit)="submit()">
        @if (blocked(); as reason) {
          <app-banner variant="attention" heading="Não dá para convidar agora" data-role="invite-blocked">
            {{ reason }}
          </app-banner>
        }
        <app-error-summary [items]="summary()" />
        @if (serverError()) {
          <app-banner variant="danger" heading="Não foi possível convidar" liveRole="alert">{{ serverError() }}</app-banner>
        }
        <dl class="dl">
          <dt>Plano da empresa</dt>
          <dd>{{ planName() }}</dd>
          <dt>Vagas livres</dt>
          <dd class="t-num">{{ free() }}</dd>
        </dl>
        <app-form-field
          label="E-mail do colaborador"
          hint="Termina em @exemplo.com.br. O convite fica ligado a uma vaga."
          controlId="is-email"
          [forceErrors]="submitted()"
        >
          <input appInput type="email" formControlName="email" autocomplete="off" />
        </app-form-field>
        <p class="t-caption">
          A empresa não vê dado de saúde nem o uso do atendimento do colaborador. A gestão vê só o código
          do cuidador.
        </p>
      </form>
      <ng-container drawerFooter>
        <button type="button" class="btn" (click)="open.set(false)">Cancelar</button>
        <button
          type="submit"
          form="is-form"
          class="btn btn--primary"
          data-role="send-invite"
          [attr.aria-disabled]="blocked() ? 'true' : null"
        >
          Convidar colaborador
        </button>
      </ng-container>
    </app-drawer>
  `,
})
export class InviteSeatDrawerComponent {
  private readonly service = inject(CompaniesService);
  private readonly toasts = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly open = model(false);
  readonly accountId = input.required<ID>();
  readonly saved = output<string>();

  protected readonly submitted = signal(false);
  protected readonly summary = signal<readonly ErrorSummaryItem[]>([]);
  protected readonly serverError = signal<string | null>(null);

  private readonly account = computed(() => {
    this.service.accounts();
    return this.service.get(this.accountId());
  });
  protected readonly subtitle = computed(() => this.account()?.companyName ?? '');
  protected readonly planName = computed(() => {
    const a = this.account();
    return a ? PLAN_NAMES[a.planId] : '';
  });
  protected readonly free = computed(() => {
    this.service.accounts();
    return this.service.countsOf(this.accountId()).free;
  });
  protected readonly blocked = computed(() => {
    this.service.accounts();
    this.free();
    const check = this.service.inviteCheck(this.accountId());
    return check.ok ? null : check.message;
  });

  protected readonly form = this.fb.group({
    email: this.fb.control('', [
      NxValidators.required('o e-mail do colaborador'),
      (control: AbstractControl): ValidationErrors | null => {
        const value = typeof control.value === 'string' ? control.value : '';
        const message = value.trim() === '' ? null : inviteEmailError(value);
        return message ? { email: { message } } : null;
      },
    ]),
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        untracked(() => {
          this.submitted.set(false);
          this.summary.set([]);
          this.serverError.set(null);
          this.form.reset({ email: '' });
        });
      }
    });
  }

  protected submit(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    const errors = collectErrors([
      { controlId: 'is-email', label: 'E-mail do colaborador', control: this.form.controls.email },
    ]);
    this.summary.set(errors);
    if (errors.length > 0) {
      return;
    }
    const result = this.service.invite(this.accountId(), this.form.controls.email.value);
    if (!result.ok) {
      this.serverError.set(result.message);
      return;
    }
    this.toasts.success('Convite registrado. A vaga fica ocupada até a adesão ou a remoção.');
    this.open.set(false);
    this.saved.emit(result.value.id);
  }
}

/**
 * Registrar adesão: o colaborador aceitou o convite fora do ERP. A gestão liga a vaga ao cadastro pelo
 * código (`CUI-0000`), sem ver nome nem contato. A assinatura passa ao plano da empresa e o cartão é
 * emitido ou reativado.
 */
@Component({
  selector: 'app-adhesion-drawer',
  imports: [
    ReactiveFormsModule,
    BannerComponent,
    DrawerComponent,
    ErrorSummaryComponent,
    FormFieldComponent,
    NxInputDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-drawer [(open)]="open" heading="Registrar adesão" subtitle="O colaborador aceitou o convite">
      <form id="ad-form" class="stack stack--3" novalidate [formGroup]="form" (ngSubmit)="submit()">
        <app-error-summary [items]="summary()" />
        @if (serverError()) {
          <app-banner variant="danger" heading="Não foi possível registrar" liveRole="alert">{{ serverError() }}</app-banner>
        }
        <app-form-field
          label="Código do colaborador"
          hint="No formato CUI-0000. A gestão vê só o código, nunca o nome."
          controlId="ad-code"
          [forceErrors]="submitted()"
        >
          <input appInput formControlName="code" autocomplete="off" placeholder="CUI-0000" />
        </app-form-field>
        <p class="t-caption">
          Ao registrar, a assinatura do colaborador passa para o plano da empresa, paga pela empresa, e o
          Cartão Nexus fica ativo.
        </p>
      </form>
      <ng-container drawerFooter>
        <button type="button" class="btn" (click)="open.set(false)">Cancelar</button>
        <button type="submit" form="ad-form" class="btn btn--primary" data-role="save-adhesion">
          Registrar adesão
        </button>
      </ng-container>
    </app-drawer>
  `,
})
export class AdhesionDrawerComponent {
  private readonly service = inject(CompaniesService);
  private readonly toasts = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly open = model(false);
  readonly seatId = input.required<ID>();
  readonly saved = output<string>();

  protected readonly submitted = signal(false);
  protected readonly summary = signal<readonly ErrorSummaryItem[]>([]);
  protected readonly serverError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    code: this.fb.control('', [
      NxValidators.required('o código do colaborador'),
      (control: AbstractControl): ValidationErrors | null => {
        const value = typeof control.value === 'string' ? control.value.trim() : '';
        if (value === '') {
          return null;
        }
        const message = this.service.adhesionCodeError(value);
        return message ? { code: { message } } : null;
      },
    ]),
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        untracked(() => {
          this.submitted.set(false);
          this.summary.set([]);
          this.serverError.set(null);
          this.form.reset({ code: '' });
        });
      }
    });
  }

  protected submit(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    const errors = collectErrors([
      { controlId: 'ad-code', label: 'Código do colaborador', control: this.form.controls.code },
    ]);
    this.summary.set(errors);
    if (errors.length > 0) {
      return;
    }
    const result = this.service.registerAdhesion(this.seatId(), this.form.controls.code.value);
    if (!result.ok) {
      this.serverError.set(result.message);
      return;
    }
    this.toasts.success('Adesão registrada. O plano da empresa e o Cartão Nexus estão ativos.');
    this.open.set(false);
    this.saved.emit(result.value.id);
  }
}
