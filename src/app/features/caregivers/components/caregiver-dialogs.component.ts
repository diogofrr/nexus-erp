import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, signal, untracked } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '@core/auth';
import { Clock } from '@core/clock';
import { Database } from '@core/data';
import type { Caregiver, Channel, Relationship, Sex } from '@core/models';
import { RetentionService, erasurePlanFor } from '@core/privacy';
import { ErrorSummaryComponent, FormFieldComponent, NxInputDirective } from '@shared/ui';
import { DialogService, DrawerComponent, ToastService } from '@shared/ui/overlay';
import { CaregiverFieldsFormComponent } from './caregiver-fields-form.component';
import { CAREGIVER_FIELD_META, Literacy, caregiverFieldsGroup, errorItems } from '../state/caregiver-form';
import { CLOSURE_REASONS } from '../state/caregiver-labels';
import { CaregiverService } from '../state/caregiver.service';

/** Gaveta "Editar cadastro": os mesmos campos e regras do cadastro novo; o CPF fictício não muda. */
@Component({
  selector: 'app-caregiver-edit-drawer',
  imports: [CaregiverFieldsFormComponent, DrawerComponent, ErrorSummaryComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-drawer [(open)]="open" heading="Editar cadastro" [subtitle]="'Cuidador ' + caregiver().code">
      <form id="nx-cg-edit-form" class="stack stack--3" (ngSubmit)="save()" novalidate>
        <app-error-summary [items]="summary()" />
        <p class="t-caption">O CPF fictício não muda. Use dados fictícios em todos os campos.</p>
        <app-caregiver-fields-form [form]="form" [submitted]="submitted()" />
      </form>
      <ng-container drawerFooter>
        <button type="button" class="btn" (click)="open.set(false)">Voltar</button>
        <button type="submit" form="nx-cg-edit-form" class="btn btn--primary">Salvar cadastro</button>
      </ng-container>
    </app-drawer>
  `,
})
export class CaregiverEditDrawerComponent {
  private readonly clock = inject(Clock);
  private readonly service = inject(CaregiverService);
  private readonly toasts = inject(ToastService);

  readonly caregiver = input.required<Caregiver>();
  readonly open = model(false);

  protected readonly form = caregiverFieldsGroup(() => this.clock.today());
  protected readonly submitted = signal(false);
  protected readonly summary = signal<ReturnType<typeof errorItems>>([]);

  constructor() {
    effect(() => {
      if (!this.open()) {
        return;
      }
      untracked(() => {
        const c = this.caregiver();
        this.submitted.set(false);
        this.summary.set([]);
        this.form.reset({
          fullName: c.fullName,
          birthDate: c.birthDate,
          email: c.email,
          phone: c.phone,
          whatsapp: c.whatsapp ?? '',
          relationship: c.relationship as Relationship,
          sex: c.sex as Sex,
          city: c.city,
          dailyCareHours: c.dailyCareHours,
          preferredChannel: c.preferredChannel as Channel,
          digitalLiteracy: c.digitalLiteracy as Literacy,
        });
      });
    });
  }

  protected save(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    const items = errorItems(CAREGIVER_FIELD_META.map((m) => ({ id: m.id, label: m.label, control: this.form.controls[m.key] })));
    this.summary.set(items);
    if (items.length > 0) {
      return;
    }
    const v = this.form.getRawValue();
    try {
      this.service.update(this.caregiver().id, {
        fullName: v.fullName,
        birthDate: v.birthDate as string,
        email: v.email,
        phone: v.phone,
        ...(v.whatsapp ? { whatsapp: v.whatsapp } : {}),
        relationship: v.relationship as Relationship,
        sex: v.sex as Sex,
        city: v.city,
        dailyCareHours: v.dailyCareHours as number,
        preferredChannel: v.preferredChannel as Channel,
        digitalLiteracy: v.digitalLiteracy as Literacy,
      });
      this.toasts.success('Cadastro salvo.');
      this.open.set(false);
    } catch {
      this.toasts.error('Não foi possível salvar. Tente de novo; se continuar, avise a equipe.');
    }
  }
}

/**
 * SCR-M03-05 Encerrar cadastro (POP-10): motivo, o que será eliminado e o que ficará bloqueado por
 * registro documental (RN-LGPD-24) e um diálogo de efeito para confirmar. Pedir o encerramento muda a
 * situação para "Encerramento pedido" e cria a solicitação de eliminação (POP-10).
 */
@Component({
  selector: 'app-caregiver-closure-drawer',
  imports: [DrawerComponent, FormFieldComponent, NxInputDirective, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-drawer [(open)]="open" heading="Encerrar cadastro" [subtitle]="'Cuidador ' + caregiver().code">
      @if (open()) {
        <div class="stack stack--6">
          <app-form-field label="Motivo do encerramento" controlId="nx-closure-reason" [error]="reasonError()">
            <select appInput [formControl]="reason">
              <option [ngValue]="null">Escolha o motivo</option>
              @for (r of reasons; track r) { <option [ngValue]="r">{{ r }}</option> }
            </select>
          </app-form-field>
          @if (reason.value === other) {
            <app-form-field label="Descreva o motivo" hint="Use ao menos 10 caracteres. Não escreva dado de saúde." controlId="nx-closure-text" [error]="textError()">
              <textarea appInput [formControl]="text"></textarea>
            </app-form-field>
          }
          <section class="stack stack--3" aria-label="O que acontece">
            <h3>O que acontece</h3>
            <ul class="effects">
              <li class="is-erase"><span><strong>Será eliminado:</strong> {{ erased() }}.</span></li>
              <li class="is-block"><span><strong>Ficará bloqueado por registro documental:</strong> {{ blocked() }}.</span></li>
              <li class="is-keep"><span><strong>Continua registrado:</strong> o histórico de consentimentos e o log de acessos.</span></li>
            </ul>
            @if (note()) {
              <p class="t-caption">{{ note() }}</p>
            }
          </section>
        </div>
      }
      <ng-container drawerFooter>
        <button type="button" class="btn" (click)="open.set(false)">Voltar</button>
        <button type="button" class="btn btn--danger" (click)="request()">Pedir encerramento do cadastro</button>
      </ng-container>
    </app-drawer>
  `,
})
export class CaregiverClosureDrawerComponent {
  private readonly db = inject(Database);
  private readonly retention = inject(RetentionService);
  private readonly auth = inject(AuthService);
  private readonly service = inject(CaregiverService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);

  readonly caregiver = input.required<Caregiver>();
  readonly open = model(false);

  protected readonly reasons = CLOSURE_REASONS;
  protected readonly other = CLOSURE_REASONS[CLOSURE_REASONS.length - 1] as string;
  protected readonly reason = new FormControl<string | null>(null);
  protected readonly text = new FormControl('', { nonNullable: true });
  protected readonly reasonError = signal<string | null>(null);
  protected readonly textError = signal<string | null>(null);

  private readonly plan = computed(() => {
    this.db.messages.all();
    this.db.zaritAssessments.all();
    // CX-033: o atendimento (e a gestão) não descobrem pela lista se há Zarit, alerta ou ocorrência.
    return erasurePlanFor(this.retention.plan(this.caregiver().id), this.auth.role());
  });
  protected readonly erased = computed(() => this.plan().willErase.map((i) => `${i.label}${i.count > 1 ? ` (${i.count})` : ''}`).join('; '));
  protected readonly blocked = computed(() => {
    const items = this.plan().willBlock;
    return items.length === 0
      ? 'nada (o cadastro não tem registro documental)'
      : items.map((i) => (i.key === 'clinical' ? i.label : `${i.label} (${i.count})`)).join('; ');
  });
  // Texto lido ao titular: sem a observação interna "(a confirmar)" (CX-038).
  protected readonly note = computed(() => this.plan().note?.replace(' (a confirmar)', '') ?? null);

  protected async request(): Promise<void> {
    this.reasonError.set(null);
    this.textError.set(null);
    const chosen = this.reason.value;
    if (!chosen) {
      this.reasonError.set('Escolha o motivo do encerramento.');
      return;
    }
    const detail = chosen === this.other ? this.text.value.trim() : chosen;
    if (chosen === this.other && detail.length < 10) {
      this.textError.set('Descreva o motivo com ao menos 10 caracteres.');
      return;
    }
    const plan = this.plan();
    const { confirmed } = await this.dialogs.confirm({
      title: `Encerrar o cadastro de ${this.caregiver().code}?`,
      message: 'O cadastro passa a "Encerramento pedido" e entra na fila de solicitações do titular (POP-10). A eliminação é executada pela gestão ou pelo responsável técnico.',
      effects: {
        erase: plan.willErase.map((i) => i.label),
        block: plan.willBlock.map((i) => (i.key === 'clinical' ? i.label : `${i.label} (${plan.note ?? 'registro documental'})`)),
        keep: ['o histórico de consentimentos', 'o log de acessos'],
      },
      confirmLabel: 'Pedir encerramento',
      busyLabel: 'Pedindo encerramento...',
      run: () => {
        const request = this.service.requestClosure(this.caregiver().id, detail);
        this.toasts.success(`Encerramento pedido. Solicitação ${request.protocol} aberta.`);
      },
    });
    if (confirmed) {
      this.open.set(false);
    }
  }
}
