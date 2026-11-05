import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../shared/ui/display/icon.component';

/**
 * Cabeçalho de página (UX A.2.3): diz onde a pessoa está e, em subtelas, deixa voltar. Um `h1` serifado por
 * tela, com a linha dourada de 56 x 3 px, e uma frase de apoio opcional (no máximo 2 linhas). O shell leva o
 * foco ao `h1` a cada tela nova.
 *
 * ```html
 * <app-cg-page-header title="Remédios" description="Marque o que você já deu hoje." />
 * <app-cg-page-header title="Profissional" backLink="/cuidador/rede/buscar" backLabel="Buscar" />
 * ```
 */
@Component({
  selector: 'app-cg-page-header',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cg-page-header' },
  template: `
    @if (backLink(); as back) {
      <a class="cg-link-btn cg-page-header__back" [routerLink]="back">
        <svg appIcon="arrow-left" size="sm"></svg>
        <span>Voltar<span class="sr-only"> para {{ backLabel() }}</span></span>
      </a>
    }
    <h1 class="cg-page-header__title">{{ title() }}</h1>
    @if (description(); as text) {
      <p class="cg-page-header__desc">{{ text }}</p>
    }
  `,
})
export class CgPageHeaderComponent {
  readonly title = input.required<string>();
  readonly description = input<string>();
  /** Rota da tela anterior (só em subtelas). */
  readonly backLink = input<string | null>(null);
  /** Nome da tela anterior, para leitor de tela ("Voltar para Buscar"). */
  readonly backLabel = input('a tela anterior');
}
