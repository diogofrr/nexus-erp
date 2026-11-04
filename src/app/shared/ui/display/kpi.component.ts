import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent, IconName } from './icon.component';

export interface KpiDelta {
  /** "+2 desde outubro". Sempre em palavras: a seta e a cor não bastam. */
  text: string;
  /** Bom, ruim ou neutro (a cor). Independe da direção: queda de recusa é boa. */
  tone?: 'good' | 'bad' | 'neutral';
  direction?: 'up' | 'down' | 'flat';
}

const DELTA_ICON: Record<NonNullable<KpiDelta['direction']>, IconName> = {
  up: 'trending-up',
  down: 'trending-down',
  flat: 'minus',
};

/**
 * Indicador (`.kpi`): rótulo, valor grande em números tabulares, contexto e variação. Número sozinho não diz
 * nada: passe `context` ("meta 3%") ou `delta`. Coloque um gráfico pequeno ou medidor como conteúdo
 * (slot de sparkline). Com `link` vira clicável e leva à tela do módulo. Com `suppressed` mostra
 * "menos de 5" com cadeado, sem número, sem barra e sem variação (agregado de saúde abaixo do mínimo, RN-KPI-02).
 *
 * ```html
 * <app-kpi-strip>
 *   <app-kpi label="Assinantes" value="17" [delta]="{ text: '+2 desde outubro', tone: 'good', direction: 'up' }" />
 *   <app-kpi label="Resultado do mês" value="-R$ 843,51" context="meta: equilíbrio no mês 7" link="/app/financeiro" />
 * </app-kpi-strip>
 * ```
 */
@Component({
  selector: 'app-kpi',
  imports: [NgTemplateOutlet, RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'kpi' },
  template: `
    @if (link(); as target) {
      <a class="kpi__link" [routerLink]="target"><ng-container *ngTemplateOutlet="body" /></a>
    } @else {
      <ng-container *ngTemplateOutlet="body" />
    }
    <ng-template #body>
      <span class="kpi__label">{{ label() }}</span>
      @if (suppressed()) {
        <span class="kpi__value kpi__value--private"><svg appIcon="lock"></svg>menos de 5</span>
        <span class="kpi__meta">Por privacidade, não mostramos o número.</span>
      } @else {
        <span class="kpi__value">{{ value() }}@if (unit()) {<small>{{ unit() }}</small>}</span>
        @if (delta() || context()) {
          <span class="kpi__meta">
            @if (delta(); as d) {
              <span class="kpi__delta" [class.kpi__delta--good]="d.tone === 'good'" [class.kpi__delta--bad]="d.tone === 'bad'">
                <svg [appIcon]="deltaIcon(d)"></svg>{{ d.text }}
              </span>
            }
            @if (context()) {
              <span>{{ context() }}</span>
            }
          </span>
        }
        <ng-content />
      }
    </ng-template>
  `,
})
export class KpiComponent {
  readonly label = input.required<string>();
  /** Valor já formatado (use os pipes de `@core/format`). */
  readonly value = input<string | number>('');
  /** Unidade pequena depois do valor ("assinantes"). */
  readonly unit = input<string>();
  readonly context = input<string>();
  readonly delta = input<KpiDelta>();
  /** Rota do módulo (leva ao detalhe com o filtro aplicado). */
  readonly link = input<string | readonly unknown[]>();
  readonly suppressed = input(false, { transform: booleanAttribute });

  protected deltaIcon(delta: KpiDelta): IconName {
    return DELTA_ICON[delta.direction ?? 'flat'];
  }
}

/** Faixa de indicadores: uma superfície só com divisórias de 1 px (não quatro cartões soltos). */
@Component({
  selector: 'app-kpi-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'kpi-strip', role: 'group' },
  template: '<ng-content />',
})
export class KpiStripComponent {}
