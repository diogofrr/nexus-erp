/**
 * RBAC do Nexus ERP: a matriz de permissões do escopo (seções 1.2 e 1.3) como DADOS, mais as funções
 * `can`, `accessLevel` e `isOwnRecord`.
 *
 * Legenda: `-` sem acesso; `L` leitura; `E` leitura e edição; `T` total; `A` agregado ou pseudonimizado;
 * `P` registros próprios ou atribuídos; `C` conteúdo clínico restrito ao caso; `S` supervisão (leitura de
 * todos, com log e justificativa, sem editar anotação de outro psicólogo).
 */
import { AccessLevel, PermissionAction, Resource, Role } from '../models/access';
import { Caregiver } from '../models/caregivers';
import { ID } from '../models/primitives';

export const ROLES: readonly Role[] = [
  'partner',
  'technical_lead',
  'psychologist',
  'support',
];

export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  partner: 'Sócio/Gestão',
  technical_lead: 'Responsável técnico',
  psychologist: 'Psicólogo(a) da Nexus',
  support: 'Atendimento/Relacionamento',
};

/** Perfis que exigem verificação em dois fatores simulada (RN-LGPD-15): todos, pois todos são da equipe. */
export const ROLES_REQUIRING_TWO_FACTOR: readonly Role[] = ROLES;

export const LEVEL_LABELS: Readonly<Record<AccessLevel, string>> = {
  '-': 'Sem acesso',
  L: 'Leitura',
  E: 'Leitura e edição',
  T: 'Total',
  A: 'Somente agregado ou pseudonimizado',
  P: 'Somente registros próprios ou atribuídos',
  C: 'Conteúdo clínico restrito ao caso',
  S: 'Supervisão (com log e justificativa)',
};

/** Célula da matriz: o nível mais os qualificadores escritos entre parênteses no escopo. */
export interface AccessCell {
  level: AccessLevel;
  /** Qualificador do escopo, em pt-BR. */
  note?: string;
  /** `P` com edição dos próprios registros ("P (E)"). */
  canEdit?: boolean;
  /** Só aparece dentro de outra tela (por exemplo, plano do cuidador no perfil), não como tela própria. */
  embeddedOnly?: boolean;
  /** Áreas internas liberadas (quando o acesso é parcial). */
  subAreas?: readonly string[];
  /** Áreas onde se pode gravar mesmo com nível de leitura (`L (e E só para ...)`). */
  extraWrite?: readonly string[];
}

type Row = Readonly<Record<Role, AccessCell>>;

const NONE: AccessCell = { level: '-' };

/** Linha da matriz, na ordem partner, technical_lead, psychologist, support. */
function row(
  partner: AccessCell,
  technicalLead: AccessCell,
  psychologist: AccessCell,
  support: AccessCell,
): Row {
  return { partner, technical_lead: technicalLead, psychologist, support };
}

/**
 * A matriz do escopo (seção 1.2), uma linha por recurso. O perfil de login do prestador credenciado
 * (portal, M14) foi removido por decisão do dono: os prestadores são cadastros geridos pela equipe.
 */
export const PERMISSION_MATRIX: Readonly<Record<Resource, Row>> = {
  // M01
  access_profile: row(
    { level: 'L', note: 'próprio' },
    { level: 'L', note: 'próprio' },
    { level: 'L', note: 'próprio' },
    { level: 'L', note: 'próprio' },
  ),
  // M02
  dashboard: row(
    { level: 'T', note: 'o seu' },
    { level: 'T', note: 'o seu' },
    { level: 'T', note: 'o seu' },
    { level: 'T', note: 'o seu' },
  ),
  // M03
  caregiver_registry: row(
    { level: 'A' },
    { level: 'S' },
    { level: 'P', note: 'seus cuidadores' },
    { level: 'E' },
  ),
  elder_care: row(NONE, { level: 'S' }, { level: 'P' }, { level: 'L' }),
  // M04
  plans_subscriptions: row(
    { level: 'T' },
    { level: 'L' },
    { level: 'L', note: 'plano do próprio cuidador', embeddedOnly: true },
    { level: 'E' },
  ),
  // M05
  care_schedule: row(
    { level: 'A', note: 'horas' },
    { level: 'L' },
    { level: 'P', canEdit: true },
    { level: 'E', note: 'agendar em nome do usuário' },
  ),
  session_notes: row(NONE, { level: 'S' }, { level: 'C', note: 'autor' }, NONE),
  occupancy: row({ level: 'L' }, { level: 'L' }, { level: 'P' }, NONE),
  rooms: row({ level: 'E' }, { level: 'L' }, { level: 'L' }, { level: 'L' }),
  // M06
  zarit_individual: row(NONE, { level: 'S' }, { level: 'C' }, NONE),
  zarit_aggregate: row({ level: 'A' }, { level: 'A' }, { level: 'A', note: 'seus casos' }, NONE),
  arbe_settings: row({ level: 'L' }, { level: 'T' }, { level: 'L' }, NONE),
  // M07
  groups: row(
    { level: 'T' },
    { level: 'E', note: 'valida enquadramento', subAreas: ['framing_validation'] },
    { level: 'E', note: 'seus grupos' },
    { level: 'E', note: 'inscrições', subAreas: ['enrollments'] },
  ),
  // M08
  network: row(
    { level: 'T' },
    {
      level: 'L',
      note: 'valida psicólogos da rede',
      extraWrite: ['psychologist_registry_validation'],
    },
    NONE,
    {
      level: 'L',
      note: 'e E só para registrar solicitações e avaliações em nome do usuário',
      extraWrite: ['service_requests', 'evaluations'],
    },
  ),
  // M09
  partners_corporate: row({ level: 'T' }, NONE, NONE, { level: 'L' }),
  // M10 (a linha única do escopo foi desdobrada em finance, indicators e pilot para permitir guard por tela)
  finance: row({ level: 'T' }, NONE, NONE, NONE),
  indicators: row(
    { level: 'T' },
    { level: 'A', note: 'indicadores clínicos agregados' },
    { level: 'A', note: 'seus casos' },
    { level: 'L', note: 'operacionais: SLA, reclamações', subAreas: ['operational'] },
  ),
  pilot: row({ level: 'T' }, { level: 'A', note: 'indicadores clínicos agregados' }, NONE, NONE),
  // M11
  message_inbox: row(
    { level: 'T' },
    { level: 'L', note: 'casos de risco' },
    { level: 'P', note: 'mensagens dos seus cuidadores' },
    { level: 'T' },
  ),
  complaints: row({ level: 'T' }, { level: 'L', note: 'graves e POP-07' }, NONE, { level: 'T' }),
  // M12
  lgpd_consents_requests: row({ level: 'T' }, { level: 'E' }, NONE, {
    level: 'E',
    note: 'registrar em nome do titular',
  }),
  lgpd_audit_log: row({ level: 'L' }, { level: 'T' }, NONE, NONE),
  // M13
  governance: row({ level: 'T' }, { level: 'T' }, { level: 'L' }, { level: 'L' }),
  occurrences: row(
    { level: 'A', note: 'contagens' },
    { level: 'T' },
    { level: 'C', note: 'seus casos' },
    NONE,
  ),
  // M15
  settings: row(
    { level: 'T' },
    { level: 'E', note: 'apenas ARBE e conteúdos', subAreas: ['arbe', 'guidance_content'] },
    NONE,
    NONE,
  ),
};

// ===== Consultas à matriz =====

export function accessCell(role: Role, resource: Resource): AccessCell {
  return PERMISSION_MATRIX[resource][role];
}

/** Nível de acesso do perfil ao recurso (`-`, `L`, `E`, `T`, `A`, `P`, `C`, `S`). */
export function accessLevel(role: Role, resource: Resource): AccessLevel {
  return accessCell(role, resource).level;
}

/** Pode abrir a tela do recurso (nível diferente de `-` e não restrito a "dentro de outra tela")? */
export function canOpenRoute(role: Role, resource: Resource): boolean {
  const cell = accessCell(role, resource);
  return cell.level !== '-' && cell.embeddedOnly !== true;
}

/** Ao menos um dos recursos é acessível como tela. */
export function canOpenAnyRoute(role: Role, resources: readonly Resource[]): boolean {
  return resources.some((r) => canOpenRoute(role, r));
}

export interface PermissionContext {
  /**
   * O registro é do próprio usuário (atribuído ou autor)? Para níveis `P` e `C`:
   * `true` ou omitido permite (nível de tela); `false` nega (registro alheio).
   */
  own?: boolean;
}

const E_ACTIONS: readonly PermissionAction[] = [
  'view',
  'view_aggregate',
  'create',
  'update',
  'export',
  'reveal',
];
const OWN_READ: readonly PermissionAction[] = ['view', 'view_aggregate', 'reveal'];
const OWN_WRITE: readonly PermissionAction[] = ['create', 'update'];

/**
 * O perfil pode executar a ação no recurso?
 *
 * - `L`: só `view`. `E`: ver, criar, editar, exportar, revelar. `T`: tudo, menos `supervise`.
 * - `A`: só `view_aggregate`. `S`: `view` e `supervise` (exigem justificativa e log, ver `requiresJustification`).
 * - `P` e `C`: ver (e, com `canEdit` ou em `C`, criar e editar) apenas registros próprios: passe `{ own }`.
 */
export function can(
  role: Role,
  resource: Resource,
  action: PermissionAction,
  context: PermissionContext = {},
): boolean {
  const cell = accessCell(role, resource);
  const own = context.own !== false;
  switch (cell.level) {
    case '-':
      return false;
    case 'L':
      return action === 'view' || action === 'view_aggregate';
    case 'E':
      return E_ACTIONS.includes(action);
    case 'T':
      return action !== 'supervise';
    case 'A':
      return action === 'view_aggregate';
    case 'S':
      return action === 'view' || action === 'view_aggregate' || action === 'supervise';
    case 'P':
      return (
        own && (OWN_READ.includes(action) || (cell.canEdit === true && OWN_WRITE.includes(action)))
      );
    case 'C':
      return own && (OWN_READ.includes(action) || OWN_WRITE.includes(action));
    default:
      return false;
  }
}

/** Leitura de um recurso exige justificativa e log de supervisão (nível `S`)? */
export function requiresJustification(
  role: Role,
  resource: Resource,
  action: PermissionAction,
): boolean {
  return accessLevel(role, resource) === 'S' && (action === 'view' || action === 'supervise');
}

/** O perfil só enxerga o recurso de forma agregada ou pseudonimizada? */
export function isAggregateOnly(role: Role, resource: Resource): boolean {
  return accessLevel(role, resource) === 'A';
}

/** Pode usar a área interna (`subAreas`) do recurso? Sem lista de áreas, vale o recurso inteiro. */
export function canUseSubArea(role: Role, resource: Resource, subArea: string): boolean {
  const cell = accessCell(role, resource);
  if (cell.level === '-') {
    return false;
  }
  return cell.subAreas === undefined || cell.subAreas.includes(subArea);
}

/** Pode gravar na área `subArea` mesmo com nível de leitura (`extraWrite`)? */
export function canWriteSubArea(role: Role, resource: Resource, subArea: string): boolean {
  const cell = accessCell(role, resource);
  return cell.extraWrite?.includes(subArea) === true;
}

// ===== Propriedade de registros (P e C) =====

/** Quem está agindo. Vem do `AppUser` logado. */
export interface Actor {
  userId: ID;
  role: Role;
  psychologistId?: ID;
}

/** Campos de um registro que indicam a quem ele pertence. */
export interface OwnershipSubject {
  /** Psicólogo do caso (sessões, aplicações, alertas). */
  psychologistId?: ID;
  /** Psicólogo responsável do cuidador. */
  assignedPsychologistId?: ID;
  /** Autor (anotação de sessão). */
  authorPsychologistId?: ID;
  /** Ocorrência: RT e psicólogo do caso. */
  restrictedToUserIds?: readonly ID[];
}

/** O registro é do usuário (atribuído, autor ou restrito a ele)? */
export function isOwnRecord(actor: Actor, record: OwnershipSubject): boolean {
  if (actor.role === 'psychologist' && actor.psychologistId) {
    const mine = actor.psychologistId;
    if (
      record.psychologistId === mine ||
      record.assignedPsychologistId === mine ||
      record.authorPsychologistId === mine
    ) {
      return true;
    }
  }
  return record.restrictedToUserIds?.includes(actor.userId) === true;
}

/** `can` aplicado a um registro: resolve a propriedade com `isOwnRecord`. */
export function canOnRecord(
  actor: Actor,
  resource: Resource,
  action: PermissionAction,
  record: OwnershipSubject,
): boolean {
  return can(actor.role, resource, action, { own: isOwnRecord(actor, record) });
}

/** Propriedade derivada de um cuidador (para mensagens, sessões e consultas sobre ele). */
export function ownershipOfCaregiver(
  caregiver: Pick<Caregiver, 'assignedPsychologistId'>,
): OwnershipSubject {
  return caregiver.assignedPsychologistId
    ? { assignedPsychologistId: caregiver.assignedPsychologistId }
    : {};
}

// ===== O que cada perfil NÃO pode ver (seção 1.3) =====

/** Regras de bloqueio do escopo, em texto, para telas de ajuda, QA e documentação. */
export const BLOCKED_DATA: Readonly<Record<Role, readonly string[]>> = {
  partner: [
    'Nome, contato e CPF completos de cuidador em telas de saúde',
    'Escore de Zarit individual e alertas individuais',
    'Anotações de sessão e ocorrências',
    'Texto livre de reclamação que identifique o titular',
  ],
  technical_lead: [
    'Valores financeiros detalhados (receita, custos, saldo)',
    'Dados de prestadores além do necessário para validar psicólogos da rede',
  ],
  psychologist: [
    'Cuidadores atribuídos a outro psicólogo (salvo redistribuição formal)',
    'Finanças e credenciamento',
    'Log de auditoria',
  ],
  support: [
    'Escore de Zarit, faixa e alertas da ARBE',
    'Anotações de sessão',
    'Ocorrências POP-05 e POP-07 (nem a existência de alerta)',
  ],
};

export type ZaritVisibility = 'none' | 'status_only' | 'aggregate' | 'own_case' | 'supervision';

/** Como cada perfil enxerga a Zarit. `support` só vê "pendente" ou "em dia" (E-05). */
export function zaritVisibility(role: Role): ZaritVisibility {
  switch (role) {
    case 'technical_lead':
      return 'supervision';
    case 'psychologist':
      return 'own_case';
    case 'partner':
      return 'aggregate';
    case 'support':
      return 'status_only';
    default:
      return 'none';
  }
}

/** Valores financeiros (receita, custos, saldo): só `partner`. */
export function canSeeFinancialValues(role: Role): boolean {
  return accessLevel(role, 'finance') !== '-';
}
