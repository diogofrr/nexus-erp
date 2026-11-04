import { ChangeDetectionStrategy, Component, effect, inject, untracked } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { RECENTS_KEY } from './core/search/recents';
import { StorageService } from './core/storage/storage.service';
import { PageChromeService } from './layout/state/page-chrome.service';
import { ConsentBannerComponent } from './shared/ui/overlay/consent-banner.component';
import { DialogHostComponent } from './shared/ui/overlay/dialog-host.component';
import { DialogService } from './shared/ui/overlay/dialog.service';
import { SessionDialogComponent } from './shared/ui/overlay/session-dialog.component';
import { ToastRegionComponent } from './shared/ui/overlay/toast-region.component';

/**
 * Raiz do aplicativo. O `<router-outlet>` mostra o shell certo de cada área (equipe em `/app/**`, portal em
 * `/portal/**`, nenhum na entrada). Aqui ficam as sobreposições que valem para toda tela: região de toasts,
 * diálogo de confirmação, aviso de sessão expirando e banner da primeira visita.
 *
 * Também liga o título da aba e o foco no `h1` a cada navegação (`PageChromeService`) e leva à tela de sessão
 * expirada quando a inatividade encerra a sessão (AC-M01-07).
 */
@Component({
  imports: [
    RouterOutlet,
    ToastRegionComponent,
    DialogHostComponent,
    SessionDialogComponent,
    ConsentBannerComponent,
  ],
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dialogs = inject(DialogService);
  private readonly storage = inject(StorageService);

  constructor() {
    inject(PageChromeService).start();

    // Sessão encerrada por inatividade: guarda onde a pessoa estava (volta ao mesmo lugar se entrar com o
    // mesmo perfil, A-03) e mostra a tela de sessão expirada. O rascunho em andamento fica guardado.
    effect(() => {
      const reason = this.auth.endReason();
      const authenticated = this.auth.isAuthenticated();
      untracked(() => {
        if (reason !== 'inactivity' || authenticated) {
          return;
        }
        this.dialogs.cancelAll();
        // Os recentes da busca somem ao sair (LP-22), inclusive quando a sessão cai por inatividade.
        this.storage.removeSession(RECENTS_KEY);
        const url = this.router.url;
        if (!url.startsWith('/login')) {
          this.auth.setReturnUrl(url);
          void this.router.navigateByUrl('/login/expirada');
        }
      });
    });
  }
}
