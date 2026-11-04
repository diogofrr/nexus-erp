import type { CollectionData, SingletonTypes } from '../data/collections';
import { ConsentKey, ConsentStatus, ID, ISODate, PsychologistProfile } from '../models';
import { SeedContext } from './context';
import type { ZaritPoint } from './scenarios';

/** Estado compartilhado entre os construtores do seed (coleções em construção e consultas cruzadas). */
export interface SeedState {
  ctx: SeedContext;
  c: CollectionData;
  singletons: SingletonTypes;
  /** Aplicações concluídas de cada cuidador, da adesão para a mais recente. */
  zaritPoints: Map<ID, ZaritPoint[]>;
  /** Vencimento da próxima aplicação (`null` = não agendar), só quando difere do padrão. */
  nextDueOverride: Map<ID, ISODate | null>;
  /** Data da adesão de cada cuidador. */
  enrollmentDate: Map<ID, ISODate>;
  /** Estado planejado dos seis consentimentos de cada cuidador. */
  consentPlan: Map<ID, Record<ConsentKey, ConsentStatus>>;
  /** Id do evento de consentimento concedido, por cuidador e chave (`${id}:${key}`). */
  consentEventIds: Map<string, ID>;
  /** Cuidador de volume que participa do piloto. */
  volumePilotIds: ID[];
  psychologistById: Map<ID, PsychologistProfile>;
}

export function emptyCollections(): CollectionData {
  return {
    users: [],
    accessLog: [],
    plans: [],
    subscriptions: [],
    planChanges: [],
    benefitCards: [],
    cardUsages: [],
    caregivers: [],
    elders: [],
    medications: [],
    careAppointments: [],
    wellbeingChecks: [],
    appUsage: [],
    psychologists: [],
    rooms: [],
    availabilitySlots: [],
    careSessions: [],
    sessionNotes: [],
    monthSummaries: [],
    zaritAssessments: [],
    zaritAlerts: [],
    arbeAlerts: [],
    reviewRequests: [],
    activities: [],
    activityEnrollments: [],
    providers: [],
    accreditations: [],
    providerDocuments: [],
    serviceRequests: [],
    providerEvaluations: [],
    arpSnapshots: [],
    internalReviews: [],
    providerStatusEvents: [],
    partners: [],
    corporateAccounts: [],
    corporateSeats: [],
    messages: [],
    complaints: [],
    messageTemplates: [],
    consentTerms: [],
    consents: [],
    consentEvents: [],
    dataSubjectRequests: [],
    incidents: [],
    retentionPolicies: [],
    privacyDocuments: [],
    pops: [],
    popReviews: [],
    popAcknowledgements: [],
    risks: [],
    referrals: [],
    occurrences: [],
    trainingEvents: [],
    guidanceContents: [],
    norms: [],
    pilotEnrollments: [],
    notifications: [],
  };
}
