import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { formatDate, formatNumber, formatPercent } from '@core/format';
import { PilotWindowName } from '@core/models';
import { Aggregate } from '@core/privacy';
import {
  PILOT_INDICATORS,
  PILOT_WINDOW_LABELS,
  PilotGoalResult,
  checkGoalJustification,
} from '@core/rules/pilot';
import { DialogService, DrawerComponent, ToastService } from '@shared/ui/overlay';
import {
  CardComponent,
  CellDirective,
  DataTableComponent,
  FormFieldComponent,
  IconComponent,
  KpiComponent,
  KpiStripComponent,
  NxInputDirective,
  NxMaskDirective,
  PageHeaderComponent,
  TableColumn,
  TimelineComponent,
  TimelineItem,
} from '@shared/ui';
import { CohortRow, PilotStore } from '../state/pilot.store';

type NumberControl = FormControl<number | null>;

const WINDOW_BADGE: Record<string, { label: string; variant: string; icon: string }> = {
  done: { label: 'Concluída', variant: 'success', icon: 'circle-check' },
  pending: { label: 'Pendente', variant: 'info', icon: 'clock' },
  missed: { label: 'Não coletada', variant: 'attention', icon: 'triangle-alert' },
};

/**
 * SCR-M10-07 Piloto (MVP), `/app/piloto`. A coorte (só cuidadores com TCLE ativo, por código), as janelas de
 * coleta (adesão, 3 e 6 meses), os 7 indicadores do Quadro 10 com instrumento e momento, as metas e o critério
 * de sucesso. Metas editáveis antes do início; depois, travadas e só mudam com justificativa registrada
 * (AC-M10-14). O texto fala em "indício": o piloto não tem grupo de comparação (RN-PIL-07, RN-ZRT-22).
 */
@Component({
  selector: 'app-finance-pilot-page',
  imports: [
    ReactiveFormsModule,
    CardComponent,
    CellDirective,
    DataTableComponent,
    DrawerComponent,
    FormFieldComponent,
    IconComponent,
    KpiComponent,
    KpiStripComponent,
    NxInputDirective,
    NxMaskDirective,
    PageHeaderComponent,
    TimelineComponent,
    NgTemplateOutlet,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .plain-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }
  `,
  template: `
    <div class="page stack stack--6">
      <app-page-header
        title="Piloto"
        [description]="'Seis meses com um grupo inicial de famílias de Uberlândia. ' + cohortText()"
      >
        @if (store.canEdit() && !store.config().startedAt) {
          <button type="button" class="btn btn--primary" data-role="start" (click)="start()">Iniciar o piloto</button>
        }
      </app-page-header>

      <p class="t-ui" data-role="hypothesis">
        Hipótese: reunir organização da rotina, acesso a profissionais e benefícios em um só lugar
        reduz o tempo e a sobrecarga de quem cuida e gera disposição para pagar por um plano.
      </p>

      <app-kpi-strip>
        <app-kpi label="Famílias na coorte" [value]="store.cohort().length" context="com o termo de consentimento ativo" />
        <app-kpi label="Início do piloto" [value]="startText()" [context]="'duração de ' + store.config().durationMonths + ' meses'" />
        <app-kpi label="Metas" [value]="store.config().goalsLocked ? 'Travadas' : 'Editáveis'" [context]="goalsContext()" />
      </app-kpi-strip>

      <app-card title="Coorte e janelas de coleta" subtitle="Só entram cuidadores com o termo de consentimento do piloto ativo">
        <div class="stack stack--3">
          <app-data-table
            caption="Coorte do piloto, por código"
            noun="famílias"
            [rows]="store.cohort()"
            [columns]="columns"
            [stack]="false"
            [rowKey]="rowKey"
            emptyTitle="Nenhuma família no piloto"
            emptyText="Quando um cuidador assinar o termo de consentimento do piloto, o código aparece aqui."
          >
            <ng-template appCell="code" let-row>
              <span class="code-chip"><svg appIcon="shield-check"></svg>{{ row.code }}</span>
            </ng-template>
            <ng-template appCell="enrollment" let-row>
              <ng-container *ngTemplateOutlet="windowBadge; context: { $implicit: windowStatus(row, 'enrollment') }" />
            </ng-template>
            <ng-template appCell="month3" let-row>
              <ng-container *ngTemplateOutlet="windowBadge; context: { $implicit: windowStatus(row, 'month3') }" />
            </ng-template>
            <ng-template appCell="month6" let-row>
              <ng-container *ngTemplateOutlet="windowBadge; context: { $implicit: windowStatus(row, 'month6') }" />
            </ng-template>
          </app-data-table>
          <ng-template #windowBadge let-status>
            <span class="badge" [class.badge--success]="status === 'done'" [class.badge--info]="status === 'pending'" [class.badge--attention]="status === 'missed'">
              <svg [appIcon]="badge(status).icon"></svg>{{ badge(status).label }}
            </span>
          </ng-template>
          <ul class="cluster plain-list" data-role="window-counts" aria-label="Janelas de coleta, resumo">
            @for (w of store.summary().windows; track w.name) {
              <li class="badge badge--outline">
                {{ windowLabel(w.name) }}: {{ w.done }} concluídas, {{ w.pending }} pendentes, {{ w.missed }} não coletadas
              </li>
            }
          </ul>
          <p class="t-caption">
            Critérios de inclusão: ser o familiar cuidador principal de uma pessoa idosa com algum
            grau de dependência, morar em Uberlândia e concordar com o termo de consentimento.
            Quem revoga o termo sai da coorte.
          </p>
        </div>
      </app-card>

      <section class="stack stack--3" aria-labelledby="pilot-indicators">
        <h2 id="pilot-indicators" class="t-strong">Os 7 indicadores do piloto</h2>
        <div class="grid grid--2" data-role="indicators">
          @for (item of indicators(); track item.key) {
            <app-card [title]="item.label" [subtitle]="item.moment" [attr.data-indicator]="item.key">
              <div class="stack stack--2">
                <p class="t-ui" data-role="value">{{ item.value }}</p>
                @if (item.detail) {
                  <p class="t-caption">{{ item.detail }}</p>
                }
                <p class="t-caption"><strong>Instrumento:</strong> {{ item.instrument }}</p>
              </div>
            </app-card>
          }
        </div>
        <p class="t-caption" data-role="evidence-note">
          O piloto não tem grupo de comparação. Uma queda nos escores é um indício, não uma prova:
          mudanças na rotina ou no quadro da pessoa idosa também podem influenciar. Recortes com
          menos de 5 famílias aparecem como "menos de 5".
        </p>
      </section>

      <app-card title="Metas e critério de sucesso" subtitle="Definidas antes do início do piloto">
        <div class="stack stack--3">
          <ul class="stack stack--3" data-role="goals">
            @for (goal of goalRows(); track goal.key) {
              <li class="cluster cluster--between" [attr.data-goal]="goal.key">
                <span>
                  <strong>{{ goal.label }}</strong><br />
                  <span class="t-caption">{{ goal.current }}</span>
                </span>
                <span class="badge" [class.badge--success]="goal.status === 'reached'" [class.badge--attention]="goal.status === 'not_reached'" [class.badge--outline]="goal.status === 'insufficient'">
                  {{ statusText(goal.status) }}
                </span>
              </li>
            }
          </ul>
          <p class="t-caption">
            Resultados abaixo das metas indicam revisão do produto antes da expansão. O piloto mede
            a conversão antes de qualquer investimento adicional.
          </p>
          <div class="cluster">
            @if (store.canEdit()) {
              <button type="button" class="btn" data-role="edit-goals" (click)="openGoals()">
                {{ store.editableDirectly() ? 'Editar metas' : 'Registrar mudança de meta' }}
              </button>
            }
            @if (!store.editableDirectly()) {
              <span class="badge badge--outline" data-role="locked">
                <svg appIcon="lock"></svg>Metas travadas desde {{ startText() }}
              </span>
            }
          </div>
          @if (changeLog().length > 0) {
            <div class="stack stack--2" data-role="goal-log">
              <h3 class="t-strong">Mudanças de meta registradas</h3>
              <app-timeline label="Mudanças de meta do piloto" [items]="changeLog()" />
            </div>
          }
        </div>
      </app-card>

      @if (store.canEdit()) {
      <app-drawer
        [(open)]="drawerOpen"
        heading="Metas do piloto"
        [subtitle]="store.editableDirectly() ? 'Ainda dá para editar direto' : 'Piloto iniciado: a mudança exige justificativa'"
      >
        <form id="pilot-goals-form" class="stack stack--3" novalidate [formGroup]="goalsForm" (ngSubmit)="submitGoals()">
          <app-form-field
            label="Redução mínima da sobrecarga (%)"
            hint="Redução média entre a adesão e a aplicação mais recente."
            controlId="pg-zarit"
            [error]="goalError('zarit')"
          >
            <input appInput class="input--num" appMask="number" [decimals]="1" formControlName="zarit" />
          </app-form-field>
          <app-form-field
            label="Satisfação média mínima (de 1 a 5)"
            controlId="pg-satisfaction"
            [error]="goalError('satisfaction')"
          >
            <input appInput class="input--num" appMask="number" [decimals]="1" formControlName="satisfaction" />
          </app-form-field>
          <app-form-field label="Conversão mínima (%)" controlId="pg-conversion" [error]="goalError('conversion')">
            <input appInput class="input--num" appMask="number" [decimals]="1" formControlName="conversion" />
          </app-form-field>
          @if (!store.editableDirectly()) {
            <app-form-field
              label="Justificativa da mudança"
              hint="Fica registrada com a data e o seu nome."
              controlId="pg-justification"
              [error]="goalError('justification')"
            >
              <textarea appInput formControlName="justification" rows="4"></textarea>
            </app-form-field>
          }
        </form>
        <ng-container drawerFooter>
          <button type="button" class="btn" (click)="drawerOpen.set(false)">Cancelar</button>
          <button type="submit" form="pilot-goals-form" class="btn btn--primary" data-role="save-goals">
            {{ store.editableDirectly() ? 'Salvar metas' : 'Registrar mudança' }}
          </button>
        </ng-container>
      </app-drawer>
      }
    </div>
  `,
})
export class PilotPageComponent {
  protected readonly store = inject(PilotStore);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);

  protected readonly drawerOpen = signal(false);
  private readonly submitted = signal(false);
  private readonly formTick = signal(0);

  protected readonly goalsForm = this.fb.group({
    zarit: this.fb.control<number | null>(null) as NumberControl,
    satisfaction: this.fb.control<number | null>(null) as NumberControl,
    conversion: this.fb.control<number | null>(null) as NumberControl,
    justification: this.fb.control(''),
  });

  protected readonly columns: TableColumn<CohortRow>[] = [
    { key: 'code', header: 'Código', primary: true, value: (r) => r.code },
    { key: 'entered', header: 'Entrada', value: (r) => formatDate(r.enrollment.enrolledAt) },
    { key: 'monthOfPilot', header: 'Mês do piloto', value: (r) => `${r.month} de 6` },
    { key: 'enrollment', header: 'Adesão', noSearch: true },
    { key: 'month3', header: '3 meses', noSearch: true },
    { key: 'month6', header: '6 meses', noSearch: true },
  ];
  protected readonly rowKey = (row: CohortRow): string => row.enrollment.id;

  protected readonly cohortText = computed(() => {
    const n = this.store.cohort().length;
    return `${n} ${n === 1 ? 'família' : 'famílias'} com o termo de consentimento ativo.`;
  });
  protected readonly startText = computed(() => {
    const date = this.store.config().startedAt;
    return date ? formatDate(date) : 'Ainda não iniciado';
  });
  protected readonly goalsContext = computed(() =>
    this.store.config().goalsLocked
      ? 'mudança só com justificativa'
      : 'dá para editar antes do início',
  );

  protected readonly changeLog = computed<TimelineItem[]>(() =>
    [...this.store.config().goalChangeLog]
      .reverse()
      .map((entry, i) => ({
        id: `goal-${i}`,
        title: 'Metas alteradas',
        text: entry.justification,
        timeLabel: formatDate(entry.at),
        tone: 'gold' as const,
      })),
  );

  // ===== Indicadores =====

  private agg(a: Aggregate<number>, format: (v: number) => string): string {
    return a.sufficient ? format(a.value) : a.shortLabel;
  }

  protected readonly indicators = computed(() => {
    const s = this.store.summary();
    const commercialOnly = 'Disponível só para a gestão.';
    const evolution = s.zaritEvolution.sufficient
      ? s.zaritEvolution.value === null
        ? 'n/d'
        : formatPercent(s.zaritEvolution.value, { decimals: 1, signed: true })
      : s.zaritEvolution.shortLabel;
    const values: Record<string, { value: string; detail?: string }> = {
      overload: {
        value: `Média na adesão: ${this.agg(s.zaritMean.enrollment, (v) => formatNumber(v, 1))}. Aos 3 meses: ${this.agg(s.zaritMean.month3, (v) => formatNumber(v, 1))}. Aos 6 meses: ${this.agg(s.zaritMean.month6, (v) => formatNumber(v, 1))}.`,
        detail: `Evolução média até aqui: ${evolution}. Negativo indica redução; é um indício, não uma prova.`,
      },
      time: {
        value: `Variação média: ${this.agg(s.weeklyHoursDelta, (v) => `${formatNumber(v, 1)} h por semana`)}.`,
        detail: 'Horas semanais no final menos as do início. Negativo indica menos tempo gasto organizando o cuidado.',
      },
      usage: {
        value: `Usuários ativos nos últimos 30 dias: ${this.agg(s.usageActive, (v) => formatPercent(v, { decimals: 1 }))}.`,
      },
      satisfaction: {
        value: `Satisfação média: ${this.agg(s.satisfaction, (v) => `${formatNumber(v, 2)} de 5`)}. Recomendariam: ${this.agg(s.recommendation, (v) => formatPercent(v, { decimals: 1 }))}.`,
      },
      conversion: this.store.seesCommercial()
        ? {
            value:
              s.conversion.percent === null
                ? 'Sem famílias na coorte.'
                : `${s.conversion.paid} de ${s.conversion.total} famílias assinam um plano pago (${formatPercent(s.conversion.percent, { decimals: 1 })}).`,
          }
        : { value: commercialOnly },
      willingness: this.store.seesCommercial()
        ? {
            value: this.willingnessText(),
            detail: 'Planos escolhidos no final do piloto. Os motivos ficam com a gestão, sem texto livre aqui.',
          }
        : { value: commercialOnly },
      network: {
        value: `Nota média dada à rede pela coorte: ${this.agg(s.networkRating, (v) => formatNumber(v, 2))}.`,
      },
    };
    return PILOT_INDICATORS.map((def) => ({ ...def, ...values[def.key] }) as {
      key: string;
      label: string;
      instrument: string;
      moment: string;
      value: string;
      detail?: string;
    });
  });

  private willingnessText(): string {
    const plans = this.store.summary().chosenPlans;
    const names: Record<string, string> = { livre: 'Livre', essencial: 'Essencial', cuida: 'Cuida', sustenta: 'Sustenta' };
    const parts = (Object.keys(plans) as (keyof typeof plans)[]).map(
      (plan) => `${names[plan] ?? plan}: ${this.agg(plans[plan] as Aggregate<number>, (v) => String(v))}`,
    );
    return parts.length === 0 ? 'Ninguém respondeu ainda.' : parts.join('. ') + '.';
  }

  // ===== Metas =====

  protected readonly goalRows = computed(() => {
    const goals = this.store.summary().goals;
    const rows: { key: string; label: string; current: string; status: PilotGoalResult['status'] }[] = [
      {
        key: 'zarit',
        label: `Redução média da sobrecarga de pelo menos ${formatPercent(goals.zaritReduction.goal, { decimals: 1 })}`,
        current:
          goals.zaritReduction.value === null
            ? 'Menos de 5 famílias com duas aplicações: o valor não aparece.'
            : `Redução observada: ${formatPercent(goals.zaritReduction.value, { decimals: 1 })} (indício).`,
        status: goals.zaritReduction.status,
      },
      {
        key: 'satisfaction',
        label: `Satisfação média de pelo menos ${formatNumber(goals.satisfaction.goal, 1)}`,
        current:
          goals.satisfaction.value === null
            ? 'Menos de 5 respostas: o valor não aparece.'
            : `Satisfação observada: ${formatNumber(goals.satisfaction.value, 2)} de 5.`,
        status: goals.satisfaction.status,
      },
    ];
    if (this.store.seesCommercial()) {
      rows.push({
        key: 'conversion',
        label: `Conversão de pelo menos ${formatPercent(goals.conversion.goal, { decimals: 1 })}`,
        current:
          goals.conversion.value === null
            ? 'Sem dados suficientes.'
            : `Conversão observada: ${formatPercent(goals.conversion.value, { decimals: 1 })}.`,
        status: goals.conversion.status,
      });
    }
    return rows;
  });

  protected statusText(status: PilotGoalResult['status']): string {
    return status === 'reached'
      ? 'Meta atingida (indício)'
      : status === 'not_reached'
        ? 'Abaixo da meta'
        : 'Dado insuficiente';
  }

  protected windowLabel(name: PilotWindowName): string {
    return PILOT_WINDOW_LABELS[name];
  }

  protected windowStatus(row: CohortRow, name: PilotWindowName): string {
    return row.enrollment.windows.find((w) => w.name === name)?.status ?? 'pending';
  }

  protected badge(status: string): { label: string; variant: string; icon: 'circle-check' | 'clock' | 'triangle-alert' } {
    return (WINDOW_BADGE[status] ?? WINDOW_BADGE['pending']) as {
      label: string;
      variant: string;
      icon: 'circle-check' | 'clock' | 'triangle-alert';
    };
  }

  // ===== Edição das metas =====

  protected openGoals(): void {
    const goals = this.store.config().goals;
    this.goalsForm.reset({
      zarit: goals.zaritReductionPercent,
      satisfaction: goals.satisfactionMin,
      conversion: goals.conversionPercent,
      justification: '',
    });
    this.submitted.set(false);
    this.formTick.update((n) => n + 1);
    this.drawerOpen.set(true);
  }

  protected goalError(field: 'zarit' | 'satisfaction' | 'conversion' | 'justification'): string | null {
    this.formTick();
    if (!this.submitted()) {
      return null;
    }
    const v = this.goalsForm.getRawValue();
    switch (field) {
      case 'zarit':
        return v.zarit === null || v.zarit < 0 || v.zarit > 100
          ? 'A redução mínima deve ser de 0% a 100%.'
          : null;
      case 'satisfaction':
        return v.satisfaction === null || v.satisfaction < 1 || v.satisfaction > 5
          ? 'A satisfação mínima deve ser de 1 a 5.'
          : null;
      case 'conversion':
        return v.conversion === null || v.conversion < 0 || v.conversion > 100
          ? 'A conversão mínima deve ser de 0% a 100%.'
          : null;
      default:
        return checkGoalJustification(this.store.config(), v.justification).message;
    }
  }

  protected async submitGoals(): Promise<void> {
    this.submitted.set(true);
    this.formTick.update((n) => n + 1);
    const v = this.goalsForm.getRawValue();
    if (
      this.goalError('zarit') ||
      this.goalError('satisfaction') ||
      this.goalError('conversion') ||
      this.goalError('justification')
    ) {
      return;
    }
    const goals = {
      zaritReductionPercent: v.zarit as number,
      satisfactionMin: v.satisfaction as number,
      conversionPercent: v.conversion as number,
    };
    if (!this.store.editableDirectly()) {
      const { confirmed } = await this.dialogs.confirm({
        title: 'Mudar as metas do piloto?',
        message: 'O piloto já começou. As metas novas passam a valer e a sua justificativa fica registrada.',
        effects: {
          keep: ['as metas anteriores no histórico de mudanças', 'a justificativa, com a data'],
        },
        confirmLabel: 'Mudar as metas',
      });
      if (!confirmed) {
        return;
      }
    }
    const result = this.store.saveGoals(goals, v.justification);
    if (!result.ok) {
      this.toasts.attention(result.message ?? 'Não foi possível salvar as metas.');
      return;
    }
    this.drawerOpen.set(false);
    this.toasts.success('Metas do piloto salvas.');
  }

  protected async start(): Promise<void> {
    const { confirmed } = await this.dialogs.confirm({
      title: 'Iniciar o piloto hoje?',
      message: 'O critério de sucesso precisa estar definido antes do início.',
      effects: { block: ['a edição direta das metas: depois, só com justificativa'] },
      confirmLabel: 'Iniciar o piloto',
    });
    if (confirmed) {
      this.store.start();
      this.toasts.success('Piloto iniciado. As metas ficaram travadas.');
    }
  }
}
