import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Clock } from '../clock/clock.service';
import { addMonths } from '../clock/date-utils';
import { Database } from '../data/database';
import { currentSubscriptionOf, planIdOfCaregiver } from '../data/plan-lookup';
import { GroupMembershipService } from '../groups/group-membership.service';
import { countSubscribers } from '../rules/kpi';
import { configureCoreTest } from '../testing/test-helpers';
import { loginAs } from '../../shared/ui/testing/dom';
import {
  SubscriptionError,
  SubscriptionService,
  scheduledChangeOf,
  subscriptionDisplay,
} from './subscription.service';

describe('SubscriptionService (RN-PLN-14, RN-CRT-02, 03, 11)', () => {
  let db: Database;
  let clock: Clock;
  let service: SubscriptionService;

  beforeEach(() => {
    const env = configureCoreTest({ seed: true, today: '2026-11-04', time: '12:00' });
    db = env.db;
    clock = env.clock;
    loginAs('u7');
    service = TestBed.inject(SubscriptionService);
  });

  const subOf = (caregiverId: string) => db.subscriptions.find((s) => s.caregiverId === caregiverId)!;

  it('o seed tem 17 assinaturas pagas: 7 Essencial, 5 Cuida (3 pagas pela empresa), 5 Sustenta (AC-M04-08)', () => {
    const counts = countSubscribers(db.subscriptions.all());
    expect(counts.total).toBe(17);
    expect(counts.byPlan).toEqual({ essencial: 7, cuida: 5, sustenta: 5 });
    expect(counts.corporate).toBe(3);
  });

  it('upgrade do Livre vale na hora e emite o Cartão Nexus (AC-M04-04)', () => {
    const sub = subOf('cg_0100');
    expect(sub.planId).toBe('livre');
    expect(db.benefitCards.count((c) => c.caregiverId === 'cg_0100')).toBe(0);
    const quote = service.quote(sub, 'essencial');
    expect(quote.kind).toBe('upgrade');
    expect(quote.timing).toBe('immediate');
    expect(quote.effect).toContain('Vale hoje');
    expect(quote.effect).toContain('O Cartão Nexus é emitido agora');
    expect(quote.actionLabel).toBe('Fazer upgrade para o Essencial');
    const result = service.changePlan(sub.id, 'essencial');
    expect(result.subscription.planId).toBe('essencial');
    expect(result.subscription.status).toBe('active');
    expect(result.card?.number).toMatch(/^NX-\d{4}-\d{4}$/);
    expect(result.message).toBe(`Plano alterado para Essencial. Cartão ${result.card?.number} emitido.`);
    expect(db.benefitCards.find((c) => c.caregiverId === 'cg_0100')?.status).toBe('active');
    expect(result.subscription.nextCycleAt).toBe(addMonths('2026-11-04', 1));
    expect(db.planChanges.find((p) => p.subscriptionId === sub.id)?.kind).toBe('upgrade');
    expect(db.accessLog.list().some((l) => l.action === 'update' && l.entity === 'subscription' && l.entityId === sub.id)).toBe(true);
  });

  it('o número do cartão novo é único', () => {
    service.changePlan(subOf('cg_0100').id, 'essencial');
    service.changePlan(subOf('cg_0101').id, 'cuida');
    const numbers = db.benefitCards.all().map((c) => c.number);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it('descer de plano agenda para o fim do ciclo com rótulo de MUDANÇA (A-18) e mantém o plano e o cartão até lá (AC-M04-05)', () => {
    const sub = subOf('cg_0008');
    expect(sub.planId).toBe('cuida');
    const quote = service.quote(sub, 'essencial');
    expect(quote.kind).toBe('downgrade');
    expect(quote.timing).toBe('end_of_cycle');
    expect(quote.effectiveAt).toBe(sub.nextCycleAt);
    expect(quote.actionLabel).toBe('Agendar mudança para o Essencial');
    expect(quote.effect).toContain('Vale no fim do ciclo');
    expect(quote.effect).toContain('inclusive a terapia de grupo');
    const result = service.changePlan(sub.id, 'essencial');
    expect(result.subscription.status).toBe('cancel_scheduled');
    expect(result.subscription.planId).toBe('cuida');
    expect(subscriptionDisplay(result.subscription)).toBe('change_scheduled');
    const label = scheduledChangeOf(result.subscription)?.label ?? '';
    expect(label.startsWith('Mudança agendada: Cuida para Essencial em ')).toBe(true);
    expect(label).not.toContain('Cancelamento');
    expect(db.benefitCards.find((c) => c.caregiverId === 'cg_0008')?.status).toBe('active');
  });

  it('"Manter o plano atual" desiste da mudança, remove o registro futuro e deixa um registro de plano mantido', () => {
    const sub = subOf('cg_0008');
    service.changePlan(sub.id, 'essencial');
    expect(db.planChanges.count((p) => p.subscriptionId === sub.id && p.effectiveAt > '2026-11-04')).toBe(1);
    const kept = service.keepPlan(sub.id);
    expect(kept.status).toBe('active');
    expect(kept.scheduledPlanId).toBeUndefined();
    expect(db.planChanges.count((p) => p.subscriptionId === sub.id && p.effectiveAt > '2026-11-04')).toBe(0);
    expect(db.planChanges.query((p) => p.subscriptionId === sub.id).some((p) => p.kind === 'reactivate')).toBe(true);
    expect(() => service.keepPlan(sub.id)).toThrow(SubscriptionError);
  });

  it('cancelar agenda o cancelamento; no fim do ciclo (relógio simulado) o plano vira Livre e o cartão fica inativo (AC-M04-06)', () => {
    const sub = subOf('cg_0007');
    expect(sub.planId).toBe('essencial');
    const result = service.changePlan(sub.id, 'livre');
    expect(result.kind).toBe('cancel');
    expect(subscriptionDisplay(result.subscription)).toBe('cancel_scheduled');
    expect(scheduledChangeOf(result.subscription)?.label).toContain('Cancelamento agendado para');
    const due = result.subscription.scheduledChangeAt as string;
    // Antes do ciclo, nada muda.
    expect(service.applyDueChanges()).toBe(0);
    expect(subOf('cg_0007').planId).toBe('essencial');
    clock.setSimulated(due, '12:00');
    expect(service.applyDueChanges()).toBeGreaterThanOrEqual(1);
    const after = subOf('cg_0007');
    expect(after.planId).toBe('livre');
    expect(after.status).toBe('active');
    expect(after.nextCycleAt).toBeUndefined();
    const card = db.benefitCards.find((c) => c.caregiverId === 'cg_0007');
    expect(card?.status).toBe('inactive');
    expect(card?.inactivatedAt).toBe(due);
  });

  it('o cancelamento agendado do seed (C26) vale no fim do ciclo e inativa o cartão', () => {
    const sub = subOf('cg_0026');
    expect(subscriptionDisplay(sub)).toBe('cancel_scheduled');
    clock.setSimulated(sub.scheduledChangeAt as string, '12:00');
    service.applyDueChanges();
    expect(subOf('cg_0026').planId).toBe('livre');
    expect(db.benefitCards.find((c) => c.caregiverId === 'cg_0026')?.status).toBe('inactive');
  });

  it('troca para o mesmo plano é bloqueada (F03)', () => {
    const sub = subOf('cg_0008');
    expect(service.quote(sub, 'cuida').timing).toBe('blocked');
    expect(() => service.changePlan(sub.id, 'cuida')).toThrow('O cuidador já está neste plano.');
  });

  it('plano pago pela empresa não troca nem cancela: a mudança é feita pelo contrato (RN-CORP)', () => {
    const sub = subOf('cg_0021');
    expect(sub.payer).toBe('corporate');
    const quote = service.quote(sub, 'essencial');
    expect(quote.timing).toBe('blocked');
    expect(quote.blockedReason).toBe('Este plano é pago pela empresa Exemplo Logística Ltda. A mudança é feita pelo contrato.');
    expect(() => service.changePlan(sub.id, 'livre')).toThrow(SubscriptionError);
  });

  it('empresa com contrato suspenso: o plano pago por ela também não muda', () => {
    db.corporateAccounts.update('corp_0001', { status: 'suspended' });
    const quote = service.quote(subOf('cg_0021'), 'sustenta');
    expect(quote.blockedReason).toContain('suspenso');
  });

  it('cadastro com encerramento pedido não troca de plano', () => {
    db.caregivers.update('cg_0100', { status: 'closure_requested' });
    expect(service.quote(subOf('cg_0100'), 'essencial').timing).toBe('blocked');
  });

  it('descer ou cancelar libera as turmas que começam depois do fim do ciclo e promove a lista de espera', () => {
    const lost = db.activityEnrollments
      .query((e) => (e.status === 'enrolled' || e.status === 'waitlist') && db.activities.get(e.activityId)?.minPlan === 'cuida')
      .flatMap((e) => (e.caregiverId ? [e.caregiverId] : []));
    expect(lost.length).toBeGreaterThan(0);
    // Pega um cuidador pago que está numa turma e agenda o cancelamento.
    const target = lost.find((id) => subOf(id).planId !== 'livre' && subOf(id).payer === 'self');
    if (!target) {
      return;
    }
    const sub = subOf(target);
    const quote = service.quote(sub, 'livre');
    service.changePlan(sub.id, 'livre');
    clock.setSimulated(quote.effectiveAt, '12:00');
    service.applyDueChanges();
    quote.lostGroups.forEach((g) => {
      const left = db.activityEnrollments.find((e) => e.caregiverId === target && e.activityId === g.activityId);
      expect(left?.status).toBe('cancelled');
    });
  });

  it('descer de plano mostra a turma que o cuidador perde (as que já começaram continuam) e promove a lista de espera (F03)', () => {
    const sub = subOf('cg_0024');
    expect(sub.planId).toBe('sustenta');
    // A turma G1 do seed já começou antes do fim do ciclo: continua (turmas em andamento seguem).
    expect(service.quote(sub, 'essencial').lostGroups).toEqual([]);
    const group = db.activities.create({
      kind: 'group_therapy',
      title: 'Grupo de teste',
      theme: 'self_care',
      character: 'guidance',
      leaders: [],
      mode: 'online',
      meetings: [{ id: 'm1', startAt: '2026-12-01T18:00:00-03:00', endAt: '2026-12-01T19:00:00-03:00', done: false }],
      capacity: 1,
      status: 'full',
      minPlan: 'cuida',
      requiresEligibility: false,
      confidentialityText: '',
    });
    const mine = db.activityEnrollments.create({ activityId: group.id, caregiverId: 'cg_0024', status: 'enrolled', attendance: [] });
    const waiting = db.activityEnrollments.create({ activityId: group.id, caregiverId: 'cg_0030', status: 'waitlist', waitlistPosition: 1, attendance: [] });
    const quote = service.quote(sub, 'essencial');
    expect(quote.kind).toBe('downgrade');
    expect(quote.lostGroups.map((g) => g.title)).toEqual(['Grupo de teste']);
    expect(quote.effect).toContain('sai das turmas que começam depois dessa data: Grupo de teste (01/12/2026)');
    expect(quote.effect).toContain('As turmas em andamento continuam');
    service.changePlan(sub.id, 'essencial');
    clock.setSimulated(quote.effectiveAt, '12:00');
    service.applyDueChanges();
    expect(db.activityEnrollments.get(mine.id)?.status).toBe('cancelled');
    expect(db.activityEnrollments.get(waiting.id)?.status).toBe('enrolled');
  });

  it('quando a descida ou o cancelamento passa a valer, o M07 é acionado para o cuidador (AC-M07-09)', () => {
    const membership = TestBed.inject(GroupMembershipService);
    const reconcile = vi.spyOn(membership, 'reconcilePlanLoss');
    const sub = subOf('cg_0007');
    const quote = service.quote(sub, 'livre');
    service.changePlan(sub.id, 'livre');
    // Agendar não derruba ninguém de turma: só vale no fim do ciclo.
    service.applyDueChanges();
    expect(reconcile).not.toHaveBeenCalled();
    clock.setSimulated(quote.effectiveAt, '12:00');
    expect(service.applyDueChanges()).toBeGreaterThanOrEqual(1);
    expect(reconcile).toHaveBeenCalledWith('cg_0007');
    // Chamar de novo, sem nada a aplicar, não aciona o M07.
    reconcile.mockClear();
    expect(service.applyDueChanges()).toBe(0);
    expect(reconcile).not.toHaveBeenCalled();
  });

  it('no fim do ciclo o cuidador sai das turmas futuras sem acesso e a turma que já começou permanece (AC-M07-09)', () => {
    const sub = subOf('cg_0024');
    expect(sub.planId).toBe('sustenta');
    const group = db.activities.create({
      kind: 'group_therapy',
      title: 'Grupo futuro',
      theme: 'self_care',
      character: 'guidance',
      leaders: [],
      mode: 'online',
      meetings: [{ id: 'm1', startAt: '2026-12-01T18:00:00-03:00', endAt: '2026-12-01T19:00:00-03:00', done: false }],
      capacity: 5,
      status: 'open',
      minPlan: 'cuida',
      requiresEligibility: false,
      confidentialityText: '',
    });
    const future = db.activityEnrollments.create({ activityId: group.id, caregiverId: 'cg_0024', status: 'enrolled', attendance: [] });
    const g1 = db.activityEnrollments.find((e) => e.activityId === 'act_0001' && e.caregiverId === 'cg_0024');
    const quote = service.quote(sub, 'essencial');
    service.changePlan(sub.id, 'essencial');
    clock.setSimulated(quote.effectiveAt, '12:00');
    service.applyDueChanges();
    expect(subOf('cg_0024').planId).toBe('essencial');
    expect(db.activityEnrollments.get(future.id)?.status).toBe('cancelled');
    // G1 já começou antes do fim do ciclo (embora o estado continue "lotada"): permanece.
    if (g1) {
      expect(db.activityEnrollments.get(g1.id)?.status).toBe(g1.status);
    }
    const log = db.accessLog.list().filter((l) => l.entity === 'activity_enrollment' && l.detail?.includes('mudança de plano'));
    expect(log.length).toBeGreaterThanOrEqual(1);
  });

  it('registrar uso de R$ 100,00 em parceiro com 10% grava desconto de R$ 10,00 (AC-M04-07)', () => {
    const card = db.benefitCards.find((c) => c.status === 'active')!;
    const partner = db.partners.find((p) => p.status === 'active' && p.discountPercent === 10)!;
    const usage = service.registerCardUsage({ cardId: card.id, partnerId: partner.id, date: '2026-11-03', amountCents: 10000 });
    expect(usage.discountCents).toBe(1000);
    expect(db.cardUsages.get(usage.id)?.amountCents).toBe(10000);
  });

  it('parceiro suspenso não aparece na lista e não aceita o cartão', () => {
    const suspended = db.partners.find((p) => p.status === 'suspended')!;
    expect(service.activePartners().some((p) => p.id === suspended.id)).toBe(false);
    expect(service.activePartners().every((p) => p.status === 'active')).toBe(true);
    const card = db.benefitCards.find((c) => c.status === 'active')!;
    expect(() => service.registerCardUsage({ cardId: card.id, partnerId: suspended.id, date: '2026-11-03', amountCents: 5000 })).toThrow('Só parceiros ativos aceitam o cartão.');
  });

  it('cartão inativo, valor zero e data no futuro são recusados', () => {
    const partner = db.partners.find((p) => p.status === 'active')!;
    const card = db.benefitCards.find((c) => c.status === 'active')!;
    expect(() => service.registerCardUsage({ cardId: card.id, partnerId: partner.id, date: '2026-11-03', amountCents: 0 })).toThrow('Informe o valor da compra.');
    expect(() => service.registerCardUsage({ cardId: card.id, partnerId: partner.id, date: '2026-12-01', amountCents: 1000 })).toThrow('futuro');
    db.benefitCards.update(card.id, { status: 'inactive' });
    expect(() => service.registerCardUsage({ cardId: card.id, partnerId: partner.id, date: '2026-11-03', amountCents: 1000 })).toThrow('inativo');
  });

  it('o cuidador Livre nunca tem cartão ativo (AC-M04-09)', () => {
    const free = db.subscriptions.query((s) => s.planId === 'livre').map((s) => s.caregiverId);
    const withCard = new Set(db.benefitCards.all().map((c) => c.caregiverId));
    expect(free.some((id) => withCard.has(id) && db.benefitCards.find((c) => c.caregiverId === id)?.status === 'active')).toBe(false);
  });

  it('cadastro novo no plano pago emite cartão e registra a assinatura', () => {
    const sub = service.startSubscription('cg_0100', 'cuida');
    expect(sub.planId).toBe('cuida');
    expect(service.cardOf('cg_0100')?.status).toBe('active');
  });

  it('reativar uma assinatura cancelada cria uma assinatura nova no Livre', () => {
    const sub = subOf('cg_0100');
    db.subscriptions.update(sub.id, { status: 'cancelled' });
    const fresh = service.reactivate(sub.id);
    expect(fresh.planId).toBe('livre');
    expect(fresh.id).not.toBe(sub.id);
    expect(() => service.reactivate(fresh.id)).toThrow(SubscriptionError);
  });

  it('o ciclo das assinaturas pagas avança sozinho com o relógio', () => {
    const sub = subOf('cg_0008');
    clock.setSimulated(addMonths(sub.nextCycleAt as string, 2), '12:00');
    service.applyDueChanges();
    expect((subOf('cg_0008').nextCycleAt as string) > clock.today()).toBe(true);
  });

  it('o dia de cobrança é o do início, cortado só nos meses curtos: 31/01 cobra 28/02, 31/03, 30/04 (RN-PLN-14, QAC-004)', () => {
    clock.setSimulated('2026-01-31', '12:00');
    const sub = service.startSubscription('cg_0100', 'essencial');
    expect(sub.nextCycleAt).toBe('2026-02-28');
    const cycle = () => db.subscriptions.require(sub.id).nextCycleAt;
    clock.setSimulated('2026-03-01', '12:00');
    service.applyDueChanges();
    expect(cycle()).toBe('2026-03-31');
    clock.setSimulated('2026-03-31', '12:00');
    service.applyDueChanges();
    expect(cycle()).toBe('2026-04-30');
    clock.setSimulated('2026-05-02', '12:00');
    service.applyDueChanges();
    expect(cycle()).toBe('2026-05-31');
  });

  it('descer no fim do ciclo de quem assinou no dia 31 mantém o dia de cobrança do plano novo e a previsão da tela (QAC-004)', () => {
    clock.setSimulated('2026-01-31', '12:00');
    const sub = service.startSubscription('cg_0100', 'cuida');
    clock.setSimulated('2026-02-10', '12:00');
    expect(service.quote(db.subscriptions.require(sub.id), 'essencial').effectiveAt).toBe('2026-02-28');
    expect(service.changePlan(sub.id, 'essencial').kind).toBe('downgrade');
    clock.setSimulated('2026-02-28', '12:00');
    expect(service.applyDueChanges()).toBe(1);
    const after = db.subscriptions.require(sub.id);
    expect(after.planId).toBe('essencial');
    expect(after.nextCycleAt).toBe('2026-03-31');
    expect(service.quote(after, 'cuida').billingFrom).toBe('2026-03-31');
  });

  it('o plano que vale é um só: assinatura única cancelada é Livre para a tela, o preço e os grupos (QAC-003)', () => {
    const sub = subOf('cg_0008');
    db.subscriptions.update(sub.id, { status: 'cancelled' });
    expect(service.planOf('cg_0008')).toBe('livre');
    expect(planIdOfCaregiver(db, 'cg_0008')).toBe('livre');
    expect(currentSubscriptionOf(db, 'cg_0008')?.id).toBe(sub.id);
    expect(service.current('cg_0008')?.id).toBe(sub.id);
    // Com uma assinatura viva mais recente, ela vale nos dois.
    const fresh = service.reactivate(sub.id);
    db.subscriptions.update(fresh.id, { planId: 'cuida' });
    expect(service.planOf('cg_0008')).toBe('cuida');
    expect(planIdOfCaregiver(db, 'cg_0008')).toBe('cuida');
  });
});
