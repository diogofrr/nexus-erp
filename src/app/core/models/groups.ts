import { Audited, Cents, ID, ISODateTime } from './primitives';

/**
 * Os três tipos de encontro (docs/20-regras-planos-v2.md, "Tipos de atividade"): roda de conversa aberta (todos, inclusive
 * sem plano), capacitação (todos os cadastrados; incluída conforme o plano, senão avulsa) e terapia de grupo (só Cuida e
 * Sustenta). O antigo `support_group` virou `group_therapy` e `open_conversation_circle` virou `open_circle` (migração v2).
 */
export type ActivityKind = 'open_circle' | 'training' | 'group_therapy';
export type ActivityStatus = 'draft' | 'open' | 'full' | 'in_progress' | 'finished' | 'cancelled';

/** Temas dos grupos (RN-GRP-05). */
export type GroupTheme =
  | 'caregiver_burden'
  | 'communication_with_elder'
  | 'routine_organization'
  | 'handling_difficult_situations'
  | 'self_care'
  | 'emotional_health'
  | 'family_conflict_prevention'
  | 'basic_care_guidance';

/** Temas das capacitações (RN-GRP-06). */
export type TrainingTheme =
  | 'first_aid'
  | 'bed_bath_hygiene'
  | 'fall_prevention'
  | 'safe_medication'
  | 'feeding_choking_prevention'
  | 'dementia_communication';

export interface ActivityLeader {
  type: 'psychologist' | 'provider' | 'guest';
  id?: ID;
  name: string;
  /** Obrigatório na divulgação de serviço de Psicologia (RN-GRP-15). */
  professionalRegistration?: string;
}

export interface ActivityMeeting {
  id: ID;
  startAt: ISODateTime;
  endAt: ISODateTime;
  done: boolean;
}

export interface Activity extends Audited {
  kind: ActivityKind;
  title: string;
  theme: GroupTheme | TrainingTheme;
  /** RN-GRP-16: orientação e psicoeducação, ou psicoterapia. */
  character: 'guidance' | 'psychotherapy';
  leaders: ActivityLeader[];
  mode: 'online' | 'in_person';
  roomId?: ID;
  /** CRAS, UBS, associação de bairro... */
  partnerOrg?: string;
  meetings: ActivityMeeting[];
  /** Padrão 12 (editável). */
  capacity: number;
  status: ActivityStatus;
  /** `cuida` na terapia de grupo (Cuida e Sustenta); `null` = aberta a todos (roda aberta e capacitação). */
  minPlan: 'cuida' | null;
  /** Compatibilidade: a terapia de grupo não exige mais indicação do psicólogo (docs/20). Sempre `false` nos dados novos. */
  requiresEligibility: boolean;
  confidentialityText: string;
}

export interface ActivityAttendance {
  meetingId: ID;
  present: boolean;
}

export interface ActivityEnrollment extends Audited {
  activityId: ID;
  caregiverId?: ID;
  /** Participante externo (roda aberta): nome e e-mail mínimos. */
  external?: { name: string; email: string };
  status: 'enrolled' | 'waitlist' | 'attended' | 'absent' | 'cancelled';
  waitlistPosition?: number;
  /** Aceite do contrato de sigilo, com data e hora (RN-GRP-09). */
  confidentialityAcceptedAt?: ISODateTime;
  /** Compatibilidade (RN-GRP-14 antiga): marcação do psicólogo do caso; não é mais exigida. */
  eligibleForGroupTherapy?: boolean;
  /** A inscrição consome a cota mensal do plano (terapia de grupo e capacitação incluída). Roda aberta nunca. */
  includedInPlan?: boolean;
  /** Avulsa: paga por encontro (pagamento simulado). */
  paid?: boolean;
  /** Valor da inscrição avulsa (0 quando incluída ou roda aberta). */
  priceCents?: Cents;
  attendance: ActivityAttendance[];
}
