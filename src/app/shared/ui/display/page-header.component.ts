import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface Crumb {
  label: string;
  /** Rota. O último item (a página atual) não leva link. */
  link?: string | readonly unknown[];
}

/**
 * Migalhas (`.breadcrumb`). O último item é a página atual (`aria-current="page"`). NUNCA ponha nome de
 * pessoa nas migalhas de quem só vê códigos: use o código (`CUI-0042`).
 *
 * `<app-breadcrumb [items]="[{ label: 'Cuidadores', link: '/app/cuidadores' }, { label: 'CUI-0042' }]" />`
 */
@Component({
  selector: 'app-breadcrumb',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav aria-label="Você está em">
      <ol class="breadcrumb">
        @for (item of items(); track $index) {
          <li>
            @if (!$last && item.link) {
              <a [routerLink]="item.link">{{ item.label }}</a>
            } @else {
              <span [attr.aria-current]="$last ? 'page' : null">{{ item.label }}</span>
            }
          </li>
        }
      </ol>
    </nav>
  `,
})
export class BreadcrumbComponent {
  readonly items = input.required<readonly Crumb[]>();
}

/**
 * Cabeçalho de página: migalhas, título (`h1`, serifado, com a linha dourada embaixo), descrição, contador e
 * ações no canto direito (conteúdo projetado: uma só ação primária). Um `h1` por tela.
 *
 * ```html
 * <app-page-header title="Cuidadores" count="340 cuidadores" [breadcrumbs]="crumbs">
 *   <button class="btn btn--primary">Novo cuidador</button>
 * </app-page-header>
 * ```
 */
@Component({
  selector: 'app-page-header',
  imports: [BreadcrumbComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'page-header' },
  template: `
    @if (breadcrumbs().length > 0) {
      <app-breadcrumb [items]="breadcrumbs()" />
    }
    <div class="page-header__row">
      <div class="page-header__titles">
        <h1>{{ title() }}</h1>
        @if (count() || description()) {
          <p class="page-header__desc">
            @if (count()) {
              <strong class="t-num" aria-live="polite">{{ count() }}</strong>
            }
            @if (count() && description()) {
              <span> · </span>
            }
            {{ description() }}
          </p>
        }
      </div>
      <div class="page-header__actions"><ng-content /></div>
    </div>
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly description = input<string>();
  /** Contador em palavras ("340 cuidadores"). Anunciado quando muda. */
  readonly count = input<string>();
  readonly breadcrumbs = input<readonly Crumb[]>([]);
}
