/**
 * Regras puras da tela Hoje (docs/10-cuidador-ux.md, C4). Nada lê relógio nem banco: recebem o que precisam.
 */
import { toDayNumber, timeOf } from '../../../../core/clock/date-utils';
import { ISODate, ISODateTime } from '../../../../core/models';

/** Saudação pela hora do relógio do sistema (S-14): Bom dia até 11:59, Boa tarde até 17:59, Boa noite depois. */
export function greetingFor(now: ISODateTime): 'Bom dia' | 'Boa tarde' | 'Boa noite' {
  const time = timeOf(now);
  if (time < '12:00') {
    return 'Bom dia';
  }
  return time < '18:00' ? 'Boa tarde' : 'Boa noite';
}

/** Os três convites do dia, todos abertos a todos os planos (S-11, RN-PLN-19). */
export type InviteKind = 'conversation' | 'circle' | 'reading';

const INVITE_ORDER: readonly InviteKind[] = ['conversation', 'circle', 'reading'];

/**
 * O convite do dia é um RODÍZIO POR CALENDÁRIO entre itens abertos a todos os planos: o dia decide, nunca a
 * pontuação, a faixa, o alerta, a ARBE nem o plano (RN-PLN-19, RN-LGPD-17). Se o item do dia não existe (não há
 * roda aberta nem leitura livre), vale o próximo da ordem. A conversa com o psicólogo sempre existe.
 */
export function inviteKindFor(date: ISODate, available: readonly InviteKind[]): InviteKind {
  const start = toDayNumber(date) % INVITE_ORDER.length;
  for (let step = 0; step < INVITE_ORDER.length; step += 1) {
    const kind = INVITE_ORDER[(start + step) % INVITE_ORDER.length] as InviteKind;
    if (kind === 'conversation' || available.includes(kind)) {
      return kind;
    }
  }
  return 'conversation';
}

/** Primeira letra maiúscula ("hoje" vira "Hoje"). */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
