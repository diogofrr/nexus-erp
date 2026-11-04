import { ChangeDetectionStrategy, Component, Directive, booleanAttribute, computed, input } from '@angular/core';

/** Rodapé do cartão: `<div appCardFooter>...</div>` dentro de `app-card`. */
@Directive({ selector: '[appCardFooter]', host: { class: 'card__footer' } })
export class CardFooterDirective {}

/**
 * Cartão (`.card`): borda fina, sem sombra (a sombra só aparece em hover quando é interativo). Nunca ponha um
 * cartão dentro de outro: para grupo dentro de grupo use `variant="sunken"`.
 *
 * ```html
 * <app-card title="Plano e cartão" subtitle="Cuida, desde 12/03/2026">
 *   <button appCardActions class="btn btn--sm">Trocar plano</button>
 *   ...conteúdo...
 *   <div appCardFooter>Próximo ciclo em 12/12/2026</div>
 * </app-card>
 * ```
 */
@Component({
  selector: 'app-card',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()' },
  template: `
    @if (title()) {
      <div class="card__header">
        <div>
          <h3 class="card__title">{{ title() }}</h3>
          @if (subtitle()) {
            <p class="card__sub">{{ subtitle() }}</p>
          }
        </div>
        <div class="cluster"><ng-content select="[appCardActions]" /></div>
      </div>
    }
    <div [class.card__body]="padded()"><ng-content /></div>
    <ng-content select="[appCardFooter]" />
  `,
})
export class CardComponent {
  readonly title = input<string>();
  readonly subtitle = input<string>();
  /** Espaço interno do corpo (desligue para tabelas e listas que vão até a borda). */
  readonly padded = input(true, { transform: booleanAttribute });
  readonly variant = input<'default' | 'sunken' | 'raised' | 'interactive'>('default');

  protected readonly classes = computed(() => {
    const v = this.variant();
    return v === 'default' ? 'card' : `card card--${v}`;
  });
}
