/**
 * Quem pode entrar no aplicativo do cuidador (docs/10-cuidador-contexto.md, seção "Entrada"). Função pura.
 *
 * Não entra quem tem o cadastro encerrado (`closed`), anonimizado (`anonymizedAt`) ou eliminado (`erasedAt`):
 * os identificadores já não existem (RN-LGPD-20 e 21, M12). Quem tem pedido de exclusão aberto
 * (`closure_requested`) entra normalmente, e quem revogou o consentimento de saúde
 * (`paused_by_consent_revocation`) também: Livre e agenda continuam (RN-LGPD-14).
 */
import { Caregiver } from '../models';

/** Tela inicial do aplicativo do cuidador (a sessão do cuidador nunca abre `/app/**`: volta aqui). */
export const CAREGIVER_HOME_PATH = '/cuidador/hoje';
/** Cadastro de quem é novo (aberto sem sessão de cuidador, junto com "Ajuda agora"). */
export const CAREGIVER_START_PATH = '/cuidador/comecar';

export type CaregiverAccessBlock = 'unknown' | 'closed' | 'anonymized' | 'erased';

/** Motivo de o cuidador não poder entrar, ou `null` se pode. */
export function caregiverAccessBlock(
  caregiver: Pick<Caregiver, 'status' | 'anonymizedAt' | 'erasedAt'> | null | undefined,
): CaregiverAccessBlock | null {
  if (!caregiver) {
    return 'unknown';
  }
  if (caregiver.erasedAt) {
    return 'erased';
  }
  if (caregiver.anonymizedAt) {
    return 'anonymized';
  }
  if (caregiver.status === 'closed') {
    return 'closed';
  }
  return null;
}

/** Frase para a tela de entrada quando o cadastro não pode entrar (linguagem simples, sem jargão). */
export const CAREGIVER_ACCESS_BLOCK_TEXT: Readonly<Record<CaregiverAccessBlock, string>> = {
  unknown: 'Não encontramos este cadastro neste navegador.',
  closed: 'Este cadastro foi encerrado e não pode mais entrar no aplicativo.',
  anonymized: 'Os dados deste cadastro foram anonimizados e ele não pode mais entrar no aplicativo.',
  erased: 'Os dados deste cadastro foram eliminados e ele não pode mais entrar no aplicativo.',
};
