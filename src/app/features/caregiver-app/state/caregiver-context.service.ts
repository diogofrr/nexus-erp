import { Injectable, computed, inject } from '@angular/core';
import { CaregiverSessionService } from '../../../core/auth/caregiver-session.service';
import { Clock } from '../../../core/clock/clock.service';
import { ScheduledChange, SubscriptionService, scheduledChangeOf } from '../../../core/commerce/subscription.service';
import { Database } from '../../../core/data/database';
import {
  Caregiver,
  Channel,
  Consent,
  ConsentKey,
  ConsentStatus,
  Elder,
  ID,
  ISODate,
  Plan,
  PlanId,
  Subscription,
  YearMonth,
} from '../../../core/models';
import { ConsentService } from '../../../core/privacy/consent.service';
import { DEFAULT_PLANS } from '../../../core/rules/plans';
import { isConsentActive } from '../../../core/rules/lgpd';
import { StaffContactState, staffContactState } from '../../../core/rules/staff-contact';
import {
  CaregiverFeature,
  FeatureAccess,
  canUseFeature,
  featureAccess,
  planShortName,
} from '../../../core/rules/plan-features';
import {
  QuotaUsage,
  groupTherapyQuota,
  individualSessionQuota,
  monthOf,
  trainingQuota,
} from '../../../core/rules/plan-quotas';
import { FontScale, FontScaleService } from './font-scale.service';
import { firstNameOf } from './people-format';

/** Tamanho da linha de remédio: grande para quem tem pouca familiaridade digital (UX C6, "por pessoa"). */
export type DoseRowSize = 'default' | 'large';

export interface CaregiverConsentView {
  key: ConsentKey;
  status: ConsentStatus;
  version: string | null;
  consent?: Consent;
}

/** As cotas do mês de hoje (docs/20): o que o plano dá, o que já foi usado e o que resta. */
export interface CaregiverQuotas {
  /** O mês de hoje, `YYYY-MM`, pelo `Clock`. */
  month: YearMonth;
  /** Sessões de atendimento individual (Cuida 2, Sustenta 4). */
  individualSessions: QuotaUsage;
  /** Encontros de terapia de grupo (Cuida e Sustenta, 2). */
  groupTherapy: QuotaUsage;
  /** Encontros de capacitação incluídos (Essencial 2; Cuida e Sustenta todos). */
  trainings: QuotaUsage;
}

/**
 * O cuidador atual e tudo o que as telas do aplicativo precisam saber dele, em signals: o cadastro, a pessoa
 * idosa, a assinatura e o plano, os consentimentos, o canal preferido, o tamanho da letra e "hoje" (do `Clock`).
 * É a porta única das telas para o que é "meu": ninguém mais lê a sessão nem procura o cuidador no banco.
 *
 * - Fora de uma sessão de cuidador (cadastro de quem é novo, Ajuda agora) os signals valem `null` e o plano vale
 *   `livre`; dentro do shell com sessão, `caregiver()` nunca é `null`.
 * - **Acesso por plano** (docs/20): `canUse('group_therapy')`, `canUse('individual_session')`, `canUse('training_included')`,
 *   `canUse('card')`... usam `core/rules/plan-features.ts` (que lê a tabela de cotas). `quotas()` traz a cota do mês de
 *   hoje (usada e restante). A tela não decide plano por conta própria e NÃO anuncia o que o plano não inclui fora de
 *   Meu plano (regra de exibição 1): o que a pessoa não pode usar simplesmente não aparece.
 * - O cuidador vê os próprios dados sem máscara (decisão 2 do contexto).
 * - Nada de `new Date()`: `today()` vem do `Clock` (reativo ao relógio simulado).
 *
 * ```ts
 * const ctx = inject(CaregiverContextService);
 * ctx.firstName();                    // 'Ana'
 * ctx.planName();                     // 'Cuida'
 * ctx.canUse('group_therapy');        // true no Cuida e no Sustenta
 * ctx.quotas().individualSessions;    // { limit: 2, used: 1, left: 1 } na Ana (Cuida), no mês de hoje
 * ctx.hasConsent('health_data');      // consentimento de saúde vigente?
 * ctx.today();                        // '2026-11-04'
 * ```
 */
@Injectable({ providedIn: 'root' })
export class CaregiverContextService {
  private readonly db = inject(Database);
  private readonly session = inject(CaregiverSessionService);
  private readonly subscriptions = inject(SubscriptionService);
  private readonly consentService = inject(ConsentService);
  private readonly clock = inject(Clock);
  private readonly fontScaleService = inject(FontScaleService);

  // ===== Quem sou eu =====

  readonly isSignedIn = this.session.isSignedIn;
  readonly caregiverId = this.session.caregiverId;
  /** O cadastro do cuidador (`null` fora de uma sessão de cuidador). */
  readonly caregiver = this.session.caregiver;
  /** Primeiro nome, para a saudação ("Bom dia, Ana"). */
  readonly firstName = computed(() => {
    const caregiver = this.caregiver();
    return caregiver ? firstNameOf(caregiver.fullName) : '';
  });
  /** Pouca familiaridade digital (UX "por pessoa": canais simples, linha de remédio maior). */
  readonly lowDigitalLiteracy = computed(() => this.caregiver()?.digitalLiteracy === 'low');
  /** A linha de remédio ("Dei") fica maior para quem tem pouca familiaridade digital (UX C6, o João). */
  readonly doseSize = computed<DoseRowSize>(() => (this.lowDigitalLiteracy() ? 'large' : 'default'));
  /** Canal que a pessoa prefere (RN-CAN-01, RN-USR-18). Sem sessão, o aplicativo. */
  readonly preferredChannel = computed<Channel>(() => this.caregiver()?.preferredChannel ?? 'app');

  // ===== A pessoa idosa =====

  readonly elder = computed<Elder | null>(() => {
    const id = this.caregiverId();
    return id ? (this.db.elders.find((e) => e.caregiverId === id) ?? null) : null;
  });
  readonly elderId = computed<ID | null>(() => this.elder()?.id ?? null);

  // ===== Assinatura e plano =====

  /** A assinatura vigente (a não cancelada mais recente; senão a mais recente). */
  readonly subscription = computed<Subscription | null>(() => {
    const id = this.caregiverId();
    return id ? (this.subscriptions.current(id) ?? null) : null;
  });
  /** O plano em vigor. Troca e cancelamento agendados só valem no fim do ciclo (RN-PLN-14). Sem assinatura, Livre. */
  readonly planId = computed<PlanId>(() => {
    const id = this.caregiverId();
    return id ? this.subscriptions.planOf(id) : 'livre';
  });
  /** Quadro de planos (editável em M15). Se estiver vazio, o catálogo padrão. */
  readonly plans = computed(() => {
    const stored = this.db.plans.list();
    return stored.length > 0 ? stored : DEFAULT_PLANS;
  });
  readonly plan = computed<Plan | null>(() => this.db.plans.get(this.planId()) ?? null);
  /** "Cuida", "Essencial"... */
  readonly planName = computed(() => planShortName(this.planId(), this.plans()));
  /** Troca ou cancelamento já pedido e ainda não valendo, com a frase pronta. */
  readonly scheduledChange = computed<ScheduledChange | null>(() => {
    const subscription = this.subscription();
    return subscription ? scheduledChangeOf(subscription) : null;
  });

  // ===== Consentimentos =====

  /** Os 6 consentimentos, na ordem canônica; o que nunca foi respondido vem como `pending`. */
  readonly consents = computed<readonly CaregiverConsentView[]>(() => {
    const id = this.caregiverId();
    return id ? this.consentService.list(id) : [];
  });

  consentStatus(key: ConsentKey): ConsentStatus {
    return this.consents().find((c) => c.key === key)?.status ?? 'pending';
  }

  /** O consentimento está vigente (concedido e não revogado)? */
  hasConsent(key: ConsentKey): boolean {
    return isConsentActive(this.consentStatus(key));
  }

  /** Consentimento de saúde vigente: sem ele não há Zarit nem acompanhamento (RN-LGPD-14, RN-ZRT-26). */
  readonly healthConsent = computed(() => this.hasConsent('health_data'));

  /**
   * O que a equipe de psicologia fez por você, em três valores e NADA mais (RN-ZRT-19, RN-PLN-19): `today` (a equipe
   * vai falar com você hoje), `not_yet` (a equipe ainda não conseguiu) e `none`. É o único jeito de Hoje e Como estou
   * saberem do contato: nenhuma tela lê pontuação, faixa ou alerta. Sem o consentimento de saúde vale `none`.
   */
  readonly staffContact = computed<StaffContactState>(() => {
    const id = this.caregiverId();
    if (!id) {
      return 'none';
    }
    return staffContactState(
      this.db.zaritAlerts.query((a) => a.caregiverId === id),
      this.clock.now(),
      this.healthConsent(),
    );
  });

  // ===== Acesso por plano =====

  /** O plano libera o recurso? Use no `@if` que mostra ou esconde o bloco (sem cadeado, docs/20). */
  canUse(feature: CaregiverFeature): boolean {
    return canUseFeature(this.planId(), feature, this.plans());
  }

  /** Acesso com o menor plano (`reason` existe só por compatibilidade: não mostre em tela). */
  access(feature: CaregiverFeature): FeatureAccess {
    return featureAccess(this.planId(), feature, this.plans());
  }

  /** As cotas do mês de hoje (docs/20), reativas ao relógio e ao banco. Fora de uma sessão, as do Livre (tudo zero). */
  readonly quotas = computed<CaregiverQuotas>(() => {
    const id = this.caregiverId();
    const planId = this.planId();
    const month = monthOf(this.clock.today());
    const sessions = id ? this.db.careSessions.query((s) => s.caregiverId === id) : [];
    const enrollments = id ? this.db.activityEnrollments.query((e) => e.caregiverId === id) : [];
    const activities = this.db.activities.all();
    return {
      month,
      individualSessions: individualSessionQuota(planId, month, sessions),
      groupTherapy: groupTherapyQuota(planId, month, enrollments, activities),
      trainings: trainingQuota(planId, month, enrollments, activities),
    };
  });

  // ===== Letra e tempo =====

  readonly fontScale = this.fontScaleService.scale;

  setFontScale(scale: FontScale): void {
    this.fontScaleService.set(scale);
  }

  /** Hoje (D0), do `Clock`: real ou simulado. Reativo. */
  readonly today = computed<ISODate>(() => this.clock.today());

  /** O id do cuidador, para ações que só existem com sessão. Sem sessão, falha (a tela está atrás do `caregiverGuard`). */
  requireCaregiverId(): ID {
    const id = this.caregiverId();
    if (!id) {
      throw new Error('Esta ação precisa de uma sessão de cuidador.');
    }
    return id;
  }

  requireCaregiver(): Caregiver {
    const caregiver = this.caregiver();
    if (!caregiver) {
      throw new Error('Esta ação precisa de uma sessão de cuidador.');
    }
    return caregiver;
  }
}
