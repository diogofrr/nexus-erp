/**
 * Números da rede credenciada calculados a partir dos registros (funções puras, sem Angular e sem relógio).
 * Reúnem as regras de ARP (RN-ARP-03 a 10), taxa de recusa (RN-REDE-27, 28), queda de disponibilidade
 * (RN-REDE-29) e documentos vencidos (RN-REDE-22) num resumo por prestador, para a rede (M08) e para as
 * reclamações (M11) falarem dos mesmos números.
 */
import { compareDates, dateOf, daysBetween } from '../clock/date-utils';
import { Complaint } from '../models/messages';
import {
  ArpBand,
  ArpSnapshot,
  InternalReview,
  Provider,
  ProviderDocument,
  ProviderEvaluation,
  ServiceRequest,
} from '../models/network';
import { ISODate, ISODateTime } from '../models/primitives';
import {
  AvailabilitySignal,
  RefusalStats,
  availabilityDropSignal,
  isDocumentExpired,
  refusalStats,
  summarizeProvider,
} from '../rules/arp';

/** Data em que a reclamação virou "grave": o último evento que cita a classificação, senão a abertura. */
export function complaintGraveDate(
  complaint: Pick<Complaint, 'severity' | 'openedAt' | 'events'>,
): ISODate | undefined {
  if (complaint.severity !== 'grave') {
    return undefined;
  }
  const classified = [...complaint.events].reverse().find((e) => /grave/i.test(e.text));
  return dateOf(classified ? classified.at : complaint.openedAt);
}

/**
 * Reclamações graves de um prestador até `until` (inclusive): as marcadas na avaliação (campo aberto) mais as
 * reclamações formais classificadas como graves (RN-ARP-09). Sem `until`, todas.
 */
export function graveCountOf(
  providerId: string,
  evaluations: readonly Pick<ProviderEvaluation, 'providerId' | 'grave'>[],
  complaints: readonly Pick<Complaint, 'severity' | 'openedAt' | 'events' | 'target'>[],
  until?: ISODate,
): number {
  const fromEvaluations = evaluations.filter(
    (e) =>
      e.providerId === providerId &&
      e.grave !== undefined &&
      (until === undefined || compareDates(e.grave.classifiedAt, until) <= 0),
  ).length;
  const fromComplaints = complaints.filter((c) => {
    if (c.target.providerId !== providerId) {
      return false;
    }
    const date = complaintGraveDate(c);
    return date !== undefined && (until === undefined || compareDates(date, until) <= 0);
  }).length;
  return fromEvaluations + fromComplaints;
}

/** Resumo calculado de um prestador na data de hoje. */
export interface ProviderSummary {
  provider: Provider;
  evaluationCount: number;
  /** Soma das notas individuais (2 por avaliação). */
  scoreSum: number;
  /** `null` com menos de 5 avaliações (RN-ARP-04). */
  average: number | null;
  graveCount: number;
  /** Faixa calculada AGORA; a oficial é a do último instantâneo (RN-ARP-05). */
  band: ArpBand;
  trigger: 'average_below_4' | 'grave_complaints' | null;
  refusal: RefusalStats;
  availability: AvailabilitySignal;
  lastSnapshot: ArpSnapshot | undefined;
  /** Avaliação interna ainda sem decisão. */
  openReview: InternalReview | undefined;
  expiredDocuments: ProviderDocument[];
  /** A taxa de recusa, a queda de disponibilidade, a faixa ou a situação pedem a atenção da gestão. */
  needsAttention: boolean;
}

export interface SummaryInput {
  provider: Provider;
  evaluations: readonly ProviderEvaluation[];
  complaints: readonly Complaint[];
  requests: readonly ServiceRequest[];
  snapshots: readonly ArpSnapshot[];
  reviews: readonly InternalReview[];
  documents: readonly ProviderDocument[];
  today: ISODate;
  now: ISODateTime;
  refusalThresholdPercent: number;
  refusalMinRequests: number;
}

export function buildProviderSummary(input: SummaryInput): ProviderSummary {
  const { provider } = input;
  const own = input.evaluations.filter((e) => e.providerId === provider.id);
  const scoreSum = own.reduce((s, e) => s + e.technicalQuality + e.punctualityCourtesy, 0);
  const graveCount = graveCountOf(provider.id, own, input.complaints);
  const arp = summarizeProvider(own, graveCount);
  const refusal = refusalStats(input.requests, provider.id, input.now, {
    thresholdPercent: input.refusalThresholdPercent,
    minRequests: input.refusalMinRequests,
  });
  const availability = availabilityDropSignal(provider.availability);
  const lastSnapshot = input.snapshots
    .filter((s) => s.providerId === provider.id)
    .sort((a, b) => compareDates(b.auditDate, a.auditDate) || b.id.localeCompare(a.id))[0];
  const openReview = input.reviews.find(
    (r) => r.providerId === provider.id && r.decision === undefined,
  );
  const expiredDocuments = input.documents.filter(
    (d) => d.providerId === provider.id && isDocumentExpired(d, input.today),
  );
  const inOperation = provider.status === 'active' || provider.status === 'monitoring';
  return {
    provider,
    evaluationCount: own.length,
    scoreSum,
    average: arp.average,
    graveCount,
    band: arp.band,
    trigger: arp.trigger,
    refusal,
    availability,
    lastSnapshot,
    openReview,
    expiredDocuments,
    needsAttention:
      provider.status === 'suspended' ||
      provider.status === 'monitoring' ||
      (inOperation && (refusal.exitRisk || availability.signal || expiredDocuments.length > 0)),
  };
}

export type DocumentState = 'valid' | 'expiring' | 'expired' | 'in_review';

export interface DocumentView {
  state: DocumentState;
  /** Dias até vencer (negativo = vencido há N dias); `null` sem validade. */
  daysLeft: number | null;
}

/** Janela do "vence em breve" dos documentos (dias). */
export const DOCUMENT_EXPIRING_DAYS = 30;

/** Situação de um documento: válido, vencendo (30 dias), vencido ou enviado e em conferência (U-10). */
export function documentView(
  document: Pick<ProviderDocument, 'status' | 'validUntil'>,
  today: ISODate,
): DocumentView {
  const daysLeft =
    document.validUntil === undefined ? null : daysBetween(today, document.validUntil);
  if (document.status === 'pending') {
    return { state: 'in_review', daysLeft };
  }
  if (daysLeft !== null && daysLeft < 0) {
    return { state: 'expired', daysLeft };
  }
  if (daysLeft !== null && daysLeft <= DOCUMENT_EXPIRING_DAYS) {
    return { state: 'expiring', daysLeft };
  }
  return { state: 'valid', daysLeft };
}
