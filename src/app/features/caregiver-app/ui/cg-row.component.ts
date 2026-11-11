import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent, IconName } from '../../../shared/ui/display/icon.component';

/**
 * Item de lista (UX A.2.6): destinos e itens (menu Mais, Meus pedidos, horários, profissionais). Ícone num
 * círculo, título (até 3 linhas), apoio (até 2) e, no fim, uma seta. O que você projetar em `[cgRowEnd]` (etiqueta)
 * fica à direita do título quando há espaço e **desce para baixo do título em tela estreita**, para o texto nunca
 * ficar espremido em uma coluna de letras (CXC-001).
 * `[cgRowLead]` troca o emblema de ícone por algo seu (o avatar do profissional, por exemplo): use um OU outro.
 * A linha INTEIRA é o alvo: com `link` é um `<a>`, sem `link` é um `<button>` que emite `activated`. Use dentro de
 * `<ul class="cg-list"><li>...</li></ul>`.
 *
 * ```html
 * <ul class="cg-list">
 *   <li><app-cg-row title="Meu plano" description="Cuida · R$ 119,90 por mês" icon="credit-card" link="/cuidador/mais/plano" /></li>
 *   <li><app-cg-row title="Sair" icon="log-out" (activated)="signOut()" [chevron]="false" /></li>
 * </ul>
 * ```
 */
@Component({
  selector: 'app-cg-row',
  imports: [NgTemplateOutlet, RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cg-row-host' },
  template: `
    @if (link(); as href) {
      <a class="cg-row" [routerLink]="href" [queryParams]="linkQuery()" [attr.aria-current]="current() ? 'true' : null">
        <ng-container [ngTemplateOutlet]="body" />
      </a>
    } @else {
      <button
        type="button"
        class="cg-row"
        [attr.aria-current]="current() ? 'true' : null"
        (click)="activated.emit()"
      >
        <ng-container [ngTemplateOutlet]="body" />
      </button>
    }

    <ng-template #body>
      @if (icon(); as name) {
        <span class="cg-row__icon"><svg [appIcon]="name" size="lg"></svg></span>
      }
      <ng-content select="[cgRowLead]" />
      <span class="cg-row__body">
        <span class="cg-row__text">
          <span class="cg-row__title">{{ title() }}</span>
          @if (description(); as text) {
            <span class="cg-row__desc">{{ text }}</span>
          }
        </span>
        <span class="cg-row__extra"><ng-content select="[cgRowEnd]" /></span>
      </span>
      @if (current()) {
        <span class="cg-row__end"><svg appIcon="check"></svg></span>
      } @else if (chevron()) {
        <span class="cg-row__end"><svg appIcon="chevron-right"></svg></span>
      }
    </ng-template>
  `,
})
export class CgRowComponent {
  readonly title = input.required<string>();
  readonly description = input<string>();
  readonly icon = input<IconName>();
  /** Rota absoluta. Sem ela, a linha é um botão. */
  readonly link = input<string | null>(null);
  /** A consulta da URL do `link` (`{ atividade: 'act_0004' }`), quando o destino precisa dela. */
  readonly linkQuery = input<Record<string, string> | null>(null);
  /** Linha selecionada (`aria-current="true"`, fundo suave e `check`). */
  readonly current = input(false);
  /** Seta à direita (padrão). Desligue em ação que não leva a outra tela. */
  readonly chevron = input(true);
  readonly activated = output<void>();
}
