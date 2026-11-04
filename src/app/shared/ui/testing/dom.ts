import { TestBed } from '@angular/core/testing';
import { AuthService } from '@core/auth';

/**
 * Ajudantes de teste dos componentes (DOM sem biblioteca). Só para `*.spec.ts`: nada daqui entra no bundle
 * porque nenhum código do app importa este arquivo.
 */

/** Primeiro elemento que casa, ou erro com o seletor (falha clara no teste). */
export function pick<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Elemento não encontrado: ${selector}`);
  }
  return element;
}

export function pickAll<T extends Element = HTMLElement>(root: ParentNode, selector: string): T[] {
  return Array.from(root.querySelectorAll<T>(selector));
}

/** Digita num campo e dispara `input`. */
export function typeInto(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

export function press(element: Element, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  element.dispatchEvent(event);
  return event;
}

export function text(element: Element): string {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Troca `window.matchMedia` para simular o celular (`true`) ou o computador. Devolve a função que restaura. */
export function stubMatchMedia(matches: boolean): () => void {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}

/** Entra com um dos usuários do seed (`u1` sócia, `u7` atendimento, `u10` prestadora...) e confirma o 2FA. */
export function loginAs(userId: string): void {
  const auth = TestBed.inject(AuthService);
  auth.selectProfile(userId);
  if (auth.isPendingTwoFactor()) {
    auth.verifyTwoFactor('123456');
  }
}
