import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { StorageService } from '../../core/storage/storage.service';
import { BannerComponent } from '../../shared/ui/overlay/banner.component';

/**
 * Faixas de sistema no topo do conteúdo (UX 5.15): "sem internet" (o protótipo continua funcionando porque
 * os dados ficam no navegador) e os avisos do armazenamento (cota cheia, armazenamento bloqueado, dado
 * corrompido). Erro de sistema nunca vai só para toast: fica numa faixa com a causa e o que fazer.
 */
@Component({
  selector: 'app-system-banners',
  imports: [BannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'system-banners' },
  template: `
    @if (offline()) {
      <app-banner variant="attention" heading="Você está sem internet">
        O protótipo continua funcionando, porque os dados ficam neste navegador.
      </app-banner>
    }
    @for (notice of storage.notices(); track notice.kind + (notice.name ?? '')) {
      <app-banner
        [variant]="
          notice.kind === 'quota_exceeded' || notice.kind === 'unavailable' ? 'danger' : 'attention'
        "
        [dismissible]="true"
        (dismissed)="storage.dismissNotice(notice)"
      >
        {{ notice.message }}
      </app-banner>
    }
  `,
})
export class SystemBannersComponent {
  protected readonly storage = inject(StorageService);
  private readonly doc = inject(DOCUMENT);
  protected readonly offline = signal(false);

  constructor() {
    const view = this.doc.defaultView;
    if (view && typeof view.addEventListener === 'function') {
      const sync = (): void => this.offline.set(view.navigator.onLine === false);
      sync();
      view.addEventListener('online', sync);
      view.addEventListener('offline', sync);
      inject(DestroyRef).onDestroy(() => {
        view.removeEventListener('online', sync);
        view.removeEventListener('offline', sync);
      });
    }
  }
}
