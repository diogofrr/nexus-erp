import { inject, isDevMode } from '@angular/core';
import { CanMatchFn, Route, Routes } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import {
  authGuard,
  caregiverAreaGuard,
  guestGuard,
  homeRedirectGuard,
  moduleGuard,
  roleGuard,
} from './core/auth/guards';

/**
 * Roteador central. Cada módulo é carregado sob demanda de `features/<slug>/<slug>.routes.ts`, que
 * exporta `ROUTES` (e, quando o módulo tem mais de uma rota base, `COMPANY_ROUTES`, `INDICATORS_ROUTES`...).
 * Os devs de módulo só preenchem a própria pasta e NÃO mexem neste arquivo.
 *
 * Shells (layout): `/app/**` abre dentro do shell da equipe (menu lateral, barra superior, rodapé), `/cuidador/**`
 * abre dentro do shell do cuidador (cabeçalho com Ajuda agora, barra inferior) e `/login`, `/403` e `**` não têm shell.
 * São duas portas separadas: a sessão do cuidador nunca abre `/app/**` (vai a `/cuidador/hoje`) e a sessão da equipe
 * nunca abre `/cuidador/**` (vai a `/app/painel`). A raiz `/` leva cada um ao seu lugar (`homeRedirectGuard`).
 * O conteúdo de cada tela entra no `<router-outlet>` do shell. Não há portal do prestador credenciado (M14
 * removido por decisão do dono): os prestadores são cadastros da equipe.
 *
 * Guards (core/auth/guards.ts): `authGuard` exige sessão; `moduleGuard(chave)` aplica a matriz de
 * permissões do módulo (mapa de módulos, escopo seção 2). Rota sem permissão leva a `/403` e grava `denied`.
 */
/** Só combina com a sessão completa aberta (usado pelo 404 dentro do shell). */
const signedIn: CanMatchFn = () => inject(AuthService).isAuthenticated();

const baseRoutes: Routes = [
  // Raiz: cuidador com sessão a /cuidador/hoje, equipe ao painel, quem não entrou à entrada.
  { path: '', pathMatch: 'full', canActivate: [homeRedirectGuard], children: [] },

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

  // Aplicativo do cuidador (a equipe nunca entra aqui). As rotas, o shell e o mapa de áreas ficam em
  // features/caregiver-app/routing; cada área é carregada sob demanda.
  {
    path: 'cuidador',
    canActivate: [caregiverAreaGuard],
    loadChildren: () =>
      import('./features/caregiver-app/routing/caregiver.routes').then((m) => m.ROUTES),
  },

  // Back-office (equipe Nexus), dentro do shell da equipe (menu lateral e barra superior)
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/shell/team-shell.component').then((m) => m.TeamShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'painel' },
      // Páginas de rodapé, abertas a todos os perfis da equipe (LP-23 e SCR-M12-10).
      {
        path: 'canal-do-titular',
        canActivate: [roleGuard('partner', 'technical_lead', 'psychologist', 'support')],
        data: { title: 'Privacidade e canal do titular' },
        loadComponent: () =>
          import('./layout/pages/privacy-channel.page').then((m) => m.PrivacyChannelPageComponent),
      },
      {
        path: 'meus-dados',
        canActivate: [roleGuard('partner', 'technical_lead', 'psychologist', 'support')],
        data: { title: 'Meus dados no navegador' },
        loadComponent: () =>
          import('./layout/pages/browser-data.page').then((m) => m.BrowserDataPageComponent),
      },
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

  // M01 Não encontrado (SCR-M01-06). Com sessão aberta, a página aparece dentro do shell (CX-015).
  {
    path: '**',
    canMatch: [signedIn],
    loadComponent: () =>
      import('./layout/shell/team-shell.component').then((m) => m.TeamShellComponent),
    children: [
      {
        path: '',
        loadChildren: () =>
          import('./features/auth/auth.routes').then((m) => m.NOT_FOUND_IN_SHELL_ROUTES),
      },
    ],
  },
  {
    path: '**',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.NOT_FOUND_ROUTES),
  },
];

/**
 * Catálogo de componentes (só para quem constrói telas). QA-001: nunca existe em produção, para ninguém;
 * só entra em modo de desenvolvimento (`ng serve` e testes), com dados fictícios genéricos.
 */
const KIT_ROUTE: Route = {
  path: '_kit',
  canActivate: [roleGuard('partner', 'technical_lead', 'psychologist', 'support')],
  loadChildren: () => import('./features/kit/kit.routes').then((m) => m.ROUTES),
};

/** Monta o roteador. Em produção (`devMode` falso) a rota `/app/_kit` não existe e cai no 404. */
export function createRoutes(devMode: boolean): Routes {
  if (!devMode) {
    return baseRoutes;
  }
  return baseRoutes.map((route) =>
    route.path === 'app' ? { ...route, children: [KIT_ROUTE, ...(route.children ?? [])] } : route,
  );
}

export const routes: Routes = createRoutes(isDevMode());
