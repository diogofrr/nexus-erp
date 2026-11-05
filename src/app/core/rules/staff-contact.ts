/**
 * O que o CUIDADOR pode saber do contato da equipe, sem pontuação, faixa nem nível (RN-ZRT-19, RN-PLN-19, RN-LGPD-17).
 * Função pura em cima de `redAlertState` (pop05.ts): a tela "Hoje" e a tela "Como estou" mostram uma nota de cuidado
 * a partir deste valor e NUNCA leem o alerta.
 *
 * - `today`: há um alerta vermelho aberto, sem contato, e o prazo (23h59 do dia, RN-ZRT-14) ainda não passou:
 *   "A equipe de psicologia vai falar com você hoje."
 * - `not_yet`: o prazo passou sem contato (o responsável técnico foi avisado, RN-ZRT-14):
 *   "A equipe ainda não conseguiu falar com você."
 * - `none`: nada a dizer (sem alerta vermelho aberto, contato já feito, alerta encerrado). Alerta amarelo não tem
 *   contato no mesmo dia, então também é `none`. Sem consentimento de saúde nunca há nota (RN-LGPD-14).
 */
import { ISODateTime } from '../models/primitives';
import { ZaritAlert } from '../models/zarit';
import { redAlertState } from './pop05';

export type StaffContactState = 'none' | 'today' | 'not_yet';

export function staffContactState(
  alerts: readonly Pick<ZaritAlert, 'level' | 'status' | 'deadlineAt' | 'contact'>[],
  now: ISODateTime,
  healthConsentActive: boolean,
): StaffContactState {
  if (!healthConsentActive) {
    return 'none';
  }
  const states = alerts
    .filter((a) => a.level === 'red')
    .map((a) => redAlertState(a, now));
  if (states.includes('overdue')) {
    return 'not_yet';
  }
  return states.includes('open') ? 'today' : 'none';
}
