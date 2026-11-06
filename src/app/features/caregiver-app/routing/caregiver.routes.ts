import { isDevMode } from '@angular/core';
import { Route, Routes } from '@angular/router';
import { caregiverGuard } from '../../../core/auth/guards';
import { CaregiverShellComponent } from '../shell/caregiver-shell.component';
import { MoreHubPageComponent } from '../shell/pages/more-hub.page';
import { NotFoundPageComponent } from '../shell/pages/not-found.page';
import { CAREGIVER_AREAS, CaregiverArea } from './caregiver-areas';

/** Trechos mais específicos primeiro (`rede/cartao` antes de `rede`), na ordem do mapa dentro do mesmo tamanho. */
function bySpecificity(areas: readonly CaregiverArea[]): CaregiverArea[] {
  return [...areas].sort((a, b) => b.mount.split('/').length - a.mount.split('/').length);
}

/** Definido pelo Angular: vira `false` na compilação de produção (o esbuild descarta o que está atrás dele). */
declare const ngDevMode: boolean | object | undefined;

/**
 * Catálogo do kit visual (`/cuidador/_kit`). QA-001: nunca existe em produção; só em modo de desenvolvimento
 * (`ng serve` e testes), com dados genéricos e sessão de cuidador. Atrás de `ngDevMode`, no build de produção a rota
 * e a página do kit nem entram no pacote (nenhum pedaço "Kit do cuidador" fica no `dist`).
 */
const KIT_ROUTE: Route | null =
  typeof ngDevMode !== 'undefined' && ngDevMode
    ? {
        path: '_kit',
        data: { title: 'Kit do cuidador' },
        loadComponent: () =>
          import('../ui/kit/caregiver-kit.page').then((m) => m.CaregiverKitPageComponent),
      }
    : null;

const toRoute = (area: CaregiverArea): Route => ({ path: area.mount, loadChildren: area.load });

/**
 * `/cuidador/**` (aplicativo do cuidador). Montado em `app.routes.ts` com `caregiverAreaGuard` (a equipe nunca
 * entra aqui). Tudo vive dentro do shell do cuidador: cabeçalho com "Ajuda agora", barra de navegação, aviso de
 * protótipo. As áreas abertas (`comecar` e `ajuda-agora`) não exigem sessão; o resto passa por `caregiverGuard`.
 * Cada área é carregada sob demanda; o mapa está em `caregiver-areas.ts`. Em produção (`devMode` falso) a rota
 * `/cuidador/_kit` não existe e cai em "Página não encontrada".
 */
export function createCaregiverRoutes(devMode: boolean): Routes {
  return [
    {
      path: '',
      component: CaregiverShellComponent,
      children: [
        ...bySpecificity(CAREGIVER_AREAS.filter((a) => a.access === 'open')).map(toRoute),
        {
          path: '',
          canActivate: [caregiverGuard],
          // A sessão pode deixar de valer no meio do uso (cadastro encerrado): confere a cada navegação.
          runGuardsAndResolvers: 'always',
          children: [
            { path: '', pathMatch: 'full', redirectTo: 'hoje' },
            // A porta de Mais é da Base (as de Cuidar de mim e de Rede são de P2 e P3, dentro das áreas `care` e `network`).
            {
              path: 'mais',
              pathMatch: 'full',
              component: MoreHubPageComponent,
              data: { title: 'Mais' },
            },
            ...(devMode && KIT_ROUTE ? [KIT_ROUTE] : []),
            ...bySpecificity(CAREGIVER_AREAS.filter((a) => a.access === 'session')).map(toRoute),
            {
              path: '**',
              component: NotFoundPageComponent,
              data: { title: 'Página não encontrada' },
            },
          ],
        },
      ],
    },
  ];
}

export const ROUTES: Routes = createCaregiverRoutes(isDevMode());
