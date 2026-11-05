import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';

/**
 * A pessoa está com conexão? Só para dizer, sem alarme, que os dados continuam neste navegador ("Você está sem
 * conexão. Seus dados continuam neste navegador."): o protótipo guarda tudo no aparelho e não precisa de rede.
 * Acrescentado por P1 (Hoje e Agenda usam); a Base pode mover para o shell se quiser.
 */
@Injectable({ providedIn: 'root' })
export class OnlineStatusService {
  private readonly doc = inject(DOCUMENT);
  private readonly view = this.doc.defaultView;

  private readonly onlineSignal = signal(this.view?.navigator.onLine ?? true);
  /** `false` enquanto o navegador diz que está sem rede. */
  readonly online = this.onlineSignal.asReadonly();

  constructor() {
    const view = this.view;
    if (!view) {
      return;
    }
    const goOnline = (): void => this.onlineSignal.set(true);
    const goOffline = (): void => this.onlineSignal.set(false);
    view.addEventListener('online', goOnline);
    view.addEventListener('offline', goOffline);
    inject(DestroyRef).onDestroy(() => {
      view.removeEventListener('online', goOnline);
      view.removeEventListener('offline', goOffline);
    });
  }
}
