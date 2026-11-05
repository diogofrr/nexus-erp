import { Routes } from '@angular/router';

/**
 * O mapa de áreas do aplicativo do cuidador: de qual pasta vem cada trecho de rotas e onde ele é montado sob
 * `/cuidador`. É a FONTE da tabela de `docs/11-cuidador-arquitetura.md` e de `caregiver.routes.ts`: para mudar
 * onde uma área é montada, mude aqui e atualize o doc. Cada área é carregada sob demanda (`load`).
 *
 * `access`: `session` exige sessão de cuidador (`caregiverGuard`); `open` abre sem sessão (o cadastro de quem é
 * novo e "Ajuda agora", que precisa estar a um toque em TODAS as telas). A sessão da equipe nunca abre nada daqui.
 */
export interface CaregiverArea {
  /** Nome da pasta em `features/caregiver-app/` (e id da área). */
  id: string;
  /** Quem preenche a área. */
  owner: 'P1' | 'P2' | 'P3';
  /** Caminho de montagem, relativo a `/cuidador`. */
  mount: string;
  access: 'session' | 'open';
  /** Nome do que o arquivo `<area>.routes.ts` exporta para este trecho. */
  exportName: 'ROUTES' | 'PROFILE_ROUTES' | 'HELP_NOW_ROUTES';
  load: () => Promise<Routes>;
}

export const CAREGIVER_AREAS: readonly CaregiverArea[] = [
  {
    id: 'start',
    owner: 'P1',
    mount: 'comecar',
    access: 'open',
    exportName: 'ROUTES',
    load: () => import('../start/start.routes').then((m) => m.ROUTES),
  },
  {
    id: 'start',
    owner: 'P1',
    mount: 'mais/perfil',
    access: 'session',
    exportName: 'PROFILE_ROUTES',
    load: () => import('../start/start.routes').then((m) => m.PROFILE_ROUTES),
  },
  {
    id: 'today',
    owner: 'P1',
    mount: 'hoje',
    access: 'session',
    exportName: 'ROUTES',
    load: () => import('../today/today.routes').then((m) => m.ROUTES),
  },
  {
    id: 'routine',
    owner: 'P1',
    mount: 'rotina',
    access: 'session',
    exportName: 'ROUTES',
    load: () => import('../routine/routine.routes').then((m) => m.ROUTES),
  },
  {
    id: 'family',
    owner: 'P1',
    mount: 'mais/familia',
    access: 'session',
    exportName: 'ROUTES',
    load: () => import('../family/family.routes').then((m) => m.ROUTES),
  },
  {
    id: 'care',
    owner: 'P2',
    // A porta de Cuidar de mim (`/cuidador/cuidar-de-mim`) é do P2: fica na raiz da área, junto de `atendimento`.
    mount: 'cuidar-de-mim',
    access: 'session',
    exportName: 'ROUTES',
    load: () => import('../care/care.routes').then((m) => m.ROUTES),
  },
  {
    id: 'my-wellbeing',
    owner: 'P2',
    mount: 'cuidar-de-mim/como-estou',
    access: 'session',
    exportName: 'ROUTES',
    load: () => import('../my-wellbeing/my-wellbeing.routes').then((m) => m.ROUTES),
  },
  {
    id: 'help',
    owner: 'P2',
    mount: 'mais/ajuda',
    access: 'session',
    exportName: 'ROUTES',
    load: () => import('../help/help.routes').then((m) => m.ROUTES),
  },
  {
    id: 'help',
    owner: 'P2',
    mount: 'ajuda-agora',
    access: 'open',
    exportName: 'HELP_NOW_ROUTES',
    load: () => import('../help/help.routes').then((m) => m.HELP_NOW_ROUTES),
  },
  {
    id: 'privacy',
    owner: 'P2',
    mount: 'mais/privacidade',
    access: 'session',
    exportName: 'ROUTES',
    load: () => import('../privacy/privacy.routes').then((m) => m.ROUTES),
  },
  {
    id: 'network',
    owner: 'P3',
    mount: 'rede',
    access: 'session',
    exportName: 'ROUTES',
    load: () => import('../network/network.routes').then((m) => m.ROUTES),
  },
  {
    id: 'card',
    owner: 'P3',
    mount: 'rede/cartao',
    access: 'session',
    exportName: 'ROUTES',
    load: () => import('../card/card.routes').then((m) => m.ROUTES),
  },
  {
    id: 'plan',
    owner: 'P3',
    mount: 'mais/plano',
    access: 'session',
    exportName: 'ROUTES',
    load: () => import('../plan/plan.routes').then((m) => m.ROUTES),
  },
  {
    id: 'groups',
    owner: 'P3',
    mount: 'cuidar-de-mim/grupos',
    access: 'session',
    exportName: 'ROUTES',
    load: () => import('../groups/groups.routes').then((m) => m.ROUTES),
  },
  {
    id: 'content',
    owner: 'P3',
    mount: 'cuidar-de-mim/conteudos',
    access: 'session',
    exportName: 'ROUTES',
    load: () => import('../content/content.routes').then((m) => m.ROUTES),
  },
];
