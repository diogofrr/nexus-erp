/**
 * Copiar texto para a área de transferência, com o plano B do aplicativo do cuidador (UX A.2.16, D.6): o navegador
 * pode negar (navegador embutido, sem HTTPS), e então o texto fica SELECIONADO para a pessoa segurar e copiar à mão.
 * Funções que recebem o `Document`, para não tocar em globais.
 */

/** Tenta copiar. `true` se copiou; `false` se o navegador negou ou não tem área de transferência. */
export async function copyToClipboard(doc: Document, text: string): Promise<boolean> {
  try {
    const clipboard = doc.defaultView?.navigator.clipboard;
    if (!clipboard) {
      return false;
    }
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Seleciona o conteúdo de um elemento (plano B quando copiar não deu). */
export function selectContents(doc: Document, element: Element | null | undefined): void {
  const selection = doc.defaultView?.getSelection();
  if (!selection || !element) {
    return;
  }
  const range = doc.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);
}
