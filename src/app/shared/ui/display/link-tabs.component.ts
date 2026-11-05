import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

export interface LinkTab {
  label: string;
  /** Rota absoluta (`/app/financeiro/projecao`). */
  link: string;
  /** Só fica atual com o caminho exato (use na aba "Visão geral"). */
  exact?: boolean;
  /** Contagem pequena ao lado do rótulo. */
  badge?: number;
}

/**
 * Navegação entre as telas de um mesmo módulo (por exemplo, Financeiro: Visão geral, Projeção, Parâmetros).
 * Cada aba é um LINK de verdade (a rota muda), não um painel: a aba da rota atual leva `aria-current="page"`
 * e a linha dourada do design system. O módulo não desenha menu nem migalhas (isso é do shell); isto é só o
 * atalho entre as suas próprias telas.
 *
 * ```html
 * <app-link-tabs label="Telas do financeiro" [items]="tabs" />
 * ```
 */
@Component({
  selector: 'app-link-tabs',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .tab {
      text-decoration: none;
    }
    .tab.is-current {
      color: var(--text-heading);
      font-weight: var(--fw-semibold);
    }
    .tab.is-current::after {
      content: '';
      position: absolute;
      inset: auto var(--space-3) -1px;
      height: 2px;
      border-radius: 1px;
      background: var(--accent);
    }
  `,
  template: `
    <nav [attr.aria-label]="label()">
      <div class="tabs">
        @for (item of items(); track item.link) {
          <a
            class="tab"
            [routerLink]="item.link"
            routerLinkActive="is-current"
            ariaCurrentWhenActive="page"
            [routerLinkActiveOptions]="{ exact: item.exact === true }"
          >
            {{ item.label }}
            @if (item.badge !== undefined) {
              <span class="badge badge--count">{{ item.badge }}</span>
            }
          </a>
        }
      </div>
    </nav>
  `,
})
export class LinkTabsComponent {
  /** Nome acessível da navegação ("Telas do financeiro"). */
  readonly label = input.required<string>();
  readonly items = input.required<readonly LinkTab[]>();
}
