/**
 * EQP: carga da equipe de psicologia (RN-EQP-01 a 09, K20, K21).
 * Ocupação = horas REALIZADAS ÷ horas DISPONIBILIZADAS x 100 no mês calendário. Acima de 80%
 * (estritamente) por dois meses fechados seguidos aciona redistribuição ou ampliação da equipe.
 */
import { addMonthsToYearMonth, yearMonthOf } from '../clock/date-utils';
import { ISODate, YearMonth } from '../models/primitives';
import { OccupancyView, PsychologistMonthSummary } from '../models/care';
import { roundHalfUp } from './numbers';

/** Limite de sobrecarga: ESTRITAMENTE maior que 80% (80,0% não dispara, RN-EQP-02). */
export const OVERLOAD_THRESHOLD_PERCENT = 80;
/** Quantidade de meses fechados seguidos acima do limite. */
export const OVERLOAD_CONSECUTIVE_MONTHS = 2;

/**
 * Ocupação em % com 1 casa (meio para cima): 138 de 160 = 86,3%. `null` ("n/d") sem horas
 * disponibilizadas; pode passar de 100% com horas extras (RN-EQP-08).
 */
export function occupancyPercent(availableHours: number, doneHours: number): number | null {
  if (availableHours <= 0) {
    return null;
  }
  return roundHalfUp((doneHours / availableHours) * 100, 1);
}

/** Acima de 80%? `null` (n/d) nunca é sobrecarga. Compara o valor SEM arredondar para não promover 80,04 a "acima". */
export function isAboveThreshold(availableHours: number, doneHours: number): boolean {
  return availableHours > 0 && doneHours * 100 > OVERLOAD_THRESHOLD_PERCENT * availableHours;
}

/** Os dois meses fechados anteriores ao mês corrente. */
export function lastClosedMonths(
  currentMonth: YearMonth,
  count = OVERLOAD_CONSECUTIVE_MONTHS,
): YearMonth[] {
  const months: YearMonth[] = [];
  for (let i = count; i >= 1; i -= 1) {
    months.push(addMonthsToYearMonth(currentMonth, -i));
  }
  return months;
}

/**
 * Alerta de sobrecarga: ocupação acima de 80% em CADA um dos dois últimos meses fechados.
 * O mês corrente é parcial e não conta; mês sem agenda (n/d) quebra a sequência (RN-EQP-04).
 */
export function hasOverloadAlert(
  summaries: readonly Pick<PsychologistMonthSummary, 'month' | 'availableHours' | 'doneHours'>[],
  currentMonth: YearMonth,
): boolean {
  return lastClosedMonths(currentMonth).every((month) => {
    const row = summaries.find((s) => s.month === month);
    return row !== undefined && isAboveThreshold(row.availableHours, row.doneHours);
  });
}

/** Visão de ocupação de um mês fechado (ou do corrente, parcial). */
export function buildOccupancyView(
  psychologistId: string,
  month: YearMonth,
  availableHours: number,
  doneHours: number,
  currentMonth: YearMonth,
  overloadAlert: boolean,
): OccupancyView {
  return {
    psychologistId,
    month,
    availableHours,
    doneHours,
    occupancyPercent: occupancyPercent(availableHours, doneHours),
    isPartialMonth: month === currentMonth,
    overloadAlert,
  };
}

/** Meses a exibir: dois fechados e o corrente (parcial). */
export function occupancyMonths(today: ISODate): YearMonth[] {
  const current = yearMonthOf(today);
  return [...lastClosedMonths(current), current];
}

/** Só se redistribui para quem tem ocupação inferior a 80% (RN-EQP-05); n/d (sem agenda) também serve. */
export function canReceiveRedistribution(targetOccupancy: number | null): boolean {
  return targetOccupancy === null || targetOccupancy < OVERLOAD_THRESHOLD_PERCENT;
}

/** Ampliação da equipe só é recomendada com resultado mensal positivo (RN-EQP-06). A decisão é dos sócios. */
export function teamExpansionRecommended(monthlyResultCents: number): boolean {
  return monthlyResultCents > 0;
}
