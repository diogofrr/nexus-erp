import { Injectable, signal } from '@angular/core';

/**
 * Abre e fecha o diálogo "Como falar com a gente" (decisão 6 do contexto, UX A.2.16). O shell monta UMA instância
 * de `<app-cg-contact-dialog>`; qualquer tela abre por aqui (Hoje, Ajuda agora, Como estou, Mais, Falar com a
 * Nexus). Nenhum canal liga de verdade: o diálogo mostra o número, "Copiar número" e o aviso do protótipo.
 *
 * ```ts
 * inject(ContactDialogService).open();
 * ```
 */
@Injectable({ providedIn: 'root' })
export class ContactDialogService {
  private readonly openSignal = signal(false);
  readonly isOpen = this.openSignal.asReadonly();

  open(): void {
    this.openSignal.set(true);
  }

  close(): void {
    this.openSignal.set(false);
  }
}
