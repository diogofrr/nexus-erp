/**
 * Regras que GERAM as notificações do sino (M02, SCR-M02-03, UX 3.6). Funções puras sobre os dados do
 * banco: recebem o ator, o instante e a data de "hoje" e devolvem os rascunhos, ordenados.
 *
 * Regras de conteúdo (U-03, LP-21):
 * - o título descreve a TAREFA ("Contato do mesmo dia pendente"), nunca escore, faixa, pontuação nem a
 *   condição da pessoa;
 * - o contexto traz o mínimo (nome ou código, prazo, protocolo). A gestão (`partner`) só recebe contagens e
 *   códigos, nunca nome de cuidador;
 * - o vermelho é só para prazo de contato vencido ou do dia; o resto usa atenção ou informação.
 */
import { Actor } from '../auth/permissions';
import { ModuleKey } from '../auth/module-map';
import { daysBetween, timeOf } from '../clock/date-utils';
import { Database } from '../data/database';
import { Role } from '../models/access';
import { Caregiver } from '../models/caregivers';
import { ISODate, ISODateTime } from '../models/primitives';
import { formatDate } from '../format/format';
import { isAuditDue, nextAuditDate } from '../rules/arp';
import { isArbeAlertOpen } from '../rules/arbe';
import { hasOverloadAlert } from '../rules/eqp';
import { DSR_TYPE_LABELS, dsrDaysRemaining, dsrDeadlineState } from '../rules/lgpd';
import { redAlertMinutesLeft, redAlertState } from '../rules/pop05';
import {
  isComplaintOverdue,
  isMessageOverdue,
  messageOverdueBusinessMinutes,
  BUSINESS_HOURS_PER_DAY,
} from '../rules/sla';
import { zaritAssessmentState, zaritDaysToDue } from '../rules/zarit';

export type NotificationGroup = 'action_today' | 'to_follow';
export type NotificationSeverity = 'danger' | 'attention' | 'info';

/** Notificação gerada por regra, antes de saber se já foi vista. */
export interface NotificationDraft {
  /** Identidade estável (`tipo:entidade`): é o que permite lembrar "vista" e "resolvida". */
  key: string;
  type: string;
  group: NotificationGroup;
  severity: NotificationSeverity;
  /** Ícone do sprite. */
  icon: string;
  /** Descreve a TAREFA. Nunca escore, faixa ou condição. */
  title: string;
  /** Contexto curto: nome (ou código), prazo, protocolo. */
  context: string;
  /** Rota de destino (sem dado sensível na URL). */
  link: string;
  /** Filtro aplicado ao abrir a tela (AC-M02-08). */
  queryParams?: Record<string, string>;
  /** Quando a pendência nasceu ou venceu. */
  at: ISODateTime;
  /** Quantos itens a notificação representa (contador do menu). */
  count: number;
  /** Item do menu que mostra o contador, se houver. */
  navModule?: ModuleKey;
}

export interface RuleContext {
  db: Database;
  actor: Actor;
  now: ISODateTime;
  today: ISODate;
}

const SEVERITY_ORDER: Record<NotificationSeverity, number> = { danger: 0, attention: 1, info: 2 };
const MAX_PER_TYPE = 8;

const CHANNEL_LABEL = {
  app: 'Aplicativo',
  whatsapp: 'WhatsApp',
  phone: 'Telefone',
  email: 'E-mail',
} as const;

const DOCUMENT_LABEL = {
  council_registry: 'Registro no conselho',
  training_proof: 'Comprovação de formação',
  contract: 'Contrato de credenciamento',
  data_protection_term: 'Termo de proteção de dados',
  identity: 'Documento de identificação',
} as const;

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "daqui a N dias" em frase curta: `vence hoje`, `vence amanhã`, `vence em 5 dias`. */
function dueIn(days: number): string {
  return days <= 0 ? 'vence hoje' : days === 1 ? 'vence amanhã' : `vence em ${days} dias`;
}

/** Atraso em texto: `3 h 12 min`, `18 h`, `2 dias`. */
function elapsedText(minutes: number): string {
  const m = Math.abs(Math.round(minutes));
  if (m < 60) {
    return `${m} min`;
  }
  if (m < 60 * 24) {
    const h = Math.floor(m / 60);
    const rest = m % 60;
    return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
  }
  return plural(Math.floor(m / (60 * 24)), 'dia', 'dias');
}

function nameOf(caregiver: Caregiver | undefined, role: Role): string {
  if (!caregiver) {
    return 'Cuidador';
  }
  return role === 'partner' ? caregiver.code : caregiver.fullName;
}

/** Cuidadores que o ator pode ver nominalmente (psicólogo: só os seus; RT e atendimento: todos). */
function visibleCaregivers(ctx: RuleContext): Map<string, Caregiver> {
  const all = ctx.db.caregivers.list();
  const own = ctx.actor.role === 'psychologist';
  const result = new Map<string, Caregiver>();
  all.forEach((c) => {
    if (
      !own ||
      (ctx.actor.psychologistId && c.assignedPsychologistId === ctx.actor.psychologistId)
    ) {
      result.set(c.id, c);
    }
  });
  return result;
}

// ===== Cuidado (RT e psicólogo): alertas, aplicações, tarefas, pedidos de revisão ================

function careRules(ctx: RuleContext, out: NotificationDraft[]): void {
  const { db, now, today, actor } = ctx;
  const caregivers = visibleCaregivers(ctx);

  // Contato do mesmo dia (vermelho): só o que o perfil acompanha.
  db.zaritAlerts
    .query((a) => a.level === 'red' && a.status !== 'closed' && caregivers.has(a.caregiverId))
    .forEach((alert) => {
      const name = nameOf(caregivers.get(alert.caregiverId), actor.role);
      const state = redAlertState(alert, now);
      if (state === 'open') {
        out.push({
          key: `red_contact_pending:${alert.id}`,
          type: 'red_contact_pending',
          group: 'action_today',
          severity: 'danger',
          icon: 'clock',
          title: 'Contato do mesmo dia pendente',
          context: `${name}, prazo ${timeOf(alert.deadlineAt ?? now)}`,
          link: '/app/acompanhamento',
          queryParams: { filtro: 'contato-hoje' },
          at: alert.createdAt,
          count: 1,
          navModule: 'zarit',
        });
      } else if (state === 'overdue') {
        const left = redAlertMinutesLeft(alert, now) ?? 0;
        out.push({
          key: `red_contact_overdue:${alert.id}`,
          type: 'red_contact_overdue',
          group: 'action_today',
          severity: 'danger',
          icon: 'clock',
          title: 'Prazo de contato vencido',
          context: `${name}, vencido há ${elapsedText(left)}`,
          link: '/app/acompanhamento',
          queryParams: { filtro: 'contato-vencido' },
          at: alert.deadlineAt ?? alert.createdAt,
          count: 1,
          navModule: 'zarit',
        });
      } else if (state === 'contacted' || state === 'risk_assessed') {
        out.push({
          key: `red_followup:${alert.id}`,
          type: 'red_followup',
          group: 'to_follow',
          severity: 'attention',
          icon: 'clipboard-check',
          title:
            state === 'contacted' ? 'Avaliação do caso pendente' : 'Encerramento do caso pendente',
          context: name,
          link: '/app/acompanhamento',
          queryParams: { filtro: 'em-andamento' },
          at: alert.contact?.at ?? alert.createdAt,
          count: 1,
        });
      }
    });

  // Tarefa "revisar rede de apoio" (amarelo).
  db.zaritAlerts
    .query(
      (a) =>
        a.level === 'yellow' &&
        a.status !== 'closed' &&
        a.supportNetworkReviewDone !== true &&
        caregivers.has(a.caregiverId),
    )
    .forEach((alert) =>
      out.push({
        key: `support_network_task:${alert.id}`,
        type: 'support_network_task',
        group: 'to_follow',
        severity: 'attention',
        icon: 'clipboard-list',
        title: 'Tarefa: revisar rede de apoio',
        context: nameOf(caregivers.get(alert.caregiverId), actor.role),
        link: '/app/acompanhamento',
        queryParams: { filtro: 'tarefas' },
        at: alert.createdAt,
        count: 1,
      }),
    );

  // Aplicação da escala vencendo ou atrasada (cuidador ativo, com consentimento de saúde).
  db.zaritAssessments
    .query((a) => a.status === 'scheduled' && caregivers.has(a.caregiverId))
    .forEach((assessment) => {
      const caregiver = caregivers.get(assessment.caregiverId);
      if (!caregiver || caregiver.status !== 'active' || actor.role !== 'psychologist') {
        return;
      }
      const state = zaritAssessmentState(assessment.dueDate, today, false);
      if (state !== 'overdue' && state !== 'due') {
        return;
      }
      const days = zaritDaysToDue(assessment.dueDate, today);
      out.push({
        key: `assessment_due:${assessment.id}`,
        type: 'assessment_due',
        group: state === 'overdue' || days <= 3 ? 'action_today' : 'to_follow',
        severity: 'attention',
        icon: 'calendar-days',
        title:
          state === 'overdue'
            ? `Aplicação atrasada há ${plural(Math.abs(days), 'dia', 'dias')}`
            : `Aplicação ${dueIn(days)}`,
        context: caregiver.fullName,
        link: '/app/acompanhamento',
        queryParams: { filtro: 'aplicacao-vencendo' },
        at: `${assessment.dueDate}T00:00:00-03:00`,
        count: 1,
      });
    });

  // Alertas de acompanhamento a confirmar.
  db.arbeAlerts
    .query((a) => a.status === 'generated' && isArbeAlertOpen(a) && caregivers.has(a.caregiverId))
    .forEach((alert) =>
      out.push({
        key: `arbe_to_confirm:${alert.id}`,
        type: 'arbe_to_confirm',
        group: 'to_follow',
        severity: 'attention',
        icon: 'clipboard-check',
        title: 'Alerta a confirmar',
        context: nameOf(caregivers.get(alert.caregiverId), actor.role),
        link: '/app/acompanhamento',
        queryParams: { filtro: 'alertas-a-confirmar' },
        at: alert.generatedAt,
        count: 1,
      }),
    );

  // Pedidos de revisão de decisão com prazo.
  db.reviewRequests
    .query((r) => r.answeredAt === undefined && caregivers.has(r.caregiverId))
    .forEach((request) => {
      const days = daysBetween(today, request.dueAt);
      out.push({
        key: `review_request:${request.id}`,
        type: 'review_request',
        group: days <= 3 ? 'action_today' : 'to_follow',
        severity: 'attention',
        icon: 'file-text',
        title: 'Pedido de revisão com prazo',
        context: `${nameOf(caregivers.get(request.caregiverId), actor.role)}, ${
          days < 0 ? `vencido há ${plural(Math.abs(days), 'dia', 'dias')}` : dueIn(days)
        }`,
        link: '/app/acompanhamento',
        queryParams: { filtro: 'pedidos-de-revisao' },
        at: request.createdAt,
        count: 1,
      });
    });

  // Ocorrências com passo pendente (restritas ao RT e ao psicólogo do caso).
  db.occurrences
    .query((o) => o.status !== 'closed' && o.restrictedToUserIds.includes(actor.userId))
    .forEach((occurrence) =>
      out.push({
        key: `occurrence_open:${occurrence.id}`,
        type: 'occurrence_open',
        group: 'to_follow',
        severity: 'attention',
        icon: 'file-lock',
        title: 'Ocorrência com passo pendente',
        context: nameOf(caregivers.get(occurrence.caregiverId), actor.role),
        link: '/app/governanca/ocorrencias',
        at: occurrence.openedAt,
        count: 1,
      }),
    );
}

// ===== Psicólogo: anotações e agenda ===========================================================

function psychologistRules(ctx: RuleContext, out: NotificationDraft[]): void {
  const { db, today, actor } = ctx;
  const mine = actor.psychologistId;
  if (!mine) {
    return;
  }
  const signed = new Set(
    db.sessionNotes.query((n) => n.status === 'signed').map((n) => n.sessionId),
  );
  const pending = db.careSessions.query(
    (s) => s.psychologistId === mine && s.status === 'done' && !signed.has(s.id),
  );
  if (pending.length > 0) {
    out.push({
      key: 'sessions_without_note:all',
      type: 'sessions_without_note',
      group: 'to_follow',
      severity: 'attention',
      icon: 'pencil',
      title:
        pending.length === 1
          ? 'Sessão sem anotação (1)'
          : `Sessões sem anotação (${pending.length})`,
      context: 'Registre e assine as anotações do atendimento',
      link: '/app/atendimento',
      queryParams: { filtro: 'sem-anotacao' },
      at:
        pending
          .map((s) => s.startAt)
          .sort()
          .at(-1) ?? ctx.now,
      count: pending.length,
    });
  }
  const currentMonth = today.slice(0, 7);
  if (
    hasOverloadAlert(
      db.monthSummaries.query((s) => s.psychologistId === mine),
      currentMonth,
    )
  ) {
    out.push({
      key: `agenda_overload:${mine}`,
      type: 'agenda_overload',
      group: 'to_follow',
      severity: 'attention',
      icon: 'gauge',
      title: 'Agenda acima de 80% por dois meses',
      context: 'Revise a distribuição da sua agenda',
      link: '/app/atendimento',
      queryParams: { filtro: 'minha-ocupacao' },
      at: `${today}T00:00:00-03:00`,
      count: 1,
    });
  }
}

// ===== Atendimento, psicólogo e RT: mensagens ==================================================

function messageRules(ctx: RuleContext, out: NotificationDraft[]): void {
  const { db, now, actor } = ctx;
  const role = actor.role;
  if (role === 'technical_lead') {
    const flagged = db.messages.query(
      (m) => m.direction === 'in' && m.riskFlag === true && m.status !== 'answered',
    );
    const caregivers = new Map(db.caregivers.list().map((c) => [c.id, c] as const));
    flagged.slice(0, MAX_PER_TYPE).forEach((m) =>
      out.push({
        key: `message_flagged:${m.id}`,
        type: 'message_flagged',
        group: 'action_today',
        severity: 'attention',
        icon: 'messages-square',
        title: 'Mensagem sinalizada à equipe técnica',
        context: nameOf(m.caregiverId ? caregivers.get(m.caregiverId) : undefined, role),
        link: '/app/mensagens',
        queryParams: { filtro: 'sinalizadas' },
        at: m.receivedAt,
        count: 1,
      }),
    );
    return;
  }
  if (role !== 'support' && role !== 'psychologist') {
    return;
  }
  const visible = visibleCaregivers(ctx);
  const overdue = db.messages
    .query(
      (m) =>
        isMessageOverdue(m, now) &&
        (role === 'support' || (m.caregiverId !== undefined && visible.has(m.caregiverId))),
    )
    .map((m) => ({ message: m, minutes: messageOverdueBusinessMinutes(m, now) }))
    .sort((a, b) => b.minutes - a.minutes);
  overdue.slice(0, MAX_PER_TYPE).forEach(({ message, minutes }) => {
    const hours = Math.max(1, Math.round(minutes / 60));
    const business =
      minutes >= BUSINESS_HOURS_PER_DAY * 60 * 2
        ? plural(Math.floor(minutes / (BUSINESS_HOURS_PER_DAY * 60)), 'dia útil', 'dias úteis')
        : plural(hours, 'hora útil', 'horas úteis');
    const who = message.caregiverId
      ? nameOf(visible.get(message.caregiverId) ?? db.caregivers.get(message.caregiverId), role)
      : 'Contato sem cadastro';
    out.push({
      key: `message_overdue:${message.id}`,
      type: 'message_overdue',
      group: 'action_today',
      severity: 'attention',
      icon: 'messages-square',
      title: `Mensagem atrasada há ${business}`,
      context: `${CHANNEL_LABEL[message.channel]} · ${who}`,
      link: '/app/mensagens',
      queryParams: { filtro: 'atrasadas' },
      at: message.dueAt,
      count: 1,
      navModule: 'messages',
    });
  });
  if (overdue.length > MAX_PER_TYPE) {
    const extra = overdue.length - MAX_PER_TYPE;
    out.push({
      key: 'message_overdue:more',
      type: 'message_overdue_more',
      group: 'action_today',
      severity: 'attention',
      icon: 'messages-square',
      title: plural(extra, 'outra mensagem atrasada', 'outras mensagens atrasadas'),
      context: 'Veja a caixa de entrada',
      link: '/app/mensagens',
      queryParams: { filtro: 'atrasadas' },
      at: now,
      count: extra,
      navModule: 'messages',
    });
  }
}

// ===== Solicitações do titular, reclamações e cancelamentos (atendimento, RT, sócia) ============

function privacyAndRelationshipRules(ctx: RuleContext, out: NotificationDraft[]): void {
  const { db, today, now, actor } = ctx;
  const role = actor.role;
  const dueSoonDays = db.settings.get().dsrDueSoonDays;

  db.dataSubjectRequests
    .query((r) => r.status === 'open' || r.status === 'in_progress')
    .forEach((request) => {
      const state = dsrDeadlineState(request, today, dueSoonDays);
      if (state !== 'due_soon' && state !== 'overdue') {
        return;
      }
      const days = dsrDaysRemaining(request, today);
      out.push({
        key: `dsr_due:${request.id}`,
        type: 'dsr_due',
        group: 'action_today',
        severity: 'attention',
        icon: 'shield-check',
        title:
          state === 'overdue'
            ? `Solicitação do titular vencida há ${plural(Math.abs(days), 'dia', 'dias')}`
            : `Solicitação do titular ${dueIn(days)}`,
        context: `${request.protocol} · ${DSR_TYPE_LABELS[request.type]}`,
        link: '/app/lgpd/solicitacoes',
        queryParams: { filtro: 'vencendo' },
        at: `${request.dueAt}T00:00:00-03:00`,
        count: 1,
        navModule: 'privacy',
      });
    });

  // Reclamações com prazo vencido (RT só as graves e as de suspeita de violência).
  db.complaints
    .query(
      (c) =>
        isComplaintOverdue(c, now) &&
        (role !== 'technical_lead' || c.severity === 'grave' || c.suspectedElderAbuse),
    )
    .forEach((complaint) =>
      out.push({
        key: `complaint_overdue:${complaint.id}`,
        type: 'complaint_overdue',
        group: 'action_today',
        severity: 'attention',
        icon: 'flag',
        title: 'Reclamação com prazo vencido',
        context: complaint.protocol,
        link: '/app/reclamacoes',
        queryParams: { filtro: 'vencidas' },
        at: complaint.dueAt,
        count: 1,
      }),
    );

  if (role === 'support') {
    const caregivers = new Map(db.caregivers.list().map((c) => [c.id, c] as const));
    db.subscriptions
      .query((s) => s.status === 'cancel_scheduled' && s.scheduledChangeAt !== undefined)
      .forEach((subscription) => {
        const days = daysBetween(today, subscription.scheduledChangeAt as ISODate);
        if (days < 0) {
          return;
        }
        out.push({
          key: `cancellation_scheduled:${subscription.id}`,
          type: 'cancellation_scheduled',
          group: 'to_follow',
          severity: 'info',
          icon: 'calendar-days',
          title: `Cancelamento agendado ${days === 0 ? 'para hoje' : days === 1 ? 'para amanhã' : `em ${days} dias`}`,
          context: nameOf(caregivers.get(subscription.caregiverId), role),
          link: '/app/assinaturas',
          queryParams: { filtro: 'cancelamento-agendado' },
          at: subscription.updatedAt,
          count: 1,
        });
      });
  }
}

// ===== Sócia e RT: auditoria, documentos, credenciamento, POPs, conteúdos ====================

function managementRules(ctx: RuleContext, out: NotificationDraft[]): void {
  const { db, today, actor } = ctx;
  const role = actor.role;

  if (role === 'partner') {
    const audits = db.arpSnapshots.list().map((s) => s.auditDate);
    const last = audits.length > 0 ? [...audits].sort().at(-1) : undefined;
    if (isAuditDue(last, today)) {
      out.push({
        key: 'audit_due:biweekly',
        type: 'audit_due',
        group: 'action_today',
        severity: 'attention',
        icon: 'clipboard-check',
        title: 'Auditoria quinzenal pendente',
        context: last ? `Última auditoria em ${formatDate(last)}` : 'Nenhuma auditoria registrada',
        link: '/app/rede/auditoria',
        at: `${today}T00:00:00-03:00`,
        count: 1,
      });
    } else if (last) {
      const days = daysBetween(today, nextAuditDate(last));
      if (days <= 3) {
        out.push({
          key: 'audit_due:biweekly',
          type: 'audit_due',
          group: days <= 1 ? 'action_today' : 'to_follow',
          severity: 'attention',
          icon: 'clipboard-check',
          title: `Auditoria quinzenal ${dueIn(days)}`,
          context: `Última auditoria em ${formatDate(last)}`,
          link: '/app/rede/auditoria',
          at: `${today}T00:00:00-03:00`,
          count: 1,
        });
      }
    }

    // Documentos de prestadores vencendo em até 30 dias ou já vencidos.
    const providers = new Map(db.providers.list().map((p) => [p.id, p] as const));
    const expiring = db.providerDocuments
      .query((d) => {
        const provider = providers.get(d.providerId);
        return (
          d.validUntil !== undefined &&
          daysBetween(today, d.validUntil) <= 30 &&
          (provider?.status === 'active' || provider?.status === 'monitoring')
        );
      })
      .sort((a, b) => (a.validUntil ?? '').localeCompare(b.validUntil ?? ''));
    expiring.slice(0, 5).forEach((doc) => {
      const days = daysBetween(today, doc.validUntil as ISODate);
      out.push({
        key: `provider_document:${doc.id}`,
        type: 'provider_document',
        group: 'to_follow',
        severity: 'attention',
        icon: 'file-check',
        title:
          days < 0 ? 'Documento do prestador vencido' : `Documento do prestador ${dueIn(days)}`,
        context: providers.get(doc.providerId)?.name ?? 'Prestador',
        link: '/app/rede/prestadores',
        queryParams: { filtro: 'documento-vencendo' },
        at: `${doc.validUntil}T00:00:00-03:00`,
        count: 1,
      });
    });
    if (expiring.length > 5) {
      out.push({
        key: 'provider_document:more',
        type: 'provider_document_more',
        group: 'to_follow',
        severity: 'attention',
        icon: 'file-check',
        title: plural(
          expiring.length - 5,
          'outro documento de prestador a vencer',
          'outros documentos de prestadores a vencer',
        ),
        context: 'Veja a rede credenciada',
        link: '/app/rede/prestadores',
        queryParams: { filtro: 'documento-vencendo' },
        at: `${today}T00:00:00-03:00`,
        count: expiring.length - 5,
      });
    }

    const pendingAccreditations = db.accreditations.count(
      (a) =>
        a.status === 'requested' || a.status === 'in_review' || a.status === 'pending_documents',
    );
    if (pendingAccreditations > 0) {
      out.push({
        key: 'accreditation_pending:all',
        type: 'accreditation_pending',
        group: 'to_follow',
        severity: 'info',
        icon: 'handshake',
        title:
          pendingAccreditations === 1
            ? 'Credenciamento aguardando decisão (1)'
            : `Credenciamentos aguardando decisão (${pendingAccreditations})`,
        context: 'Veja o quadro de credenciamento',
        link: '/app/rede/credenciamento',
        at: `${today}T00:00:00-03:00`,
        count: pendingAccreditations,
      });
    }

    // Agenda da equipe acima de 80% (sem nome de cuidador; psicólogo da equipe é equipe).
    db.psychologists.list().forEach((psychologist) => {
      if (
        hasOverloadAlert(
          db.monthSummaries.query((s) => s.psychologistId === psychologist.id),
          today.slice(0, 7),
        )
      ) {
        out.push({
          key: `team_overload:${psychologist.id}`,
          type: 'team_overload',
          group: 'to_follow',
          severity: 'attention',
          icon: 'gauge',
          title: 'Agenda acima de 80% (equipe)',
          context: psychologist.displayName,
          link: '/app/atendimento',
          at: `${today}T00:00:00-03:00`,
          count: 1,
        });
      }
    });
  }

  if (role === 'partner' || role === 'technical_lead') {
    const mine =
      role === 'technical_lead'
        ? ['technical_lead', 'management_and_technical_lead']
        : ['management', 'management_and_technical_lead'];
    db.pops
      .query(
        (p) =>
          (p.reviewState === 'due' || p.reviewState === 'revision_triggered') &&
          mine.includes(p.responsibleRole),
      )
      .forEach((pop) =>
        out.push({
          key: `pop_review:${pop.code}`,
          type: 'pop_review',
          group: 'to_follow',
          severity: 'attention',
          icon: 'book-open',
          title: `Revisar o ${pop.code}`,
          context: pop.title,
          link: `/app/governanca/pops/${pop.code}`,
          at: `${pop.lastReviewedAt}T00:00:00-03:00`,
          count: 1,
        }),
      );
  }

  if (role === 'technical_lead') {
    const inReview = db.guidanceContents.count((c) => c.status === 'in_review');
    if (inReview > 0) {
      out.push({
        key: 'content_in_review:all',
        type: 'content_in_review',
        group: 'to_follow',
        severity: 'info',
        icon: 'file-text',
        title:
          inReview === 1
            ? 'Conteúdo aguardando revisão (1)'
            : `Conteúdos aguardando revisão (${inReview})`,
        context: 'Só a responsável técnica aprova a publicação',
        link: '/app/configuracoes/conteudos',
        at: `${today}T00:00:00-03:00`,
        count: inReview,
      });
    }
  }
}

// ===== Profissional credenciado (portal) =======================================================

function providerRules(ctx: RuleContext, out: NotificationDraft[]): void {
  const { db, today, actor } = ctx;
  const providerId = actor.providerId;
  const provider = providerId ? db.providers.get(providerId) : undefined;
  if (!providerId || !provider) {
    return;
  }

  db.serviceRequests
    .query((r) => r.providerId === providerId && r.status === 'requested')
    .forEach((request) =>
      out.push({
        key: `new_request:${request.id}`,
        type: 'new_request',
        group: 'action_today',
        severity: 'info',
        icon: 'clipboard-list',
        title: 'Nova solicitação',
        context: `${request.modality === 'home' ? 'Atendimento domiciliar' : 'Atendimento no consultório'}, recebida em ${formatDate(request.requestedAt)}`,
        link: '/portal/solicitacoes',
        queryParams: { aba: 'novas' },
        at: request.requestedAt,
        count: 1,
      }),
    );

  db.providerDocuments
    .query(
      (d) =>
        d.providerId === providerId &&
        d.validUntil !== undefined &&
        daysBetween(today, d.validUntil) <= 30,
    )
    .forEach((doc) => {
      const days = daysBetween(today, doc.validUntil as ISODate);
      out.push({
        key: `document_expiring:${doc.id}`,
        type: 'document_expiring',
        group: days <= 7 ? 'action_today' : 'to_follow',
        severity: 'attention',
        icon: 'file-check',
        title: days < 0 ? 'Documento vencido' : `Documento ${dueIn(days)}`,
        context: DOCUMENT_LABEL[doc.kind],
        link: '/portal/documentos',
        at: `${doc.validUntil}T00:00:00-03:00`,
        count: 1,
      });
    });

  if (!provider.dataProtectionClauseSignedAt) {
    out.push({
      key: `clause_pending:${providerId}`,
      type: 'clause_pending',
      group: 'action_today',
      severity: 'attention',
      icon: 'file-lock',
      title: 'Cláusula de proteção de dados pendente',
      context: 'Assine para ver os dados do usuário nas solicitações aceitas',
      link: '/portal/documentos',
      at: provider.createdAt,
      count: 1,
    });
  }

  if (
    !provider.integrationDoneAt &&
    (provider.status === 'active' || provider.status === 'monitoring')
  ) {
    out.push({
      key: `integration_pending:${providerId}`,
      type: 'integration_pending',
      group: 'to_follow',
      severity: 'info',
      icon: 'user-check',
      title: 'Integração a concluir',
      context: 'Leia os procedimentos e confirme a ciência',
      link: '/portal/integracao',
      at: provider.createdAt,
      count: 1,
    });
  }

  db.internalReviews
    .query((r) => r.providerId === providerId && r.decision === undefined)
    .forEach((review) => {
      const waiting = review.justification !== undefined;
      out.push({
        key: `${waiting ? 'internal_review_waiting' : 'internal_review'}:${review.id}`,
        type: waiting ? 'internal_review_waiting' : 'internal_review',
        group: waiting ? 'to_follow' : 'action_today',
        severity: waiting ? 'info' : 'attention',
        icon: 'file-text',
        title: waiting
          ? 'Avaliação interna em análise'
          : 'Enviar a justificativa da avaliação interna',
        context: waiting
          ? 'A justificativa foi enviada e aguarda a decisão da Nexus'
          : `Aberta em ${formatDate(review.openedAt)}`,
        link: '/portal/avaliacao-interna',
        at: `${review.openedAt}T00:00:00-03:00`,
        count: 1,
      });
    });
}

// ===== Ponto de entrada ========================================================================

/** Ordem do sino: "Precisa de ação hoje" primeiro; dentro do grupo, perigo, atenção, informação e mais recente. */
export function sortNotifications(list: readonly NotificationDraft[]): NotificationDraft[] {
  const groupOrder: Record<NotificationGroup, number> = { action_today: 0, to_follow: 1 };
  return [...list].sort(
    (a, b) =>
      groupOrder[a.group] - groupOrder[b.group] ||
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      b.at.localeCompare(a.at) ||
      a.key.localeCompare(b.key),
  );
}

/** Gera as notificações do ator (perfil e usuário) nesta data. Perfil sem regra recebe lista vazia. */
export function generateNotifications(ctx: RuleContext): NotificationDraft[] {
  const out: NotificationDraft[] = [];
  switch (ctx.actor.role) {
    case 'technical_lead':
      careRules(ctx, out);
      messageRules(ctx, out);
      privacyAndRelationshipRules(ctx, out);
      managementRules(ctx, out);
      break;
    case 'psychologist':
      careRules(ctx, out);
      psychologistRules(ctx, out);
      messageRules(ctx, out);
      break;
    case 'support':
      messageRules(ctx, out);
      privacyAndRelationshipRules(ctx, out);
      break;
    case 'partner':
      privacyAndRelationshipRules(ctx, out);
      managementRules(ctx, out);
      break;
    case 'provider':
      providerRules(ctx, out);
      break;
  }
  return sortNotifications(out);
}
