import { Routes } from '@angular/router';
import { CaregiverPlaceholderComponent } from '../routing/area-placeholder.component';

/**
 * Área "Rede (a porta, buscar e pedidos)" do aplicativo do cuidador (P3). Montada em `/cuidador/rede` por
 * `routing/caregiver-areas.ts`, com carregamento sob demanda. Cada rota abaixo aponta para a tela provisória:
 * troque `component` pela tela de verdade e MANTENHA `data.title` (vira o título da aba). Acrescente as
 * sub-rotas da área aqui, nunca em outro arquivo.
 */
export const ROUTES: Routes = [
  { path: '', component: CaregiverPlaceholderComponent, data: { title: 'Rede' } },
  { path: 'buscar', component: CaregiverPlaceholderComponent, data: { title: 'Buscar' } },
  { path: 'profissional/:id', component: CaregiverPlaceholderComponent, data: { title: 'Profissional' } },
  { path: 'pedidos', component: CaregiverPlaceholderComponent, data: { title: 'Meus pedidos' } },
];
