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
export { leadersShort } from '../../state/people-format';

/** O tipo do encontro, o mesmo nome para a equipe e para o cuidador (docs/20: "Terapia em grupo" é o nome oficial). */
export const KIND_LABELS: Readonly<Record<ActivityKind, string>> = { ...TEAM_KIND_LABELS };

/** A ordem das seções da tela (docs/20): capacitações, terapia em grupo. */
export const KIND_ORDER: readonly ActivityKind[] = ['training', 'group_therapy'];

/** Título de cada seção. */
export const KIND_SECTION_TITLES: Readonly<Record<ActivityKind, string>> = {
  training: 'Capacitações',
  group_therapy: 'Terapia em grupo',
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
  training: 'Uma capacitação para aprender a cuidar com mais segurança, com a equipe e profissionais parceiros.',
  group_therapy: 'Terapia em grupo com psicólogo da Nexus, em turma pequena, para conversar sobre o que você sente.',
};

/** Como a pessoa chama o encontro nas frases ("Entrar no grupo", "Entrar na capacitação"). */
export function placeOf(kind: ActivityKind): { enter: string; leave: string; inside: string; left: string } {
  switch (kind) {
    case 'training':
      return { enter: 'Entrar na capacitação', leave: 'Sair da capacitação', inside: 'na capacitação', left: 'saiu da capacitação' };
    default:
      return { enter: 'Entrar no grupo', leave: 'Sair do grupo', inside: 'no grupo', left: 'saiu do grupo' };
  }
}

/** "4 vagas", "1 vaga" ou "Lista de espera" (lotado: a pessoa entra na fila, docs/20). */
export function seatsText(free: number): string {
  return free <= 0 ? 'Lista de espera' : `${free} ${free === 1 ? 'vaga' : 'vagas'}`;
}

/**
 * A linha de valor do cartão e do detalhe (docs/20): capacitação "Incluída no seu plano" ou "Avulsa: R$ 45,00" (o valor
 * DESTA capacitação); terapia em grupo "Incluída no seu plano" ou o avulso por encontro.
 * `null` quando não há nada a dizer. Nunca fala do que o plano não inclui.
 */
export function offerLine(kind: ActivityKind, offer: EnrollmentOffer, _planId: PlanId): string | null {
  if (offer.kind === 'blocked') {
    return null;
  }
  if (offer.kind === 'included') {
    return offer.usage ? includedSentence(offer.usage, offer.meetings) : 'Incluída no seu plano';
  }
  if (kind === 'training') {
    return `Avulsa: ${formatMoney(offer.priceCents)}`;
  }
  return singlePriceText('group_therapy');
}

/**
 * O detalhe do valor avulso na folha de inscrição. Capacitação: "Valor desta capacitação: R$ 95,00, com todos os
 * encontros." Terapia em grupo: "R$ 60,00 por encontro: R$ 120,00 por 2 encontros neste mês."
 */
export function paidDetail(kind: ActivityKind, offer: EnrollmentOffer): string | null {
  if (offer.kind !== 'paid') {
    return null;
  }
  if (kind === 'training') {
    return `Valor desta capacitação: ${formatMoney(offer.priceCents)}, com todos os encontros. O pagamento é combinado depois. No protótipo não há cobrança.`;
  }
  const unit = SINGLE_PRICES_CENTS.group_therapy;
  const count = offer.meetings;
  return `${formatMoney(unit)} por encontro: ${formatMoney(offer.priceCents)} por ${count} ${count === 1 ? 'encontro' : 'encontros'} neste mês. O pagamento é combinado depois. No protótipo não há cobrança.`;
}

/** "Conduzido por Marina Gomes, da equipe de psicologia." (com CRP cadastrado, ele vem entre parênteses). */
export function leaderLine(leader: ActivityLeader): string {
  if (leader.type !== 'psychologist') {
    return `Conduzido por ${leader.name}.`;
  }
  const role = 'da equipe de psicologia';
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
