/**
 * Pedido de atribuição de psicólogo (CX-041): o atendimento cria o cadastro, mas só o responsável técnico atribui
 * o psicólogo. O botão "Pedir atribuição de psicólogo" grava um aviso para cada responsável técnico (mesmo padrão
 * do "pedir contato agora", CX-019): a pendência aparece no sino dele e some sozinha quando o psicólogo é atribuído.
 * O texto descreve a tarefa, nunca dado clínico.
 */
import { Injectable, inject } from '@angular/core';
import { AuditLogService } from '../audit/audit-log.service';
import { Clock } from '../clock/clock.service';
import { Database } from '../data/database';
import type { ID } from '../models';
import type { NotificationDraft, RuleContext } from './notification-rules';

export const ASSIGNMENT_REQUEST_PREFIX = 'assign_psychologist:';

/** Avisos pendentes do usuário atual (o responsável técnico) para a lista do sino. */
export function assignmentRequestDrafts(ctx: RuleContext): NotificationDraft[] {
  const { db, actor } = ctx;
  return db.notifications
    .query(
      (n) =>
        n.userId === actor.userId && n.kind.startsWith(ASSIGNMENT_REQUEST_PREFIX) && n.status !== 'resolved',
    )
    .flatMap((request): NotificationDraft[] => {
      const caregiver = db.caregivers.get(request.kind.slice(ASSIGNMENT_REQUEST_PREFIX.length));
      if (!caregiver || caregiver.assignedPsychologistId || caregiver.status === 'closed') {
        return [];
      }
      return [
        {
          key: request.kind,
          type: 'assign_psychologist',
          group: 'action_today',
          severity: 'attention',
          icon: 'user-check',
          title: 'Atribuir psicólogo a um cadastro novo',
          context: caregiver.fullName,
          link: `/app/cuidadores/${caregiver.id}`,
          at: request.at,
          count: 1,
          showAge: true,
        },
      ];
    });
}

export type AssignmentRequestResult = { ok: true; notified: number; alreadyAsked: boolean } | { ok: false; reason: string };

@Injectable({ providedIn: 'root' })
export class AssignmentRequestService {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly audit = inject(AuditLogService);

  /** O cadastro já tem um pedido aberto para o responsável técnico? */
  isRequested(caregiverId: ID): boolean {
    this.db.notifications.all();
    return this.db.notifications.count(
      (n) => n.kind === `${ASSIGNMENT_REQUEST_PREFIX}${caregiverId}` && n.status !== 'resolved',
    ) > 0;
  }

  /** Avisa o(s) responsável(is) técnico(s). Sem repetir: pedir de novo só confirma que o aviso já foi. */
  request(caregiverId: ID): AssignmentRequestResult {
    const caregiver = this.db.caregivers.get(caregiverId);
    if (!caregiver) {
      return { ok: false, reason: 'Cadastro não encontrado.' };
    }
    if (caregiver.assignedPsychologistId) {
      return { ok: false, reason: 'Este cadastro já tem psicólogo responsável.' };
    }
    const kind = `${ASSIGNMENT_REQUEST_PREFIX}${caregiverId}`;
    if (this.isRequested(caregiverId)) {
      return { ok: true, notified: 0, alreadyAsked: true };
    }
    const leads = this.db.users.query((u) => u.role === 'technical_lead' && u.active);
    if (leads.length === 0) {
      return { ok: false, reason: 'Não há responsável técnico ativo para receber o pedido.' };
    }
    const at = this.clock.now();
    leads.forEach((lead) =>
      this.db.notifications.create({
        role: 'technical_lead',
        userId: lead.id,
        kind,
        title: 'Atribuir psicólogo a um cadastro novo',
        status: 'unread',
        link: `/app/cuidadores/${caregiverId}`,
        at,
      }),
    );
    this.audit.write('create', 'psychologist_assignment_request', caregiverId, caregiverId, 'pedido de atribuição de psicólogo');
    return { ok: true, notified: leads.length, alreadyAsked: false };
  }
}
