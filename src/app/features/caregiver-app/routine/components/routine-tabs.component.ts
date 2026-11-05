import { ChangeDetectionStrategy, Component, ElementRef, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

export type RoutineTab = 'agenda' | 'remedios';

interface TabItem {
  id: RoutineTab;
  label: string;
  link: string;
}

const TABS: readonly TabItem[] = [
  { id: 'agenda', label: 'Agenda', link: '/cuidador/rotina/agenda' },
  { id: 'remedios', label: 'Remédios', link: '/cuidador/rotina/remedios' },
];

/**
 * As duas abas de Rotina (UX C5 e C6): Agenda e Remédios, de 56 px, com a linha dourada na atual. Cada aba é um
 * link de verdade (a rota muda), com `role="tab"` e `aria-selected`; as setas, Home e End movem entre as abas.
 * O conteúdo da aba fica num `role="tabpanel"` de quem usa (`panelId`).
 */
@Component({
  selector: 'app-routine-tabs',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .routine-tabs {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin: 0 0 var(--cg-gap-block);
      border-bottom: 1px solid var(--cg-border);
    }
    .routine-tab {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: var(--cg-target-lg);
      padding: 0.5rem 1rem;
      color: var(--cg-text-soft);
      font-weight: var(--fw-semibold);
      text-align: center;
      text-decoration: none;
    }
    .routine-tab[aria-selected='true'] {
      color: var(--cg-heading);
      font-weight: 700;
    }
    .routine-tab[aria-selected='true']::after {
      content: '';
      position: absolute;
      inset: auto 0 -1px;
      height: 3px;
      background: var(--cg-gold-line);
    }
    .routine-tab:hover {
      background: var(--cg-surface-sunken);
    }
  `,
  template: `
    <div class="routine-tabs" role="tablist" aria-label="Rotina">
      @for (tab of tabs; track tab.id) {
        <a
          class="routine-tab"
          role="tab"
          [id]="'routine-tab-' + tab.id"
          [routerLink]="tab.link"
          [attr.aria-selected]="current() === tab.id"
          [attr.aria-controls]="panelId()"
          [attr.tabindex]="current() === tab.id ? 0 : -1"
          (keydown)="onKey($event)"
        >{{ tab.label }}</a>
      }
    </div>
  `,
})
export class RoutineTabsComponent {
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly current = input.required<RoutineTab>();
  /** Id do painel que a aba controla. */
  readonly panelId = input('routine-panel');

  protected readonly tabs = TABS;

  protected onKey(event: KeyboardEvent): void {
    const index = TABS.findIndex((t) => t.id === this.current());
    let next = index;
    if (event.key === 'ArrowRight') {
      next = (index + 1) % TABS.length;
    } else if (event.key === 'ArrowLeft') {
      next = (index - 1 + TABS.length) % TABS.length;
    } else if (event.key === 'Home') {
      next = 0;
    } else if (event.key === 'End') {
      next = TABS.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    const target = TABS[next];
    if (target && next !== index) {
      void this.router.navigateByUrl(target.link);
    }
    this.host.nativeElement.querySelector<HTMLElement>(`#routine-tab-${TABS[next]?.id}`)?.focus();
  }
}
