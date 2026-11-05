import { Activity, ActivityEnrollment, ActivityKind, ActivityStatus, GroupTheme, TrainingTheme } from '@core/models';
import type { BadgeVariant, IconName } from '@shared/ui';

/** Textos de tela de grupos e capacitações (pt-BR, tom da marca, sem promessa de resultado terapêutico). */

export const KIND_LABELS: Readonly<Record<ActivityKind, string>> = {
  support_group: 'Grupo de apoio',
  training: 'Capacitação',
  group_therapy: 'Terapia de grupo',
  open_conversation_circle: 'Roda de conversa aberta',
};

/** Temas dos grupos (RN-GRP-05): os únicos oferecidos para grupo de apoio, terapia de grupo e roda de conversa. */
export const GROUP_THEMES: readonly GroupTheme[] = [
  'caregiver_burden',
  'communication_with_elder',
  'routine_organization',
  'handling_difficult_situations',
  'self_care',
  'emotional_health',
  'family_conflict_prevention',
  'basic_care_guidance',
];

/** Temas das capacitações (RN-GRP-06). */
export const TRAINING_THEMES: readonly TrainingTheme[] = [
  'first_aid',
  'bed_bath_hygiene',
  'fall_prevention',
  'safe_medication',
  'feeding_choking_prevention',
  'dementia_communication',
];

export const THEME_LABELS: Readonly<Record<GroupTheme | TrainingTheme, string>> = {
  caregiver_burden: 'Sobrecarga do cuidador',
  communication_with_elder: 'Comunicação com a pessoa idosa',
  routine_organization: 'Organização da rotina',
  handling_difficult_situations: 'Manejo de situações difíceis',
  self_care: 'Autocuidado',
  emotional_health: 'Saúde emocional',
  family_conflict_prevention: 'Prevenção de conflitos familiares',
  basic_care_guidance: 'Orientações básicas sobre o cuidado',
  first_aid: 'Primeiros socorros',
  bed_bath_hygiene: 'Higiene e banho no leito',
  fall_prevention: 'Prevenção de quedas',
  safe_medication: 'Administração segura de medicamentos',
  feeding_choking_prevention: 'Alimentação e prevenção de engasgo',
  dementia_communication: 'Comunicação com pessoas com demência',
};

/** Os temas permitidos para o tipo (AC-M07-10: só os conjuntos de RN-GRP-05 e 06 são oferecidos). */
export function themesFor(kind: ActivityKind): readonly (GroupTheme | TrainingTheme)[] {
  return kind === 'training' ? TRAINING_THEMES : GROUP_THEMES;
}

export function isThemeAllowed(kind: ActivityKind, theme: string): boolean {
  return (themesFor(kind) as readonly string[]).includes(theme);
}

/** Caráter da atividade, informado na página (RN-GRP-16, RN-ATD-19). */
export const CHARACTER_LABELS: Readonly<Record<Activity['character'], string>> = {
  guidance: 'Orientação e psicoeducação',
  psychotherapy: 'Psicoterapia',
};

/** Texto fixo da divulgação (RN-GRP-15, AC-M07-07). */
export const NO_PROMISE_TEXT = 'Esta atividade não promete resultado terapêutico.';

/** Texto padrão do contrato de sigilo (RN-GRP-09). */
export const DEFAULT_CONFIDENTIALITY =
  'Contrato de sigilo: o que for dito no grupo fica no grupo. Não compartilhamos relatos com familiares ou terceiros sem autorização. A atividade não promete resultado terapêutico.';

export interface StatusView {
  label: string;
  variant: BadgeVariant;
  icon: IconName;
}

export const ACTIVITY_STATUS_VIEW: Readonly<Record<ActivityStatus, StatusView>> = {
  draft: { label: 'Rascunho', variant: 'neutral', icon: 'pencil' },
  open: { label: 'Aberta', variant: 'success', icon: 'circle-check' },
  full: { label: 'Lotada', variant: 'attention', icon: 'users-round' },
  in_progress: { label: 'Em andamento', variant: 'info', icon: 'clock' },
  finished: { label: 'Encerrada', variant: 'neutral', icon: 'check' },
  cancelled: { label: 'Cancelada', variant: 'neutral', icon: 'ban' },
};

export const ENROLLMENT_STATUS_VIEW: Readonly<Record<ActivityEnrollment['status'], StatusView>> = {
  enrolled: { label: 'Inscrito', variant: 'success', icon: 'circle-check' },
  waitlist: { label: 'Lista de espera', variant: 'attention', icon: 'hourglass' },
  attended: { label: 'Participou', variant: 'neutral', icon: 'check' },
  absent: { label: 'Ausente', variant: 'neutral', icon: 'minus' },
  cancelled: { label: 'Cancelada', variant: 'neutral', icon: 'ban' },
};

export const MODE_LABELS: Readonly<Record<Activity['mode'], string>> = {
  online: 'On-line',
  in_person: 'Presencial',
};

/** Promessa de resultado terapêutico na divulgação (RN-GRP-15): o título não pode usar estas palavras. */
export const PROMISE_PATTERN = /\b(cura|curar|curado|garant\w*|resultado garantido|melhora garantida|milagre)\b/i;
