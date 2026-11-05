import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PROTOTYPE_NOTICE } from '../../../core/privacy/browser-data.service';
import { IconComponent } from '../../../shared/ui/display/icon.component';

/**
 * Moldura das telas de M01 que não têm shell (acesso negado, página não encontrada): marca no topo, o
 * conteúdo no meio e o aviso literal de protótipo no rodapé (AC-GL-05).
 */
@Component({
  selector: 'app-standalone-frame',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="standalone">
      <header class="standalone__brand">
        <svg class="brand-symbol" aria-hidden="true"><use href="icons/sprite.svg#nx-symbol" /></svg>
        <span class="wordmark">Nexus</span>
      </header>
      <main class="standalone__main" id="conteudo" tabindex="-1"><ng-content /></main>
      <footer class="app-footer">
        <svg appIcon="info"></svg>
        <span>{{ notice }}</span>
      </footer>
    </div>
  `,
})
export class StandaloneFrameComponent {
  protected readonly notice = PROTOTYPE_NOTICE;
}
