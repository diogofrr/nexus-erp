import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from '@core/auth';
import { Clock, addDays, dateOf } from '@core/clock';
import { Database } from '@core/data';
import { ID, Role, ZaritBand } from '@core/models';
import { Aggregate, aggregateCount, displayAggregate } from '@core/privacy';
import {
  ARP_BAND_LABELS,
  availabilityDropSignal,
  networkAverage,
  refusalStats,
} from '@core/rules/arp';
import { hasOverloadAlert, lastClosedMonths, occupancyPercent, teamExpansionRecommended } from '@core/rules/eqp';
import {
  eligibleCaregiverIds,
  evolutionAggregate,
  latestTotals,
  seriesInScope,
  zaritSeriesByCaregiver,
} from '@core/rules/indicators';
import {
  appUsageStats,
  complaintStats,
  countFreeUsers,
  countSubscribers,
  dsrCounts,
  openArbeByLevel,
  openZaritAlertsByLevel,
  participationStats,
  providersByBand,
  zaritDistribution,
} from '@core/rules/kpi';
import { sameDayContactRate } from '@core/rules/pop05';
import { isComplaintOverdue, isMessageOverdue, slaByChannel } from '@core/rules/sla';
import { ZARIT_BANDS } from '@core/rules/zarit';
import { FinanceStore } from './finance.store';

export type IndicatorTab = 'caregivers' | 'network' | 'team' | 'service';

/** Quais abas cada perfil abre (matriz: partner total, RT e psicólogo agregado, atendimento operacional). */
export const INDICATOR_TABS_BY_ROLE: Readonly<Partial<Record<Role, readonly IndicatorTab[]>>> = {
  partner: ['caregivers', 'network', 'team', 'service'],
  technical_lead: ['caregivers', 'team'],
  psychologist: ['caregivers', 'team'],
  support: ['service'],
};

export const INDICATOR_TAB_LABELS: Readonly<Record<IndicatorTab, string>> = {
  caregivers: 'Cuidadores',
  network: 'Rede',
  team: 'Equipe',
  service: 'Atendimento',
};

/** Janela móvel dos indicadores de atendimento: 30 dias (suposição do protótipo, ver relatório). */
export const SERVICE_WINDOW_DAYS = 30;

export interface BandDatum {
  band: ZaritBand;
  label: string;
  aggregate: Aggregate<number>;
}

export interface OccupancyRow {
  psychologistId: ID;
  name: string;
  months: { month: string; percent: number | null; availableHours: number; doneHours: number }[];
  overload: boolean;
}

export interface ProviderSignalRow {
  id: ID;
  name: string;
  refusalPercent: number | null;
  received: number;
  dropPercent: number | null;
  exitRisk: boolean;
  aboveThreshold: boolean;
}

/**
 * Indicadores de People Analytics (M10, SCR-M10-06), em três frentes: cuidadores, rede e equipe (mais o
 * atendimento, que é o operacional do `support`). Lê dos repositórios, aplica o recorte do perfil e usa só
 * regras puras. Indicador clínico é SEMPRE agregado com mínimo de pessoas (RN-KPI-02): abaixo disso o valor
 * nem é calculado para a tela ("menos de 5"). Nunca nome nem escore individual.
 */
@Injectable({ providedIn: 'root' })
export class IndicatorsStore {
  private readonly db = inject(Database);
  private readonly auth = inject(AuthService);
  private readonly clock = inject(Clock);
  private readonly finance = inject(FinanceStore);

  readonly role = this.auth.role;
  readonly tabs = computed<readonly IndicatorTab[]>(() => {
    const role = this.role();
    return (role && INDICATOR_TABS_BY_ROLE[role]) ?? [];
  });

  /** Mínimo de pessoas por recorte (configuração, padrão 5). */
  readonly min = computed(() => this.db.settings.value().minGroupSizeForAggregates);

  // ===== Cuidadores (agregados) =====

  private readonly ownPsychologistId = computed(() => this.auth.actor()?.psychologistId);

  /** Cuidadores que entram nos agregados e estão no recorte do perfil (psicólogo: só os seus). */
  private readonly scope = computed<ReadonlySet<ID>>(() => {
    const eligible = eligibleCaregiverIds(this.db.caregivers.all(), this.db.consents.all());
    if (this.role() !== 'psychologist') {
      return eligible;
    }
    const mine = this.ownPsychologistId();
    const own = new Set<ID>();
    this.db.caregivers.all().forEach((c) => {
      if (c.assignedPsychologistId === mine && eligible.has(c.id)) {
        own.add(c.id);
      }
    });
    return own;
  });

  private readonly series = computed(() => zaritSeriesByCaregiver(this.db.zaritAssessments.all()));

  /** K15: última aplicação de cada cuidador do recorte, por faixa, com o mínimo por recorte. */
  readonly bands = computed<BandDatum[]>(() => {
    const dist = zaritDistribution(latestTotals(this.series(), this.scope()), this.min());
    return ZARIT_BANDS.map((b) => ({
      band: b.band,
      label: `${b.label} (${b.min} a ${b.max})`,
      aggregate: dist[b.band],
    }));
  });

  /** K16: evolução média da sobrecarga (%), só com o mínimo de cuidadores na conta. */
  readonly evolution = computed(() =>
    evolutionAggregate(seriesInScope(this.series(), this.scope()), this.min()),
  );

  private readonly scopedCaregiverIds = computed<ReadonlySet<ID> | null>(() => {
    if (this.role() !== 'psychologist') {
      return null;
    }
    const mine = this.ownPsychologistId();
    return new Set(
      this.db.caregivers
        .all()
        .filter((c) => c.assignedPsychologistId === mine)
        .map((c) => c.id),
    );
  });

  /** K17: alertas de Zarit abertos por nível (contagem protegida). */
  readonly zaritAlerts = computed(() => {
    const scope = this.scopedCaregiverIds();
    const alerts = this.db.zaritAlerts.all().filter((a) => !scope || scope.has(a.caregiverId));
    const open = openZaritAlertsByLevel(alerts);
    return {
      yellow: aggregateCount(open.yellow, this.min()),
      red: aggregateCount(open.red, this.min()),
    };
  });

  /** K19: ARBE abertos por nível (contagem protegida). */
  readonly arbeAlerts = computed(() => {
    const scope = this.scopedCaregiverIds();
    const alerts = this.db.arbeAlerts.all().filter((a) => !scope || scope.has(a.caregiverId));
    const open = openArbeByLevel(alerts);
    return {
      attention: aggregateCount(open.attention, this.min()),
      critical: aggregateCount(open.critical, this.min()),
    };
  });

  /** K18: contato no mesmo dia (%) dos alertas vermelhos com prazo vencido nos últimos 30 dias. */
  readonly sameDay = computed(() => {
    const scope = this.scopedCaregiverIds();
    const alerts = this.db.zaritAlerts.all().filter((a) => !scope || scope.has(a.caregiverId));
    const stat = sameDayContactRate(
      alerts,
      (alert) => this.db.zaritAssessments.get(alert.assessmentId)?.appliedAt,
      this.clock.now(),
    );
    return {
      stat,
      percent:
        stat.denominator >= this.min() && stat.percent !== null ? stat.percent : null,
    };
  });

  // ===== Comercial (partner) =====

  readonly subscribers = computed(() => countSubscribers(this.db.subscriptions.all()));
  readonly freeUsers = computed(() => countFreeUsers(this.db.caregivers.all()));
  readonly conversionPercent = this.finance.conversionPercent;
  readonly usage = computed(() => appUsageStats(this.db.appUsage.all()));

  /** K28: participação nas atividades (psicólogo: só as suas). */
  readonly participation = computed(() => {
    const mine = this.ownPsychologistId();
    const activities = this.db.activities
      .all()
      .filter((a) => a.status !== 'draft' && a.status !== 'cancelled')
      .filter(
        (a) =>
          this.role() !== 'psychologist' ||
          a.leaders.some((l) => l.type === 'psychologist' && l.id === mine),
      );
    const stats = participationStats(activities, this.db.activityEnrollments.all());
    return activities.map((activity) => ({
      activity,
      stat: stats.find((s) => s.activityId === activity.id),
    }));
  });

  // ===== Rede (partner) =====

  /** K22: avaliação da rede, média ponderada dos prestadores avaliáveis. */
  readonly networkRating = computed(() => {
    const sums = new Map<ID, { scoreSum: number; evaluationCount: number }>();
    this.db.providerEvaluations.all().forEach((e) => {
      const current = sums.get(e.providerId) ?? { scoreSum: 0, evaluationCount: 0 };
      current.scoreSum += e.technicalQuality + e.punctualityCourtesy;
      current.evaluationCount += 1;
      sums.set(e.providerId, current);
    });
    return networkAverage([...sums.values()]);
  });

  /** K23: prestadores por faixa da última auditoria. */
  readonly arpBands = computed(() => {
    const counts = providersByBand(this.db.arpSnapshots.all());
    return (Object.keys(ARP_BAND_LABELS) as (keyof typeof ARP_BAND_LABELS)[]).map((band) => ({
      band,
      label: ARP_BAND_LABELS[band],
      count: counts[band],
    }));
  });

  /** K24 e K25: taxa de recusa e risco de saída, por prestador ativo ou em monitoramento. */
  readonly providerSignals = computed<ProviderSignalRow[]>(() => {
    const settings = this.db.settings.value();
    const now = this.clock.now();
    const requests = this.db.serviceRequests.all();
    return this.db.providers
      .all()
      .filter((p) => p.status === 'active' || p.status === 'monitoring')
      .map((p) => {
        const stats = refusalStats(requests, p.id, now, {
          thresholdPercent: settings.refusalRateThresholdPercent,
          minRequests: settings.refusalRateMinRequests,
        });
        const drop = availabilityDropSignal(p.availability);
        return {
          id: p.id,
          name: p.name,
          refusalPercent: stats.percent,
          received: stats.received,
          dropPercent: drop.dropPercent,
          exitRisk: stats.exitRisk || drop.signal,
          aboveThreshold:
            stats.percent !== null && stats.percent >= settings.refusalRateThresholdPercent,
        };
      })
      .sort((a, b) => Number(b.exitRisk) - Number(a.exitRisk) || (b.refusalPercent ?? 0) - (a.refusalPercent ?? 0));
  });
  readonly exitRiskCount = computed(() => this.providerSignals().filter((p) => p.exitRisk).length);

  /** K26: credenciamentos em andamento. */
  readonly accreditationsInProgress = computed(
    () =>
      this.db.accreditations
        .all()
        .filter(
          (a) => a.status === 'requested' || a.status === 'in_review' || a.status === 'pending_documents',
        ).length,
  );

  /** K27: entradas e saídas da rede nos últimos meses. */
  readonly networkFlow = computed(() => {
    const months = [...lastClosedMonths(this.clock.currentMonth(), 2), this.clock.currentMonth()];
    return months.map((month) => {
      const events = this.db.providerStatusEvents
        .all()
        .filter((e) => dateOf(e.createdAt).startsWith(month));
      return {
        month,
        entries: events.filter((e) => e.to === 'active').length,
        exits: events.filter((e) => e.to === 'deaccredited').length,
      };
    });
  });

  // ===== Equipe =====

  /** K20 e K21: ocupação por psicólogo nos dois últimos meses fechados e alerta de sobrecarga (80%). */
  readonly occupancy = computed<OccupancyRow[]>(() => {
    const current = this.clock.currentMonth();
    const months = lastClosedMonths(current);
    const mine = this.ownPsychologistId();
    return this.db.psychologists
      .all()
      .filter((p) => this.role() !== 'psychologist' || p.id === mine)
      .map((p) => {
        const rows = this.db.monthSummaries.all().filter((s) => s.psychologistId === p.id);
        return {
          psychologistId: p.id,
          name: p.displayName,
          months: months.map((month) => {
            const row = rows.find((r) => r.month === month);
            return {
              month,
              availableHours: row?.availableHours ?? 0,
              doneHours: row?.doneHours ?? 0,
              percent: row ? occupancyPercent(row.availableHours, row.doneHours) : null,
            };
          }),
          overload: hasOverloadAlert(rows, current),
        };
      });
  });
  readonly overloadCount = computed(() => this.occupancy().filter((r) => r.overload).length);

  /** K40: horas de atendimento do último mês fechado. */
  readonly doneHoursLastMonth = computed(() =>
    this.occupancy().reduce((sum, r) => sum + (r.months[r.months.length - 1]?.doneHours ?? 0), 0),
  );

  /** RN-EQP-06: ampliar a equipe só com resultado do mês positivo (condição mostrada só à gestão). */
  readonly expansionRecommended = computed(() =>
    teamExpansionRecommended(this.finance.realized().resultCents),
  );

  // ===== Atendimento (SLA, reclamações, LGPD) =====

  private readonly windowStart = computed(() => addDays(this.clock.today(), -SERVICE_WINDOW_DAYS));

  /** K30: SLA por canal nos últimos 30 dias. */
  readonly sla = computed(() => {
    const start = this.windowStart();
    const messages = this.db.messages.all().filter((m) => dateOf(m.receivedAt) > start);
    return slaByChannel(messages, this.clock.now());
  });
  readonly overdueMessages = computed(
    () => this.db.messages.all().filter((m) => isMessageOverdue(m, this.clock.now())).length,
  );

  /** K29: reclamações dos últimos 30 dias, com as vencidas. */
  readonly complaints = computed(() => {
    const start = this.windowStart();
    const list = this.db.complaints.all().filter((c) => dateOf(c.openedAt) > start);
    return {
      ...complaintStats(list, ''),
      overdue: this.db.complaints.all().filter((c) => isComplaintOverdue(c, this.clock.now())).length,
    };
  });

  /** K33: solicitações do titular abertas, vencendo e vencidas. */
  readonly dsr = computed(() =>
    dsrCounts(
      this.db.dataSubjectRequests.all(),
      this.clock.today(),
      this.db.settings.value().dsrDueSoonDays,
    ),
  );

  show(aggregate: Aggregate<number>): string {
    return displayAggregate(aggregate);
  }
}
