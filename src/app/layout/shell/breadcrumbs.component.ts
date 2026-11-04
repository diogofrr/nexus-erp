import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GlyphComponent } from '../../shared/ui/overlay/glyph.component';
import { PageChromeService } from '../state/page-chrome.service';

/**
 * Migalhas da barra superior (UX 3.9): `Cuidadores / Perfil do cuidador`, no máximo 3 níveis, o último em
 * texto com `aria-current="page"`. No celular viram só "‹ Cuidadores", com o nome acessível "Voltar para Cuidadores" (o pai é a lista de onde a
 * pessoa veio); numa tela de primeiro nível mostram só o título.
 *
 * Quem define as migalhas são as rotas (`data: { title }` ou `data: { crumb }`) e, quando o texto só se
 * sabe depois de carregar, a página (`PageContextService.setCrumbs`). A página NÃO desenha migalhas.
 */
@Component({
  selector: 'app-breadcrumbs',
  imports: [RouterLink, GlyphComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'topbar__crumbs' },
  template: `
    @if (trail().length > 1) {
      <nav aria-label="Você está em" class="hide-sm">
        <ol class="breadcrumb">
          @for (crumb of trail(); track $index; let last = $last) {
            <li>
              @if (!last && crumb.link) {
                <a [routerLink]="crumb.link">{{ crumb.label }}</a>
              } @else {
                <span [attr.aria-current]="last ? 'page' : null">{{ crumb.label }}</span>
              }
            </li>
          }
        </ol>
      </nav>
      @if (parent(); as p) {
        <a
          class="back-link show-sm"
          [routerLink]="p.link"
          [attr.aria-label]="'Voltar para ' + p.label"
        >
          <svg appGlyph="chevron-left" glyphSize="sm"></svg><span>{{ p.label }}</span>
        </a>
      }
    } @else if (trail().length === 1) {
      <span class="topbar__title">{{ trail()[0]?.label }}</span>
    }
  `,
})
export class BreadcrumbsComponent {
  private readonly chrome = inject(PageChromeService);

  /** A trilha, com no máximo 3 níveis (os mais próximos da página atual). */
  protected readonly trail = computed(() => this.chrome.crumbs().slice(-3));

  protected readonly parent = computed(() => {
    const trail = this.trail();
    const parent = trail[trail.length - 2];
    return parent?.link ? { label: parent.label, link: parent.link } : null;
  });
}
