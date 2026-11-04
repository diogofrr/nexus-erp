import { DOCUMENT } from '@angular/common';
import { InjectionToken, inject } from '@angular/core';

/**
 * Navegação com recarga completa da página. Usada depois de "apagar todos os dados do navegador": a
 * recarga recria o seed na primeira visita e zera qualquer sinal em memória. Em testes, substitua por uma
 * função falsa (o jsdom não implementa navegação).
 */
export const HARD_NAVIGATE = new InjectionToken<(path: string) => void>('HARD_NAVIGATE', {
  providedIn: 'root',
  factory: () => {
    const doc = inject(DOCUMENT);
    return (path: string): void => {
      const view = doc.defaultView;
      if (view) {
        view.location.assign(new URL(path.replace(/^\//, ''), doc.baseURI).toString());
      }
    };
  },
});
