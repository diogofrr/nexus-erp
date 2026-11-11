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

/**
 * Os convites do dia (S-11, docs/20 regra de exibição 1 e 2): a conversa com o psicólogo (só Cuida e Sustenta), a roda de
 * conversa aberta (todos), a capacitação incluída no plano e uma leitura aberta (todos). Só entra no rodízio o que a
 * pessoa pode usar de verdade: o que o plano não inclui não é convite.
 */
export type InviteKind = 'conversation' | 'circle' | 'training' | 'reading';

const INVITE_ORDER: readonly InviteKind[] = ['conversation', 'circle', 'training', 'reading'];

/**
 * O convite do dia é um RODÍZIO POR CALENDÁRIO entre os itens disponíveis para a pessoa: o dia decide, nunca a
 * pontuação, a faixa, o alerta nem a ARBE (RN-PLN-19, RN-LGPD-17). Se o item do dia não está disponível (não há roda
 * aberta, o plano não inclui a conversa), vale o próximo da ordem; sem nada disponível, `null` (a seção não aparece).
 */
export function inviteKindFor(date: ISODate, available: readonly InviteKind[]): InviteKind | null {
  if (available.length === 0) {
    return null;
  }
  const start = toDayNumber(date) % INVITE_ORDER.length;
  for (let step = 0; step < INVITE_ORDER.length; step += 1) {
    const kind = INVITE_ORDER[(start + step) % INVITE_ORDER.length] as InviteKind;
    if (available.includes(kind)) {
      return kind;
    }
  }
  return null;
}

/** Primeira letra maiúscula ("hoje" vira "Hoje"). */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
