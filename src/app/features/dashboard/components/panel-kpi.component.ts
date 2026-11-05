import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '@shared/ui';

/**
 * Indicador do painel: igual ao `app-kpi` do design system, mas o link leva ao módulo COM o filtro aplicado
 * (`?filtro=contato-hoje`, AC-M02-08). Com `suppressed` mostra "menos de 5" com cadeado, sem número (RN-KPI-02).
 * O item inteiro é o link; o texto diz o que há e o contexto diz o que fazer ou comparar.
 */
@Component({
  selector: 'app-panel-kpi',
  imports: [NgTemplateOutlet, RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'kpi' },
  styles: `
    .kpi-link {
      display: grid;
      gap: var(--space-1);
      color: inherit;
      text-decoration: none;
    }
    .kpi-link:hover .kpi__label {
      text-decoration: underline;
    }
  `,
  template: `
    @if (link(); as target) {
      <a class="kpi-link" [routerLink]="target" [queryParams]="queryParams()">
        <ng-container *ngTemplateOutlet="body" />
      </a>
    } @else {
      <div class="kpi-link"><ng-container *ngTemplateOutlet="body" /></div>
    }
    <ng-template #body>
      <span class="kpi__label">{{ label() }}</span>
      @if (suppressed()) {
        <span class="kpi__value kpi__value--private"><svg appIcon="lock"></svg>menos de 5</span>
        <span class="kpi__meta">Por privacidade, não mostramos o número.</span>
      } @else {
        <span class="kpi__value">{{ value() }}@if (unit()) {<small>{{ unit() }}</small>}</span>
        @if (context()) {
          <span class="kpi__meta" [class.kpi__delta--bad]="tone() === 'bad'" [class.kpi__delta--good]="tone() === 'good'">
            @if (tone() === 'bad') {
              <svg appIcon="triangle-alert" size="sm"></svg>
            }
            {{ context() }}
          </span>
        }
      }
    </ng-template>
  `,
})
export class PanelKpiComponent {
  readonly label = input.required<string>();
  readonly value = input<string | number>('');
  readonly unit = input<string>();
  readonly context = input<string>();
  readonly link = input<string>();
  readonly queryParams = input<Record<string, string> | undefined>(undefined);
  readonly suppressed = input(false, { transform: booleanAttribute });
  readonly tone = input<'neutral' | 'good' | 'bad'>('neutral');
}
