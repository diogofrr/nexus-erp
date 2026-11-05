import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

/**
 * Seção recolhível do painel (UX 5.13: no máximo 6 cartões acima da dobra; o resto fica em seções que se abrem).
 * É um `details` de verdade: teclado e leitor de tela funcionam sem código.
 */
@Component({
  selector: 'app-panel-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    details {
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--surface);
    }
    summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      min-height: 3rem;
      padding: var(--space-2) var(--space-4);
      cursor: pointer;
      font-weight: var(--fw-semibold);
      color: var(--text-heading);
    }
    .hint {
      font-weight: var(--fw-regular);
      font-size: var(--fs-sm);
      color: var(--text-muted);
    }
    .body {
      padding: var(--space-2) var(--space-4) var(--space-4);
      display: grid;
      gap: var(--space-4);
    }
  `,
  template: `
    <details [open]="open()">
      <summary>
        <span>{{ title() }}</span>
        @if (hint()) {
          <span class="hint">{{ hint() }}</span>
        }
      </summary>
      <div class="body"><ng-content /></div>
    </details>
  `,
})
export class PanelSectionComponent {
  readonly title = input.required<string>();
  readonly hint = input<string>();
  readonly open = input(false, { transform: booleanAttribute });
}
