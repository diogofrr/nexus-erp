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
