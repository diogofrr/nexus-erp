import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { rovingIndex } from '../util/roving';
import { uniqueId } from '../util/ids';
import { IconComponent, IconName } from './icon.component';

export interface SegmentOption<T = string> {
  value: T;
  label: string;
  icon?: IconName;
}

/**
 * Controle segmentado (`.segmented`): semana ou mês, densidade. É um grupo de opção única
 * (`role="radiogroup"`): setas, Home e End navegam e selecionam; só a opção atual entra na ordem do Tab.
 *
 * ```html
 * <app-segmented label="Densidade" [options]="densities" [(value)]="density" />
 * ```
 */
@Component({
  selector: 'app-segmented',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="segmented" role="radiogroup" [attr.aria-label]="label()">
      @for (option of options(); track $index; let i = $index) {
        <button
          type="button"
          class="segmented__btn"
          role="radio"
          [id]="idOf(i)"
          [attr.aria-checked]="isCurrent(option.value)"
          [attr.tabindex]="i === currentIndex() ? 0 : -1"
          (click)="value.set(option.value)"
          (keydown)="onKey($event, i)"
        >
          @if (option.icon) {
            <svg [appIcon]="option.icon" size="sm"></svg>
          }
          {{ option.label }}
        </button>
      }
    </div>
  `,
})
export class SegmentedComponent<T = string> {
  private readonly doc = inject(DOCUMENT);
  readonly options = input.required<readonly SegmentOption<T>[]>();
  readonly value = model<T>();
  readonly label = input.required<string>();

  private readonly prefix = uniqueId('app-seg');
  protected readonly currentIndex = computed(() => {
    const index = this.options().findIndex((o) => Object.is(o.value, this.value()));
    return index >= 0 ? index : 0;
  });

  protected idOf(index: number): string {
    return `${this.prefix}-${index}`;
  }

  protected isCurrent(value: T): boolean {
    return Object.is(value, this.value());
  }

  protected onKey(event: KeyboardEvent, index: number): void {
    const next = rovingIndex(event.key, index, this.options().length);
    const target = next === null ? undefined : this.options()[next];
    if (!target) {
      return;
    }
    event.preventDefault();
    this.value.set(target.value);
    this.doc.getElementById(this.idOf(next as number))?.focus();
  }
}
