/**
 * Textos e pequenas contas de tela de Encontros do aplicativo do cuidador (docs/20; UX C10). Funções puras: nada de regra
 * de negócio aqui (a inscrição, a lista de espera, as cotas e o acesso por plano são do núcleo). Os rótulos de tipo, de
 * caráter e de tema vêm do módulo de grupos da equipe, para a equipe e o cuidador falarem do mesmo jeito.
 */
import { Activity, ActivityKind, ActivityLeader, PlanId, Room } from '../../../../core/models';
import { EnrollmentOffer, SINGLE_PRICES_CENTS, includedSentence, singlePriceText } from '../../../../core/rules/plan-quotas';
import { formatMoney } from '../../../../core/format/format';
import { KIND_LABELS as TEAM_KIND_LABELS, THEME_LABELS } from '../../../groups/state/groups-labels';

export { THEME_LABELS };

/** O tipo do encontro, o mesmo nome para a equipe e para o cuidador (docs/20: "Terapia de grupo" é o nome oficial). */
export const KIND_LABELS: Readonly<Record<ActivityKind, string>> = { ...TEAM_KIND_LABELS };

/** A ordem das seções da tela (docs/20): rodas abertas, capacitações, terapia de grupo. */
export const KIND_ORDER: readonly ActivityKind[] = ['open_circle', 'training', 'group_therapy'];

/** Título de cada seção. */
export const KIND_SECTION_TITLES: Readonly<Record<ActivityKind, string>> = {
  open_circle: 'Rodas de conversa abertas',
  training: 'Capacitações',
  group_therapy: 'Terapia de grupo',
};

/**
 * O caráter do encontro, sempre à vista (RN-GRP-16, RN-ATD-19): o cuidador sabe se é para aprender e trocar ou se é
 * psicoterapia. Sem "psicoeducação" nem "objetivo clínico" (CXC-019).
 */
export const CHARACTER_LABELS: Readonly<Record<Activity['character'], string>> = {
  guidance: 'Para aprender e trocar',
  psychotherapy: 'Psicoterapia em grupo',
};

/** Explicação do caráter, em uma frase (RN-GRP-16, RN-ATD-19). */
export const CHARACTER_TEXT: Readonly<Record<Activity['character'], string>> = {
  guidance: 'Para aprender e trocar: encontros para conversar e aprender com outras pessoas. Não é psicoterapia.',
  psychotherapy: 'Psicoterapia em grupo: um psicólogo da Nexus conduz o grupo, para cuidar do que você sente.',
};

/** O que é, em uma frase, sem prometer resultado (RN-GRP-15, RN-ETICA-05). */
export const KIND_TEXT: Readonly<Record<ActivityKind, string>> = {
  open_circle: 'Uma roda de conversa aberta: qualquer pessoa pode participar.',
  training: 'Uma capacitação para aprender a cuidar com mais segurança, com a equipe e profissionais parceiros.',
  group_therapy: 'Terapia de grupo com psicólogo da Nexus, em turma pequena, para conversar sobre o que você sente.',
};

/** Como a pessoa chama o encontro nas frases ("Entrar no grupo", "Entrar na capacitação", "Entrar na roda"). */
export function placeOf(kind: ActivityKind): { enter: string; leave: string; inside: string; left: string } {
  switch (kind) {
    case 'training':
      return { enter: 'Entrar na capacitação', leave: 'Sair da capacitação', inside: 'na capacitação', left: 'saiu da capacitação' };
    case 'open_circle':
      return { enter: 'Entrar na roda', leave: 'Sair da roda', inside: 'na roda', left: 'saiu da roda' };
    default:
      return { enter: 'Entrar no grupo', leave: 'Sair do grupo', inside: 'no grupo', left: 'saiu do grupo' };
  }
}

/** "4 vagas", "1 vaga" ou "Lista de espera" (lotado: a pessoa entra na fila, docs/20). */
export function seatsText(free: number): string {
  return free <= 0 ? 'Lista de espera' : `${free} ${free === 1 ? 'vaga' : 'vagas'}`;
}

/**
 * A linha de valor do cartão e do detalhe (docs/20): roda aberta nada diz; capacitação "Incluída no seu plano" ou o valor
 * avulso ("Você pode participar pagando por encontro" no Livre); terapia de grupo "Incluída no seu plano" ou o avulso.
 * `null` quando não há nada a dizer. Nunca fala do que o plano não inclui.
 */
export function offerLine(kind: ActivityKind, offer: EnrollmentOffer, planId: PlanId): string | null {
  if (kind === 'open_circle' || offer.kind === 'free' || offer.kind === 'blocked') {
    return null;
  }
  if (offer.kind === 'included') {
    return offer.usage ? includedSentence(offer.usage, offer.meetings) : 'Incluída no seu plano';
  }
  if (kind === 'training' && planId === 'livre') {
    return 'Você pode participar pagando por encontro';
  }
  return singlePriceText(kind === 'training' ? 'training' : 'group_therapy');
}

/** O detalhe do valor avulso na folha de inscrição: "R$ 40,00 por encontro: R$ 80,00 por 2 encontros neste mês." */
export function paidDetail(kind: ActivityKind, offer: EnrollmentOffer): string | null {
  if (offer.kind !== 'paid') {
    return null;
  }
  const unit = kind === 'training' ? SINGLE_PRICES_CENTS.training : SINGLE_PRICES_CENTS.group_therapy;
  const count = offer.meetings;
  return `${formatMoney(unit)} por encontro: ${formatMoney(offer.priceCents)} por ${count} ${count === 1 ? 'encontro' : 'encontros'} neste mês. O pagamento é combinado depois. No protótipo não há cobrança.`;
}

/** "Conduzido por Dra. Letícia Amaral, psicóloga (CRP-04/00003, fictício)." */
export function leaderLine(leader: ActivityLeader): string {
  if (leader.type !== 'psychologist') {
    return `Conduzido por ${leader.name}.`;
  }
  const role = /^Dra\./.test(leader.name) ? 'psicóloga' : /^Dr\./.test(leader.name) ? 'psicólogo' : 'psicólogo(a)';
  const registration = leader.professionalRegistration;
  if (!registration) {
    return `Conduzido por ${leader.name}, ${role}.`;
  }
  const fictitious = /\(fictício\)\s*$/.test(registration);
  const number = registration.replace(/\s*\(fictício\)\s*$/, '');
  return `Conduzido por ${leader.name}, ${role} (${number}${fictitious ? ', fictício' : ''}).`;
}

/** "Sala com acesso sem degraus, sanitário adaptado, boa iluminação e assentos com apoio de braços." */
export function roomAccessibility(room: Pick<Room, 'accessibility'>): string {
  const a = room.accessibility;
  const items = [
    a.stepFreeAccess ? 'acesso sem degraus' : null,
    a.adaptedRestroom ? 'sanitário adaptado' : null,
    a.goodLighting ? 'boa iluminação' : null,
    a.armrestSeating ? 'assentos com apoio de braços' : null,
  ].filter((item): item is string => item !== null);
  if (items.length === 0) {
    return '';
  }
  const last = items[items.length - 1];
  const list = items.length === 1 ? last : `${items.slice(0, -1).join(', ')} e ${last}`;
  return `Sala com ${list}.`;
}
