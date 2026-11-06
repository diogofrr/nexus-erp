import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent, IconName } from '../../../shared/ui/display/icon.component';
import { CgAccent, accentClass } from './cg-accent';

/** `accent`: a cor da seção corrente; `ok`: feito (verde); `care`: cuidado (azul); `gold`: destaque; `neutral`: informação. */
export type CgSealTone = 'accent' | 'ok' | 'care' | 'gold' | 'neutral';

/**
 * Selo e etiqueta: um texto curto em pílula, com ícone opcional, com FORMA e cor (nunca só cor). Para "Dado às 08:12",
 * "Em destaque", "Atende em casa". Substitui o `cg-tag` quando o item merece mais presença. O contraste de cada
 * tom vem conferido por `pnpm run check:a11y`.
 *
 * ```html
 * <app-cg-seal tone="ok" icon="circle-check">Dado às 08:12</app-cg-seal>
 * <app-cg-seal icon="house">Atende em casa</app-cg-seal>
 * ```
 */
@Component({
  selector: 'app-cg-seal',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()' },
  template: `
    @if (icon(); as name) {
      <svg [appIcon]="name" size="sm"></svg>
    }
    <span><ng-content /></span>
  `,
})
export class CgSealComponent {
  readonly tone = input<CgSealTone>('accent');
  readonly icon = input<IconName>();
  readonly accent = input<CgAccent | null>(null);

  protected readonly classes = computed(() => `cg-seal cg-seal--${this.tone()}${accentClass(this.accent())}`);
}
