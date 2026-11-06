/**
 * Textos e pequenas contas de tela de Grupos e capacitações do aplicativo do cuidador (UX C10). Funções puras: nada de
 * regra de negócio aqui (a inscrição, a lista de espera e o acesso por plano são do núcleo). Os rótulos de tipo, de
 * caráter e de tema vêm do módulo de grupos da equipe, para a equipe e o cuidador falarem do mesmo jeito.
 */
import { Activity, ActivityKind, ActivityLeader, Room } from '../../../../core/models';
import { KIND_LABELS as TEAM_KIND_LABELS, THEME_LABELS } from '../../../groups/state/groups-labels';

export { THEME_LABELS };

/** O tipo da atividade em linguagem de todo dia (CXC-019): a equipe diz "Terapia de grupo"; o cuidador lê "Grupo com psicólogo". */
export const KIND_LABELS: Readonly<Record<ActivityKind, string>> = {
  ...TEAM_KIND_LABELS,
  group_therapy: 'Grupo com psicólogo',
};

/**
 * O caráter da atividade, sempre à vista (RN-GRP-16, RN-ATD-19): o cuidador sabe se é para aprender e trocar ou se é
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
  support_group: 'Um grupo para conversar e trocar com outras pessoas que cuidam de uma pessoa idosa.',
  training: 'Uma capacitação para aprender a cuidar com mais segurança.',
  group_therapy: 'Um grupo com psicólogo da Nexus, para conversar sobre o que você sente.',
  open_conversation_circle: 'Uma roda de conversa aberta: qualquer pessoa pode participar.',
};

/** Como a pessoa chama a atividade nas frases ("Entrar no grupo", "Entrar na capacitação", "Entrar na roda"). */
export function placeOf(kind: ActivityKind): { enter: string; leave: string; inside: string; left: string } {
  switch (kind) {
    case 'training':
      return { enter: 'Entrar na capacitação', leave: 'Sair da capacitação', inside: 'na capacitação', left: 'saiu da capacitação' };
    case 'open_conversation_circle':
      return { enter: 'Entrar na roda', leave: 'Sair da roda', inside: 'na roda', left: 'saiu da roda' };
    default:
      return { enter: 'Entrar no grupo', leave: 'Sair do grupo', inside: 'no grupo', left: 'saiu do grupo' };
  }
}

/** "4 vagas", "1 vaga" ou "Lotado". */
export function seatsText(free: number): string {
  return free <= 0 ? 'Lotado' : `${free} ${free === 1 ? 'vaga' : 'vagas'}`;
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
