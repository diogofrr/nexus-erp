import { DOCUMENT } from '@angular/common';
import { DestroyRef, Signal, inject, signal } from '@angular/core';

/** Abaixo de 768 px (`md`): o design system troca tabela por cartões, kanban por acordeão, agenda por dia. */
export const MOBILE_QUERY = '(max-width: 767.98px)';

/**
 * Sinal que acompanha uma media query. Chame em contexto de injeção (construtor ou inicializador de campo).
 * Sem `matchMedia` (testes em jsdom) fica `false`.
 */
export function mediaQuery(query: string): Signal<boolean> {
  const state = signal(false);
  const win = inject(DOCUMENT).defaultView;
  if (win && typeof win.matchMedia === 'function') {
    const list = win.matchMedia(query);
    state.set(list.matches);
    const onChange = (event: MediaQueryListEvent): void => state.set(event.matches);
    list.addEventListener('change', onChange);
    inject(DestroyRef).onDestroy(() => list.removeEventListener('change', onChange));
  }
  return state.asReadonly();
}
