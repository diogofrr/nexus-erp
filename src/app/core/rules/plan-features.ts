/**
 * O que cada plano libera para o cuidador no aplicativo (docs/10-cuidador-contexto.md, "Planos"). Funções PURAS,
 * em cima do quadro de planos de `plans.ts` (a fonte dos benefícios): nada aqui repete a regra, só dá nome de tela
 * a cada benefício.
 *
 * - RN-PLN-01 a 03: Livre = organização básica, agenda e lembretes, conteúdos e acesso inicial à rede;
 *   Essencial soma organização ampliada, Cartão Nexus, conteúdos exclusivos e condições especiais na rede;
 *   Cuida soma maior apoio à organização, grupos de apoio e capacitações; Sustenta soma acompanhamento
 *   organizacional mais próximo, maior nível de suporte e benefícios diferenciados na rede.
 * - RN-PLN-08 e RN-CRT-02: o Cartão Nexus só existe para assinante pago.
 * - RN-PLN-10 e RN-GRP-02: inscrição em grupo de apoio e capacitação só a partir do Cuida (as rodas abertas
 *   valem para todos: use `canAccessActivity`).
 * - RN-REDE-25 e decisão do líder sobre a suposição S-09 do UX: a jornada (etapas 5 a 8) não tem restrição de plano,
 *   então no Livre a pessoa também PEDE serviço pela rede (`request_service`, para todos os planos). O que o plano
 *   limita são as condições especiais da rede (`network_conditions`, do Essencial em diante).
 * - RN-ATD-03 a 05: agendar com o psicólogo da Nexus vale para todos os planos; o plano só muda as condições.
 * - RN-PLN-19: dado de Zarit, alerta ou ARBE nunca vira oferta, desconto nem convite de upgrade. Por isso nenhuma
 *   frase daqui (nem o `reason`) fala de pontuação, alerta ou risco: só do plano.
 */
import { BenefitKey, PlanId } from '../models/plans';
import {
  DEFAULT_PLANS,
  PlanDefinition,
  minimumPlanFor,
  planHasBenefit,
} from './plans';

/** Recursos que o aplicativo do cuidador abre ou fecha por plano. */
export type CaregiverFeature =
  | 'organization'
  | 'agenda_reminders'
  | 'content'
  | 'network_search'
  | 'request_service'
  | 'psych_scheduling'
  | 'extended_organization'
  | 'card'
  | 'exclusive_content'
  | 'network_conditions'
  | 'organization_support'
  | 'groups'
  | 'close_follow_up'
  | 'network_benefits';

/** Benefício do quadro de planos que sustenta cada recurso (`null` = todos os planos). */
export const FEATURE_BENEFIT: Readonly<Record<CaregiverFeature, BenefitKey | null>> = {
  organization: 'basic_organization',
  agenda_reminders: 'agenda_reminders',
  content: 'content',
  network_search: 'network_initial_access',
  request_service: null,
  psych_scheduling: null,
  extended_organization: 'extended_organization',
  card: 'card_discounts',
  exclusive_content: 'exclusive_content',
  network_conditions: 'network_special_conditions',
  organization_support: 'greater_organization_support',
  groups: 'support_groups',
  close_follow_up: 'close_organizational_follow_up',
  network_benefits: 'network_differentiated_benefits',
};

/** Nome do recurso em linguagem simples (para o bloqueio por plano e para o quadro de planos). */
export const FEATURE_LABELS: Readonly<Record<CaregiverFeature, string>> = {
  organization: 'Organização da rotina',
  agenda_reminders: 'Agenda e lembretes',
  content: 'Conteúdos',
  network_search: 'Busca na rede',
  request_service: 'Pedir um serviço da rede',
  psych_scheduling: 'Conversar com um psicólogo',
  extended_organization: 'Organização ampliada',
  card: 'Cartão Nexus',
  exclusive_content: 'Conteúdos exclusivos',
  network_conditions: 'Condições especiais na rede',
  organization_support: 'Maior apoio à organização',
  groups: 'Grupos e capacitações',
  close_follow_up: 'Acompanhamento mais próximo',
  network_benefits: 'Benefícios diferenciados na rede',
};

export interface FeatureAccess {
  allowed: boolean;
  /** Menor plano que libera o recurso (o Livre quando vale para todos). */
  minPlan: PlanId;
  /** Frase do bloqueio, só quando `allowed` é falso: "Disponível a partir do plano Cuida." */
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
  plans: readonly PlanDefinition[] = DEFAULT_PLANS,
): boolean {
  const benefit = FEATURE_BENEFIT[feature];
  return benefit === null || planHasBenefit(planId, benefit, plans);
}

/** Acesso ao recurso, com o menor plano e a frase do bloqueio (RN-PLN-19: só fala do plano). */
export function featureAccess(
  planId: PlanId,
  feature: CaregiverFeature,
  plans: readonly PlanDefinition[] = DEFAULT_PLANS,
): FeatureAccess {
  const benefit = FEATURE_BENEFIT[feature];
  const minPlan: PlanId = benefit === null ? 'livre' : minimumPlanFor(benefit);
  if (canUseFeature(planId, feature, plans)) {
    return { allowed: true, minPlan };
  }
  return {
    allowed: false,
    minPlan,
    reason: `Disponível a partir do plano ${planShortName(minPlan, plans)}.`,
  };
}
