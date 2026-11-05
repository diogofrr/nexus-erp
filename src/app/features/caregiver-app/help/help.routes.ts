import { Routes } from '@angular/router';
import { CaregiverPlaceholderComponent } from '../routing/area-placeholder.component';

/**
 * Área "Falar com a Nexus e Ajuda agora" do aplicativo do cuidador (P2). Montada em `/cuidador/mais/ajuda` por
 * `routing/caregiver-areas.ts`, com carregamento sob demanda. Cada rota abaixo aponta para a tela provisória:
 * troque `component` pela tela de verdade e MANTENHA `data.title` (vira o título da aba). Acrescente as
 * sub-rotas da área aqui, nunca em outro arquivo.
 */
export const ROUTES: Routes = [
  { path: '', component: CaregiverPlaceholderComponent, data: { title: 'Falar com a Nexus' } },
];

/**
 * Segunda rota base da área, montada em `/cuidador/ajuda-agora` (ver `routing/caregiver-areas.ts`).
 */
export const HELP_NOW_ROUTES: Routes = [
  { path: '', component: CaregiverPlaceholderComponent, data: { title: 'Ajuda agora' } },
];
