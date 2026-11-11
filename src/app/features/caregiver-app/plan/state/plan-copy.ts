/**
 * Textos de "Meu plano" (UX C18 e B9), escritos na voz do cuidador e SEM letra miúda. Funções puras: recebem o que o
 * núcleo já calculou (`ChangeQuote`: quando vale, quando a cobrança começa, que turmas a pessoa deixa) e só
 * escrevem a frase. Nada daqui fala de pontuação, faixa, alerta ou ARBE (RN-PLN-19).
 */
import { ChangeQuote, LostGroup, PLAN_SHORT_NAMES, ScheduledChange } from '../../../../core/commerce/subscription.service';
import { formatDate, formatMoney } from '../../../../core/format/format';
import { PlanId } from '../../../../core/models';
import {

  PLAN_NOT_INCLUDED_NOTICE,

  PlanDefinition,
  canAccessGroupTherapy,
} from '../../../../core/rules/plans';
import { PLAN_QUOTAS, limitText, singlePriceText } from '../../../../core/rules/plan-quotas';
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

/** Tudo o que o plano inclui, inclusive o que vem dos planos anteriores (CXC-010): "Seu plano agora" não esconde o que continua valendo. */
export function allBenefits(planId: PlanId, _plans: readonly PlanDefinition[]): string[] {
  return planLines(planId).map((l) => l.label);
}

/** Uma linha do que o plano inclui (docs/20), com ícone (um por linha, só para dar o que olhar; o texto é quem diz). */
export interface Perk {
  key: string;
  icon: IconName;
  label: string;
}

const line = (key: string, icon: IconName, label: string): Perk => ({ key, icon, label });

/**
 * Tudo o que cada plano inclui, na voz do cuidador, lido da tabela do docs/20 (cotas em `PLAN_QUOTAS`). A ordem é a da
 * importância para a pessoa: o que é novo no plano vem primeiro. Nenhuma linha fala do que o plano NÃO inclui (RN-PLN-22
 * continua valendo pelo quadro inteiro, que mostra os quatro lado a lado), e nenhuma cita pontuação, faixa ou alerta
 * (RN-PLN-19).
 */
export function planLines(planId: PlanId): Perk[] {
  const q = PLAN_QUOTAS[planId];
  const sessions = line('individual_session', 'heart-handshake', `Atendimento psicológico individual: ${limitText(q.individualSessionsPerMonth, 'sessões')}`);
  const therapy = line('group_therapy', 'users-round', `Terapia de grupo: ${limitText(q.groupTherapyPerMonth, 'encontros')}`);
  const trainings = line(
    'trainings',
    'book-open',
    q.trainingsPerMonth === 'all'
      ? 'Todas as capacitações do mês'
      : q.trainingsPerMonth === 0
        ? `Capacitações avulsas (${singlePriceText('training')})`
        : `${limitText(q.trainingsPerMonth, 'capacitações')} incluídas`,
  );
  const circles = line('open_circle', 'messages-square', 'Rodas de conversa abertas');
  const card = line('card', 'credit-card', 'Cartão Nexus, com descontos nos parceiros');
  switch (planId) {
    case 'livre':
      return [
        line('organization', 'clipboard-check', 'Organização básica da rotina: agenda, lembretes e remédios'),
        line('content', 'book-open', 'Conteúdos abertos'),
        line('network', 'handshake', 'Rede credenciada: consultar, comparar e pedir serviço'),
        circles,
        trainings,
      ];
    case 'essencial':
      return [
        line('organization', 'layout-list', 'Organização ampliada da rotina'),
        card,
        line('content', 'star', 'Conteúdos abertos e exclusivos'),
        line('network', 'handshake', 'Rede credenciada, com condições especiais'),
        trainings,
        circles,
      ];
    case 'cuida':
      return [
        sessions,
        therapy,
        trainings,
        line('organization', 'life-buoy', 'Maior suporte à organização da rotina'),
        card,
        line('content', 'star', 'Conteúdos abertos e exclusivos'),
        line('network', 'handshake', 'Rede credenciada, com condições especiais'),
        circles,
      ];
    case 'sustenta':
      return [
        sessions,
        therapy,
        line('network', 'badge-check', 'Rede credenciada, com benefícios diferenciados'),
        line('organization', 'hand-heart', 'Acompanhamento próximo da organização da rotina'),
        trainings,
        card,
        line('content', 'star', 'Conteúdos abertos e exclusivos'),
        circles,
      ];
  }
}

/** Os `count` destaques do plano (4 no herói, 3 no quadro): as primeiras linhas de `planLines`. */
export function planPerks(planId: PlanId, _plans: readonly PlanDefinition[], count: number): Perk[] {
  return planLines(planId).slice(0, count);
}

/** As três linhas de cota que o quadro compara entre os planos (docs/20): atendimento individual, terapia de grupo e capacitações. */
export function quotaLines(planId: PlanId): { key: string; label: string; value: string }[] {
  const q = PLAN_QUOTAS[planId];
  return [
    { key: 'individual_session', label: 'Atendimento individual', value: limitText(q.individualSessionsPerMonth, 'sessões') },
    { key: 'group_therapy', label: 'Terapia de grupo', value: limitText(q.groupTherapyPerMonth, 'encontros') },
    {
      key: 'trainings',
      label: 'Capacitações',
      value: q.trainingsPerMonth === 0 ? `Avulsas, ${singlePriceText('training')}` : limitText(q.trainingsPerMonth, 'capacitações'),
    },
  ];
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
  return `Você sai das turmas de terapia de grupo que começam depois dessa data: ${list}. As turmas em andamento continuam até o fim do ciclo.`;
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
  const groups = canAccessGroupTherapy(quote.from) ? ', inclusive a terapia de grupo' : '';
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

/** As chaves das linhas que o quadro já mostra como cota (para os destaques do quadro não repetirem). */
const QUOTA_KEYS = new Set(['individual_session', 'group_therapy', 'trainings']);

/** Os destaques do quadro de comparação: os `count` primeiros que NÃO são cota (as cotas têm linhas próprias). */
export function boardPerks(planId: PlanId, count = 3): Perk[] {
  return planLines(planId).filter((l) => !QUOTA_KEYS.has(l.key)).slice(0, count);
}
