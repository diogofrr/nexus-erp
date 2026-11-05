import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { BootedApp, bootApp, settle } from '../../layout/testing';
import { MessagesService } from './state/messages.service';
import {
  firstNameOf,
  personalizeReply,
  suggestSubjectRequest,
  templateRelevance,
} from './state/message-view';

const click = (el: Element | null | undefined): void => {
  if (!el) {
    throw new Error('elemento não encontrado');
  }
  (el as HTMLElement).click();
};
const typeInto = (input: Element | null, value: string): void => {
  const field = input as HTMLInputElement | HTMLTextAreaElement;
  field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
};
const clean = (el: Element | null): string => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

async function boot(userId: string, url: string): Promise<BootedApp> {
  TestBed.resetTestingModule();
  const app = await bootApp({ userId, url });
  await settle(app.fixture);
  return app;
}

async function go(app: BootedApp, url: string): Promise<void> {
  await app.router.navigateByUrl(url);
  await settle(app.fixture);
}

describe('Modelos de resposta com o nome e para o assunto (CX-039)', () => {
  it('o primeiro nome entra na saudação e {nome} é substituído', () => {
    expect(firstNameOf('Patrícia Vilela')).toBe('Patrícia');
    expect(firstNameOf('   ')).toBeNull();
    expect(personalizeReply('Olá! Recebemos a sua mensagem.', 'Patrícia', false)).toBe('Olá, Patrícia! Recebemos a sua mensagem.');
    expect(personalizeReply('Entendemos que o momento está puxado.', 'Patrícia', false)).toBe('Olá, Patrícia. Entendemos que o momento está puxado.');
    expect(personalizeReply('Olá, {nome}! Tudo certo.', 'Patrícia', false)).toBe('Olá, Patrícia! Tudo certo.');
    expect(personalizeReply('Olá, {nome}! Tudo certo.', null, false)).toBe('Olá! Tudo certo.');
  });

  it('mensagem atrasada pede desculpas e não promete "o prazo combinado"', () => {
    const text = personalizeReply(
      'Olá! Recebemos a sua mensagem e vamos responder dentro do prazo combinado. Obrigada por falar com a Nexus.',
      'Patrícia',
      true,
    );
    expect(text).toBe(
      'Olá, Patrícia! Pedimos desculpas pela demora em responder. Recebemos a sua mensagem e já estamos cuidando dela. Obrigada por falar com a Nexus.',
    );
    // Sem duplicar o pedido de desculpas.
    expect(personalizeReply(text, 'Patrícia', true).match(/Pedimos desculpas/g)).toHaveLength(1);
  });

  it('o modelo mais indicado vem primeiro, pelo assunto e pelo texto da mensagem', () => {
    const plans = { title: 'Dúvida sobre planos' };
    const complaint = { title: 'Reclamação em análise' };
    expect(templateRelevance(plans, { subject: 'Valor da mensalidade', body: 'Quanto custa o plano?', isSupportRequest: false })).toBeGreaterThan(
      templateRelevance(complaint, { subject: 'Valor da mensalidade', body: 'Quanto custa o plano?', isSupportRequest: false }),
    );
    expect(templateRelevance({ title: 'Pedido de apoio recebido' }, { body: 'Estou muito cansada', isSupportRequest: true })).toBeGreaterThan(0);
  });

  it('pela tela: o modelo chega com o nome de quem escreveu', async () => {
    const app = await boot('u7', '/app/mensagens');
    const target = app.db.messages.find((m) => m.direction === 'in' && m.status !== 'answered' && m.caregiverId !== undefined && !app.db.messages.get(m.id)?.riskFlag);
    expect(target).toBeDefined();
    await go(app, `/app/mensagens/${target?.id}`);
    const chips = Array.from(app.root.querySelectorAll<HTMLElement>('[data-role="template"]'));
    click(chips[0]);
    await settle(app.fixture);
    const first = app.db.caregivers.get(target?.caregiverId ?? '')?.fullName.split(' ')[0];
    const box = app.root.querySelector<HTMLTextAreaElement>('[data-role="reply-body"]');
    expect(box?.value.startsWith(`Olá, ${first}`)).toBe(true);
    expect(clean(app.root.querySelector('[data-role="template-help"]'))).toContain('nome de quem escreveu');
  });
});

describe('Sinalizar risco: ajuda e "Em dúvida, avisar o RT" (CX-040)', () => {
  it('a tela dá exemplos do que costuma e do que não costuma ser risco, sem iniciar o POP-05 na dúvida', async () => {
    const app = await boot('u7', '/app/mensagens');
    const target = app.db.messages.find((m) => m.direction === 'in' && m.caregiverId === 'cg_0021' && !m.riskFlag);
    expect(target).toBeDefined();
    await go(app, `/app/mensagens/${target?.id}`);
    const help = clean(app.root.querySelector('[data-role="risk-help"]'));
    expect(help).toContain('Costuma ser risco');
    expect(help).toContain('Costuma não ser risco');
    expect(help).toContain('Em dúvida, use "Em dúvida, avisar o RT"');
    const occurrences = app.db.occurrences.size();
    click(app.root.querySelector('[data-role="flag-doubt"]'));
    await settle(app.fixture);
    const dialog = app.root.querySelector('app-dialog-host dialog');
    expect(clean(dialog)).toContain('Este aviso não inicia o POP-05 por si só');
    expect(clean(dialog)).toContain('SAMU (192)');
    click(app.root.querySelector('app-dialog-host [data-role="confirm"]'));
    await settle(app.fixture);
    await new Promise((resolve) => setTimeout(resolve, 30));
    await settle(app.fixture);
    const after = app.db.messages.require(target?.id as string);
    expect(after.riskFlag).toBe(true);
    expect(after.riskDoubt).toBe(true);
    // Nenhuma ocorrência foi aberta: o POP-05 só começa se a RT decidir.
    expect(app.db.occurrences.size()).toBe(occurrences);
    expect(clean(app.root.querySelector('[data-role="risk-note"]'))).toContain('Avisada à responsável técnica em dúvida');
  });

  it('a RT lê a mensagem e decide: inicia o POP-05 ou registra que não há risco', async () => {
    const app = await boot('u2', '/app/mensagens');
    const message = app.db.messages.find((m) => m.direction === 'in' && m.caregiverId === 'cg_0021' && !m.riskFlag);
    expect(message).toBeDefined();
    // O atendimento avisou em dúvida (feito pelo serviço, como a tela faz).
    app.db.messages.update(message?.id as string, { riskFlag: true, riskDoubt: true, status: 'in_progress' });
    await go(app, `/app/mensagens/${message?.id}`);
    expect(clean(app.root.querySelector('[data-role="doubt-decision"]'))).toContain('Você decide');
    const occurrences = app.db.occurrences.size();
    click(app.root.querySelector('[data-role="start-pop05"]'));
    await settle(app.fixture);
    expect(app.db.occurrences.size()).toBe(occurrences + 1);
    expect(app.db.messages.require(message?.id as string).riskDoubt).toBe(false);
    expect(app.root.querySelector('[data-role="doubt-decision"]')).toBeNull();
  });

  it('a RT pode registrar "avaliei e não há risco"; o atendimento nunca decide a dúvida', async () => {
    const app = await boot('u2', '/app/mensagens');
    const message = app.db.messages.find((m) => m.direction === 'in' && m.caregiverId === 'cg_0021' && !m.riskFlag);
    app.db.messages.update(message?.id as string, { riskFlag: true, riskDoubt: true });
    const service = TestBed.inject(MessagesService);
    service.resolveDoubt(message?.id as string, 'no_risk');
    const after = app.db.messages.require(message?.id as string);
    expect(after.riskFlag).toBe(false);
    expect(after.riskDoubt).toBe(false);
    const support = await boot('u7', '/app/mensagens');
    support.db.messages.update(message?.id as string, { riskFlag: true, riskDoubt: true });
    expect(() => TestBed.inject(MessagesService).resolveDoubt(message?.id as string, 'start_pop05')).toThrow();
  });
});

describe('Solicitação do titular a partir da mensagem (CX-035)', () => {
  it('sugere o tipo pelo texto e deixa a escolha vazia quando não há pista', () => {
    expect(suggestSubjectRequest({ subject: 'Correção de sobrenome', body: 'Meu sobrenome está errado.' })).toBe('correction');
    expect(suggestSubjectRequest({ body: 'Quero excluir meus dados.' })).toBe('erasure');
    expect(suggestSubjectRequest({ body: 'Bom dia, tudo bem?' })).toBeNull();
  });

  it('o atendimento registra a solicitação na própria mensagem, já com titular, canal e texto', async () => {
    const app = await boot('u7', '/app/mensagens');
    await go(app, '/app/mensagens/msg_0002');
    const button = app.root.querySelector('[data-role="open-subject-request"]');
    expect(clean(button)).toContain('Registrar solicitação do titular');
    click(button);
    await settle(app.fixture);
    const form = app.root.querySelector('[data-role="subject-request-form"]') as HTMLElement;
    const message = app.db.messages.require('msg_0002');
    expect((form.querySelector('[data-role="subject-channel"]') as HTMLInputElement).value.length).toBeGreaterThan(2);
    expect((form.querySelector('[data-role="subject-type"]') as HTMLSelectElement).value).toBe('correction');
    expect((form.querySelector('[data-role="subject-description"]') as HTMLTextAreaElement).value).toContain('Pedido recebido por');
    const before = app.db.dataSubjectRequests.size();
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await settle(app.fixture);
    expect(app.db.dataSubjectRequests.size()).toBe(before + 1);
    const created = app.db.dataSubjectRequests.all().at(-1);
    expect(created).toMatchObject({ caregiverId: message.caregiverId, type: 'correction', channel: message.channel, status: 'open' });
    expect(created?.description).toContain('Pedido recebido por');
    expect(app.root.querySelector('.toast')?.textContent).toContain(created?.protocol);
  });

  it('sem tipo escolhido a solicitação não é registrada, e só o atendimento vê o atalho', async () => {
    const app = await boot('u7', '/app/mensagens');
    const plain = app.db.messages.find((m) => m.direction === 'in' && m.caregiverId !== undefined && suggestSubjectRequest(m) === null);
    expect(plain).toBeDefined();
    await go(app, `/app/mensagens/${plain?.id}`);
    click(app.root.querySelector('[data-role="open-subject-request"]'));
    await settle(app.fixture);
    const form = app.root.querySelector('[data-role="subject-request-form"]') as HTMLElement;
    expect((form.querySelector('[data-role="subject-type"]') as HTMLSelectElement).value).toBe('');
    typeInto(form.querySelector('[data-role="subject-description"]'), 'Pedido recebido por telefone.');
    const before = app.db.dataSubjectRequests.size();
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await settle(app.fixture);
    expect(app.db.dataSubjectRequests.size()).toBe(before);
    expect(clean(form)).toContain('Escolha o que o titular pede.');
    const psychologist = await boot('u3', '/app/mensagens');
    const own = psychologist.db.messages.find((m) => m.direction === 'in' && m.caregiverId !== undefined && psychologist.db.caregivers.get(m.caregiverId)?.assignedPsychologistId === 'psy_0001');
    await go(psychologist, `/app/mensagens/${own?.id}`);
    expect(psychologist.root.querySelector('[data-role="open-subject-request"]')).toBeNull();
  });
});
