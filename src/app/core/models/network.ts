import { Audited, ID, ISODate, ISODateTime, Rating } from './primitives';

export type ProviderCategory =
  | 'physiotherapy'
  | 'professional_caregiver'
  | 'home_care'
  | 'nursing'
  | 'pharmacy'
  | 'clinic'
  | 'dentistry'
  | 'psychology'
  | 'nutrition'
  | 'legal'
  | 'specialized_service';

/**
 * `candidate` (credenciamento em andamento) e `rejected` (credenciamento reprovado) não existem no escopo,
 * mas são necessários para que P16 a P18 existam como `Provider` (seed 5.8). Só `active` e `monitoring`
 * aparecem na busca (RN-REDE-18).
 */
export type ProviderStatus =
  'candidate' | 'active' | 'monitoring' | 'suspended' | 'deaccredited' | 'rejected';

export type CouncilBody = 'CRO' | 'CREFITO' | 'COREN' | 'CRN' | 'CRP' | 'OAB' | 'NONE';

export interface ProviderCouncil {
  body: CouncilBody;
  number?: string;
  state?: string;
  status: 'active' | 'inactive' | 'not_applicable';
  validUntil?: ISODate;
  /** Registro fictício: a tela mostra o rótulo "(fictício)". */
  fictitious?: boolean;
}

export interface ProviderAvailabilityWeek {
  weekStart: ISODate;
  slots: number;
}

export interface Provider extends Audited {
  name: string;
  personType: 'person' | 'company';
  category: ProviderCategory;
  specialtyLabel: string;
  council: ProviderCouncil;
  city: string;
  homeCare: boolean;
  conditionsForNexusUsers: string;
  email: string;
  phone: string;
  status: ProviderStatus;
  accreditationId: ID;
  integrationDoneAt?: ISODate;
  popsAcknowledgedAt?: ISODate;
  parallelSolicitationBanAcceptedAt?: ISODate;
  /** RN-LGPD-13: sem a cláusula o prestador não recebe dados de usuários. */
  dataProtectionClauseSignedAt?: ISODate;
  /** Últimas semanas, da mais antiga para a mais recente. */
  availability: ProviderAvailabilityWeek[];
  /** Zona de excelência (média igual ou superior a 4,5). */
  highlight: boolean;
}

export type AccreditationStatus =
  'requested' | 'in_review' | 'pending_documents' | 'approved' | 'rejected' | 'active';

/** Os 5 critérios de credenciamento (RN-REDE-03). */
export type ChecklistKey =
  | 'council_registry'
  | 'training_proof'
  | 'accreditation_contract'
  | 'data_protection_term'
  | 'continuous_evaluation_accepted';

export type ChecklistStatus = 'pending' | 'ok' | 'not_applicable' | 'failed';

export interface ChecklistItem {
  status: ChecklistStatus;
  checkedBy?: ID;
  checkedAt?: ISODate;
  note?: string;
}

export interface Accreditation extends Audited {
  providerId: ID;
  status: AccreditationStatus;
  checklist: Record<ChecklistKey, ChecklistItem>;
  rejectionReason?: string;
  decidedAt?: ISODate;
  decidedBy?: ID;
}

export interface ProviderDocument extends Audited {
  providerId: ID;
  kind: 'council_registry' | 'training_proof' | 'contract' | 'data_protection_term' | 'identity';
  fileName: string;
  issuedAt: ISODate;
  validUntil?: ISODate;
  status: 'valid' | 'expired' | 'pending';
}

export type ServiceRequestStatus =
  | 'requested'
  | 'accepted'
  | 'refused_by_provider'
  | 'cancelled_by_provider'
  | 'cancelled_by_user'
  | 'completed'
  | 'evaluated';

export interface ServiceRequest extends Audited {
  caregiverId: ID;
  providerId: ID;
  specialty: ProviderCategory;
  need: string;
  modality: 'home' | 'at_provider';
  status: ServiceRequestStatus;
  requestedAt: ISODateTime;
  respondedAt?: ISODateTime;
  completedAt?: ISODateTime;
  reason?: string;
  evaluationId?: ID;
}

export type GraveCategory = 'unjustified_absence' | 'confidentiality_breach' | 'other';

export interface ProviderEvaluation extends Audited {
  serviceRequestId: ID;
  providerId: ID;
  caregiverId: ID;
  /** (a) qualidade técnica, inteiro de 1 a 5. */
  technicalQuality: Rating;
  /** (b) pontualidade e cordialidade, inteiro de 1 a 5. */
  punctualityCourtesy: Rating;
  comment?: string;
  /** Média das duas notas (RN-ARP-03). */
  score: number;
  grave?: { category: GraveCategory; classifiedBy: ID; classifiedAt: ISODate };
  /** O cuidador pode corrigir em até 7 dias (RN-ARP-16). */
  editableUntil: ISODate;
}

export type ArpBand = 'excellence' | 'alert' | 'deaccreditation' | 'no_average';

/** Instantâneo da auditoria quinzenal (RN-ARP-05): gravado e nunca recalculado. */
export interface ArpSnapshot extends Audited {
  providerId: ID;
  auditDate: ISODate;
  average: number | null;
  evaluationCount: number;
  band: ArpBand;
  graveComplaintCount: number;
  auditedBy: ID;
}

export interface InternalReview extends Audited {
  providerId: ID;
  openedAt: ISODate;
  trigger: 'average_below_4' | 'grave_complaints' | 'manual';
  justification?: string;
  justificationAt?: ISODateTime;
  decision?: 'confirm_deaccreditation' | 'reinstate' | 'keep_monitoring';
  decidedBy?: ID;
  decidedAt?: ISODate;
  decisionNote?: string;
  closureEmail?: { to: string; subject: string; body: string; sentAt: ISODateTime };
}

export interface ProviderStatusEvent extends Audited {
  providerId: ID;
  from: ProviderStatus | null;
  to: ProviderStatus;
  reason: string;
  byUserId: ID;
}
