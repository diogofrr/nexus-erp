import { Routes } from '@angular/router';
import { CaregiverPlaceholderComponent } from '../routing/area-placeholder.component';

/**
 * Área "Cartão Nexus" do aplicativo do cuidador (P3). Montada em `/cuidador/rede/cartao` por
 * `routing/caregiver-areas.ts`, com carregamento sob demanda. Cada rota abaixo aponta para a tela provisória:
 * troque `component` pela tela de verdade e MANTENHA `data.title` (vira o título da aba). Acrescente as
 * sub-rotas da área aqui, nunca em outro arquivo.
 */
export const ROUTES: Routes = [
  { path: '', component: CaregiverPlaceholderComponent, data: { title: 'Cartão Nexus' } },
];
