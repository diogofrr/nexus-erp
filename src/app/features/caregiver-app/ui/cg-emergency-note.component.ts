import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../shared/ui/display/icon.component';
import { CHANNELS_NOTICE } from '../state/nexus-contact';
import { CgNoteComponent } from './cg-note.component';

/**
 * Aviso de emergência (UX A.2.19; RN-ATD-11, RN-CAN-06, RN-ENC-09): nas telas de contato, atendimento e cadastro.
 * `compact` é uma nota suave de uma frase com o botão de texto "Ver Ajuda agora"; `full` é o bloco da tela Ajuda
 * agora, em azul escuro com texto branco (13:1), com SAMU 192 e CVV 188. NUNCA vermelho, nunca com sirene, nunca
 * animado. Nenhum `tel:`: os números são texto, e no protótipo a ligação não é feita.
 *
 * ```html
 * <app-cg-emergency-note />
 * <app-cg-emergency-note variant="full" />
 * ```
 */
@Component({
  selector: 'app-cg-emergency-note',
  imports: [RouterLink, IconComponent, CgNoteComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cg-emergency-host' },
  template: `
    @if (variant() === 'full') {
      <section class="cg-emergency" aria-labelledby="cg-emergency-title">
        <h2 class="cg-emergency__title" id="cg-emergency-title">Em emergência, ligue 192</h2>
        <ul class="cg-emergency__list">
          <li class="cg-emergency__item">
            <svg appIcon="phone" size="lg"></svg>
            <div>
              <p class="cg-emergency__number">192</p>
              <p class="cg-emergency__name">SAMU: emergência de saúde, a qualquer hora</p>
            </div>
          </li>
          <li class="cg-emergency__item">
            <svg appIcon="phone" size="lg"></svg>
            <div>
              <p class="cg-emergency__number">188</p>
              <p class="cg-emergency__name">CVV: conversa de apoio emocional, a qualquer hora</p>
            </div>
          </li>
        </ul>
        <p class="cg-emergency__text">{{ notice }}</p>
      </section>
    } @else {
      <app-cg-note variant="soft" icon="phone">
        {{ notice }}
        <a cgNoteActions class="cg-link-btn" routerLink="/cuidador/ajuda-agora">Ver Ajuda agora</a>
      </app-cg-note>
    }
  `,
})
export class CgEmergencyNoteComponent {
  readonly variant = input<'compact' | 'full'>('compact');
  protected readonly notice = CHANNELS_NOTICE;
}
