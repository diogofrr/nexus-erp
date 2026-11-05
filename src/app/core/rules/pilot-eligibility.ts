/**
 * Elegibilidade ao piloto (RN-PIL-04, RN-USR-12, RN-USR-13): ser o familiar cuidador principal de pessoa
 * idosa com algum grau de dependência (`partial` ou `total`) e residir em Uberlândia. Além dos três
 * critérios, marcar o piloto exige o TCLE ativo (consentimento `pilot_tcle`).
 */
import { Dependency } from '../models/caregivers';

export const PILOT_CITY = 'Uberlândia';

export type PilotCriterionKey = 'principal_caregiver' | 'dependency' | 'city';

export interface PilotCriterion {
  key: PilotCriterionKey;
  label: string;
  met: boolean;
  /** Frase curta do resultado, sem dado clínico além do necessário. */
  detail: string;
}

export interface PilotEligibility {
  criteria: PilotCriterion[];
  metCount: number;
  /** Os três critérios foram atendidos? */
  eligible: boolean;
  tcleActive: boolean;
  /** Pode marcar como piloto (três critérios e TCLE ativo). */
  canEnroll: boolean;
  /** O que falta, em frases, na ordem dos critérios e depois o TCLE. */
  missing: string[];
}

export interface PilotEligibilityInput {
  hasElder: boolean;
  dependency: Dependency | undefined;
  city: string;
  tcleActive: boolean;
}

function normalizeCity(city: string): string {
  return city
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
}

export function evaluatePilotEligibility(input: PilotEligibilityInput): PilotEligibility {
  const dependencyMet = input.dependency === 'partial' || input.dependency === 'total';
  const cityMet = normalizeCity(input.city) === normalizeCity(PILOT_CITY);
  const criteria: PilotCriterion[] = [
    {
      key: 'principal_caregiver',
      label: 'Cuidador principal de uma pessoa idosa',
      met: input.hasElder,
      detail: input.hasElder ? 'Há uma pessoa idosa vinculada.' : 'Falta a pessoa idosa vinculada.',
    },
    {
      key: 'dependency',
      label: 'Pessoa idosa com algum grau de dependência',
      met: dependencyMet,
      detail: dependencyMet
        ? 'Dependência parcial ou total.'
        : 'A pessoa idosa é independente, e o piloto pede dependência parcial ou total.',
    },
    {
      key: 'city',
      label: `Reside em ${PILOT_CITY}`,
      met: cityMet,
      detail: cityMet ? `Cidade: ${PILOT_CITY}.` : `O piloto é só em ${PILOT_CITY}.`,
    },
  ];
  const metCount = criteria.filter((c) => c.met).length;
  const missing = [
    ...criteria.filter((c) => !c.met).map((c) => c.label),
    ...(input.tcleActive ? [] : ['Termo de consentimento do piloto (TCLE) ativo']),
  ];
  const eligible = metCount === criteria.length;
  return {
    criteria,
    metCount,
    eligible,
    tcleActive: input.tcleActive,
    canEnroll: eligible && input.tcleActive,
    missing,
  };
}
