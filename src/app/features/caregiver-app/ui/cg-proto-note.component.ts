import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PROTOTYPE_NOTICE } from '../../../core/privacy/browser-data.service';
import { IconComponent } from '../../../shared/ui/display/icon.component';

/**
 * Aviso de protótipo (UX A.2.18; RN-LGPD-25, AC-GL-05): em TODA tela do aplicativo, no fim do conteúdo (acima da
 * barra de navegação), com o link "Meus dados" para a tela de privacidade do cuidador. Na entrada e no começo
 * do cadastro o aviso é a faixa `banner--prototype` do design system.
 */
@Component({
  selector: 'app-cg-proto-note',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cg-proto-note' },
  template: `
    <svg appIcon="info" size="sm"></svg>
    <span>{{ notice }}</span>
    <a class="cg-proto-note__link" routerLink="/cuidador/mais/privacidade">Meus dados</a>
  `,
})
export class CgProtoNoteComponent {
  protected readonly notice = PROTOTYPE_NOTICE;
}
