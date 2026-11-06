import { DestroyRef, Injectable, inject, signal } from '@angular/core';

export type ToastTone = 'success' | 'attention' | 'danger' | 'info';

export interface ToastAction {
  /** Verbo: "Desfazer", "Ver". */
  label: string;
  run: () => void;
}

export interface ToastOptions {
  /** A frase começa pelo resultado: "Sessão agendada para quinta, 06/11, às 14:00." */
  message: string;
  /** Linha de destaque opcional acima da mensagem. */
  title?: string;
  tone?: ToastTone;
  /** "Desfazer" (nível 1 do guia) ou "Ver". Também responde a Ctrl+Z enquanto o toast está aberto. */
  action?: ToastAction;
  /** Padrão: 6 s; com ação de desfazer, 10 s. */
  durationMs?: number;
}

export interface ToastItem {
  readonly id: number;
  readonly tone: ToastTone;
  readonly title?: string;
  readonly message: string;
  readonly action?: ToastAction;
  readonly durationMs: number;
}

/** Duração padrão do toast (design system 4.10): 6 segundos. */
export const TOAST_DEFAULT_MS = 6000;
/** Com ação de desfazer, mais tempo (UX 5.8, nível 1): 10 segundos. */
export const TOAST_UNDO_MS = 10000;
/** No máximo 2 toasts empilhados (UX 5.11). */
export const TOAST_MAX_STACK = 2;
const TICK_MS = 100;

/** Regras de um aplicativo para o aviso rápido: quantos ficam na tela e por quanto tempo. */
export interface ToastProfile {
  /** Quantos avisos cabem ao mesmo tempo; o mais antigo sai quando chega outro. */
  readonly maxStack: number;
  /** Duração quando o aviso não pede outra (e não tem "Desfazer"). */
  readonly defaultMs: number;
  /** Duração do aviso que tem "Desfazer". */
  readonly undoMs: number;
}

const STANDARD_PROFILE: ToastProfile = {
  maxStack: TOAST_MAX_STACK,
  defaultMs: TOAST_DEFAULT_MS,
  undoMs: TOAST_UNDO_MS,
};

/**
 * Toasts: confirmação leve de ação concluída, sem tirar a pessoa da tela. Nunca para erro que exija
 * leitura calma (use `BannerComponent`).
 *
 * - 6 segundos (10 com "Desfazer"); pausa com o mouse em cima e com o foco dentro (WCAG 2.2.1).
 * - No máximo 2 empilhados: o mais antigo sai quando chega o terceiro.
 * - `role="status"` por padrão; tom `danger` usa `role="alert"`.
 *
 * ```ts
 * this.toasts.show({ message: 'Disponibilidade salva.', action: { label: 'Desfazer', run: () => this.undo() } });
 * this.toasts.success('Dados de demonstração restaurados.');
 * ```
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private readonly itemsSignal = signal<readonly ToastItem[]>([]);
  /** Tempo que falta, por toast (fora de signal: muda a cada 100 ms e a tela não precisa reagir). */
  private readonly remaining = new Map<number, number>();
  /** Quantas razões de pausa (mouse, foco) estão ativas por toast. */
  private readonly holds = new Map<number, number>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private profile: ToastProfile = STANDARD_PROFILE;

  readonly toasts = this.itemsSignal.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopTimer());
  }

  /**
   * Troca as regras do aviso rápido enquanto um aplicativo está aberto (o do cuidador mostra um aviso por vez, por 8 s).
   * Devolve a função que volta ao que havia; o chamador a roda ao sair. Se já há mais avisos do que o novo limite, os
   * mais antigos saem.
   */
  useProfile(profile: ToastProfile): () => void {
    const previous = this.profile;
    this.profile = profile;
    this.trimTo(profile.maxStack);
    return () => {
      if (this.profile === profile) {
        this.profile = previous;
      }
    };
  }

  show(options: ToastOptions): number {
    const tone = options.tone ?? 'success';
    const durationMs =
      options.durationMs ?? (options.action ? this.profile.undoMs : this.profile.defaultMs);
    const item: ToastItem = {
      id: this.nextId++,
      tone,
      message: options.message,
      durationMs,
      ...(options.title ? { title: options.title } : {}),
      ...(options.action ? { action: options.action } : {}),
    };
    this.remaining.set(item.id, durationMs);
    this.itemsSignal.set([...this.itemsSignal(), item]);
    // Excedente sai pelo mais antigo.
    this.trimTo(this.profile.maxStack);
    this.ensureTimer();
    return item.id;
  }

  success(message: string, action?: ToastAction): number {
    return this.show({ message, tone: 'success', ...(action ? { action } : {}) });
  }

  attention(message: string): number {
    return this.show({ message, tone: 'attention' });
  }

  error(message: string): number {
    return this.show({ message, tone: 'danger' });
  }

  dismiss(id: number): void {
    if (!this.itemsSignal().some((t) => t.id === id)) {
      return;
    }
    this.forget(id);
    this.itemsSignal.update((list) => list.filter((t) => t.id !== id));
    if (this.itemsSignal().length === 0) {
      this.stopTimer();
    }
  }

  dismissAll(): void {
    this.itemsSignal().forEach((t) => this.forget(t.id));
    this.itemsSignal.set([]);
    this.stopTimer();
  }

  /** Executa a ação do toast e o fecha. */
  runAction(id: number): void {
    const item = this.itemsSignal().find((t) => t.id === id);
    if (!item?.action) {
      return;
    }
    this.dismiss(id);
    item.action.run();
  }

  /** Ctrl+Z: desfaz o toast MAIS RECENTE que tem ação. Devolve `true` se havia algum. */
  undoLatest(): boolean {
    const latest = [...this.itemsSignal()].reverse().find((t) => t.action !== undefined);
    if (!latest) {
      return false;
    }
    this.runAction(latest.id);
    return true;
  }

  /** Pausa a contagem (mouse em cima ou foco dentro). Cada `hold` precisa de um `release`. */
  hold(id: number): void {
    this.holds.set(id, (this.holds.get(id) ?? 0) + 1);
  }

  release(id: number): void {
    const count = (this.holds.get(id) ?? 0) - 1;
    if (count <= 0) {
      this.holds.delete(id);
    } else {
      this.holds.set(id, count);
    }
  }

  isHeld(id: number): boolean {
    return (this.holds.get(id) ?? 0) > 0;
  }

  /** Tempo que falta para o toast fechar (para testes). */
  remainingMs(id: number): number | undefined {
    return this.remaining.get(id);
  }

  private tick(): void {
    const expired: number[] = [];
    this.remaining.forEach((left, id) => {
      if (this.isHeld(id)) {
        return;
      }
      const next = left - TICK_MS;
      this.remaining.set(id, next);
      if (next <= 0) {
        expired.push(id);
      }
    });
    expired.forEach((id) => this.dismiss(id));
  }

  private trimTo(max: number): void {
    const list = [...this.itemsSignal()];
    if (list.length <= max) {
      return;
    }
    while (list.length > max) {
      const dropped = list.shift();
      if (dropped) {
        this.forget(dropped.id);
      }
    }
    this.itemsSignal.set(list);
  }

  private forget(id: number): void {
    this.remaining.delete(id);
    this.holds.delete(id);
  }

  private ensureTimer(): void {
    if (this.timer === null) {
      this.timer = setInterval(() => this.tick(), TICK_MS);
    }
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
