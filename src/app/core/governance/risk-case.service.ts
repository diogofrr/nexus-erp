import { Injectable, inject } from '@angular/core';
import { AuditLogService } from '../audit/audit-log.service';
import { Clock } from '../clock/clock.service';
import { Database } from '../data/database';
import {
  ID,
  ISODateTime,
  Occurrence,
  OccurrenceStep,
  Referral,
  ReferralCategory,
} from '../models';
import { POP05_STEPS } from '../rules/pop05';

export interface OpenPop05Input {
  caregiverId: ID;
  /** Alerta vermelho da Zarit que originou a ocorrência (liga os dois registros, A-29). */
  sourceAlertId?: ID;
  /** Instante de abertura. Padrão: agora. */
  at?: ISODateTime;
}

export interface RegisterReferralInput {
  caregiverId: ID;
  category: ReferralCategory;
  destinations: readonly string[];
  byUserId: ID;
  occurrenceId?: ID;
  elderId?: ID;
  familyCommunicated?: boolean;
  outcome?: string;
}

/**
 * Casos de risco (POP-05, RN-ZRT-13 a 15, RN-ENC-01): abre a ocorrência com os 7 passos, marca cada passo com
 * hora e responsável sem o usuário redigitar (WCAG 3.3.7, A-29) e registra encaminhamentos. É a ponte entre a
 * Zarit, a sessão com risco e a Governança: tudo grava nas coleções `occurrences` e `referrals`, e as
 * telas de M13, o sino e o painel leem de lá.
 *
 * A ocorrência é restrita ao responsável técnico e ao psicólogo do caso (RN-ENC-11). Quem a encerra é o RT.
 */
@Injectable({ providedIn: 'root' })
export class RiskCaseService {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly audit = inject(AuditLogService);

  /** Abre a ocorrência POP-05 do caso. Se já existe uma aberta para o mesmo alerta, devolve a existente. */
  openPop05(input: OpenPop05Input): Occurrence {
    if (input.sourceAlertId) {
      const existing = this.db.occurrences.find(
        (o) => o.sourceAlertId === input.sourceAlertId && o.kind === 'pop05_risk',
      );
      if (existing) {
        return existing;
      }
    }
    const openedAt = input.at ?? this.clock.now();
    const occurrence = this.db.occurrences.create({
      kind: 'pop05_risk',
      caregiverId: input.caregiverId,
      openedAt,
      status: 'open',
      restrictedToUserIds: this.restrictedUsers(input.caregiverId),
      steps: POP05_STEPS.map((label, i): OccurrenceStep => ({ n: i + 1, label })),
      authoritiesNotified: [],
      ...(input.sourceAlertId ? { sourceAlertId: input.sourceAlertId } : {}),
    });
    this.audit.write('create', 'occurrence', occurrence.id, input.caregiverId, 'ocorrência POP-05 aberta');
    return occurrence;
  }

  /**
   * Marca um passo como feito, com hora e responsável. Passo já feito não é sobrescrito (só ganha a nota,
   * se vier uma). Ocorrência encerrada não é reaberta. Devolve a ocorrência atualizada.
   */
  stepDone(
    occurrenceId: ID,
    n: number,
    done: { byUserId: ID; at?: ISODateTime; note?: string },
  ): Occurrence | undefined {
    const occurrence = this.db.occurrences.get(occurrenceId);
    if (!occurrence || occurrence.status === 'closed') {
      return occurrence;
    }
    const at = done.at ?? this.clock.now();
    const steps = occurrence.steps.map((step) => {
      if (step.n !== n) {
        return step;
      }
      if (step.doneAt) {
        return done.note ? { ...step, note: done.note } : step;
      }
      return { ...step, doneAt: at, byUserId: done.byUserId, ...(done.note ? { note: done.note } : {}) };
    });
    return this.db.occurrences.update(occurrenceId, { steps, status: 'in_progress' });
  }

  /** Registra o encaminhamento (Quadro 12) e o liga à ocorrência, quando houver. */
  registerReferral(input: RegisterReferralInput): Referral {
    const referral = this.db.referrals.create({
      caregiverId: input.caregiverId,
      category: input.category,
      destinations: [...input.destinations],
      at: this.clock.today(),
      byUserId: input.byUserId,
      status: 'registered',
      ...(input.elderId ? { elderId: input.elderId } : {}),
      ...(input.familyCommunicated !== undefined
        ? { familyCommunicated: input.familyCommunicated }
        : {}),
      ...(input.outcome ? { outcome: input.outcome } : {}),
      ...(input.occurrenceId ? { occurrenceId: input.occurrenceId } : {}),
    });
    this.audit.write('create', 'referral', referral.id, input.caregiverId, 'encaminhamento registrado');
    return referral;
  }

  /** O responsável técnico e o psicólogo do caso (RN-ENC-11). */
  private restrictedUsers(caregiverId: ID): ID[] {
    const ids = new Set<ID>();
    this.db.users
      .query((u) => u.role === 'technical_lead' && u.active)
      .forEach((u) => ids.add(u.id));
    const caregiver = this.db.caregivers.get(caregiverId);
    const psychologist = caregiver?.assignedPsychologistId
      ? this.db.psychologists.get(caregiver.assignedPsychologistId)
      : undefined;
    if (psychologist) {
      ids.add(psychologist.userId);
    }
    return [...ids];
  }
}
