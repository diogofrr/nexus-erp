import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject } from '@angular/core';
import { AuditLogService } from '@core/audit';
import { Clock, dateOf } from '@core/clock';
import { Database } from '@core/data';
import { formatMoney, formatNumber, formatPercent } from '@core/format';
import { FinancialParams, ScenarioKey } from '@core/models';
import {
  PLAN_REFERENCE,
  ProjectionResult,
  conversionRatePercent,
  isWithinTolerance,
  projectAllScenarios,
  realizedFinance,
  restoreFinancialParams,
} from '@core/rules/finance';
import { changedFinancialParamPaths, projectionToCsv } from '@core/rules/finance-params';
import { countFreeUsers, countSubscribers } from '@core/rules/kpi';
import { downloadTextFile } from './download';

export const SCENARIO_ORDER: readonly ScenarioKey[] = ['pessimistic', 'base', 'optimistic'];

/** Texto do rótulo de origem de todo valor de projeção (RN-FIN-32). */
export const ESTIMATE_TAG = 'estimativa do plano';
/** Texto do rótulo de origem do realizado (UX 5.13). */
export const SYSTEM_DATA_TAG = 'dado do sistema';

export interface ReferenceRow {
  label: string;
  /** Valor literal do documento (o texto inclui "cerca de" quando o documento diz assim). */
  plan: string;
  simulated: string;
  /** "igual", "dentro de 0,5%" ou "diferença de ...". */
  difference: string;
  matches: boolean;
}

function monthLabel(month: number): string {
  return `mês ${month}`;
}

function integerRow(label: string, plan: number | null, simulated: number | null): ReferenceRow {
  const same = plan === simulated;
  return {
    label,
    plan: plan === null ? 'n/d' : String(plan),
    simulated: simulated === null ? 'não chega nos 24 meses' : String(simulated),
    difference: same ? 'igual' : 'diferente do plano',
    matches: same,
  };
}

function moneyRow(
  label: string,
  planCents: number,
  simulatedCents: number,
  approximate: boolean,
): ReferenceRow {
  const diff = simulatedCents - planCents;
  const within = isWithinTolerance(simulatedCents, planCents);
  const pct = planCents === 0 ? 0 : (Math.abs(diff) / Math.abs(planCents)) * 100;
  return {
    label,
    plan: `${approximate ? 'cerca de ' : ''}${formatMoney(planCents)}`,
    simulated: formatMoney(simulatedCents),
    difference:
      diff === 0
        ? 'igual'
        : within
          ? `${formatMoney(Math.abs(diff))} (${formatPercent(pct, { decimals: 2 })}, dentro de 0,5%)`
          : `${formatMoney(Math.abs(diff))} (${formatPercent(pct, { decimals: 1 })})`,
    matches: within,
  };
}

/**
 * Estado e contas do Financeiro (M10). Lê os parâmetros e as assinaturas pelos repositórios e usa SÓ as regras
 * puras de `core/rules`: nada de fórmula na tela. Alterar um parâmetro grava no `Database` e tudo o que
 * depende dele (realizado, projeção, equilíbrio, aporte) recalcula na hora, em todas as telas.
 */
@Injectable({ providedIn: 'root' })
export class FinanceStore {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly audit = inject(AuditLogService);
  private readonly doc = inject(DOCUMENT);

  /** Parâmetros vigentes (os do plano, a menos que alguém tenha editado). */
  readonly params = this.db.financialParams.value;

  /** K01 e K02: assinantes pagos por plano e usuários gratuitos acumulados. */
  readonly subscriberCounts = computed(() => countSubscribers(this.db.subscriptions.all()));
  readonly freeUsers = computed(() => countFreeUsers(this.db.caregivers.all()));

  /** K03 a K11: o realizado do mês (dado do sistema). */
  readonly realized = computed(() =>
    realizedFinance(this.params(), this.subscriberCounts().byPlan),
  );
  readonly conversionPercent = computed(() =>
    conversionRatePercent(this.subscriberCounts().total, this.freeUsers()),
  );

  /** K12 a K14: os três cenários. */
  readonly scenarios = computed(() => projectAllScenarios(this.params()));

  /** Campos que diferem dos valores do plano (selo "alterado"). */
  readonly changedPaths = computed(() => changedFinancialParamPaths(this.params()));
  readonly differsFromPlan = computed(() => this.changedPaths().length > 0);

  readonly monthLabel = computed(() => this.clock.currentMonth());

  scenarioLabel(key: ScenarioKey): string {
    return formatPercent(Math.round(this.params().scenarios[key] * 10000) / 100);
  }

  /** Quanto do caminho até o equilíbrio já foi andado (0 a 100). */
  readonly breakEvenProgress = computed(() => {
    const r = this.realized();
    return r.breakEven > 0 && Number.isFinite(r.breakEven)
      ? Math.min(100, Math.round((r.subscribers / r.breakEven) * 100))
      : 0;
  });

  /**
   * Receitas que ficam FORA da projeção do plano (RN-FIN-10, RN-CORP-05): canal corporativo (vagas ativas x
   * valor por vaga, suposição), economia concedida pelo Cartão Nexus no mês e horas de atendimento
   * psicológico no mês. Mostradas à parte, nunca somadas ao resultado.
   */
  readonly outsideProjection = computed(() => {
    const month = this.clock.currentMonth();
    const accounts = this.db.corporateAccounts.all().filter((a) => a.status === 'active');
    const activeSeats = this.db.corporateSeats
      .all()
      .filter((s) => s.status === 'active' && accounts.some((a) => a.id === s.corporateAccountId));
    const corporateCents = accounts.reduce(
      (sum, a) =>
        sum +
        a.seatPriceCents *
          activeSeats.filter((s) => s.corporateAccountId === a.id).length,
      0,
    );
    const cardSavings = this.db.cardUsages
      .all()
      .filter((u) => u.date.startsWith(month))
      .reduce((sum, u) => sum + u.discountCents, 0);
    const doneHours = this.db.careSessions
      .all()
      .filter((s) => s.status === 'done' && dateOf(s.startAt).startsWith(month)).length;
    return {
      corporateAccounts: accounts.length,
      corporateSeats: activeSeats.length,
      corporateCents,
      cardSavingsCents: cardSavings,
      doneHours,
    };
  });

  /** Quadro "conferência com o plano de negócios" (RN-FIN-27): literal do documento ao lado do simulado. */
  referenceRows(key: ScenarioKey): ReferenceRow[] {
    const result = this.scenarios()[key];
    if (key === 'base') {
      const ref = PLAN_REFERENCE.base;
      const rows: ReferenceRow[] = [
        integerRow('Primeiro mês de lucro', ref.firstProfitMonth, result.firstProfitMonth),
        integerRow('Retorno do investimento (mês)', ref.paybackMonth, result.paybackMonth),
      ];
      (Object.keys(ref.subscribersByMonth) as unknown as number[])
        .map(Number)
        .forEach((month) => {
          rows.push(
            integerRow(
              `Assinantes no ${monthLabel(month)}`,
              ref.subscribersByMonth[month] as number,
              result.rows[month - 1]?.subscribers ?? null,
            ),
          );
        });
      rows.push(
        moneyRow('Mensalidades do primeiro ano', ref.firstYearGrossCents, result.firstYear.grossRevenueCents, false),
        moneyRow('Resultado do primeiro ano', ref.firstYearResultCents, result.firstYear.resultCents, false),
        moneyRow('Saldo no mês 24', ref.cumulativeMonth24Cents, result.month24BalanceCents, true),
      );
      return rows;
    }
    if (key === 'pessimistic') {
      const ref = PLAN_REFERENCE.pessimistic;
      return [
        integerRow('Primeiro mês de lucro', ref.firstProfitMonth, result.firstProfitMonth),
        integerRow('Retorno do investimento (mês)', ref.paybackMonth, result.paybackMonth),
        moneyRow('Aporte extra dos sócios', ref.extraContributionCents, result.extraContributionCents, true),
      ];
    }
    const ref = PLAN_REFERENCE.optimistic;
    return [
      integerRow('Primeiro mês de lucro', ref.firstProfitMonth, result.firstProfitMonth),
      integerRow('Retorno do investimento (mês)', ref.paybackMonth, result.paybackMonth),
    ];
  }

  // ===== Gravação dos parâmetros =====

  /** Grava os parâmetros (já validados pela tela). Tudo o que depende deles recalcula. */
  saveParams(next: FinancialParams): void {
    this.db.financialParams.set(next);
  }

  /** "Restaurar valores do plano": volta aos números do documento (AC-M10-06). Devolve o estado anterior. */
  restoreParams(): FinancialParams {
    const previous = this.db.financialParams.get();
    this.db.financialParams.set(restoreFinancialParams());
    this.audit.write('update', 'financial_params', undefined, undefined, 'valores do plano restaurados');
    return previous;
  }

  /** Desfaz o restaurar (reversível pelo mesmo desfazer, UX F14). */
  revertParams(previous: FinancialParams): void {
    this.db.financialParams.set(previous);
    this.audit.write('update', 'financial_params', undefined, undefined, 'restauração desfeita');
  }

  /** Uma linha de log por sessão de edição (não por tecla). */
  logParamsEdited(changedFields: number): void {
    this.audit.write(
      'update',
      'financial_params',
      undefined,
      undefined,
      `${changedFields} ${changedFields === 1 ? 'campo diferente' : 'campos diferentes'} do plano`,
    );
  }

  // ===== Exportação (SCR-M10-08) =====

  csvFileName(key: ScenarioKey): string {
    return `nexus-projecao-${this.scenarioLabel(key).replace('%', 'pct').replace(',', '-')}-estimativa.csv`;
  }

  /** Baixa a tabela do cenário em CSV. Não inclui dado pessoal. */
  exportCsv(key: ScenarioKey): boolean {
    const result: ProjectionResult = this.scenarios()[key];
    this.audit.exported('financial_projection', undefined, `CSV do cenário ${this.scenarioLabel(key)}`);
    return downloadTextFile(
      this.doc,
      this.csvFileName(key),
      projectionToCsv(result),
      'text/csv;charset=utf-8',
    );
  }

  /** Baixa os parâmetros em JSON. */
  exportParamsJson(): boolean {
    this.audit.exported('financial_params', undefined, 'JSON dos parâmetros');
    return downloadTextFile(
      this.doc,
      'nexus-parametros-financeiros.json',
      JSON.stringify(this.params(), null, 2),
      'application/json;charset=utf-8',
    );
  }

  // ===== Formatação usada por várias telas =====

  money(cents: number | null | undefined): string {
    return formatMoney(cents);
  }

  number(value: number | null | undefined, decimals = 0): string {
    return formatNumber(value, decimals);
  }
}
