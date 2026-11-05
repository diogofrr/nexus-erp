import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from '@core/auth';
import { Clock } from '@core/clock';
import { Database } from '@core/data';
import { formatDate } from '@core/format';
import type { CaregiverStatus, ID, ISODate, PlanId, Subscription } from '@core/models';
import { canSeeCaregiverIdentity } from '@core/privacy/caregiver-label';
import { maskPhone } from '@core/privacy';
import { zaritStatusForSupport } from '@core/rules';

/** O que o perfil sabe da escala (E-05): só se falta aplicar ou está em dia, nunca o resultado. */
export interface ScaleStatus {
  kind: 'no_consent' | 'pending' | 'up_to_date' | 'none';
  label: string;
  due?: ISODate;
}

/** Uma linha da lista de cuidadores, já recortada para o perfil (a gestão não recebe nome nem contato). */
export interface CaregiverRow {
  id: ID;
  code: string;
  /** `null` para quem só vê o código. */
  name: string | null;
  /** Telefone MASCARADO, só para quem vê dados identificados. */
  phone: string;
  city: string;
  planId: PlanId;
  status: CaregiverStatus;
  isPilot: boolean;
  enrolledAt: ISODate;
  psychologistId: ID | null;
  psychologistName: string | null;
  scale: ScaleStatus;
}

const SCALE_ORDER: Record<ScaleStatus['kind'], number> = { pending: 0, none: 1, no_consent: 2, up_to_date: 3 };

export function scaleSortValue(scale: ScaleStatus): number {
  return SCALE_ORDER[scale.kind];
}

/**
 * Leitura da lista de cuidadores (M03-01) para o perfil logado: o psicólogo só recebe os cuidadores dele,
 * a gestão recebe só código, plano, status e piloto, o atendimento e o responsável técnico recebem nome e
 * telefone mascarado. A escala aparece só como "pendente" ou "em dia" (E-05).
 */
@Injectable({ providedIn: 'root' })
export class CaregiverDirectory {
  private readonly db = inject(Database);
  private readonly auth = inject(AuthService);
  private readonly clock = inject(Clock);

  /** Todos os cuidadores que o perfil pode listar. */
  readonly rows = computed<CaregiverRow[]>(() => {
    const role = this.auth.role();
    const actor = this.auth.actor();
    const identified = canSeeCaregiverIdentity(role);
    const today = this.clock.today();
    const plans = this.planByCaregiver();
    const health = new Map<ID, string>();
    this.db.consents.all().forEach((c) => {
      if (c.key === 'health_data') {
        health.set(c.caregiverId, c.status);
      }
    });
    const scheduled = new Map<ID, ISODate>();
    const completed = new Set<ID>();
    this.db.zaritAssessments.all().forEach((a) => {
      if (a.status === 'completed') {
        completed.add(a.caregiverId);
      } else {
        const known = scheduled.get(a.caregiverId);
        if (!known || a.dueDate < known) {
          scheduled.set(a.caregiverId, a.dueDate);
        }
      }
    });
    const psychologists = new Map(this.db.psychologists.all().map((p) => [p.id, p.displayName] as const));
    return this.db.caregivers
      .all()
      .filter((c) => role !== 'psychologist' || (!!actor?.psychologistId && c.assignedPsychologistId === actor.psychologistId))
      .map((c) => {
        let scale: ScaleStatus;
        const due = scheduled.get(c.id);
        if (health.get(c.id) !== 'granted') {
          scale = { kind: 'no_consent', label: 'Sem consentimento de saúde' };
        } else if (due) {
          const status = zaritStatusForSupport(due, today);
          scale =
            status.status === 'pending'
              ? { kind: 'pending', label: 'Aplicação pendente', due }
              : { kind: 'up_to_date', label: `Em dia, próxima em ${formatDate(due)}`, due };
        } else if (!completed.has(c.id)) {
          scale = { kind: 'pending', label: 'Aplicação pendente (adesão)' };
        } else {
          scale = { kind: 'none', label: 'Sem aplicação agendada' };
        }
        return {
          id: c.id,
          code: c.code,
          name: identified ? c.fullName : null,
          phone: identified ? maskPhone(c.phone) : '',
          city: identified ? c.city : '',
          planId: plans.get(c.id) ?? 'livre',
          status: c.status,
          isPilot: c.isPilot,
          enrolledAt: c.enrolledAt,
          psychologistId: c.assignedPsychologistId ?? null,
          psychologistName: c.assignedPsychologistId ? (psychologists.get(c.assignedPsychologistId) ?? null) : null,
          scale,
        };
      });
  });

  /** Psicólogos da Nexus com CRP ativo (para atribuir casos). */
  readonly psychologists = computed(() => this.db.psychologists.all().filter((p) => p.crpStatus === 'active'));

  /** Plano vigente de cada cuidador (a assinatura não cancelada mais recente). */
  private planByCaregiver(): Map<ID, PlanId> {
    const best = new Map<ID, Subscription>();
    this.db.subscriptions.all().forEach((s) => {
      const known = best.get(s.caregiverId);
      const better =
        !known ||
        (known.status === 'cancelled' && s.status !== 'cancelled') ||
        (known.status === 'cancelled') === (s.status === 'cancelled') && s.createdAt > known.createdAt;
      if (better) {
        best.set(s.caregiverId, s);
      }
    });
    return new Map([...best].map(([id, s]) => [id, s.status === 'cancelled' ? 'livre' : s.planId] as const));
  }
}
