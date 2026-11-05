import {
  Aggregate,
  aggregateCount,
  aggregateDistribution,
  aggregateMean,
} from '../privacy/aggregation';
import { ArbeAlert, Caregiver, ID, ISODate, ISODateTime, ZaritAlert, ZaritAssessment, ZaritBand } from '../models';
import { isArbeAlertOpen } from './arbe';
import { SameDayContactStat, sameDayContactRate } from './pop05';
import { zaritEvolution } from './zarit';

export const BAND_ORDER: readonly ZaritBand[] = ['absent_or_small', 'moderate', 'moderate_to_severe', 'severe'];

export interface AggregateInput {
  caregivers: readonly Caregiver[];
  assessments: readonly ZaritAssessment[];
  alerts: readonly ZaritAlert[];
  arbe: readonly ArbeAlert[];
  /** Consentimento de saúde E People Analytics concedidos (K15, RN-ZRT-26). */
  eligible: (caregiverId: ID) => boolean;
  min: number;
  now: ISODateTime;
  today: ISODate;
}

export interface AggregateResult {
  /** Pessoas dentro do painel (com ao menos uma aplicação e os dois consentimentos). */
  people: number;
  bands: Record<ZaritBand, Aggregate<number>>;
  /** Algum recorte da distribuição ficou abaixo do mínimo. */
  anySuppressed: boolean;
  /** Total do recorte: só pode aparecer quando nenhuma faixa foi suprimida (A-30, dedução por subtração). */
  total: Aggregate<number>;
  meanEvolution: Aggregate<number>;
  alerts: { yellow: Aggregate<number>; red: Aggregate<number> };
  arbe: { attention: Aggregate<number>; critical: Aggregate<number> };
  /** Contato no mesmo dia (K18), com os números reais: só o RT os vê. */
  sameDay: SameDayContactStat;
  sameDayAggregate: Aggregate<number>;
}

/**
 * Painel agregado (SCR-M06-10, K15 a K19, RN-KPI-02, A-30): distribuição por faixa da ÚLTIMA aplicação de cada
 * cuidador, evolução média, alertas abertos e ARBE, tudo com mínimo de pessoas por recorte. Quando algum
 * recorte é suprimido, o total do painel não é mostrado, para ninguém deduzir o valor por subtração.
 */
export function buildAggregate(input: AggregateInput): AggregateResult {
  const people = input.caregivers.filter((c) => input.eligible(c.id));
  const ids = new Set(people.map((c) => c.id));
  const completedOf = (id: ID): ZaritAssessment[] =>
    input.assessments
      .filter((z) => z.caregiverId === id && z.status === 'completed' && z.total !== undefined && z.band)
      .sort((a, b) => (a.appliedAt ?? '').localeCompare(b.appliedAt ?? ''));

  const counts: Partial<Record<ZaritBand, number>> = {};
  const evolutions: number[] = [];
  let counted = 0;
  people.forEach((c) => {
    const done = completedOf(c.id);
    const last = done.at(-1);
    if (!last?.band) {
      return;
    }
    counted += 1;
    counts[last.band] = (counts[last.band] ?? 0) + 1;
    const first = done[0];
    if (done.length >= 2 && first?.total !== undefined && first.total > 0 && last.total !== undefined) {
      const evolution = zaritEvolution(first.total, last.total);
      if (evolution.kind === 'percent') {
        evolutions.push(evolution.value);
      }
    }
  });
  const bands = aggregateDistribution(BAND_ORDER, counts, input.min);
  const open = input.alerts.filter((a) => a.status !== 'closed' && ids.has(a.caregiverId));
  const openArbe = input.arbe.filter((a) => isArbeAlertOpen(a) && ids.has(a.caregiverId));
  const appliedOf = (a: Pick<ZaritAlert, 'assessmentId'>): ISODate | undefined =>
    input.assessments.find((z) => z.id === a.assessmentId)?.appliedAt;
  const sameDay = sameDayContactRate(
    input.alerts.filter((a) => ids.has(a.caregiverId)),
    appliedOf,
    input.now,
  );
  return {
    people: counted,
    bands,
    anySuppressed: BAND_ORDER.some((band) => !bands[band].sufficient),
    total: aggregateCount(counted, input.min),
    meanEvolution: aggregateMean(evolutions, input.min),
    alerts: {
      yellow: aggregateCount(open.filter((a) => a.level === 'yellow').length, input.min),
      red: aggregateCount(open.filter((a) => a.level === 'red').length, input.min),
    },
    arbe: {
      attention: aggregateCount(openArbe.filter((a) => a.level === 'attention').length, input.min),
      critical: aggregateCount(openArbe.filter((a) => a.level === 'critical').length, input.min),
    },
    sameDay,
    sameDayAggregate: aggregateCount(sameDay.denominator, input.min),
  };
}
