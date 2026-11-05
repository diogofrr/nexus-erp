import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent, IconName } from '../../../shared/ui/display/icon.component';
import { uniqueId } from '../../../shared/ui/util/ids';

export type CgCardVariant = 'default' | 'care' | 'soft';

/**
 * Cartão (UX A.2.4): agrupa UMA ideia (um compromisso, um remédio, uma opção). Título (h3), até 3 linhas de
 * corpo, no máximo uma ação principal. `link` faz o cartão inteiro ser um único `<a>` com a seta à direita.
 * Variantes `care` e `soft` são as cores calmas. NUNCA cartão dentro de cartão, nunca mais de 6 por tela sem
 * "Ver todos".
 *
 * ```html
 * <app-cg-card title="Próximo compromisso" icon="calendar">Fisioterapia, hoje às 14:00</app-cg-card>
 * <app-cg-card title="Como estou" link="/cuidador/cuidar-de-mim/como-estou">Anote como você está.</app-cg-card>
 * <app-cg-card title="Remédios"> corpo <button cgCardFooter class="cg-link-btn">Ver todos</button></app-cg-card>
 * ```
 */
@Component({
  selector: 'app-cg-card',
  imports: [NgTemplateOutlet, RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cg-card-host' },
  template: `
    @if (link(); as href) {
      <a [class]="classes()" [routerLink]="href">
        <ng-container [ngTemplateOutlet]="body" />
        <svg class="cg-card__chevron" appIcon="chevron-right"></svg>
      </a>
    } @else {
      <section [class]="classes()" [attr.aria-labelledby]="titleId">
        <ng-container [ngTemplateOutlet]="body" />
      </section>
    }

    <ng-template #body>
      <div class="cg-card__main">
        <h3 class="cg-card__title" [id]="titleId">
          @if (icon(); as name) {
            <svg [appIcon]="name" size="lg"></svg>
          }
          <span>{{ title() }}</span>
        </h3>
        <div class="cg-card__text"><ng-content /></div>
        <div class="cg-card__footer"><ng-content select="[cgCardFooter]" /></div>
      </div>
    </ng-template>
  `,
})
export class CgCardComponent {
  readonly title = input.required<string>();
  readonly variant = input<CgCardVariant>('default');
  readonly icon = input<IconName>();
  /** Rota absoluta: o cartão inteiro vira um link. */
  readonly link = input<string | null>(null);

  protected readonly titleId = uniqueId('cg-card');
  protected readonly classes = computed(
    () => `cg-card${this.variant() === 'default' ? '' : ` cg-card--${this.variant()}`}${this.link() ? ' cg-card--link' : ''}`,
  );
}
