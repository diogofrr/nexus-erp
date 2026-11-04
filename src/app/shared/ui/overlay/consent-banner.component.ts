import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FIRST_VISIT_NOTICE, UiNoticeService } from '../../../core/privacy/browser-data.service';
import { GlyphComponent } from './glyph.component';

/**
 * Banner da primeira visita (LP-01, UX 6.7): três frases e dois botões, no canto inferior esquerdo
 * (tela cheia no celular). Não bloqueia o uso. "Entendi" grava `ui-notice` pelo `UiNoticeService` e o
 * banner não volta; "Ver detalhes" abre as instruções de como apagar tudo. Monte UMA vez, na raiz.
 */
@Component({
  selector: 'app-consent-banner',
  imports: [GlyphComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (notice.bannerVisible()) {
      <section class="banner banner--consent" role="region" aria-labelledby="nx-consent-title">
        <svg appGlyph="shield-check" glyphSize="lg"></svg>
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
  protected readonly text = FIRST_VISIT_NOTICE;
  protected readonly detailsOpen = signal(false);
}
