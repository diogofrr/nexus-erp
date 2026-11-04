/**
 * Governança: riscos (C = P x I), estado de revisão dos POPs e encaminhamentos (Quadro 12).
 * RN-RISCO-01, 02, 15; RN-POP-12, 13; RN-ENC-01 a 11.
 */
import { wholeMonthsBetween } from '../clock/date-utils';
import { ISODate } from '../models/primitives';
import { PopReviewState, ReferralCategory, RiskItem, RiskScale } from '../models/governance';

/** Criticidade C = P x I, com P e I inteiros de 1 a 5 (RN-RISCO-01). */
export function riskCriticality(
  probability: RiskScale | number,
  impact: RiskScale | number,
): number {
  const valid = (n: number): boolean => Number.isInteger(n) && n >= 1 && n <= 5;
  if (!valid(probability) || !valid(impact)) {
    throw new RangeError('Probabilidade e impacto são inteiros de 1 a 5.');
  }
  return probability * impact;
}

/** Prioritário se C é maior ou igual a 12 (RN-RISCO-02). */
export const PRIORITY_RISK_THRESHOLD = 12;

export function isPriorityRisk(criticality: number): boolean {
  return criticality >= PRIORITY_RISK_THRESHOLD;
}

export interface RiskRow {
  risk: RiskItem;
  criticality: number;
  priority: boolean;
}

/** Registro de riscos ordenado por criticidade decrescente (R1 = 20 no topo). */
export function rankRisks(risks: readonly RiskItem[]): RiskRow[] {
  return risks
    .map((risk) => {
      const criticality = riskCriticality(risk.probability, risk.impact);
      return { risk, criticality, priority: isPriorityRisk(criticality) };
    })
    .sort(
      (a, b) =>
        b.criticality - a.criticality ||
        a.risk.code.localeCompare(b.risk.code, 'pt-BR', { numeric: true }),
    );
}

/** Célula da matriz 5x5: linha = probabilidade, coluna = impacto. */
export function riskMatrixCell(risk: Pick<RiskItem, 'probability' | 'impact'>): {
  row: number;
  column: number;
} {
  return { row: risk.probability, column: risk.impact };
}

/** POPs são revistos a cada 12 meses ou quando um incidente aponta lacuna (RN-POP-12, 13). */
export function popReviewState(
  lastReviewedAt: ISODate,
  today: ISODate,
  revisionTriggered: boolean,
): PopReviewState {
  if (revisionTriggered) {
    return 'revision_triggered';
  }
  return wholeMonthsBetween(lastReviewedAt, today) >= 12 ? 'due' : 'up_to_date';
}

/** Códigos dos POPs que só o RT fecha (05, 07, 09) e dos que só a gestão fecha (RN-POP-14). */
export const POPS_OF_TECHNICAL_LEAD: readonly string[] = ['POP-05', 'POP-07', 'POP-09'];
export const POPS_OF_MANAGEMENT: readonly string[] = [
  'POP-01',
  'POP-02',
  'POP-03',
  'POP-06',
  'POP-08',
  'POP-10',
];

// ===== Encaminhamentos (Quadro 12) =====

export interface ReferralRule {
  category: ReferralCategory;
  situation: string;
  destinations: readonly string[];
  observation: string;
  /** Exige marcar "família comunicada" (RN-ENC-07). */
  requiresFamilyCommunicated?: boolean;
}

/** Quadro 12: as 7 situações, destinos permitidos e observações. */
export const REFERRAL_TABLE: readonly ReferralRule[] = [
  {
    category: 'psychiatric_follow_up',
    situation: 'Necessidade de acompanhamento psiquiátrico',
    destinations: ['CAPS de referência', 'Rede privada', 'UBS'],
    observation: 'Com orientação do responsável técnico',
  },
  {
    category: 'severe_distress_or_suicide_risk',
    situation: 'Sofrimento psíquico grave ou risco de suicídio',
    destinations: ['Rede de urgência em saúde mental', 'CVV (188)'],
    observation: 'Conforme POP-05',
  },
  {
    category: 'social_vulnerability',
    situation: 'Vulnerabilidade social e benefícios',
    destinations: ['CRAS do território'],
    observation: 'Orientação sobre direitos',
  },
  {
    category: 'rights_violation_or_neglect',
    situation: 'Violação de direitos, violência ou negligência',
    destinations: [
      'CREAS',
      'Disque 100',
      'Delegacia especializada',
      'Ministério Público',
      'Conselho Municipal da Pessoa Idosa',
    ],
    observation: 'Notificação compulsória, conforme POP-07',
  },
  {
    category: 'social_security_or_guardianship',
    situation: 'Demandas previdenciárias ou de curatela',
    destinations: ['Advogado da rede', 'Defensoria Pública'],
    observation: 'Defensoria quando houver hipossuficiência',
  },
  {
    category: 'elder_clinical_worsening',
    situation: 'Agravamento clínico da pessoa idosa',
    destinations: ['UBS de referência', 'Serviço de urgência'],
    observation: 'Comunicação imediata à família',
    requiresFamilyCommunicated: true,
  },
  {
    category: 'caregiver_cannot_afford_care',
    situation: 'Cuidador sem condição de custear acompanhamento',
    destinations: ['Clínicas-escola', 'Serviços públicos'],
    observation: 'Plano gratuito mantido',
  },
];

export const EMERGENCY_NOTICE =
  'Em emergência, acione o SAMU (192) ou a unidade de urgência mais próxima.';

export interface ReferralValidation {
  valid: boolean;
  errors: string[];
}

/** Valida categoria, destinos da própria categoria e, no agravamento clínico, "família comunicada" (RN-ENC-07). */
export function validateReferral(
  category: ReferralCategory,
  destinations: readonly string[],
  familyCommunicated: boolean | undefined,
): ReferralValidation {
  const rule = REFERRAL_TABLE.find((r) => r.category === category);
  const errors: string[] = [];
  if (!rule) {
    return { valid: false, errors: ['Categoria de encaminhamento desconhecida.'] };
  }
  if (destinations.length === 0) {
    errors.push('Informe ao menos um destino.');
  }
  const invalid = destinations.filter((d) => !rule.destinations.includes(d));
  if (invalid.length > 0) {
    errors.push(`Destino fora da lista desta categoria: ${invalid.join(', ')}.`);
  }
  if (rule.requiresFamilyCommunicated && familyCommunicated !== true) {
    errors.push('No agravamento clínico, marque que a família foi comunicada.');
  }
  return { valid: errors.length === 0, errors };
}
