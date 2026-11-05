import { Routes } from '@angular/router';
import { CostsPageComponent } from './pages/costs.page';
import { FinanceOverviewPageComponent } from './pages/finance-overview.page';
import { IndicatorsPageComponent } from './pages/indicators.page';
import { InvestmentPageComponent } from './pages/investment.page';
import { ParamsPageComponent } from './pages/params.page';
import { PilotPageComponent } from './pages/pilot.page';
import { ProjectionPageComponent } from './pages/projection.page';

/**
 * M10 Financeiro, montado em `/app/financeiro` (só `partner`, `moduleGuard('finance')`).
 *
 * | Rota | Tela |
 * |---|---|
 * | `` | SCR-M10-01 Visão financeira |
 * | `projecao` | SCR-M10-02 Projeção de 24 meses |
 * | `parametros` | SCR-M10-03 Parâmetros financeiros |
 * | `investimento` | SCR-M10-04 Investimento e capital |
 * | `custos` | SCR-M10-05 Custos |
 *
 * A exportação (SCR-M10-08) são os botões "Baixar tabela (CSV)" e "Baixar parâmetros (JSON)".
 */
export const ROUTES: Routes = [
  {
    path: '',
    component: FinanceOverviewPageComponent,
    data: { title: 'Financeiro', moduleId: 'M10' },
  },
  {
    path: 'projecao',
    component: ProjectionPageComponent,
    data: { title: 'Projeção de 24 meses', crumb: 'Projeção', moduleId: 'M10' },
  },
  {
    path: 'parametros',
    component: ParamsPageComponent,
    data: { title: 'Parâmetros financeiros', crumb: 'Parâmetros', moduleId: 'M10' },
  },
  {
    path: 'investimento',
    component: InvestmentPageComponent,
    data: { title: 'Investimento e capital', crumb: 'Investimento', moduleId: 'M10' },
  },
  {
    path: 'custos',
    component: CostsPageComponent,
    data: { title: 'Custos', moduleId: 'M10' },
  },
];

/**
 * M10 Indicadores (People Analytics), montado em `/app/indicadores` (SCR-M10-06). Cada perfil abre só as abas
 * que a matriz libera (`?aba=cuidadores|rede|equipe|atendimento`).
 */
export const INDICATORS_ROUTES: Routes = [
  {
    path: '',
    component: IndicatorsPageComponent,
    data: { title: 'Indicadores', moduleId: 'M10' },
  },
];

/**
 * M10 Piloto (MVP), montado em `/app/piloto` (SCR-M10-07, `partner` e `technical_lead` agregado).
 */
export const PILOT_ROUTES: Routes = [
  { path: '', component: PilotPageComponent, data: { title: 'Piloto', moduleId: 'M10' } },
];
