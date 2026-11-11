/**
 * O que cada plano libera para o cuidador no aplicativo (docs/20-regras-planos-v2.md, tabela "O que cada plano inclui por
 * mês"). Funções PURAS: a tabela de cotas (`plan-quotas.ts`) e o quadro de benefícios (`plans.ts`) são a fonte; aqui só
 * se dá nome de tela a cada recurso.
 *
 * - `individual_session` e `group_therapy`: só Cuida e Sustenta (2 ou 4 sessões e 2 encontros por mês).
 * - `training_included`: há capacitação incluída no plano (Essencial 2 por mês; Cuida e Sustenta todas). `training_paid`:
 *   qualquer pessoa cadastrada participa pagando avulsa (R$ 40,00 por encontro), em qualquer plano.
 * - `open_circle`: as rodas de conversa abertas são ação de comunidade, para todos (RN-GRP-03).
 * - `card`, `exclusive_content`, `network_conditions`: do Essencial em diante (RN-PLN-05, 08, RN-CRT-02);
 *   `network_differentiated`: só o Sustenta (RN-PLN-07).
 * - RN-REDE-25 e decisão do líder (S-09): a jornada não tem restrição de plano; no Livre a pessoa também PEDE serviço
 *   (`request_service`, para todos).
 * - RN-PLN-19: dado de Zarit, alerta ou ARBE nunca vira oferta. Nenhuma frase daqui fala de pontuação, alerta ou risco.
 * - Regra de exibição 1 do docs/20: o app NÃO anuncia o que o plano não inclui fora de Meu plano. `featureAccess().reason`
 *   continua existindo só por compatibilidade com código antigo; nenhuma tela nova deve mostrá-lo.
 * - `groups`: chave antiga, igual a `group_therapy`; existe só enquanto o kit (`cg-plan-lock`) e testes antigos a usam.
 */
import { PlanId } from '../models/plans';
import { DEFAULT_PLANS, PLAN_ORDER, PlanDefinition } from './plans';
import { PLAN_QUOTAS } from './plan-quotas';

/** Recursos que o aplicativo do cuidador abre ou fecha por plano. */
export type CaregiverFeature =
  | 'organization'
  | 'agenda_reminders'
  | 'content'
  | 'network_search'
  | 'request_service'
  | 'open_circle'
  | 'training_paid'
  | 'training_included'
  | 'group_therapy'
  | 'individual_session'
  | 'extended_organization'
  | 'card'
  | 'exclusive_content'
  | 'network_conditions'
  | 'organization_support'
  | 'close_follow_up'
  | 'network_differentiated'
  | 'groups';

/** Nome do recurso em linguagem simples (para o quadro de planos). */
export const FEATURE_LABELS: Readonly<Record<CaregiverFeature, string>> = {
  organization: 'Organização da rotina',
  agenda_reminders: 'Agenda e lembretes',
  content: 'Conteúdos',
  network_search: 'Busca na rede',
  request_service: 'Pedir um serviço da rede',
  open_circle: 'Rodas de conversa abertas',
  training_paid: 'Capacitações avulsas',
  training_included: 'Capacitações incluídas',
  group_therapy: 'Terapia de grupo',
  individual_session: 'Atendimento psicológico individual',
  extended_organization: 'Organização ampliada',
  card: 'Cartão Nexus',
  exclusive_content: 'Conteúdos exclusivos',
  network_conditions: 'Condições especiais na rede',
  organization_support: 'Maior suporte à organização',
  close_follow_up: 'Acompanhamento mais próximo',
  network_differentiated: 'Benefícios diferenciados na rede',
  groups: 'Terapia de grupo',
};

/** O plano libera o recurso? (a tabela do docs/20, lida das cotas; o quadro de planos editável de M15 não muda isto). */
function allowedBy(planId: PlanId, feature: CaregiverFeature): boolean {
  const q = PLAN_QUOTAS[planId];
  switch (feature) {
    case 'organization':
    case 'agenda_reminders':
    case 'content':
    case 'network_search':
    case 'request_service':
    case 'open_circle':
    case 'training_paid':
      return true;
    case 'training_included':
      return q.trainingsPerMonth === 'all' || q.trainingsPerMonth > 0;
    case 'group_therapy':
    case 'groups':
      return q.groupTherapyPerMonth > 0;
    case 'individual_session':
      return q.individualSessionsPerMonth > 0;
    case 'card':
      return q.card;
    case 'exclusive_content':
      return q.exclusiveContent;
    case 'network_conditions':
      return q.networkConditions;
    case 'network_differentiated':
      return q.networkDifferentiated;
    case 'extended_organization':
      return planId !== 'livre';
    case 'organization_support':
      return planId === 'cuida' || planId === 'sustenta';
    case 'close_follow_up':
      return planId === 'sustenta';
  }
}

export interface FeatureAccess {
  allowed: boolean;
  /** Menor plano que libera o recurso (o Livre quando vale para todos). */
  minPlan: PlanId;
  /** Compatibilidade: frase do bloqueio, só quando `allowed` é falso. Não mostre em tela (docs/20, regra 1). */
  reason?: string;
}

/** "Essencial", "Cuida"...: o nome do plano sem o prefixo "Nexus". */
export function planShortName(planId: PlanId, plans: readonly PlanDefinition[] = DEFAULT_PLANS): string {
  const name = (plans.find((p) => p.id === planId) ?? DEFAULT_PLANS.find((p) => p.id === planId))?.name;
  return (name ?? planId).replace(/^Nexus\s+/, '');
}

/** O plano libera o recurso? */
export function canUseFeature(
  planId: PlanId,
  feature: CaregiverFeature,
  _plans: readonly PlanDefinition[] = DEFAULT_PLANS,
): boolean {
  return allowedBy(planId, feature);
}

/** O menor plano que libera o recurso. */
export function minimumPlanForFeature(feature: CaregiverFeature): PlanId {
  return PLAN_ORDER.find((p) => allowedBy(p, feature)) ?? 'sustenta';
}

/** Acesso ao recurso, com o menor plano (RN-PLN-19: a frase de compatibilidade só fala do plano). */
export function featureAccess(
  planId: PlanId,
  feature: CaregiverFeature,
  plans: readonly PlanDefinition[] = DEFAULT_PLANS,
): FeatureAccess {
  const minPlan = minimumPlanForFeature(feature);
  if (allowedBy(planId, feature)) {
    return { allowed: true, minPlan };
  }
  return {
    allowed: false,
    minPlan,
    reason: `Disponível a partir do plano ${planShortName(minPlan, plans)}.`,
  };
}
