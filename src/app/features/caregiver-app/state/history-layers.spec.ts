import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HistoryLayersService } from './history-layers.service';

/** Espera o ciclo (a retirada da entrada é agendada) e os eventos assíncronos do histórico. */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 30));

describe('HistoryLayersService (o voltar do aparelho fecha a folha ou o passo, CXC-013)', () => {
  let layers: HistoryLayersService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    layers = TestBed.inject(HistoryLayersService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('abrir uma camada empurra UMA entrada de histórico, com o mesmo endereço e só um marcador', () => {
    const push = vi.spyOn(window.history, 'pushState');
    const before = window.location.href;
    layers.open('a', () => undefined);
    expect(push).toHaveBeenCalledTimes(1);
    expect(window.history.state).toEqual({ cgLayer: 'a' });
    expect(window.location.href).toBe(before);
    expect(layers.depth).toBe(1);
    // Abrir a mesma camada de novo não empurra outra entrada.
    layers.open('a', () => undefined);
    expect(push).toHaveBeenCalledTimes(1);
  });

  it('o voltar do aparelho desfaz a camada do topo e a tira da pilha', async () => {
    const closed: string[] = [];
    layers.open('folha', () => closed.push('folha'));
    window.history.back();
    await settle();
    expect(closed).toEqual(['folha']);
    expect(layers.depth).toBe(0);
  });

  it('com duas camadas, cada voltar desfaz uma, de cima para baixo', async () => {
    const closed: string[] = [];
    layers.open('passo', () => closed.push('passo'));
    layers.open('folha', () => closed.push('folha'));
    window.history.back();
    await settle();
    expect(closed).toEqual(['folha']);
    window.history.back();
    await settle();
    expect(closed).toEqual(['folha', 'passo']);
  });

  it('quando o app fecha a camada, a entrada é retirada e nada é desfeito de novo', async () => {
    const closed: string[] = [];
    const go = vi.spyOn(window.history, 'go');
    layers.open('folha', () => closed.push('folha'));
    layers.release('folha');
    expect(go).not.toHaveBeenCalled();
    await settle();
    expect(go).toHaveBeenCalledWith(-1);
    expect(closed).toEqual([]);
    expect(layers.depth).toBe(0);
  });

  it('duas camadas que se trocam no mesmo instante dividem a mesma entrada (sem voltar nem empurrar)', async () => {
    const push = vi.spyOn(window.history, 'pushState');
    const replace = vi.spyOn(window.history, 'replaceState');
    const go = vi.spyOn(window.history, 'go');
    layers.open('detalhe', () => undefined);
    layers.release('detalhe');
    layers.open('cancelar', () => undefined);
    await settle();
    expect(push).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(go).not.toHaveBeenCalled();
    expect(layers.isOpen('cancelar')).toBe(true);
  });

  it('se o roteador já foi a outra tela, a entrada não é retirada (a navegação não é desfeita)', async () => {
    const go = vi.spyOn(window.history, 'go');
    layers.open('folha', () => undefined);
    layers.release('folha');
    // O roteador navega no mesmo instante: a entrada atual já não é a nossa.
    window.history.pushState({ navigationId: 9 }, '');
    await settle();
    expect(go).not.toHaveBeenCalled();
  });

  it('esquecer uma camada (tela destruída) não mexe no histórico', async () => {
    const go = vi.spyOn(window.history, 'go');
    layers.open('folha', () => undefined);
    layers.forget('folha');
    await settle();
    expect(go).not.toHaveBeenCalled();
    expect(layers.depth).toBe(0);
  });

  it('goBack volta uma camada pelo histórico; sem camada, faz o plano B', async () => {
    const closed: string[] = [];
    const fallback = vi.fn();
    layers.goBack(fallback);
    expect(fallback).toHaveBeenCalledTimes(1);
    layers.open('passo', () => closed.push('passo'));
    layers.goBack(fallback);
    await settle();
    expect(closed).toEqual(['passo']);
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it('clear fecha todas de uma vez, sem desfazer nada na tela', async () => {
    const closed: string[] = [];
    const go = vi.spyOn(window.history, 'go');
    layers.open('a', () => closed.push('a'));
    layers.open('b', () => closed.push('b'));
    layers.clear();
    await settle();
    expect(go).toHaveBeenCalledWith(-2);
    expect(closed).toEqual([]);
    expect(layers.depth).toBe(0);
  });
});
