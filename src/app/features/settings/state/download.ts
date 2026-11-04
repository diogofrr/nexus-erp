/**
 * Entrega um texto como arquivo para baixar. Devolve `false` se o navegador não permitir (nunca lança).
 * O arquivo nasce no navegador: nada é enviado a servidor (AC-GL-11).
 */
export function downloadTextFile(
  doc: Document,
  fileName: string,
  text: string,
  mime = 'application/json',
): boolean {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const link = doc.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    doc.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}
