import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '@shared/ui';

/**
 * Selo de origem do número (UX 5.13): projeção é sempre "estimativa do plano" (RN-FIN-32) e o realizado é
 * "dado do sistema". Texto mais ícone, nunca só cor.
 */
@Component({
  selector: 'app-origin-tag',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'badge badge--outline' },
  template: `
    @if (kind() === 'estimate') {
      <svg appIcon="trending-up" size="sm"></svg>Estimativa do plano
    } @else {
      <svg appIcon="database" size="sm"></svg>Dado do sistema
    }
  `,
})
export class OriginTagComponent {
  readonly kind = input.required<'estimate' | 'system'>();
}
