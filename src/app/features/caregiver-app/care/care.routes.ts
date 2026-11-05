import { Routes } from '@angular/router';
import { CaregiverPlaceholderComponent } from '../routing/area-placeholder.component';

/**
 * Área "Cuidar de mim (a porta) e Conversar com um psicólogo" do aplicativo do cuidador (P2). Montada em `/cuidador/cuidar-de-mim` por
 * `routing/caregiver-areas.ts`, com carregamento sob demanda. Cada rota abaixo aponta para a tela provisória:
 * troque `component` pela tela de verdade e MANTENHA `data.title` (vira o título da aba). Acrescente as
 * sub-rotas da área aqui, nunca em outro arquivo.
 */
export const ROUTES: Routes = [
  { path: '', component: CaregiverPlaceholderComponent, data: { title: 'Cuidar de mim' } },
  { path: 'atendimento', component: CaregiverPlaceholderComponent, data: { title: 'Conversar com um psicólogo' } },
];
