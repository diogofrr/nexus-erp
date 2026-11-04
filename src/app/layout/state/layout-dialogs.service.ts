import { Injectable, signal } from '@angular/core';

/**
 * Abre os diálogos informativos do rodapé e da ajuda: "Atalhos" (tecla `?`) e "Sobre". O desenho vive no
 * `LayoutDialogsComponent`, montado no shell.
 */
@Injectable({ providedIn: 'root' })
export class LayoutDialogsService {
  readonly shortcutsOpen = signal(false);
  readonly aboutOpen = signal(false);

  openShortcuts(): void {
    this.shortcutsOpen.set(true);
  }

  openAbout(): void {
    this.aboutOpen.set(true);
  }
}
