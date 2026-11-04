import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, TemplateRef, input } from '@angular/core';

export interface DescriptionItem {
  label: string;
  /** Texto do valor. */
  value?: string | number | null;
  /** Valor personalizado (por exemplo um `app-masked-field`): tem prioridade sobre `value`. */
  template?: TemplateRef<unknown>;
}

/**
 * Lista descritiva (`.dl`): rótulo e valor, para fichas. Uma coluna no celular. Valor vazio mostra
 * "Não informado" (nunca célula em branco).
 *
 * ```html
 * <app-description-list [items]="[{ label: 'Cidade', value: 'Uberlândia' }, { label: 'CPF', template: cpf }]" />
 * <ng-template #cpf><app-masked-field ... /></ng-template>
 * ```
 */
@Component({
  selector: 'app-description-list',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dl class="dl">
      @for (item of items(); track item.label) {
        <dt>{{ item.label }}</dt>
        <dd>
          @if (item.template; as tpl) {
            <ng-container *ngTemplateOutlet="tpl" />
          } @else if (item.value !== undefined && item.value !== null && item.value !== '') {
            {{ item.value }}
          } @else {
            <span class="t-muted">{{ emptyText() }}</span>
          }
        </dd>
      }
    </dl>
  `,
})
export class DescriptionListComponent {
  readonly items = input.required<readonly DescriptionItem[]>();
  readonly emptyText = input('Não informado');
}
