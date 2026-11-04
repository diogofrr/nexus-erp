/**
 * Mapa de módulos (escopo, seção 2): rota, pasta da funcionalidade, recursos da matriz e perfis.
 * É a fonte do roteador central, dos guards e do menu lateral (AC-M01-08: o menu mostra só o permitido).
 */
import { Resource, Role } from '../models/access';
import { canOpenAnyRoute } from './permissions';

/** Chave única de cada rota de módulo (o mesmo `slug` pode atender mais de uma rota). */
export type ModuleKey =
  | 'dashboard'
  | 'caregivers'
  | 'subscriptions'
  | 'care-sessions'
  | 'zarit'
  | 'groups'
  | 'network'
  | 'partners'
  | 'companies'
  | 'finance'
  | 'indicators'
  | 'pilot'
  | 'messages'
  | 'complaints'
  | 'privacy'
  | 'governance'
  | 'settings'
  | 'provider-portal';

/** Pasta em `src/app/features/<slug>`. */
export type FeatureSlug =
  | 'auth'
  | 'dashboard'
  | 'caregivers'
  | 'subscriptions'
  | 'care-sessions'
  | 'zarit'
  | 'groups'
  | 'network'
  | 'partners'
  | 'finance'
  | 'messages'
  | 'privacy'
  | 'governance'
  | 'provider-portal'
  | 'settings';

export interface ModuleDef {
  key: ModuleKey;
  /** `M01` a `M15`. */
  moduleId: string;
  slug: FeatureSlug;
  /** Título do item de menu, em pt-BR. */
  title: string;
  /** Caminho absoluto da rota base (`/app/cuidadores`, `/portal`). */
  path: string;
  /** Segmento relativo usado no roteador (`cuidadores`). */
  segment: string;
  /** Recursos da matriz: o perfil entra se puder abrir QUALQUER um como tela. */
  resources: readonly Resource[];
  /** Regras de negócio principais (escopo, seção 2). */
  rules: readonly string[];
  /** Aparece no menu lateral? */
  inMenu: boolean;
}

export const MODULES: readonly ModuleDef[] = [
  {
    key: 'dashboard',
    moduleId: 'M02',
    slug: 'dashboard',
    title: 'Painel',
    path: '/app/painel',
    segment: 'painel',
    resources: ['dashboard'],
    rules: ['KPI-*', 'EQP', 'ARBE'],
    inMenu: true,
  },
  {
    key: 'caregivers',
    moduleId: 'M03',
    slug: 'caregivers',
    title: 'Cuidadores',
    path: '/app/cuidadores',
    segment: 'cuidadores',
    resources: ['caregiver_registry'],
    rules: ['USR-*', 'LGPD-*'],
    inMenu: true,
  },
  {
    key: 'subscriptions',
    moduleId: 'M04',
    slug: 'subscriptions',
    title: 'Planos e assinaturas',
    path: '/app/assinaturas',
    segment: 'assinaturas',
    resources: ['plans_subscriptions'],
    rules: ['PLN-*', 'CRT-*'],
    inMenu: true,
  },
  {
    key: 'care-sessions',
    moduleId: 'M05',
    slug: 'care-sessions',
    title: 'Atendimento',
    path: '/app/atendimento',
    segment: 'atendimento',
    resources: ['care_schedule', 'occupancy', 'rooms'],
    rules: ['ATD-*', 'EQP-*'],
    inMenu: true,
  },
  {
    key: 'zarit',
    moduleId: 'M06',
    slug: 'zarit',
    title: 'Acompanhamento (Zarit e ARBE)',
    path: '/app/acompanhamento',
    segment: 'acompanhamento',
    resources: ['zarit_individual', 'zarit_aggregate'],
    rules: ['ZRT-*', 'ARBE-*', 'POP-05'],
    inMenu: true,
  },
  {
    key: 'groups',
    moduleId: 'M07',
    slug: 'groups',
    title: 'Grupos e capacitações',
    path: '/app/grupos',
    segment: 'grupos',
    resources: ['groups'],
    rules: ['GRP-*'],
    inMenu: true,
  },
  {
    key: 'network',
    moduleId: 'M08',
    slug: 'network',
    title: 'Rede credenciada',
    path: '/app/rede',
    segment: 'rede',
    resources: ['network'],
    rules: ['REDE-*', 'ARP-*', 'POP-02'],
    inMenu: true,
  },
  {
    key: 'partners',
    moduleId: 'M09',
    slug: 'partners',
    title: 'Parceiros do Cartão',
    path: '/app/parceiros',
    segment: 'parceiros',
    resources: ['partners_corporate'],
    rules: ['CRT-*'],
    inMenu: true,
  },
  {
    key: 'companies',
    moduleId: 'M09',
    slug: 'partners',
    title: 'Empresas',
    path: '/app/empresas',
    segment: 'empresas',
    resources: ['partners_corporate'],
    rules: ['CORP-*'],
    inMenu: true,
  },
  {
    key: 'finance',
    moduleId: 'M10',
    slug: 'finance',
    title: 'Financeiro',
    path: '/app/financeiro',
    segment: 'financeiro',
    resources: ['finance'],
    rules: ['FIN-*'],
    inMenu: true,
  },
  {
    key: 'indicators',
    moduleId: 'M10',
    slug: 'finance',
    title: 'Indicadores',
    path: '/app/indicadores',
    segment: 'indicadores',
    resources: ['indicators'],
    rules: ['KPI-*'],
    inMenu: true,
  },
  {
    key: 'pilot',
    moduleId: 'M10',
    slug: 'finance',
    title: 'Piloto',
    path: '/app/piloto',
    segment: 'piloto',
    resources: ['pilot'],
    rules: ['PIL-*'],
    inMenu: true,
  },
  {
    key: 'messages',
    moduleId: 'M11',
    slug: 'messages',
    title: 'Mensagens',
    path: '/app/mensagens',
    segment: 'mensagens',
    resources: ['message_inbox'],
    rules: ['CAN-*', 'POP-08'],
    inMenu: true,
  },
  {
    key: 'complaints',
    moduleId: 'M11',
    slug: 'messages',
    title: 'Reclamações',
    path: '/app/reclamacoes',
    segment: 'reclamacoes',
    resources: ['complaints'],
    rules: ['POP-08', 'ARP-09'],
    inMenu: true,
  },
  {
    key: 'privacy',
    moduleId: 'M12',
    slug: 'privacy',
    title: 'LGPD',
    path: '/app/lgpd',
    segment: 'lgpd',
    resources: ['lgpd_consents_requests', 'lgpd_audit_log'],
    rules: ['LGPD-*'],
    inMenu: true,
  },
  {
    key: 'governance',
    moduleId: 'M13',
    slug: 'governance',
    title: 'Governança',
    path: '/app/governanca',
    segment: 'governanca',
    resources: ['governance', 'occurrences'],
    rules: ['POP-*', 'RISCO-*', 'ENC-*', 'CAP-*'],
    inMenu: true,
  },
  {
    key: 'settings',
    moduleId: 'M15',
    slug: 'settings',
    title: 'Configurações',
    path: '/app/configuracoes',
    segment: 'configuracoes',
    resources: ['settings'],
    rules: ['Suposições (Anexo D)'],
    inMenu: true,
  },
  {
    key: 'provider-portal',
    moduleId: 'M14',
    slug: 'provider-portal',
    title: 'Portal do profissional',
    path: '/portal',
    segment: 'portal',
    resources: ['provider_portal'],
    rules: ['REDE-*', 'ARP-18'],
    inMenu: false,
  },
];

export function moduleByKey(key: ModuleKey): ModuleDef {
  return MODULES.find((m) => m.key === key) as ModuleDef;
}

/** O perfil pode abrir a rota do módulo? (matriz da seção 1.2.) */
export function canAccessModule(role: Role, module: ModuleDef): boolean {
  return canOpenAnyRoute(role, module.resources);
}

/** Itens do menu lateral para o perfil, só os permitidos (AC-M01-08). */
export function menuFor(role: Role): ModuleDef[] {
  return MODULES.filter((m) => m.inMenu && canAccessModule(role, m));
}

/** Tela inicial de cada perfil: `/portal` para o credenciado, `/app/painel` para a equipe. */
export function homePathFor(role: Role): string {
  return role === 'provider' ? '/portal' : '/app/painel';
}
