import { Audited, Channel, ID, ISODate, ISODateTime, TimeOfDay } from './primitives';

export type Sex = 'female' | 'male' | 'other' | 'undisclosed';
export type Relationship =
  'daughter' | 'son' | 'spouse' | 'daughter_in_law' | 'grandchild' | 'other';
export type CaregiverStatus =
  'active' | 'paused_by_consent_revocation' | 'closure_requested' | 'closed';
export type Dependency = 'independent' | 'partial' | 'total';

/** Registro bloqueado por retenção documental (RN-LGPD-24): sem uso nem acesso comum até `until`. */
export interface RetentionBlock {
  until: ISODate;
  basis: string;
  blockedAt: ISODateTime;
}

/** Cuidador familiar (o cliente). Dados pessoais: o `partner` só vê `code` (pseudonimização). */
export interface Caregiver extends Audited {
  /** `CUI-0001`, usado para pseudonimização (LP-08). */
  code: string;
  fullName: string;
  /** Formato `000.000.000-00`, sempre com dígitos verificadores INVÁLIDOS (AC-GL-12). */
  cpf: string;
  cpfIsFictitious: true;
  email: string;
  phone: string;
  whatsapp?: string;
  birthDate: ISODate;
  sex: Sex;
  relationship: Relationship;
  city: string;
  /** Horas por dia de cuidado direto, inteiro de 0 a 24 (RN-USR-04). */
  dailyCareHours: number;
  /** Piloto, Quadro 10. */
  weeklyOrganizationHours?: number;
  sociodemographics?: { education?: string; incomeBand?: string; employment?: string };
  preferredChannel: Channel;
  digitalLiteracy: 'low' | 'medium' | 'high';
  status: CaregiverStatus;
  /** "Adesão": ingresso no serviço. */
  enrolledAt: ISODate;
  assignedPsychologistId?: ID;
  corporateAccountId?: ID;
  isPilot: boolean;
  closureRequestedAt?: ISODate;
  closedAt?: ISODate;
  /** Preenchido quando os identificadores foram eliminados ou anonimizados (M12). */
  anonymizedAt?: ISODateTime;
  erasedAt?: ISODateTime;
}

export interface Elder extends Audited {
  /** Um cuidador principal por pessoa idosa (RN-USR-10). */
  caregiverId: ID;
  fullName: string;
  birthDate: ISODate;
  dependency: Dependency;
  /** SENSITIVE, minimizado. */
  conditionsSummary?: string;
}

export interface Medication extends Audited {
  elderId: ID;
  name: string;
  dosage: string;
  /** `HH:mm`. */
  times: string[];
  active: boolean;
}

/**
 * Tomada de remédio marcada pelo cuidador ("dei", RN-USR-07: registro de remédios). Só existe o registro de
 * quem foi dado: desmarcar apaga a linha. Uma marcação por medicamento, dia e horário previsto.
 */
export interface DoseCheck extends Audited {
  medicationId: ID;
  date: ISODate;
  /** Horário previsto (`HH:mm`), um dos `times` do medicamento. */
  time: TimeOfDay;
  /** Quando o cuidador marcou. */
  givenAt: ISODateTime;
}

export interface CareAppointment extends Audited {
  elderId: ID;
  title: string;
  at: ISODateTime;
  kind: 'medical' | 'physio' | 'psychological' | 'other';
  providerId?: ID;
  reminder: boolean;
}

/** SENSITIVE. */
export interface WellbeingCheck extends Audited {
  caregiverId: ID;
  date: ISODate;
  mood: 1 | 2 | 3 | 4 | 5;
}

/** Resumo de uso do aplicativo (K31). Dados simulados no seed, sem telemetria real (E-15). */
export interface AppUsageSummary extends Audited {
  caregiverId: ID;
  /** Acessos nos últimos 30 dias. */
  accesses30d: number;
  distinctFeatures: string[];
  lastAccessAt?: ISODateTime;
}
