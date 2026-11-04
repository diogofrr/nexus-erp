import { ChangeDetectionStrategy, Component, booleanAttribute, input, model } from '@angular/core';

/**
 * Chip alternável (filtro). `aria-pressed` diz o estado; a contagem aparece depois do rótulo.
 *
 * ```html
 * <app-chip [(pressed)]="onlyOverdue" [count]="3">Atrasadas</app-chip>
 * ```
 */
@Component({
  selector: 'app-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="chip" [attr.aria-pressed]="pressed()" [disabled]="disabled()" (click)="pressed.set(!pressed())">
      <ng-content />&ngsp;
      @if (count() !== undefined) {
        <span class="chip__count">{{ count() }}</span>
      }
    </button>
  `,
})
export class ChipComponent {
  readonly pressed = model(false);
  readonly count = input<number>();
  readonly disabled = input(false, { transform: booleanAttribute });
}
