import { Audited, Channel, ID, ISODate, ISODateTime } from './primitives';

/** Os seis consentimentos independentes (RN-LGPD-05). */
export type ConsentKey =
  | 'health_data'
  | 'people_analytics'
  | 'family_sharing'
  | 'image_testimony'
  | 'whatsapp_contact'
  | 'pilot_tcle';

export type ConsentStatus = 'pending' | 'granted' | 'refused' | 'revoked';

export interface ConsentTerm extends Audited {
  key: ConsentKey;
  version: string;
  title: string;
  text: string;
  publishedAt: ISODate;
  active: boolean;
}

/** Estado atual de um consentimento de um titular. O histórico fica em `ConsentEvent`. */
export interface Consent extends Audited {
  caregiverId: ID;
  key: ConsentKey;
  status: ConsentStatus;
  currentTermVersion: string;
}

/** Evento de consentimento. APPEND-ONLY: nunca se edita nem se apaga (LP-04). */
export interface ConsentEvent extends Audited {
  caregiverId: ID;
  key: ConsentKey;
  status: 'granted' | 'refused' | 'revoked';
  termVersion: string;
  at: ISODateTime;
  channel: Channel | 'in_person';
  registeredByUserId: ID;
  evidence?: string;
}

export type DsrType =
  | 'access'
  | 'correction'
  | 'anonymization_or_blocking'
  | 'portability'
  | 'erasure'
  | 'consent_revocation'
  | 'sharing_info'
  | 'decision_review';

export type DsrStatus = 'open' | 'in_progress' | 'completed' | 'rejected_with_reason';

export interface DataSubjectRequest extends Audited {
  /** `DSR-0001`. */
  protocol: string;
  caregiverId: ID;
  type: DsrType;
  status: DsrStatus;
  openedAt: ISODate;
  /** Abertura mais 15 dias corridos (RN-LGPD-21). */
  dueAt: ISODate;
  completedAt?: ISODate;
  handledByUserId?: ID;
  resolutionNote?: string;
  rejectedReason?: string;
  /** Eliminação parcial: o que ficou retido por registro documental e por quê. */
  retentionBlockNote?: string;
}

export interface IncidentCommunication {
  to: 'ANPD' | 'subjects';
  at: ISODateTime;
  text: string;
}

export interface Incident extends Audited {
  occurredAt: ISODateTime;
  description: string;
  dataAffected: string[];
  affectedSubjects: number;
  measures: string;
  status: 'open' | 'contained' | 'communicated' | 'closed';
  communications: IncidentCommunication[];
}

/** Política de retenção (seção 6.7). Ganhou `id` para ser um registro persistido e editável. */
export interface RetentionPolicy extends Audited {
  dataClass: string;
  retentionYears: number | null;
  /** Prazo em dias quando não é em anos (cadastro, 30 dias). */
  retentionDays?: number;
  basis: string;
  note?: string;
}

export interface PrivacyDocument extends Audited {
  kind: 'privacy_policy' | 'ripd' | 'service_contract';
  version: string;
  body: string;
  dpoName: string;
  dpoEmail: string;
}
