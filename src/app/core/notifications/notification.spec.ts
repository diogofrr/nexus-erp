import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthService, TWO_FACTOR_CODE } from '../auth/auth.service';
import { CoreTestEnv, configureCoreTest } from '../testing/test-helpers';
import { NotificationItem, NotificationService } from './notification.service';

/** Termos que NUNCA podem aparecer no texto de uma notificação (U-03): escore, faixa e condição. */
const FORBIDDEN =
  /zarit|escore|pontua|faixa|severa|moderada|suic|diagn|risco de|cr[ií]tico|vermelh|amarel|sobrecarga/i;

const ALL_USERS = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8', 'u9', 'u10', 'u11', 'u12'];

function loginAs(userId: string): void {
  const auth = TestBed.inject(AuthService);
  const outcome = auth.selectProfile(userId);
  if (outcome.status === 'needs_two_factor') {
    auth.verifyTwoFactor(TWO_FACTOR_CODE);
  }
}

describe('NotificationService', () => {
  let env: CoreTestEnv;
  let notifications: NotificationService;

  beforeEach(() => {
    env = configureCoreTest({ seed: true });
    notifications = TestBed.inject(NotificationService);
  });

  const asUser = (userId: string): readonly NotificationItem[] => {
    loginAs(userId);
    return notifications.items();
  };

  it('sem sessão não há notificações', () => {
    expect(notifications.items()).toEqual([]);
    expect(notifications.unreadCount()).toBe(0);
  });

  it('o texto descreve a tarefa: nunca escore, faixa nem condição, em nenhum perfil', () => {
    ALL_USERS.forEach((userId) => {
      const items = asUser(userId);
      items.forEach((item) => {
        const text = `${item.title} ${item.context}`;
        expect(text, `${userId}: ${text}`).not.toMatch(FORBIDDEN);
      });
    });
  });

  it('a sócia nunca recebe nome de cuidador, só contagens, códigos e prestadores', () => {
    const items = asUser('u1');
    expect(items.length).toBeGreaterThan(0);
    const names = env.db.caregivers.list().map((c) => c.fullName);
    items.forEach((item) => {
      const text = `${item.title} ${item.context}`;
      names.forEach((name) => expect(text).not.toContain(name));
    });
    const audit = items.find((i) => i.type === 'audit_due');
    expect(audit?.title).toBe('Auditoria quinzenal vence amanhã');
    expect(items.some((i) => i.type === 'dsr_due')).toBe(true);
    expect(
      items.some((i) => i.type === 'team_overload' && i.context === 'Dr. Rafael Moreira'),
    ).toBe(true);
  });

  it('o atendimento só recebe mensagens, solicitações do titular, reclamações e cancelamentos (nada clínico)', () => {
    const items = asUser('u7');
    const allowed = new Set([
      'message_overdue',
      'message_overdue_more',
      'dsr_due',
      'complaint_overdue',
      'cancellation_scheduled',
    ]);
    expect(items.length).toBeGreaterThan(0);
    items.forEach((i) => expect(allowed.has(i.type), i.type).toBe(true));
    const dsr = items.find((i) => i.type === 'dsr_due');
    expect(dsr?.title).toBe('Solicitação do titular vence em 2 dias');
    expect(dsr?.context).toContain('DSR-0003');
    const cancel = items.find((i) => i.type === 'cancellation_scheduled');
    expect(cancel?.title).toBe('Cancelamento agendado em 9 dias');
  });

  it('a responsável técnica vê o contato do mesmo dia e o vencido, com o prazo e o nome', () => {
    const items = asUser('u2');
    const pending = items.find((i) => i.type === 'red_contact_pending');
    expect(pending?.title).toBe('Contato do mesmo dia pendente');
    expect(pending?.context).toBe('Ana Paula Ferraz, prazo 23:59');
    expect(pending?.severity).toBe('danger');
    expect(pending?.group).toBe('action_today');
    const overdue = items.find((i) => i.type === 'red_contact_overdue');
    expect(overdue?.title).toBe('Prazo de contato vencido');
    expect(overdue?.context).toContain('Maria Aparecida Lemos');
    expect(items.some((i) => i.type === 'content_in_review')).toBe(true);
    // O vermelho é só de prazo de contato: o resto usa atenção ou informação.
    items
      .filter((i) => i.severity === 'danger')
      .forEach((i) => expect(['red_contact_pending', 'red_contact_overdue']).toContain(i.type));
    // "Precisa de ação hoje" vem primeiro.
    const firstFollow = items.findIndex((i) => i.group === 'to_follow');
    const lastAction = items.map((i) => i.group).lastIndexOf('action_today');
    expect(lastAction).toBeLessThan(firstFollow);
  });

  it('cada psicólogo só recebe pendências dos próprios cuidadores', () => {
    const rafael = asUser('u3');
    expect(
      rafael.some(
        (i) => i.key.startsWith('red_contact_pending:') && i.context.startsWith('Ana Paula'),
      ),
    ).toBe(true);
    expect(rafael.some((i) => i.context.includes('Maria Aparecida'))).toBe(false);
    expect(rafael.some((i) => i.type === 'agenda_overload')).toBe(true);

    const beatriz = asUser('u4');
    expect(
      beatriz.some(
        (i) => i.type === 'red_contact_overdue' && i.context.includes('Maria Aparecida'),
      ),
    ).toBe(true);
    expect(beatriz.some((i) => i.context.includes('Ana Paula'))).toBe(false);
    expect(beatriz.some((i) => i.type === 'agenda_overload')).toBe(false);
  });

  it('o credenciado vê nova solicitação, documento e cláusula, sem nome de cuidador', () => {
    const dentist = asUser('u9');
    expect(dentist.filter((i) => i.type === 'new_request')).toHaveLength(2);
    const names = env.db.caregivers.list().map((c) => c.fullName);
    dentist.forEach((i) =>
      names.forEach((n) => expect(`${i.title} ${i.context}`).not.toContain(n)),
    );

    const rosimeire = asUser('u12');
    expect(rosimeire.some((i) => i.type === 'clause_pending')).toBe(true);
    expect(rosimeire.filter((i) => i.type === 'new_request')).toHaveLength(2);

    const clinic = asUser('u11');
    expect(clinic.some((i) => i.type === 'internal_review_waiting')).toBe(true);
  });

  it('marcar como vista grava no banco, baixa o contador e sobrevive a um novo serviço', () => {
    loginAs('u2');
    const before = notifications.unreadCount();
    expect(before).toBeGreaterThan(2);
    const first = notifications.items()[0] as NotificationItem;
    notifications.markSeen(first.key);
    expect(notifications.unreadCount()).toBe(before - 1);
    expect(notifications.items().find((i) => i.key === first.key)?.seen).toBe(true);
    const stored = env.db.notifications.list().find((n) => n.kind === first.key);
    expect(stored).toMatchObject({ status: 'seen', userId: 'u2', role: 'technical_lead' });
    // O texto gravado descreve a tarefa, como o do sino.
    expect(stored?.title).not.toMatch(FORBIDDEN);

    // Outro usuário do mesmo perfil não herda o "visto".
    TestBed.inject(AuthService).logout();
    loginAs('u7');
    expect(notifications.items().some((i) => i.seen)).toBe(false);

    // Nova instância do serviço, mesmo banco: continua visto.
    loginAs('u2');
    expect(notifications.items().find((i) => i.key === first.key)?.seen).toBe(true);

    notifications.markAllSeen();
    expect(notifications.unreadCount()).toBe(0);
    expect(notifications.seenItems().length).toBe(notifications.items().length);
  });

  it('quando a causa some, a pendência sai da lista e o registro vira "resolvida" com aviso', () => {
    loginAs('u7');
    const dsr = notifications.items().find((i) => i.type === 'dsr_due') as NotificationItem;
    notifications.markSeen(dsr.key);
    // Conclui a solicitação: a causa some.
    const id = dsr.key.split(':')[1] as string;
    env.db.dataSubjectRequests.update(id, { status: 'completed' });
    expect(notifications.items().some((i) => i.key === dsr.key)).toBe(false);
    notifications.reconcile();
    expect(env.db.notifications.list().find((n) => n.kind === dsr.key)?.status).toBe('resolved');
    expect(notifications.announcement()).toBe('Pendência resolvida.');
    // Se a causa volta, a pendência volta como não vista.
    env.db.dataSubjectRequests.update(id, { status: 'in_progress' });
    expect(notifications.items().find((i) => i.key === dsr.key)?.seen).toBe(false);
  });

  it('avançar o relógio 8 dias faz o vermelho do dia virar prazo vencido (AC-M15-04)', () => {
    loginAs('u2');
    const ana = (): NotificationItem | undefined =>
      notifications.items().find((i) => i.key.endsWith(':zal_0001'));
    expect(ana()?.type).toBe('red_contact_pending');
    env.clock.advanceDays(8);
    expect(ana()?.type).toBe('red_contact_overdue');
    expect(ana()?.title).toBe('Prazo de contato vencido');
  });

  it('contadores do menu: contatos pendentes (RT), mensagens atrasadas e solicitações vencendo (atendimento)', () => {
    loginAs('u2');
    expect(notifications.counterFor('zarit')?.count).toBe(2);
    expect(notifications.counterFor('zarit')?.label).toBe('2 contatos pendentes hoje');
    expect(notifications.counterFor('messages')).toBeNull();

    loginAs('u7');
    const messages = notifications.counterFor('messages');
    expect(messages?.count).toBeGreaterThan(0);
    expect(messages?.label).toMatch(/mensagens? atrasadas?/);
    expect(notifications.counterFor('privacy')?.count).toBe(1);
    // Nunca contador para quem não pode ver o conteúdo.
    expect(notifications.counterFor('zarit')).toBeNull();
  });
});
