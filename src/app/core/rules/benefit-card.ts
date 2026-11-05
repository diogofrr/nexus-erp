/**
 * Cartão Nexus visto pelo cuidador (RN-CRT-01 a 03, 10 a 12). Funções puras.
 *
 * - O cartão só existe para assinante pago e vale enquanto o plano pago estiver ativo (RN-CRT-02 e 03, S-22 do UX).
 * - Só parceiro ativo aceita o cartão, com o percentual do próprio parceiro (RN-CRT-10 e 11).
 * - "O que você já economizou" soma o DESCONTO de cada uso (`discountCents`), no mês e no total.
 */
import { CardUsage, Partner } from '../models';
import { Cents, ISODate } from '../models/primitives';

export interface CardSavings {
  /** Economia dos usos do mês de `today`. */
  monthCents: Cents;
  monthCount: number;
  /** Economia de todos os usos. */
  totalCents: Cents;
  totalCount: number;
}

/** Soma a economia do mês de `today` e a total. Usos de outro cartão não devem ser passados. */
export function cardSavings(usages: readonly Pick<CardUsage, 'date' | 'discountCents'>[], today: ISODate): CardSavings {
  const month = today.slice(0, 7);
  const inMonth = usages.filter((u) => u.date.slice(0, 7) === month);
  return {
    monthCents: inMonth.reduce((sum, u) => sum + u.discountCents, 0),
    monthCount: inMonth.length,
    totalCents: usages.reduce((sum, u) => sum + u.discountCents, 0),
    totalCount: usages.length,
  };
}

/** Parceiros que o cartão mostra: só `active` (RN-CRT-10), em ordem alfabética. */
export function partnersForCard<P extends Pick<Partner, 'status' | 'name'>>(partners: readonly P[]): P[] {
  return partners.filter((p) => p.status === 'active').sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}
