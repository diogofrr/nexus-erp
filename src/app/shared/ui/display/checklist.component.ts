import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { BadgeComponent, BadgeVariant } from './badge.component';
import { IconComponent, IconName } from './icon.component';

export type ChecklistState = 'ok' | 'pending' | 'fail' | 'na';

export interface ChecklistItem {
  id: string;
  title: string;
  /** Detalhe e data ("válido até 30/06/2027"). */
  text?: string;
  state: ChecklistState;
  /** Texto do selo à direita. Padrão por estado: Cumprido, Pendente, Não cumprido, Não se aplica. */
  badge?: string;
}

const VIEW: Record<ChecklistState, { icon: IconName; variant: BadgeVariant; label: string; outline: boolean }> = {
  ok: { icon: 'circle-check', variant: 'success', label: 'Cumprido', outline: false },
  pending: { icon: 'clock', variant: 'attention', label: 'Pendente', outline: false },
  fail: { icon: 'circle-alert', variant: 'danger', label: 'Não cumprido', outline: false },
  na: { icon: 'circle-dashed', variant: 'neutral', label: 'Não se aplica', outline: true },
};

/** Quantos critérios ainda faltam (nem cumpridos, nem "não se aplica"): "Faltam 2 critérios". */
export function checklistMissing(items: readonly ChecklistItem[]): number {
  return items.filter((i) => i.state !== 'ok' && i.state !== 'na').length;
}

/**
 * Checklist de critérios (credenciamento, elegibilidade ao piloto). Cada linha tem ícone de FORMA diferente
 * por estado, título, detalhe e selo com texto. Use `checklistMissing(items)` para o botão "Aprovar":
 * fica desabilitado com o texto "Faltam N critérios" ao lado.
 *
 * ```html
 * <app-checklist label="Critérios de credenciamento" [items]="criteria" />
 * ```
 */
@Component({
  selector: 'app-checklist',
  imports: [BadgeComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="checklist" role="list" [attr.aria-label]="label()">
      @for (item of items(); track item.id) {
        <li class="checklist__item" [attr.data-state]="item.state">
          <svg [appIcon]="view(item.state).icon"></svg>
          <div>
            <div class="checklist__title">{{ item.title }}</div>
            @if (item.text) {
              <div class="checklist__text">{{ item.text }}</div>
            }
          </div>
          <app-badge [variant]="view(item.state).variant" [outline]="view(item.state).outline">{{ item.badge ?? view(item.state).label }}</app-badge>
        </li>
      }
    </ul>
  `,
})
export class ChecklistComponent {
  readonly items = input.required<readonly ChecklistItem[]>();
  readonly label = input.required<string>();

  protected view(state: ChecklistState): (typeof VIEW)[ChecklistState] {
    return VIEW[state];
  }
}
