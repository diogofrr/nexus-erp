import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LinkTab, LinkTabsComponent } from '@shared/ui/display/link-tabs.component';

export const FINANCE_TABS: readonly LinkTab[] = [
  { label: 'Visão geral', link: '/app/financeiro', exact: true },
  { label: 'Projeção', link: '/app/financeiro/projecao' },
  { label: 'Parâmetros', link: '/app/financeiro/parametros' },
  { label: 'Investimento e capital', link: '/app/financeiro/investimento' },
  { label: 'Custos', link: '/app/financeiro/custos' },
];

/** Atalho entre as telas do Financeiro (M10). */
@Component({
  selector: 'app-finance-tabs',
  imports: [LinkTabsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-link-tabs label="Telas do financeiro" [items]="tabs" />`,
})
export class FinanceTabsComponent {
  protected readonly tabs = FINANCE_TABS;
}
