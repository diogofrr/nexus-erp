/**
 * Textos de "Meu plano" (UX C18 e B9), escritos na voz do cuidador e SEM letra miúda. Funções puras: recebem o que o
 * núcleo já calculou (`ChangeQuote`: quando vale, quando a cobrança começa, que turmas a pessoa deixa) e só
 * escrevem a frase. Nada daqui fala de pontuação, faixa, alerta ou ARBE (RN-PLN-19).
 */
import { ChangeQuote, LostGroup, PLAN_SHORT_NAMES, ScheduledChange } from '../../../../core/commerce/subscription.service';
import { formatDate, formatMoney } from '../../../../core/format/format';
import { BenefitKey, PlanId } from '../../../../core/models';
import {
  BENEFIT_LABELS,
  PLAN_NOT_INCLUDED_NOTICE,
  PLAN_ORDER,
  PlanDefinition,
  canAccessGroupsAndTrainings,
} from '../../../../core/rules/plans';
import { IconName } from '../../../../shared/ui/display/icon.component';
import { dayMonth } from '../../state/day-format';

/** Aviso fixo na contratação (RN-PLN-22): a mensalidade não inclui serviços da rede nem atendimento psicológico. */
export const NOT_INCLUDED_NOTICE = PLAN_NOT_INCLUDED_NOTICE;

/** Sem multa, em qualquer mês (RN-PLN-13). */
export const CANCEL_ANY_MONTH = 'Você pode cancelar em qualquer mês, sem multa.';

/** Erro de troca (UX C18): nada foi alterado. */
export const CHANGE_FAILED =
  'Não foi possível mudar o plano. Nada foi alterado. Tente de novo; se continuar, fale com a gente.';

/** "R$ 49,90 por mês" (Livre: "R$ 0,00 por mês" no quadro, "Sem custo, sem prazo" no cartão do plano atual). */
export function priceLine(plan: Pick<PlanDefinition, 'monthlyPriceCents'>): string {
  return `${formatMoney(plan.monthlyPriceCents)} por mês`;
}

/** O que o plano traz que o anterior não traz ("Tudo do plano anterior, mais:"). O Livre traz tudo o que é dele. */
export function ownBenefits(planId: PlanId, plans: readonly PlanDefinition[]): string[] {
  const plan = plans.find((p) => p.id === planId);
  const index = PLAN_ORDER.indexOf(planId);
  const previous = index > 0 ? plans.find((p) => p.id === PLAN_ORDER[index - 1]) : undefined;
  const already = new Set(previous?.benefits ?? []);
  return (plan?.benefits ?? []).filter((b) => !already.has(b)).map((b) => BENEFIT_LABELS[b]);
}

/** Tudo o que o plano inclui, inclusive o que vem dos planos anteriores (CXC-010): "Seu plano agora" não esconde o que continua valendo. */
export function allBenefits(planId: PlanId, plans: readonly PlanDefinition[]): string[] {
  return (plans.find((p) => p.id === planId)?.benefits ?? []).map((b) => BENEFIT_LABELS[b]);
}

/** Ícone de cada benefício (um por linha, só para dar o que olhar; o texto é quem diz). */
export const BENEFIT_ICONS: Readonly<Record<BenefitKey, IconName>> = {
  app_access: 'house',
  basic_organization: 'clipboard-check',
  agenda_reminders: 'calendar-days',
  content: 'book-open',
  network_initial_access: 'handshake',
  extended_organization: 'layout-list',
  card_discounts: 'credit-card',
  exclusive_content: 'star',
  network_special_conditions: 'handshake',
  greater_organization_support: 'life-buoy',
  support_groups: 'users-round',
  trainings: 'award',
  close_organizational_follow_up: 'heart-handshake',
  higher_support_level: 'hand-heart',
  network_differentiated_benefits: 'badge-check',
};

/**
 * Os destaques de cada plano, na ordem em que aparecem: os três primeiros são os que o quadro mostra (o que é DO plano),
 * o quarto é o que o cartão do plano atual acrescenta (no Cuida, o Cartão Nexus). A lista completa fica atrás de
 * "Ver tudo que inclui".
 */
const HIGHLIGHT_ORDER: Readonly<Record<PlanId, readonly BenefitKey[]>> = {
  livre: ['agenda_reminders', 'basic_organization', 'content', 'network_initial_access'],
  essencial: ['extended_organization', 'card_discounts', 'exclusive_content', 'network_special_conditions'],
  cuida: ['support_groups', 'trainings', 'greater_organization_support', 'card_discounts'],
  sustenta: ['close_organizational_follow_up', 'higher_support_level', 'network_differentiated_benefits', 'support_groups'],
};

export interface Perk {
  key: BenefitKey;
  icon: IconName;
  label: string;
}

/**
 * Os `count` destaques do plano, com ícone. Só entra o que o plano de fato inclui (o catálogo é editável): se faltar algum
 * dos escolhidos, completa com os outros benefícios do plano.
 */
export function planPerks(planId: PlanId, plans: readonly PlanDefinition[], count: number): Perk[] {
  const has = plans.find((p) => p.id === planId)?.benefits ?? [];
  const chosen = HIGHLIGHT_ORDER[planId].filter((key) => has.includes(key));
  const rest = has.filter((key) => !chosen.includes(key));
  return [...chosen, ...rest].slice(0, count).map((key) => ({ key, icon: BENEFIT_ICONS[key], label: BENEFIT_LABELS[key] }));
}

/** O preço em duas partes ("R$ 119,90" e "por mês"), para dar peso ao valor e deixar a unidade pequena. */
export function priceParts(plan: Pick<PlanDefinition, 'monthlyPriceCents'>): { amount: string; unit: string } {
  return { amount: formatMoney(plan.monthlyPriceCents), unit: 'por mês' };
}

/** A faixa de uma troca ou de um cancelamento já pedido: o que muda e quando (Manter meu plano desfaz). */
export function scheduledNote(change: Pick<ScheduledChange, 'kind' | 'to' | 'at'>): { title: string; text: string } {
  const when = formatDate(change.at);
  return change.kind === 'cancel'
    ? { title: 'Cancelamento agendado', text: `Seu plano volta a ser o Livre em ${when}.` }
    : { title: 'Mudança agendada', text: `Seu plano muda para o ${PLAN_SHORT_NAMES[change.to]} em ${when}.` };
}

/** Como voltar atrás, dito antes de confirmar uma troca (CXC-010). */
export const CHANGE_BACK = 'Se mudar de ideia, é só mudar de plano de novo.';

export interface ChangeCopy {
  /** O tipo de troca; o cancelamento usa o botão de perigo suave (UX A.2.7). */
  kind: ChangeQuote['kind'];
  /** Título da folha: "Mudar para o Cuida?" */
  heading: string;
  /** Texto do botão: "Mudar para o Cuida", "Agendar mudança para o Essencial", "Agendar cancelamento". */
  actionLabel: string;
  /** O efeito, uma frase por linha, dito ANTES de confirmar. */
  lines: string[];
  /** Mostra o aviso "a mensalidade não inclui serviços da rede nem atendimento psicológico" (na contratação). */
  showNotice: boolean;
}

function lostGroupsLine(lost: readonly LostGroup[]): string {
  if (lost.length === 0) {
    return '';
  }
  const list = lost.map((g) => `${g.title} (${dayMonth(g.startDate)})`).join(', ');
  return `Você sai dos grupos que começam depois dessa data: ${list}. Os grupos em andamento continuam até o fim do ciclo.`;
}

/** Texto do botão de cada plano no quadro e na folha, pelo tipo de troca. `null` quando não há troca (mesmo plano). */
export function actionLabelFor(kind: ChangeQuote['kind'], to: PlanId): string | null {
  switch (kind) {
    case 'upgrade':
      return `Mudar para o ${PLAN_SHORT_NAMES[to]}`;
    case 'downgrade':
      return `Agendar mudança para o ${PLAN_SHORT_NAMES[to]}`;
    case 'cancel':
      return 'Agendar cancelamento';
    default:
      return null;
  }
}

/**
 * A frase do efeito de uma troca (UX B9 e C18). Subir vale hoje; descer e cancelar valem no fim do ciclo pago, com as
 * turmas que a pessoa deixa ditas junto. `priceOf` devolve "R$ 119,90" do plano de destino.
 */
export function changeCopy(quote: ChangeQuote, priceOf: (plan: PlanId) => string): ChangeCopy {
  const actionLabel = actionLabelFor(quote.kind, quote.to) ?? 'Confirmar mudança de plano';
  const to = PLAN_SHORT_NAMES[quote.to];
  const from = PLAN_SHORT_NAMES[quote.from];
  if (quote.kind === 'same') {
    return { kind: quote.kind, heading: 'Seu plano agora', actionLabel, lines: [], showNotice: false };
  }
  if (quote.kind === 'upgrade') {
    const card = quote.issuesCard ? ' O Cartão Nexus é emitido agora.' : '';
    const billing = quote.billingFrom ? formatDate(quote.billingFrom) : '';
    return {
      kind: quote.kind,
      heading: `Mudar para o ${to}?`,
      actionLabel,
      lines: [`Vale hoje.${card} A cobrança de ${priceOf(quote.to)} começa no próximo ciclo, em ${billing}.`, CHANGE_BACK],
      showNotice: true,
    };
  }
  if (quote.kind === 'cancel') {
    return {
      kind: quote.kind,
      heading: 'Cancelar o plano?',
      actionLabel,
      lines: [
        `O cancelamento fica agendado para ${formatDate(quote.effectiveAt)}. Até lá tudo continua. Nessa data o cartão deixa de valer e o plano vira Livre.`,
        ...(quote.lostGroups.length > 0 ? [lostGroupsLine(quote.lostGroups)] : []),
      ],
      showNotice: false,
    };
  }
  const groups = canAccessGroupsAndTrainings(quote.from) ? ', inclusive os grupos' : '';
  return {
    kind: quote.kind,
    heading: `Mudar para o ${to} no fim do ciclo?`,
    actionLabel,
    lines: [
      `Vale no fim do ciclo, em ${formatDate(quote.effectiveAt)}. Até lá, o ${from} continua${groups}.`,
      ...(quote.lostGroups.length > 0 ? [lostGroupsLine(quote.lostGroups)] : []),
      CHANGE_BACK,
    ],
    showNotice: false,
  };
}
