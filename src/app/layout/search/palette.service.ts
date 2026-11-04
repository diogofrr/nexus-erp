import { Injectable, signal } from '@angular/core';

/** Abre e fecha a paleta de comandos (`Ctrl+K`). O desenho está no `CommandPaletteComponent`. */
@Injectable({ providedIn: 'root' })
export class PaletteService {
  readonly isOpen = signal(false);

  open(): void {
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  toggle(): void {
    this.isOpen.update((v) => !v);
  }
}
