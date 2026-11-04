/**
 * RBAC do Nexus ERP: a matriz de permissões do escopo (seções 1.2 e 1.3) como DADOS, mais as funções
 * `can`, `accessLevel`, `isOwnRecord` e as regras do `provider` (próprio, mínimo, só com solicitação aceita
 * e cláusula de proteção de dados assinada).
 *
 * Legenda: `-` sem acesso; `L` leitura; `E` leitura e edição; `T` total; `A` agregado ou pseudonimizado;
 * `P` registros próprios ou atribuídos; `C` conteúdo clínico restrito ao caso; `S` supervisão (leitura de
 * todos, com log e justificativa, sem editar anotação de outro psicólogo).
 */
import { AccessLevel, PermissionAction, Resource, Role } from '../models/access';
import { Caregiver } from '../models/caregivers';
import { Complaint } from '../models/messages';
import { Provider, ProviderEvaluation, ServiceRequest } from '../models/network';
import { ID } from '../models/primitives';

export const ROLES: readonly Role[] = [
  'partner',
  'technical_lead',
  'psychologist',
  'support',
  'provider',
];

export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  partner: 'Sócio/Gestão',
  technical_lead: 'Responsável técnico',
  psychologist: 'Psicólogo(a) da Nexus',
  support: 'Atendimento/Relacionamento',
  provider: 'Profissional credenciado',
};

/** Perfis que exigem verificação em dois fatores simulada (RN-LGPD-15): a equipe. */
export const ROLES_REQUIRING_TWO_FACTOR: readonly Role[] = [
  'partner',
  'technical_lead',
  'psychologist',
  'support',
];

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

/** Linha da matriz, na ordem partner, technical_lead, psychologist, support, provider. */
function row(
  partner: AccessCell,
  technicalLead: AccessCell,
  psychologist: AccessCell,
  support: AccessCell,
  provider: AccessCell,
): Row {
  return { partner, technical_lead: technicalLead, psychologist, support, provider };
}

/** A matriz do escopo (seção 1.2), uma linha por recurso. */
export const PERMISSION_MATRIX: Readonly<Record<Resource, Row>> = {
  // M01
  access_profile: row(
    { level: 'L', note: 'próprio' },
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
    { level: 'T', note: 'o seu, no portal', embeddedOnly: true },
  ),
  // M03
  caregiver_registry: row(
    { level: 'A' },
    { level: 'S' },
    { level: 'P', note: 'seus cuidadores' },
    { level: 'E' },
    NONE,
  ),
  elder_care: row(NONE, { level: 'S' }, { level: 'P' }, { level: 'L' }, NONE),
  // M04
  plans_subscriptions: row(
    { level: 'T' },
    { level: 'L' },
    { level: 'L', note: 'plano do próprio cuidador', embeddedOnly: true },
    { level: 'E' },
    NONE,
  ),
  // M05
  care_schedule: row(
    { level: 'A', note: 'horas' },
    { level: 'L' },
    { level: 'P', canEdit: true },
    { level: 'E', note: 'agendar em nome do usuário' },
    NONE,
  ),
  session_notes: row(NONE, { level: 'S' }, { level: 'C', note: 'autor' }, NONE, NONE),
  occupancy: row({ level: 'L' }, { level: 'L' }, { level: 'P' }, NONE, NONE),
  rooms: row({ level: 'E' }, { level: 'L' }, { level: 'L' }, { level: 'L' }, NONE),
  // M06
  zarit_individual: row(NONE, { level: 'S' }, { level: 'C' }, NONE, NONE),
  zarit_aggregate: row(
    { level: 'A' },
    { level: 'A' },
    { level: 'A', note: 'seus casos' },
    NONE,
    NONE,
  ),
  arbe_settings: row({ level: 'L' }, { level: 'T' }, { level: 'L' }, NONE, NONE),
  // M07
  groups: row(
    { level: 'T' },
    { level: 'E', note: 'valida enquadramento', subAreas: ['framing_validation'] },
    { level: 'E', note: 'seus grupos' },
    { level: 'E', note: 'inscrições', subAreas: ['enrollments'] },
    NONE,
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
    { level: 'P', note: 'próprio, via M14', embeddedOnly: true },
  ),
  // M09
  partners_corporate: row({ level: 'T' }, NONE, NONE, { level: 'L' }, NONE),
  // M10 (a linha única do escopo foi desdobrada em finance, indicators e pilot para permitir guard por tela)
  finance: row({ level: 'T' }, NONE, NONE, NONE, NONE),
  indicators: row(
    { level: 'T' },
    { level: 'A', note: 'indicadores clínicos agregados' },
    { level: 'A', note: 'seus casos' },
    { level: 'L', note: 'operacionais: SLA, reclamações', subAreas: ['operational'] },
    NONE,
  ),
  pilot: row(
    { level: 'T' },
    { level: 'A', note: 'indicadores clínicos agregados' },
    NONE,
    NONE,
    NONE,
  ),
  // M11
  message_inbox: row(
    { level: 'T' },
    { level: 'L', note: 'casos de risco' },
    { level: 'P', note: 'mensagens dos seus cuidadores' },
    { level: 'T' },
    { level: 'P', note: 'mensagens com a Nexus', canEdit: true, embeddedOnly: true },
  ),
  complaints: row(
    { level: 'T' },
    { level: 'L', note: 'graves e POP-07' },
    NONE,
    { level: 'T' },
    { level: 'P', note: 'as que o citam, sem identificar o cuidador', embeddedOnly: true },
  ),
  // M12
  lgpd_consents_requests: row(
    { level: 'T' },
    { level: 'E' },
    NONE,
    { level: 'E', note: 'registrar em nome do titular' },
    NONE,
  ),
  lgpd_audit_log: row({ level: 'L' }, { level: 'T' }, NONE, NONE, NONE),
  // M13
  governance: row(
    { level: 'T' },
    { level: 'T' },
    { level: 'L' },
    { level: 'L' },
    { level: 'L', note: 'POPs da integração', embeddedOnly: true },
  ),
  occurrences: row(
    { level: 'A', note: 'contagens' },
    { level: 'T' },
    { level: 'C', note: 'seus casos' },
    NONE,
    NONE,
  ),
  // M14
  provider_portal: row(NONE, NONE, NONE, NONE, { level: 'T', note: 'próprio' }),
  // M15
  settings: row(
    { level: 'T' },
    { level: 'E', note: 'apenas ARBE e conteúdos', subAreas: ['arbe', 'guidance_content'] },
    NONE,
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
  providerId?: ID;
}

/** Campos de um registro que indicam a quem ele pertence. */
export interface OwnershipSubject {
  /** Psicólogo do caso (sessões, aplicações, alertas). */
  psychologistId?: ID;
  /** Psicólogo responsável do cuidador. */
  assignedPsychologistId?: ID;
  /** Autor (anotação de sessão). */
  authorPsychologistId?: ID;
  /** Prestador dono do registro. */
  providerId?: ID;
  /** Reclamação: alvo. */
  target?: { providerId?: ID };
  /** Ocorrência: RT e psicólogo do caso. */
  restrictedToUserIds?: readonly ID[];
}

/** O registro é do usuário (atribuído, autor, prestador dono ou restrito a ele)? */
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
  if (actor.role === 'provider' && actor.providerId) {
    if (record.providerId === actor.providerId || record.target?.providerId === actor.providerId) {
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
  provider: [
    'Qualquer dado clínico, escore ou faixa de outros prestadores',
    'Identificação do cuidador que o avaliou',
    'Dados de outros prestadores e finanças',
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

// ===== Perfil `provider`: próprio, mínimo, aceita e cláusula =====

/** O prestador só enxerga o PRÓPRIO registro. */
export function isOwnProviderRecord(
  actor: Pick<Actor, 'role' | 'providerId'>,
  providerId: ID | undefined,
): boolean {
  return (
    actor.role === 'provider' && actor.providerId !== undefined && actor.providerId === providerId
  );
}

export type ProviderRequestVisibility =
  /** Só especialidade e data (solicitação ainda `requested`, ou já encerrada). */
  | 'minimal_only'
  /** Solicitação aceita, mas falta assinar a cláusula de proteção de dados. */
  | 'clause_required'
  /** Aceita e com cláusula assinada: nome, contato, necessidade e endereço se domiciliar. */
  | 'caregiver_data';

/**
 * O que o prestador vê do usuário (RN-LGPD-13, M14): dados só enquanto a solicitação está `accepted`
 * E a cláusula está assinada. Sem cláusula: "assine a cláusula para ver os dados".
 */
export function providerRequestVisibility(
  provider: Pick<Provider, 'dataProtectionClauseSignedAt'>,
  request: Pick<ServiceRequest, 'status'>,
): ProviderRequestVisibility {
  if (request.status !== 'accepted') {
    return 'minimal_only';
  }
  return provider.dataProtectionClauseSignedAt ? 'caregiver_data' : 'clause_required';
}

/** Dados mínimos do usuário que o credenciado pode receber (LP-10): nunca Zarit, faixa, anotações. */
export interface ProviderCaregiverView {
  name: string;
  contact: { phone: string; email: string };
  need: string;
  /** Só quando o atendimento é domiciliar. */
  address?: string;
}

export function providerCaregiverView(
  visibility: ProviderRequestVisibility,
  caregiver: Pick<Caregiver, 'fullName' | 'phone' | 'email'>,
  request: Pick<ServiceRequest, 'need' | 'modality'>,
  homeAddress?: string,
): ProviderCaregiverView | null {
  if (visibility !== 'caregiver_data') {
    return null;
  }
  const view: ProviderCaregiverView = {
    name: caregiver.fullName,
    contact: { phone: caregiver.phone, email: caregiver.email },
    need: request.need,
  };
  if (request.modality === 'home' && homeAddress) {
    view.address = homeAddress;
  }
  return view;
}

/** O prestador pode ver a reclamação? Só as que o citam (RN-ARP-18, AC-M11-09). */
export function providerSeesComplaint(
  actor: Pick<Actor, 'role' | 'providerId'>,
  complaint: Pick<Complaint, 'target'>,
): boolean {
  return (
    actor.role === 'provider' &&
    actor.providerId !== undefined &&
    complaint.target.providerId === actor.providerId
  );
}

/** Reclamação sem identificar o cuidador (nem o canal por onde veio). */
export interface ProviderComplaintView {
  protocol: string;
  openedAt: string;
  description: string;
  status: Complaint['status'];
}

export function redactComplaintForProvider(
  complaint: Pick<Complaint, 'protocol' | 'openedAt' | 'description' | 'status'>,
): ProviderComplaintView {
  return {
    protocol: complaint.protocol,
    openedAt: complaint.openedAt,
    description: complaint.description,
    status: complaint.status,
  };
}

/** Avaliação sem identificar o cuidador (RN-ARP-18). */
export interface ProviderEvaluationView {
  id: ID;
  score: number;
  comment?: string;
  createdAt: string;
}

export function redactEvaluationForProvider(
  evaluation: Pick<ProviderEvaluation, 'id' | 'score' | 'comment' | 'createdAt'>,
): ProviderEvaluationView {
  const view: ProviderEvaluationView = {
    id: evaluation.id,
    score: evaluation.score,
    createdAt: evaluation.createdAt,
  };
  if (evaluation.comment !== undefined) {
    view.comment = evaluation.comment;
  }
  return view;
}
