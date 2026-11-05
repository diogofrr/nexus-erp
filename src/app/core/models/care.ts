import { RetentionBlock } from './caregivers';
import { Audited, Cents, ID, ISODate, ISODateTime, TimeOfDay, YearMonth } from './primitives';

/** Perfil de psicólogo(a) da Nexus (o RT não tem perfil aqui: `isTechnicalLead` é sempre falso). */
export interface PsychologistProfile extends Audited {
  userId: ID;
  displayName: string;
  /** Fictício, formato `CRP-04/00102`. */
  crp: string;
  crpStatus: 'active' | 'inactive';
  isTechnicalLead: false;
  weeklyAvailableHours: number;
}

export interface RoomAccessibility {
  stepFreeAccess: boolean;
  adaptedRestroom: boolean;
  goodLighting: boolean;
  armrestSeating: boolean;
}

/** Sala do coworking. Só é reservável com os 4 atributos de acessibilidade (RN-ATD-10). */
export interface Room extends Audited {
  name: string;
  address: string;
  accessibility: RoomAccessibility;
  active: boolean;
}

export interface AvailabilitySlot extends Audited {
  psychologistId: ID;
  date: ISODate;
  /** `HH:mm`. */
  start: TimeOfDay;
  end: TimeOfDay;
  status: 'open' | 'booked' | 'blocked';
  priorityOnly: boolean;
}

export type SessionStatus =
  | 'scheduled'
  | 'confirmed'
  | 'done'
  | 'cancelled_by_user'
  | 'cancelled_by_psychologist'
  | 'no_show';
export type SessionModality = 'online' | 'in_person_coworking' | 'in_person_home';

/**
 * Sessão de atendimento psicológico. Renomeada de `Session` (escopo) para não colidir com `AuthSession`.
 */
export interface CareSession extends Audited {
  caregiverId: ID;
  psychologistId: ID;
  slotId: ID;
  startAt: ISODateTime;
  durationMin: 60;
  modality: SessionModality;
  roomId?: ID;
  homeAddress?: string;
  /** RN-ATD-19: psicoterapia ou orientação, sempre exibido ao usuário. */
  kind: 'psychotherapy' | 'guidance';
  status: SessionStatus;
  /** RN-ATD-07: confirmação de pertinência do formato remoto. */
  remoteFormatConfirmedPertinent?: boolean;
  /** RN-ATD-09: domicílio adequado e seguro. */
  homeVisitConfirmedSafe?: boolean;
  /** Risco, violência ou urgência (abre POP-05). */
  riskFlag?: boolean;
  /** Valor COBRADO (já com o desconto do plano, RN-ATD-05). */
  priceCents: Cents;
  discountPercent: number;
  cancelledAt?: ISODateTime;
  /** Remarcação (CX-026): a sessão antiga aponta para a nova e guarda quem pediu para remarcar. */
  rescheduledToId?: ID;
  rescheduleRequestedBy?: 'user' | 'psychologist';
}

export interface SessionNoteAddendum {
  at: ISODateTime;
  /** SENSITIVE. */
  content: string;
}

/** Anotação sigilosa (registro documental, Res. CFP 1/2009). Assinada, é imutável: só recebe adendo. */
export interface SessionNote extends Audited {
  sessionId: ID;
  authorPsychologistId: ID;
  /** SENSITIVE. */
  content: string;
  status: 'draft' | 'signed';
  signedAt?: ISODateTime;
  addenda: SessionNoteAddendum[];
  retentionBlock?: RetentionBlock;
}

/** Meses fechados, vindos do seed ou do fechamento. */
export interface PsychologistMonthSummary extends Audited {
  psychologistId: ID;
  month: YearMonth;
  availableHours: number;
  doneHours: number;
}

/** Visão calculada (nunca persistida). */
export interface OccupancyView {
  psychologistId: ID;
  month: YearMonth;
  availableHours: number;
  doneHours: number;
  /** `null` = n/d (sem agenda no mês). */
  occupancyPercent: number | null;
  isPartialMonth: boolean;
  /** Mais de 80% nos dois últimos meses fechados (RN-EQP-04). */
  overloadAlert: boolean;
}
