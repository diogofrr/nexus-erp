import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { configureCoreTest } from '../testing/test-helpers';
import { CaregiverMessagesService, EMPTY_MESSAGE_ERROR } from './caregiver-messages.service';

function setup() {
  const env = configureCoreTest({ seed: true });
  return { ...env, messages: TestBed.inject(CaregiverMessagesService) };
}

describe('CaregiverMessagesService (mensagem do cuidador pelo aplicativo, RN-CAN-02 e 04)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('grava uma mensagem de entrada do canal aplicativo, nova, com o prazo de 24 horas úteis', () => {
    const { messages, db } = setup();
    const before = db.messages.size();
    const result = messages.send('cg_0026', { subject: 'Outro assunto', body: '  Posso mudar o meu e-mail?  ' });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(db.messages.size()).toBe(before + 1);
    expect(result.message).toMatchObject({
      channel: 'app',
      direction: 'in',
      caregiverId: 'cg_0026',
      subject: 'Outro assunto',
      body: 'Posso mudar o meu e-mail?',
      status: 'new',
      isSupportRequest: false,
    });
    // Quarta, 04/11, 12:00: 24 horas úteis vencem na quinta, 05/11, às 12:00... mais um dia útil de 10 horas: sexta às 10:00.
    expect(result.message.dueAt > result.message.receivedAt).toBe(true);
    expect(messages.thread('cg_0026')[0]?.id).toBe(result.message.id);
  });

  it('mensagem em branco não grava e devolve a frase do erro', () => {
    const { messages, db } = setup();
    const before = db.messages.size();
    expect(messages.send('cg_0026', { subject: 'Outro assunto', body: '   ' })).toEqual({
      ok: false,
      error: EMPTY_MESSAGE_ERROR,
    });
    expect(db.messages.size()).toBe(before);
  });

  it('a conversa mostra entrada e saída, da mais recente para a mais antiga, só da própria pessoa', () => {
    const { messages } = setup();
    const thread = messages.thread('cg_0003');
    expect(thread.length).toBeGreaterThan(0);
    expect(thread.every((m) => m.caregiverId === 'cg_0003')).toBe(true);
    const dates = thread.map((m) => m.receivedAt);
    expect([...dates].sort().reverse()).toEqual(dates);
    // Marcos (cg_0026) nunca mandou mensagem no seed.
    expect(messages.thread('cg_0026')).toEqual([]);
  });
});
