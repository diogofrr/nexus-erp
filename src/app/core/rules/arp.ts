/**
 * ARP: Avaliação da Rede Profissional (RN-ARP-01 a 19, RN-REDE-10 a 29, A.15) e credenciamento.
 *
 * Nota da avaliação = média das duas notas (1 a 5). Nota do prestador = média de todas as notas
 * individuais, só com 5 ou mais avaliações, arredondada a 2 casas (meio para cima) ANTES de classificar.
 */
import {
  addDays,
  compareDates,
  dateOf,
  daysBetween,
  fromEpochMs,
  epochMs,
} from '../clock/date-utils';
import { ISODate, ISODateTime } from '../models/primitives';
import {
  Accreditation,
  ArpBand,
  ChecklistKey,
  Provider,
  ProviderAvailabilityWeek,
  ProviderDocument,
  ProviderEvaluation,
  ProviderStatus,
  ServiceRequest,
  ServiceRequestStatus,
} from '../models/network';
import { roundHalfUp } from './numbers';

export const ARP_MIN_EVALUATIONS = 5;
/** Faixa de excelência: média igual ou superior a 4,5 (RN-ARP-06). Regra do documento, não editável. */
export const ARP_EXCELLENCE_MIN = 4.5;
/** Faixa de alerta: 4,0 a menos de 4,5 (RN-ARP-07). */
export const ARP_ALERT_MIN = 4.0;
/** Descredenciamento por reclamações graves: MAIS de duas, ou seja, 3 ou mais (RN-ARP-08). */
export const ARP_GRAVE_LIMIT = 3;
/** Auditoria quinzenal (RN-ARP-05). */
export const ARP_AUDIT_INTERVAL_DAYS = 15;
/** Taxa de recusa: janela de 30 dias (RN-REDE-27). */
export const REFUSAL_WINDOW_DAYS = 30;
/** Limiar padrão de "risco de saída": 30% com no mínimo 5 solicitações (RN-REDE-28, editável). */
export const DEFAULT_REFUSAL_THRESHOLD_PERCENT = 30;
export const DEFAULT_REFUSAL_MIN_REQUESTS = 5;
/** Queda de disponibilidade superior a 50% sobre a média das 4 semanas anteriores (RN-REDE-29). */
export const AVAILABILITY_DROP_LIMIT_PERCENT = 50;
/** Documento vencido em prestador ativo: 30 dias para regularizar (RN-REDE-22). */
export const DOCUMENT_GRACE_DAYS = 30;
/** O cuidador pode corrigir a própria avaliação em até 7 dias (RN-ARP-16). */
export const EVALUATION_EDIT_DAYS = 7;

export const ARP_BAND_LABELS: Readonly<Record<ArpBand, string>> = {
  excellence: 'Excelência',
  alert: 'Alerta (monitoramento)',
  deaccreditation: 'Descredenciamento',
  no_average: 'Sem média',
};

/** Nome da faixa em linguagem neutra para o portal do prestador (RN-ARP-18; só "em destaque" ou "em acompanhamento"). */
export function neutralBandLabel(band: ArpBand): string {
  return band === 'excellence' ? 'Em destaque' : 'Em acompanhamento';
}

// ===== Notas =====

/** Nota de uma avaliação: média das duas notas (5 e 4 resultam 4,5). */
export function evaluationScore(technicalQuality: number, punctualityCourtesy: number): number {
  return (technicalQuality + punctualityCourtesy) / 2;
}

/**
 * Média do prestador a partir da SOMA das notas individuais (2 por avaliação) e do número de avaliações.
 * Arredondamento em aritmética inteira (meio para cima em 2 casas): 4,495 vira 4,50 (RN-ARP-15).
 * `null` com menos de 5 avaliações (RN-ARP-04).
 */
export function providerAverageFromSum(scoreSum: number, evaluationCount: number): number | null {
  if (evaluationCount < ARP_MIN_EVALUATIONS) {
    return null;
  }
  const hundredths = Math.floor((100 * scoreSum + evaluationCount) / (2 * evaluationCount));
  return hundredths / 100;
}

/** Média do prestador a partir da lista de avaliações. */
export function providerAverage(
  evaluations: readonly Pick<ProviderEvaluation, 'technicalQuality' | 'punctualityCourtesy'>[],
): number | null {
  const sumOfScores = evaluations.reduce(
    (s, e) => s + e.technicalQuality + e.punctualityCourtesy,
    0,
  );
  return providerAverageFromSum(sumOfScores, evaluations.length);
}

/**
 * Faixa ARP (A.15). Mais de duas reclamações graves (3 ou mais) descredenciam MESMO sem média
 * (a regra "ou" vale independentemente da média, RN-ARP-08).
 */
export function arpBand(average: number | null, graveComplaintCount: number): ArpBand {
  if (graveComplaintCount >= ARP_GRAVE_LIMIT) {
    return 'deaccreditation';
  }
  if (average === null) {
    return 'no_average';
  }
  if (average >= ARP_EXCELLENCE_MIN) {
    return 'excellence';
  }
  if (average >= ARP_ALERT_MIN) {
    return 'alert';
  }
  return 'deaccreditation';
}

/** Entrar em descredenciamento suspende na hora (sai da busca) e abre avaliação interna (RN-ARP-10). */
export function shouldSuspendNow(band: ArpBand): boolean {
  return band === 'deaccreditation';
}

export interface ArpSummary {
  average: number | null;
  evaluationCount: number;
  graveComplaintCount: number;
  band: ArpBand;
  /** Gatilho da avaliação interna, quando aplicável. */
  trigger: 'average_below_4' | 'grave_complaints' | null;
}

/** Resumo calculado de um prestador (a base do instantâneo da auditoria, RN-ARP-05). */
export function summarizeProvider(
  evaluations: readonly Pick<ProviderEvaluation, 'technicalQuality' | 'punctualityCourtesy'>[],
  graveComplaintCount: number,
): ArpSummary {
  const average = providerAverage(evaluations);
  const band = arpBand(average, graveComplaintCount);
  let trigger: ArpSummary['trigger'] = null;
  if (band === 'deaccreditation') {
    trigger = graveComplaintCount >= ARP_GRAVE_LIMIT ? 'grave_complaints' : 'average_below_4';
  }
  return { average, evaluationCount: evaluations.length, graveComplaintCount, band, trigger };
}

/** Avaliação pode ser corrigida pelo cuidador até `editableUntil` (7 dias). */
export function evaluationEditableUntil(createdOn: ISODate): ISODate {
  return addDays(createdOn, EVALUATION_EDIT_DAYS);
}

/** Próxima auditoria: 15 dias depois da última (RN-ARP-05). */
export function nextAuditDate(lastAuditDate: ISODate): ISODate {
  return addDays(lastAuditDate, ARP_AUDIT_INTERVAL_DAYS);
}

/** "Auditoria quinzenal pendente" (AC-M15-05). */
export function isAuditDue(lastAuditDate: ISODate | undefined, today: ISODate): boolean {
  return lastAuditDate === undefined || compareDates(today, nextAuditDate(lastAuditDate)) >= 0;
}

/** Média ponderada da rede: soma de todas as notas ÷ (2 x total de avaliações) dos prestadores avaliáveis (K22, RN-KPI-09). */
export function networkAverage(
  providers: readonly { scoreSum: number; evaluationCount: number }[],
): number | null {
  const rated = providers.filter((p) => p.evaluationCount >= ARP_MIN_EVALUATIONS);
  const totalCount = rated.reduce((s, p) => s + p.evaluationCount, 0);
  if (totalCount === 0) {
    return null;
  }
  const totalSum = rated.reduce((s, p) => s + p.scoreSum, 0);
  return roundHalfUp(totalSum / (2 * totalCount), 2);
}

// ===== Taxa de recusa =====

export interface RefusalStats {
  received: number;
  refusedOrCancelledByProvider: number;
  /** `null` se não houve solicitações na janela. */
  percent: number | null;
  /** Selo "risco de saída" (RN-REDE-28). */
  exitRisk: boolean;
}

const REFUSAL_STATUSES: readonly ServiceRequestStatus[] = [
  'refused_by_provider',
  'cancelled_by_provider',
];

/**
 * Taxa de recusa = (recusadas ou canceladas pelo prestador em 30 dias) ÷ (recebidas em 30 dias) x 100 (RN-REDE-27).
 * Selo de risco com 30% ou mais e no mínimo 5 solicitações recebidas (RN-REDE-28).
 */
export function refusalStats(
  requests: readonly Pick<ServiceRequest, 'providerId' | 'status' | 'requestedAt'>[],
  providerId: string,
  now: ISODateTime,
  options: { windowDays?: number; thresholdPercent?: number; minRequests?: number } = {},
): RefusalStats {
  const windowDays = options.windowDays ?? REFUSAL_WINDOW_DAYS;
  const threshold = options.thresholdPercent ?? DEFAULT_REFUSAL_THRESHOLD_PERCENT;
  const minRequests = options.minRequests ?? DEFAULT_REFUSAL_MIN_REQUESTS;
  const windowStart = fromEpochMs(epochMs(now) - windowDays * 86_400_000);
  const received = requests.filter(
    (r) =>
      r.providerId === providerId &&
      epochMs(r.requestedAt) > epochMs(windowStart) &&
      epochMs(r.requestedAt) <= epochMs(now),
  );
  const refused = received.filter((r) => REFUSAL_STATUSES.includes(r.status)).length;
  const percent = received.length === 0 ? null : roundHalfUp((refused / received.length) * 100, 1);
  return {
    received: received.length,
    refusedOrCancelledByProvider: refused,
    percent,
    exitRisk: percent !== null && received.length >= minRequests && percent >= threshold,
  };
}

// ===== Disponibilidade =====

export interface AvailabilitySignal {
  /** Média dos 4 períodos anteriores. */
  previousAverage: number | null;
  current: number | null;
  dropPercent: number | null;
  /** Queda superior a 50% (RN-REDE-29). */
  signal: boolean;
}

/**
 * Queda de disponibilidade: compara a última semana com a média das 4 semanas anteriores.
 * Sinal quando a queda é SUPERIOR a 50%.
 */
export function availabilityDropSignal(
  weeks: readonly ProviderAvailabilityWeek[],
): AvailabilitySignal {
  const ordered = [...weeks].sort((a, b) => compareDates(a.weekStart, b.weekStart));
  if (ordered.length < 2) {
    return {
      previousAverage: null,
      current: ordered[0]?.slots ?? null,
      dropPercent: null,
      signal: false,
    };
  }
  const current = ordered[ordered.length - 1] as ProviderAvailabilityWeek;
  const previous = ordered.slice(-5, -1);
  const previousAverage = previous.reduce((s, w) => s + w.slots, 0) / previous.length;
  if (previousAverage === 0) {
    return { previousAverage, current: current.slots, dropPercent: null, signal: false };
  }
  const dropPercent = roundHalfUp(((previousAverage - current.slots) / previousAverage) * 100, 1);
  return {
    previousAverage,
    current: current.slots,
    dropPercent,
    signal: dropPercent > AVAILABILITY_DROP_LIMIT_PERCENT,
  };
}

// ===== Busca "como o usuário vê" =====

/** Só `active` e `monitoring` aparecem na busca; suspensos e descredenciados não (RN-REDE-18). */
export function isSearchable(status: ProviderStatus): boolean {
  return status === 'active' || status === 'monitoring';
}

export interface SearchOutcome<P> {
  /** Todos os ativos e em monitoramento da especialidade; o destaque vem primeiro, sem esconder os demais. */
  options: P[];
  availability: 'multiple' | 'single_option' | 'none';
  /** Aviso exibido (RN-REDE-10). */
  notice: string | null;
}

export function searchProviders<
  P extends Pick<Provider, 'status' | 'highlight' | 'name' | 'category'>,
>(
  providers: readonly P[],
  category: Provider['category'],
  averageOf: (provider: P) => number | null = () => null,
): SearchOutcome<P> {
  const options = providers
    .filter((p) => p.category === category && isSearchable(p.status))
    .sort((a, b) => {
      if (a.highlight !== b.highlight) {
        return a.highlight ? -1 : 1;
      }
      const diff = (averageOf(b) ?? 0) - (averageOf(a) ?? 0);
      return diff !== 0 ? diff : a.name.localeCompare(b.name, 'pt-BR');
    });
  if (options.length === 0) {
    return {
      options,
      availability: 'none',
      notice: 'Nenhuma opção disponível no momento. Considere o encaminhamento.',
    };
  }
  if (options.length === 1) {
    return { options, availability: 'single_option', notice: 'Única opção disponível no momento.' };
  }
  return { options, availability: 'multiple', notice: null };
}

// ===== Credenciamento =====

export const ACCREDITATION_CHECKLIST_KEYS: readonly ChecklistKey[] = [
  'council_registry',
  'training_proof',
  'accreditation_contract',
  'data_protection_term',
  'continuous_evaluation_accepted',
];

export const CHECKLIST_LABELS: Readonly<Record<ChecklistKey, string>> = {
  council_registry: 'Registro ativo no conselho de classe',
  training_proof: 'Comprovação de formação',
  accreditation_contract: 'Contrato de credenciamento',
  data_protection_term: 'Termo de proteção de dados',
  continuous_evaluation_accepted: 'Aceite da avaliação contínua pelos usuários',
};

/** Documento vencido na data de hoje? (`validUntil` anterior a hoje.) */
export function isDocumentExpired(
  document: Pick<ProviderDocument, 'validUntil'>,
  today: ISODate,
): boolean {
  return document.validUntil !== undefined && compareDates(document.validUntil, today) < 0;
}

export interface ApprovalCheck {
  canApprove: boolean;
  /** Critérios pendentes ou reprovados (para o botão "Aprovar" desabilitado listar). */
  missingCriteria: ChecklistKey[];
  /** Documentos vencidos. */
  expiredDocuments: ProviderDocument[];
}

/**
 * RN-REDE-21: aprova só com os 5 critérios cumpridos (`ok`; `not_applicable` vale só para o registro de conselho)
 * e TODOS os documentos dentro da validade.
 */
export function checkAccreditationApproval(
  accreditation: Pick<Accreditation, 'checklist'>,
  documents: readonly ProviderDocument[],
  today: ISODate,
): ApprovalCheck {
  const missingCriteria = ACCREDITATION_CHECKLIST_KEYS.filter((key) => {
    const status = accreditation.checklist[key].status;
    if (status === 'ok') {
      return false;
    }
    return !(status === 'not_applicable' && key === 'council_registry');
  });
  const expiredDocuments = documents.filter((d) => isDocumentExpired(d, today));
  return {
    canApprove: missingCriteria.length === 0 && expiredDocuments.length === 0,
    missingCriteria,
    expiredDocuments,
  };
}

/** Ativação exige integração concluída, ciência dos POPs e aceite da vedação de captação paralela (RN-REDE-24, 16, RN-POP-12). */
export function canActivateProvider(
  provider: Pick<
    Provider,
    'integrationDoneAt' | 'popsAcknowledgedAt' | 'parallelSolicitationBanAcceptedAt'
  >,
  accreditationStatus: Accreditation['status'],
): { canActivate: boolean; missing: ('approved' | 'integration' | 'pops' | 'parallel_ban')[] } {
  const missing: ('approved' | 'integration' | 'pops' | 'parallel_ban')[] = [];
  if (accreditationStatus !== 'approved' && accreditationStatus !== 'active') {
    missing.push('approved');
  }
  if (!provider.integrationDoneAt) {
    missing.push('integration');
  }
  if (!provider.popsAcknowledgedAt) {
    missing.push('pops');
  }
  if (!provider.parallelSolicitationBanAcceptedAt) {
    missing.push('parallel_ban');
  }
  return { canActivate: missing.length === 0, missing };
}

/** Data a partir da qual um prestador ativo com documento vencido é suspenso (30 dias, RN-REDE-22). */
export function documentSuspensionDate(expiredOn: ISODate): ISODate {
  return addDays(expiredOn, DOCUMENT_GRACE_DAYS);
}

/** Prestador ativo com documento vencido há mais de 30 dias deve ir a `suspended` (motivo "documento vencido"). */
export function shouldSuspendForExpiredDocument(expiredOn: ISODate, today: ISODate): boolean {
  return daysBetween(expiredOn, today) >= DOCUMENT_GRACE_DAYS;
}

/** Dados do usuário só chegam ao prestador com a cláusula assinada E solicitação aceita (RN-LGPD-13). */
export function providerMaySeeCaregiverData(
  provider: Pick<Provider, 'dataProtectionClauseSignedAt'>,
  request: Pick<ServiceRequest, 'status'>,
): boolean {
  return request.status === 'accepted' && provider.dataProtectionClauseSignedAt !== undefined;
}

/** Data (civil) de uma avaliação, útil para filtros. */
export function evaluationDate(evaluation: Pick<ProviderEvaluation, 'createdAt'>): ISODate {
  return dateOf(evaluation.createdAt);
}
