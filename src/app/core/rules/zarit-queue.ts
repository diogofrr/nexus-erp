import { ArbeAlert, Caregiver, ID, ISODate, ISODateTime, ZaritAlert, ZaritAssessment } from '../models';
import { isArbeAlertOpen } from './arbe';
import { redAlertMinutesLeft, redAlertState } from './pop05';
import { zaritAssessmentState } from './zarit';

/**
 * Fila de acompanhamento (SCR-M06-01, SCR-M05-09, AC-M06-16). Ordem de prioridade:
 * vermelho vencido, vermelho do dia, ARBE crítico, amarelo, ARBE de atenção, Zarit vencida, Zarit a vencer.
 * Dentro do mesmo motivo, vem primeiro quem tem a pontuação mais alta e, em empate, quem está mais atrasado
 * (CX-028). Funções puras: recebem os dados, o instante e a data, e devolvem as linhas já ordenadas. Ficam no núcleo para
 * o painel e os indicadores usarem a mesma conta (um módulo não importa de outro).
 */
export type QueueReason =
  | 'red_overdue'
  | 'red_today'
  | 'arbe_critical'
  | 'yellow'
  | 'arbe_attention'
  | 'zarit_overdue'
  | 'zarit_due';

export const QUEUE_RANK: Readonly<Record<QueueReason, number>> = {
  red_overdue: 1,
  red_today: 2,
  arbe_critical: 3,
  yellow: 4,
  arbe_attention: 5,
  zarit_overdue: 6,
  zarit_due: 7,
};

export interface QueueRow {
  caregiverId: ID;
  /** O motivo mais urgente. */
  reason: QueueReason;
  rank: number;
  /** Todos os motivos presentes no cuidador, do mais urgente ao menos. */
  reasons: QueueReason[];
  /** Alerta de Zarit que mais pesa (vermelho ou amarelo aberto). */
  alert?: ZaritAlert;
  arbe?: ArbeAlert;
  assessment?: ZaritAssessment;
  /** Última pontuação concluída (para quem pode vê-la). */
  score: number | null;
  /** Minutos até as 23:59 (negativo = vencido), só no vermelho. */
  minutesLeft: number | null;
  /** Há a tarefa "revisar rede de apoio" pendente (amarelo). */
  supportTaskPending: boolean;
  /** O vermelho está em andamento (contato registrado, aguardando avaliação ou encerramento). */
  inProgress: boolean;
  /** Vencimento da aplicação, quando o motivo é Zarit. */
  dueDate?: ISODate;
}

export interface QueueInput {
  caregivers: readonly Caregiver[];
  alerts: readonly ZaritAlert[];
  arbe: readonly ArbeAlert[];
  assessments: readonly ZaritAssessment[];
  consentActive: (caregiverId: ID) => boolean;
  now: ISODateTime;
  today: ISODate;
}

export function buildQueue(input: QueueInput): QueueRow[] {
  const rows: QueueRow[] = [];
  input.caregivers.forEach((caregiver) => {
    if (caregiver.status !== 'active' || !input.consentActive(caregiver.id)) {
      return;
    }
    const alerts = input.alerts.filter((a) => a.caregiverId === caregiver.id && a.status !== 'closed');
    const reds = alerts
      .filter((a) => a.level === 'red')
      .sort((a, b) => (a.deadlineAt ?? '').localeCompare(b.deadlineAt ?? ''));
    const yellows = alerts.filter((a) => a.level === 'yellow');
    const arbes = input.arbe
      .filter((a) => a.caregiverId === caregiver.id && isArbeAlertOpen(a))
      .sort((a, b) => (a.level === b.level ? 0 : a.level === 'critical' ? -1 : 1));
    const pending = input.assessments
      .filter((z) => z.caregiverId === caregiver.id && z.status === 'scheduled')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
    const state = pending ? zaritAssessmentState(pending.dueDate, input.today, false) : null;
    const completed = input.assessments
      .filter((z) => z.caregiverId === caregiver.id && z.status === 'completed' && z.total !== undefined)
      .sort((a, b) => (a.appliedAt ?? '').localeCompare(b.appliedAt ?? ''));

    const reasons: QueueReason[] = [];
    const red = reds[0];
    if (red) {
      reasons.push(redAlertState(red, input.now) === 'overdue' ? 'red_overdue' : 'red_today');
    }
    const arbe = arbes[0];
    if (arbe?.level === 'critical') {
      reasons.push('arbe_critical');
    }
    const yellow = yellows[0];
    if (yellow) {
      reasons.push('yellow');
    }
    if (arbe?.level === 'attention') {
      reasons.push('arbe_attention');
    }
    if (state === 'overdue') {
      reasons.push('zarit_overdue');
    } else if (state === 'due') {
      reasons.push('zarit_due');
    }
    if (reasons.length === 0) {
      return;
    }
    reasons.sort((a, b) => QUEUE_RANK[a] - QUEUE_RANK[b]);
    const top = reasons[0] as QueueReason;
    rows.push({
      caregiverId: caregiver.id,
      reason: top,
      rank: QUEUE_RANK[top],
      reasons,
      ...(red ?? yellow ? { alert: red ?? yellow } : {}),
      ...(arbe ? { arbe } : {}),
      ...(pending && (state === 'overdue' || state === 'due') ? { assessment: pending, dueDate: pending.dueDate } : {}),
      score: completed.at(-1)?.total ?? null,
      minutesLeft: red ? redAlertMinutesLeft(red, input.now) : null,
      supportTaskPending: yellows.some((a) => a.supportNetworkReviewDone !== true),
      inProgress: !!red && (red.status === 'contacted' || red.status === 'risk_assessed'),
    });
  });
  const nameOf = new Map(input.caregivers.map((c) => [c.id, c.fullName] as const));
  const byDate = (a: QueueRow, b: QueueRow): number =>
    (a.alert?.deadlineAt ?? a.dueDate ?? '').localeCompare(b.alert?.deadlineAt ?? b.dueDate ?? '');
  const byScore = (a: QueueRow, b: QueueRow): number => (b.score ?? -1) - (a.score ?? -1);
  return rows.sort((a, b) => {
    if (a.rank !== b.rank) {
      return a.rank - b.rank;
    }
    // Vermelho: o prazo que vence (ou venceu) primeiro. Os demais: o mais grave primeiro (maior pontuação) e,
    // em empate, o mais atrasado (CX-028).
    const isRed = a.reason === 'red_overdue' || a.reason === 'red_today';
    return (
      (isRed ? byDate(a, b) || byScore(a, b) : byScore(a, b) || byDate(a, b)) ||
      (nameOf.get(a.caregiverId) ?? '').localeCompare(nameOf.get(b.caregiverId) ?? '', 'pt-BR')
    );
  });
}

/** Filtros da fila (chips e chaves do sino, `?filtro=`). */
export type QueueFilter =
  | 'vermelhos'
  | 'amarelos'
  | 'arbe'
  | 'zarit'
  | 'contato-hoje'
  | 'contato-vencido'
  | 'em-andamento'
  | 'tarefas'
  | 'aplicacao-vencendo'
  | 'alertas-a-confirmar';

export function matchesFilter(row: QueueRow, filter: string | null): boolean {
  switch (filter) {
    case 'vermelhos':
      return row.reasons.includes('red_overdue') || row.reasons.includes('red_today');
    case 'amarelos':
      return row.reasons.includes('yellow');
    case 'arbe':
    case 'alertas-a-confirmar':
      return row.reasons.includes('arbe_critical') || row.reasons.includes('arbe_attention');
    case 'zarit':
    case 'aplicacao-vencendo':
      return row.reasons.includes('zarit_overdue') || row.reasons.includes('zarit_due');
    case 'contato-hoje':
      return row.reason === 'red_today' && row.alert?.status === 'open';
    case 'contato-vencido':
      return row.reasons.includes('red_overdue');
    case 'em-andamento':
      return row.inProgress;
    case 'tarefas':
      return row.supportTaskPending;
    default:
      return true;
  }
}
