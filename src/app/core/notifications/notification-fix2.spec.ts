import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthService, TWO_FACTOR_CODE } from '../auth/auth.service';
import { CoreTestEnv, configureCoreTest } from '../testing/test-helpers';
import { NotificationService } from './notification.service';

function loginAs(userId: string): void {
  const auth = TestBed.inject(AuthService);
  const outcome = auth.selectProfile(userId);
  if (outcome.status === 'needs_two_factor') {
    auth.verifyTwoFactor(TWO_FACTOR_CODE);
  }
}

describe('Sino: ajustes do Fix-2 (CX-012, CX-029, CX-019, CX-040)', () => {
  let env: CoreTestEnv;
  let notifications: NotificationService;

  beforeEach(() => {
    env = configureCoreTest({ seed: true });
    notifications = TestBed.inject(NotificationService);
  });

  it('CX-029: as escalas atrasadas do psicólogo viram uma linha só e o que é de risco vem antes', () => {
    loginAs('u3');
    const items = notifications.items();
    const overdueLines = items.filter((i) => i.type === 'assessment_due' && i.title.startsWith('Aplicação atrasada'));
    expect(overdueLines).toHaveLength(0);
    const grouped = items.find((i) => i.type === 'assessment_overdue_group');
    expect(grouped).toBeDefined();
    expect(grouped?.count).toBeGreaterThanOrEqual(3);
    expect(grouped?.title).toMatch(/^\d+ aplicações da escala atrasadas$/);
    // O vermelho e as mensagens atrasadas ficam em cima; a rotina da escala fica por último.
    const types = items.map((i) => i.type);
    const firstRoutine = types.findIndex((t) => t === 'assessment_due' || t === 'assessment_overdue_group');
    const lastRisk = Math.max(types.lastIndexOf('red_contact_pending'), types.lastIndexOf('message_overdue'));
    expect(lastRisk).toBeGreaterThanOrEqual(0);
    expect(lastRisk).toBeLessThan(firstRoutine);
    // O total de não vistas caiu: a linha agrupada conta como uma.
    expect(notifications.unreadCount()).toBeLessThan(25);
  });

  it('CX-012: só mostra "aviso criado há..." quando a hora é a do nascimento do aviso', () => {
    loginAs('u1');
    const audit = notifications.items().find((i) => i.type === 'audit_due');
    expect(audit).toBeDefined();
    expect(audit?.showAge).toBeFalsy();
    loginAs('u3');
    const red = notifications.items().find((i) => i.type === 'red_contact_pending');
    expect(red?.showAge).toBe(true);
  });

  it('CX-019: o pedido da RT vira aviso de ação hoje no sino do psicólogo, sem dado clínico', () => {
    const { db } = env;
    const psychologist = db.psychologists.get('psy_0002');
    expect(psychologist).toBeDefined();
    db.notifications.create({
      role: 'psychologist',
      userId: psychologist?.userId as string,
      kind: 'contact_requested:zal_0002',
      title: 'Contato pedido pela responsável técnica',
      status: 'unread',
      link: '/app/acompanhamento/alertas/zal_0002',
      at: env.clock.now(),
    });
    loginAs('u4');
    const request = notifications.items().find((i) => i.type === 'contact_requested');
    expect(request).toBeDefined();
    expect(request?.group).toBe('action_today');
    expect(request?.severity).toBe('danger');
    expect(`${request?.title} ${request?.context}`).not.toMatch(/zarit|escore|pontua|faixa|suic|diagn/i);
    // O pedido vem antes dos demais avisos de ação hoje.
    expect(notifications.items()[0]?.type).toBe('contact_requested');
    // Quando o contato é registrado, o aviso some sozinho.
    db.zaritAlerts.update('zal_0002', {
      contact: { at: env.clock.now(), byUserId: 'u4', channel: 'phone' },
      status: 'contacted',
    });
    expect(notifications.items().some((i) => i.type === 'contact_requested')).toBe(false);
  });

  it('CX-040: mensagem enviada em dúvida chega à RT com o título certo', () => {
    const { db } = env;
    const message = db.messages.find((m) => m.direction === 'in' && m.caregiverId !== undefined && !m.riskFlag);
    expect(message).toBeDefined();
    db.messages.update(message?.id as string, { riskFlag: true, riskDoubt: true, status: 'in_progress' });
    loginAs('u2');
    const flagged = notifications.items().find((i) => i.key === `message_flagged:${message?.id}`);
    expect(flagged?.title).toBe('Mensagem enviada em dúvida: avalie se há risco');
  });
});
