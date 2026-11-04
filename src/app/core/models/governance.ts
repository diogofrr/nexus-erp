import { RetentionBlock } from './caregivers';
import { Audited, ID, ISODate, ISODateTime } from './primitives';

export type PopResponsible = 'management' | 'technical_lead' | 'management_and_technical_lead';
export type PopReviewState = 'up_to_date' | 'due' | 'revision_triggered';

/** POP com os 7 campos fixos (RN-POP-11). */
export interface Pop extends Audited {
  code: `POP-${string}`;
  title: string;
  responsibleRole: PopResponsible;
  objective: string;
  responsible: string;
  materials: string;
  steps: string[];
  requiredRecord: string;
  indicators: string;
  lastReviewedAt: ISODate;
  reviewState: PopReviewState;
}

export interface PopReview extends Audited {
  popCode: string;
  reviewedAt: ISODate;
  reviewedByUserId: ID;
  note: string;
}

export interface PopAcknowledgement extends Audited {
  popCode: string;
  personType: 'provider' | 'user';
  personId: ID;
  at: ISODate;
}

export type RiskScale = 1 | 2 | 3 | 4 | 5;

export interface RiskItem extends Audited {
  code: `R${number}`;
  title: string;
  category: string;
  probability: RiskScale;
  impact: RiskScale;
  /** Criticidade C = P x I é DERIVADA (ver `riskCriticality`). */
  treatment: string;
  controls: string[];
}

/** As 7 categorias do Quadro 12. */
export type ReferralCategory =
  | 'psychiatric_follow_up'
  | 'severe_distress_or_suicide_risk'
  | 'social_vulnerability'
  | 'rights_violation_or_neglect'
  | 'social_security_or_guardianship'
  | 'elder_clinical_worsening'
  | 'caregiver_cannot_afford_care';

export interface Referral extends Audited {
  caregiverId: ID;
  elderId?: ID;
  category: ReferralCategory;
  destinations: string[];
  at: ISODate;
  byUserId: ID;
  status: 'registered' | 'acknowledged' | 'closed';
  outcome?: string;
  /** Obrigatório no agravamento clínico (RN-ENC-07). */
  familyCommunicated?: boolean;
  occurrenceId?: ID;
}

export interface OccurrenceStep {
  n: number;
  label: string;
  doneAt?: ISODateTime;
  byUserId?: ID;
  note?: string;
}

export interface AuthorityNotification {
  body: string;
  at?: ISODate;
  protocol?: string;
}

export interface Occurrence extends Audited {
  kind: 'pop05_risk' | 'pop07_violence_suspicion';
  caregiverId: ID;
  elderId?: ID;
  openedAt: ISODateTime;
  status: 'open' | 'in_progress' | 'closed';
  /** RT e psicólogo do caso (RN-ENC-11). */
  restrictedToUserIds: ID[];
  steps: OccurrenceStep[];
  authoritiesNotified: AuthorityNotification[];
  sourceAlertId?: ID;
  sourceComplaintId?: ID;
  retentionBlock?: RetentionBlock;
}

export interface TrainingAttendee {
  personType: 'provider' | 'user';
  personId: ID;
  present: boolean;
}

export interface TrainingEvent extends Audited {
  front: 'provider_integration' | 'group_professionals' | 'management' | 'continuing';
  title: string;
  date: ISODate;
  attendees: TrainingAttendee[];
}

export interface GuidanceContent extends Audited {
  title: string;
  body: string;
  status: 'draft' | 'in_review' | 'published';
  /** Só o RT aprova (RN-POP-09). */
  approvedByUserId?: ID;
  approvedAt?: ISODate;
  /** Exclusivo de plano pago. */
  exclusive: boolean;
}

export interface NormReference extends Audited {
  name: string;
  subject: string;
  /** Vazio no seed (RN-ETICA-17). */
  confirmedInForceAt?: ISODate;
}

/** Notificação do sino (M02): gerada por regra, sem envio. */
export interface Notification extends Audited {
  /** Perfil de destino. */
  role: string;
  userId?: ID;
  kind: string;
  title: string;
  status: 'unread' | 'seen' | 'resolved';
  /** Rota de destino (sem dado sensível na URL). */
  link?: string;
  at: ISODateTime;
}
