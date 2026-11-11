import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { uniqueId } from '../../../shared/ui/util/ids';
import { CgAccent, accentClass } from './cg-accent';

/**
 * Seção de página (docs/20-regras-planos-v2.md, regra de exibição 4): um título claro (`h2`, ou `h3` com `headingLevel`),
 * uma contagem opcional ao lado ("Remédios de hoje (4)") e, à direita, um detalhe projetado com `cgSectionEnd` (um anel,
 * um botão de texto). O conteúdo entra abaixo, em pilha. É o que toda tela usa para que nada fique solto: cabeçalho,
 * seções com título e cartões. O `section` leva `aria-labelledby` para o título.
 *
 * ```html
 * <app-cg-section title="Remédios de hoje" [count]="4">
 *   <app-cg-progress-ring cgSectionEnd [value]="2" [max]="4" size="md" label="dados" />
 *   <ul class="cg-plain-list">...</ul>
 * </app-cg-section>
 * ```
 */
@Component({
  selector: 'app-cg-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()', role: 'region', '[attr.aria-labelledby]': 'titleId' },
  template: `
    <div class="cg-section-head">
      @if (headingLevel() === 3) {
        <h3 class="cg-section__title" [id]="titleId">
          {{ title() }}@if (count() !== null) {<span class="cg-section__count"> ({{ count() }})</span>}
        </h3>
      } @else {
        <h2 class="cg-section__title" [id]="titleId">
          {{ title() }}@if (count() !== null) {<span class="cg-section__count"> ({{ count() }})</span>}
        </h2>
      }
      <ng-content select="[cgSectionEnd]" />
    </div>
    <div class="cg-section__body"><ng-content /></div>
  `,
})
export class CgSectionComponent {
  readonly title = input.required<string>();
  /** Quantos itens a seção tem, entre parênteses depois do título; `null` (padrão) não escreve nada. */
  readonly count = input<number | null>(null);
  /** 2 (padrão) ou 3 quando a seção fica dentro de outra que já tem `h2`. */
  readonly headingLevel = input<2 | 3>(2);
  /** Força a tinta de uma seção; sem ela herda a corrente. */
  readonly accent = input<CgAccent | null>(null);

  protected readonly titleId = uniqueId('cg-section');
  protected readonly classes = computed(() => `cg-block${accentClass(this.accent())}`);
}
