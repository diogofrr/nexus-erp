import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';

/** Pontos de quebra do shell (design system 3.8): menu em gaveta, trilho e menu completo. */
export const BREAKPOINT_LG = 1024;
export const BREAKPOINT_XL = 1280;

export type NavLayout = 'drawer' | 'rail' | 'full';

/**
 * Largura da janela em três faixas, para o menu lateral: gaveta abaixo de 1024 px, trilho de 1024 a
 * 1279 px e menu completo a partir de 1280 px. Usa `matchMedia` (os mesmos pontos do CSS); onde ele não
 * existe (testes em jsdom) assume a janela larga.
 */
@Injectable({ providedIn: 'root' })
export class ViewportService {
  private readonly doc = inject(DOCUMENT);
  private readonly layoutSignal = signal<NavLayout>('full');

  /** `drawer` (< 1024), `rail` (1024 a 1279) ou `full` (>= 1280). */
  readonly navLayout = this.layoutSignal.asReadonly();

  constructor() {
    const view = this.doc.defaultView;
    if (!view || typeof view.matchMedia !== 'function') {
      return;
    }
    const lg = view.matchMedia(`(min-width: ${BREAKPOINT_LG}px)`);
    const xl = view.matchMedia(`(min-width: ${BREAKPOINT_XL}px)`);
    const update = (): void =>
      this.layoutSignal.set(xl.matches ? 'full' : lg.matches ? 'rail' : 'drawer');
    update();
    lg.addEventListener('change', update);
    xl.addEventListener('change', update);
    inject(DestroyRef).onDestroy(() => {
      lg.removeEventListener('change', update);
      xl.removeEventListener('change', update);
    });
  }

  /** Para testes: define a faixa na mão. */
  set(layout: NavLayout): void {
    this.layoutSignal.set(layout);
  }
}
