/**
 * Ajudantes do `<dialog>` modal nativo (diálogo, gaveta, paleta de comandos).
 *
 * O `showModal()` nativo já prende o foco, fecha com Esc e coloca o diálogo acima de tudo. Estes ajudantes
 * acrescentam duas coisas: (1) devolvem o foco a quem abriu, mesmo se o navegador não fizer isso, e
 * (2) funcionam onde `showModal` não existe (o jsdom dos testes), apenas marcando o atributo `open`.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Quem tinha o foco antes de abrir, guardado por diálogo. */
const openers = new WeakMap<HTMLDialogElement, HTMLElement | null>();

function activeElementOf(dialog: HTMLDialogElement): HTMLElement | null {
  const active = dialog.ownerDocument.activeElement;
  return active instanceof HTMLElement && active !== dialog.ownerDocument.body ? active : null;
}

/** Abre como modal (foco preso, Esc, camada superior). Guarda quem tinha o foco. */
export function showModalDialog(dialog: HTMLDialogElement): void {
  if (isDialogOpen(dialog)) {
    return;
  }
  openers.set(dialog, activeElementOf(dialog));
  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }
}

/** Fecha e devolve o foco a quem abriu. */
export function closeModalDialog(dialog: HTMLDialogElement, returnValue = ''): void {
  if (!isDialogOpen(dialog)) {
    return;
  }
  if (typeof dialog.close === 'function') {
    dialog.close(returnValue);
  } else {
    dialog.removeAttribute('open');
    dialog.dispatchEvent(new Event('close'));
  }
  restoreFocus(dialog);
}

/** Devolve o foco ao elemento que o tinha antes da abertura (se ele ainda existe na página). */
export function restoreFocus(dialog: HTMLDialogElement): void {
  const opener = openers.get(dialog);
  openers.delete(dialog);
  if (opener && opener.isConnected) {
    opener.focus();
  }
}

export function isDialogOpen(dialog: HTMLDialogElement): boolean {
  return dialog.hasAttribute('open');
}

/** Elementos focáveis dentro de um contêiner, na ordem do documento. */
export function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
}

/** Foca o primeiro elemento que casa com o seletor; se não houver, o primeiro focável. */
export function focusFirst(container: HTMLElement, preferred?: string): void {
  const target =
    (preferred ? container.querySelector<HTMLElement>(preferred) : null) ??
    focusableIn(container)[0] ??
    null;
  target?.focus();
}

/** O foco está num campo onde digitar é o esperado (atalhos de uma tecla não valem aí)? */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  const tag = target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') {
    return true;
  }
  if (tag === 'INPUT') {
    const type = (target as HTMLInputElement).type;
    return !['button', 'checkbox', 'radio', 'submit', 'reset', 'range', 'color', 'file'].includes(
      type,
    );
  }
  return false;
}
