/**
 * Governança (M13): quem pode agir em cada POP, o que cada perfil vê dos encaminhamentos e das ocorrências,
 * validação de edição de risco e fechamento de ocorrência. RN-POP-13, 14; RN-RISCO-01, 02, 21; RN-ENC-07, 10, 11.
 * Funções PURAS, sem Angular e sem relógio.
 */
import { ISODate } from '../models/primitives';
import { Role } from '../models/access';
import {
  AuthorityNotification,
  Occurrence,
  OccurrenceStep,
  Pop,
  PopResponsible,
  PopReviewState,
  ReferralCategory,
  RiskScale,
} from '../models/governance';
import { popReviewState } from './governance';
import { POP05_STEPS, POP07_STEPS, checkOccurrenceClosure } from './pop05';

export const POP_RESPONSIBLE_LABELS: Readonly<Record<PopResponsible, string>> = {
  management: 'Gestão',
  technical_lead: 'Responsável técnico',
  management_and_technical_lead: 'Gestão e responsável técnico',
};

export const POP_STATE_LABELS: Readonly<Record<PopReviewState, string>> = {
  up_to_date: 'Em dia',
  due: 'A revisar',
  revision_triggered: 'Revisão acionada',
};

/**
 * Estado exibido do POP: a revisão "acionada por incidente" (RN-POP-13) fica até a próxima revisão; do contrário
 * conta 12 meses da última revisão com o relógio do sistema. O estado gravado é só um retrato do dia do seed.
 */
export function popDisplayState(
  pop: Pick<Pop, 'lastReviewedAt' | 'reviewState'>,
  today: ISODate,
): PopReviewState {
  return popReviewState(pop.lastReviewedAt, today, pop.reviewState === 'revision_triggered');
}

/**
 * Quem fecha as ações de cada POP (RN-POP-14): as do RT só o RT; as da gestão só a gestão; o POP-04 é dos dois.
 * `partner` é a gestão. Psicólogo e atendimento só leem.
 */
export function canActOnPop(role: Role, responsible: PopResponsible): boolean {
  if (role === 'partner') {
    return responsible === 'management' || responsible === 'management_and_technical_lead';
  }
  if (role === 'technical_lead') {
    return responsible === 'technical_lead' || responsible === 'management_and_technical_lead';
  }
  return false;
}

/** Por que o perfil não age no POP (texto para a tela, sem culpa). */
export function popActionBlockedReason(role: Role, responsible: PopResponsible): string | null {
  if (canActOnPop(role, responsible)) {
    return null;
  }
  if (role === 'partner') {
    return 'As ações deste POP são do responsável técnico.';
  }
  if (role === 'technical_lead') {
    return 'As ações deste POP são da gestão.';
  }
  return 'Você pode ler este POP. As ações são da gestão e do responsável técnico.';
}

// ===== Encaminhamentos =====

/** Categorias que tocam risco ou violência: restritas ao RT e ao psicólogo do caso (RN-ENC-11). */
export const RESTRICTED_REFERRAL_CATEGORIES: readonly ReferralCategory[] = [
  'severe_distress_or_suicide_risk',
  'rights_violation_or_neglect',
];

/** Categorias sem conteúdo clínico, que o atendimento pode ver. */
export const SUPPORT_VISIBLE_REFERRAL_CATEGORIES: readonly ReferralCategory[] = [
  'social_vulnerability',
  'social_security_or_guardianship',
  'caregiver_cannot_afford_care',
];

export type ReferralVisibility = 'full' | 'count_only' | 'hidden';

/**
 * O que cada perfil vê de um encaminhamento:
 * - RT: tudo (acesso restrito ao RT e ao psicólogo do caso, RN-ENC-11);
 * - psicólogo: os casos dele, completos; os dos outros, nada;
 * - gestão: as categorias sem risco ou violência, só com o código; as de risco ou violência, apenas a contagem por
 *   categoria (RN-ENC-11);
 * - atendimento: só as categorias sem conteúdo clínico (nem "existe alerta", escopo 1.3).
 */
export function referralVisibility(
  role: Role,
  category: ReferralCategory,
  isOwnCase: boolean,
): ReferralVisibility {
  switch (role) {
    case 'technical_lead':
      return 'full';
    case 'psychologist':
      return isOwnCase ? 'full' : 'hidden';
    case 'partner':
      return RESTRICTED_REFERRAL_CATEGORIES.includes(category) ? 'count_only' : 'full';
    case 'support':
      return SUPPORT_VISIBLE_REFERRAL_CATEGORIES.includes(category) ? 'full' : 'hidden';
    default:
      return 'hidden';
  }
}

/** Lembrete da categoria no formulário de encaminhamento (AC-M13-05). */
export function referralReminder(category: ReferralCategory): string | null {
  switch (category) {
    case 'severe_distress_or_suicide_risk':
      return 'Conforme POP-05: contato no mesmo dia, avaliação de risco pelo psicólogo e, em emergência, SAMU (192).';
    case 'rights_violation_or_neglect':
      return 'Notificação compulsória, conforme POP-07. Proteja a pessoa idosa sem abandonar quem cuida.';
    case 'elder_clinical_worsening':
      return 'Comunique a família imediatamente e marque aqui que ela foi comunicada.';
    case 'caregiver_cannot_afford_care':
      return 'O plano gratuito é mantido. A Nexus atua ao lado das políticas públicas, não no lugar delas.';
    case 'psychiatric_follow_up':
      return 'Com orientação do responsável técnico.';
    default:
      return null;
  }
}

// ===== Riscos =====

export interface RiskEditCheck {
  ok: boolean;
  errors: Partial<Record<'probability' | 'impact' | 'treatment', string>>;
}

function isScale(value: unknown): value is RiskScale {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
}

/**
 * Edição de P e I (RN-RISCO-01, 21): inteiros de 1 a 5, C calculado. Risco prioritário (C 12 ou mais) exige
 * plano de tratamento (RN-RISCO-02).
 */
export function checkRiskEdit(input: {
  probability: unknown;
  impact: unknown;
  treatment: string;
}): RiskEditCheck {
  const errors: RiskEditCheck['errors'] = {};
  if (!isScale(input.probability)) {
    errors.probability = 'A probabilidade deve ser um número inteiro de 1 a 5.';
  }
  if (!isScale(input.impact)) {
    errors.impact = 'O impacto deve ser um número inteiro de 1 a 5.';
  }
  if (
    isScale(input.probability) &&
    isScale(input.impact) &&
    input.probability * input.impact >= 12 &&
    input.treatment.trim().length === 0
  ) {
    errors.treatment = 'Risco prioritário precisa de plano de tratamento. Escreva o que será feito.';
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

/** Código do módulo citado num controle do risco: "Log de acesso (M12)" resulta `M12`. */
export function controlModuleCode(control: string): string | null {
  const match = /\((M\d{2})\)\s*$/.exec(control.trim());
  return match ? (match[1] as string) : null;
}

// ===== Ocorrências =====

export const OCCURRENCE_KIND_LABELS: Readonly<Record<Occurrence['kind'], string>> = {
  pop05_risk: 'POP-05 · Situação de risco',
  pop07_violence_suspicion: 'POP-07 · Suspeita de violência',
};

export const OCCURRENCE_STATUS_LABELS: Readonly<Record<Occurrence['status'], string>> = {
  open: 'Aberta',
  in_progress: 'Em andamento',
  closed: 'Encerrada',
};

/** Passos do roteiro de cada tipo de ocorrência. */
export function occurrenceStepLabels(kind: Occurrence['kind']): readonly string[] {
  return kind === 'pop05_risk' ? POP05_STEPS : POP07_STEPS;
}

/** Ocorrência nova: todos os passos pendentes. */
export function newOccurrenceSteps(kind: Occurrence['kind']): OccurrenceStep[] {
  return occurrenceStepLabels(kind).map((label, index) => ({ n: index + 1, label }));
}

export interface OccurrenceClosureStatus {
  ok: boolean;
  pendingSteps: number[];
  /** POP-07: falta registrar a comunicação a ao menos um órgão, com data. */
  missingNotification: boolean;
}

/**
 * Só encerra com TODOS os passos feitos, com hora e responsável (RN-POP-05). No POP-07 também exige a comunicação
 * aos órgãos registrada (RN-POP-07, RN-ENC-05). Só o RT encerra (RN-POP-14).
 */
export function occurrenceClosureStatus(
  occurrence: Pick<Occurrence, 'kind' | 'steps' | 'authoritiesNotified'>,
): OccurrenceClosureStatus {
  const steps = checkOccurrenceClosure(occurrence.steps, occurrenceStepLabels(occurrence.kind));
  const missingNotification =
    occurrence.kind === 'pop07_violence_suspicion' &&
    !occurrence.authoritiesNotified.some((a) => a.at !== undefined && a.at !== '');
  return {
    ok: steps.ok && !missingNotification,
    pendingSteps: steps.pendingSteps,
    missingNotification,
  };
}

/** Órgãos ainda não comunicados (sem data). */
export function pendingAuthorities(authorities: readonly AuthorityNotification[]): AuthorityNotification[] {
  return authorities.filter((a) => !a.at);
}

/** Estado da ocorrência depois de um passo: aberta sem passo feito; em andamento com ao menos um. */
export function occurrenceStatusAfterStep(steps: readonly OccurrenceStep[]): Occurrence['status'] {
  return steps.some((s) => s.doneAt) ? 'in_progress' : 'open';
}
