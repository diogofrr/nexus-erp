import { ChangeDetectionStrategy, Component, booleanAttribute, input, model, output } from '@angular/core';
import { IconComponent } from '../display/icon.component';

export interface FilterOption {
  value: string;
  label: string;
  /** Contagem ao lado do rótulo ("Atrasadas 3"). */
  count?: number;
  disabled?: boolean;
}

/**
 * Chips de filtro (`.chip`, `aria-pressed`). Dois modos:
 * - um só valor, com chip "Todos" (`[(value)]`, `null` = todos);
 * - vários (`multiple` e `[(values)]`).
 * Cada filtro ativo tem estado visível (fundo preenchido e peso maior, não só cor). Filtros estruturados
 * (plano, status) vão para a URL (`createListState`); o texto da busca nunca vai.
 *
 * ```html
 * <app-filter-chips label="Plano" [options]="plans" [(value)]="plan" />
 * <app-filter-chips label="Status" [options]="statuses" multiple [(values)]="status" />
 * ```
 */
@Component({
  selector: 'app-filter-chips',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chip-group" role="group" [attr.aria-label]="label()">
      @if (!multiple() && allLabel()) {
        <button type="button" class="chip" [attr.aria-pressed]="value() === null" (click)="value.set(null)">
          {{ allLabel() }}&ngsp;
          @if (allCount() !== undefined) {
            <span class="chip__count">{{ allCount() }}</span>
          }
        </button>
      }
      @for (option of options(); track option.value) {
        <button type="button" class="chip" [attr.aria-pressed]="isOn(option.value)" [disabled]="option.disabled" (click)="toggle(option.value)">
          {{ option.label }}&ngsp;
          @if (option.count !== undefined) {
            <span class="chip__count">{{ option.count }}</span>
          }
        </button>
      }
    </div>
  `,
})
export class FilterChipsComponent {
  readonly options = input.required<readonly FilterOption[]>();
  /** Nome do grupo para leitor de tela ("Plano"). */
  readonly label = input.required<string>();
  readonly multiple = input(false, { transform: booleanAttribute });
  /** Valor no modo simples (`null` = todos). */
  readonly value = model<string | null>(null);
  /** Valores no modo `multiple`. */
  readonly values = model<readonly string[]>([]);
  /** Texto do chip "Todos" (modo simples). Vazio esconde o chip. */
  readonly allLabel = input('Todos');
  readonly allCount = input<number>();

  protected isOn(value: string): boolean {
    return this.multiple() ? this.values().includes(value) : this.value() === value;
  }

  protected toggle(value: string): void {
    if (this.multiple()) {
      const current = this.values();
      this.values.set(current.includes(value) ? current.filter((v) => v !== value) : [...current, value]);
    } else {
      this.value.set(this.value() === value ? null : value);
    }
  }
}

export interface ActiveFilter {
  key: string;
  /** "Plano: Cuida". */
  label: string;
}

/**
 * Filtros ativos como chips removíveis (`.chip--removable`) mais "Limpar filtros", sempre à vista.
 *
 * ```html
 * <app-active-filters [filters]="[{ key: 'plan', label: 'Plano: Cuida' }]" (removed)="clear($event)" (cleared)="clearAll()" />
 * ```
 */
@Component({
  selector: 'app-active-filters',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (filters().length > 0) {
      <div class="chip-group" role="group" aria-label="Filtros ativos">
        @for (filter of filters(); track filter.key) {
          <span class="chip chip--removable">
            {{ filter.label }}
            <button type="button" class="chip__remove" [attr.aria-label]="'Remover filtro ' + filter.label" (click)="removed.emit(filter.key)">
              <svg appIcon="x" size="sm"></svg>
            </button>
          </span>
        }
        <button type="button" class="btn btn--ghost btn--sm" (click)="cleared.emit()">Limpar filtros</button>
      </div>
    }
  `,
})
export class ActiveFiltersComponent {
  readonly filters = input.required<readonly ActiveFilter[]>();
  readonly removed = output<string>();
  readonly cleared = output<void>();
}
