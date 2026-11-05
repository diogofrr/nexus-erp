import type {
  AccessLogEntry,
  Accreditation,
  Activity,
  ActivityEnrollment,
  AppUsageSummary,
  AppUser,
  AppSettings,
  ArbeAlert,
  ArpSnapshot,
  AvailabilitySlot,
  BenefitCard,
  CardUsage,
  CareAppointment,
  CareSession,
  Caregiver,
  Complaint,
  Consent,
  ConsentEvent,
  ConsentTerm,
  CorporateAccount,
  CorporateSeat,
  DataSubjectRequest,
  DoseCheck,
  Elder,
  FinancialParams,
  GuidanceContent,
  Incident,
  InternalReview,
  Medication,
  Message,
  MessageTemplate,
  Notification,
  NormReference,
  Occurrence,
  Partner,
  PilotConfig,
  PilotEnrollment,
  Plan,
  PlanChange,
  Pop,
  PopAcknowledgement,
  PopReview,
  PrivacyDocument,
  Provider,
  ProviderDocument,
  ProviderEvaluation,
  ProviderStatusEvent,
  PsychologistMonthSummary,
  PsychologistProfile,
  Referral,
  RetentionPolicy,
  ReviewRequest,
  RiskItem,
  Room,
  ServiceRequest,
  SessionNote,
  Subscription,
  TrainingEvent,
  WellbeingCheck,
  ZaritAlert,
  ZaritAssessment,
} from '../models';

/** Tipo de entidade de cada coleção (nome da coleção, `nexus-erp:<nome>`). */
export interface CollectionTypes {
  users: AppUser;
  accessLog: AccessLogEntry;
  plans: Plan;
  subscriptions: Subscription;
  planChanges: PlanChange;
  benefitCards: BenefitCard;
  cardUsages: CardUsage;
  caregivers: Caregiver;
  elders: Elder;
  medications: Medication;
  doseChecks: DoseCheck;
  careAppointments: CareAppointment;
  wellbeingChecks: WellbeingCheck;
  appUsage: AppUsageSummary;
  psychologists: PsychologistProfile;
  rooms: Room;
  availabilitySlots: AvailabilitySlot;
  careSessions: CareSession;
  sessionNotes: SessionNote;
  monthSummaries: PsychologistMonthSummary;
  zaritAssessments: ZaritAssessment;
  zaritAlerts: ZaritAlert;
  arbeAlerts: ArbeAlert;
  reviewRequests: ReviewRequest;
  activities: Activity;
  activityEnrollments: ActivityEnrollment;
  providers: Provider;
  accreditations: Accreditation;
  providerDocuments: ProviderDocument;
  serviceRequests: ServiceRequest;
  providerEvaluations: ProviderEvaluation;
  arpSnapshots: ArpSnapshot;
  internalReviews: InternalReview;
  providerStatusEvents: ProviderStatusEvent;
  partners: Partner;
  corporateAccounts: CorporateAccount;
  corporateSeats: CorporateSeat;
  messages: Message;
  complaints: Complaint;
  messageTemplates: MessageTemplate;
  consentTerms: ConsentTerm;
  consents: Consent;
  consentEvents: ConsentEvent;
  dataSubjectRequests: DataSubjectRequest;
  incidents: Incident;
  retentionPolicies: RetentionPolicy;
  privacyDocuments: PrivacyDocument;
  pops: Pop;
  popReviews: PopReview;
  popAcknowledgements: PopAcknowledgement;
  risks: RiskItem;
  referrals: Referral;
  occurrences: Occurrence;
  trainingEvents: TrainingEvent;
  guidanceContents: GuidanceContent;
  norms: NormReference;
  pilotEnrollments: PilotEnrollment;
  notifications: Notification;
}

export type CollectionName = keyof CollectionTypes;

/** Conteúdo completo de todas as coleções (usado pelo seed e pela exportação). */
export type CollectionData = { [K in CollectionName]: CollectionTypes[K][] };

/** Coleções que só aceitam `append` (log de auditoria e eventos de consentimento). */
export const APPEND_ONLY_COLLECTIONS = [
  'accessLog',
  'consentEvents',
] as const satisfies readonly CollectionName[];

/** Prefixo dos IDs gerados por coleção. */
export const ID_PREFIXES: Record<CollectionName, string> = {
  users: 'usr',
  accessLog: 'log',
  plans: 'plan',
  subscriptions: 'sub',
  planChanges: 'pch',
  benefitCards: 'crd',
  cardUsages: 'cus',
  caregivers: 'cg',
  elders: 'el',
  medications: 'med',
  doseChecks: 'dose',
  careAppointments: 'apt',
  wellbeingChecks: 'wbc',
  appUsage: 'use',
  psychologists: 'psy',
  rooms: 'room',
  availabilitySlots: 'slot',
  careSessions: 'ses',
  sessionNotes: 'note',
  monthSummaries: 'pms',
  zaritAssessments: 'zar',
  zaritAlerts: 'zal',
  arbeAlerts: 'arb',
  reviewRequests: 'rvw',
  activities: 'act',
  activityEnrollments: 'enr',
  providers: 'prv',
  accreditations: 'acr',
  providerDocuments: 'pdoc',
  serviceRequests: 'srq',
  providerEvaluations: 'evl',
  arpSnapshots: 'arp',
  internalReviews: 'irv',
  providerStatusEvents: 'pse',
  partners: 'par',
  corporateAccounts: 'corp',
  corporateSeats: 'seat',
  messages: 'msg',
  complaints: 'rec',
  messageTemplates: 'tpl',
  consentTerms: 'cterm',
  consents: 'cns',
  consentEvents: 'cev',
  dataSubjectRequests: 'dsr',
  incidents: 'inc',
  retentionPolicies: 'ret',
  privacyDocuments: 'pdc',
  pops: 'pop',
  popReviews: 'prev',
  popAcknowledgements: 'pack',
  risks: 'risk',
  referrals: 'ref',
  occurrences: 'occ',
  trainingEvents: 'trn',
  guidanceContents: 'gdc',
  norms: 'norm',
  pilotEnrollments: 'pil',
  notifications: 'ntf',
};

export const COLLECTION_NAMES = Object.keys(ID_PREFIXES) as CollectionName[];

/**
 * Coleções criadas depois da primeira versão do arquivo de exportação. Um arquivo antigo, sem elas, continua
 * valendo na importação e as deixa vazias (não foi preciso subir `SCHEMA_VERSION`: nenhum formato mudou).
 */
export const OPTIONAL_ON_IMPORT: readonly CollectionName[] = ['doseChecks'];

/** Documentos únicos (não são listas). */
export interface SingletonTypes {
  settings: AppSettings;
  financialParams: FinancialParams;
  pilotConfig: PilotConfig;
}

export type SingletonName = keyof SingletonTypes;
