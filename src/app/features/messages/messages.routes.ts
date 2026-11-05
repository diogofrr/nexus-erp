import { Routes } from '@angular/router';

/**
 * M11 Caixa de mensagens, montado em `/app/mensagens`.
 * Telas: caixa de entrada (SCR-M11-01), mensagem na gaveta (`:id`, SCR-M11-02; "Registrar contato" é o
 * SCR-M11-03, aberto por botão, tecla `N` ou `?acao=registrar-contato`) e `modelos` (SCR-M11-06).
 * `modelos` vem antes de `:id` para não ser lido como id. A caixa e a gaveta são a mesma página, então
 * abrir uma mensagem não recarrega a lista.
 */
export const ROUTES: Routes = [
  {
    path: 'modelos',
    data: { title: 'Modelos de resposta' },
    loadComponent: () => import('./pages/templates.page').then((m) => m.TemplatesPage),
  },
  {
    path: '',
    data: { title: 'Mensagens' },
    loadComponent: () => import('./pages/inbox.page').then((m) => m.InboxPage),
    children: [{ path: ':id', data: { title: 'Mensagem' }, children: [] }],
  },
];

/**
 * M11 Reclamações, montado em `/app/reclamacoes` (lista e `:id`; SCR-M11-04 e SCR-M11-05).
 */
export const COMPLAINT_ROUTES: Routes = [
  {
    path: '',
    data: { title: 'Reclamações' },
    loadComponent: () => import('./pages/complaints.page').then((m) => m.ComplaintsPage),
  },
  {
    path: ':id',
    data: { title: 'Reclamação' },
    loadComponent: () => import('./pages/complaint-detail.page').then((m) => m.ComplaintDetailPage),
  },
];
