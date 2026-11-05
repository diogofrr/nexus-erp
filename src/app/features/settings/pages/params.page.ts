import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { AuditLogService } from '../../../core/audit/audit-log.service';
import { Database } from '../../../core/data/database';
import { defaultAppSettings } from '../../../core/data/defaults';
import { formatMoney, formatNumber } from '../../../core/format/format';
import { AppSettings } from '../../../core/models/finance';
import { Plan, PlanId } from '../../../core/models/plans';
import {
  ARP_ALERT_MIN,
  ARP_AUDIT_INTERVAL_DAYS,
  ARP_EXCELLENCE_MIN,
  ARP_GRAVE_LIMIT,
  ARP_MIN_EVALUATIONS,
} from '../../../core/rules/arp';
import { BENEFIT_LABELS, DEFAULT_PLANS } from '../../../core/rules/plans';
import { ZARIT_BANDS } from '../../../core/rules/zarit';
import { IconComponent } from '../../../shared/ui/display/icon.component';
import { ToastService } from '../../../shared/ui/overlay/toast.service';
import { NumberFieldComponent, integerValidator } from '../components/number-field.component';

/** Frases do resumo de erros (a mesma do campo). */
interface FieldDef {
  key: string;
  label: string;
  noun: string;
  hint?: string;
  unit?: string;
  min: number;
  max: number;
}

/** O valor do formulário de parâmetros. */
interface ParamsFormValue {
  groupDefaultCapacity: number;
  refusalRateThresholdPercent: number;
  refusalRateMinRequests: number;
  dsrDeadlineDays: number;
  dsrDueSoonDays: number;
  slaHours: { app: number; whatsapp: number; phone: number; email: number };
  sessionCancellationHours: number;
  plans: Record<PlanId, { discount: number; priority: boolean }>;
}

const PLAN_IDS: readonly PlanId[] = ['livre', 'essencial', 'cuida', 'sustenta'];

/** Campos gerais, por seção (SCR-M15-03). */
const SECTIONS: readonly { title: string; fields: readonly FieldDef[] }[] = [
  {
    title: 'Grupos e capacitações',
    fields: [
      {
        key: 'groupDefaultCapacity',
        label: 'Capacidade padrão do grupo',
        noun: 'a capacidade do grupo',
        unit: 'vagas',
        min: 1,
        max: 100,
        hint: 'Vale para novas atividades; cada uma pode ter a sua.',
      },
    ],
  },
  {
    title: 'Rede credenciada',
    fields: [
      {
        key: 'refusalRateThresholdPercent',
        label: 'Limiar da taxa de recusa',
        noun: 'o limiar da taxa de recusa',
        unit: '%',
        min: 1,
        max: 100,
        hint: 'Acima disto, o prestador ganha o selo "risco de saída".',
      },
      {
        key: 'refusalRateMinRequests',
        label: 'Mínimo de solicitações para medir a recusa',
        noun: 'o mínimo de solicitações',
        unit: 'solicitações',
        min: 1,
        max: 100,
      },
    ],
  },
  {
    title: 'Solicitações do titular (LGPD)',
    fields: [
      {
        key: 'dsrDeadlineDays',
        label: 'Prazo de resposta',
        noun: 'o prazo de resposta',
        unit: 'dias corridos',
        min: 1,
        max: 60,
      },
      {
        key: 'dsrDueSoonDays',
        label: 'Aviso de "vence em breve"',
        noun: 'o aviso de vencimento',
        unit: 'dias antes do prazo',
        min: 1,
        max: 15,
      },
    ],
  },
  {
    title: 'Mensagens e atendimento',
    fields: [
      {
        key: 'slaHours.app',
        label: 'Prazo no aplicativo',
        noun: 'o prazo no aplicativo',
        unit: 'horas úteis',
        min: 1,
        max: 72,
      },
      {
        key: 'slaHours.whatsapp',
        label: 'Prazo no WhatsApp',
        noun: 'o prazo no WhatsApp',
        unit: 'horas úteis',
        min: 1,
        max: 72,
      },
      {
        key: 'slaHours.phone',
        label: 'Prazo no telefone',
        noun: 'o prazo no telefone',
        unit: 'horas úteis',
        min: 0,
        max: 72,
        hint: 'Zero significa atendimento na hora.',
      },
      {
        key: 'slaHours.email',
        label: 'Prazo no e-mail',
        noun: 'o prazo no e-mail',
        unit: 'horas úteis',
        min: 1,
        max: 72,
      },
      {
        key: 'sessionCancellationHours',
        label: 'Antecedência para cancelar sessão',
        noun: 'a antecedência de cancelamento',
        unit: 'horas',
        min: 0,
        max: 168,
      },
    ],
  },
];

/**
 * Parâmetros (SCR-M15-03, AC-M15-06 e 07): benefícios e desconto por plano, capacidade padrão do grupo, limiar
 * da taxa de recusa, prazos da solicitação do titular e SLA de mensagens. Cada campo diz a faixa válida; salvar
 * mostra um aviso com "Desfazer" (nível 1 do guia). As regras do documento (mínimo de 5 avaliações, limites de
 * 4,5 e 4,0, faixas da Zarit) aparecem somente leitura (AC-M15-07).
 */
@Component({
  selector: 'app-settings-params-page',
  imports: [ReactiveFormsModule, NumberFieldComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page--narrow">
      <header class="page-header">
        <div class="page-header__row">
          <div class="page-header__titles">
            <h1>Parâmetros</h1>
            <p class="page-header__desc">
              Valores que a equipe pode ajustar no protótipo. Mudar um parâmetro vale na hora, em
              todas as telas.
            </p>
          </div>
          <div class="page-header__actions">
            <button type="button" class="btn" data-role="restore" (click)="restoreDefaults()">
              <svg appIcon="undo-2"></svg>Restaurar padrões
            </button>
            <button type="submit" form="nx-params-form" class="btn btn--primary" data-role="save">
              Salvar parâmetros
            </button>
          </div>
        </div>
      </header>

      <form
        id="nx-params-form"
        class="stack stack--6"
        novalidate
        [formGroup]="form"
        (ngSubmit)="save()"
      >
        @if (errors().length > 0) {
          <div class="error-summary" role="alert" tabindex="-1">
            <h2>
              <svg appIcon="circle-alert"></svg>Há {{ errors().length }}
              {{ errors().length === 1 ? 'ponto' : 'pontos' }} para corrigir
            </h2>
            <ul>
              @for (text of errors(); track text) {
                <li>{{ text }}</li>
              }
            </ul>
          </div>
        }

        <section class="card" aria-labelledby="nx-params-plans">
          <div class="card__header">
            <div>
              <h2 class="card__title" id="nx-params-plans">Benefícios por plano</h2>
              <p class="card__sub">
                Os benefícios são cumulativos (Figura 1 do plano de negócios) e não mudam aqui. O
                desconto na sessão com psicólogo e a prioridade de vaga são suposições do protótipo.
              </p>
            </div>
          </div>
          <div class="card__body stack stack--6" formGroupName="plans">
            @for (plan of plans(); track plan.id) {
              <div class="stack stack--3" [formGroupName]="plan.id" [attr.data-plan]="plan.id">
                <h3 class="t-strong">
                  {{ plan.name }} · {{ money(plan.monthlyPriceCents) }} por mês
                </h3>
                <ul class="t-ui t-muted" data-role="benefits">
                  @for (key of plan.benefits; track key) {
                    <li>{{ benefitLabel(key) }}</li>
                  }
                </ul>
                <div class="cluster cluster--4">
                  <app-number-field
                    [control]="planControl(plan.id, 'discount')"
                    label="Desconto na sessão com psicólogo da Nexus"
                    noun="o desconto"
                    unit="%"
                    [min]="0"
                    [max]="100"
                  />
                  <label class="switch">
                    <input type="checkbox" formControlName="priority" />
                    <span>Prioridade na agenda</span>
                  </label>
                </div>
              </div>
            }
          </div>
        </section>

        @for (section of sections; track section.title) {
          <section class="card card--pad stack stack--3">
            <h2 class="card__title">{{ section.title }}</h2>
            <div class="form-grid">
              @for (field of section.fields; track field.key) {
                <app-number-field
                  [control]="control(field.key)"
                  [label]="field.label"
                  [noun]="field.noun"
                  [unit]="field.unit ?? ''"
                  [hint]="field.hint ?? ''"
                  [min]="field.min"
                  [max]="field.max"
                />
              }
            </div>
          </section>
        }
      </form>

      <section class="card card--pad stack stack--3 mt-6" aria-labelledby="nx-params-fixed">
        <h2 class="card__title" id="nx-params-fixed">Regras do documento (somente leitura)</h2>
        <p class="t-muted t-ui">
          Estas regras vêm do plano de negócios e não podem ser mudadas no protótipo.
        </p>
        <dl class="dl" data-role="fixed-rules">
          <dt>Mínimo de avaliações da rede</dt>
          <dd class="t-num">{{ minEvaluations }} avaliações</dd>
          <dt>Faixa de excelência</dt>
          <dd class="t-num">média a partir de {{ excellence }}</dd>
          <dt>Faixa de alerta</dt>
          <dd class="t-num">média de {{ alert }} a menos de {{ excellence }}</dd>
          <dt>Descredenciamento por reclamações graves</dt>
          <dd class="t-num">{{ graveLimit }} ou mais</dd>
          <dt>Auditoria quinzenal</dt>
          <dd class="t-num">a cada {{ auditDays }} dias</dd>
          @for (band of bands; track band.band) {
            <dt>Escala de Zarit, {{ band.min }} a {{ band.max }}</dt>
            <dd>{{ band.label }}</dd>
          }
        </dl>
      </section>
    </div>
  `,
})
export class ParamsPageComponent {
  private readonly db = inject(Database);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly toasts = inject(ToastService);
  private readonly audit = inject(AuditLogService);

  protected readonly sections = SECTIONS;
  protected readonly minEvaluations = ARP_MIN_EVALUATIONS;
  protected readonly excellence = formatNumber(ARP_EXCELLENCE_MIN, 1);
  protected readonly alert = formatNumber(ARP_ALERT_MIN, 1);
  protected readonly graveLimit = ARP_GRAVE_LIMIT;
  protected readonly auditDays = ARP_AUDIT_INTERVAL_DAYS;
  protected readonly bands = ZARIT_BANDS;

  protected readonly plans = computed<readonly Plan[]>(() =>
    [...this.db.plans.all()].sort((a, b) => PLAN_IDS.indexOf(a.id) - PLAN_IDS.indexOf(b.id)),
  );

  protected readonly form = this.buildForm();
  /** Muda a cada validação para o resumo de erros (os estados do formulário não são signals). */
  private readonly tick = signal(0);
  protected readonly errors = computed(() => {
    this.tick();
    return this.errorList();
  });

  protected money(cents: number): string {
    return formatMoney(cents);
  }

  protected benefitLabel(key: keyof typeof BENEFIT_LABELS): string {
    return BENEFIT_LABELS[key];
  }

  protected control(path: string): FormControl<number> {
    return this.form.get(path) as FormControl<number>;
  }

  protected planControl(plan: PlanId, name: 'discount' | 'priority'): FormControl<number> {
    return this.form.get(`plans.${plan}.${name}`) as FormControl<number>;
  }

  /** Valida, grava e avisa com "Desfazer" (nível 1). */
  protected save(): void {
    this.form.markAllAsTouched();
    this.refreshErrors();
    if (this.form.invalid) {
      return;
    }
    if (this.form.pristine) {
      this.toasts.success('Nada mudou.');
      return;
    }
    const value: ParamsFormValue = this.form.getRawValue();
    const previousSettings = this.db.settings.get();
    const previousPlans = this.plans().map((p) => ({
      id: p.id,
      discount: p.psychSessionDiscountPercent,
      priority: p.priorityScheduling,
    }));
    this.db.settings.patch(this.settingsPatch(value));
    PLAN_IDS.forEach((id) => {
      const row = value.plans[id];
      this.db.plans.update(id, {
        psychSessionDiscountPercent: row.discount,
        priorityScheduling: row.priority,
      });
    });
    this.audit.write('update', 'settings', undefined, undefined, 'parâmetros alterados');
    this.form.markAsPristine();
    this.toasts.success('Parâmetros salvos.', {
      label: 'Desfazer',
      run: () => {
        this.db.settings.set(previousSettings);
        previousPlans.forEach((p) =>
          this.db.plans.update(p.id, {
            psychSessionDiscountPercent: p.discount,
            priorityScheduling: p.priority,
          }),
        );
        this.form.reset(this.buildValue());
        this.refreshErrors();
        this.audit.write(
          'update',
          'settings',
          undefined,
          undefined,
          'alteração de parâmetros desfeita',
        );
      },
    });
  }

  /** Volta o formulário aos valores padrão do protótipo. Só grava ao salvar. */
  protected restoreDefaults(): void {
    const defaults = defaultAppSettings();
    this.form.patchValue({
      groupDefaultCapacity: defaults.groupDefaultCapacity,
      refusalRateThresholdPercent: defaults.refusalRateThresholdPercent,
      refusalRateMinRequests: defaults.refusalRateMinRequests,
      dsrDeadlineDays: defaults.dsrDeadlineDays,
      dsrDueSoonDays: defaults.dsrDueSoonDays,
      slaHours: { ...defaults.slaHours },
      sessionCancellationHours: defaults.sessionCancellationHours,
      plans: Object.fromEntries(
        DEFAULT_PLANS.map((p) => [
          p.id,
          { discount: p.psychSessionDiscountPercent, priority: p.priorityScheduling },
        ]),
      ),
    });
    this.form.markAsDirty();
    this.refreshErrors();
  }

  private settingsPatch(value: ParamsFormValue): Partial<AppSettings> {
    return {
      groupDefaultCapacity: value.groupDefaultCapacity,
      refusalRateThresholdPercent: value.refusalRateThresholdPercent,
      refusalRateMinRequests: value.refusalRateMinRequests,
      dsrDeadlineDays: value.dsrDeadlineDays,
      dsrDueSoonDays: value.dsrDueSoonDays,
      slaHours: { ...value.slaHours },
      sessionCancellationHours: value.sessionCancellationHours,
    };
  }

  private num(value: number, min: number, max: number): FormControl<number> {
    return this.fb.control(value, [
      Validators.required,
      Validators.min(min),
      Validators.max(max),
      integerValidator,
    ]);
  }

  private buildValue(): ParamsFormValue {
    const settings = this.db.settings.get();
    const plans = Object.fromEntries(
      this.db.plans
        .list()
        .map((p) => [
          p.id,
          { discount: p.psychSessionDiscountPercent, priority: p.priorityScheduling },
        ]),
    ) as ParamsFormValue['plans'];
    return {
      groupDefaultCapacity: settings.groupDefaultCapacity,
      refusalRateThresholdPercent: settings.refusalRateThresholdPercent,
      refusalRateMinRequests: settings.refusalRateMinRequests,
      dsrDeadlineDays: settings.dsrDeadlineDays,
      dsrDueSoonDays: settings.dsrDueSoonDays,
      slaHours: { ...settings.slaHours },
      sessionCancellationHours: settings.sessionCancellationHours,
      plans,
    };
  }

  private buildForm() {
    const v = this.buildValue();
    const planGroup = (id: PlanId) =>
      this.fb.group({
        discount: this.num(v.plans[id]?.discount ?? 0, 0, 100),
        priority: this.fb.control(v.plans[id]?.priority ?? false),
      });
    return this.fb.group({
      groupDefaultCapacity: this.num(v.groupDefaultCapacity, 1, 100),
      refusalRateThresholdPercent: this.num(v.refusalRateThresholdPercent, 1, 100),
      refusalRateMinRequests: this.num(v.refusalRateMinRequests, 1, 100),
      dsrDeadlineDays: this.num(v.dsrDeadlineDays, 1, 60),
      dsrDueSoonDays: this.num(v.dsrDueSoonDays, 1, 15),
      slaHours: this.fb.group({
        app: this.num(v.slaHours.app, 1, 72),
        whatsapp: this.num(v.slaHours.whatsapp, 1, 72),
        phone: this.num(v.slaHours.phone, 0, 72),
        email: this.num(v.slaHours.email, 1, 72),
      }),
      sessionCancellationHours: this.num(v.sessionCancellationHours, 0, 168),
      plans: this.fb.group({
        livre: planGroup('livre'),
        essencial: planGroup('essencial'),
        cuida: planGroup('cuida'),
        sustenta: planGroup('sustenta'),
      }),
    });
  }

  /** Frases do resumo de erros: as mesmas dos campos. */
  private errorList(): string[] {
    const list: string[] = [];
    this.sections.forEach((s) =>
      s.fields.forEach((f) => {
        const c = this.control(f.key);
        if (c.invalid && c.touched) {
          list.push(
            c.errors?.['required']
              ? `Informe ${f.noun}.`
              : `${f.noun.charAt(0).toUpperCase()}${f.noun.slice(1)} deve ser um número inteiro de ${f.min} a ${f.max}.`,
          );
        }
      }),
    );
    PLAN_IDS.forEach((id) => {
      const c = this.planControl(id, 'discount');
      if (c.invalid && c.touched) {
        list.push(
          c.errors?.['required']
            ? 'Informe o desconto.'
            : 'O desconto deve ser um número inteiro de 0 a 100.',
        );
      }
    });
    return list;
  }

  private refreshErrors(): void {
    this.tick.update((n) => n + 1);
  }
}
