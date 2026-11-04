import { Routes } from '@angular/router';
import { ArbePageComponent } from './pages/arbe.page';
import { AssumptionsPageComponent } from './pages/assumptions.page';
import { ClockPageComponent } from './pages/clock.page';
import { ContentsPageComponent } from './pages/contents.page';
import { DataPageComponent } from './pages/data.page';
import { SettingsHomePageComponent } from './pages/home.page';
import { ParamsPageComponent } from './pages/params.page';
import { AboutPageComponent, UsersPageComponent } from './pages/users-about.pages';
import { settingsAreaGuard } from './state/settings-area.guard';

/**
 * M15 Configurações e dados de demonstração, montado em `/app/configuracoes` (`moduleGuard('settings')`).
 *
 * | Rota | Tela | Quem abre |
 * |---|---|---|
 * | `` | Porta de entrada e preferências | sócia e RT (cada um vê só o que pode abrir) |
 * | `dados` | SCR-M15-01 Dados de demonstração | sócia |
 * | `relogio` | SCR-M15-02 Relógio simulado | sócia |
 * | `parametros` | SCR-M15-03 Parâmetros (benefícios, desconto, prazos) | sócia |
 * | `arbe` | SCR-M15-04 Parâmetros da ARBE | sócia e RT |
 * | `conteudos` | Conteúdos de orientação | sócia e RT |
 * | `usuarios` | SCR-M15-05 Usuários de demonstração | sócia |
 * | `suposicoes` | SCR-M15-06 Suposições | sócia |
 * | `sobre` | SCR-M15-07 Sobre | sócia |
 *
 * Cada área passa por `settingsAreaGuard`: o RT só abre `arbe` e `guidance_content` (matriz do escopo, 1.2).
 */
export const ROUTES: Routes = [
  {
    path: '',
    component: SettingsHomePageComponent,
    data: { title: 'Configurações', moduleId: 'M15' },
  },
  {
    path: 'dados',
    component: DataPageComponent,
    canActivate: [settingsAreaGuard('data')],
    data: { title: 'Dados de demonstração' },
  },
  {
    path: 'relogio',
    component: ClockPageComponent,
    canActivate: [settingsAreaGuard('clock')],
    data: { title: 'Relógio simulado' },
  },
  { path: 'beneficios', pathMatch: 'full', redirectTo: 'parametros' },
  {
    path: 'parametros',
    component: ParamsPageComponent,
    canActivate: [settingsAreaGuard('params')],
    data: { title: 'Parâmetros' },
  },
  {
    path: 'arbe',
    component: ArbePageComponent,
    canActivate: [settingsAreaGuard('arbe')],
    data: { title: 'Parâmetros da ARBE' },
  },
  {
    path: 'conteudos',
    component: ContentsPageComponent,
    canActivate: [settingsAreaGuard('guidance_content')],
    data: { title: 'Conteúdos de orientação' },
  },
  {
    path: 'usuarios',
    component: UsersPageComponent,
    canActivate: [settingsAreaGuard('users')],
    data: { title: 'Usuários de demonstração' },
  },
  {
    path: 'suposicoes',
    component: AssumptionsPageComponent,
    canActivate: [settingsAreaGuard('assumptions')],
    data: { title: 'Suposições' },
  },
  {
    path: 'sobre',
    component: AboutPageComponent,
    canActivate: [settingsAreaGuard('about')],
    data: { title: 'Sobre o protótipo' },
  },
];
