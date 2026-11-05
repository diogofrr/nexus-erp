import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ArpBand, ProviderStatus } from '@core/models';
import { RefusalStats } from '@core/rules';
import { formatPercent } from '@core/format';
import { BadgeComponent } from '@shared/ui';
import { BAND_VIEW, PROVIDER_STATUS_VIEW } from '../state/network-labels';

/** Estado do prestador: texto mais ícone, nunca só cor. */
@Component({
  selector: 'app-provider-status',
  imports: [BadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-badge [variant]="view().variant" [icon]="view().icon">{{ view().label }}</app-badge>`,
})
export class ProviderStatusComponent {
  readonly status = input.required<ProviderStatus>();
  protected readonly view = computed(() => PROVIDER_STATUS_VIEW[this.status()]);
}

/** Faixa da ARP vista pela gestão (RN-ARP-06 a 08). */
@Component({
  selector: 'app-arp-band',
  imports: [BadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-badge [variant]="view().variant" [icon]="view().icon">{{ view().label }}</app-badge>`,
})
export class ArpBandComponent {
  readonly band = input.required<ArpBand>();
  protected readonly view = computed(() => BAND_VIEW[this.band()]);
}

/** Taxa de recusa dos últimos 30 dias, com o selo "Risco de saída" (termo interno da gestão, A-35). */
@Component({
  selector: 'app-refusal',
  imports: [BadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (stats().percent === null) {
      <span class="t-muted">Sem solicitações em 30 dias</span>
    } @else {
      <span class="t-num">{{ percent() }}</span>
      <span class="t-caption"> ({{ stats().refusedOrCancelledByProvider }} de {{ stats().received }})</span>
      @if (stats().exitRisk) {
        <app-badge variant="attention" icon="triangle-alert">Risco de saída</app-badge>
      }
    }
  `,
})
export class RefusalComponent {
  readonly stats = input.required<RefusalStats>();
  protected readonly percent = computed(() => formatPercent(this.stats().percent, { decimals: 1 }));
}
