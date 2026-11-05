/**
 * Pedido de serviço à rede e avaliação do serviço: o MIOLO das regras, em funções puras, para a equipe (M08, que
 * registra em nome do usuário) e para o aplicativo do cuidador (que pede e avalia ele mesmo) falarem da mesma
 * regra. Cada lado traduz o código devolvido na frase do seu público; a checagem de perfil fica na borda.
 *
 * - RN-REDE-18: só prestador ativo ou em monitoramento recebe pedido (suspenso e descredenciado não aparecem).
 * - RN-REDE-25 e 26: todos os planos consultam, comparam e pedem; o prestador responde pela equipe.
 * - RN-LGPD-13 (suposição S-19 do UX): sem a cláusula de proteção de dados assinada, o prestador não recebe dados
 *   do usuário, então o pedido não sai pelo aplicativo.
 * - RN-ARP-02 e 16: duas notas inteiras de 1 a 5 (qualidade técnica e pontualidade com cordialidade), uma
 *   avaliação por serviço concluído, e o cuidador pode corrigir em até 7 dias.
 */
import { compareDates } from '../clock/date-utils';
import { ISODate, Rating } from '../models/primitives';
import { Provider, ProviderEvaluation, ServiceRequest } from '../models/network';
import { isSearchable } from './arp';

export type ServiceRequestProblem =
  | 'no_provider'
  | 'not_searchable'
  | 'no_need'
  | 'home_not_offered';

/**
 * O pedido pode ser criado? `null` quando sim. Confere o prestador (existe e está na busca), a necessidade escrita
 * e se o atendimento em casa é oferecido por ele.
 */
export function serviceRequestProblem(
  provider: Pick<Provider, 'status' | 'homeCare'> | undefined,
  need: string,
  modality: ServiceRequest['modality'] | null,
): ServiceRequestProblem | null {
  if (!provider) {
    return 'no_provider';
  }
  if (!isSearchable(provider.status)) {
    return 'not_searchable';
  }
  if (!need.trim()) {
    return 'no_need';
  }
  if (modality === 'home' && !provider.homeCare) {
    return 'home_not_offered';
  }
  return null;
}

/** S-19 e RN-LGPD-13: o prestador só recebe pedido pelo aplicativo com a cláusula de proteção de dados assinada. */
export function providerAcceptsAppRequests(
  provider: Pick<Provider, 'dataProtectionClauseSignedAt'>,
): boolean {
  return provider.dataProtectionClauseSignedAt !== undefined;
}

/** O pedido ainda está em andamento (enviado ou aceito)? Só ele pode ser cancelado pelo usuário (RN-REDE-26). */
export function isRequestOpen(status: ServiceRequest['status']): boolean {
  return status === 'requested' || status === 'accepted';
}

/** Nota inteira de 1 a 5 (RN-ARP-02). */
export function isValidRating(value: number | null | undefined): value is Rating {
  return value !== null && value !== undefined && Number.isInteger(value) && value >= 1 && value <= 5;
}

export type EvaluationProblem =
  | 'bad_technical'
  | 'bad_punctuality'
  | 'already_evaluated'
  | 'not_completed';

/**
 * A avaliação pode ser enviada? Duas notas válidas, serviço concluído e ainda sem avaliação (uma por serviço,
 * RN-ARP-02). `null` quando sim.
 */
export function evaluationProblem(
  request: Pick<ServiceRequest, 'status' | 'evaluationId'>,
  technical: number | null,
  punctuality: number | null,
): EvaluationProblem | null {
  if (!isValidRating(technical)) {
    return 'bad_technical';
  }
  if (!isValidRating(punctuality)) {
    return 'bad_punctuality';
  }
  if (request.evaluationId || request.status === 'evaluated') {
    return 'already_evaluated';
  }
  if (request.status !== 'completed') {
    return 'not_completed';
  }
  return null;
}

/** O cuidador ainda pode corrigir a avaliação? Até `editableUntil` inclusive (7 dias, RN-ARP-16). */
export function isEvaluationEditable(
  evaluation: Pick<ProviderEvaluation, 'editableUntil'>,
  today: ISODate,
): boolean {
  return compareDates(today, evaluation.editableUntil) <= 0;
}
