import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Database } from '../data/database';
import { configureCoreTest } from '../testing/test-helpers';
import { SubscriptionService } from './subscription.service';

/**
 * Quem trocou o plano (decisão do líder para o aplicativo do cuidador): sem sessão da equipe o histórico gravava
 * `system`; agora o cuidador pode passar o próprio id. Sem o parâmetro, nada muda para a equipe.
 */
describe('SubscriptionService: autor da troca de plano', () => {
  let db: Database;
  let service: SubscriptionService;

  beforeEach(() => {
    ({ db } = configureCoreTest({ seed: true, today: '2026-11-04', time: '12:00' }));
    service = TestBed.inject(SubscriptionService);
  });

  const subOf = (caregiverId: string) => db.subscriptions.find((s) => s.caregiverId === caregiverId)!;
  const lastChange = (subscriptionId: string) => service.historyOf(subscriptionId)[0];

  it('sem sessão da equipe e sem autor, o histórico grava "system" (comportamento de antes)', () => {
    const sub = subOf('cg_0003');
    service.changePlan(sub.id, 'essencial');
    expect(lastChange(sub.id)?.byUserId).toBe('system');
  });

  it('com o id do cuidador, a troca fica registrada em nome dele (subir, descer, cancelar e manter)', () => {
    const livre = subOf('cg_0003');
    service.changePlan(livre.id, 'cuida', 'cg_0003');
    expect(lastChange(livre.id)).toMatchObject({ kind: 'upgrade', byUserId: 'cg_0003' });

    service.changePlan(livre.id, 'essencial', 'cg_0003');
    expect(lastChange(livre.id)).toMatchObject({ kind: 'downgrade', byUserId: 'cg_0003' });

    service.keepPlan(livre.id, 'cg_0003');
    expect(lastChange(livre.id)).toMatchObject({ kind: 'reactivate', byUserId: 'cg_0003' });

    service.changePlan(livre.id, 'livre', 'cg_0003');
    expect(lastChange(livre.id)).toMatchObject({ kind: 'cancel', byUserId: 'cg_0003' });
  });

  it('o autor também vale na assinatura de um cadastro novo', () => {
    const created = service.startSubscription('cg_0002', 'essencial', 'cg_0002');
    expect(lastChange(created.id)).toMatchObject({ kind: 'upgrade', byUserId: 'cg_0002' });
  });
});
