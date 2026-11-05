import { Routes } from '@angular/router';

/**
 * M09 Parceiros do Cartão Nexus, montado em `/app/parceiros`.
 * Telas: lista e funil (SCR-M09-01) e ficha do parceiro `:id` (SCR-M09-02).
 */
export const ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { title: 'Parceiros do Cartão' },
    loadComponent: () =>
      import('./pages/partners-list.page').then((m) => m.PartnersListPageComponent),
  },
  {
    path: ':id',
    data: { title: 'Ficha do parceiro', crumb: 'Parceiro' },
    loadComponent: () =>
      import('./pages/partner-detail.page').then((m) => m.PartnerDetailPageComponent),
  },
];

/**
 * M09 Canal corporativo, montado em `/app/empresas`.
 * Telas: lista (SCR-M09-03) e ficha da empresa `:id` (SCR-M09-04). Convidar colaborador (SCR-M09-05) abre
 * numa gaveta da ficha.
 */
export const COMPANY_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { title: 'Empresas' },
    loadComponent: () =>
      import('./pages/companies-list.page').then((m) => m.CompaniesListPageComponent),
  },
  {
    path: ':id',
    data: { title: 'Ficha da empresa', crumb: 'Empresa' },
    loadComponent: () =>
      import('./pages/company-detail.page').then((m) => m.CompanyDetailPageComponent),
  },
];
