/**
 * Leitura tipada do valor de um controle nativo a partir do evento (`input`, `change`), para telas que
 * guardam o estado em signals em vez de formulário reativo. Evita `$any` nos modelos.
 */
export function valueOf(event: Event): string {
  const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
  return target?.value ?? '';
}

/** Estado de uma caixa de marcação a partir do evento `change`. */
export function checkedOf(event: Event): boolean {
  return (event.target as HTMLInputElement | null)?.checked ?? false;
}
