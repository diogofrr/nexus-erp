import { Audited, Cents, ID, ISODate, ISODateTime } from './primitives';
import { PaidPlanId, PlanId } from './plans';
import { ArbeSettings } from './zarit';

/** Parâmetros financeiros editáveis (M10). Os padrões são os do plano de negócios (A.0). */
export interface FinancialParams {
  planPricesCents: Record<PaidPlanId, Cents>;
  /** Mix de assinantes pagos (frações que somam 1): 0,4 / 0,3 / 0,3. */
  planMix: Record<PaidPlanId, number>;
  /** Impostos e taxas das plataformas: 0,11. */
  feesRate: number;
  monthlyCostsCents: { coworking: Cents; appMaintenance: Cents; accounting: Cents; travel: Cents };
  annualSiteMaintenanceCents: Cents;
  /** Meses do horizonte em que a manutenção anual é lançada: `[3, 15]`. */
  annualSiteMaintenanceMonths: number[];
  /** "A confirmar": fora do cálculo (RN-FIN-13). */
  hostingAnnualCents: Cents | null;
  initialInvestmentCents: { appAndSite: Cents; company: Cents; lawyer: Cents };
  reserveCents: Cents;
  /** Série de gratuitos acumulados, 24 valores (RN-FIN-25). */
  cumulativeFreeUsersByMonth: number[];
  /** Conversões dos cenários (frações): 0,03 / 0,05 / 0,07. */
  scenarios: { pessimistic: number; base: number; optimistic: number };
}

export type ScenarioKey = 'pessimistic' | 'base' | 'optimistic';

/** Uma linha da projeção mês a mês (A.13). Tudo em centavos. */
export interface ProjectionRow {
  month: number;
  newFreeUsers: number;
  cumulativeFreeUsers: number;
  subscribers: number;
  grossRevenueCents: Cents;
  netRevenueCents: Cents;
  costsCents: Cents;
  resultCents: Cents;
  cumulativeResultCents: Cents;
  /** Saldo do investimento: -17.200,00 + soma dos resultados. */
  balanceCents: Cents;
}

export type PilotWindowName = 'enrollment' | 'month3' | 'month6';

export interface PilotConfig {
  startedAt?: ISODate;
  durationMonths: 6;
  goals: { zaritReductionPercent: number; satisfactionMin: number; conversionPercent: number };
  goalsLocked: boolean;
  goalChangeLog: { at: ISODate; byUserId: ID; justification: string }[];
}

export interface PilotWindow {
  name: PilotWindowName;
  dueDate: ISODate;
  status: 'pending' | 'done' | 'missed';
}

export interface PilotEnrollment extends Audited {
  caregiverId: ID;
  enrolledAt: ISODate;
  tcleConsentEventId: ID;
  windows: PilotWindow[];
  weeklyHoursStart?: number;
  weeklyHoursEnd?: number;
  satisfaction?: 1 | 2 | 3 | 4 | 5;
  wouldRecommend?: boolean;
  chosenPlan?: PlanId;
  chosenReason?: string;
  /** Preenchido quando o TCLE foi revogado e o cuidador saiu do piloto. */
  exitedAt?: ISODate;
}

/** Configurações do protótipo (M15). O relógio simulado vive no `Clock` (`nexus-erp:clock`). */
export interface AppSettings {
  groupDefaultCapacity: number;
  refusalRateThresholdPercent: number;
  refusalRateMinRequests: number;
  dsrDeadlineDays: number;
  /** "Vence em breve" nos últimos N dias (RN-LGPD-21): 3. */
  dsrDueSoonDays: number;
  slaHours: { app: number; whatsapp: number; phone: number; email: number };
  sessionCancellationHours: number;
  /** Valor de referência da sessão com psicólogo da Nexus (RN-ATD-05): R$ 120,00. */
  sessionBasePriceCents: Cents;
  arbe: ArbeSettings;
  minGroupSizeForAggregates: number;
  schemaVersion: string;
}

/** Estado da demonstração (M15). */
export interface DemoState {
  seedName: string;
  seededAt: ISODateTime;
  /** Data (D0) usada para gerar os dados relativos. */
  seededForToday: ISODate;
  schemaVersion: string;
}
