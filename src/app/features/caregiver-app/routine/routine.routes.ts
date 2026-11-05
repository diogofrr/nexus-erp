import { Routes } from '@angular/router';
import { CaregiverPlaceholderComponent } from '../routing/area-placeholder.component';

/**
 * Área "Rotina" do aplicativo do cuidador (P1). Montada em `/cuidador/rotina` por
 * `routing/caregiver-areas.ts`, com carregamento sob demanda. Cada rota abaixo aponta para a tela provisória:
 * troque `component` pela tela de verdade e MANTENHA `data.title` (vira o título da aba). Acrescente as
 * sub-rotas da área aqui, nunca em outro arquivo.
 */
export const ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'agenda' },
  { path: 'agenda', component: CaregiverPlaceholderComponent, data: { title: 'Agenda' } },
  { path: 'remedios', component: CaregiverPlaceholderComponent, data: { title: 'Remédios' } },
];
