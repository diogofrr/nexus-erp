import { Injectable, inject } from '@angular/core';
import { AuditLogService } from '@core/audit';
import { AuthService } from '@core/auth';
import { Clock } from '@core/clock';
import { Database } from '@core/data';
import type {
  ArbeAlert,
  Caregiver,
  Channel,
  ID,
  ISODateTime,
  Message,
  MessageTemplate,
  Occurrence,
  Provider,
  Role,
} from '@core/models';
import { ConsentService } from '@core/privacy';
import {
  POP05_STEPS,
  countSupportRequests,
  evaluateArbe,
  isMessageOverdue,
  messageDueAt,
  shouldGenerateArbeAlert,
} from '@core/rules';

/** Quem escreveu a mensagem, como a tela mostra: cuidador (nome ou código) ou prestador. */
export interface ContactView {
  kind: 'caregiver' | 'provider' | 'unknown';
  /** Nome na tela. A gestão vê só o código (LP-08). */
  label: string;
  /** Rótulo pequeno ("Prestador"). */
  tag: string | null;
  caregiver?: Caregiver;
  provider?: Provider;
}

export interface SupportRequestOutcome {
  /** Pedidos de apoio do cuidador nos últimos 30 dias. */
  count: number;
  /** Nível do alerta de risco gerado pela marcação, se houve. */
  arbeLevel: ArbeAlert['level'] | null;
}

export interface RiskFlagOutcome {
  occurrenceId: ID;
  /** Instante em que o responsável técnico foi avisado. */
  at: ISODateTime;
  /** Já havia uma ocorrência aberta do mesmo cuidador: nada foi duplicado. */
  reused: boolean;
}

export interface ContactInput {
  channel: Extract<Channel, 'phone' | 'whatsapp'>;
  caregiverId: ID;
  subject: string;
  body: string;
  answeredOnCall: boolean;
  supportRequest: boolean;
}

/**
 * Gravações da caixa de mensagens (M11): responder, assumir, vincular, pedido de apoio, sinalizar risco,
 * registrar contato em nome do usuário e modelos de resposta. Tudo passa pelo `Database`; cada gravação que
 * toca dado sensível também vai para o log (AC-GL-10).
 */
@Injectable({ providedIn: 'root' })
export class MessagesService {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly auth = inject(AuthService);
  private readonly audit = inject(AuditLogService);
  private readonly consents = inject(ConsentService);

  // ===== Leitura =====

  /** Quem pode ver a mensagem (psicólogo só dos seus cuidadores; RT só os casos de risco). */
  visibleTo(role: Role, psychologistId: ID | undefined): Message[] {
    const inbound = this.db.messages.all().filter((m) => m.direction === 'in');
    switch (role) {
      case 'partner':
      case 'support':
        return inbound;
      case 'technical_lead':
        return inbound.filter((m) => m.riskFlag === true);
      case 'psychologist': {
        if (!psychologistId) {
          return [];
        }
        const own = new Set(
          this.db.caregivers
            .all()
            .filter((c) => c.assignedPsychologistId === psychologistId)
            .map((c) => c.id),
        );
        return inbound.filter((m) => m.caregiverId !== undefined && own.has(m.caregiverId));
      }
      default:
        return [];
    }
  }

  contactOf(message: Pick<Message, 'caregiverId' | 'providerId'>, role: Role | null): ContactView {
    if (message.caregiverId) {
      const caregiver = this.db.caregivers.get(message.caregiverId);
      if (caregiver) {
        return {
          kind: 'caregiver',
          label: role === 'partner' ? caregiver.code : caregiver.fullName,
          tag: null,
          caregiver,
        };
      }
    }
    if (message.providerId) {
      const provider = this.db.providers.get(message.providerId);
      if (provider) {
        return { kind: 'provider', label: provider.name, tag: 'Prestador', provider };
      }
    }
    return { kind: 'unknown', label: 'Contato sem cadastro', tag: null };
  }

  /** Mensagens do mesmo contato (entrada e saída), da mais antiga para a mais recente. */
  threadOf(message: Message, limit = 12): Message[] {
    const same = this.db.messages
      .all()
      .filter((m) =>
        message.caregiverId
          ? m.caregiverId === message.caregiverId
          : message.providerId
            ? m.providerId === message.providerId
            : m.id === message.id,
      )
      .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt) || a.id.localeCompare(b.id));
    return same.slice(-limit);
  }

  /** Instante em que o RT foi avisado da mensagem sinalizada (a ocorrência aberta depois da chegada). */
  riskNoticeAt(message: Pick<Message, 'caregiverId' | 'receivedAt' | 'riskFlag'>): ISODateTime | null {
    if (!message.riskFlag || !message.caregiverId) {
      return null;
    }
    const found = this.db.occurrences
      .all()
      .filter(
        (o) =>
          o.kind === 'pop05_risk' &&
          o.caregiverId === message.caregiverId &&
          o.openedAt >= message.receivedAt,
      )
      .sort((a, b) => a.openedAt.localeCompare(b.openedAt))[0];
    return found ? found.openedAt : null;
  }

  isOverdue(message: Message): boolean {
    return isMessageOverdue(message, this.clock.now());
  }

  // ===== Gravações =====

  private userId(): ID {
    return this.auth.user()?.id ?? 'system';
  }

  /** Responde: grava a mensagem de saída e marca a recebida como respondida (RN-CAN-04). */
  reply(messageId: ID, body: string): Message {
    const original = this.db.messages.require(messageId);
    const now = this.clock.now();
    const out = this.db.messages.create({
      channel: original.channel,
      direction: 'out',
      ...(original.caregiverId ? { caregiverId: original.caregiverId } : {}),
      ...(original.providerId ? { providerId: original.providerId } : {}),
      ...(original.subject ? { subject: `Re: ${original.subject}` } : {}),
      body: body.trim(),
      receivedAt: now,
      dueAt: now,
      status: 'answered',
      assignedToUserId: this.userId(),
      isSupportRequest: false,
    });
    this.db.messages.update(messageId, {
      status: 'answered',
      firstResponseAt: original.firstResponseAt ?? now,
      assignedToUserId: original.assignedToUserId ?? this.userId(),
    });
    this.audit.write('create', 'message', out.id, original.caregiverId, 'resposta enviada');
    return out;
  }

  /** Assumir: marca quem está cuidando, para evitar resposta em dobro (UX 5.5). */
  assume(messageId: ID): Message {
    const message = this.db.messages.require(messageId);
    const updated = this.db.messages.update(messageId, {
      assignedToUserId: this.userId(),
      status: message.status === 'new' ? 'in_progress' : message.status,
    });
    this.audit.write('update', 'message', messageId, message.caregiverId, 'mensagem assumida');
    return updated;
  }

  linkCaregiver(messageId: ID, caregiverId: ID): Message {
    const updated = this.db.messages.update(messageId, { caregiverId });
    this.audit.write('update', 'message', messageId, caregiverId, 'cuidador vinculado');
    return updated;
  }

  /**
   * Marca ou desmarca "pedido de apoio" (AC-M11-04). Soma ao contador dos últimos 30 dias do cuidador e,
   * se os critérios pedirem, gera o alerta de risco para a equipe técnica (respeitando o consentimento de saúde).
   */
  setSupportRequest(messageId: ID, on: boolean): SupportRequestOutcome {
    const message = this.db.messages.require(messageId);
    this.db.messages.update(messageId, { isSupportRequest: on });
    this.audit.write(
      'update',
      'message',
      messageId,
      message.caregiverId,
      on ? 'pedido de apoio marcado' : 'pedido de apoio desmarcado',
    );
    if (!message.caregiverId) {
      return { count: 0, arbeLevel: null };
    }
    const caregiver = this.db.caregivers.get(message.caregiverId);
    const settings = this.db.settings.get();
    const count = countSupportRequests(
      this.db.messages.all(),
      message.caregiverId,
      this.clock.today(),
      settings.arbe.windowDays,
    );
    if (!on || !caregiver || !this.consents.isActive(caregiver.id, 'health_data')) {
      return { count, arbeLevel: null };
    }
    const lastZarit = this.db.zaritAssessments
      .all()
      .filter((a) => a.caregiverId === caregiver.id && a.status === 'completed' && a.total !== undefined)
      .sort((a, b) => (b.appliedAt ?? '').localeCompare(a.appliedAt ?? ''))[0]?.total;
    const evaluation = evaluateArbe(
      {
        dailyCareHours: caregiver.dailyCareHours,
        supportRequestsInWindow: count,
        lastZarit: lastZarit ?? null,
      },
      settings.arbe,
    );
    if (
      evaluation &&
      shouldGenerateArbeAlert(this.db.arbeAlerts.all(), caregiver.id, evaluation.level)
    ) {
      const alert = this.db.arbeAlerts.create({
        caregiverId: caregiver.id,
        level: evaluation.level,
        generatedAt: this.clock.now(),
        criteria: evaluation.criteria,
        status: 'generated',
      });
      this.audit.write('create', 'arbe_alert', alert.id, caregiver.id);
      return { count, arbeLevel: evaluation.level };
    }
    return { count, arbeLevel: null };
  }

  /**
   * Sinalizar risco (A-38, POP-05): grava a marca na mensagem e abre a ocorrência restrita ao responsável
   * técnico e ao psicólogo do caso, com o passo 1 (acolhimento) já feito por quem sinalizou. O atendimento não
   * vê a ocorrência. Se o cuidador já tem ocorrência de risco em andamento, ela é reaproveitada.
   */
  flagRisk(messageId: ID, caregiverId?: ID): RiskFlagOutcome {
    const message = this.db.messages.require(messageId);
    const cgId = caregiverId ?? message.caregiverId;
    if (!cgId) {
      throw new Error('Escolha o cuidador envolvido para avisar o responsável técnico.');
    }
    const caregiver = this.db.caregivers.require(cgId);
    const now = this.clock.now();
    this.db.messages.update(messageId, {
      riskFlag: true,
      caregiverId: cgId,
      status: message.status === 'answered' ? 'answered' : 'in_progress',
      assignedToUserId: message.assignedToUserId ?? this.userId(),
    });
    const existing = this.db.occurrences.find(
      (o) => o.kind === 'pop05_risk' && o.caregiverId === cgId && o.status !== 'closed',
    );
    if (existing) {
      this.audit.write('update', 'message', messageId, cgId, 'risco sinalizado (ocorrência já aberta)');
      return { occurrenceId: existing.id, at: now, reused: true };
    }
    const restricted = new Set<ID>(
      this.db.users.all().filter((u) => u.role === 'technical_lead').map((u) => u.id),
    );
    const psychologist = caregiver.assignedPsychologistId
      ? this.db.psychologists.get(caregiver.assignedPsychologistId)
      : undefined;
    if (psychologist) {
      restricted.add(psychologist.userId);
    }
    const occurrence: Omit<Occurrence, 'id' | 'createdAt' | 'updatedAt'> = {
      kind: 'pop05_risk',
      caregiverId: cgId,
      openedAt: now,
      status: 'open',
      restrictedToUserIds: [...restricted],
      steps: POP05_STEPS.map((label, k) => ({
        n: k + 1,
        label,
        ...(k === 0
          ? {
              doneAt: now,
              byUserId: this.userId(),
              note: 'Mensagem sinalizada pelo atendimento.',
            }
          : {}),
      })),
      authoritiesNotified: [],
    };
    const created = this.db.occurrences.create(occurrence);
    this.audit.write('create', 'occurrence', created.id, cgId, 'POP-05 aberto por mensagem sinalizada');
    this.audit.write('update', 'message', messageId, cgId, 'risco sinalizado');
    return { occurrenceId: created.id, at: now, reused: false };
  }

  /** Registrar contato recebido por telefone ou WhatsApp, em nome do usuário (RN-CAN-05, AC-M11-07). */
  registerContact(input: ContactInput): Message {
    const now = this.clock.now();
    const settings = this.db.settings.get();
    const message = this.db.messages.create({
      channel: input.channel,
      direction: 'in',
      caregiverId: input.caregiverId,
      subject: input.subject.trim(),
      body: input.body.trim(),
      receivedAt: now,
      dueAt: messageDueAt(input.channel, now, settings.slaHours),
      ...(input.answeredOnCall ? { firstResponseAt: now } : {}),
      status: input.answeredOnCall ? 'answered' : 'in_progress',
      assignedToUserId: this.userId(),
      isSupportRequest: false,
    });
    this.audit.write('create', 'message', message.id, input.caregiverId, 'contato registrado em nome do usuário');
    if (input.supportRequest) {
      this.setSupportRequest(message.id, true);
    }
    return this.db.messages.require(message.id);
  }

  // ===== Modelos de resposta =====

  saveTemplate(input: { id?: ID; title: string; body: string }): MessageTemplate {
    const data = { title: input.title.trim(), body: input.body.trim() };
    return input.id ? this.db.messageTemplates.update(input.id, data) : this.db.messageTemplates.create(data);
  }

  deleteTemplate(id: ID): void {
    this.db.messageTemplates.remove(id);
  }
}
