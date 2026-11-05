import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { FIRST_VISIT_NOTICE, UiNoticeService } from '../../../core/privacy/browser-data.service';
import { IconComponent } from '../display/icon.component';

/**
 * Banner da primeira visita (LP-01, UX 6.7): três frases e dois botões, no canto inferior esquerdo em telas
 * largas. Não bloqueia o uso. "Entendi" grava `ui-notice` pelo `UiNoticeService` e o banner não volta; "Ver
 * detalhes" abre as instruções de como apagar tudo. Monte UMA vez, na raiz.
 *
 * QA-003: abaixo de 1024 px ele entra no fluxo da página (CSS `.banner--dock`), sem cobrir o conteúdo. Nas telas de
 * entrada (`/login`, segundo fator) ele não aparece: a própria tela já mostra o aviso de protótipo e a pessoa não
 * precisa fechar nada para digitar o código; ele vem na primeira tela de dentro.
 */
@Component({
  selector: 'app-consent-banner',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <section class="banner banner--consent banner--dock" role="region" aria-labelledby="nx-consent-title">
        <svg appIcon="shield-check" size="lg"></svg>
        <div class="banner__body">
          <h2 class="banner__title" id="nx-consent-title">{{ text.title }}</h2>
          <p class="banner__text">{{ text.body }}</p>
          @if (detailsOpen()) {
            <p class="banner__text" id="nx-consent-details">
              {{ text.howToErase }}
            </p>
          }
          <div class="banner__actions">
            <button
              type="button"
              class="btn btn--primary btn--sm"
              data-role="acknowledge"
              (click)="notice.acknowledge()"
            >
              {{ text.acknowledge }}
            </button>
            <button
              type="button"
              class="btn btn--ghost btn--sm"
              data-role="details"
              [attr.aria-expanded]="detailsOpen()"
              aria-controls="nx-consent-details"
              (click)="detailsOpen.set(!detailsOpen())"
            >
              {{ text.details }}
            </button>
          </div>
        </div>
      </section>
    }
  `,
})
export class ConsentBannerComponent {
  protected readonly notice = inject(UiNoticeService);
  private readonly router = inject(Router);
  private readonly doc = inject(DOCUMENT);
  protected readonly text = FIRST_VISIT_NOTICE;
  /** Caminho aberto agora; antes da primeira navegação, o do endereço do navegador. */
  private readonly path = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects.split(/[?#]/)[0] ?? ''),
    ),
    { initialValue: this.doc.location?.pathname ?? '/' },
  );
  protected readonly onEntryScreen = computed(() => this.path().startsWith('/login'));
  protected readonly visible = computed(() => this.notice.bannerVisible() && !this.onEntryScreen());
  protected readonly detailsOpen = signal(false);
}
