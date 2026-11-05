import { Injectable, computed, inject } from '@angular/core';
import { AuditLogService } from '@core/audit';
import { AuthService } from '@core/auth';
import { Clock } from '@core/clock';
import { Database } from '@core/data';
import { PilotConfig, PilotEnrollment } from '@core/models';
import { zaritSeriesByCaregiver } from '@core/rules/indicators';
import {
  PilotSummary,
  checkGoalJustification,
  pilotGoalsEditableDirectly,
  pilotMonthOf,
  summarizePilot,
} from '@core/rules/pilot';

export interface CohortRow {
  enrollment: PilotEnrollment;
  /** Só o código `CUI-0000`: a gestão e o RT não veem nome na coorte. */
  code: string;
  month: number;
}

export type GoalDraft = PilotConfig['goals'];

/**
 * Estado do Piloto (M10, SCR-M10-07). A coorte só traz cuidadores com TCLE ativo (RN-PIL-10); os indicadores
 * vêm da regra pura `summarizePilot`, sempre agregados com mínimo de 5. Metas: editáveis antes do início;
 * depois, travadas e só mudam com justificativa registrada (RN-PIL-09, AC-M10-14).
 */
@Injectable({ providedIn: 'root' })
export class PilotStore {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly auth = inject(AuthService);
  private readonly audit = inject(AuditLogService);

  readonly config = this.db.pilotConfig.value;

  /** Cuidadores com o TCLE do piloto concedido e ainda na coorte. */
  readonly cohort = computed<CohortRow[]>(() => {
    const today = this.clock.today();
    const caregivers = new Map(this.db.caregivers.all().map((c) => [c.id, c] as const));
    const tcle = new Set(
      this.db.consents
        .all()
        .filter((c) => c.key === 'pilot_tcle' && c.status === 'granted')
        .map((c) => c.caregiverId),
    );
    return this.db.pilotEnrollments
      .all()
      .filter((e) => !e.exitedAt && tcle.has(e.caregiverId) && caregivers.has(e.caregiverId))
      .map((e) => ({
        enrollment: e,
        code: (caregivers.get(e.caregiverId) as { code: string }).code,
        month: pilotMonthOf(e.enrolledAt, today),
      }))
      .sort((a, b) => a.code.localeCompare(b.code, 'pt-BR', { numeric: true }));
  });

  readonly summary = computed<PilotSummary>(() => {
    const members = this.cohort();
    const ids = new Set(members.map((m) => m.enrollment.caregiverId));
    const paid = new Set(
      this.db.subscriptions
        .all()
        .filter(
          (s) =>
            ids.has(s.caregiverId) &&
            s.planId !== 'livre' &&
            (s.status === 'active' || s.status === 'cancel_scheduled'),
        )
        .map((s) => s.caregiverId),
    );
    return summarizePilot({
      enrollments: members.map((m) => m.enrollment),
      zaritSeries: zaritSeriesByCaregiver(
        this.db.zaritAssessments.all().filter((a) => ids.has(a.caregiverId)),
      ),
      usage: this.db.appUsage.all().filter((u) => ids.has(u.caregiverId)),
      paidCaregiverIds: paid,
      evaluationScores: this.db.providerEvaluations
        .all()
        .filter((e) => ids.has(e.caregiverId))
        .map((e) => e.score),
      goals: this.config().goals,
      min: this.db.settings.value().minGroupSizeForAggregates,
    });
  });

  readonly editableDirectly = computed(() => pilotGoalsEditableDirectly(this.config()));
  readonly canEdit = computed(() => this.auth.can('pilot', 'update'));
  /** Só a gestão vê a conversão e a disposição a pagar (K39). O RT vê os indicadores clínicos agregados. */
  readonly seesCommercial = computed(() => this.auth.role() === 'partner');

  /** Valida e grava as metas. Depois do início, exige a justificativa (registrada na ordem do tempo). */
  saveGoals(goals: GoalDraft, justification: string): { ok: boolean; message: string | null } {
    const config = this.config();
    const check = checkGoalJustification(config, justification);
    if (!check.ok) {
      return check;
    }
    const direct = pilotGoalsEditableDirectly(config);
    const changed =
      goals.zaritReductionPercent !== config.goals.zaritReductionPercent ||
      goals.satisfactionMin !== config.goals.satisfactionMin ||
      goals.conversionPercent !== config.goals.conversionPercent;
    if (!changed) {
      return { ok: false, message: 'Nenhuma meta mudou.' };
    }
    const userId = this.auth.user()?.id ?? '';
    this.db.pilotConfig.patch({
      goals,
      ...(direct
        ? {}
        : {
            goalChangeLog: [
              ...config.goalChangeLog,
              { at: this.clock.today(), byUserId: userId, justification: justification.trim() },
            ],
          }),
    });
    this.audit.write(
      'update',
      'pilot_goals',
      undefined,
      undefined,
      direct ? 'metas editadas antes do início' : 'metas alteradas com justificativa',
    );
    return { ok: true, message: null };
  }

  /** Inicia o piloto hoje: as metas passam a valer e ficam travadas. */
  start(): void {
    this.db.pilotConfig.patch({ startedAt: this.clock.today(), goalsLocked: true });
    this.audit.write('update', 'pilot_config', undefined, undefined, 'piloto iniciado');
  }
}
