import { AppSettings, PilotConfig } from '../models';
import { DEFAULT_ARBE_SETTINGS } from '../rules/arbe';
import { DEFAULT_REFUSAL_MIN_REQUESTS, DEFAULT_REFUSAL_THRESHOLD_PERCENT } from '../rules/arp';
import { DEFAULT_SLA_HOURS } from '../rules/sla';
import { DSR_DEADLINE_DAYS, DSR_DUE_SOON_DAYS } from '../rules/lgpd';
import { MIN_GROUP_SIZE } from '../privacy/aggregation';
import { SCHEMA_VERSION } from '../storage/migrations';

/** Configurações padrão do protótipo (M15, suposições do Anexo D). */
export function defaultAppSettings(): AppSettings {
  return {
    groupDefaultCapacity: 12,
    refusalRateThresholdPercent: DEFAULT_REFUSAL_THRESHOLD_PERCENT,
    refusalRateMinRequests: DEFAULT_REFUSAL_MIN_REQUESTS,
    dsrDeadlineDays: DSR_DEADLINE_DAYS,
    dsrDueSoonDays: DSR_DUE_SOON_DAYS,
    slaHours: { ...DEFAULT_SLA_HOURS },
    sessionCancellationHours: 24,
    sessionBasePriceCents: 12000,
    arbe: { ...DEFAULT_ARBE_SETTINGS },
    minGroupSizeForAggregates: MIN_GROUP_SIZE,
    schemaVersion: SCHEMA_VERSION,
  };
}

/** Metas padrão do piloto (RN-PIL-09). `startedAt` e o bloqueio são definidos pelo seed. */
export function defaultPilotConfig(): PilotConfig {
  return {
    durationMonths: 6,
    goals: { zaritReductionPercent: 10, satisfactionMin: 4.0, conversionPercent: 3 },
    goalsLocked: false,
    goalChangeLog: [],
  };
}
