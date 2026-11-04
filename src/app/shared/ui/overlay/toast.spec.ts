import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastRegionComponent } from './toast-region.component';
import { TOAST_DEFAULT_MS, TOAST_MAX_STACK, TOAST_UNDO_MS, ToastService } from './toast.service';

describe('ToastService', () => {
  let toasts: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({});
    toasts = TestBed.inject(ToastService);
  });

  afterEach(() => {
    toasts.dismissAll();
    vi.useRealTimers();
  });

  it('fecha sozinho depois de 6 segundos', () => {
    toasts.success('Disponibilidade salva.');
    expect(toasts.toasts()).toHaveLength(1);
    vi.advanceTimersByTime(TOAST_DEFAULT_MS - 200);
    expect(toasts.toasts()).toHaveLength(1);
    vi.advanceTimersByTime(300);
    expect(toasts.toasts()).toHaveLength(0);
  });

  it('com "Desfazer" fica 10 segundos', () => {
    toasts.show({
      message: 'Mensagem atribuída.',
      action: { label: 'Desfazer', run: () => undefined },
    });
    vi.advanceTimersByTime(TOAST_DEFAULT_MS + 500);
    expect(toasts.toasts()).toHaveLength(1);
    vi.advanceTimersByTime(TOAST_UNDO_MS - TOAST_DEFAULT_MS);
    expect(toasts.toasts()).toHaveLength(0);
  });

  it('pausa a contagem enquanto o mouse ou o foco estão no toast e retoma depois', () => {
    const id = toasts.success('Sessão agendada.');
    vi.advanceTimersByTime(2000);
    toasts.hold(id); // mouse entra
    toasts.hold(id); // foco entra
    vi.advanceTimersByTime(30_000);
    expect(toasts.toasts()).toHaveLength(1);
    expect(toasts.remainingMs(id)).toBe(TOAST_DEFAULT_MS - 2000);
    toasts.release(id); // mouse sai, o foco ainda está dentro
    vi.advanceTimersByTime(30_000);
    expect(toasts.toasts()).toHaveLength(1);
    toasts.release(id); // foco sai
    vi.advanceTimersByTime(TOAST_DEFAULT_MS - 2000 + 200);
    expect(toasts.toasts()).toHaveLength(0);
  });

  it('empilha no máximo dois: o mais antigo sai quando chega o terceiro', () => {
    const a = toasts.success('A');
    toasts.success('B');
    toasts.success('C');
    const list = toasts.toasts();
    expect(list).toHaveLength(TOAST_MAX_STACK);
    expect(list.map((t) => t.message)).toEqual(['B', 'C']);
    expect(toasts.remainingMs(a)).toBeUndefined();
  });

  it('a ação roda uma vez e fecha o toast; Ctrl+Z equivale ao toast mais recente com ação', () => {
    const calls: string[] = [];
    toasts.show({ message: 'A', action: { label: 'Desfazer', run: () => calls.push('A') } });
    toasts.show({ message: 'B', action: { label: 'Desfazer', run: () => calls.push('B') } });
    expect(toasts.undoLatest()).toBe(true);
    expect(calls).toEqual(['B']);
    expect(toasts.toasts().map((t) => t.message)).toEqual(['A']);
    expect(toasts.undoLatest()).toBe(true);
    expect(calls).toEqual(['B', 'A']);
    expect(toasts.undoLatest()).toBe(false);
  });
});

describe('ToastRegionComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('mostra o toast numa região aria-live, com role status (ou alert no erro)', async () => {
    const fixture = TestBed.createComponent(ToastRegionComponent);
    const toasts = TestBed.inject(ToastService);
    toasts.success('Dados de demonstração restaurados.');
    toasts.error('Não foi possível salvar.');
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.toast-region')?.getAttribute('aria-live')).toBe('polite');
    const items = root.querySelectorAll('.toast');
    expect(items).toHaveLength(2);
    expect(items[0]?.getAttribute('role')).toBe('status');
    expect(items[1]?.getAttribute('role')).toBe('alert');
    toasts.dismissAll();
  });

  it('Ctrl+Z desfaz fora de campo de texto e é ignorado dentro dele', async () => {
    const fixture = TestBed.createComponent(ToastRegionComponent);
    const toasts = TestBed.inject(ToastService);
    let undone = 0;
    toasts.show({ message: 'Feito.', action: { label: 'Desfazer', run: () => (undone += 1) } });
    await fixture.whenStable();

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    expect(undone).toBe(0);

    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }),
    );
    expect(undone).toBe(1);
    input.remove();
    toasts.dismissAll();
  });
});
