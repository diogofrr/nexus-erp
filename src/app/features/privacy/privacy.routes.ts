import { Routes } from '@angular/router';
import { permissionGuard } from '@core/auth';
import { leaveIncidentFormGuard } from './pages/incidents.pages';

/**
 * M12 LGPD, montado em `/app/lgpd`. Consentimentos, termos e solicitações do titular abrem para a gestão, o
 * responsável técnico e o atendimento (que registra em nome do titular). O log, os incidentes, a política, o
 * RIPD e a retenção são só da gestão (leitura) e do responsável técnico: `permissionGuard('lgpd_audit_log')`.
 * A política em dois toques, aberta a todos, fica no rodapé (fora deste módulo, A-43).
 * "Meus dados no navegador" (SCR-M12-10) também é do rodapé.
 */
export const ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'consentimentos' },
  {
    path: 'consentimentos',
    data: { title: 'Consentimentos' },
    loadComponent: () => import('./pages/consents.page').then((m) => m.ConsentsPage),
  },
  {
    path: 'termos',
    data: { title: 'Termos de consentimento' },
    loadComponent: () => import('./pages/terms.page').then((m) => m.TermsPage),
  },
  {
    path: 'solicitacoes',
    data: { title: 'Solicitações do titular' },
    loadComponent: () => import('./pages/requests.page').then((m) => m.RequestsPage),
  },
  {
    path: 'solicitacoes/:id',
    data: { title: 'Solicitação do titular' },
    loadComponent: () => import('./pages/request-detail.page').then((m) => m.RequestDetailPage),
  },
  {
    path: 'log',
    canActivate: [permissionGuard('lgpd_audit_log')],
    data: { title: 'Log de acessos' },
    loadComponent: () => import('./pages/audit-log.page').then((m) => m.AuditLogPage),
  },
  {
    path: 'incidentes',
    canActivate: [permissionGuard('lgpd_audit_log')],
    data: { title: 'Incidentes de dados' },
    loadComponent: () => import('./pages/incidents.pages').then((m) => m.IncidentsPage),
  },
  {
    path: 'incidentes/novo',
    canActivate: [permissionGuard('lgpd_audit_log', 'update')],
    canDeactivate: [leaveIncidentFormGuard],
    data: { title: 'Registrar incidente' },
    loadComponent: () => import('./pages/incidents.pages').then((m) => m.IncidentFormPage),
  },
  {
    path: 'incidentes/:id',
    canActivate: [permissionGuard('lgpd_audit_log')],
    data: { title: 'Incidente de dados' },
    loadComponent: () => import('./pages/incidents.pages').then((m) => m.IncidentDetailPage),
  },
  {
    path: 'politica',
    canActivate: [permissionGuard('lgpd_audit_log')],
    data: { title: 'Política de privacidade', kind: 'privacy_policy' },
    loadComponent: () => import('./pages/privacy-doc.page').then((m) => m.PrivacyDocPage),
  },
  {
    path: 'ripd',
    canActivate: [permissionGuard('lgpd_audit_log')],
    data: { title: 'Relatório de impacto (RIPD)', kind: 'ripd' },
    loadComponent: () => import('./pages/privacy-doc.page').then((m) => m.PrivacyDocPage),
  },
  {
    path: 'retencao',
    canActivate: [permissionGuard('lgpd_audit_log')],
    data: { title: 'Retenção e eliminação' },
    loadComponent: () => import('./pages/retention.page').then((m) => m.RetentionPage),
  },
];
