/**
 * Plano atual de um cuidador, lido das assinaturas (uma ativa por vez, RN-PLN-14). É O ÚNICO cálculo do plano vigente:
 * o `SubscriptionService` (o que a tela mostra) e quem precisa do plano sem depender do módulo de assinaturas (valor da
 * sessão, RN-ATD-05; vagas prioritárias, RN-ATD-12; acesso a grupos, RN-GRP-02) usam estas duas funções, para duas telas
 * nunca dizerem planos diferentes (QAC-003). Cuidador sem assinatura, ou com a única assinatura cancelada, é Livre.
 */
import { ID, PlanId, Subscription } from '../models';
import { Database } from './database';

/** A assinatura vigente: a não cancelada mais recente; sem nenhuma viva, a mais recente (para a equipe ver o histórico). */
export function currentSubscriptionOf(db: Database, caregiverId: ID): Subscription | undefined {
  const all = db.subscriptions.query((s) => s.caregiverId === caregiverId);
  const live = all.filter((s) => s.status !== 'cancelled');
  const pool = live.length > 0 ? live : all;
  return [...pool].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

/** O plano que vale hoje: o da assinatura vigente, ou Livre quando não há assinatura viva (cancelada não dá plano). */
export function planIdOfCaregiver(db: Database, caregiverId: ID): PlanId {
  const current = currentSubscriptionOf(db, caregiverId);
  return current && current.status !== 'cancelled' ? current.planId : 'livre';
}
