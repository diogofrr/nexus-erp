/**
 * Escala de Sobrecarga do Cuidador de Zarit (RN-ZRT-01 a 26, A.5).
 * Instrumento de ACOMPANHAMENTO: nunca diagnóstico, e o ERP não fala em "eficácia" (RN-ZRT-18, 22).
 */
import { addMonths, compareDates, daysBetween } from '../clock/date-utils';
import { ISODate } from '../models/primitives';
import { ZaritBand } from '../models/zarit';
import { roundHalfUp } from './numbers';

export const ZARIT_ITEM_COUNT = 22;
export const ZARIT_MIN_ITEM_SCORE = 0;
export const ZARIT_MAX_ITEM_SCORE = 4;
export const ZARIT_MIN_TOTAL = 0;
export const ZARIT_MAX_TOTAL = 88;
/** Periodicidade: adesão e a cada 3 meses (RN-ZRT-05). */
export const ZARIT_INTERVAL_MONTHS = 3;
/** `due`: vence em até 14 dias (RN-ZRT-24). */
export const ZARIT_DUE_WINDOW_DAYS = 14;

/** Nota fixa para exibir junto de qualquer resultado (RN-ZRT-01, 18). */
export const ZARIT_NOT_DIAGNOSIS_NOTE =
  'Este resultado é um indício para a escuta do psicólogo e acompanha a evolução ao longo do tempo. Não é um diagnóstico e não substitui a avaliação clínica.';

/** Rótulos da escala de resposta (RN-ZRT-02). */
export const ZARIT_ANSWER_LABELS: readonly string[] = [
  'Nunca',
  'Raramente',
  'Algumas vezes',
  'Frequentemente',
  'Sempre ou quase sempre',
];

export interface ZaritBandInfo {
  band: ZaritBand;
  min: number;
  max: number;
  /** Classificação (A.5). */
  label: string;
  /** Conduta da equipe (A.5). */
  conduct: string;
  alert: 'yellow' | 'red' | null;
}

/** Faixas inclusivas: 0 a 20, 21 a 40, 41 a 60, 61 a 88 (RN-ZRT-08). */
export const ZARIT_BANDS: readonly ZaritBandInfo[] = [
  {
    band: 'absent_or_small',
    min: 0,
    max: 20,
    label: 'Sobrecarga ausente ou pequena',
    conduct: 'Conteúdos de orientação e convite para os grupos de apoio.',
    alert: null,
  },
  {
    band: 'moderate',
    min: 21,
    max: 40,
    label: 'Sobrecarga moderada',
    conduct: 'Oferta de atendimento psicológico e convite para os grupos e as capacitações.',
    alert: null,
  },
  {
    band: 'moderate_to_severe',
    min: 41,
    max: 60,
    label: 'Sobrecarga moderada a severa',
    conduct:
      'Alerta amarelo: acompanhamento psicológico prioritário, com foco no manejo do estresse, e revisão da rede de apoio da família.',
    alert: 'yellow',
  },
  {
    band: 'severe',
    min: 61,
    max: 88,
    label: 'Sobrecarga severa',
    conduct:
      'Alerta vermelho: contato da equipe no mesmo dia, avaliação de risco pelo psicólogo e, se necessário, encaminhamento à rede de urgência conforme o POP-05.',
    alert: 'red',
  },
];

export class ZaritError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZaritError';
  }
}

export interface ZaritValidation {
  valid: boolean;
  /** Índices (base 0) dos itens sem resposta ou inválidos. */
  invalidItems: number[];
  errors: string[];
}

/** RN-ZRT-02, 25: 22 itens obrigatórios, inteiros de 0 a 4. Itens `undefined`/`null` contam como faltantes. */
export function validateZaritAnswers(
  answers: readonly (number | null | undefined)[],
): ZaritValidation {
  const errors: string[] = [];
  const invalidItems: number[] = [];
  if (answers.length !== ZARIT_ITEM_COUNT) {
    errors.push(`A escala tem ${ZARIT_ITEM_COUNT} itens; foram informados ${answers.length}.`);
  }
  for (let i = 0; i < ZARIT_ITEM_COUNT; i += 1) {
    const value = answers[i];
    const ok =
      typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= ZARIT_MIN_ITEM_SCORE &&
      value <= ZARIT_MAX_ITEM_SCORE;
    if (!ok) {
      invalidItems.push(i);
    }
  }
  if (invalidItems.length > 0) {
    errors.push(
      `Itens sem resposta ou fora de 0 a 4: ${invalidItems.map((i) => i + 1).join(', ')}.`,
    );
  }
  return { valid: errors.length === 0, invalidItems, errors };
}

/** Total = soma dos 22 itens (0 a 88), sempre calculado pelo sistema (RN-ZRT-03). Lança `ZaritError` se inválido. */
export function zaritTotal(answers: readonly number[]): number {
  const check = validateZaritAnswers(answers);
  if (!check.valid) {
    throw new ZaritError(check.errors.join(' '));
  }
  return answers.reduce((sum, v) => sum + v, 0);
}

/** Faixa do total (0 a 88). Lança `ZaritError` fora do intervalo ou se não for inteiro. */
export function zaritBand(total: number): ZaritBand {
  return zaritBandInfo(total).band;
}

export function zaritBandInfo(total: number): ZaritBandInfo {
  if (!Number.isInteger(total) || total < ZARIT_MIN_TOTAL || total > ZARIT_MAX_TOTAL) {
    throw new ZaritError(`Pontuação fora de 0 a ${ZARIT_MAX_TOTAL}: ${total}.`);
  }
  const info = ZARIT_BANDS.find((b) => total >= b.min && total <= b.max);
  if (!info) {
    throw new ZaritError(`Pontuação sem faixa: ${total}.`);
  }
  return info;
}

export function zaritBandLabel(band: ZaritBand): string {
  return (ZARIT_BANDS.find((b) => b.band === band) as ZaritBandInfo).label;
}

/** Alerta gerado pelo total: amarelo (41 a 60), vermelho (61 a 88) ou nenhum (RN-ZRT-12, 13). */
export function zaritAlertLevel(total: number): 'yellow' | 'red' | null {
  return zaritBandInfo(total).alert;
}

/** Conduta da equipe para o total (A.5). */
export function zaritConduct(total: number): string {
  return zaritBandInfo(total).conduct;
}

// ===== Evolução =====

export type ZaritEvolution =
  | { kind: 'percent'; value: number; display: string }
  | { kind: 'not_defined'; pointsDelta: number; display: 'n/d' }
  | { kind: 'reference'; display: 'referência' };

/** Texto "+12,5%" ou "-21,2%" (pt-BR, uma casa decimal, sinal explícito, RN-ZRT-17). */
export function formatEvolutionPercent(value: number): string {
  const rounded = roundHalfUp(value, 1);
  const abs = Math.abs(rounded).toFixed(1).replace('.', ',');
  if (rounded > 0) {
    return `+${abs}%`;
  }
  if (rounded < 0) {
    return `-${abs}%`;
  }
  return `${abs}%`;
}

/**
 * Evolução (%) = (atual - adesão) / adesão x 100 (RN-ZRT-16). Negativo indica redução.
 * Adesão 0: divisão por zero, "n/d" com a diferença em pontos (RN-ZRT-17).
 */
export function zaritEvolution(baseline: number, current: number): ZaritEvolution {
  if (baseline === 0) {
    return { kind: 'not_defined', pointsDelta: current - baseline, display: 'n/d' };
  }
  const value = roundHalfUp(((current - baseline) / baseline) * 100, 1);
  return { kind: 'percent', value, display: formatEvolutionPercent(value) };
}

/** Série de evolução de uma lista de totais: o primeiro (adesão) é a "referência". */
export function zaritEvolutionSeries(totals: readonly number[]): ZaritEvolution[] {
  return totals.map((total, i) =>
    i === 0
      ? ({ kind: 'reference', display: 'referência' } as const)
      : zaritEvolution(totals[0] as number, total),
  );
}

// ===== Vencimento =====

/** Próxima aplicação: 3 meses de calendário depois da última (15/02 resulta 15/05; dia inexistente cai no fim do mês). */
export function nextZaritDueDate(lastAppliedAt: ISODate): ISODate {
  return addMonths(lastAppliedAt, ZARIT_INTERVAL_MONTHS);
}

export type ZaritAssessmentState = 'scheduled' | 'due' | 'overdue' | 'completed';

/**
 * Estado derivado da aplicação (RN-ZRT-24): `completed`; `overdue` depois do vencimento;
 * `due` quando vence em até 14 dias (inclusive hoje); senão `scheduled`.
 */
export function zaritAssessmentState(
  dueDate: ISODate,
  today: ISODate,
  completed: boolean,
): ZaritAssessmentState {
  if (completed) {
    return 'completed';
  }
  if (compareDates(dueDate, today) < 0) {
    return 'overdue';
  }
  return daysBetween(today, dueDate) <= ZARIT_DUE_WINDOW_DAYS ? 'due' : 'scheduled';
}

/** Para o `support` (E-05): só "pendente" ou "em dia", com a data, sem resultado. */
export function zaritStatusForSupport(
  dueDate: ISODate,
  today: ISODate,
): { status: 'pending' | 'up_to_date'; dueDate: ISODate; label: string } {
  const state = zaritAssessmentState(dueDate, today, false);
  const pending = state === 'overdue' || state === 'due';
  return {
    status: pending ? 'pending' : 'up_to_date',
    dueDate,
    label: pending ? 'Aplicação pendente' : 'Em dia',
  };
}

/** Vence em N dias (negativo = já venceu há N dias). */
export function zaritDaysToDue(dueDate: ISODate, today: ISODate): number {
  return daysBetween(today, dueDate);
}
