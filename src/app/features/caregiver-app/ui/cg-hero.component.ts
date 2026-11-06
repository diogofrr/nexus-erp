import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../shared/ui/display/icon.component';
import { CgAccent, accentClass } from './cg-accent';
import { CgIllustrationComponent, CgIllustrationName } from './cg-illustration.component';

/**
 * Cabeçalho de página com vida: o `h1` serifado, a frase de apoio e uma ilustração, sobre um fundo de gradiente suave
 * da seção, com a linha dourada embaixo do título. É o `app-cg-page-header` com mais calor: mesmo `h1` (o shell leva o
 * foco a ele), mesma volta em subtelas (`backLink`). O conteúdo projetado (um anel, um botão) entra sob a frase.
 * Em tela larga a ilustração fica à direita e ocupa a altura; no celular vira um detalhe no canto. Com a letra
 * "Bem grande" no celular a ilustração some, para o texto ter a largura toda. Sem `description` o herói é compacto
 * (menos altura), para telas com abas ou lista logo abaixo; `compact` força o mesmo com frase.
 *
 * ```html
 * <app-cg-hero title="Rotina" description="Agenda e remédios." illustration="calendar" />
 * <app-cg-hero [title]="greeting()" [description]="date()" illustration="day" accent="hoje"><button class="btn">Algo</button></app-cg-hero>
 * ```
 */
@Component({
  selector: 'app-cg-hero',
  imports: [RouterLink, IconComponent, CgIllustrationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()' },
  template: `
    <div class="cg-hero__main">
      @if (backLink(); as back) {
        <a class="cg-link-btn cg-page-header__back" [routerLink]="back">
          <svg appIcon="arrow-left" size="sm"></svg>
          <span>Voltar<span class="sr-only"> para {{ backLabel() }}</span></span>
        </a>
      }
      <h1 class="cg-hero__title">{{ title() }}</h1>
      @if (description(); as text) {
        <p class="cg-hero__desc cg-page-header__desc">{{ text }}</p>
      }
      <div class="cg-hero__extra"><ng-content /></div>
    </div>
    @if (illustration(); as art) {
      <app-cg-illustration class="cg-hero__art" [name]="art" size="lg" tone="accent" />
    }
  `,
})
export class CgHeroComponent {
  readonly title = input.required<string>();
  readonly description = input<string>();
  readonly illustration = input<CgIllustrationName | null>(null);
  readonly accent = input<CgAccent | null>(null);
  readonly backLink = input<string | null>(null);
  readonly backLabel = input('a tela anterior');
  /** Força o herói compacto (menos altura), mesmo com frase de apoio. */
  readonly compact = input(false, { transform: booleanAttribute });

  protected readonly classes = computed(
    () =>
      `cg-hero${this.illustration() ? ' cg-hero--art' : ''}${this.description() && !this.compact() ? '' : ' cg-hero--compact'}${accentClass(this.accent())}`,
  );
}
