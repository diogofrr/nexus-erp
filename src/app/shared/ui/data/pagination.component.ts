import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input, model } from '@angular/core';
import { IconComponent } from '../display/icon.component';
import { clampPage, pageCount, pageItems } from './table-utils';

/**
 * Paginação (`.pagination`). Tabela com mais de 25 linhas usa páginas (25, 50 ou 100), porque dá noção de
 * tamanho e o rodapé continua alcançável; não há rolagem infinita em tabela. `aria-current="page"` marca a
 * página atual. Com `summary` mostra "Mostrando 1 a 25 de 340 cuidadores".
 *
 * ```html
 * <app-pagination [total]="340" [(page)]="page" [(pageSize)]="pageSize" noun="cuidadores" summary />
 * ```
 */
@Component({
  selector: 'app-pagination',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="pagination" aria-label="Paginação">
      @if (summary()) {
        <span aria-live="polite">{{ summaryText() }}</span>
      }
      @if (pages() > 1) {
        <div class="pagination__pages">
          <button type="button" class="pagination__page" aria-label="Página anterior" [disabled]="current() <= 1" (click)="go(current() - 1)">
            <svg appIcon="chevron-left" size="sm"></svg>
          </button>
          @for (item of items(); track $index) {
            @if (item === 'gap') {
              <span aria-hidden="true">…</span>
            } @else {
              <button
                type="button"
                class="pagination__page"
                [attr.aria-current]="item === current() ? 'page' : null"
                [attr.aria-label]="'Página ' + item"
                (click)="go(item)"
              >{{ item }}</button>
            }
          }
          <button type="button" class="pagination__page" aria-label="Próxima página" [disabled]="current() >= pages()" (click)="go(current() + 1)">
            <svg appIcon="chevron-right" size="sm"></svg>
          </button>
        </div>
      }
      @if (pageSizes().length > 1) {
        <label class="cluster">
          <span>Por página</span>
          <select class="select select--sm" [value]="pageSize()" (change)="onSize($event)">
            @for (size of pageSizes(); track size) {
              <option [value]="size" [selected]="size === pageSize()">{{ size }}</option>
            }
          </select>
        </label>
      }
    </nav>
  `,
})
export class PaginationComponent {
  readonly total = input.required<number>();
  /** Página atual (começa em 1). */
  readonly page = model(1);
  readonly pageSize = model(25);
  /** Opções de "Por página". Uma só opção esconde o seletor. */
  readonly pageSizes = input<readonly number[]>([25, 50, 100]);
  readonly noun = input('');
  readonly summary = input(false, { transform: booleanAttribute });

  protected readonly pages = computed(() => pageCount(this.total(), this.pageSize()));
  protected readonly current = computed(() => clampPage(this.page(), this.total(), this.pageSize()));
  protected readonly items = computed(() => pageItems(this.current(), this.pages()));
  protected readonly summaryText = computed(() => {
    const total = this.total();
    if (total === 0) {
      return `Nenhum${this.noun() ? ` ${this.noun()}` : ' resultado'}`;
    }
    const from = (this.current() - 1) * this.pageSize() + 1;
    const to = Math.min(total, this.current() * this.pageSize());
    return `Mostrando ${from} a ${to} de ${total}${this.noun() ? ` ${this.noun()}` : ''}`;
  });

  protected go(page: number): void {
    this.page.set(clampPage(page, this.total(), this.pageSize()));
  }

  protected onSize(event: Event): void {
    this.pageSize.set(Number((event.target as HTMLSelectElement).value));
    this.page.set(1);
  }
}
