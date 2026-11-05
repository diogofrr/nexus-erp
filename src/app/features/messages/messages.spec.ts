import { TestBed } from '@angular/core/testing';
import { DraftService } from '@shared/ui';
import { describe, expect, it } from 'vitest';
import { NotificationService, generateNotifications } from '@core/notifications';
import { NetworkService } from '@core/network';
import {
  complaintDueAt,
  isComplaintOverdue,
  isMessageOverdue,
  messageDueAt,
  slaByChannel,
} from '@core/rules';
import { BootedApp, bootApp, settle } from '../../layout/testing';
import { ComplaintsService } from './state/complaints.service';
import { MessagesService } from './state/messages.service';
import { expedientNote, inboxSections, templateProblems } from './state/message-view';

const click = (el: Element | null | undefined): void => {
  if (!el) {
    throw new Error('elemento não encontrado');
  }
  (el as HTMLElement).click();
};

const typeInto = (input: Element | null, value: string): void => {
  if (!input) {
    throw new Error('campo não encontrado');
  }
  const field = input as HTMLInputElement | HTMLTextAreaElement;
  field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('blur', { bubbles: true }));
};

const submit = (form: Element | null): void => {
  if (!form) {
    throw new Error('formulário não encontrado');
  }
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
};

function tools(app: () => BootedApp) {
  return {
    q: <T extends Element = HTMLElement>(selector: string): T | null =>
      app().root.querySelector<T>(selector),
    all: <T extends Element = HTMLElement>(selector: string): T[] =>
      Array.from(app().root.querySelectorAll<T>(selector)),
    go: async (url: string): Promise<void> => {
      await app().router.navigateByUrl(url);
      await settle(app().fixture);
    },
  };
}

describe('M11 caixa de mensagens: atendimento', () => {
  let app: BootedApp;
  const { q, all, go } = tools(() => app);

  it('mostra as 5 atrasadas primeiro, em seção própria e a mais atrasada no topo (AC-M11-03)', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/mensagens' });
    expect(q('h1')?.textContent).toContain('Mensagens');
    const sections = all('[data-section]').map((s) => s.getAttribute('data-section'));
    expect(sections[0]).toBe('overdue');
    expect(q('#inbox-overdue')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Atrasadas (5)');
    const now = app.clock.now();
    const expected = inboxSections(
      app.db.messages.all().filter((m) => m.direction === 'in'),
      now,
    )[0]?.items.map((m) => m.id);
    const shown = all('[data-section="overdue"] [data-role="row"]').map((r) => r.getAttribute('data-id'));
    expect(shown).toEqual(expected);
    expect(shown).toHaveLength(5);
    all('[data-section="overdue"] app-deadline-badge').forEach((badge) =>
      expect(badge.textContent).toMatch(/Atrasada há/),
    );
    // Contam no indicador de SLA: nenhuma delas está respondida no prazo.
    const stats = slaByChannel(app.db.messages.all(), now);
    expect(stats.reduce((sum, s) => sum + s.considered - s.onTime, 0)).toBeGreaterThanOrEqual(5);
    expect(q('[data-role="register-contact"]')).not.toBeNull();
  });

  it('o prazo de cada canal aparece na mensagem (AC-M11-01)', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/mensagens' });
    const wanted: Record<string, string> = {
      app: 'até 24 horas úteis',
      whatsapp: 'até 4 horas úteis',
      phone: 'imediato, em horário comercial',
      email: 'até 48 horas úteis',
    };
    for (const [channel, text] of Object.entries(wanted)) {
      const message = app.db.messages.find((m) => m.direction === 'in' && m.channel === channel);
      expect(message, channel).toBeDefined();
      await go(`/app/mensagens/${message?.id}`);
      expect(q('[data-role="message-info"]')?.textContent, channel).toContain(text);
    }
  });

  it('WhatsApp de sexta 17:30 vence segunda 11:30 e o aviso explica que o prazo continua na segunda (AC-M11-02)', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/mensagens' });
    const receivedAt = '2026-11-06T17:30:00-03:00';
    const dueAt = messageDueAt('whatsapp', receivedAt);
    expect(dueAt).toBe('2026-11-09T11:30:00-03:00');
    expect(expedientNote(receivedAt, dueAt, 4)).toBe(
      'Chegou sexta, 17:30. O prazo continua segunda, a partir das 08:00.',
    );
    // Fora do expediente a contagem só começa na abertura seguinte.
    const late = '2026-11-06T19:10:00-03:00';
    expect(expedientNote(late, messageDueAt('whatsapp', late), 4)).toBe(
      'Chegou sexta, 19:10. O prazo começa segunda, 08:00.',
    );
    // No mesmo dia, sem aviso.
    expect(expedientNote('2026-11-03T09:00:00-03:00', '2026-11-03T13:00:00-03:00', 4)).toBeNull();
    const created = app.db.messages.create({
      channel: 'whatsapp',
      direction: 'in',
      caregiverId: 'cg_0006',
      body: 'Posso trocar o horário da conversa?',
      receivedAt,
      dueAt,
      status: 'new',
      isSupportRequest: false,
    });
    await go(`/app/mensagens/${created.id}`);
    expect(q('[data-role="out-of-hours"]')?.textContent).toContain(
      'Chegou sexta, 17:30. O prazo continua segunda, a partir das 08:00.',
    );
    expect(q('[data-role="due-absolute"]')?.textContent).toContain('segunda, 09/11, 11:30');
    // O horário nunca aparece como "11h30".
    expect(q('[data-role="message-detail"]')?.textContent).not.toMatch(/\d{1,2}h\d{2}/);
  });

  it('responder com um modelo grava a resposta, marca respondida e tira a mensagem das atrasadas', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/mensagens' });
    const overdueBefore = app.db.messages.all().filter((m) => isMessageOverdue(m, app.clock.now()));
    const target = overdueBefore[0];
    expect(target).toBeDefined();
    await go(`/app/mensagens/${target?.id}`);
    expect(q('[data-role="position"]')?.textContent).toMatch(/\d+ de \d+/);
    const chips = all('[data-role="template"]');
    expect(chips).toHaveLength(6);
    // CX-039: o modelo chega com o nome da pessoa e, na mensagem atrasada, com o pedido de desculpas (sem prometer prazo).
    click(chips.find((c) => c.textContent?.includes('Confirmação de recebimento')) ?? null);
    await settle(app.fixture);
    const box = q<HTMLTextAreaElement>('[data-role="reply-body"]');
    expect(box?.value).toContain('Recebemos a sua mensagem');
    expect(box?.value).toContain('Pedimos desculpas pela demora');
    expect(box?.value).not.toContain('dentro do prazo combinado');
    const cg = app.db.caregivers.get(target?.caregiverId ?? '');
    if (cg) {
      expect(box?.value.startsWith(`Olá, ${cg.fullName.split(' ')[0]}`)).toBe(true);
    }
    click(q('[data-role="send-reply"]'));
    await settle(app.fixture);
    const after = app.db.messages.require(target?.id as string);
    expect(after.status).toBe('answered');
    expect(after.firstResponseAt).toBeDefined();
    expect(
      app.db.messages.all().some((m) => m.direction === 'out' && m.caregiverId === target?.caregiverId),
    ).toBe(true);
    expect(
      app.db.messages.all().filter((m) => isMessageOverdue(m, app.clock.now())),
    ).toHaveLength(overdueBefore.length - 1);
    expect(q('#inbox-overdue')?.textContent).toContain(`(${overdueBefore.length - 1})`);
  });

  it('resposta vazia é barrada com mensagem junto do campo', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/mensagens' });
    const target = app.db.messages.find((m) => m.status === 'new');
    await go(`/app/mensagens/${target?.id}`);
    click(q('[data-role="send-reply"]'));
    await settle(app.fixture);
    expect(q('[data-role="reply-form"] .field__error')?.textContent).toContain('Informe');
    expect(app.db.messages.require(target?.id as string).status).toBe('new');
  });

  it('Assumir marca quem cuida e coloca a mensagem em atendimento', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/mensagens' });
    const target = app.db.messages.find((m) => m.status === 'new' && m.direction === 'in');
    await go(`/app/mensagens/${target?.id}`);
    click(q('[data-role="assume"]'));
    await settle(app.fixture);
    const after = app.db.messages.require(target?.id as string);
    expect(after.assignedToUserId).toBe('u7');
    expect(after.status).toBe('in_progress');
    await go('/app/mensagens?filtro=minhas');
    expect(all('[data-role="row"]').some((r) => r.getAttribute('data-id') === target?.id)).toBe(true);
  });

  it('Registrar contato por telefone entra na caixa com o canal telefone (AC-M11-07)', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/mensagens' });
    const before = app.db.messages.size();
    click(q('[data-role="register-contact"]'));
    await settle(app.fixture);
    const picker = q('app-contact-drawer [data-role="picker-search"]');
    typeInto(picker, 'Batista');
    await settle(app.fixture);
    click(q('app-contact-drawer [data-role="picker-option"]'));
    await settle(app.fixture);
    typeInto(q('app-contact-drawer #contact-subject'), 'Dúvida sobre o grupo');
    typeInto(q('app-contact-drawer #contact-body'), 'Ligou perguntando o horário do próximo encontro.');
    const answered = q<HTMLInputElement>('app-contact-drawer input[type="checkbox"]');
    click(answered);
    await settle(app.fixture);
    submit(q('#nx-contact-form'));
    await settle(app.fixture);
    expect(app.db.messages.size()).toBe(before + 1);
    const created = app.db.messages.all().at(-1);
    expect(created?.channel).toBe('phone');
    expect(created?.direction).toBe('in');
    expect(created?.caregiverId).toBe('cg_0003');
    expect(created?.status).toBe('answered');
    expect(created?.firstResponseAt).toBeDefined();
    expect(all('[data-role="row"]').some((r) => r.getAttribute('data-id') === created?.id)).toBe(true);
  });

  it('Registrar contato sem preencher mostra o resumo de erros e não grava nada', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/mensagens?acao=registrar-contato' });
    const before = app.db.messages.size();
    submit(q('#nx-contact-form'));
    await settle(app.fixture);
    expect(all('app-contact-drawer .error-summary li')).toHaveLength(3);
    expect(q('app-contact-drawer .error-summary')?.textContent).toContain('Escolha o cuidador');
    expect(app.db.messages.size()).toBe(before);
    // O parâmetro da paleta foi consumido.
    expect(app.router.url).not.toContain('acao=');
  });

  it('pedido de apoio soma ao contador de 30 dias e gera o alerta de risco quando os critérios pedem (AC-M11-04)', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/mensagens' });
    const caregiverId = 'cg_0008';
    app.db.caregivers.update(caregiverId, { dailyCareHours: 9 });
    app.db.arbeAlerts.removeWhere((a) => a.caregiverId === caregiverId);
    const message = app.db.messages.create({
      channel: 'app',
      direction: 'in',
      caregiverId,
      body: 'Estou com dificuldade de organizar a semana.',
      receivedAt: app.clock.now(),
      dueAt: messageDueAt('app', app.clock.now()),
      status: 'new',
      isSupportRequest: false,
    });
    await go(`/app/mensagens/${message.id}`);
    expect(q('[data-role="support-count"]')?.textContent?.trim()).toBe('0');
    expect(q('[data-role="message-actions"]')?.textContent).not.toMatch(/ARBE/);
    const toggle = q<HTMLInputElement>('[data-role="support-request"] input');
    click(toggle);
    await settle(app.fixture);
    expect(app.db.messages.require(message.id).isSupportRequest).toBe(true);
    expect(q('[data-role="support-count"]')?.textContent?.trim()).toBe('1');
    expect(q('[data-role="message-detail"]')?.textContent).not.toMatch(/ARBE/);
    const alerts = app.db.arbeAlerts.all().filter((a) => a.caregiverId === caregiverId);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.level).toBe('attention');
    // Marcar de novo não duplica o alerta.
    TestBed.inject(MessagesService).setSupportRequest(message.id, true);
    expect(app.db.arbeAlerts.all().filter((a) => a.caregiverId === caregiverId)).toHaveLength(1);
  });

  it('Sinalizar risco aparece em toda mensagem, avisa o RT em 2 cliques e abre a ocorrência POP-05 restrita (A-38)', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/mensagens' });
    const inbound = app.db.messages.all().filter((m) => m.direction === 'in' && !m.riskFlag && m.caregiverId);
    for (const m of inbound.slice(0, 6)) {
      await go(`/app/mensagens/${m.id}`);
      expect(q('[data-role="flag-risk"]')?.textContent, m.id).toContain('Sinalizar risco');
    }
    const target = app.db.messages.find(
      (m) => m.direction === 'in' && m.caregiverId === 'cg_0021' && !m.riskFlag,
    );
    expect(target).toBeDefined();
    const occurrencesBefore = app.db.occurrences.size();
    await go(`/app/mensagens/${target?.id}`);
    click(q('[data-role="flag-risk"]'));
    await settle(app.fixture);
    const dialog = q('app-dialog-host dialog');
    expect(dialog?.textContent).toContain('SAMU (192)');
    expect(dialog?.textContent).toContain('CVV (188)');
    click(q('app-dialog-host [data-role="confirm"]'));
    await settle(app.fixture);
    expect(app.db.messages.require(target?.id as string).riskFlag).toBe(true);
    expect(app.db.occurrences.size()).toBe(occurrencesBefore + 1);
    const occurrence = app.db.occurrences.all().at(-1);
    expect(occurrence?.kind).toBe('pop05_risk');
    expect(occurrence?.caregiverId).toBe('cg_0021');
    expect(occurrence?.restrictedToUserIds).toContain('u2');
    expect(occurrence?.restrictedToUserIds).not.toContain('u7');
    expect(occurrence?.steps[0]?.doneAt).toBeDefined();
    expect(q('[data-role="risk-note"]')?.textContent).toMatch(/Responsável técnico avisado às \d{2}:\d{2}\./);
    // O atendimento não tem acesso à ocorrência.
    expect(app.auth.can('occurrences', 'view')).toBe(false);
    expect(q('[data-role="message-detail"]')?.textContent).not.toMatch(/POP-05/);
  });

  it('o responsável técnico recebe a mensagem sinalizada e vê só os casos de risco, em modo leitura', async () => {
    app = await bootApp({ userId: 'u2', url: '/app/mensagens' });
    const rows = all('[data-role="row"]');
    expect(rows).toHaveLength(app.db.messages.all().filter((m) => m.riskFlag && m.direction === 'in').length);
    expect(rows.length).toBeGreaterThan(0);
    expect(q('[data-role="register-contact"]')).toBeNull();
    await go(`/app/mensagens/${rows[0]?.getAttribute('data-id')}`);
    expect(q('[data-role="read-only"]')?.textContent).toContain('modo leitura');
    expect(q('[data-role="send-reply"]')).toBeNull();
    expect(q('[data-role="risk-flagged"]')).not.toBeNull();
  });

  it('a sinalização de risco entra nas notificações do responsável técnico', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/mensagens' });
    const target = app.db.messages.find(
      (m) => m.direction === 'in' && m.caregiverId === 'cg_0028' && m.status === 'new',
    ) as { id: string };
    expect(target).toBeDefined();
    TestBed.inject(MessagesService).flagRisk(target.id);
    const drafts = generateNotifications({
      db: app.db,
      actor: { userId: 'u2', role: 'technical_lead' },
      now: app.clock.now(),
      today: app.clock.today(),
    });
    expect(drafts.some((d) => d.key === `message_flagged:${target.id}`)).toBe(true);
    const support = generateNotifications({
      db: app.db,
      actor: { userId: 'u7', role: 'support' },
      now: app.clock.now(),
      today: app.clock.today(),
    });
    expect(support.some((d) => d.type === 'message_flagged')).toBe(false);
  });

  it('as atrasadas aparecem nas notificações do atendimento e saem quando respondidas', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/mensagens' });
    const notifications = TestBed.inject(NotificationService);
    const before = notifications.counterFor('messages');
    expect(before?.count).toBe(5);
    const target = app.db.messages.all().find((m) => isMessageOverdue(m, app.clock.now()));
    TestBed.inject(MessagesService).reply(target?.id as string, 'Recebemos a sua mensagem.');
    await settle(app.fixture);
    expect(notifications.counterFor('messages')?.count).toBe(4);
  });

  it('a caixa tem estado vazio acolhedor quando o filtro não acha nada e "Limpar filtros" volta à lista', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/mensagens?filtro=sinalizadas&canal=phone' });
    expect(q('[data-role="clear-filters"]')).not.toBeNull();
    expect(q('[data-role="inbox-list"] .empty')?.textContent).toContain('Nenhuma mensagem encontrada');
    click(q('[data-role="clear-filters"]'));
    await settle(app.fixture);
    expect(all('[data-role="row"]').length).toBeGreaterThan(0);
  });

  it('a busca da caixa é só em memória (nunca vai para a URL) e filtra por contato', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/mensagens' });
    const total = all('[data-role="row"]').length;
    typeInto(q('[data-search-field]'), 'Ana Paula');
    await settle(app.fixture);
    const shown = all('[data-role="row"]').length;
    expect(shown).toBeGreaterThan(0);
    expect(shown).toBeLessThan(total);
    expect(app.router.url).not.toContain('Ana');
  });

  it('as visões da URL (atrasadas e sinalizadas) vêm do sino e filtram a caixa', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/mensagens?filtro=atrasadas' });
    expect(all('[data-section]').map((s) => s.getAttribute('data-section'))).toEqual(['overdue']);
    expect(all('[data-role="row"]')).toHaveLength(5);
    await go('/app/mensagens?filtro=sinalizadas');
    const ids = all('[data-role="row"]').map((r) => r.getAttribute('data-id') as string);
    expect(ids.length).toBeGreaterThan(0);
    ids.forEach((id) => expect(app.db.messages.require(id).riskFlag).toBe(true));
  });

  it('o canal filtra e fica na URL', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/mensagens?canal=email' });
    const ids = all('[data-role="row"]').map((r) => r.getAttribute('data-id'));
    expect(ids.length).toBeGreaterThan(0);
    ids.forEach((id) => expect(app.db.messages.require(id as string).channel).toBe('email'));
  });

  it('mensagem de prestador mostra o nome dele com o rótulo Prestador e a resposta guarda o mesmo prestador', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/mensagens' });
    const target = app.db.messages.find((m) => m.direction === 'in' && m.providerId === 'prv_17');
    expect(target).toBeDefined();
    await go(`/app/mensagens/${target?.id}`);
    expect(q('[data-role="message-head"]')?.textContent).toContain('Equipamentos Cuidar+');
    expect(q('[data-role="message-head"]')?.textContent).toContain('Prestador');
    typeInto(q('[data-role="reply-body"]'), 'Recebemos os documentos. Vamos combinar a data da integração.');
    await settle(app.fixture);
    click(q('[data-role="send-reply"]'));
    await settle(app.fixture);
    const reply = app.db.messages.all().at(-1);
    expect(reply?.direction).toBe('out');
    expect(reply?.providerId).toBe('prv_17');
    expect(app.db.messages.require(target?.id as string).status).toBe('answered');
  });
});

describe('M11 atalhos e rascunho', () => {
  let app: BootedApp;
  const { q, all } = tools(() => app);

  it('J abre a primeira mensagem, K volta, e N abre Registrar contato (UX 5.16)', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/mensagens' });
    const first = all('[data-role="row"]')[0]?.getAttribute('data-id');
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true }));
    await settle(app.fixture);
    expect(app.router.url).toContain(`/app/mensagens/${first}`);
    expect(q('[data-role="position"]')?.textContent).toContain('1 de');
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true }));
    await settle(app.fixture);
    expect(q('[data-role="position"]')?.textContent).toContain('2 de');
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }));
    await settle(app.fixture);
    expect(q('app-contact-drawer dialog')?.hasAttribute('open')).toBe(true);
  });

  it('os atalhos de uma tecla não disparam dentro de campo de texto', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/mensagens' });
    const field = q<HTMLInputElement>('[data-search-field]') as HTMLInputElement;
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }));
    await settle(app.fixture);
    expect(q('app-contact-drawer dialog')?.hasAttribute('open')).toBe(false);
  });

  it('a gaveta fecha pelo botão Voltar à lista e a URL volta à caixa', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/mensagens' });
    const id = all('[data-role="row"]')[0]?.getAttribute('data-id');
    await app.router.navigateByUrl(`/app/mensagens/${id}?canal=${app.db.messages.require(id as string).channel}`);
    await settle(app.fixture);
    expect(q('[data-role="message-detail"]')).not.toBeNull();
    click(q('[data-role="back"]'));
    await settle(app.fixture);
    await settle(app.fixture);
    expect(q('[data-role="message-detail"]')).toBeNull();
    expect(app.router.url).toMatch(/^\/app\/mensagens(\?|$)/);
  });

  it('o rascunho da reclamação é oferecido ao abrir e retoma o que foi escrito', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/reclamacoes' });
    TestBed.inject(DraftService).save('complaint', 'novo', {
      channel: 'phone',
      caregiverId: null,
      targetType: 'provider',
      providerId: '',
      description: 'Rascunho: o atendimento atrasou duas vezes.',
    });
    click(q('[data-role="new-complaint"]'));
    await settle(app.fixture);
    expect(q('[data-role="draft-offer"]')?.textContent).toContain('Retomar rascunho');
    click(q('[data-role="resume-draft"]'));
    await settle(app.fixture);
    expect(q<HTMLTextAreaElement>('#complaint-description')?.value).toContain('Rascunho: o atendimento');
    expect(q('[data-role="draft-offer"]')).toBeNull();
  });
});

describe('M11 permissões e privacidade na caixa', () => {
  let app: BootedApp;
  const { q, all, go } = tools(() => app);

  it('a gestão vê código no lugar do nome e nunca o texto do cuidador, nem contato', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/mensagens' });
    expect(all('[data-role="row"]').length).toBeGreaterThan(0);
    const labels = all('[data-role="row"] .list-row__title').map((e) => e.textContent?.trim() ?? '');
    expect(labels.some((l) => /CUI-\d{4}/.test(l))).toBe(true);
    const names = app.db.caregivers.all().slice(0, 40).map((c) => c.fullName);
    const text = app.root.querySelector('[data-role="inbox-list"]')?.textContent ?? '';
    names.forEach((name) => expect(text).not.toContain(name));
    const message = app.db.messages.find((m) => m.caregiverId === 'cg_0001' && m.direction === 'in');
    await go(`/app/mensagens/${message?.id}`);
    expect(q('[data-role="message-detail"]')?.textContent).not.toContain('Ana Paula');
    expect(q('[data-role="hidden-text"]')?.textContent).toContain('Texto oculto');
    expect(q('[data-role="message-detail"] app-masked-field')).toBeNull();
    expect(q('[data-role="send-reply"]')).toBeNull();
    expect(q('[data-role="flag-risk"]')).not.toBeNull();
  });

  it('o atendimento vê o nome e o contato vem mascarado, com "Mostrar" pedindo motivo', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/mensagens' });
    const message = app.db.messages.find((m) => m.caregiverId === 'cg_0001' && m.direction === 'in');
    await go(`/app/mensagens/${message?.id}`);
    expect(q('[data-role="contact"]')?.textContent).toContain('Ana Paula Ferraz');
    expect(q('[data-role="message-info"]')?.textContent).toContain('(34) 9****-');
    expect(q('[data-role="message-info"]')?.textContent).not.toMatch(/\(34\) 90000-\d{4}/);
    expect(q('[data-role="message-info"] .masked__toggle')?.textContent).toContain('Mostrar');
  });

  it('o psicólogo só vê as mensagens dos próprios cuidadores, em modo leitura', async () => {
    app = await bootApp({ userId: 'u3', url: '/app/mensagens' });
    const rows = all('[data-role="row"]');
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((r) => {
      const m = app.db.messages.require(r.getAttribute('data-id') as string);
      const caregiver = app.db.caregivers.require(m.caregiverId as string);
      expect(caregiver.assignedPsychologistId).toBe('psy_0001');
    });
    expect(q('[data-role="register-contact"]')).toBeNull();
  });

  it('perfil sem acesso às reclamações vai a /403 sem mostrar nada', async () => {
    app = await bootApp({ userId: 'u3', url: '/app/mensagens' });
    await go('/app/reclamacoes');
    expect(app.router.url).toBe('/403');
    expect(app.root.textContent).not.toContain('REC-0001');
    await go('/app/reclamacoes/rec_0001');
    expect(app.router.url).toBe('/403');
  });

  it('link direto para uma mensagem que o perfil não vê mostra "não encontramos" sem revelar nada', async () => {
    app = await bootApp({ userId: 'u3', url: '/app/mensagens' });
    const other = app.db.messages.find(
      (m) => m.direction === 'in' && m.caregiverId === 'cg_0002',
    );
    await go(`/app/mensagens/${other?.id}`);
    expect(q('[data-role="message-detail"]')).toBeNull();
    expect(app.root.textContent).toContain('Não encontramos esta mensagem');
    expect(app.root.textContent).not.toContain('Maria Aparecida');
  });

  it('abrir uma mensagem grava leitura no log de acessos', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/mensagens' });
    const message = app.db.messages.find((m) => m.caregiverId === 'cg_0001' && m.direction === 'in');
    const before = app.db.accessLog.size();
    await go(`/app/mensagens/${message?.id}`);
    expect(app.db.accessLog.size()).toBeGreaterThan(before);
    const entry = app.db.accessLog.all().at(-1);
    expect(entry?.entity).toBe('message');
    expect(entry?.action).toBe('view');
  });

  it('acessibilidade básica: um h1, busca e grupos de filtro com nome, mensagem aberta com rótulos', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/mensagens' });
    expect(all('h1')).toHaveLength(1);
    expect(q('[data-search-field]')?.getAttribute('aria-label')).toBe('Buscar na caixa');
    all('app-filter-chips [role="group"]').forEach((g) => expect(g.getAttribute('aria-label')).toBeTruthy());
    const target = app.db.messages.find((m) => m.status === 'new');
    await go(`/app/mensagens/${target?.id}`);
    expect(q('[data-role="reply-body"]')?.id).toBeTruthy();
    expect(q('label[for="reply-body"]')?.textContent).toContain('Sua resposta');
    all('[data-role="message-detail"] button').forEach((b) =>
      expect((b.textContent ?? '').trim() !== '' || b.getAttribute('aria-label')).toBeTruthy(),
    );
  });
});

describe('M11 modelos de resposta', () => {
  let app: BootedApp;
  const { q, all } = tools(() => app);

  it('os 6 modelos do seed estão no tom da marca: sem promessa, travessão nem jargão (AC-M11-10)', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/mensagens/modelos' });
    const templates = app.db.messageTemplates.all();
    expect(templates).toHaveLength(6);
    templates.forEach((t) => expect(templateProblems(t.title, t.body), t.title).toEqual([]));
    expect(all('[data-role="template-card"]')).toHaveLength(6);
    expect(app.root.textContent).not.toMatch(/[\u2013\u2014]/);
  });

  it('rejeita promessa de resultado, travessão e jargão, com a explicação do que trocar', () => {
    expect(templateProblems('Retorno', 'Garantimos a melhora do seu cansaço em poucos dias.').join(' ')).toContain(
      'prometer um resultado',
    );
    expect(templateProblems('Retorno', 'Seu diagnóstico será analisado pela equipe.').join(' ')).toContain(
      'termo técnico',
    );
    expect(templateProblems('Retorno', `Vamos retornar amanhã ${String.fromCharCode(0x2014)} fique tranquila.`).join(' ')).toContain('travessão');
    expect(templateProblems('A', 'curto')).toHaveLength(2);
  });

  it('cria, edita e exclui um modelo, e o formulário recusa promessa de resultado', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/mensagens/modelos' });
    click(q('[data-role="new-template"]'));
    await settle(app.fixture);
    typeInto(q('#template-title'), 'Resultado');
    typeInto(q('#template-body'), 'Garantimos que você vai melhorar logo.');
    submit(q('#nx-template-form'));
    await settle(app.fixture);
    expect(q('#nx-template-form .error-summary')?.textContent).toContain('prometer um resultado');
    expect(app.db.messageTemplates.size()).toBe(6);

    typeInto(q('#template-body'), 'Recebemos o seu pedido. A equipe retorna até amanhã.');
    submit(q('#nx-template-form'));
    await settle(app.fixture);
    expect(app.db.messageTemplates.size()).toBe(7);
    expect(app.db.messageTemplates.all().at(-1)?.title).toBe('Resultado');

    click(all('[data-role="edit-template"]').at(-1));
    await settle(app.fixture);
    typeInto(q('#template-title'), 'Retorno combinado');
    submit(q('#nx-template-form'));
    await settle(app.fixture);
    expect(app.db.messageTemplates.all().some((t) => t.title === 'Retorno combinado')).toBe(true);

    click(all('[data-role="delete-template"]').at(-1));
    await settle(app.fixture);
    click(q('app-dialog-host [data-role="confirm"]'));
    await settle(app.fixture);
    expect(app.db.messageTemplates.size()).toBe(6);
  });

  it('o responsável técnico só lê os modelos', async () => {
    app = await bootApp({ userId: 'u2', url: '/app/mensagens/modelos' });
    expect(all('[data-role="template-card"]')).toHaveLength(6);
    expect(q('[data-role="new-template"]')).toBeNull();
    expect(q('[data-role="edit-template"]')).toBeNull();
  });
});

describe('M11 reclamações', () => {
  let app: BootedApp;
  const { q, all, go } = tools(() => app);

  it('a lista mostra as 5 reclamações e a vencida há 3 dias úteis (AC-M11-08)', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/reclamacoes' });
    expect(q('h1')?.textContent).toContain('Reclamações');
    expect(all('tbody tr[data-row]')).toHaveLength(5);
    const rec5 = app.db.complaints.find((c) => c.protocol === 'REC-0005');
    expect(isComplaintOverdue(rec5 as NonNullable<typeof rec5>, app.clock.now())).toBe(true);
    const row = all('tbody tr[data-row]').find((r) => r.textContent?.includes('REC-0005'));
    expect(row?.textContent).toContain('Vencida há 3 dias úteis');
    expect(row?.textContent?.match(/dias? úteis/)).not.toBeNull();
    // O prazo mais próximo vem primeiro entre as abertas; a encerrada fica no fim.
    const protocols = all('tbody tr[data-row]').map((r) => r.querySelector('.row-link')?.textContent?.trim());
    expect(protocols.at(-1)).toBe('REC-0003');
  });

  it('o filtro ?filtro=vencidas vem do sino e mostra só as vencidas', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/reclamacoes?filtro=vencidas' });
    const rows = all('tbody tr[data-row]');
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((r) => expect(r.textContent).toContain('Vencida'));
  });

  it('o prazo de 5 dias úteis conta a partir da abertura (RN-POP-08)', () => {
    expect(complaintDueAt('2026-11-04T10:00:00-03:00')).toBe('2026-11-11T18:00:00-03:00');
  });

  it('abrir reclamação cria o protocolo seguinte com prazo e evento inicial', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/reclamacoes' });
    click(q('[data-role="new-complaint"]'));
    await settle(app.fixture);
    submit(q('#nx-complaint-form'));
    await settle(app.fixture);
    expect(q('app-complaint-drawer .error-summary')?.textContent).toContain('Escolha o prestador');
    expect(app.db.complaints.size()).toBe(5);
    const select = q<HTMLSelectElement>('#complaint-provider');
    select!.value = 'prv_05';
    select!.dispatchEvent(new Event('change', { bubbles: true }));
    typeInto(q('#complaint-description'), 'O profissional chegou muito depois do horário combinado.');
    await settle(app.fixture);
    submit(q('#nx-complaint-form'));
    await settle(app.fixture);
    expect(app.db.complaints.size()).toBe(6);
    const created = app.db.complaints.all().at(-1);
    expect(created?.protocol).toBe('REC-0006');
    expect(created?.status).toBe('open');
    expect(created?.target).toEqual({ type: 'provider', providerId: 'prv_05' });
    expect(created?.events).toHaveLength(1);
    expect(created?.dueAt).toBe(complaintDueAt(created?.openedAt as string));
  });

  it('classificar como grave exige categoria e prestador, soma na ARP e a 3ª suspende na hora (AC-M11-05)', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/reclamacoes/rec_0005' });
    click(q('[data-role="classify-grave"]'));
    await settle(app.fixture);
    submit(q('#nx-grave-form'));
    await settle(app.fixture);
    expect(q('#nx-grave-form .error-summary')?.textContent).toContain('Escolha a categoria');
    expect(app.db.complaints.require('rec_0005').severity).toBe('normal');

    const network = TestBed.inject(NetworkService);
    // Duas graves já registradas: não suspende.
    const own = app.db.providerEvaluations.query((e) => e.providerId === 'prv_05');
    own.slice(0, 2).forEach((e) =>
      app.db.providerEvaluations.update(e.id, {
        grave: { category: 'other', classifiedBy: 'u1', classifiedAt: app.clock.today() },
      }),
    );
    expect(network.summaryOf('prv_05')?.graveCount).toBe(2);
    expect(app.db.providers.get('prv_05')?.status).toBe('active');

    const radios = all<HTMLInputElement>('#nx-grave-form input[type="radio"]');
    click(radios[1]);
    const select = q<HTMLSelectElement>('#grave-provider');
    select!.value = 'prv_05';
    select!.dispatchEvent(new Event('change', { bubbles: true }));
    await settle(app.fixture);
    submit(q('#nx-grave-form'));
    await settle(app.fixture);

    const rec = app.db.complaints.require('rec_0005');
    expect(rec.severity).toBe('grave');
    expect(rec.graveCategory).toBe('confidentiality_breach');
    expect(rec.target.providerId).toBe('prv_05');
    expect(rec.events.at(-1)?.text).toContain('Classificada como grave');
    expect(network.summaryOf('prv_05')?.graveCount).toBe(3);
    expect(app.db.providers.get('prv_05')?.status).toBe('suspended');
    expect(app.db.internalReviews.find((r) => r.providerId === 'prv_05' && !r.decision)).toBeDefined();
    expect(q('[data-role="grave-count"]')?.textContent?.trim()).toBe('3');
  });

  it('duas graves não suspendem (AC-M11-05)', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/reclamacoes' });
    const service = TestBed.inject(ComplaintsService);
    const network = TestBed.inject(NetworkService);
    expect(network.summaryOf('prv_11')?.graveCount).toBe(0);
    const first = service.open({ channel: 'phone', targetType: 'provider', providerId: 'prv_11', description: 'Faltou ao combinado.' });
    const second = service.open({ channel: 'phone', targetType: 'provider', providerId: 'prv_11', description: 'Faltou de novo.' });
    service.classifyGrave(first.id, 'unjustified_absence', 'prv_11');
    const outcome = service.classifyGrave(second.id, 'unjustified_absence', 'prv_11');
    expect(outcome.graveCount).toBe(2);
    expect(outcome.reevaluation.suspended).toBe(false);
    expect(app.db.providers.get('prv_11')?.status).toBe('active');
  });

  it('suspeita de violência abre a POP-07 restrita ao RT e ao psicólogo do caso; atendimento só vê "Enviado ao responsável técnico" (AC-M11-06)', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/reclamacoes/rec_0005' });
    const occurrencesBefore = app.db.occurrences.size();
    // A reclamação do seed não tem cuidador vinculado a uma ocorrência: ela traz cg_0015.
    click(q('[data-role="flag-abuse"]'));
    await settle(app.fixture);
    const dialog = q('app-dialog-host dialog');
    expect(dialog?.textContent).toContain('proteger a pessoa idosa sem abandonar quem cuida');
    click(q('app-dialog-host [data-role="confirm"]'));
    await settle(app.fixture);
    expect(app.db.occurrences.size()).toBe(occurrencesBefore + 1);
    const occurrence = app.db.occurrences.all().at(-1);
    expect(occurrence?.kind).toBe('pop07_violence_suspicion');
    expect(occurrence?.caregiverId).toBe('cg_0015');
    expect(occurrence?.sourceComplaintId).toBe('rec_0005');
    expect(occurrence?.restrictedToUserIds).toContain('u2');
    expect(occurrence?.restrictedToUserIds).toContain('u5');
    expect(occurrence?.restrictedToUserIds).not.toContain('u7');
    expect(occurrence?.restrictedToUserIds).not.toContain('u1');
    const rec = app.db.complaints.require('rec_0005');
    expect(rec.suspectedElderAbuse).toBe(true);
    expect(rec.occurrenceId).toBe(occurrence?.id);
    expect(q('[data-role="sent-to-rt"]')?.textContent).toContain('Enviado ao responsável técnico');
    expect(q('[data-role="description-hidden"]')?.textContent).toContain('Enviado ao responsável técnico');
    expect(app.root.textContent).not.toContain(rec.description);
    expect(app.auth.can('occurrences', 'view')).toBe(false);
  });

  it('a gestão vê só o código e o texto oculto na reclamação, sem ações de tratamento sobre o texto', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/reclamacoes/rec_0001' });
    expect(q('[data-role="description-hidden"]')?.textContent).toContain('Texto oculto: pode identificar o titular');
    expect(q('[data-role="description"]')).toBeNull();
    expect(app.root.textContent).toContain('CUI-0027');
    expect(app.root.textContent).not.toContain('Elza Guimarães');
    expect(q('[data-role="grave-badge"]')?.textContent).toContain('Quebra de sigilo');
    expect(q('[data-role="grave-count"]')?.textContent?.trim()).toBe('3');
  });

  it('o responsável técnico vê só as graves e a de suspeita de violência, em modo leitura', async () => {
    app = await bootApp({ userId: 'u2', url: '/app/reclamacoes' });
    const protocols = all('tbody tr[data-row]').map((r) => r.querySelector('.row-link')?.textContent?.trim());
    expect(protocols.sort()).toEqual(['REC-0001', 'REC-0002', 'REC-0004']);
    expect(q('[data-role="new-complaint"]')).toBeNull();
    await go('/app/reclamacoes/rec_0004');
    expect(q('[data-role="abuse-badge"]')?.textContent).toContain('POP-07');
    expect(q('[data-role="actions"]')).toBeNull();
    await go('/app/reclamacoes/rec_0005');
    expect(app.root.textContent).toContain('Não encontramos esta reclamação');
  });

  it('responder, encerrar e marcar improcedente (com motivo obrigatório) seguem o fluxo de estados', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/reclamacoes/rec_0002' });
    expect(app.db.complaints.require('rec_0002').status).toBe('open');
    click(q('[data-role="start-analysis"]'));
    await settle(app.fixture);
    expect(app.db.complaints.require('rec_0002').status).toBe('in_progress');
    typeInto(q('#complaint-reply'), 'Recebemos o relato e já falamos com o profissional.');
    await settle(app.fixture);
    submit(q('[data-role="reply-form"]'));
    await settle(app.fixture);
    expect(app.db.complaints.require('rec_0002').status).toBe('answered');
    expect(app.db.complaints.require('rec_0002').events.at(-1)?.text).toContain('Resposta enviada');

    click(q('[data-role="close-complaint"]'));
    await settle(app.fixture);
    submit(q('#nx-closure-form'));
    await settle(app.fixture);
    expect(app.db.complaints.require('rec_0002').status).toBe('closed');

    await go('/app/reclamacoes/rec_0005');
    click(q('[data-role="dismiss-complaint"]'));
    await settle(app.fixture);
    submit(q('#nx-closure-form'));
    await settle(app.fixture);
    expect(q('#nx-closure-form .error-summary')?.textContent).toContain('Informe o motivo');
    expect(app.db.complaints.require('rec_0005').status).toBe('open');
    typeInto(q('#closure-text'), 'O atendimento aconteceu no horário combinado.');
    submit(q('#nx-closure-form'));
    await settle(app.fixture);
    expect(app.db.complaints.require('rec_0005').status).toBe('dismissed');
  });

  it('abrir reclamação a partir de uma mensagem traz canal, cuidador e texto', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/mensagens' });
    const message = app.db.messages.find((m) => m.direction === 'in' && m.caregiverId === 'cg_0021');
    await go(`/app/mensagens/${message?.id}`);
    click(q('[data-role="open-complaint"]'));
    await settle(app.fixture);
    expect(q<HTMLTextAreaElement>('#complaint-description')?.value).toBe(message?.body);
    expect(q<HTMLSelectElement>('#complaint-channel')?.value).toBe(message?.channel);
  });
});
