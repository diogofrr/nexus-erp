import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { rovingIndex } from '../util/roving';
import { uniqueId } from '../util/ids';
import { IconComponent, IconName } from './icon.component';

export interface TabItem {
  id: string;
  label: string;
  /** Contagem pequena ao lado do rótulo. */
  badge?: number;
  icon?: IconName;
  disabled?: boolean;
  /** Por que está desabilitada (aba sem permissão ou sem condição). Vira dica e texto para leitor de tela. */
  disabledReason?: string;
}

/**
 * Abas (`role="tablist"`): setas, Home e End movem e selecionam; só a aba atual entra na ordem do Tab. A aba
 * atual leva a linha dourada. O painel é o conteúdo projetado: troque-o com `@switch` (só renderiza o que
 * está aberto). Guarde a aba na URL (`?aba=`) com `selected`.
 *
 * ```html
 * <app-tabs label="Ficha do cuidador" [tabs]="tabs" [(selected)]="tab">
 *   @switch (tab()) { @case ('resumo') { ... } @case ('consentimentos') { ... } }
 * </app-tabs>
 * ```
 */
@Component({
  selector: 'app-tabs',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tabs" role="tablist" [attr.aria-label]="label()">
      @for (tab of tabs(); track tab.id; let i = $index) {
        <button
          type="button"
          class="tab"
          role="tab"
          [id]="tabId(tab.id)"
          [attr.aria-selected]="tab.id === current()"
          [attr.aria-controls]="panelId"
          [attr.tabindex]="tab.id === current() ? 0 : -1"
          [attr.aria-disabled]="tab.disabled ? 'true' : null"
          [attr.title]="tab.disabled ? tab.disabledReason : null"
          [disabled]="tab.disabled"
          (click)="choose(tab.id)"
          (keydown)="onKey($event, i)"
        >
          @if (tab.icon) {
            <svg [appIcon]="tab.icon" size="sm"></svg>
          }
          {{ tab.label }}
          @if (tab.badge !== undefined) {
            <span class="badge badge--count">{{ tab.badge }}</span>
          }
          @if (tab.disabled && tab.disabledReason) {
            <span class="sr-only">({{ tab.disabledReason }})</span>
          }
        </button>
      }
    </div>
    <div class="tab-panel" role="tabpanel" tabindex="0" [id]="panelId" [attr.aria-labelledby]="tabId(current())">
      <ng-content />
    </div>
  `,
})
export class TabsComponent {
  private readonly doc = inject(DOCUMENT);
  readonly tabs = input.required<readonly TabItem[]>();
  /** Id da aba atual. Sem valor, abre a primeira habilitada. */
  readonly selected = model<string>();
  /** Nome acessível da lista de abas. */
  readonly label = input.required<string>();

  protected readonly panelId = uniqueId('app-tabpanel');
  private readonly prefix = uniqueId('app-tab');

  protected readonly current = computed(() => {
    const wanted = this.selected();
    const all = this.tabs();
    return all.find((t) => t.id === wanted && !t.disabled)?.id ?? all.find((t) => !t.disabled)?.id ?? '';
  });

  protected tabId(id: string): string {
    return `${this.prefix}-${id}`;
  }

  protected choose(id: string): void {
    this.selected.set(id);
  }

  protected onKey(event: KeyboardEvent, index: number): void {
    const all = this.tabs();
    const next = rovingIndex(event.key, index, all.length, (i) => all[i]?.disabled === true);
    const target = next === null ? undefined : all[next];
    if (!target) {
      return;
    }
    event.preventDefault();
    this.choose(target.id);
    this.doc.getElementById(this.tabId(target.id))?.focus();
  }
}
