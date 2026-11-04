import { Routes } from '@angular/router';
import { authGuard, guestGuard, moduleGuard } from './core/auth/guards';

/**
 * Roteador central. Cada módulo é carregado sob demanda de `features/<slug>/<slug>.routes.ts`, que
 * exporta `ROUTES` (e, quando o módulo tem mais de uma rota base, `COMPANY_ROUTES`, `INDICATORS_ROUTES`...).
 * Os devs de módulo só preenchem a própria pasta e NÃO mexem neste arquivo.
 *
 * Guards (core/auth/guards.ts): `authGuard` exige sessão; `moduleGuard(chave)` aplica a matriz de
 * permissões do módulo (mapa de módulos, escopo seção 2). Rota sem permissão leva a `/403` e grava `denied`.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'app/painel' },

  // M01 Acesso
  {
    path: 'login',
    canActivate: [guestGuard],
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.ROUTES),
  },
  {
    path: '403',
    canActivate: [authGuard],
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.FORBIDDEN_ROUTES),
  },

  // M14 Portal do profissional credenciado
  {
    path: 'portal',
    canActivate: [authGuard, moduleGuard('provider-portal')],
    loadChildren: () =>
      import('./features/provider-portal/provider-portal.routes').then((m) => m.ROUTES),
  },

  // Back-office (equipe Nexus)
  {
    path: 'app',
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'painel' },
      {
        path: 'painel',
        canActivate: [moduleGuard('dashboard')],
        loadChildren: () => import('./features/dashboard/dashboard.routes').then((m) => m.ROUTES),
      },
      {
        path: 'cuidadores',
        canActivate: [moduleGuard('caregivers')],
        loadChildren: () => import('./features/caregivers/caregivers.routes').then((m) => m.ROUTES),
      },
      {
        path: 'assinaturas',
        canActivate: [moduleGuard('subscriptions')],
        loadChildren: () =>
          import('./features/subscriptions/subscriptions.routes').then((m) => m.ROUTES),
      },
      {
        path: 'atendimento',
        canActivate: [moduleGuard('care-sessions')],
        loadChildren: () =>
          import('./features/care-sessions/care-sessions.routes').then((m) => m.ROUTES),
      },
      {
        path: 'acompanhamento',
        canActivate: [moduleGuard('zarit')],
        loadChildren: () => import('./features/zarit/zarit.routes').then((m) => m.ROUTES),
      },
      {
        path: 'grupos',
        canActivate: [moduleGuard('groups')],
        loadChildren: () => import('./features/groups/groups.routes').then((m) => m.ROUTES),
      },
      {
        path: 'rede',
        canActivate: [moduleGuard('network')],
        loadChildren: () => import('./features/network/network.routes').then((m) => m.ROUTES),
      },
      {
        path: 'parceiros',
        canActivate: [moduleGuard('partners')],
        loadChildren: () => import('./features/partners/partners.routes').then((m) => m.ROUTES),
      },
      {
        path: 'empresas',
        canActivate: [moduleGuard('companies')],
        loadChildren: () =>
          import('./features/partners/partners.routes').then((m) => m.COMPANY_ROUTES),
      },
      {
        path: 'financeiro',
        canActivate: [moduleGuard('finance')],
        loadChildren: () => import('./features/finance/finance.routes').then((m) => m.ROUTES),
      },
      {
        path: 'indicadores',
        canActivate: [moduleGuard('indicators')],
        loadChildren: () =>
          import('./features/finance/finance.routes').then((m) => m.INDICATORS_ROUTES),
      },
      {
        path: 'piloto',
        canActivate: [moduleGuard('pilot')],
        loadChildren: () => import('./features/finance/finance.routes').then((m) => m.PILOT_ROUTES),
      },
      {
        path: 'mensagens',
        canActivate: [moduleGuard('messages')],
        loadChildren: () => import('./features/messages/messages.routes').then((m) => m.ROUTES),
      },
      {
        path: 'reclamacoes',
        canActivate: [moduleGuard('complaints')],
        loadChildren: () =>
          import('./features/messages/messages.routes').then((m) => m.COMPLAINT_ROUTES),
      },
      {
        path: 'lgpd',
        canActivate: [moduleGuard('privacy')],
        loadChildren: () => import('./features/privacy/privacy.routes').then((m) => m.ROUTES),
      },
      {
        path: 'governanca',
        canActivate: [moduleGuard('governance')],
        loadChildren: () => import('./features/governance/governance.routes').then((m) => m.ROUTES),
      },
      {
        path: 'configuracoes',
        canActivate: [moduleGuard('settings')],
        loadChildren: () => import('./features/settings/settings.routes').then((m) => m.ROUTES),
      },
    ],
  },

  // M01 Não encontrado (SCR-M01-06)
  {
    path: '**',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.NOT_FOUND_ROUTES),
  },
];
