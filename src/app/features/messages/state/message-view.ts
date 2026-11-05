/**
 * Funções puras de apresentação do M11: rótulos, ordem da caixa de entrada (atrasadas primeiro), descrição do
 * prazo (HH:mm, nunca "23h59"), aviso de mensagem fora do expediente e validação dos modelos de resposta
 * (sem promessa de resultado, sem travessão, sem jargão). Sem Angular e sem relógio.
 */
import { dateOf, timeOf, weekday } from '@core/clock';
import { formatDate, formatTime } from '@core/format';
import type { Channel, Complaint, GraveCategory, ISODate, ISODateTime, Message } from '@core/models';
import {
  BUSINESS_DAY_START,
  BUSINESS_HOURS_PER_DAY,
  businessDaysBetween,
  isBusinessDay,
  isComplaintOverdue,
  isMessageOverdue,
  messageOverdueBusinessMinutes,
  normalizeToBusinessTime,
} from '@core/rules';
import type { IconName } from '@shared/ui';

export const CHANNEL_LABELS: Readonly<Record<Channel, string>> = {
  app: 'Aplicativo',
  whatsapp: 'WhatsApp',
  phone: 'Telefone',
  email: 'E-mail',
};

export const CHANNEL_ICONS: Readonly<Record<Channel, IconName>> = {
  app: 'messages-square',
  whatsapp: 'message-circle',
  phone: 'phone',
  email: 'mail',
};

export const CHANNELS: readonly Channel[] = ['app', 'whatsapp', 'phone', 'email'];

/** Prazo do canal em palavras (RN-CAN-02), a partir das horas configuradas. */
export function slaText(channel: Channel, slaHours: Readonly<Record<Channel, number>>): string {
  const hours = slaHours[channel];
  return hours === 0
    ? 'imediato, em horário comercial'
    : `até ${hours} ${hours === 1 ? 'hora útil' : 'horas úteis'}`;
}

export const HOURS_HELP =
  'Contamos de segunda a sexta, das 08:00 às 18:00, sem feriados nacionais. Mensagem recebida fora desse horário começa a contar na abertura seguinte.';

const WEEKDAY_SHORT = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export function weekdayShort(date: ISODate): string {
  return WEEKDAY_SHORT[weekday(date)] ?? '';
}

/** "hoje, 17:00", "amanhã, 09:00" ou "segunda, 02/11, 11:30" (horário absoluto do prazo). */
export function absoluteDue(due: ISODateTime, today: ISODate): string {
  const day = dateOf(due);
  const time = formatTime(due);
  if (day === today) {
    return `hoje, ${time}`;
  }
  const dd = formatDate(day).slice(0, 5);
  return `${weekdayShort(day)}, ${dd}, ${time}`;
}

/**
 * Aviso sobre o expediente (AC-M11-02, A-40). Fora do horário comercial: "Chegou sexta, 18:40. O prazo começa
 * segunda, 08:00." Dentro do horário, mas com prazo curto que atravessa a noite ou o fim de semana (WhatsApp
 * recebido sexta às 17:30): "Chegou sexta, 17:30. O prazo continua segunda, a partir das 08:00." Sem aviso
 * quando o prazo corre no mesmo dia.
 */
export function expedientNote(
  receivedAt: ISODateTime,
  dueAt: ISODateTime,
  slaHours: number,
): string | null {
  const start = normalizeToBusinessTime(receivedAt);
  const arrived = `${weekdayShort(dateOf(receivedAt))}, ${formatTime(receivedAt)}`;
  if (start !== receivedAt) {
    return `Chegou ${arrived}. O prazo começa ${weekdayShort(dateOf(start))}, ${timeOf(start)}.`;
  }
  if (slaHours > 0 && slaHours <= BUSINESS_HOURS_PER_DAY && dateOf(dueAt) !== dateOf(receivedAt)) {
    return `Chegou ${arrived}. O prazo continua ${weekdayShort(dateOf(dueAt))}, a partir das ${BUSINESS_DAY_START}.`;
  }
  return null;
}

export function isHoliday(date: ISODate): boolean {
  return !isBusinessDay(date) && weekday(date) !== 0 && weekday(date) !== 6;
}

// ===== Ordem e seções da caixa de entrada =====

export type InboxSectionId = 'overdue' | 'waiting' | 'answered';

export interface InboxSection {
  id: InboxSectionId;
  title: string;
  items: Message[];
}

/**
 * Atrasadas SEMPRE primeiro, em seção própria e a mais atrasada no topo (UX 5.5, AC-M11-03); depois as que
 * aguardam resposta, pelo menor prazo; no fim as respondidas, as mais recentes antes.
 */
export function inboxSections(messages: readonly Message[], now: ISODateTime): InboxSection[] {
  const overdue = messages
    .filter((m) => isMessageOverdue(m, now))
    .sort(
      (a, b) =>
        messageOverdueBusinessMinutes(b, now) - messageOverdueBusinessMinutes(a, now) ||
        a.dueAt.localeCompare(b.dueAt),
    );
  const waiting = messages
    .filter((m) => m.status !== 'answered' && !isMessageOverdue(m, now))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const answered = messages
    .filter((m) => m.status === 'answered')
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  return [
    { id: 'overdue' as const, title: 'Atrasadas', items: overdue },
    { id: 'waiting' as const, title: 'Aguardando resposta', items: waiting },
    { id: 'answered' as const, title: 'Respondidas', items: answered },
  ];
}

export const MESSAGE_STATUS_LABELS = {
  new: 'Nova',
  in_progress: 'Em atendimento',
  answered: 'Respondida',
  overdue: 'Atrasada',
} as const;

/** Trecho da mensagem para a lista (sem quebra de linha). */
export function snippetOf(body: string, max = 90): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

// ===== Reclamações =====

export const COMPLAINT_STATUS_LABELS: Readonly<Record<Complaint['status'], string>> = {
  open: 'Aberta',
  in_progress: 'Em análise',
  answered: 'Respondida',
  closed: 'Encerrada',
  dismissed: 'Improcedente',
};

export const COMPLAINT_TARGET_LABELS: Readonly<Record<Complaint['target']['type'], string>> = {
  provider: 'Prestador',
  service: 'Serviço',
  platform: 'Plataforma',
  nexus_psychologist: 'Psicólogo da Nexus',
  other: 'Outro',
};

export const GRAVE_CATEGORY_LABELS: Readonly<Record<GraveCategory, string>> = {
  unjustified_absence: 'Falta sem justificativa',
  confidentiality_breach: 'Quebra de sigilo',
  other: 'Outra situação grave',
};

export const COMPLAINT_OPEN_STATES: readonly Complaint['status'][] = ['open', 'in_progress'];

export interface ComplaintDeadline {
  tone: 'ok' | 'attention' | 'danger' | 'done';
  label: string;
  absolute: string;
}

/** Prazo de 5 dias úteis (RN-POP-08): "Vencida há 3 dias úteis" (AC-M11-08), "Vence em 2 dias úteis". */
export function complaintDeadline(
  complaint: Pick<Complaint, 'status' | 'dueAt'>,
  now: ISODateTime,
): ComplaintDeadline {
  const absolute = `Prazo: ${formatDate(complaint.dueAt)} às ${formatTime(complaint.dueAt)}`;
  if (complaint.status === 'closed' || complaint.status === 'dismissed') {
    return { tone: 'done', label: 'Concluída', absolute };
  }
  if (complaint.status === 'answered') {
    return { tone: 'ok', label: 'Respondida no prazo', absolute };
  }
  const today = dateOf(now);
  const dueDay = dateOf(complaint.dueAt);
  if (isComplaintOverdue(complaint, now)) {
    const late = Math.max(1, businessDaysBetween(dueDay, today));
    return {
      tone: 'danger',
      label: `Vencida há ${late} ${late === 1 ? 'dia útil' : 'dias úteis'}`,
      absolute,
    };
  }
  const left = businessDaysBetween(today, dueDay);
  if (left <= 0) {
    return { tone: 'attention', label: 'Vence hoje', absolute };
  }
  return {
    tone: left <= 2 ? 'attention' : 'ok',
    label: `Vence em ${left} ${left === 1 ? 'dia útil' : 'dias úteis'}`,
    absolute,
  };
}

// ===== Modelos de resposta (RN-CAN-07, AC-M11-10) =====

const PROMISE_PATTERNS: readonly RegExp[] = [
  /\bcur(a|ar|amos|ado|ada)\b/i,
  /\bgarant(e|ir|imos|ia|ido|ida|imos|ido)\b/i,
  /\bmelhor(a|ar|aremos|ará|ou|ia)\b/i,
  /\bresolv(e|er|eremos|erá)\b.*\bproblema/i,
  /\bresultado(s)? (certo|garantido|assegurado)/i,
  /\bsem (falha|erro)s?\b/i,
];

const JARGON_PATTERNS: readonly RegExp[] = [
  /diagn[oó]stic/i,
  /\bpaciente/i,
  /\bburnout\b/i,
  /\bsurto\b/i,
  /\bidos[oa]s?\b/i,
  /\beficácia\b/i,
  /\bzarit\b/i,
  /\barbe\b/i,
];

/** Problemas de um modelo de resposta. Lista vazia quer dizer que está dentro do tom da marca. */
export function templateProblems(title: string, body: string): string[] {
  const problems: string[] = [];
  if (title.trim().length < 3) {
    problems.push('Dê um título de pelo menos 3 letras ao modelo.');
  }
  if (body.trim().length < 10) {
    problems.push('Escreva o texto do modelo, com pelo menos 10 caracteres.');
  }
  const text = `${title}\n${body}`;
  if (/[\u2013\u2014]/.test(text)) {
    problems.push('Troque o travessão por vírgula, ponto ou dois-pontos.');
  }
  if (PROMISE_PATTERNS.some((p) => p.test(body))) {
    problems.push(
      'O texto parece prometer um resultado. Diga o que a equipe vai fazer e quando, sem garantir o resultado.',
    );
  }
  if (JARGON_PATTERNS.some((p) => p.test(body))) {
    problems.push(
      'O texto tem um termo técnico da equipe. Use uma palavra simples, que a família entenda.',
    );
  }
  return problems;
}
