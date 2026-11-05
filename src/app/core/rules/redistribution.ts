import { isAboveThreshold, occupancyPercent, OVERLOAD_THRESHOLD_PERCENT } from './eqp';

/**
 * Prévia da redistribuição de casos (RN-EQP-05, CX-010): estima como ficaria a ocupação de cada psicólogo
 * DEPOIS de transferir alguns casos, para a sócia e a responsável técnica decidirem sabendo o efeito.
 *
 * É uma estimativa do protótipo, não uma regra do documento: a ocupação do último mês fechado
 * (horas realizadas ÷ horas disponibilizadas) é redistribuída na proporção dos casos. As horas
 * disponibilizadas de cada um não mudam; as horas realizadas que "viajam" com o caso são, em média, as de
 * quem cede (horas realizadas ÷ casos atendidos). A regra de quem pode receber continua a do núcleo
 * (`canReceiveRedistribution`: só abaixo de 80% hoje).
 */
export interface RedistributionParty {
  id: string;
  /** Casos (cuidadores) atendidos hoje por este psicólogo. */
  caregivers: number;
  /** Último mês fechado: horas disponibilizadas na agenda. */
  availableHours: number;
  /** Último mês fechado: horas realizadas. */
  doneHours: number;
}

export interface RedistributionPartyProjection {
  id: string;
  caregiversBefore: number;
  caregiversAfter: number;
  /** Ocupação de hoje (`null` = n/d, sem agenda no mês). */
  before: number | null;
  /** Ocupação estimada depois da transferência (`null` = n/d). */
  after: number | null;
  /** A estimativa fica ESTRITAMENTE acima de 80% (80,0% não conta, RN-EQP-02). */
  exceedsLimit: boolean;
}

/** Horas realizadas que acompanham um caso, em média, no último mês fechado de quem cede. */
export function hoursPerCase(party: Pick<RedistributionParty, 'caregivers' | 'doneHours'>): number {
  return party.caregivers <= 0 ? 0 : party.doneHours / party.caregivers;
}

/**
 * Projeta a ocupação de quem cede e de cada receptor. `moves` traz quantos casos vão para cada receptor.
 * Quem cede nunca fica com horas negativas; casos acima do que ele tem são ignorados.
 */
export function projectRedistribution(
  from: RedistributionParty,
  moves: readonly { party: RedistributionParty; cases: number }[],
): RedistributionPartyProjection[] {
  const perCase = hoursPerCase(from);
  const total = Math.min(
    from.caregivers,
    moves.reduce((sum, move) => sum + Math.max(0, move.cases), 0),
  );
  const side = (
    party: RedistributionParty,
    caregiversAfter: number,
    doneAfter: number,
  ): RedistributionPartyProjection => ({
    id: party.id,
    caregiversBefore: party.caregivers,
    caregiversAfter,
    before: occupancyPercent(party.availableHours, party.doneHours),
    after: occupancyPercent(party.availableHours, doneAfter),
    exceedsLimit: isAboveThreshold(party.availableHours, doneAfter),
  });
  return [
    side(from, from.caregivers - total, Math.max(0, from.doneHours - perCase * total)),
    ...moves.map((move) => {
      const cases = Math.max(0, move.cases);
      return side(move.party, move.party.caregivers + cases, move.party.doneHours + perCase * cases);
    }),
  ];
}

/** Texto de por que um psicólogo não recebe casos: no limite (exatamente 80%) ou acima dele (CX-011). */
export function receiveBlockReason(percent: number | null): string | null {
  if (percent === null || percent < OVERLOAD_THRESHOLD_PERCENT) {
    return null;
  }
  return percent === OVERLOAD_THRESHOLD_PERCENT
    ? `no limite de ${OVERLOAD_THRESHOLD_PERCENT}%, não recebe mais casos`
    : `acima do limite de ${OVERLOAD_THRESHOLD_PERCENT}%, não recebe mais casos`;
}
