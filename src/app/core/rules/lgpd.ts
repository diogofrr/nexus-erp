/**
 * Regras puras de LGPD: prazo das solicitações do titular (RN-LGPD-21), consentimento granular
 * (RN-LGPD-05, 14, LP-05, LP-06) e retenção (RN-LGPD-23, 24).
 */
import { addDays, addYears, compareDates, daysBetween } from '../clock/date-utils';
import { ISODate } from '../models/primitives';
import { ConsentKey, ConsentStatus, DataSubjectRequest, DsrType } from '../models/lgpd';
import { Channel } from '../models/primitives';

// ===== Canal preferido e autorização de WhatsApp =====

/**
 * RN-LGPD-05 (e), RN-CAN-01: o canal preferido WhatsApp só vale com a autorização de contato por WhatsApp. Sem ela a equipe
 * não pode procurar a pessoa por esse canal (QAC-005). O cadastro (S-40) grava o aplicativo no lugar; o perfil e a edição
 * pela equipe recusam QUEM ESCOLHE o WhatsApp e dizem o que falta (cadastro antigo que já estava com o WhatsApp não trava
 * outras correções).
 */
export function whatsappChannelNeedsConsent(channel: Channel, whatsappConsentActive: boolean): boolean {
  return channel === 'whatsapp' && !whatsappConsentActive;
}

/** O canal que vale: o escolhido, ou o aplicativo quando o WhatsApp foi escolhido sem a autorização (S-40). */
export function effectivePreferredChannel(channel: Channel, whatsappConsentActive: boolean): Channel {
  return whatsappChannelNeedsConsent(channel, whatsappConsentActive) ? 'app' : channel;
}

// ===== Prazo da solicitação do titular =====

/** Prazo de atendimento: 15 dias corridos a partir do protocolo (RN-LGPD-21). */
export const DSR_DEADLINE_DAYS = 15;
/** "Vence em breve" nos últimos 3 dias. */
export const DSR_DUE_SOON_DAYS = 3;

export function dsrDueDate(openedAt: ISODate, deadlineDays: number = DSR_DEADLINE_DAYS): ISODate {
  return addDays(openedAt, deadlineDays);
}

export type DsrDeadlineState = 'done' | 'on_time' | 'due_soon' | 'overdue';

/** Dias restantes até o prazo (negativo = vencida há N dias). */
export function dsrDaysRemaining(
  request: Pick<DataSubjectRequest, 'dueAt'>,
  today: ISODate,
): number {
  return daysBetween(today, request.dueAt);
}

/**
 * Estado do prazo: `done` se concluída ou rejeitada com motivo; `overdue` depois do prazo; `due_soon`
 * quando faltam 3 dias ou menos; senão `on_time`. Vence em D+5 mostra 5 dias; em D+2, "vence em breve".
 */
export function dsrDeadlineState(
  request: Pick<DataSubjectRequest, 'dueAt' | 'status'>,
  today: ISODate,
  dueSoonDays: number = DSR_DUE_SOON_DAYS,
): DsrDeadlineState {
  if (request.status === 'completed' || request.status === 'rejected_with_reason') {
    return 'done';
  }
  const remaining = daysBetween(today, request.dueAt);
  if (remaining < 0) {
    return 'overdue';
  }
  return remaining <= dueSoonDays ? 'due_soon' : 'on_time';
}

/** Texto do contador ("vence em 5 dias", "vence em breve (2 dias)", "vencida há 1 dia"). */
export function dsrDeadlineLabel(
  request: Pick<DataSubjectRequest, 'dueAt' | 'status'>,
  today: ISODate,
): string {
  const state = dsrDeadlineState(request, today);
  const remaining = daysBetween(today, request.dueAt);
  const plural = (n: number): string => (Math.abs(n) === 1 ? 'dia' : 'dias');
  switch (state) {
    case 'done':
      return 'Concluída';
    case 'overdue':
      return `Vencida há ${Math.abs(remaining)} ${plural(remaining)}`;
    case 'due_soon':
      return remaining === 0 ? 'Vence hoje' : `Vence em breve (${remaining} ${plural(remaining)})`;
    default:
      return `Vence em ${remaining} ${plural(remaining)}`;
  }
}

/** Rejeitar uma solicitação exige motivo escrito (LP-18). */
export function canRejectRequest(reason: string | undefined): boolean {
  return reason !== undefined && reason.trim().length > 0;
}

export const DSR_TYPE_LABELS: Readonly<Record<DsrType, string>> = {
  access: 'Confirmação e acesso',
  correction: 'Correção',
  anonymization_or_blocking: 'Anonimização ou bloqueio',
  portability: 'Portabilidade',
  erasure: 'Eliminação',
  consent_revocation: 'Revogação do consentimento',
  sharing_info: 'Informação sobre compartilhamento',
  decision_review: 'Revisão de decisão',
};

// ===== Consentimento =====

export const CONSENT_KEYS: readonly ConsentKey[] = [
  'health_data',
  'people_analytics',
  'family_sharing',
  'image_testimony',
  'whatsapp_contact',
  'pilot_tcle',
];

export const CONSENT_LABELS: Readonly<Record<ConsentKey, string>> = {
  health_data: 'Dados de saúde para acompanhamento psicológico',
  people_analytics: 'Indicadores e painéis agregados (People Analytics)',
  family_sharing: 'Compartilhamento de informações com familiares',
  image_testimony: 'Uso de imagem e depoimento',
  whatsapp_contact: 'Contato por WhatsApp',
  pilot_tcle: 'Participação no piloto (TCLE)',
};

/**
 * Efeitos de recusa e de revogação de cada consentimento (escopo, seção 6.2). Os efeitos de `health_data`
 * são os de RN-LGPD-14 e `ConsentService` os aplica na hora.
 */
export const CONSENT_EFFECTS: Readonly<
  Record<
    ConsentKey,
    { purpose: string; legalBasis: string; ifRefused: string; ifRevoked: readonly string[] }
  >
> = {
  health_data: {
    purpose: 'Acompanhamento psicológico, Zarit, ARBE e registro documental',
    legalBasis:
      'Consentimento específico e destacado; tutela da saúde em procedimento por profissional de saúde, quando aplicável',
    ifRefused: 'O plano Livre e a agenda continuam; Zarit, ARBE e atendimento clínico não ocorrem.',
    ifRevoked: [
      'O tratamento de dados de saúde cessa a partir da revogação.',
      'Novas aplicações da Zarit não podem ser registradas.',
      'O cuidador sai da ARBE e dos painéis agregados.',
      'Os alertas abertos são encerrados com o motivo "consentimento revogado".',
      'O cadastro passa a "pausado por revogação"; o Livre e a agenda continuam.',
      'Os registros já feitos permanecem como registro documental (retenção).',
    ],
  },
  people_analytics: {
    purpose: 'Indicadores e painéis agregados sobre o cuidador, a rede e a equipe',
    legalBasis: 'Consentimento específico',
    ifRefused: 'O cuidador fica fora dos agregados e painéis.',
    ifRevoked: ['O cuidador sai dos agregados a partir da data da revogação.'],
  },
  family_sharing: {
    purpose: 'Compartilhar informações organizadas da pessoa idosa com familiares',
    legalBasis: 'Consentimento, item a item',
    ifRefused: 'Nenhum compartilhamento é feito.',
    ifRevoked: ['Os compartilhamentos ativos são desfeitos.'],
  },
  image_testimony: {
    purpose: 'Uso de imagem e depoimento em comunicação',
    legalBasis: 'Consentimento específico em documento próprio',
    ifRefused: 'Nenhum uso de imagem ou depoimento.',
    ifRevoked: ['A marcação "pode usar" é removida e os materiais são sinalizados para retirada.'],
  },
  whatsapp_contact: {
    purpose: 'Contato e avaliação pós-atendimento por WhatsApp',
    legalBasis: 'Consentimento',
    ifRefused: 'O contato é feito por aplicativo, telefone ou e-mail.',
    ifRevoked: ['A Nexus para de enviar mensagens por WhatsApp.'],
  },
  pilot_tcle: {
    purpose: 'Participar do piloto (TCLE)',
    legalBasis: 'Consentimento livre e esclarecido',
    ifRefused: 'O cuidador fica fora do piloto.',
    ifRevoked: ['O cuidador sai do piloto.', 'Os dados já coletados seguem as regras de retenção.'],
  },
};

/** O consentimento está em vigor? */
export function isConsentActive(status: ConsentStatus): boolean {
  return status === 'granted';
}

/** LP-06: consentimento dado em versão antiga do termo fica "desatualizado". */
export function isConsentOutdated(consentVersion: string, activeTermVersion: string): boolean {
  return consentVersion !== activeTermVersion;
}

/** O cuidador entra nos agregados só com `health_data` E `people_analytics` concedidos (K15, RN-ZRT-26). */
export function eligibleForAggregates(
  status: Readonly<Partial<Record<ConsentKey, ConsentStatus>>>,
): boolean {
  return status.health_data === 'granted' && status.people_analytics === 'granted';
}

// ===== Retenção =====

/** Retenção mínima do registro documental psicológico: 5 anos, a confirmar (RN-LGPD-23). */
export const DOCUMENTARY_RETENTION_YEARS = 5;
/** Dados de cadastro sem função de registro documental: eliminados em até 30 dias depois do encerramento. */
export const CADASTRE_RETENTION_DAYS = 30;
/** Retenção do log de acesso: 5 anos. */
export const ACCESS_LOG_RETENTION_YEARS = 5;
export const DOCUMENTARY_RETENTION_BASIS = 'Res. CFP 1/2009 (a confirmar)';

/** Fim do bloqueio por retenção documental, contado da data de eliminação ou encerramento. */
export function retentionBlockUntil(
  from: ISODate,
  years: number = DOCUMENTARY_RETENTION_YEARS,
): ISODate {
  return addYears(from, years);
}

/** Dados de cadastro devem ser eliminados a partir desta data (30 dias depois do encerramento). */
export function cadastreErasureDate(
  closedAt: ISODate,
  days: number = CADASTRE_RETENTION_DAYS,
): ISODate {
  return addDays(closedAt, days);
}

/** A retenção já acabou na data `asOf`? (simulação de passagem do tempo, LP-19). */
export function isRetentionExpired(blockedUntil: ISODate, asOf: ISODate): boolean {
  return compareDates(asOf, blockedUntil) >= 0;
}
