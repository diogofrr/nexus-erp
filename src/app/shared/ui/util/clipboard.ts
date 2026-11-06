/**
 * Copiar para a área de transferência, com o plano B do aplicativo do cuidador (UX A.2.16, D.6): o navegador pode
 * negar (navegador embutido, sem HTTPS), e então o texto fica SELECIONADO para a pessoa segurar e copiar à mão. É a
 * única implementação do app: telas e diálogos importam daqui. Recebem o `Document` (do `DOCUMENT` injetado), para não
 * tocar em globais, e nunca lançam.
 */

/**
 * Copia um texto para a área de transferência. Devolve `true` se copiou e `false` se o navegador negou ou não tem a
 * área de transferência (o navegador embutido, por exemplo): quem chama mostra o plano B (texto selecionável e a
 * frase "Segure sobre o texto e escolha Copiar"). Nunca lança.
 */
export async function copyToClipboard(text: string, doc: Document): Promise<boolean> {
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
export function selectContents(element: Element | null | undefined, doc: Document): void {
  const selection = doc.defaultView?.getSelection();
  if (!selection || !element) {
    return;
  }
  const range = doc.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);
}

/** Copia; se o navegador negar, deixa `element` selecionado e devolve `false`. */
export async function copyOrSelect(text: string, element: Element | null | undefined, doc: Document): Promise<boolean> {
  const copied = await copyToClipboard(text, doc);
  if (!copied) {
    selectContents(element, doc);
  }
  return copied;
}
