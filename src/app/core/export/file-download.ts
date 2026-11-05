/**
 * Entrega um texto como arquivo para baixar (CSV, JSON). O arquivo nasce no navegador: nada é enviado a
 * servidor (AC-GL-11). Devolve `false` se o navegador não permitir; nunca lança.
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

/** Escapa uma célula de CSV (separador `;`, como o Excel em pt-BR) e neutraliza fórmulas de planilha. */
export function csvText(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[;"\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Monta um CSV com cabeçalho. Células são sempre texto escapado. */
export function buildCsv(header: readonly string[], rows: readonly (readonly string[])[]): string {
  return [header, ...rows].map((line) => line.map((cell) => csvText(cell)).join(';')).join('\n');
}
