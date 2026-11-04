import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { configureCoreTest } from '@core/testing/test-helpers';
import { DraftService } from '../forms/draft.service';
import { loginAs, pick, pickAll, press, stubMatchMedia, text } from '../testing/dom';
import { WizardAnswers, WizardComponent, WizardItem } from './wizard.component';

const LABELS = ['Nunca', 'Raramente', 'Algumas vezes', 'Frequentemente', 'Sempre ou quase sempre'];
const ITEMS: WizardItem[] = ['Sinto que preciso de mais ajuda.', 'Tenho receio do que o futuro reserva.', 'Sinto-me cansada.'].map(
  (question, i) => ({
    id: `q${i + 1}`,
    question,
    hint: i === 1 ? 'Pense nas últimas semanas.' : undefined,
    options: LABELS.map((label, value) => ({ value, label })),
  }),
);

@Component({
  imports: [WizardComponent],
  template: `
    <app-wizard [items]="items" [(answers)]="answers" [(index)]="index" draftForm="zarit" draftId="cg_0001"
               (completed)="done.push($event)" (exited)="left.push($event)" />
  `,
})
class HostComponent {
  readonly items = ITEMS;
  readonly answers = signal<WizardAnswers>({});
  readonly index = signal(0);
  readonly done: WizardAnswers[] = [];
  readonly left: WizardAnswers[] = [];
}

function setup(prepare?: () => void) {
  const env = configureCoreTest({ seed: true, today: '2026-11-04', time: '14:32' });
  loginAs('u3');
  prepare?.();
  const fixture = TestBed.createComponent(HostComponent);
  document.body.appendChild(fixture.nativeElement as HTMLElement);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const radios = () => pickAll<HTMLInputElement>(root, '.likert input[type="radio"]');
  const next = () => pickAll<HTMLButtonElement>(root, '.wizard__foot .btn').find((b) => text(b).startsWith('Próximo') || text(b) === 'Concluir') as HTMLButtonElement;
  return { ...env, fixture, host: fixture.componentInstance, root, radios, next, drafts: TestBed.inject(DraftService) };
}

describe('WizardComponent (um item por tela)', () => {
  afterEach(() => document.body.replaceChildren());

  it('mostra "Item 1 de 3", a pergunta em serifa, a dica e cinco opções de 0 a 4 sem nada marcado', () => {
    const { root, radios } = setup();
    expect(text(pick(root, '.wizard__count span'))).toBe('Item 1 de 3');
    expect(text(pick(root, '.wizard__question'))).toBe('Sinto que preciso de mais ajuda.');
    expect(radios()).toHaveLength(5);
    expect(radios().some((r) => r.checked)).toBe(false);
    expect(radios().map((r) => r.getAttribute('aria-label'))).toEqual([
      '0, nunca', '1, raramente', '2, algumas vezes', '3, frequentemente', '4, sempre ou quase sempre',
    ]);
    expect(pick(root, '[role="progressbar"]').getAttribute('aria-label')).toBe('0 de 3 itens respondidos');
    expect(root.querySelector('.wizard__status .icon')).toBeNull();
  });

  it('responder atualiza as respostas, o progresso e salva o rascunho com a hora', () => {
    const { fixture, host, root, radios, drafts } = setup();
    radios()[3]?.click();
    fixture.detectChanges();
    expect(host.answers()).toEqual({ q1: 3 });
    expect(pick(root, '[role="progressbar"]').getAttribute('aria-label')).toBe('1 de 3 itens respondidos');
    expect(text(pick(root, '.wizard__count .wizard__status'))).toBe('Rascunho salvo às 14:32');
    expect(drafts.load('zarit', 'cg_0001')?.data).toEqual({ answers: { q1: 3 }, index: 0 });
  });

  it('as teclas 0 a 4 respondem e as setas mudam de item (fora de campo)', () => {
    const { fixture, host, root } = setup();
    press(document.body, '2');
    fixture.detectChanges();
    expect(host.answers()).toEqual({ q1: 2 });
    press(document.body, 'ArrowRight');
    fixture.detectChanges();
    expect(host.index()).toBe(1);
    expect(text(pick(root, '.wizard__question'))).toBe('Tenho receio do que o futuro reserva.');
    expect(text(pick(root, '.wizard__hint'))).toBe('Pense nas últimas semanas.');
    press(document.body, 'ArrowLeft');
    fixture.detectChanges();
    expect(host.index()).toBe(0);
    // dentro de um campo de texto as teclas não disparam
    const input = document.createElement('input');
    document.body.appendChild(input);
    press(input, '4');
    expect(host.answers()).toEqual({ q1: 2 });
  });

  it('sem avançar sozinho por padrão; com o interruptor ligado avança ao responder, menos no último item', () => {
    const { fixture, host, root, radios } = setup();
    radios()[1]?.click();
    fixture.detectChanges();
    expect(host.index()).toBe(0);
    pick<HTMLInputElement>(root, 'app-switch input').click();
    fixture.detectChanges();
    radios()[2]?.click();
    fixture.detectChanges();
    expect(host.index()).toBe(1);
    radios()[0]?.click();
    fixture.detectChanges();
    expect(host.index()).toBe(2);
    radios()[4]?.click();
    fixture.detectChanges();
    expect(host.index()).toBe(2);
    expect(host.answers()).toEqual({ q1: 2, q2: 0, q3: 4 });
  });

  it('mapa dos itens: respondido, atual e sem resposta (só do que ficou para trás)', () => {
    const { fixture, root, radios, next } = setup();
    radios()[4]?.click();
    next().click();
    fixture.detectChanges();
    next().click(); // vai ao item 3 sem responder o 2
    fixture.detectChanges();
    const map = pickAll<HTMLButtonElement>(root, '.item-map__btn');
    expect(map).toHaveLength(3);
    expect(map[0]?.className).toContain('is-done');
    expect(map[1]?.className).toContain('is-missing');
    expect(map[1]?.getAttribute('aria-label')).toBe('Item 2, sem resposta');
    expect(map[2]?.getAttribute('aria-current')).toBe('step');
    expect(text(pick(root, 'summary'))).toBe('Mapa dos itens (2 sem resposta)');
    map[1]?.click();
    fixture.detectChanges();
    expect(text(pick(root, '.wizard__count span'))).toBe('Item 2 de 3');
  });

  it('Concluir só conclui com tudo respondido e diz o que falta, sem botão mudo', () => {
    const { fixture, host, root, radios, next } = setup();
    radios()[0]?.click();
    next().click();
    fixture.detectChanges();
    next().click();
    fixture.detectChanges();
    const finish = next();
    expect(text(finish)).toBe('Concluir');
    expect(finish.getAttribute('aria-disabled')).toBe('true');
    expect(text(pick(root, '.wizard__foot .wizard__status'))).toBe('Faltam os itens 2 e 3.');
    finish.click();
    fixture.detectChanges();
    expect(host.done).toHaveLength(0);
    expect(host.index()).toBe(1); // leva ao primeiro item que falta
    radios()[3]?.click();
    next().click();
    fixture.detectChanges();
    pickAll<HTMLInputElement>(root, '.likert input')[1]?.click();
    fixture.detectChanges();
    expect(text(pick(root, '.wizard__foot .wizard__status'))).toBe('Resultado e faixa só aparecem ao concluir.');
    expect(next().getAttribute('aria-disabled')).toBeNull();
    next().click();
    fixture.detectChanges();
    expect(host.done).toEqual([{ q1: 0, q2: 3, q3: 1 }]);
  });

  it('concluir apaga o rascunho; "Salvar e sair" guarda e emite', () => {
    const { fixture, host, root, radios, next, drafts } = setup();
    radios()[2]?.click();
    pickAll<HTMLButtonElement>(root, '.wizard__foot .btn').find((b) => text(b) === 'Salvar e sair')?.click();
    fixture.detectChanges();
    expect(host.left).toEqual([{ q1: 2 }]);
    expect(drafts.load('zarit', 'cg_0001')).not.toBeNull();
    // preenche tudo e conclui
    const step = (action: () => void): void => {
      action();
      fixture.detectChanges();
    };
    step(() => next().click());
    step(() => radios()[1]?.click());
    step(() => next().click());
    step(() => radios()[1]?.click());
    step(() => next().click());
    expect(host.done).toEqual([{ q1: 2, q2: 1, q3: 1 }]);
    expect(drafts.load('zarit', 'cg_0001')).toBeNull();
  });

  it('ao voltar oferece o rascunho com os dois botões de mesmo peso: retomar ou começar de novo', () => {
    const { fixture, host, root, drafts } = setup(() => {
      TestBed.inject(DraftService).save('zarit', 'cg_0001', { answers: { q1: 4, q2: 1 }, index: 2 });
    });
    expect(text(pick(root, '.banner__title'))).toBe('Retomar rascunho?');
    expect(text(pick(root, '.banner__text'))).toContain('hoje, 14:32');
    const buttons = pickAll<HTMLButtonElement>(root, '.banner__actions .btn');
    expect(buttons.map((b) => text(b))).toEqual(['Retomar rascunho', 'Começar de novo']);
    expect(buttons[0]?.className).toBe(buttons[1]?.className);
    buttons[0]?.click();
    fixture.detectChanges();
    expect(host.answers()).toEqual({ q1: 4, q2: 1 });
    expect(host.index()).toBe(2);
    expect(root.querySelector('.banner')).toBeNull();
    expect(text(pick(root, '.wizard__count .wizard__status'))).toBe('Rascunho salvo às 14:32');
    expect(drafts.load('zarit', 'cg_0001')).not.toBeNull();
  });

  it('"Começar de novo" descarta o rascunho', () => {
    const { fixture, host, root, drafts } = setup(() => {
      TestBed.inject(DraftService).save('zarit', 'cg_0001', { answers: { q1: 4 }, index: 1 });
    });
    pickAll<HTMLButtonElement>(root, '.banner__actions .btn')[1]?.click();
    fixture.detectChanges();
    expect(host.answers()).toEqual({});
    expect(drafts.load('zarit', 'cg_0001')).toBeNull();
  });

  it('o mapa dos itens fica recolhido no celular', () => {
    const restore = stubMatchMedia(true);
    const { root } = setup();
    expect(pick<HTMLDetailsElement>(root, 'details.chart-alt').open).toBe(false);
    restore();
  });
});

describe('DraftService', () => {
  it('guarda por usuário na chave nexus-erp:draft:<form>:<usuário>:<id> e some ao limpar', () => {
    const env = configureCoreTest({ seed: true });
    loginAs('u3');
    const drafts = TestBed.inject(DraftService);
    expect(drafts.keyOf('zarit', 'cg_0001')).toBe('draft:zarit:u3:cg_0001');
    drafts.save('zarit', 'cg_0001', { n: 1 });
    expect(env.local.data.has('nexus-erp:draft:zarit:u3:cg_0001')).toBe(true);
    loginAs('u4');
    expect(drafts.load('zarit', 'cg_0001')).toBeNull();
    loginAs('u3');
    expect(drafts.load<{ n: number }>('zarit', 'cg_0001')?.data).toEqual({ n: 1 });
    drafts.clear('zarit', 'cg_0001');
    expect(drafts.load('zarit', 'cg_0001')).toBeNull();
  });
});
