import { Audited, ID, ISODateTime } from './primitives';

/** Perfis de acesso (escopo, seção 1.1). */
export type Role = 'partner' | 'technical_lead' | 'psychologist' | 'support';

/** Usuário de demonstração (M01). Não há senha: o login é a escolha do perfil. */
export interface AppUser extends Audited {
  displayName: string;
  /** Sempre `@exemplo.com.br` (AC-GL-12). */
  email: string;
  role: Role;
  active: boolean;
  requiresTwoFactor: boolean;
  /** Vínculo com o perfil de psicólogo(a), quando `role = psychologist`. */
  psychologistId?: ID;
  /** Frase exibida na tela de entrada. */
  demoDescription: string;
}

/**
 * Sessão de autenticação simulada (`sessionStorage`, chave `nexus-erp:session`).
 * Renomeada de `Session` (escopo) para não colidir com `CareSession` (sessão de atendimento).
 * Os carimbos são do relógio REAL (inatividade não depende do relógio simulado).
 */
export interface AuthSession {
  userId: ID;
  role: Role;
  startedAt: ISODateTime;
  lastActivityAt: ISODateTime;
  twoFactorVerified: boolean;
  /** Erros seguidos no segundo fator; três erros encerram a sessão (M01). */
  twoFactorFailures: number;
}

/**
 * Sessão do cuidador no aplicativo (`sessionStorage`, chave `nexus-erp:caregiver-session`). Separada da sessão da
 * equipe: no protótipo o cuidador não tem senha nem segundo fator (RN-LGPD-15 vale só para a equipe).
 */
export interface CaregiverSession {
  caregiverId: ID;
  startedAt: ISODateTime;
}

/** Estados do ciclo de sessão (M01). */
export type AuthState = 'anonymous' | 'pending_2fa' | 'authenticated' | 'expiring' | 'expired';

/** Ações registradas no log de acesso (LP-14). */
export type AccessAction =
  | 'login'
  | 'logout'
  | 'view'
  | 'create'
  | 'update'
  | 'delete'
  | 'export'
  | 'print'
  | 'reveal'
  | 'denied'
  | 'supervise';

/** Linha do log de auditoria. Append-only: nunca é editada nem apagada (LP-15). */
export interface AccessLogEntry extends Audited {
  at: ISODateTime;
  userId: ID;
  role: Role;
  action: AccessAction;
  entity: string;
  entityId?: ID;
  /** Titular afetado (id do cuidador). */
  subjectCaregiverId?: ID;
  justification?: string;
  detail?: string;
}

/**
 * Níveis da matriz de permissões (escopo, seção 1.2):
 * `-` sem acesso; `L` leitura; `E` leitura e edição; `T` total;
 * `A` somente agregado ou pseudonimizado; `P` somente registros próprios ou atribuídos;
 * `C` conteúdo clínico restrito ao caso; `S` supervisão (leitura de todos, com log e justificativa).
 */
export type AccessLevel = '-' | 'L' | 'E' | 'T' | 'A' | 'P' | 'C' | 'S';

/** Recursos da matriz de permissões (uma linha por recurso). */
export type Resource =
  | 'access_profile'
  | 'dashboard'
  | 'caregiver_registry'
  | 'elder_care'
  | 'plans_subscriptions'
  | 'care_schedule'
  | 'session_notes'
  | 'occupancy'
  | 'rooms'
  | 'zarit_individual'
  | 'zarit_aggregate'
  | 'arbe_settings'
  | 'groups'
  | 'network'
  | 'partners_corporate'
  | 'finance'
  | 'indicators'
  | 'pilot'
  | 'message_inbox'
  | 'complaints'
  | 'lgpd_consents_requests'
  | 'lgpd_audit_log'
  | 'governance'
  | 'occurrences'
  | 'settings';

/** Ações verificadas por `can()`. */
export type PermissionAction =
  | 'view'
  | 'view_aggregate'
  | 'create'
  | 'update'
  | 'delete'
  | 'decide'
  | 'export'
  | 'reveal'
  | 'supervise';
