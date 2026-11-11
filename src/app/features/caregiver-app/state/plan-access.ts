/**
 * O que o plano libera, nas palavras das regras v2 (docs/20-regras-planos-v2.md), em cima do contexto do cuidador. É o
 * ÚNICO lugar das telas de UX (Hoje, portas, Agenda, Rede) que fala com as chaves de acesso (`docs/21-regras-v2-dev.md`,
 * seção 1): se uma chave mudar, troca-se aqui e nada mais muda. Nenhuma função daqui devolve frase: o app não anuncia o
 * que o plano não inclui (regra de exibição 1); quem chama só mostra ou esconde.
 *
 * `trainingIncluded` lê a cota do mês em `ctx.quotas()` (publicada pelo agente Regras v2, docs/21-regras-v2-dev.md): no
 * Essencial a cota de 2 capacitações pode acabar no mês.
 */
import { CaregiverContextService } from './caregiver-context.service';
import { EventPlanAccess } from './event-type';

/** O acesso aos tipos de encontro, para `canSeeEventType` e para o texto de quem participa. */
export function eventAccessOf(ctx: CaregiverContextService): EventPlanAccess {
  return {
    groupTherapy: ctx.canUse('group_therapy'),
    // A cota do mês pode acabar (Essencial: 2 por mês); Cuida e Sustenta têm todas ('all').
    trainingIncluded: ctx.quotas().trainings.left !== 0,
  };
}

/** A sessão individual com o psicólogo da Nexus é de Cuida e Sustenta (docs/20): só esses planos a veem. */
export function canBookSession(ctx: CaregiverContextService): boolean {
  return ctx.canUse('individual_session');
}

/** O Cartão Nexus existe para o assinante pago (RN-CRT-02); quem não tem não vê nada sobre ele fora de Meu plano. */
export function hasCard(ctx: CaregiverContextService): boolean {
  return ctx.canUse('card');
}

/** As condições especiais na rede valem do Essencial em diante (RN-REDE-25); sem elas a linha não existe. */
export function hasNetworkConditions(ctx: CaregiverContextService): boolean {
  return ctx.canUse('network_conditions');
}
