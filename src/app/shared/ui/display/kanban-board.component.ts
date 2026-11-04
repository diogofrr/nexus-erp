import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  TemplateRef,
  contentChild,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { mediaQuery, MOBILE_QUERY } from '../util/media';
import { uniqueId } from '../util/ids';
import { IconComponent } from './icon.component';

export interface KanbanColumn<T = unknown> {
  id: string;
  label: string;
  items: readonly T[];
}

export interface KanbanCardOpen<T = unknown> {
  item: T;
  columnId: string;
}

/**
 * Modelo do cartão do quadro: `<ng-template appKanbanCard let-item let-column="column">...</ng-template>`.
 * Mostre o nome, uma frase curta do que FALTA ("faltam 2 critérios") e, se couber, um selo.
 */
@Directive({ selector: 'ng-template[appKanbanCard]' })
export class KanbanCardDirective {
  readonly template = inject<TemplateRef<unknown>>(TemplateRef);
}

/**
 * Quadro de estados SOMENTE LEITURA (PD-06): colunas são os estados do fluxo, cartões são os itens. Não
 * arrasta (as mudanças acontecem por decisão e arrastar não tem alternativa acessível, WCAG 2.5.7); clicar
 * abre a tela de decisão (`cardOpened`). No celular (abaixo de 768 px) vira acordeão por estado: o título é
 * um botão com `aria-expanded` e a contagem fica nele. Coluna vazia diz "Nenhum processo aqui.".
 *
 * ```html
 * <app-kanban-board [columns]="columns" (cardOpened)="open($event.item)">
 *   <ng-template appKanbanCard let-item><strong>{{ item.name }}</strong><span class="t-caption">{{ item.missing }}</span></ng-template>
 * </app-kanban-board>
 * ```
 */
@Component({
  selector: 'app-kanban-board',
  imports: [NgTemplateOutlet, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="kanban">
      @for (column of columns(); track column.id) {
        <section class="kanban__col" [attr.data-collapsed]="isCollapsed(column.id)" [attr.aria-labelledby]="headId(column.id)">
          @if (mobile()) {
            <button
              type="button"
              class="kanban__head"
              [id]="headId(column.id)"
              [attr.aria-expanded]="!isCollapsed(column.id)"
              [attr.aria-controls]="bodyId(column.id)"
              (click)="toggle(column.id)"
            >
              <span>{{ column.label }}&ngsp;</span>
              <span class="cluster">
                <span class="badge badge--count">{{ column.items.length }}<span class="sr-only"> itens</span></span>
                <span class="kanban__chevron"><svg appIcon="chevron-down" size="sm"></svg></span>
              </span>
            </button>
          } @else {
            <h3 class="kanban__head" [id]="headId(column.id)">
              <span>{{ column.label }}&ngsp;</span>
              <span class="badge badge--count">{{ column.items.length }}<span class="sr-only"> itens</span></span>
            </h3>
          }
          <div class="stack stack--2" [id]="bodyId(column.id)">
            @for (item of column.items; track $index) {
              <button type="button" class="kanban__card" (click)="cardOpened.emit({ item, columnId: column.id })">
                @if (card(); as tpl) {
                  <ng-container *ngTemplateOutlet="tpl.template; context: { $implicit: item, column: column.id }" />
                }
              </button>
            } @empty {
              <p class="kanban__empty">{{ emptyText() }}</p>
            }
          </div>
        </section>
      }
    </div>
  `,
})
export class KanbanBoardComponent<T = unknown> {
  readonly columns = input.required<readonly KanbanColumn<T>[]>();
  readonly emptyText = input('Nenhum processo aqui.');
  /** Um item foi aberto (clique ou Enter no cartão). */
  readonly cardOpened = output<KanbanCardOpen<T>>();

  protected readonly card = contentChild(KanbanCardDirective);
  protected readonly mobile = mediaQuery(MOBILE_QUERY);
  private readonly collapsed = signal<ReadonlySet<string>>(new Set());
  private readonly prefix = uniqueId('app-kanban');

  protected headId(id: string): string {
    return `${this.prefix}-head-${id}`;
  }

  protected bodyId(id: string): string {
    return `${this.prefix}-body-${id}`;
  }

  protected isCollapsed(id: string): boolean {
    return this.mobile() && this.collapsed().has(id);
  }

  protected toggle(id: string): void {
    const next = new Set(this.collapsed());
    if (!next.delete(id)) {
      next.add(id);
    }
    this.collapsed.set(next);
  }
}
