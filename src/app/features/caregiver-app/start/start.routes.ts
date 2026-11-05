import { Routes } from '@angular/router';
import { CaregiverPlaceholderComponent } from '../routing/area-placeholder.component';

/**
 * Área "Começar e perfil" do aplicativo do cuidador (P1). Montada em `/cuidador/comecar` por
 * `routing/caregiver-areas.ts`, com carregamento sob demanda. Cada rota abaixo aponta para a tela provisória:
 * troque `component` pela tela de verdade e MANTENHA `data.title` (vira o título da aba). Acrescente as
 * sub-rotas da área aqui, nunca em outro arquivo.
 */
export const ROUTES: Routes = [
  { path: '', component: CaregiverPlaceholderComponent, data: { title: 'Começar' } },
];

/**
 * Segunda rota base da área, montada em `/cuidador/mais/perfil` (ver `routing/caregiver-areas.ts`).
 */
export const PROFILE_ROUTES: Routes = [
  { path: '', component: CaregiverPlaceholderComponent, data: { title: 'Meu perfil' } },
];
