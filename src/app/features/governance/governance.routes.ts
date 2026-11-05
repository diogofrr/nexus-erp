import { Routes } from '@angular/router';
import { permissionGuard, roleGuard } from '@core/auth';
import { ContentsPageComponent } from './pages/contents.page';
import { NormsPageComponent } from './pages/norms.page';
import { OccurrencePageComponent } from './pages/occurrence.page';
import { OccurrencesPageComponent } from './pages/occurrences.page';
import { GovernanceOverviewPageComponent } from './pages/overview.page';
import { PopPageComponent } from './pages/pop.page';
import { PopsPageComponent } from './pages/pops.page';
import { ReferralsPageComponent } from './pages/referrals.page';
import { RiskPageComponent } from './pages/risk.page';
import { RisksPageComponent } from './pages/risks.page';
import { TrainingPageComponent } from './pages/training.page';

/**
 * M13 Governança (POPs, riscos, encaminhamentos, ocorrências, formação), montado em `/app/governanca`
 * (`moduleGuard('governance')` no roteador central: gestão, RT, psicólogo e atendimento).
 *
 * | Rota | Tela |
 * |---|---|
 * | `` | Visão geral |
 * | `pops` e `pops/:code` | SCR-M13-01 POPs e SCR-M13-02 POP |
 * | `riscos` e `riscos/:id` | SCR-M13-03 Riscos e SCR-M13-04 Risco |
 * | `encaminhamentos` | SCR-M13-05 Encaminhamentos (o 06, novo encaminhamento, é a gaveta) |
 * | `ocorrencias` e `ocorrencias/:id` | SCR-M13-07 e 08 (RT, psicólogo do caso; gestão só contagem; atendimento barrado) |
 * | `formacao` | SCR-M13-09 Formação |
 * | `conteudos` | SCR-M13-10 Conteúdos de orientação |
 * | `normas` | SCR-M13-11 Normas citadas |
 *
 * Ocorrências: a lista passa por `permissionGuard('occurrences')` (o atendimento vai a `/403`); o detalhe só abre
 * para RT e psicólogo (a gestão, que só vê contagem, também vai a `/403`).
 */
export const ROUTES: Routes = [
  {
    path: '',
    component: GovernanceOverviewPageComponent,
    data: { title: 'Governança', moduleId: 'M13' },
  },
  {
    path: 'pops',
    component: PopsPageComponent,
    data: { title: 'Procedimentos (POPs)', crumb: 'POPs', moduleId: 'M13' },
  },
  {
    path: 'pops/:code',
    component: PopPageComponent,
    data: { title: 'POP', moduleId: 'M13' },
  },
  {
    path: 'riscos',
    component: RisksPageComponent,
    data: { title: 'Riscos', moduleId: 'M13' },
  },
  {
    path: 'riscos/:id',
    component: RiskPageComponent,
    data: { title: 'Risco', moduleId: 'M13' },
  },
  {
    path: 'encaminhamentos',
    component: ReferralsPageComponent,
    data: { title: 'Encaminhamentos', moduleId: 'M13' },
  },
  {
    path: 'ocorrencias',
    component: OccurrencesPageComponent,
    canActivate: [permissionGuard('occurrences')],
    data: { title: 'Ocorrências', moduleId: 'M13' },
  },
  {
    path: 'ocorrencias/:id',
    component: OccurrencePageComponent,
    canActivate: [roleGuard('technical_lead', 'psychologist')],
    data: { title: 'Ocorrência', moduleId: 'M13' },
  },
  {
    path: 'formacao',
    component: TrainingPageComponent,
    data: { title: 'Formação e capacitação', crumb: 'Formação', moduleId: 'M13' },
  },
  {
    path: 'conteudos',
    component: ContentsPageComponent,
    data: { title: 'Conteúdos de orientação', crumb: 'Conteúdos', moduleId: 'M13' },
  },
  {
    path: 'normas',
    component: NormsPageComponent,
    data: { title: 'Normas citadas', crumb: 'Normas', moduleId: 'M13' },
  },
];
