import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from '@core/auth';
import { Clock, addDays, dateOf, timeOf } from '@core/clock';
import { Database } from '@core/data';
import {
  CareSession,
  Caregiver,
  ID,
  Message,
  ServiceRequest,
  ZaritAlert,
} from '@core/models';
import { Aggregate, aggregateCount } from '@core/privacy';
import { ConsentService } from '@core/privacy/consent.service';
import { ARP_BAND_LABELS, availabilityDropSignal, isAuditDue, refusalStats } from '@core/rules/arp';
import {
  hasOverloadAlert,
  lastClosedMonths,
  occupancyPercent,
} from '@core/rules/eqp';
import {
  averageNetFromParams,
  breakEvenExact,
  conversionRatePercent,
  projectScenario,
  realizedFinance,
} from '@core/rules/finance';
import { popDisplayState } from '@core/rules/governance-access';
import { isPriorityRisk, riskCriticality } from '@core/rules/governance';
import {
  countFreeUsers,
  countSubscribers,
  dsrCounts,
  openArbeByLevel,
  providersByBand,
} from '@core/rules/kpi';
import { isEscalatedToTechnicalLead, redAlertState } from '@core/rules/pop05';
import { QueueReason, QueueRow, buildQueue } from '@core/rules/zarit-queue';
import {
  isComplaintOverdue,
  isMessageOverdue,
  messageOverdueBusinessMinutes,
  slaByChannel,
} from '@core/rules/sla';
import { zaritDaysToDue } from '@core/rules/zarit';

export interface OccupancyLine {
  psychologistId: ID;
  name: string;
  /** Último mês fechado. */
  month: string;
  percent: number | null;
  overload: boolean;
}

export interface DecisionItem {
  key: string;
  text: string;
  link: string;
  queryParams?: Record<string, string>;
  icon: 'clock' | 'triangle-alert' | 'shield-check' | 'users' | 'book-open' | 'stethoscope';
}

export interface AlertQueueRow {
  id: ID;
  /** `CUI-0000`, nunca o nome (gestão e RT). */
  code: string;
  level: 'yellow' | 'red';
  state: 'overdue' | 'today' | 'contacted' | 'task' | 'open';
  label: string;
}

export interface OwnQueueRow {
  key: string;
  name: string;
  caregiverId: ID;
  kind: 'red' | 'yellow' | 'due' | 'overdue';
  text: string;
  link: string;
  queryParams?: Record<string, string>;
}

export interface MessageRow {
  id: ID;
  name: string;
  channel: Message['channel'];
  dueAt: string;
  overdue: boolean;
  overdueMinutes: number;
}

/** Quantos itens de decisão aparecem antes do "Ver todos". */
export const MAX_DECISIONS_SHOWN = 3;

const QUEUE_KIND: Record<QueueReason, OwnQueueRow['kind']> = {
  red_overdue: 'red',
  red_today: 'red',
  arbe_critical: 'red',
  yellow: 'yellow',
  arbe_attention: 'yellow',
  zarit_overdue: 'overdue',
  zarit_due: 'due',
};

function queueKind(row: QueueRow): OwnQueueRow['kind'] {
  return QUEUE_KIND[row.reason];
}

const CHANNEL_LABEL: Record<Message['channel'], string> = {
  app: 'Aplicativo',
  whatsapp: 'WhatsApp',
  phone: 'Telefone',
  email: 'E-mail',
};

/**
 * Dados dos painéis (M02). Cada perfil lê só o que a matriz libera: a gestão vê códigos e agregados com mínimo de
 * 5, o RT vê a fila de alertas por código, o psicólogo vê os próprios casos, o atendimento vê mensagens e prazos e
 * nada de saúde. Tudo sai dos repositórios e das regras puras de `core/rules`.
 */
@Injectable({ providedIn: 'root' })
export class DashboardStore {
  private readonly db = inject(Database);
  private readonly auth = inject(AuthService);
  private readonly clock = inject(Clock);
  private readonly consent = inject(ConsentService);

  readonly role = this.auth.role;
  private readonly min = computed(() => this.db.settings.value().minGroupSizeForAggregates);
  private readonly psychologistId = computed(() => this.auth.actor()?.psychologistId);

  // ===== Saudação =====

  readonly greeting = computed(() => {
    const hour = Number(timeOf(this.clock.now()).slice(0, 2));
    const part = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
    const name = this.auth.user()?.displayName ?? '';
    const tokens = name.split(/\s+/).filter(Boolean);
    const first = tokens[0]?.endsWith('.') ? tokens.slice(0, 2).join(' ') : (tokens[0] ?? '');
    return first ? `${part}, ${first}` : part;
  });

  // ===== Comercial e financeiro (gestão) =====

  readonly subscribers = computed(() => countSubscribers(this.db.subscriptions.all()));
  readonly freeUsers = computed(() => countFreeUsers(this.db.caregivers.all()));
  readonly conversion = computed(() => conversionRatePercent(this.subscribers().total, this.freeUsers()));
  readonly realized = computed(() =>
    realizedFinance(this.db.financialParams.value(), this.subscribers().byPlan),
  );

  /** A conta do ponto de equilíbrio (gastos ÷ líquida média), para mostrar como se chega ao número. */
  readonly breakEvenExact = computed(() => breakEvenExact(this.db.financialParams.value()));
  /** Receita líquida média por assinante do plano (a base da conta do equilíbrio). */
  readonly planAverageNetCents = computed(() => averageNetFromParams(this.db.financialParams.value()));

  /** Projeção do cenário-base (estimativa do plano) para comparar com o realizado. */
  readonly baseProjection = computed(() => projectScenario(this.db.financialParams.value(), 'base'));

  // ===== Rede (gestão) =====

  readonly lastAuditDate = computed(() => {
    const dates = this.db.arpSnapshots.all().map((s) => s.auditDate);
    return dates.length === 0 ? undefined : dates.reduce((a, b) => (a >= b ? a : b));
  });
  readonly auditDue = computed(() => isAuditDue(this.lastAuditDate(), this.clock.today()));

  readonly arpBands = computed(() => {
    const counts = providersByBand(this.db.arpSnapshots.all());
    return (Object.keys(ARP_BAND_LABELS) as (keyof typeof ARP_BAND_LABELS)[]).map((band) => ({
      band,
      label: ARP_BAND_LABELS[band],
      count: counts[band],
    }));
  });

  readonly accreditationsInProgress = computed(
    () =>
      this.db.accreditations
        .all()
        .filter((a) => a.status === 'requested' || a.status === 'in_review' || a.status === 'pending_documents')
        .length,
  );

  readonly exitRiskCount = computed(() => {
    const settings = this.db.settings.value();
    const requests: readonly ServiceRequest[] = this.db.serviceRequests.all();
    const now = this.clock.now();
    return this.db.providers
      .all()
      .filter((p) => p.status === 'active' || p.status === 'monitoring')
      .filter((p) => {
        const stats = refusalStats(requests, p.id, now, {
          thresholdPercent: settings.refusalRateThresholdPercent,
          minRequests: settings.refusalRateMinRequests,
        });
        return stats.exitRisk || availabilityDropSignal(p.availability).signal;
      }).length;
  });

  // ===== Equipe =====

  /** Ocupação do último mês fechado e alerta de sobrecarga por psicólogo (a gestão e o RT veem a equipe). */
  readonly occupancy = computed<OccupancyLine[]>(() => {
    const current = this.clock.currentMonth();
    const last = lastClosedMonths(current)[lastClosedMonths(current).length - 1] as string;
    const mine = this.psychologistId();
    return this.db.psychologists
      .all()
      .filter((p) => this.role() !== 'psychologist' || p.id === mine)
      .map((p) => {
        const rows = this.db.monthSummaries.all().filter((s) => s.psychologistId === p.id);
        const row = rows.find((r) => r.month === last);
        return {
          psychologistId: p.id,
          name: p.displayName,
          month: last,
          percent: row ? occupancyPercent(row.availableHours, row.doneHours) : null,
          overload: hasOverloadAlert(rows, current),
        };
      });
  });
  readonly overloaded = computed(() => this.occupancy().filter((o) => o.overload));

  // ===== Alertas =====

  private readonly alerts = computed(() => this.db.zaritAlerts.all());
  private readonly caregiverCode = computed(
    () => new Map(this.db.caregivers.all().map((c) => [c.id, c.code] as const)),
  );

  /** Gestão: contagens protegidas pelo mínimo (RN-KPI-02). */
  readonly aggregateAlerts = computed(() => {
    const open = this.alerts().filter((a) => a.status !== 'closed');
    const arbe = openArbeByLevel(this.db.arbeAlerts.all());
    const min = this.min();
    const agg = (n: number): Aggregate<number> => aggregateCount(n, min);
    return {
      yellow: agg(open.filter((a) => a.level === 'yellow').length),
      red: agg(open.filter((a) => a.level === 'red').length),
      arbeCritical: agg(arbe.critical),
      arbeAttention: agg(arbe.attention),
    };
  });

  /** RT: números exatos dos casos (a supervisão é dele). */
  readonly rtCounts = computed(() => {
    const now = this.clock.now();
    const today = this.clock.today();
    const all = this.alerts();
    const redOpen = all.filter((a) => a.level === 'red' && a.status !== 'closed');
    const redToday = redOpen.filter(
      (a) => !a.contact && redAlertState(a, now) === 'open' && a.deadlineAt !== undefined && dateOf(a.deadlineAt) === today,
    );
    const redOverdue = redOpen.filter((a) => isEscalatedToTechnicalLead(a, now));
    const yellowOpen = all.filter((a) => a.level === 'yellow' && a.status === 'open');
    const yellowNotClosed = all.filter((a) => a.level === 'yellow' && a.status !== 'closed');
    const arbe = openArbeByLevel(this.db.arbeAlerts.all());
    const occ = this.db.occurrences.all().filter((o) => o.status !== 'closed');
    return {
      redOpen: redOpen.length,
      redToday: redToday.length,
      redOverdue: redOverdue.length,
      yellowOpen: yellowOpen.length,
      yellowNotClosed: yellowNotClosed.length,
      arbeCritical: arbe.critical,
      arbeAttention: arbe.attention,
      pop05: occ.filter((o) => o.kind === 'pop05_risk').length,
      pop07: occ.filter((o) => o.kind === 'pop07_violence_suspicion').length,
    };
  });

  /** RT: fila de alertas de todos os casos, SÓ por código, nível e situação do prazo (sem escore nem nome). */
  readonly alertQueue = computed<AlertQueueRow[]>(() => {
    const now = this.clock.now();
    const today = this.clock.today();
    const codes = this.caregiverCode();
    const rank = (r: AlertQueueRow): number =>
      ({ overdue: 0, today: 1, open: 2, task: 3, contacted: 4 })[r.state] + (r.level === 'red' ? 0 : 10);
    return this.alerts()
      .filter((a) => a.status !== 'closed')
      .map((a) => this.queueRow(a, codes.get(a.caregiverId) ?? 'CUI-0000', now, today))
      .sort((a, b) => rank(a) - rank(b) || a.code.localeCompare(b.code, 'pt-BR', { numeric: true }));
  });

  private queueRow(a: ZaritAlert, code: string, now: string, today: string): AlertQueueRow {
    if (a.level === 'red') {
      const state = redAlertState(a, now);
      if (state === 'overdue') {
        return { id: a.id, code, level: 'red', state: 'overdue', label: 'Prazo vencido, sem contato' };
      }
      if (!a.contact && a.deadlineAt && dateOf(a.deadlineAt) === today) {
        return { id: a.id, code, level: 'red', state: 'today', label: 'Contato até 23:59 de hoje' };
      }
      return { id: a.id, code, level: 'red', state: a.contact ? 'contacted' : 'open', label: a.contact ? 'Contatado, falta encerrar' : 'Aberto' };
    }
    if (a.status === 'open') {
      return { id: a.id, code, level: 'yellow', state: 'open', label: 'Aberto' };
    }
    if (!a.supportNetworkReviewDone) {
      return { id: a.id, code, level: 'yellow', state: 'task', label: 'Tarefa de revisão da rede de apoio pendente' };
    }
    return { id: a.id, code, level: 'yellow', state: 'contacted', label: 'Contatado' };
  }

  // ===== Governança =====

  readonly governance = computed(() => {
    const today = this.clock.today();
    const risks = this.db.risks.all();
    return {
      popsToReview: this.db.pops
        .all()
        .filter((p) => popDisplayState(p, today) !== 'up_to_date').length,
      priorityRisks: risks.filter((r) => isPriorityRisk(riskCriticality(r.probability, r.impact))).length,
      contentsInReview: this.db.guidanceContents.all().filter((c) => c.status === 'in_review').length,
    };
  });

  // ===== Atendimento (SLA, reclamações, LGPD) =====

  readonly dsr = computed(() =>
    dsrCounts(this.db.dataSubjectRequests.all(), this.clock.today(), this.db.settings.value().dsrDueSoonDays),
  );

  readonly sla = computed(() => {
    const start = addDays(this.clock.today(), -30);
    const messages = this.db.messages.all().filter((m) => dateOf(m.receivedAt) > start);
    return slaByChannel(messages, this.clock.now());
  });

  readonly complaints = computed(() => {
    const now = this.clock.now();
    const list = this.db.complaints.all();
    return {
      open: list.filter((c) => c.status === 'open' || c.status === 'in_progress').length,
      overdue: list.filter((c) => isComplaintOverdue(c, now)).length,
    };
  });

  /** Atendimento: mensagens sem resposta, atrasadas primeiro e a mais atrasada no topo (AC-M02-05). */
  readonly messageQueue = computed<MessageRow[]>(() => {
    const now = this.clock.now();
    const caregivers = new Map(this.db.caregivers.all().map((c) => [c.id, c] as const));
    return this.db.messages
      .all()
      .filter((m) => m.direction === 'in' && m.status !== 'answered')
      .map((m) => {
        const overdue = isMessageOverdue(m, now);
        return {
          id: m.id,
          name: this.messageName(m, caregivers),
          channel: m.channel,
          dueAt: m.dueAt,
          overdue,
          overdueMinutes: messageOverdueBusinessMinutes(m, now),
        };
      })
      .sort(
        (a, b) =>
          Number(b.overdue) - Number(a.overdue) ||
          b.overdueMinutes - a.overdueMinutes ||
          a.dueAt.localeCompare(b.dueAt),
      );
  });
  readonly overdueMessages = computed(() => this.messageQueue().filter((m) => m.overdue).length);

  private messageName(m: Message, caregivers: Map<ID, Caregiver>): string {
    if (m.caregiverId) {
      return caregivers.get(m.caregiverId)?.fullName ?? 'Cuidador';
    }
    if (m.providerId) {
      return this.db.providers.get(m.providerId)?.name ?? 'Prestador';
    }
    return 'Contato';
  }

  channelLabel(channel: Message['channel']): string {
    return CHANNEL_LABEL[channel];
  }

  readonly serviceRequestsWithoutReply = computed(
    () => this.db.serviceRequests.all().filter((r) => r.status === 'requested' && !r.respondedAt).length,
  );
  readonly newRegistrations = computed(() => {
    const from = addDays(this.clock.today(), -7);
    return this.db.caregivers.all().filter((c) => c.enrolledAt > from && c.status === 'active').length;
  });
  readonly scheduledCancellations = computed(
    () => this.db.subscriptions.all().filter((s) => s.status === 'cancel_scheduled').length,
  );

  // ===== Psicólogo =====

  private readonly ownCaregivers = computed(() => {
    const mine = this.psychologistId();
    return this.db.caregivers.all().filter((c) => c.assignedPsychologistId === mine && c.status !== 'closed');
  });

  /** Sessões de hoje do psicólogo (agenda do dia). */
  readonly todaySessions = computed(() => {
    const mine = this.psychologistId();
    const today = this.clock.today();
    const caregivers = new Map(this.db.caregivers.all().map((c) => [c.id, c] as const));
    return this.db.careSessions
      .all()
      .filter((s) => s.psychologistId === mine && dateOf(s.startAt) === today)
      .filter((s) => s.status !== 'cancelled_by_user' && s.status !== 'cancelled_by_psychologist')
      .sort((a, b) => a.startAt.localeCompare(b.startAt))
      .map((s: CareSession) => ({
        session: s,
        time: timeOf(s.startAt),
        name: caregivers.get(s.caregiverId)?.fullName ?? 'Cuidador',
      }));
  });

  /** Sessões feitas sem anotação assinada ("sessões a registrar"). */
  readonly sessionsToRecord = computed(() => {
    const mine = this.psychologistId();
    const signed = new Set(
      this.db.sessionNotes
        .all()
        .filter((n) => n.status === 'signed')
        .map((n) => n.sessionId),
    );
    return this.db.careSessions.all().filter((s) => s.psychologistId === mine && s.status === 'done' && !signed.has(s.id)).length;
  });

  /** Tarefas "revisar rede de apoio" dos alertas amarelos dos meus casos. */
  readonly supportNetworkTasks = computed(() => {
    const own = new Set(this.ownCaregivers().map((c) => c.id));
    return this.alerts().filter((a) => a.level === 'yellow' && a.status !== 'closed' && !a.supportNetworkReviewDone && own.has(a.caregiverId)).length;
  });

  /**
   * Minha fila: a mesma conta e a mesma ordem da fila completa (`buildQueue`, CX-028): vermelho vencido, vermelho do
   * dia, ARBE crítico, amarelo, ARBE de atenção, escala vencida e a vencer; em cada grupo, o mais grave e o mais
   * atrasado primeiro. Um cuidador aparece uma vez só e o clique abre o caso (alerta, escala ou ARBE).
   */
  readonly ownQueue = computed<OwnQueueRow[]>(() => {
    const now = this.clock.now();
    const today = this.clock.today();
    const own = new Map(this.ownCaregivers().map((c) => [c.id, c] as const));
    return buildQueue({
      caregivers: [...own.values()],
      alerts: this.alerts(),
      arbe: this.db.arbeAlerts.all(),
      assessments: this.db.zaritAssessments.all(),
      consentActive: (id) => this.consent.isActive(id, 'health_data'),
      now,
      today,
    }).map((row) => {
      const c = own.get(row.caregiverId) as Caregiver;
      const target = this.queueTarget(row);
      return {
        key: row.caregiverId,
        name: c.fullName,
        caregiverId: c.id,
        kind: queueKind(row),
        text: this.queueText(row, today),
        link: target.link,
        ...(target.queryParams ? { queryParams: target.queryParams } : {}),
      };
    });
  });

  private queueTarget(row: QueueRow): { link: string; queryParams?: Record<string, string> } {
    if (row.alert) {
      return { link: `/app/acompanhamento/alertas/${row.alert.id}` };
    }
    if (row.arbe) {
      return { link: '/app/acompanhamento/arbe' };
    }
    return { link: `/app/acompanhamento/zarit/${row.caregiverId}/nova` };
  }

  private queueText(row: QueueRow, today: string): string {
    switch (row.reason) {
      case 'red_overdue':
        return 'Alerta vermelho: contato vencido';
      case 'red_today':
        return row.alert?.contact ? 'Alerta vermelho: falta encerrar' : 'Alerta vermelho: contato até 23:59';
      case 'arbe_critical':
        return 'Alerta de esgotamento (ARBE): crítico';
      case 'yellow':
        return row.supportTaskPending ? 'Alerta amarelo: revisar a rede de apoio' : 'Alerta amarelo em acompanhamento';
      case 'arbe_attention':
        return 'Alerta de esgotamento (ARBE): atenção';
      default: {
        const days = row.dueDate ? zaritDaysToDue(row.dueDate, today) : 0;
        const late = Math.abs(days);
        if (row.reason === 'zarit_overdue') {
          return `Escala vencida há ${late} ${late === 1 ? 'dia' : 'dias'}`;
        }
        return days === 0 ? 'Escala vence hoje' : `Escala vence em ${days} ${days === 1 ? 'dia' : 'dias'}`;
      }
    }
  }

  /** Ocupação parcial do mês corrente do psicólogo (horas feitas e disponibilizadas até agora). */
  readonly ownCurrentMonth = computed(() => {
    const mine = this.psychologistId();
    const month = this.clock.currentMonth();
    const available = this.db.availabilitySlots
      .all()
      .filter((s) => s.psychologistId === mine && s.date.startsWith(month) && s.status !== 'blocked').length;
    const done = this.db.careSessions
      .all()
      .filter((s) => s.psychologistId === mine && s.status === 'done' && dateOf(s.startAt).startsWith(month)).length;
    return { month, available, done, percent: occupancyPercent(available, done) };
  });

  // ===== "Precisa da sua decisão" (gestão) =====

  /** Todos os itens que pedem decisão da gestão, sem corte (CX-004: o total é sempre dito na tela). */
  readonly allDecisions = computed<DecisionItem[]>(() => {
    const items: DecisionItem[] = [];
    const dsr = this.dsr();
    if (dsr.overdue > 0 || dsr.dueSoon > 0) {
      const n = dsr.overdue + dsr.dueSoon;
      items.push({
        key: 'dsr',
        text:
          n === 1
            ? '1 solicitação do titular vence em breve ou já venceu'
            : `${n} solicitações do titular vencem em breve ou já venceram`,
        link: '/app/lgpd/solicitacoes',
        queryParams: { filtro: 'vencendo' },
        icon: 'shield-check',
      });
    }
    const overloaded = this.overloaded();
    if (overloaded.length > 0) {
      items.push({
        key: 'overload',
        text:
          overloaded.length === 1
            ? `${overloaded[0]?.name} está com a agenda acima de 80% por dois meses: redistribuir ou ampliar a equipe`
            : `${overloaded.length} psicólogos com a agenda acima de 80% por dois meses`,
        link: '/app/indicadores',
        queryParams: { aba: 'equipe' },
        icon: 'users',
      });
    }
    if (this.auditDue()) {
      items.push({
        key: 'audit',
        text: 'A auditoria quinzenal da rede está pendente',
        link: '/app/rede/auditoria',
        icon: 'clock',
      });
    }
    if (this.exitRiskCount() > 0) {
      const n = this.exitRiskCount();
      items.push({
        key: 'exit-risk',
        text: `${n} ${n === 1 ? 'prestador com risco de saída (pode deixar a rede)' : 'prestadores com risco de saída (podem deixar a rede)'}`,
        link: '/app/rede/prestadores',
        queryParams: { filtro: 'risco-de-saida' },
        icon: 'stethoscope',
      });
    }
    if (this.accreditationsInProgress() > 0) {
      const n = this.accreditationsInProgress();
      items.push({
        key: 'accreditation',
        text: `${n} ${n === 1 ? 'credenciamento aguarda' : 'credenciamentos aguardam'} decisão`,
        link: '/app/rede/credenciamento',
        queryParams: { filtro: 'em-andamento' },
        icon: 'stethoscope',
      });
    }
    if (this.governance().popsToReview > 0) {
      const n = this.governance().popsToReview;
      items.push({
        key: 'pops',
        text: `${n} ${n === 1 ? 'POP a revisar' : 'POPs a revisar'}`,
        link: '/app/governanca/pops',
        queryParams: { filtro: 'a-revisar' },
        icon: 'book-open',
      });
    }
    return items;
  });

  /** Os primeiros itens, mostrados de início; o resto aparece em "Ver todos". */
  readonly decisions = computed<DecisionItem[]>(() => this.allDecisions().slice(0, MAX_DECISIONS_SHOWN));
}
