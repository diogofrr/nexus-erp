import { Routes } from '@angular/router';
import { careAreaGuard, careHomeRedirect, sessionAccessGuard } from './state/care-guards';

/**
 * M05 Atendimento psicológico, montado em `/app/atendimento` (`moduleGuard('care-sessions')`).
 *
 * | Rota | Tela | Quem abre |
 * |---|---|---|
 * | `` | porta de entrada: cada perfil cai na sua tela | todos que abrem o módulo |
 * | `agenda` | SCR-M05-01 Agenda (e SCR-M05-03 Agendar, em gaveta) | psicólogo (a sua), RT (consulta), atendimento (agenda) |
 * | `disponibilidade` | SCR-M05-02 Disponibilidade | psicólogo |
 * | `sessoes` | lista de sessões e estados | psicólogo (as suas), RT, atendimento |
 * | `sessoes/:id` | SCR-M05-04 Detalhe da sessão | idem |
 * | `sessoes/:id/anotacao` | SCR-M05-05 Anotação sigilosa | psicólogo autor; RT com motivo |
 * | `ocupacao` | SCR-M05-06 Ocupação (e SCR-M05-07 Redistribuir, em gaveta) | sócia, RT, psicólogo (a sua) |
 * | `salas` | SCR-M05-08 Salas | sócia (edita), RT, psicólogo, atendimento |
 * | `fila` | SCR-M05-09: é a mesma tela de `/app/acompanhamento/fila` (A-20), só outro acesso | psicólogo, RT |
 */
export const ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: careHomeRedirect },
  {
    path: 'agenda',
    canActivate: [careAreaGuard('schedule')],
    loadComponent: () => import('./pages/agenda.page').then((m) => m.AgendaPageComponent),
    data: { title: 'Agenda', moduleId: 'M05' },
  },
  {
    path: 'disponibilidade',
    canActivate: [careAreaGuard('availability')],
    loadComponent: () => import('./pages/availability.page').then((m) => m.AvailabilityPageComponent),
    data: { title: 'Disponibilidade' },
  },
  {
    path: 'sessoes',
    canActivate: [careAreaGuard('schedule')],
    loadComponent: () => import('./pages/sessions.page').then((m) => m.SessionsPageComponent),
    data: { title: 'Sessões' },
  },
  {
    path: 'sessoes/:id',
    canActivate: [sessionAccessGuard(false)],
    loadComponent: () => import('./pages/session-detail.page').then((m) => m.SessionDetailPageComponent),
    data: { title: 'Detalhe da sessão' },
  },
  {
    path: 'sessoes/:id/anotacao',
    canActivate: [sessionAccessGuard(true)],
    loadComponent: () => import('./pages/session-note.page').then((m) => m.SessionNotePageComponent),
    data: { title: 'Anotação da sessão' },
  },
  {
    path: 'ocupacao',
    canActivate: [careAreaGuard('occupancy')],
    loadComponent: () => import('./pages/occupancy.page').then((m) => m.OccupancyPageComponent),
    data: { title: 'Ocupação' },
  },
  {
    path: 'salas',
    canActivate: [careAreaGuard('rooms')],
    loadComponent: () => import('./pages/rooms.page').then((m) => m.RoomsPageComponent),
    data: { title: 'Salas do coworking' },
  },
  // A fila de acompanhamento é UMA tela, com dois pontos de entrada (UX 3.1 e A-20): este é só o atalho.
  { path: 'fila', pathMatch: 'full', redirectTo: '/app/acompanhamento/fila' },
];
