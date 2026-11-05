import { ArbeSettings } from '../models/zarit';
import { evaluateArbe } from './arbe';

/**
 * Prévia dos limites da ARBE (CX-021, RN-ARBE-01 a 10): antes de salvar, mostra quantos cuidadores entrariam em
 * alerta de atenção ou crítico com os limites novos e quantos MUDAM de nível em relação aos limites de hoje.
 * Só conta: nenhum nome entra aqui. É a mesma conta de `evaluateArbe`, aplicada a todos os cuidadores que a
 * ARBE acompanha (ativos, com psicólogo e consentimento de saúde).
 */
export interface ArbePreviewPerson {
  id: string;
  /** Horas diárias de cuidado (0 a 24). */
  dailyCareHours: number;
  /** Última Zarit concluída; `null` se nunca aplicada. */
  lastZarit: number | null;
  /** Pedidos de apoio nos últimos `windowDays` dias (a janela também é um limite editável). */
  supportRequestsIn(windowDays: number): number;
}

export interface ArbeCounts {
  attention: number;
  critical: number;
}

export interface ArbeChangePreview {
  /** Com os limites de hoje. */
  current: ArbeCounts;
  /** Com os limites novos. */
  proposed: ArbeCounts;
  /** Quantos cuidadores trocam de nível (de nenhum para atenção, de atenção para crítico, etc.). */
  changed: number;
  /** Passam a ter alerta (antes não tinham). */
  entering: number;
  /** Deixam de ter alerta. */
  leaving: number;
  /** De atenção para crítico. */
  escalating: number;
  /** De crítico para atenção. */
  easing: number;
}

type Level = 0 | 1 | 2;

function levelOf(person: ArbePreviewPerson, settings: ArbeSettings): Level {
  const result = evaluateArbe(
    {
      dailyCareHours: person.dailyCareHours,
      supportRequestsInWindow: person.supportRequestsIn(settings.windowDays),
      lastZarit: person.lastZarit,
    },
    settings,
  );
  return result === null ? 0 : result.level === 'critical' ? 2 : 1;
}

export function previewArbeChange(
  people: readonly ArbePreviewPerson[],
  current: ArbeSettings,
  proposed: ArbeSettings,
): ArbeChangePreview {
  const result: ArbeChangePreview = {
    current: { attention: 0, critical: 0 },
    proposed: { attention: 0, critical: 0 },
    changed: 0,
    entering: 0,
    leaving: 0,
    escalating: 0,
    easing: 0,
  };
  people.forEach((person) => {
    const before = levelOf(person, current);
    const after = levelOf(person, proposed);
    if (before === 1) result.current.attention += 1;
    if (before === 2) result.current.critical += 1;
    if (after === 1) result.proposed.attention += 1;
    if (after === 2) result.proposed.critical += 1;
    if (before === after) {
      return;
    }
    result.changed += 1;
    if (before === 0) result.entering += 1;
    else if (after === 0) result.leaving += 1;
    else if (after > before) result.escalating += 1;
    else result.easing += 1;
  });
  return result;
}
