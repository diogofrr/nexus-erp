import { Injectable, inject } from '@angular/core';
import { AuditLogService } from '@core/audit';
import { AuthService } from '@core/auth';
import { Clock } from '@core/clock';
import { Database } from '@core/data';
import type {
  Channel,
  Complaint,
  GraveCategory,
  ID,
  Occurrence,
  Role,
} from '@core/models';
import { NetworkService, ReevaluationOutcome } from '@core/network';
import { POP07_STEPS, complaintDueAt } from '@core/rules';

export interface NewComplaintInput {
  channel: Channel;
  caregiverId?: ID;
  targetType: Complaint['target']['type'];
  providerId?: ID;
  description: string;
}

export interface GraveOutcome {
  complaint: Complaint;
  /** Efeito na ARP: a suspensão acontece na hora, com a terceira reclamação grave (RN-ARP-10). */
  reevaluation: ReevaluationOutcome;
  graveCount: number;
}

/**
 * Gravações das reclamações (M11, POP-08): abrir, responder, encerrar, improcedente, classificar como grave
 * (conta na ARP do prestador, RN-ARP-09) e marcar suspeita de violência ou negligência (abre ocorrência POP-07
 * restrita ao responsável técnico e ao psicólogo do caso, RN-ARP-13).
 */
@Injectable({ providedIn: 'root' })
export class ComplaintsService {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly auth = inject(AuthService);
  private readonly audit = inject(AuditLogService);
  private readonly network = inject(NetworkService);

  private userId(): ID {
    return this.auth.user()?.id ?? 'system';
  }

  /** Reclamações que o perfil pode ver: o RT só as graves e as de suspeita de violência (matriz 1.2). */
  visibleTo(role: Role): Complaint[] {
    const all = this.db.complaints.all();
    if (role === 'technical_lead') {
      return all.filter((c) => c.severity === 'grave' || c.suspectedElderAbuse);
    }
    return role === 'partner' || role === 'support' ? [...all] : [];
  }

  private nextProtocol(): string {
    const max = this.db.complaints
      .all()
      .reduce((m, c) => Math.max(m, Number(/(\d+)$/.exec(c.protocol)?.[1] ?? 0)), 0);
    return `REC-${String(max + 1).padStart(4, '0')}`;
  }

  private addEvent(id: ID, text: string): Complaint {
    const current = this.db.complaints.require(id);
    return this.db.complaints.update(id, {
      events: [...current.events, { at: this.clock.now(), byUserId: this.userId(), text }],
    });
  }

  open(input: NewComplaintInput): Complaint {
    const now = this.clock.now();
    const complaint = this.db.complaints.create({
      protocol: this.nextProtocol(),
      channel: input.channel,
      ...(input.caregiverId ? { caregiverId: input.caregiverId } : {}),
      target: {
        type: input.targetType,
        ...(input.targetType === 'provider' && input.providerId
          ? { providerId: input.providerId }
          : {}),
      },
      description: input.description.trim(),
      severity: 'normal',
      suspectedElderAbuse: false,
      status: 'open',
      openedAt: now,
      dueAt: complaintDueAt(now),
      events: [
        { at: now, byUserId: this.userId(), text: 'Reclamação registrada. Prazo de resposta de 5 dias úteis.' },
      ],
    });
    this.audit.write('create', 'complaint', complaint.id, input.caregiverId);
    return complaint;
  }

  startAnalysis(id: ID): Complaint {
    const updated = this.db.complaints.update(id, { status: 'in_progress' });
    this.audit.write('update', 'complaint', id, updated.caregiverId, 'em análise');
    return this.addEvent(id, 'Reclamação em análise.');
  }

  /** Responde ao titular: registra o texto na linha do tempo e passa a "Respondida". */
  respond(id: ID, text: string): Complaint {
    this.db.complaints.update(id, { status: 'answered' });
    const updated = this.addEvent(id, `Resposta enviada: ${text.trim()}`);
    this.audit.write('update', 'complaint', id, updated.caregiverId, 'resposta registrada');
    return updated;
  }

  close(id: ID, note: string): Complaint {
    this.db.complaints.update(id, { status: 'closed' });
    const updated = this.addEvent(id, `Reclamação encerrada. ${note.trim()}`.trim());
    this.audit.write('update', 'complaint', id, updated.caregiverId, 'encerrada');
    return updated;
  }

  /** Improcedente: o motivo é obrigatório (M11, estados). */
  dismiss(id: ID, reason: string): Complaint {
    this.db.complaints.update(id, { status: 'dismissed' });
    const updated = this.addEvent(id, `Reclamação considerada improcedente. Motivo: ${reason.trim()}`);
    this.audit.write('update', 'complaint', id, updated.caregiverId, 'improcedente');
    return updated;
  }

  /**
   * Classifica como grave (RN-ARP-09): exige categoria e prestador. A reclamação passa a contar na ARP do
   * prestador e, se ele chegar a três graves, é suspenso na hora com a avaliação interna aberta.
   */
  classifyGrave(id: ID, category: GraveCategory, providerId: ID): GraveOutcome {
    const current = this.db.complaints.require(id);
    this.db.complaints.update(id, {
      severity: 'grave',
      graveCategory: category,
      target: { type: 'provider', providerId },
    });
    const labels: Record<GraveCategory, string> = {
      unjustified_absence: 'falta sem justificativa',
      confidentiality_breach: 'quebra de sigilo',
      other: 'outra situação grave',
    };
    const complaint = this.addEvent(id, `Classificada como grave (${labels[category]}).`);
    this.audit.write('update', 'complaint', id, current.caregiverId, 'classificada como grave');
    const reevaluation = this.network.reevaluate(providerId);
    return {
      complaint,
      reevaluation,
      graveCount: this.network.summaryOf(providerId)?.graveCount ?? 0,
    };
  }

  /** Suspeita de violência ou negligência: abre a ocorrência POP-07 restrita (RN-POP-07, RN-ENC-11). */
  flagElderAbuse(id: ID, caregiverId?: ID): Occurrence {
    const complaint = this.db.complaints.require(id);
    const cgId = caregiverId ?? complaint.caregiverId;
    if (!cgId) {
      throw new Error('Escolha o cuidador envolvido para abrir a ocorrência.');
    }
    if (complaint.occurrenceId) {
      return this.db.occurrences.require(complaint.occurrenceId);
    }
    const caregiver = this.db.caregivers.require(cgId);
    const now = this.clock.now();
    const restricted = new Set<ID>(
      this.db.users.all().filter((u) => u.role === 'technical_lead').map((u) => u.id),
    );
    const psychologist = caregiver.assignedPsychologistId
      ? this.db.psychologists.get(caregiver.assignedPsychologistId)
      : undefined;
    if (psychologist) {
      restricted.add(psychologist.userId);
    }
    const elder = this.db.elders.find((e) => e.caregiverId === cgId);
    const occurrence = this.db.occurrences.create({
      kind: 'pop07_violence_suspicion',
      caregiverId: cgId,
      ...(elder ? { elderId: elder.id } : {}),
      openedAt: now,
      status: 'open',
      restrictedToUserIds: [...restricted],
      steps: POP07_STEPS.map((label, k) => ({
        n: k + 1,
        label,
        ...(k === 0 ? { doneAt: now, byUserId: this.userId() } : {}),
      })),
      authoritiesNotified: [],
      sourceComplaintId: id,
    });
    this.db.complaints.update(id, {
      suspectedElderAbuse: true,
      occurrenceId: occurrence.id,
      ...(complaint.caregiverId ? {} : { caregiverId: cgId }),
    });
    this.addEvent(id, 'Encaminhada ao responsável técnico (POP-07).');
    this.audit.write('create', 'occurrence', occurrence.id, cgId, 'POP-07 aberto por reclamação');
    return occurrence;
  }
}
