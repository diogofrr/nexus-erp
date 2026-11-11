/**
 * Textos da Rede no aplicativo do cuidador (UX C12 a C15). Funções e tabelas puras: a regra (quem aparece, nota só com 5
 * avaliações, o que vai ao prestador) é do núcleo (`CaregiverNetworkService`); aqui só se escreve a frase. Nada daqui
 * mostra faixa de monitoramento, taxa de recusa, comissão ou disponibilidade do profissional (RN-REDE-30, RN-ARP-18).
 */
import { formatNumber } from '../../../../core/format/format';
import { ProviderCategory, ServiceRequest } from '../../../../core/models';
import { IconName } from '../../../../shared/ui/display/icon.component';
import { BadgeVariant } from '../../../../shared/ui/display/badge.component';

/** Aviso fixo (RN-REDE-17): a Nexus organiza, o serviço é feito e pago direto com o profissional. */
export const NETWORK_NOTICE = 'A Nexus organiza a rede. O serviço é feito e pago direto com o profissional.';

/** O que o pedido envia ao profissional (RN-LGPD-13): só nome, contato e o que a pessoa precisa. */
export const REQUEST_SUMMARY = 'Enviamos ao profissional só o seu nome, o seu contato e o que você precisa.';

/** As 10 necessidades da busca, na ordem do UX C13. */
export const CATEGORIES: readonly { value: ProviderCategory; label: string }[] = [
  { value: 'physiotherapy', label: 'Fisioterapia' },
  { value: 'professional_caregiver', label: 'Cuidador(a)' },
  { value: 'home_care', label: 'Home care' },
  { value: 'nursing', label: 'Enfermagem' },
  { value: 'pharmacy', label: 'Farmácia' },
  { value: 'clinic', label: 'Clínica' },
  { value: 'psychology', label: 'Psicologia' },
  { value: 'nutrition', label: 'Nutrição' },
  { value: 'legal', label: 'Advocacia' },
  { value: 'specialized_service', label: 'Serviço especializado' },
];

export function categoryLabel(category: ProviderCategory): string {
  return CATEGORIES.find((c) => c.value === category)?.label ?? 'Serviço';
}

/** Lê a categoria da URL; qualquer valor que não seja uma das 10 vira `null`. */
export function parseCategory(value: string | null): ProviderCategory | null {
  return CATEGORIES.find((c) => c.value === value)?.value ?? null;
}

/** "Nota 4,8 (12 avaliações)" ou "Ainda sem nota (menos de 5 avaliações)" (RN-ARP-04). */
export function ratingText(view: { average: number | null; evaluationCount: number }): string {
  return view.average === null
    ? 'Ainda sem nota (menos de 5 avaliações)'
    : `Nota ${formatNumber(view.average, 1)} (${view.evaluationCount} avaliações)`;
}

/** A nota em poucas palavras, para a tabela de comparação: "4,8 (12 avaliações)" ou "Ainda sem nota". */
export function ratingShort(view: { average: number | null; evaluationCount: number }): string {
  return view.average === null ? 'Ainda sem nota' : `${formatNumber(view.average, 1)} (${view.evaluationCount} avaliações)`;
}

export function modalityLabel(modality: ServiceRequest['modality']): string {
  return modality === 'home' ? 'Em casa' : 'No local do profissional';
}

export interface StatusView {
  label: string;
  icon: IconName;
  variant: BadgeVariant;
}

/** A situação do pedido em texto e ícone, nunca só cor (UX C15). */
export function requestStatusView(request: Pick<ServiceRequest, 'status' | 'evaluationId'>): StatusView {
  switch (request.status) {
    case 'requested':
      return { label: 'Enviado, aguardando resposta', icon: 'hourglass', variant: 'neutral' };
    case 'accepted':
      return { label: 'Aceito', icon: 'circle-check', variant: 'success' };
    case 'refused_by_provider':
      return { label: 'O profissional não pôde atender', icon: 'info', variant: 'info' };
    case 'cancelled_by_provider':
      return { label: 'Cancelado pelo profissional', icon: 'info', variant: 'info' };
    case 'cancelled_by_user':
      return { label: 'Cancelado por você', icon: 'ban', variant: 'neutral' };
    case 'completed':
      return { label: 'Concluído: avalie', icon: 'star', variant: 'info' };
    default:
      return { label: 'Avaliado', icon: 'check', variant: 'success' };
  }
}

export type OrderGroup = 'evaluate' | 'open' | 'previous';

/** Em que grupo de "Meus pedidos" o pedido fica: precisa de avaliação, em andamento ou anterior. */
export function orderGroupOf(request: Pick<ServiceRequest, 'status' | 'evaluationId'>): OrderGroup {
  if (request.status === 'completed' && !request.evaluationId) {
    return 'evaluate';
  }
  if (request.status === 'requested' || request.status === 'accepted') {
    return 'open';
  }
  return 'previous';
}
