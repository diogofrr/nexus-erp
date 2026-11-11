import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent, IconName } from '../../../shared/ui/display/icon.component';
import { uniqueId } from '../../../shared/ui/util/ids';
import { CgAccent, accentClass } from './cg-accent';
import { CgIconBadgeComponent } from './cg-icon-badge.component';
import { CgIllustrationComponent, CgIllustrationName } from './cg-illustration.component';

export type CgCardVariant = 'default' | 'care' | 'soft';
/** `row`: emblema à esquerda, texto ao lado (padrão). `tile`: emblema em cima, texto embaixo, ladrilho de porta de seção. */
export type CgCardLayout = 'row' | 'tile';

/**
 * Cartão (UX A.2.4): agrupa UMA ideia (um compromisso, um remédio, uma opção). Título (`h2` por padrão; use
 * `[headingLevel]="3"` quando o cartão fica dentro de uma seção que já tem `h2`, para não pular nível, QAC-009),
 * até 3 linhas de corpo, no máximo uma ação principal. `link` faz o cartão inteiro ser um único `<a>` com a seta à direita.
 * Variantes `care` e `soft` são as cores calmas. NUNCA cartão dentro de cartão, nunca mais de 6 por tela sem
 * "Ver todos".
 *
 * Vida (docs/17-vida-kit.md): o `icon` vira um emblema redondo na tinta da seção; `accent` força outra seção;
 * `layout="tile"` põe o emblema em cima (as portas de seção); `illustration` solta um desenho no canto do ladrilho.
 *
 * ```html
 * <app-cg-card title="Próximo compromisso" icon="calendar">Fisioterapia, hoje às 14:00</app-cg-card>
 * <app-cg-card title="Como estou" link="/cuidador/cuidar-de-mim/como-estou" layout="tile" icon="heart-pulse">Anote como você está.</app-cg-card>
 * <app-cg-card title="Remédios"> corpo <button cgCardFooter class="cg-link-btn">Ver todos</button></app-cg-card>
 * ```
 */
@Component({
  selector: 'app-cg-card',
  imports: [NgTemplateOutlet, RouterLink, IconComponent, CgIconBadgeComponent, CgIllustrationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cg-card-host' },
  template: `
    @if (link(); as href) {
      <a [class]="classes()" [routerLink]="href" [queryParams]="linkQuery()">
        <ng-container [ngTemplateOutlet]="body" />
        <span class="cg-card__go"><svg class="cg-card__chevron" appIcon="chevron-right"></svg></span>
      </a>
    } @else {
      <section [class]="classes()" [attr.aria-labelledby]="titleId">
        <ng-container [ngTemplateOutlet]="body" />
      </section>
    }

    <ng-template #body>
      @if (illustration(); as art) {
        <app-cg-illustration class="cg-card__art" [name]="art" size="md" tone="accent" />
      }
      @if (icon(); as name) {
        <app-cg-icon-badge class="cg-card__badge" [icon]="name" [size]="layout() === 'tile' ? 'lg' : 'md'" />
      }
      <div class="cg-card__main">
        @switch (headingLevel()) {
          @case (3) {
            <h3 class="cg-card__title" [id]="titleId">{{ title() }}</h3>
          }
          @case (4) {
            <h4 class="cg-card__title" [id]="titleId">{{ title() }}</h4>
          }
          @default {
            <h2 class="cg-card__title" [id]="titleId">{{ title() }}</h2>
          }
        }
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
  /** Nível do título: 2 (padrão), 3 ou 4. Dentro de uma seção com `h2`, use 3 (QAC-009). */
  readonly headingLevel = input<2 | 3 | 4>(2);
  /** Rota absoluta: o cartão inteiro vira um link. */
  readonly link = input<string | null>(null);
  /** A consulta da URL do `link` (`{ atividade: 'act_0004' }`), quando o destino precisa dela. */
  readonly linkQuery = input<Record<string, string> | null>(null);
  /** Força a tinta de uma seção; sem ela o cartão herda a da seção corrente. */
  readonly accent = input<CgAccent | null>(null);
  readonly layout = input<CgCardLayout>('row');
  /** Um desenho decorativo no canto (só no `tile`). */
  readonly illustration = input<CgIllustrationName | null>(null);

  protected readonly titleId = uniqueId('cg-card');
  protected readonly classes = computed(
    () =>
      `cg-card${this.variant() === 'default' ? '' : ` cg-card--${this.variant()}`}${this.link() ? ' cg-card--link' : ''}` +
      `${this.layout() === 'tile' ? ' cg-card--tile' : ''}${this.illustration() ? ' cg-card--art' : ''}${accentClass(this.accent())}`,
  );
}
