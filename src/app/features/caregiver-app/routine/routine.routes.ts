import { Routes } from '@angular/router';

/**
 * Área "Rotina" do aplicativo do cuidador (P1). Montada em `/cuidador/rotina` por
 * `routing/caregiver-areas.ts`, com carregamento sob demanda: Agenda (C5) e Remédios (C6), em duas abas. O título
 * da aba do navegador vem de `data.title`.
 */
export const ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'agenda' },
  {
    path: 'agenda',
    loadComponent: () => import('./pages/agenda.page').then((m) => m.AgendaPage),
    data: { title: 'Agenda' },
  },
  {
    path: 'remedios',
    loadComponent: () => import('./pages/medications.page').then((m) => m.MedicationsPage),
    data: { title: 'Remédios' },
  },
];
