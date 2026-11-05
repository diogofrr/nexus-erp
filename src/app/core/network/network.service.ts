import { Injectable, inject } from '@angular/core';
import { AuditLogService } from '../audit/audit-log.service';
import { AuthService } from '../auth/auth.service';
import { Clock } from '../clock/clock.service';
import { Database } from '../data/database';
import { ID, InternalReview, ProviderStatus } from '../models';
import { ProviderSummary, buildProviderSummary } from './provider-metrics';

/** Resultado de `reevaluate`: o prestador foi suspenso agora? */
export interface ReevaluationOutcome {
  suspended: boolean;
  reviewId?: ID;
  /** Frase pronta para o toast. */
  message: string;
}

/**
 * Leitura e efeitos compartilhados da rede credenciada (M08 e M11). Os resumos são calculados na hora a
 * partir dos repositórios: chame dentro de `computed()` ou do template e eles reagem sozinhos.
 *
 * - `summaryOf` e `summaries`: nota, faixa, graves, taxa de recusa, disponibilidade e documentos.
 * - `reevaluate`: aplica a regra "faixa de descredenciamento suspende na hora e abre a avaliação interna"
 *   (RN-ARP-10). A reclamação grave classificada em M11 chama aqui, e a 3ª grave aciona a suspensão.
 * - `changeStatus`: troca o estado do prestador e grava o histórico (`ProviderStatusEvent`).
 */
@Injectable({ providedIn: 'root' })
export class NetworkService {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly auth = inject(AuthService);
  private readonly audit = inject(AuditLogService);

  summaryOf(providerId: ID): ProviderSummary | undefined {
    const provider = this.db.providers.get(providerId);
    if (!provider) {
      return undefined;
    }
    const settings = this.db.settings.get();
    return buildProviderSummary({
      provider,
      evaluations: this.db.providerEvaluations.all(),
      complaints: this.db.complaints.all(),
      requests: this.db.serviceRequests.all(),
      snapshots: this.db.arpSnapshots.all(),
      reviews: this.db.internalReviews.all(),
      documents: this.db.providerDocuments.all(),
      today: this.clock.today(),
      now: this.clock.now(),
      refusalThresholdPercent: settings.refusalRateThresholdPercent,
      refusalMinRequests: settings.refusalRateMinRequests,
    });
  }

  summaries(): ProviderSummary[] {
    return this.db.providers
      .all()
      .map((p) => this.summaryOf(p.id))
      .filter((s): s is ProviderSummary => s !== undefined);
  }

  /** Quem está agindo (para o histórico). Sem sessão, "sistema". */
  actorId(): ID {
    return this.auth.user()?.id ?? 'system';
  }

  /** Troca o estado do prestador e registra o evento. Não faz nada se o estado já é o pedido. */
  changeStatus(providerId: ID, to: ProviderStatus, reason: string): void {
    const provider = this.db.providers.require(providerId);
    if (provider.status === to) {
      return;
    }
    this.db.providers.update(providerId, {
      status: to,
      highlight: to === 'active' ? provider.highlight : false,
    });
    this.db.providerStatusEvents.create({
      providerId,
      from: provider.status,
      to,
      reason,
      byUserId: this.actorId(),
    });
    this.audit.write('update', 'provider', providerId, undefined, `estado: ${to}`);
  }

  /** Abre a avaliação interna do prestador (uma só aberta por vez). */
  openInternalReview(providerId: ID, trigger: InternalReview['trigger']): InternalReview {
    const existing = this.db.internalReviews.find(
      (r) => r.providerId === providerId && r.decision === undefined,
    );
    if (existing) {
      return existing;
    }
    const review = this.db.internalReviews.create({
      providerId,
      openedAt: this.clock.today(),
      trigger,
    });
    this.audit.write('create', 'internal_review', review.id);
    return review;
  }

  /**
   * RN-ARP-10: entrar na faixa de descredenciamento (média abaixo de 4,0 ou 3 reclamações graves, mesmo sem
   * média) suspende o prestador na hora e abre a avaliação interna. Só age em prestador ativo ou em
   * monitoramento; quem já está suspenso ou fora da rede não muda.
   */
  reevaluate(providerId: ID): ReevaluationOutcome {
    const summary = this.summaryOf(providerId);
    if (!summary) {
      return { suspended: false, message: 'Prestador não encontrado.' };
    }
    const { provider } = summary;
    const inOperation = provider.status === 'active' || provider.status === 'monitoring';
    if (!inOperation || summary.band !== 'deaccreditation' || summary.trigger === null) {
      return { suspended: false, message: `${provider.name} segue na busca.` };
    }
    const reason =
      summary.trigger === 'grave_complaints'
        ? 'Três reclamações graves registradas'
        : 'Média abaixo de 4,0';
    this.changeStatus(providerId, 'suspended', reason);
    const review = this.openInternalReview(providerId, summary.trigger);
    return {
      suspended: true,
      reviewId: review.id,
      message: `${provider.name} saiu da busca e a avaliação interna foi aberta.`,
    };
  }
}
