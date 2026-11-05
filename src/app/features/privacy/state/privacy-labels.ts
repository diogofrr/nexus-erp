import type { DsrStatus, DsrType } from '@core/models';
import type { DsrDeadlineState } from '@core/rules';
import type { BadgeVariant, IconName } from '@shared/ui';

export const DSR_STATUS_LABELS: Readonly<Record<DsrStatus, string>> = {
  open: 'Aberta',
  in_progress: 'Em andamento',
  completed: 'Concluída',
  rejected_with_reason: 'Rejeitada com motivo',
};

export const DSR_STATUS_BADGES: Readonly<Record<DsrStatus, { variant: BadgeVariant; icon: IconName }>> = {
  open: { variant: 'info', icon: 'inbox' },
  in_progress: { variant: 'attention', icon: 'clock' },
  completed: { variant: 'success', icon: 'circle-check' },
  rejected_with_reason: { variant: 'neutral', icon: 'ban' },
};

/** Prazo da solicitação: texto, ícone e cor juntos (estado nunca só por cor). */
export const DEADLINE_BADGES: Readonly<Record<DsrDeadlineState, { variant: BadgeVariant; icon: IconName }>> = {
  done: { variant: 'success', icon: 'circle-check' },
  on_time: { variant: 'info', icon: 'calendar-days' },
  due_soon: { variant: 'attention', icon: 'clock' },
  overdue: { variant: 'danger', icon: 'triangle-alert' },
};

export const DSR_TYPE_DESCRIPTIONS: Readonly<Record<DsrType, string>> = {
  access: 'O titular quer saber quais dados a Nexus guarda sobre ele.',
  correction: 'O titular pediu para corrigir um dado.',
  anonymization_or_blocking: 'O titular pediu para anonimizar ou bloquear dados.',
  portability: 'O titular quer levar os dados dele em um arquivo.',
  erasure: 'O titular pediu para eliminar os dados.',
  consent_revocation: 'O titular quer retirar um consentimento.',
  sharing_info: 'O titular quer saber com quem os dados foram compartilhados.',
  decision_review: 'O titular pediu para rever uma decisão tomada com base nos dados dele.',
};

export const INCIDENT_STATUS_LABELS: Readonly<Record<string, string>> = {
  open: 'Aberto',
  contained: 'Contido',
  communicated: 'Comunicado',
  closed: 'Encerrado',
};

export const INCIDENT_STATUS_BADGES: Readonly<Record<string, { variant: BadgeVariant; icon: IconName }>> = {
  open: { variant: 'danger', icon: 'shield-alert' },
  contained: { variant: 'attention', icon: 'shield' },
  communicated: { variant: 'info', icon: 'send' },
  closed: { variant: 'success', icon: 'circle-check' },
};

/** Tipos de dado afetado, em chips de múltipla escolha (F13). */
export const INCIDENT_DATA_KINDS: readonly string[] = ['Contato', 'Agenda', 'Saúde', 'Financeiro', 'Outros'];

/** Procedimentos que podem ter falhado num incidente (RN-POP-13). */
export const INCIDENT_POPS: readonly { code: string; label: string }[] = [
  { code: 'POP-06', label: 'POP-06: proteção de dados e resposta a incidentes' },
  { code: 'POP-01', label: 'POP-01: cadastro e acolhimento do usuário' },
  { code: 'POP-08', label: 'POP-08: atendimento a reclamações' },
  { code: 'POP-10', label: 'POP-10: encerramento do cadastro e exclusão de dados' },
];
