/**
 * Catálogo de telas e ações do ERP: a fonte do menu lateral (grupos, rótulos, ícones) e da busca global
 * e paleta de comandos (UX 3.2, 3.3 e 3.5). Cada tela e ação só aparece para quem pode abri-la, pela
 * MESMA matriz de permissões do núcleo (nada de checagem "na mão" no componente, UX 3.1).
 */
import { ModuleDef, ModuleKey, canAccessModule, moduleByKey } from '../auth/module-map';
import { canOpenRoute, canUseSubArea } from '../auth/permissions';
import { Resource, Role } from '../models/access';

export type NavGroupId =
  'main' | 'people' | 'care' | 'network' | 'relationship' | 'management' | 'security' | 'system';

/** Grupos do menu na ordem do guia de UX (3.2). O primeiro não tem título. */
export const NAV_GROUPS: readonly { id: NavGroupId; title: string | null; icon: string }[] = [
  { id: 'main', title: null, icon: 'layout-dashboard' },
  { id: 'people', title: 'Pessoas', icon: 'users' },
  { id: 'care', title: 'Cuidado', icon: 'heart-pulse' },
  { id: 'network', title: 'Rede e parceiros', icon: 'heart-handshake' },
  { id: 'relationship', title: 'Relacionamento', icon: 'messages-square' },
  { id: 'management', title: 'Gestão', icon: 'chart-column' },
  { id: 'security', title: 'Segurança e normas', icon: 'shield-check' },
  { id: 'system', title: 'Sistema', icon: 'settings' },
];

export interface NavItemDef {
  key: ModuleKey;
  group: NavGroupId;
  icon: string;
  /** Rótulo padrão, na língua do trabalho (UX 3.1). */
  label: string;
  /** Rótulo que muda quando o perfil só vê uma parte (UX 3.3). */
  roleLabels?: Partial<Record<Role, string>>;
  /** Palavras que também levam a esta tela na busca. */
  keywords: readonly string[];
}

/** Itens do menu na ordem do guia (3.2). */
export const NAV_ITEMS: readonly NavItemDef[] = [
  {
    key: 'dashboard',
    group: 'main',
    icon: 'layout-dashboard',
    label: 'Painel',
    keywords: ['inicio', 'resumo'],
  },
  {
    key: 'caregivers',
    group: 'people',
    icon: 'users',
    label: 'Cuidadores',
    roleLabels: {
      partner: 'Cuidadores (por código)',
      technical_lead: 'Cuidadores (supervisão)',
      psychologist: 'Meus cuidadores',
    },
    keywords: ['cadastro', 'pessoas'],
  },
  {
    key: 'subscriptions',
    group: 'people',
    icon: 'credit-card',
    label: 'Assinaturas',
    keywords: ['planos', 'cartoes', 'cartao nexus'],
  },
  {
    key: 'care-sessions',
    group: 'care',
    icon: 'calendar-days',
    label: 'Atendimento',
    roleLabels: { partner: 'Ocupação da equipe', psychologist: 'Atendimento' },
    keywords: ['agenda', 'sessoes', 'salas', 'ocupacao', 'disponibilidade'],
  },
  {
    key: 'zarit',
    group: 'care',
    icon: 'heart-pulse',
    label: 'Acompanhamento',
    roleLabels: { partner: 'Sobrecarga agregada' },
    keywords: ['zarit', 'escala', 'fila', 'alertas', 'arbe'],
  },
  {
    key: 'groups',
    group: 'care',
    icon: 'users-round',
    label: 'Grupos',
    keywords: ['capacitacoes', 'programacao', 'rodas'],
  },
  {
    key: 'network',
    group: 'network',
    icon: 'heart-handshake',
    label: 'Rede credenciada',
    keywords: ['prestadores', 'credenciamento', 'avaliacoes', 'auditoria', 'arp'],
  },
  {
    key: 'partners',
    group: 'network',
    icon: 'store',
    label: 'Parceiros',
    keywords: ['cartao nexus', 'descontos'],
  },
  {
    key: 'companies',
    group: 'network',
    icon: 'building-2',
    label: 'Empresas',
    keywords: ['corporativo', 'rh', 'colaboradores'],
  },
  {
    key: 'messages',
    group: 'relationship',
    icon: 'messages-square',
    label: 'Mensagens',
    keywords: ['caixa de entrada', 'whatsapp', 'modelos de resposta', 'sla'],
  },
  {
    key: 'complaints',
    group: 'relationship',
    icon: 'flag',
    label: 'Reclamações',
    keywords: ['reclamacao', 'ouvidoria'],
  },
  {
    key: 'finance',
    group: 'management',
    icon: 'wallet',
    label: 'Financeiro',
    keywords: ['projecao', 'ponto de equilibrio', 'custos', 'investimento', 'receita'],
  },
  {
    key: 'indicators',
    group: 'management',
    icon: 'chart-column',
    label: 'Indicadores',
    keywords: ['people analytics', 'kpi', 'metricas'],
  },
  {
    key: 'pilot',
    group: 'management',
    icon: 'activity',
    label: 'Piloto',
    keywords: ['mvp', 'coorte'],
  },
  {
    key: 'privacy',
    group: 'security',
    icon: 'shield-check',
    label: 'Privacidade (LGPD)',
    keywords: [
      'lgpd',
      'consentimentos',
      'solicitacoes do titular',
      'log de acessos',
      'incidentes',
      'ripd',
      'retencao',
    ],
  },
  {
    key: 'governance',
    group: 'security',
    icon: 'landmark',
    label: 'Governança',
    keywords: ['pops', 'riscos', 'encaminhamentos', 'ocorrencias', 'formacao', 'normas'],
  },
  {
    key: 'settings',
    group: 'system',
    icon: 'settings',
    label: 'Configurações',
    keywords: ['dados de demonstracao', 'relogio simulado', 'parametros', 'arbe', 'usuarios'],
  },
];

/** Rótulo do item de menu para o perfil (o rótulo muda quando o perfil só vê uma parte). */
export function navLabel(item: NavItemDef, role: Role): string {
  return item.roleLabels?.[role] ?? item.label;
}

export function navItemByKey(key: ModuleKey): NavItemDef | undefined {
  return NAV_ITEMS.find((i) => i.key === key);
}

// ===== Telas ("Ir para") =====

export interface ScreenDef {
  id: string;
  label: string;
  link: string;
  icon: string;
  /** De onde vem, para o subtítulo ("Financeiro"). */
  parent?: string;
  /** Módulo do mapa que o perfil precisa poder abrir. */
  moduleKey?: ModuleKey;
  /** Recurso extra da matriz (por exemplo, o log de acessos). */
  resource?: Resource;
  /** Área interna de Configurações (`arbe`, `guidance_content`) liberada ao RT. */
  settingsArea?: string;
  /** Só estes perfis (telas que não são da matriz, como o portal). */
  onlyRoles?: readonly Role[];
  keywords?: readonly string[];
}

function screen(
  parent: string,
  moduleKey: ModuleKey,
  slug: string,
  label: string,
  icon: string,
  extra: Partial<ScreenDef> = {},
): ScreenDef {
  const base = moduleByKey(moduleKey).path;
  return {
    id: `screen:${base}${slug}`,
    label,
    link: `${base}${slug}`,
    icon,
    parent,
    moduleKey,
    ...extra,
  };
}

/** Subtelas conhecidas pelo escopo (as rotas dos módulos). O módulo inteiro já está em `NAV_ITEMS`. */
const SUB_SCREENS: readonly ScreenDef[] = [
  screen('Assinaturas', 'subscriptions', '/planos', 'Planos', 'credit-card', {
    keywords: ['comparativo', 'precos'],
  }),
  screen('Atendimento', 'care-sessions', '/agenda', 'Agenda', 'calendar-days'),
  screen('Atendimento', 'care-sessions', '/disponibilidade', 'Disponibilidade', 'calendar-days'),
  screen('Acompanhamento', 'zarit', '/fila', 'Fila de acompanhamento', 'heart-pulse', {
    keywords: ['alertas', 'vermelhos', 'amarelos'],
  }),
  screen('Grupos', 'groups', '/indicadores', 'Indicadores de participação', 'chart-column'),
  screen('Rede credenciada', 'network', '/prestadores', 'Prestadores', 'stethoscope'),
  screen('Rede credenciada', 'network', '/credenciamento', 'Credenciamento', 'square-kanban'),
  screen(
    'Rede credenciada',
    'network',
    '/solicitacoes',
    'Solicitações de serviço',
    'clipboard-list',
  ),
  screen('Rede credenciada', 'network', '/avaliacoes', 'Avaliações da rede', 'star'),
  screen('Rede credenciada', 'network', '/auditoria', 'Auditoria quinzenal', 'clipboard-check'),
  screen('Rede credenciada', 'network', '/busca', 'Busca como o usuário vê', 'search'),
  screen('Rede credenciada', 'network', '/sinais', 'Sinais da rede', 'activity'),
  screen('Mensagens', 'messages', '/modelos', 'Modelos de resposta', 'message-circle'),
  screen('Financeiro', 'finance', '/projecao', 'Projeção de 24 meses', 'trending-up', {
    keywords: ['cenarios'],
  }),
  screen('Financeiro', 'finance', '/parametros', 'Parâmetros financeiros', 'banknote'),
  screen('Financeiro', 'finance', '/investimento', 'Investimento e capital', 'wallet'),
  screen('Financeiro', 'finance', '/custos', 'Custos', 'banknote'),
  screen('Privacidade (LGPD)', 'privacy', '/consentimentos', 'Consentimentos', 'shield-check'),
  screen('Privacidade (LGPD)', 'privacy', '/termos', 'Termos de consentimento', 'file-text'),
  screen('Privacidade (LGPD)', 'privacy', '/solicitacoes', 'Solicitações do titular', 'inbox'),
  screen('Privacidade (LGPD)', 'privacy', '/log', 'Log de acessos', 'history', {
    resource: 'lgpd_audit_log',
  }),
  screen('Privacidade (LGPD)', 'privacy', '/incidentes', 'Incidentes de dados', 'shield-alert', {
    resource: 'lgpd_audit_log',
  }),
  screen('Privacidade (LGPD)', 'privacy', '/politica', 'Política de privacidade', 'file-lock', {
    resource: 'lgpd_audit_log',
  }),
  screen('Privacidade (LGPD)', 'privacy', '/ripd', 'Relatório de impacto (RIPD)', 'file-text', {
    resource: 'lgpd_audit_log',
  }),
  screen('Privacidade (LGPD)', 'privacy', '/retencao', 'Retenção e eliminação', 'timer', {
    resource: 'lgpd_audit_log',
  }),
  screen('Governança', 'governance', '/pops', 'Procedimentos (POPs)', 'book-open'),
  screen('Governança', 'governance', '/riscos', 'Riscos', 'triangle-alert'),
  screen('Governança', 'governance', '/encaminhamentos', 'Encaminhamentos', 'link'),
  screen('Governança', 'governance', '/ocorrencias', 'Ocorrências', 'file-lock'),
  screen('Configurações', 'settings', '/dados', 'Dados de demonstração', 'database', {
    keywords: ['resetar', 'exportar', 'importar', 'apagar tudo'],
  }),
  screen('Configurações', 'settings', '/relogio', 'Relógio simulado', 'clock', {
    keywords: ['data de hoje', 'prazos'],
  }),
  screen('Configurações', 'settings', '/parametros', 'Parâmetros', 'settings', {
    keywords: ['beneficios', 'desconto', 'sla'],
  }),
  screen('Configurações', 'settings', '/arbe', 'Parâmetros da ARBE', 'gauge', {
    settingsArea: 'arbe',
  }),
  screen('Configurações', 'settings', '/conteudos', 'Conteúdos de orientação', 'file-text', {
    settingsArea: 'guidance_content',
  }),
  screen('Configurações', 'settings', '/usuarios', 'Usuários de demonstração', 'users'),
  screen('Configurações', 'settings', '/suposicoes', 'Suposições', 'circle-help'),
  screen('Configurações', 'settings', '/sobre', 'Sobre o protótipo', 'info'),
];

/** Telas do portal do profissional credenciado (UX 3.3), navegação própria e mais curta. */
export const PORTAL_SCREENS: readonly ScreenDef[] = [
  {
    id: 'screen:/portal',
    label: 'Início',
    link: '/portal',
    icon: 'layout-dashboard',
    onlyRoles: ['provider'],
  },
  {
    id: 'screen:/portal/solicitacoes',
    label: 'Solicitações',
    link: '/portal/solicitacoes',
    icon: 'clipboard-list',
    onlyRoles: ['provider'],
    keywords: ['pedidos'],
  },
  {
    id: 'screen:/portal/disponibilidade',
    label: 'Disponibilidade',
    link: '/portal/disponibilidade',
    icon: 'calendar-days',
    onlyRoles: ['provider'],
    keywords: ['agenda', 'horarios'],
  },
  {
    id: 'screen:/portal/avaliacao',
    label: 'Minha avaliação',
    link: '/portal/avaliacao',
    icon: 'star',
    onlyRoles: ['provider'],
    keywords: ['nota'],
  },
  {
    id: 'screen:/portal/documentos',
    label: 'Documentos',
    link: '/portal/documentos',
    icon: 'file-check',
    onlyRoles: ['provider'],
    keywords: ['registro', 'clausula', 'contrato'],
  },
  {
    id: 'screen:/portal/integracao',
    label: 'Integração',
    link: '/portal/integracao',
    icon: 'user-check',
    onlyRoles: ['provider'],
  },
  {
    id: 'screen:/portal/mensagens',
    label: 'Mensagens',
    link: '/portal/mensagens',
    icon: 'messages-square',
    onlyRoles: ['provider'],
  },
  {
    id: 'screen:/portal/perfil',
    label: 'Meu perfil',
    link: '/portal/perfil',
    icon: 'user',
    onlyRoles: ['provider'],
  },
  {
    id: 'screen:/portal/privacidade',
    label: 'Privacidade',
    link: '/portal/privacidade',
    icon: 'shield-check',
    onlyRoles: ['provider'],
    keywords: ['o que posso ver'],
  },
];

/** Telas de rodapé, para todos os perfis (LP-23 e SCR-M12-10). */
function footerScreens(prefix: '/app' | '/portal'): ScreenDef[] {
  return [
    {
      id: `screen:${prefix}/canal-do-titular`,
      label: 'Privacidade e canal do titular',
      link: `${prefix}/canal-do-titular`,
      icon: 'shield-check',
      keywords: ['dpo', 'encarregado', 'lgpd', 'direitos'],
    },
    {
      id: `screen:${prefix}/meus-dados`,
      label: 'Meus dados no navegador',
      link: `${prefix}/meus-dados`,
      icon: 'database',
      keywords: ['apagar tudo', 'armazenamento'],
    },
  ];
}

function allowed(role: Role, def: ScreenDef): boolean {
  if (def.onlyRoles && !def.onlyRoles.includes(role)) {
    return false;
  }
  if (def.moduleKey && !canAccessModule(role, moduleByKey(def.moduleKey))) {
    return false;
  }
  if (def.resource && !canOpenRoute(role, def.resource)) {
    return false;
  }
  if (def.settingsArea && !canUseSubArea(role, 'settings', def.settingsArea)) {
    return false;
  }
  // As demais telas de Configurações são só da sócia: o RT abre apenas ARBE e conteúdos.
  if (def.moduleKey === 'settings' && !def.settingsArea) {
    return role === 'partner';
  }
  return true;
}

/** Telas que o perfil pode abrir: itens do menu, subtelas permitidas e telas de rodapé. */
export function screensFor(role: Role): ScreenDef[] {
  if (role === 'provider') {
    return [...PORTAL_SCREENS, ...footerScreens('/portal')];
  }
  const items: ScreenDef[] = NAV_ITEMS.filter((i) => canAccessModule(role, moduleByKey(i.key))).map(
    (item): ScreenDef => {
      const module: ModuleDef = moduleByKey(item.key);
      return {
        id: `screen:${module.path}`,
        label: navLabel(item, role),
        link: module.path,
        icon: item.icon,
        moduleKey: item.key,
        keywords: item.keywords,
      };
    },
  );
  return [...items, ...SUB_SCREENS.filter((s) => allowed(role, s)), ...footerScreens('/app')];
}

// ===== Ações da paleta =====

export interface ActionDef {
  id: string;
  label: string;
  link: string;
  queryParams?: Record<string, string>;
  icon: string;
  /** Módulo que o perfil precisa poder abrir. A ação só ABRE a tela ou o formulário: nunca executa nada. */
  moduleKey: ModuleKey;
  roles: readonly Role[];
  settingsArea?: string;
  keywords?: readonly string[];
}

/**
 * Ações da paleta de comandos por perfil (UX 3.5). A paleta nunca executa ação destrutiva nem
 * irreversível: ela leva à tela ou ao formulário, e a confirmação acontece lá (AC-GL-09).
 */
export const ACTIONS: readonly ActionDef[] = [
  {
    id: 'action:break-even',
    label: 'Ver ponto de equilíbrio',
    link: '/app/financeiro',
    icon: 'wallet',
    moduleKey: 'finance',
    roles: ['partner'],
    keywords: ['financeiro', 'assinantes'],
  },
  {
    id: 'action:projection',
    label: 'Ir para Projeção',
    link: '/app/financeiro/projecao',
    icon: 'trending-up',
    moduleKey: 'finance',
    roles: ['partner'],
    keywords: ['cenarios'],
  },
  {
    id: 'action:run-audit',
    label: 'Rodar auditoria quinzenal',
    link: '/app/rede/auditoria',
    icon: 'clipboard-check',
    moduleKey: 'network',
    roles: ['partner'],
    keywords: ['arp', 'rede'],
  },
  {
    id: 'action:red-today',
    label: 'Alertas vermelhos de hoje',
    link: '/app/acompanhamento',
    queryParams: { filtro: 'contato-hoje' },
    icon: 'heart-pulse',
    moduleKey: 'zarit',
    roles: ['technical_lead', 'psychologist'],
    keywords: ['contato do mesmo dia'],
  },
  {
    id: 'action:open-occurrence',
    label: 'Abrir ocorrência',
    link: '/app/governanca/ocorrencias',
    icon: 'file-lock',
    moduleKey: 'governance',
    roles: ['technical_lead'],
  },
  {
    id: 'action:adjust-arbe',
    label: 'Ajustar parâmetros da ARBE',
    link: '/app/configuracoes/arbe',
    icon: 'gauge',
    moduleKey: 'settings',
    roles: ['technical_lead'],
    settingsArea: 'arbe',
  },
  {
    id: 'action:apply-scale',
    label: 'Aplicar a escala de Zarit',
    link: '/app/acompanhamento',
    queryParams: { acao: 'aplicar' },
    icon: 'heart-pulse',
    moduleKey: 'zarit',
    roles: ['psychologist'],
    keywords: ['zarit', 'aplicar escala'],
  },
  {
    id: 'action:today-agenda',
    label: 'Minha agenda de hoje',
    link: '/app/atendimento/agenda',
    icon: 'calendar-days',
    moduleKey: 'care-sessions',
    roles: ['psychologist'],
  },
  {
    id: 'action:register-alert-contact',
    label: 'Registrar contato de alerta',
    link: '/app/acompanhamento',
    queryParams: { filtro: 'contato-hoje' },
    icon: 'phone',
    moduleKey: 'zarit',
    roles: ['psychologist'],
  },
  {
    id: 'action:new-caregiver',
    label: 'Novo cuidador',
    link: '/app/cuidadores/novo',
    icon: 'plus',
    moduleKey: 'caregivers',
    roles: ['support'],
    keywords: ['cadastrar'],
  },
  {
    id: 'action:register-contact',
    label: 'Registrar contato',
    link: '/app/mensagens',
    queryParams: { acao: 'registrar-contato' },
    icon: 'phone',
    moduleKey: 'messages',
    roles: ['support'],
  },
  {
    id: 'action:schedule-session',
    label: 'Agendar sessão',
    link: '/app/atendimento/agenda',
    queryParams: { acao: 'agendar' },
    icon: 'calendar-days',
    moduleKey: 'care-sessions',
    roles: ['support'],
  },
  {
    id: 'action:new-dsr',
    label: 'Nova solicitação do titular',
    link: '/app/lgpd/solicitacoes',
    queryParams: { acao: 'nova' },
    icon: 'shield-check',
    moduleKey: 'privacy',
    roles: ['support'],
  },
  {
    id: 'action:update-availability',
    label: 'Atualizar disponibilidade',
    link: '/portal/disponibilidade',
    icon: 'calendar-days',
    moduleKey: 'provider-portal',
    roles: ['provider'],
  },
  {
    id: 'action:send-document',
    label: 'Enviar documento',
    link: '/portal/documentos',
    icon: 'upload',
    moduleKey: 'provider-portal',
    roles: ['provider'],
  },
];

/** Ações da paleta que o perfil pode usar (mesma matriz do menu). */
export function actionsFor(role: Role): ActionDef[] {
  return ACTIONS.filter(
    (a) =>
      a.roles.includes(role) &&
      canAccessModule(role, moduleByKey(a.moduleKey)) &&
      (!a.settingsArea || canUseSubArea(role, 'settings', a.settingsArea)),
  );
}
