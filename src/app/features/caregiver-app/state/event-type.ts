/**
 * Tipo de encontro visto pelo cuidador (docs/20-regras-planos-v2.md, "Tipos de atividade"): capacitação e terapia em
 * grupo. Nada mais existe (a roda de conversa aberta saiu na migração v3). Funções PURAS: recebem o que precisam, nunca leem relógio nem banco.
 *
 * - `eventTypeOf` traduz a chave gravada na atividade (`Activity.kind`) para o tipo de tela, inclusive as chaves antigas
 *   (`support_group` virou `group_therapy`); a roda aberta (`open_circle`, `open_conversation_circle`) vira `null` e
 *   não aparece.
 * - `canSeeEventType` é a regra de exibição 2 do dono: quem não tem acesso ao tipo NÃO o vê (nem como vitrine). Livre e
 *   Essencial veem capacitações; Cuida e Sustenta veem tudo. A única exceção é estar inscrito: a pessoa
 *   vê o que já é dela (`enrolled`).
 */
import { compareDateTimes } from '../../../core/clock/date-utils';
import { Activity, ActivityEnrollment, ID, ISODateTime } from '../../../core/models';
import { IconName } from '../../../shared/ui/display/icon.component';

export const CG_EVENT_TYPES = ['training', 'group_therapy'] as const;
export type CgEventType = (typeof CG_EVENT_TYPES)[number];

/** O que a tela precisa saber do plano para decidir o que mostra (o contexto do cuidador atende a este contrato). */
export interface EventPlanAccess {
  /** Terapia em grupo (e a sessão individual) são de Cuida e Sustenta. */
  groupTherapy: boolean;
  /** A capacitação do mês está incluída no plano (senão a pessoa paga avulsa). */
  trainingIncluded: boolean;
}

export const EVENT_TYPE_LABELS: Readonly<Record<CgEventType, string>> = {
  training: 'Capacitação',
  group_therapy: 'Terapia em grupo',
};

/** A frase curta de quem pode participar, para o cartão do convite. */
export const EVENT_TYPE_WHO: Readonly<Record<CgEventType, string>> = {
  training: 'Sem custo para você.',
  group_therapy: 'Com o psicólogo da Nexus.',
};

export const EVENT_TYPE_ICONS: Readonly<Record<CgEventType, IconName>> = {
  training: 'book-open',
  group_therapy: 'heart-handshake',
};

/** A chave gravada na atividade, nova ou antiga, vira o tipo de tela; chave desconhecida vira `null` (não se mostra). */
export function eventTypeOf(kind: string): CgEventType | null {
  switch (kind) {
    case 'training':
      return 'training';
    case 'group_therapy':
    case 'support_group':
      return 'group_therapy';
    default:
      return null;
  }
}

/**
 * O plano deixa a pessoa ver este tipo de encontro? Capacitação, todos (a capacitação avulsa existe para
 * qualquer cadastro); terapia em grupo, só com o acesso. Quem já está inscrita vê sempre (`enrolled`).
 */
export function canSeeEventType(type: CgEventType, access: EventPlanAccess, enrolled = false): boolean {
  if (enrolled) {
    return true;
  }
  return type === 'group_therapy' ? access.groupTherapy : true;
}

/** "Sem custo para você." ou "Avulsa, com valor por encontro." para a capacitação; o texto fixo para os outros tipos. */
export function eventWhoText(type: CgEventType, access: EventPlanAccess): string {
  if (type === 'training' && !access.trainingIncluded) {
    return 'Avulsa, com valor por encontro.';
  }
  return EVENT_TYPE_WHO[type];
}

/** Um encontro em que a pessoa já está inscrita: entra na Agenda e no "Próximo compromisso" de Hoje, com o tipo. */
export interface EnrolledMeeting {
  activityId: ID;
  meetingId: ID;
  title: string;
  type: CgEventType;
  startAt: ISODateTime;
}

/**
 * Os encontros futuros em que a pessoa está inscrita (`enrolled`), de atividades abertas, lotadas ou em andamento, do
 * mais próximo ao mais distante. Lista de espera não entra (ainda não é dela). Função pura: recebe as coleções.
 */
export function enrolledMeetingsOf(
  activities: readonly Activity[],
  enrollments: readonly ActivityEnrollment[],
  caregiverId: ID,
  now: ISODateTime,
): EnrolledMeeting[] {
  const mine = new Set(
    enrollments.filter((e) => e.caregiverId === caregiverId && e.status === 'enrolled').map((e) => e.activityId),
  );
  const found: EnrolledMeeting[] = [];
  for (const activity of activities) {
    const type = eventTypeOf(activity.kind);
    const live = activity.status === 'open' || activity.status === 'full' || activity.status === 'in_progress';
    if (!type || !live || !mine.has(activity.id)) {
      continue;
    }
    for (const meeting of activity.meetings) {
      if (!meeting.done && compareDateTimes(meeting.startAt, now) >= 0) {
        found.push({ activityId: activity.id, meetingId: meeting.id, title: activity.title, type, startAt: meeting.startAt });
      }
    }
  }
  return found.sort((a, b) => compareDateTimes(a.startAt, b.startAt) || a.activityId.localeCompare(b.activityId));
}

/**
 * O próximo encontro de um tipo, entre as atividades abertas (`open`) que a pessoa ainda não tem como suas, para o convite
 * do dia. Função pura.
 */
export function nextOpenMeetingOf(
  type: CgEventType,
  activities: readonly Activity[],
  now: ISODateTime,
  skipActivityIds: ReadonlySet<ID> = new Set(),
): EnrolledMeeting | null {
  let best: EnrolledMeeting | null = null;
  for (const activity of activities) {
    if (activity.status !== 'open' || eventTypeOf(activity.kind) !== type || skipActivityIds.has(activity.id)) {
      continue;
    }
    for (const meeting of activity.meetings) {
      if (meeting.done || compareDateTimes(meeting.startAt, now) < 0) {
        continue;
      }
      if (!best || compareDateTimes(meeting.startAt, best.startAt) < 0) {
        best = { activityId: activity.id, meetingId: meeting.id, title: activity.title, type, startAt: meeting.startAt };
      }
    }
  }
  return best;
}
