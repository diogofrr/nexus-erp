/**
 * Plano atual de um cuidador, lido das assinaturas (uma ativa por vez, RN-PLN-14). Usado por quem precisa do
 * plano sem depender do módulo de assinaturas: valor da sessão (RN-ATD-05), vagas prioritárias (RN-ATD-12) e
 * acesso a grupos (RN-GRP-02). Cuidador sem assinatura é Livre.
 */
import { ID, PlanId } from '../models';
import { Database } from './database';

export function planIdOfCaregiver(db: Database, caregiverId: ID): PlanId {
  const subscriptions = db.subscriptions.query((s) => s.caregiverId === caregiverId);
  const current =
    subscriptions.find((s) => s.status === 'active' || s.status === 'cancel_scheduled') ??
    subscriptions.at(-1);
  return current?.planId ?? 'livre';
}
