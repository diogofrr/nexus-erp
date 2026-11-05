import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Clock } from '@core/clock';
import { formatMoney, formatNumber, formatTime } from '@core/format';
import { FinancialParams } from '@core/models';
import {
  averageGrossFromParams,
  averageNetFromParams,
  breakEvenExact,
  monthlyCostsTotalCents,
} from '@core/rules/finance';
import { ParamIssue, mixTotalPercent, validateFinancialParams } from '@core/rules/finance-params';
import {
  BannerComponent,
  ToastService,
} from '@shared/ui/overlay';
import {
  CardComponent,
  ErrorSummaryComponent,
  ErrorSummaryItem,
  FormFieldComponent,
  IconComponent,
  NxInputDirective,
  NxMaskDirective,
  PageHeaderComponent,
} from '@shared/ui';
import { FinanceTabsComponent } from '../components/finance-tabs.component';
import { FinanceStore, SCENARIO_ORDER } from '../state/finance.store';

type NumberControl = FormControl<number | null>;

interface FieldDef {
  key: string;
  /** Caminho em `FinancialParams`, o mesmo de `validateFinancialParams`. */
  path: string;
  label: string;
  hint?: string;
}

const PRICE_FIELDS: readonly FieldDef[] = [
  { key: 'priceEssencial', path: 'planPricesCents.essencial', label: 'Preço do Nexus Essencial' },
  { key: 'priceCuida', path: 'planPricesCents.cuida', label: 'Preço do Nexus Cuida' },
  { key: 'priceSustenta', path: 'planPricesCents.sustenta', label: 'Preço do Nexus Sustenta' },
];
const MIX_FIELDS: readonly FieldDef[] = [
  { key: 'mixEssencial', path: 'planMix.essencial', label: 'Participação do Essencial (%)' },
  { key: 'mixCuida', path: 'planMix.cuida', label: 'Participação do Cuida (%)' },
  { key: 'mixSustenta', path: 'planMix.sustenta', label: 'Participação do Sustenta (%)' },
];
const COST_FIELDS: readonly FieldDef[] = [
  { key: 'coworking', path: 'monthlyCostsCents.coworking', label: 'Coworking (salas)' },
  { key: 'appMaintenance', path: 'monthlyCostsCents.appMaintenance', label: 'Manutenção do aplicativo' },
  { key: 'accounting', path: 'monthlyCostsCents.accounting', label: 'Contabilidade' },
  { key: 'travel', path: 'monthlyCostsCents.travel', label: 'Deslocamentos' },
];
const INVEST_FIELDS: readonly FieldDef[] = [
  { key: 'invApp', path: 'initialInvestmentCents.appAndSite', label: 'Aplicativo e site' },
  { key: 'invCompany', path: 'initialInvestmentCents.company', label: 'Abertura da empresa' },
  { key: 'invLawyer', path: 'initialInvestmentCents.lawyer', label: 'Serviços de advogado' },
  { key: 'reserve', path: 'reserveCents', label: 'Reserva dos sócios' },
];
const SCENARIO_FIELDS: readonly FieldDef[] = [
  { key: 'scenPess', path: 'scenarios.pessimistic', label: 'Cenário pessimista (%)', hint: 'Assinantes a cada 100 usuários gratuitos.' },
  { key: 'scenBase', path: 'scenarios.base', label: 'Cenário-base (%)', hint: 'Assinantes a cada 100 usuários gratuitos.' },
  { key: 'scenOpt', path: 'scenarios.optimistic', label: 'Cenário otimista (%)', hint: 'Assinantes a cada 100 usuários gratuitos.' },
];

const SERIES_LENGTH = 24;

function fieldId(path: string): string {
  return `fp-${path.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}`;
}

/** Fração (0,4) para porcentagem de 1 casa (40). */
function toPercent(fraction: number): number {
  return Math.round(fraction * 10000) / 100;
}

/** Porcentagem digitada (40) para fração (0,4), sem ponto flutuante torto. */
function toFraction(percent: number | null): number {
  return percent === null ? Number.NaN : Math.round(percent * 100) / 10000;
}

/** Lê "3, 15" ou "3 e 15" como lista de meses. Texto que não é número vira `NaN` (a validação recusa). */
export function parseMonths(text: string): number[] {
  const tokens = text
    .replace(/\s+e\s+/gi, ',')
    .split(/[,;\s]+/)
    .filter((t) => t.length > 0);
  return tokens.map((t) => (/^\d+$/.test(t) ? Number(t) : Number.NaN));
}

/**
 * SCR-M10-03 Parâmetros financeiros (`/app/financeiro/parametros`). Preços, participação de cada plano, taxa
 * de 11%, gastos, manutenção anual, investimento, reserva, conversão dos cenários e a série de usuários
 * gratuitos. Cada mudança válida é gravada na hora e tudo recalcula (resultado ao lado, Visão geral, Projeção,
 * Investimento, Custos e painel). Campo diferente do plano ganha "(alterado)"; "Restaurar valores do plano"
 * volta aos números do documento, com desfazer (AC-M10-06, F14).
 */
@Component({
  selector: 'app-finance-params-page',
  imports: [
    ReactiveFormsModule,
    BannerComponent,
    CardComponent,
    ErrorSummaryComponent,
    FormFieldComponent,
    IconComponent,
    NxInputDirective,
    NxMaskDirective,
    PageHeaderComponent,
    FinanceTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      <app-page-header
        title="Parâmetros financeiros"
        description="Mude um número e todas as telas do financeiro recalculam."
      >
        <button type="button" class="btn" data-role="export-json" (click)="downloadJson()">
          <svg appIcon="download" size="sm"></svg>Baixar parâmetros (JSON)
        </button>
      </app-page-header>

      <app-finance-tabs />

      @if (store.differsFromPlan()) {
        <app-banner variant="attention" heading="Parâmetros diferentes do plano" data-role="differs">
          @if (store.changedPaths().length === 1) {
            1 campo está diferente do valor do plano de negócios.
          } @else {
            {{ store.changedPaths().length }} campos estão diferentes dos valores do plano de negócios.
          }
          <button bannerActions type="button" class="btn btn--sm" data-role="restore" (click)="restore()">
            <svg appIcon="undo-2" size="sm"></svg>Restaurar valores do plano
          </button>
        </app-banner>
      }

      <app-error-summary [items]="summary()" />

      <div class="layout-main-aside">
        <form class="stack stack--6" novalidate [formGroup]="form" aria-label="Parâmetros financeiros">
          <app-card title="Preços dos planos pagos" subtitle="Mensalidade de cada plano">
            <div class="form-grid">
              @for (f of priceFields; track f.key) {
                <app-form-field [label]="label(f)" [controlId]="id(f.path)" [error]="errorOf(f.path)">
                  <input appInput class="input--num" appMask="currency" [formControlName]="f.key" />
                </app-form-field>
              }
            </div>
          </app-card>

          <app-card
            title="Participação de cada plano"
            subtitle="Quantos assinantes escolhem cada plano. Precisa somar 100%."
          >
            <div class="stack stack--3">
              <div class="form-grid">
                @for (f of mixFields; track f.key) {
                  <app-form-field [label]="label(f)" [controlId]="id(f.path)" [error]="errorOf(f.path)">
                    <input appInput class="input--num" appMask="number" [decimals]="1" [formControlName]="f.key" />
                  </app-form-field>
                }
              </div>
              <p class="t-ui" data-role="mix-total" aria-live="polite">
                Total: <strong>{{ mixTotalText() }}</strong>
                @if (mixTotal() !== 100) {
                  <span class="badge badge--attention"><svg appIcon="triangle-alert"></svg>Falta ajustar</span>
                } @else {
                  <span class="badge badge--success"><svg appIcon="circle-check"></svg>Soma 100%</span>
                }
              </p>
              @if (errorOf('planMix'); as mixError) {
                <p class="field__error" role="alert" data-role="mix-error">
                  <svg appIcon="circle-alert" size="sm"></svg><span>{{ mixError }}</span>
                </p>
              }
            </div>
          </app-card>

          <app-card title="Impostos e taxas das plataformas" subtitle="Descontados da receita bruta">
            <div class="form-grid">
              <app-form-field [label]="feesLabel()" [controlId]="id('feesRate')" [error]="errorOf('feesRate')">
                <input appInput class="input--num" appMask="number" [decimals]="1" formControlName="feesPercent" />
              </app-form-field>
            </div>
          </app-card>

          <app-card title="Gastos mensais" subtitle="Valem desde o primeiro mês">
            <div class="stack stack--3">
              <div class="form-grid">
                @for (f of costFields; track f.key) {
                  <app-form-field [label]="label(f)" [controlId]="id(f.path)" [error]="errorOf(f.path)">
                    <input appInput class="input--num" appMask="currency" [formControlName]="f.key" />
                  </app-form-field>
                }
                <app-form-field
                  [label]="labelOf('Manutenção anual do site', 'annualSiteMaintenanceCents')"
                  [controlId]="id('annualSiteMaintenanceCents')"
                  [error]="errorOf('annualSiteMaintenanceCents')"
                >
                  <input appInput class="input--num" appMask="currency" formControlName="siteMaintenance" />
                </app-form-field>
                <app-form-field
                  [label]="labelOf('Meses em que a manutenção é paga', 'annualSiteMaintenanceMonths')"
                  hint="Números de 1 a 24, separados por vírgula."
                  [controlId]="id('annualSiteMaintenanceMonths')"
                  [error]="errorOf('annualSiteMaintenanceMonths')"
                >
                  <input appInput formControlName="maintenanceMonths" inputmode="numeric" />
                </app-form-field>
              </div>
              <p class="t-ui" data-role="costs-total">
                Gastos mensais: <strong>{{ money(costsTotal()) }}</strong> por mês.
              </p>
              <p class="t-caption">
                A hospedagem do site está a confirmar e fica fora do cálculo, como no plano.
              </p>
            </div>
          </app-card>

          <app-card title="Investimento inicial e reserva" subtitle="Dinheiro dos sócios, sem empréstimos">
            <div class="form-grid">
              @for (f of investFields; track f.key) {
                <app-form-field [label]="label(f)" [controlId]="id(f.path)" [error]="errorOf(f.path)">
                  <input appInput class="input--num" appMask="currency" [formControlName]="f.key" />
                </app-form-field>
              }
            </div>
          </app-card>

          <app-card title="Conversão dos cenários" subtitle="De cada 100 usuários gratuitos, quantos assinam">
            <div class="form-grid">
              @for (f of scenarioFields; track f.key) {
                <app-form-field [label]="label(f)" [hint]="f.hint" [controlId]="id(f.path)" [error]="errorOf(f.path)">
                  <input appInput class="input--num" appMask="number" [decimals]="1" [formControlName]="f.key" />
                </app-form-field>
              }
            </div>
          </app-card>

          <app-card
            title="Usuários gratuitos acumulados"
            subtitle="Série de 24 meses, igual para os três cenários"
          >
            <details class="chart-alt" data-role="series-details" [open]="seriesOpen()">
              <summary>{{ seriesLabel() }}</summary>
              <div class="grid grid--4" formArrayName="series">
                @for (control of seriesControls(); track $index) {
                  <app-form-field
                    [label]="'Mês ' + ($index + 1)"
                    [controlId]="id('cumulativeFreeUsersByMonth.' + $index)"
                    [error]="errorOf('cumulativeFreeUsersByMonth.' + $index)"
                  >
                    <input appInput class="input--num" appMask="number" [formControlName]="$index" />
                  </app-form-field>
                }
              </div>
            </details>
          </app-card>
        </form>

        <aside class="stack stack--3" aria-label="Resultado com estes parâmetros">
          <app-card title="Resultado com estes parâmetros" subtitle="Estimativa do plano" variant="sunken">
            <dl class="stack stack--3" data-role="live">
              <div>
                <dt class="t-caption">Receita bruta média por assinante</dt>
                <dd class="t-strong" data-role="avg-gross">{{ money(grossAverage()) }}</dd>
              </div>
              <div>
                <dt class="t-caption">Receita líquida média por assinante</dt>
                <dd class="t-strong" data-role="avg-net">{{ money(netAverage()) }}</dd>
              </div>
              <div>
                <dt class="t-caption">Ponto de equilíbrio</dt>
                <dd class="t-strong" data-role="break-even">
                  {{ breakEven() }} assinantes ({{ money(costsTotal()) }} ÷ {{ money(netAverage()) }} =
                  {{ exactText() }})
                </dd>
              </div>
              @for (item of scenarioSummary(); track item.label) {
                <div>
                  <dt class="t-caption">Cenário de {{ item.label }}</dt>
                  <dd class="t-ui">
                    Primeiro lucro: {{ item.firstProfit }}. Retorno: {{ item.payback }}. Aporte extra:
                    {{ money(item.extra) }}.
                  </dd>
                </div>
              }
              <div>
                <dt class="t-caption">Assinantes no mês 12 e no mês 24 (base)</dt>
                <dd class="t-strong">{{ base().rows[11]?.subscribers }} e {{ base().rows[23]?.subscribers }}</dd>
              </div>
              <div>
                <dt class="t-caption">Resultado do primeiro ano (base)</dt>
                <dd class="t-strong">{{ money(base().firstYear.resultCents) }}</dd>
              </div>
            </dl>
            <p class="t-caption" role="status" aria-live="polite" data-role="saved">
              {{ savedText() }}
            </p>
          </app-card>
        </aside>
      </div>
    </div>
  `,
})
export class ParamsPageComponent {
  protected readonly store = inject(FinanceStore);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly clock = inject(Clock);
  private readonly toasts = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly priceFields = PRICE_FIELDS;
  protected readonly mixFields = MIX_FIELDS;
  protected readonly costFields = COST_FIELDS;
  protected readonly investFields = INVEST_FIELDS;
  protected readonly scenarioFields = SCENARIO_FIELDS;

  private editedFields = 0;
  private readonly issues = signal<ParamIssue[]>([]);
  private readonly savedAt = signal<string | null>(null);
  private readonly tick = signal(0);

  protected readonly form = this.buildForm(this.store.params());

  protected readonly params = this.store.params;
  protected readonly base = computed(() => this.store.scenarios().base);
  protected readonly costsTotal = computed(() => monthlyCostsTotalCents(this.params()));
  protected readonly grossAverage = computed(() => averageGrossFromParams(this.params()));
  protected readonly netAverage = computed(() => averageNetFromParams(this.params()));
  protected readonly breakEven = computed(() => this.store.realized().breakEven);
  protected readonly exactText = computed(() => formatNumber(breakEvenExact(this.params()), 1));
  protected readonly mixTotal = computed(() => {
    this.tick();
    const raw = this.form.getRawValue();
    return Math.round(
      ((raw.mixEssencial ?? 0) + (raw.mixCuida ?? 0) + (raw.mixSustenta ?? 0)) * 100,
    ) / 100;
  });
  protected readonly mixTotalText = computed(() => `${formatNumber(this.mixTotal(), 1)}%`);
  protected readonly scenarioSummary = computed(() =>
    SCENARIO_ORDER.map((key) => {
      const r = this.store.scenarios()[key];
      return {
        label: this.store.scenarioLabel(key),
        firstProfit: r.firstProfitMonth === null ? 'não chega nos 24 meses' : `mês ${r.firstProfitMonth}`,
        payback: r.paybackMonth === null ? 'não chega nos 24 meses' : `mês ${r.paybackMonth}`,
        extra: r.extraContributionCents,
      };
    }),
  );
  protected readonly feesLabel = computed(() => this.labelOf('Impostos e taxas (%)', 'feesRate'));
  protected readonly seriesControls = computed(() => {
    this.tick();
    return this.seriesArray().controls;
  });
  protected readonly seriesOpen = computed(() => this.issues().some((i) => i.path.startsWith('cumulativeFreeUsersByMonth')));
  protected readonly seriesLabel = computed(() => {
    const changed = this.store.changedPaths().includes('cumulativeFreeUsersByMonth');
    return `Ver e editar os 24 meses${changed ? ' (alterado)' : ''}`;
  });

  protected readonly summary = computed<ErrorSummaryItem[]>(() =>
    this.issues().map((i) => ({ controlId: this.id(this.groupPath(i.path)), message: i.message })),
  );

  protected readonly savedText = computed(() => {
    const at = this.savedAt();
    return at ? `Alteração salva neste navegador às ${formatTime(at)}.` : 'Nada mudou desde que você abriu esta tela.';
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.onEdit());
    effect(() => {
      const current = this.store.params();
      untracked(() => this.syncFromStore(current));
    });
    this.destroyRef.onDestroy(() => {
      if (this.editedFields > 0) {
        this.store.logParamsEdited(this.store.changedPaths().length);
      }
    });
  }

  // ===== Aparência dos campos =====

  protected id(path: string): string {
    return fieldId(path);
  }

  /** O erro do grupo `planMix` aparece sob o grupo; o de cada campo, no campo. */
  protected errorOf(path: string): string | null {
    return this.issues().find((i) => i.path === path)?.message ?? null;
  }

  protected label(field: FieldDef): string {
    return this.labelOf(field.label, field.path);
  }

  protected labelOf(text: string, path: string): string {
    return this.store.changedPaths().includes(path) ? `${text} (alterado)` : text;
  }

  protected money(cents: number): string {
    return formatMoney(cents);
  }

  private groupPath(path: string): string {
    return path === 'planMix' ? 'planMix.essencial' : path;
  }

  // ===== Formulário <-> parâmetros =====

  private num(value: number | null): NumberControl {
    return this.fb.control<number | null>(value);
  }

  private seriesArray() {
    return this.form.controls.series;
  }

  private buildForm(p: FinancialParams) {
    return this.fb.group({
      priceEssencial: this.num(p.planPricesCents.essencial),
      priceCuida: this.num(p.planPricesCents.cuida),
      priceSustenta: this.num(p.planPricesCents.sustenta),
      mixEssencial: this.num(toPercent(p.planMix.essencial)),
      mixCuida: this.num(toPercent(p.planMix.cuida)),
      mixSustenta: this.num(toPercent(p.planMix.sustenta)),
      feesPercent: this.num(toPercent(p.feesRate)),
      coworking: this.num(p.monthlyCostsCents.coworking),
      appMaintenance: this.num(p.monthlyCostsCents.appMaintenance),
      accounting: this.num(p.monthlyCostsCents.accounting),
      travel: this.num(p.monthlyCostsCents.travel),
      siteMaintenance: this.num(p.annualSiteMaintenanceCents),
      maintenanceMonths: this.fb.control(p.annualSiteMaintenanceMonths.join(', ')),
      invApp: this.num(p.initialInvestmentCents.appAndSite),
      invCompany: this.num(p.initialInvestmentCents.company),
      invLawyer: this.num(p.initialInvestmentCents.lawyer),
      reserve: this.num(p.reserveCents),
      scenPess: this.num(toPercent(p.scenarios.pessimistic)),
      scenBase: this.num(toPercent(p.scenarios.base)),
      scenOpt: this.num(toPercent(p.scenarios.optimistic)),
      series: this.fb.array(
        Array.from({ length: SERIES_LENGTH }, (_, i) =>
          this.num(p.cumulativeFreeUsersByMonth[i] ?? 0),
        ),
      ),
    });
  }

  private toParams(): FinancialParams {
    const v = this.form.getRawValue();
    const cents = (value: number | null): number => (value === null ? Number.NaN : value);
    const current = this.store.params();
    return {
      planPricesCents: {
        essencial: cents(v.priceEssencial),
        cuida: cents(v.priceCuida),
        sustenta: cents(v.priceSustenta),
      },
      planMix: {
        essencial: toFraction(v.mixEssencial),
        cuida: toFraction(v.mixCuida),
        sustenta: toFraction(v.mixSustenta),
      },
      feesRate: toFraction(v.feesPercent),
      monthlyCostsCents: {
        coworking: cents(v.coworking),
        appMaintenance: cents(v.appMaintenance),
        accounting: cents(v.accounting),
        travel: cents(v.travel),
      },
      annualSiteMaintenanceCents: cents(v.siteMaintenance),
      annualSiteMaintenanceMonths: parseMonths(v.maintenanceMonths),
      hostingAnnualCents: current.hostingAnnualCents,
      initialInvestmentCents: {
        appAndSite: cents(v.invApp),
        company: cents(v.invCompany),
        lawyer: cents(v.invLawyer),
      },
      reserveCents: cents(v.reserve),
      cumulativeFreeUsersByMonth: v.series.map((n) => cents(n)),
      scenarios: {
        pessimistic: toFraction(v.scenPess),
        base: toFraction(v.scenBase),
        optimistic: toFraction(v.scenOpt),
      },
    };
  }

  private static same(a: FinancialParams, b: FinancialParams): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  private onEdit(): void {
    this.tick.update((n) => n + 1);
    const next = this.toParams();
    const found = validateFinancialParams(next);
    this.issues.set(found);
    if (found.length === 0 && !ParamsPageComponent.same(next, this.store.params())) {
      this.store.saveParams(next);
      this.savedAt.set(this.clock.now());
      this.editedFields += 1;
    }
  }

  private syncFromStore(params: FinancialParams): void {
    const formParams = this.toParams();
    if (ParamsPageComponent.same(formParams, params)) {
      return;
    }
    const fresh = this.buildForm(params);
    this.form.reset(fresh.getRawValue(), { emitEvent: false });
    this.issues.set(validateFinancialParams(params));
    this.tick.update((n) => n + 1);
  }

  // ===== Ações =====

  protected restore(): void {
    const previous = this.store.restoreParams();
    this.savedAt.set(this.clock.now());
    this.toasts.success('Valores do plano restaurados.', {
      label: 'Desfazer',
      run: () => {
        this.store.revertParams(previous);
        this.savedAt.set(this.clock.now());
      },
    });
  }

  protected downloadJson(): void {
    if (this.store.exportParamsJson()) {
      this.toasts.success('Parâmetros baixados. O arquivo não inclui dado pessoal.');
    } else {
      this.toasts.attention('Este navegador não permitiu baixar o arquivo.');
    }
  }
}
