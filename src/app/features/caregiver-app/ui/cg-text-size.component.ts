import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { IconComponent } from '../../../shared/ui/display/icon.component';
import { uniqueId } from '../../../shared/ui/util/ids';
import { CaregiverContextService } from '../state/caregiver-context.service';
import { FONT_SCALES, FontScale } from '../state/font-scale.service';

/**
 * Seletor de tamanho da letra (UX A.2.20, decisão 7 do contexto): Normal, Grande e Bem grande, em "Mais" e no
 * perfil. Vale NA HORA, sem botão Salvar (troca o `data-text` do shell) e fica guardado no navegador pelo
 * `FontScaleService` (nunca direto no armazenamento). Cada botão mostra "Aa" no tamanho do próprio nível (fixo,
 * não muda com o nível atual) e o nome embaixo; embaixo, uma prévia no nível escolhido.
 *
 * ```html
 * <app-cg-text-size />
 * ```
 */
@Component({
  selector: 'app-cg-text-size',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cg-text-size-host' },
  template: `
    <fieldset class="cg-text-size">
      <legend class="cg-text-size__legend" [class.sr-only]="!showLegend()">Tamanho da letra</legend>
      <div class="cg-text-size__options">
        @for (option of options; track option.value) {
          <label class="cg-text-size__option" [class.is-selected]="ctx.fontScale() === option.value">
            <input
              class="cg-text-size__input"
              type="radio"
              [name]="name"
              [checked]="ctx.fontScale() === option.value"
              [attr.aria-label]="option.ariaLabel"
              (change)="choose(option.value)"
            />
            <span class="cg-text-size__sample" [style.font-size.px]="option.sample" aria-hidden="true">Aa</span>
            <span class="cg-text-size__name">
              {{ option.label }}
              @if (ctx.fontScale() === option.value) {
                <svg appIcon="check" size="sm"></svg>
              }
            </span>
          </label>
        }
      </div>
      <p class="cg-text-size__preview">Assim fica o texto no seu aplicativo.</p>
    </fieldset>
  `,
})
export class CgTextSizeComponent {
  protected readonly ctx = inject(CaregiverContextService);
  /** O título "Tamanho da letra" fica só para leitor de tela, porque a tela costuma ter um h2 com esse nome. Ligue para mostrá-lo. */
  readonly showLegend = input(false);
  protected readonly options = FONT_SCALES;
  protected readonly name = uniqueId('cg-text-size');

  protected choose(scale: FontScale): void {
    this.ctx.setFontScale(scale);
  }
}
