import { Routes } from '@angular/router';
import { roleGuard } from '@core/auth';

/**
 * M08 Rede credenciada, montado em `/app/rede`.
 *
 * - `prestadores` e `prestadores/:id`: sócia, atendimento (leitura) e responsável técnico (só psicologia, para
 *   validar o registro no conselho).
 * - Todas as outras telas: sócia e atendimento. O atendimento só lê, e registra solicitações e avaliações em
 *   nome do usuário (RN-CAN-05). O responsável técnico não abre estas telas (escopo 1.3).
 */
const MANAGEMENT = roleGuard('partner', 'support');

export const ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'prestadores' },
  {
    path: 'prestadores',
    data: { title: 'Prestadores' },
    loadComponent: () => import('./pages/providers.page').then((m) => m.ProvidersPage),
  },
  {
    path: 'prestadores/:id',
    data: { title: 'Ficha do prestador' },
    loadComponent: () => import('./pages/provider-detail.page').then((m) => m.ProviderDetailPage),
  },
  {
    path: 'credenciamento',
    canActivate: [MANAGEMENT],
    data: { title: 'Credenciamento' },
    loadComponent: () =>
      import('./pages/accreditation-board.page').then((m) => m.AccreditationBoardPage),
  },
  {
    path: 'credenciamento/novo',
    canActivate: [roleGuard('partner')],
    data: { title: 'Novo credenciamento' },
    loadComponent: () => import('./pages/accreditation-new.page').then((m) => m.AccreditationNewPage),
  },
  {
    path: 'credenciamento/:id',
    canActivate: [MANAGEMENT],
    data: { title: 'Processo de credenciamento' },
    loadComponent: () =>
      import('./pages/accreditation-process.page').then((m) => m.AccreditationProcessPage),
  },
  {
    path: 'solicitacoes',
    canActivate: [MANAGEMENT],
    data: { title: 'Solicitações de serviço' },
    loadComponent: () => import('./pages/requests.page').then((m) => m.RequestsPage),
  },
  {
    path: 'avaliacoes',
    canActivate: [MANAGEMENT],
    data: { title: 'Avaliações da rede' },
    loadComponent: () => import('./pages/evaluations.page').then((m) => m.EvaluationsPage),
  },
  {
    path: 'auditoria',
    canActivate: [MANAGEMENT],
    data: { title: 'Auditoria quinzenal' },
    loadComponent: () => import('./pages/audit.page').then((m) => m.AuditPage),
  },
  {
    path: 'avaliacao-interna/:id',
    canActivate: [MANAGEMENT],
    data: { title: 'Avaliação interna' },
    loadComponent: () => import('./pages/internal-review.page').then((m) => m.InternalReviewPage),
  },
  {
    path: 'busca',
    canActivate: [MANAGEMENT],
    data: { title: 'Busca como o usuário vê' },
    loadComponent: () => import('./pages/search.page').then((m) => m.SearchPage),
  },
  {
    path: 'sinais',
    canActivate: [MANAGEMENT],
    data: { title: 'Sinais da rede' },
    loadComponent: () => import('./pages/signals.page').then((m) => m.SignalsPage),
  },
];
