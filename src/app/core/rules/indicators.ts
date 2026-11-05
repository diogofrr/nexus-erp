/**
 * Insumos dos indicadores agregados de cuidadores (K15 e K16, RN-KPI-02): quem entra nos agregados e as
 * séries de Zarit por cuidador. Funções PURAS: a tela lê dos repositórios, aplica o recorte do perfil
 * (por exemplo, só os casos do psicólogo) e passa listas. Nada aqui devolve nome nem escore individual.
 */
import { Caregiver } from '../models/caregivers';
import { Consent } from '../models/lgpd';
import { ID } from '../models/primitives';
import { ZaritAssessment } from '../models/zarit';
import { Aggregate, MIN_GROUP_SIZE, aggregateValue } from '../privacy/aggregation';
import { averageEvolutionPercent } from './kpi';

/**
 * Cuidadores que entram nos agregados clínicos: consentimento de saúde E de People Analytics concedidos e
 * cadastro não encerrado, eliminado nem anonimizado (RN-LGPD-14, K15). C16 (saúde revogada) e C17
 * (People Analytics recusado) ficam de fora.
 */
export function eligibleCaregiverIds(
  caregivers: readonly Pick<Caregiver, 'id' | 'status' | 'erasedAt' | 'anonymizedAt'>[],
  consents: readonly Pick<Consent, 'caregiverId' | 'key' | 'status'>[],
): Set<ID> {
  const granted = (id: ID, key: Consent['key']): boolean =>
    consents.some((c) => c.caregiverId === id && c.key === key && c.status === 'granted');
  return new Set(
    caregivers
      .filter(
        (c) =>
          (c.status === 'active' || c.status === 'closure_requested') &&
          !c.erasedAt &&
          !c.anonymizedAt &&
          granted(c.id, 'health_data') &&
          granted(c.id, 'people_analytics'),
      )
      .map((c) => c.id),
  );
}

/** Totais das aplicações concluídas de cada cuidador, da adesão para a mais recente. */
export function zaritSeriesByCaregiver(
  assessments: readonly Pick<
    ZaritAssessment,
    'caregiverId' | 'sequence' | 'status' | 'total' | 'retentionBlock'
  >[],
): Map<ID, number[]> {
  const grouped = new Map<ID, { sequence: number; total: number }[]>();
  assessments.forEach((a) => {
    if (a.status !== 'completed' || a.total === undefined) {
      return;
    }
    const list = grouped.get(a.caregiverId) ?? [];
    list.push({ sequence: a.sequence, total: a.total });
    grouped.set(a.caregiverId, list);
  });
  const result = new Map<ID, number[]>();
  grouped.forEach((list, id) => {
    result.set(
      id,
      [...list].sort((a, b) => a.sequence - b.sequence).map((x) => x.total),
    );
  });
  return result;
}

/** Último total de cada cuidador do recorte (K15 usa a ÚLTIMA aplicação concluída). */
export function latestTotals(
  series: ReadonlyMap<ID, readonly number[]>,
  scope: ReadonlySet<ID>,
): number[] {
  const totals: number[] = [];
  scope.forEach((id) => {
    const list = series.get(id);
    if (list && list.length > 0) {
      totals.push(list[list.length - 1] as number);
    }
  });
  return totals;
}

/** Séries dos cuidadores do recorte com ao menos uma aplicação. */
export function seriesInScope(
  series: ReadonlyMap<ID, readonly number[]>,
  scope: ReadonlySet<ID>,
): (readonly number[])[] {
  const result: (readonly number[])[] = [];
  scope.forEach((id) => {
    const list = series.get(id);
    if (list && list.length > 0) {
      result.push(list);
    }
  });
  return result;
}

/**
 * K16 agregado: evolução média (%) entre quem tem 2 ou mais aplicações e adesão maior que 0. Só aparece com
 * pelo menos `min` cuidadores nessa conta; abaixo disso devolve "menos de 5" (nunca o número).
 */
export function evolutionAggregate(
  series: readonly (readonly number[])[],
  min: number = MIN_GROUP_SIZE,
): Aggregate<number | null> {
  const eligible = series.filter((s) => s.length >= 2 && (s[0] as number) > 0);
  return aggregateValue(eligible.length, () => averageEvolutionPercent(eligible), min);
}
