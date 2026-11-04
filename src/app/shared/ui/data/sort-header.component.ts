import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconComponent } from '../display/icon.component';
import { TableSort, nextSort } from './table-utils';

/**
 * Cabeçalho ordenável (`th` com `aria-sort` e o botão `.th-sort`). Três estados: sem ordem, crescente,
 * decrescente; só a coluna ordenada mostra a seta (texto e ícone, não só cor). É um componente de atributo
 * porque precisa desenhar o botão: o `app-data-table` já o usa, e quem monta `<table class="table">` à mão
 * também pode.
 *
 * ```html
 * <th appSortHeader="name" [sort]="sort()" (sortChange)="sort.set($event)">Cuidador</th>
 * ```
 */
@Component({
  selector: 'th[appSortHeader]',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.aria-sort]': 'ariaSort()', scope: 'col' },
  template: `
    <button type="button" class="th-sort" (click)="sortChange.emit(next())">
      <ng-content />
      <svg [appIcon]="direction() === 'none' ? 'chevrons-up-down' : 'arrow-up'" size="sm"></svg>
    </button>
  `,
})
export class SortHeaderComponent {
  /** Chave da coluna. */
  readonly key = input.required<string>({ alias: 'appSortHeader' });
  /** Ordem atual da tabela. */
  readonly sort = input<TableSort | null>(null);
  /** A nova ordem pedida (`null` = sem ordem). */
  readonly sortChange = output<TableSort | null>();

  protected readonly direction = computed<'asc' | 'desc' | 'none'>(() =>
    this.sort()?.key === this.key() ? (this.sort()?.direction ?? 'none') : 'none',
  );
  protected readonly ariaSort = computed(() => {
    const d = this.direction();
    return d === 'asc' ? 'ascending' : d === 'desc' ? 'descending' : 'none';
  });
  protected readonly next = computed(() => nextSort(this.sort(), this.key()));
}
