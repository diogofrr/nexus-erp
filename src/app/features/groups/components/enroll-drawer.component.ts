import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/auth';
import { Clock } from '@core/clock';
import { Database } from '@core/data';
import { formatDateTime } from '@core/format';
import { GroupMembershipService } from '@core/groups';
import { ActivityEnrollment } from '@core/models';
import {
  CheckboxComponent,
  ChecklistComponent,
  ChecklistItem,
  FormFieldComponent,
  IconComponent,
  NxInputDirective,
  PLAN_NAMES,
  RadioGroupComponent,
  RadioOption,
} from '@shared/ui';
import { DrawerComponent, ToastService } from '@shared/ui/overlay';
import { valueOf } from '@shared/ui/util/form-events';
import { FieldError, GroupsService } from '../state/groups.service';

const MAX_OPTIONS = 30;

/**
 * SCR-M07-04, Inscrever (F11, A-31): escolhe o cuidador (ou, na roda aberta, um participante externo) e mostra
 * TODAS as checagens de uma vez: plano, elegibilidade, sala e vaga. O contrato de sigilo exige aceite, com data
 * e hora gravadas. Sem aceite, o botão fica com o motivo escrito ao lado. Lotada, a ação diz o que vai
 * acontecer: "Entrar na lista de espera". O bloqueio por plano é informativo, com o caminho (do Cuida em diante).
 */
@Component({
  selector: 'app-enroll-drawer',
  imports: [CheckboxComponent, ChecklistComponent, DrawerComponent, FormFieldComponent, IconComponent, NxInputDirective, RadioGroupComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-drawer [(open)]="open" [heading]="full() ? 'Entrar na lista de espera' : 'Inscrever participante'" [subtitle]="activity()?.title ?? ''">
      <div class="stack stack--6" data-role="enroll-form">
        @if (canExternal()) {
          <app-form-field label="Quem entra" group controlId="enroll-type">
            <app-radio-group [options]="typeOptions" [value]="type()" (valueChange)="type.set($event ?? 'caregiver')" />
          </app-form-field>
        }

        @if (type() === 'caregiver') {
          <app-form-field label="Cuidador" controlId="enroll-caregiver" [error]="err('caregiver')" [hint]="isPartner() ? 'Busque pelo código, por exemplo CUI-0001, e escolha na lista.' : 'Busque pelo nome ou pelo código e escolha na lista.'">
            <input class="input mb-2" type="search" aria-label="Buscar cuidador por nome ou código" placeholder="Buscar cuidador" [value]="term()" (input)="term.set(valueOf($event))" />
            <select appInput [value]="caregiverId()" (change)="caregiverId.set(valueOf($event))" data-role="enroll-select">
              <option value="">Escolha o cuidador</option>
              @for (c of options(); track c.id) {
                <option [value]="c.id" [selected]="c.id === caregiverId()">{{ label(c) }}</option>
              }
            </select>
            @if (moreHint(); as hint) {
              <span class="t-caption" data-role="more-options">{{ hint }}</span>
            }
          </app-form-field>
        } @else {
          <app-form-field label="Nome do participante externo" controlId="enroll-ext-name" [error]="err('externalName')">
            <input appInput [value]="extName()" (input)="extName.set(valueOf($event))" data-role="ext-name" />
          </app-form-field>
          <app-form-field label="E-mail" controlId="enroll-ext-email" [error]="err('externalEmail')" hint="Use um e-mail que termine em @exemplo.com.br.">
            <input appInput type="email" [value]="extEmail()" (input)="extEmail.set(valueOf($event))" data-role="ext-email" />
          </app-form-field>
        }

        <section class="stack stack--2" aria-labelledby="enroll-checks-title">
          <h3 id="enroll-checks-title" class="card__title">Checagens da inscrição</h3>
          <app-checklist label="Checagens da inscrição" [items]="checklist()" />
          @if (planBlocked() && changePlanLink(); as link) {
            <div class="cluster" data-role="plan-shortcut">
              <a class="btn btn--sm" [routerLink]="link" data-role="change-plan">Trocar o plano</a>
              <span class="t-caption">Abre a assinatura do cuidador. Depois de trocar o plano, volte e inscreva.</span>
            </div>
          }
        </section>

        @if (showEligibility()) {
          <app-checkbox [checked]="eligible()" (checkedChange)="eligible.set($event)" data-role="eligible">
            Indico este cuidador para a terapia de grupo (opcional)
          </app-checkbox>
        }

        <section class="card card--sunken card--pad stack stack--3" aria-labelledby="enroll-contract">
          <h3 id="enroll-contract" class="card__title">Contrato de sigilo</h3>
          <p class="t-ui" data-role="contract-text">{{ activity()?.confidentialityText }}</p>
          <app-checkbox [checked]="accepted()" (checkedChange)="setAccepted($event)" data-role="contract-accept">
            O participante leu e aceitou o contrato de sigilo
          </app-checkbox>
          @if (acceptedAt(); as at) {
            <p class="t-caption" data-role="accepted-at">Aceite registrado em {{ dateTime(at) }}.</p>
          }
          @if (err('contract'); as msg) {
            <p class="field__error" role="alert">{{ msg }}</p>
          }
        </section>

        @if (errors().length > 0) {
          <p class="field__error" role="alert" data-role="enroll-errors">{{ errorText() }}</p>
        }
      </div>
      <ng-container drawerFooter>
        @if (reason(); as why) {
          <span class="t-caption" data-role="why-disabled">{{ why }}</span>
        }
        <button type="button" class="btn" (click)="open.set(false)">Voltar</button>
        <button type="button" class="btn btn--primary" [attr.aria-disabled]="reason() ? 'true' : null" (click)="submit()" data-role="enroll-submit">
          <svg appIcon="user-check" size="sm"></svg>{{ full() ? 'Entrar na lista de espera' : 'Inscrever' }}
        </button>
      </ng-container>
    </app-drawer>
  `,
})
export class EnrollDrawerComponent {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly auth = inject(AuthService);
  private readonly svc = inject(GroupsService);
  private readonly membership = inject(GroupMembershipService);
  private readonly toasts = inject(ToastService);

  readonly open = model(false);
  readonly activityId = input.required<string>();
  readonly enrolled = output<{ enrollment: ActivityEnrollment; waitlisted: boolean }>();

  protected readonly valueOf = valueOf;
  protected readonly typeOptions: RadioOption<'caregiver' | 'external'>[] = [
    { value: 'caregiver', label: 'Cuidador' },
    { value: 'external', label: 'Participante externo' },
  ];

  protected readonly type = signal<'caregiver' | 'external'>('caregiver');
  protected readonly term = signal('');
  protected readonly caregiverId = signal('');
  protected readonly extName = signal('');
  protected readonly extEmail = signal('');
  protected readonly accepted = signal(false);
  protected readonly acceptedAt = signal<string | null>(null);
  protected readonly eligible = signal(false);
  protected readonly errors = signal<FieldError[]>([]);

  protected readonly activity = computed(() => this.db.activities.get(this.activityId()));
  protected readonly isPartner = computed(() => this.auth.role() === 'partner');
  protected readonly canExternal = computed(() => this.activity()?.kind === 'open_circle');
  protected readonly full = computed(() => {
    const a = this.activity();
    return !!a && this.membership.seatsFree(a) === 0;
  });
  protected readonly showEligibility = computed(
    () => this.activity()?.kind === 'group_therapy' && this.type() === 'caregiver' && this.svc.canMarkEligible(this.caregiverId() || undefined),
  );

  protected readonly options = computed(() => {
    const term = this.term().trim().toLowerCase();
    const selected = this.caregiverId();
    const all = this.svc.eligibleCaregivers();
    // A gestão busca só por código: nome nunca casa (LP-08, A-09).
    const byCodeOnly = this.auth.role() === 'partner';
    const found = all
      .filter((c) => !term || c.code.toLowerCase().includes(term) || (!byCodeOnly && c.fullName.toLowerCase().includes(term)))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'pt-BR'))
      .slice(0, MAX_OPTIONS);
    const chosen = all.find((c) => c.id === selected);
    return chosen && !found.some((c) => c.id === selected) ? [chosen, ...found] : found;
  });

  protected readonly checklist = computed<ChecklistItem[]>(() => {
    const a = this.activity();
    if (!a) {
      return [];
    }
    const who = this.type() === 'external' ? { external: true } : { caregiverId: this.caregiverId() || undefined };
    return this.svc.checksFor(a, who, this.eligible()).map((c) => ({ id: c.id, title: c.title, text: c.text, state: c.state }));
  });

  /** Por que a inscrição ainda não pode ser feita (texto ao lado do botão, UX 5.9). */
  protected readonly reason = computed<string | null>(() => {
    const failing = this.checklist().find((c) => c.state === 'fail');
    if (failing) {
      return failing.text ?? null;
    }
    if (this.type() === 'caregiver' && !this.caregiverId()) {
      return 'Escolha o cuidador.';
    }
    const pending = this.checklist().find((c) => c.state === 'pending');
    if (pending) {
      return pending.text ?? null;
    }
    if (!this.accepted()) {
      return 'Falta o aceite do contrato de sigilo.';
    }
    return null;
  });

  protected readonly errorText = computed(() => this.errors().map((e) => e.message).join(' '));

  /** O plano do cuidador escolhido não dá acesso à atividade (CX-042). */
  protected readonly planBlocked = computed(
    () => this.type() === 'caregiver' && this.caregiverId() !== '' && this.checklist().some((c) => c.id === 'plan' && c.state === 'fail'),
  );
  /** Caminho até a assinatura do cuidador, só para quem abre o módulo de assinaturas (sem importar de outro módulo). */
  protected readonly changePlanLink = computed<string[] | null>(() => {
    if (!this.auth.can('plans_subscriptions', 'view')) {
      return null;
    }
    const subscription = this.db.subscriptions.find((s) => s.caregiverId === this.caregiverId());
    return subscription ? ['/app/assinaturas', subscription.id] : ['/app/assinaturas', 'planos'];
  });
  /** Avisa que a lista mostra só os primeiros nomes até a pessoa digitar (CX-042). */
  protected readonly moreHint = computed<string | null>(() => {
    const total = this.svc.eligibleCaregivers().length;
    return this.term().trim() === '' && total > MAX_OPTIONS
      ? `A lista mostra ${MAX_OPTIONS} de ${total} pessoas. Digite o nome ou o código para achar as outras.`
      : null;
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        untracked(() => this.reset());
      }
    });
  }

  private reset(): void {
    this.type.set('caregiver');
    this.term.set('');
    this.caregiverId.set('');
    this.extName.set('');
    this.extEmail.set('');
    this.accepted.set(false);
    this.acceptedAt.set(null);
    this.eligible.set(false);
    this.errors.set([]);
  }

  protected label(c: { fullName: string; code: string; planId: keyof typeof PLAN_NAMES }): string {
    const plan = PLAN_NAMES[c.planId];
    return this.auth.role() === 'partner' ? `${c.code}, plano ${plan}` : `${c.fullName} (${c.code}, ${plan})`;
  }

  protected err(field: string): string | null {
    return this.errors().find((e) => e.field === field)?.message ?? null;
  }

  protected planName(planId: keyof typeof PLAN_NAMES): string {
    return PLAN_NAMES[planId];
  }

  protected dateTime(value: string): string {
    return formatDateTime(value);
  }

  protected setAccepted(on: boolean): void {
    this.accepted.set(on);
    this.acceptedAt.set(on ? this.clock.now() : null);
  }

  protected submit(): void {
    const a = this.activity();
    if (!a) {
      return;
    }
    const external = this.type() === 'external';
    const result = this.svc.enroll({
      activityId: a.id,
      ...(external ? { external: { name: this.extName(), email: this.extEmail() } } : { caregiverId: this.caregiverId() }),
      contractAccepted: this.accepted(),
      ...(this.acceptedAt() ? { acceptedAt: this.acceptedAt() as string } : {}),
      eligible: this.eligible(),
    });
    if (!result.ok) {
      this.errors.set(result.errors);
      return;
    }
    this.errors.set([]);
    this.open.set(false);
    const caregiver = this.db.caregivers.get(this.caregiverId());
    const name = external
      ? this.extName().trim()
      : this.auth.role() === 'partner'
        ? (caregiver?.code ?? 'Participante')
        : (caregiver?.fullName ?? 'Participante');
    const { enrollment, waitlisted } = result.value;
    this.toasts.success(
      waitlisted ? `${name} entrou na lista de espera, posição ${enrollment.waitlistPosition}.` : `Inscrição registrada para ${name}.`,
    );
    this.enrolled.emit(result.value);
  }
}
