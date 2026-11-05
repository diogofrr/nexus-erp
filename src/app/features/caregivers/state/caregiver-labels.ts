import type { Channel, CaregiverStatus, Dependency, Relationship, Sex } from '@core/models';
import type { BadgeVariant } from '@shared/ui';
import type { IconName } from '@shared/ui';

/** Rótulos em pt-BR do cadastro do cuidador (nada de jargão, "pessoa idosa", nunca "paciente"). */
export const STATUS_LABELS: Readonly<Record<CaregiverStatus, string>> = {
  active: 'Ativo',
  paused_by_consent_revocation: 'Pausado: sem consentimento de saúde',
  closure_requested: 'Encerramento pedido',
  closed: 'Encerrado',
};

export const STATUS_SHORT_LABELS: Readonly<Record<CaregiverStatus, string>> = {
  active: 'Ativo',
  paused_by_consent_revocation: 'Pausado',
  closure_requested: 'Encerramento pedido',
  closed: 'Encerrado',
};

export const STATUS_BADGES: Readonly<Record<CaregiverStatus, { variant: BadgeVariant; icon: IconName }>> = {
  active: { variant: 'success', icon: 'circle-check' },
  paused_by_consent_revocation: { variant: 'attention', icon: 'pause' },
  closure_requested: { variant: 'attention', icon: 'hourglass' },
  closed: { variant: 'neutral', icon: 'ban' },
};

export const RELATIONSHIP_LABELS: Readonly<Record<Relationship, string>> = {
  daughter: 'Filha',
  son: 'Filho',
  spouse: 'Cônjuge',
  daughter_in_law: 'Nora',
  grandchild: 'Neto ou neta',
  other: 'Outro parentesco',
};

export const SEX_LABELS: Readonly<Record<Sex, string>> = {
  female: 'Feminino',
  male: 'Masculino',
  other: 'Outro',
  undisclosed: 'Prefere não informar',
};

export const DEPENDENCY_LABELS: Readonly<Record<Dependency, string>> = {
  independent: 'Independente',
  partial: 'Dependência parcial',
  total: 'Dependência total',
};

export const DEPENDENCY_HINTS: Readonly<Record<Dependency, string>> = {
  independent: 'Faz sozinha as atividades do dia a dia.',
  partial: 'Precisa de ajuda em parte das atividades.',
  total: 'Precisa de ajuda na maior parte das atividades.',
};

export const CHANNEL_LABELS: Readonly<Record<Channel, string>> = {
  app: 'Aplicativo',
  whatsapp: 'WhatsApp',
  phone: 'Telefone',
  email: 'E-mail',
};

export const LITERACY_LABELS: Readonly<Record<'low' | 'medium' | 'high', string>> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
};

export const SESSION_STATUS_LABELS: Readonly<Record<string, string>> = {
  scheduled: 'Agendada',
  confirmed: 'Confirmada',
  done: 'Realizada',
  cancelled_by_user: 'Cancelada pelo cuidador',
  cancelled_by_psychologist: 'Cancelada pelo psicólogo',
  no_show: 'Falta',
};

export const MODALITY_LABELS: Readonly<Record<string, string>> = {
  online: 'On-line',
  in_person_coworking: 'Presencial no coworking',
  in_person_home: 'No domicílio',
};

export const CLOSURE_REASONS: readonly string[] = [
  'O cuidador pediu para encerrar o cadastro',
  'A pessoa idosa não precisa mais de cuidado',
  'O cuidador mudou de cidade',
  'Cadastro duplicado',
  'Outro motivo (descreva)',
];
