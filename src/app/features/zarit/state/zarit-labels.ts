import { ArbeAlert, Channel, ReviewRequest, RiskLevel, ZaritAlert } from '@core/models';
import { RedAlertClosureField } from '@core/rules';
import type { BadgeVariant, IconName } from '@shared/ui';

/** Textos de tela do acompanhamento (pt-BR, tom da marca). Nunca "diagnóstico", nunca "eficácia". */

export const CHANNEL_LABELS: Readonly<Record<Channel, string>> = {
  app: 'Aplicativo',
  whatsapp: 'WhatsApp',
  phone: 'Telefone',
  email: 'E-mail',
};

export const RISK_LABELS: Readonly<Record<RiskLevel, string>> = {
  low: 'Baixo',
  moderate: 'Moderado',
  high: 'Alto',
};

export const ALERT_STATUS_LABELS: Readonly<Record<ZaritAlert['status'] | 'overdue', string>> = {
  open: 'Aberto',
  contacted: 'Contato registrado',
  risk_assessed: 'Risco avaliado',
  closed: 'Encerrado',
  overdue: 'Prazo de contato vencido',
};

export const ARBE_STATUS_LABELS: Readonly<Record<ArbeAlert['status'], string>> = {
  generated: 'Gerado, aguardando revisão',
  confirmed: 'Confirmado',
  contacted: 'Contato registrado',
  closed: 'Encerrado',
  discarded: 'Descartado',
};

export const ARBE_LEVEL_LABELS: Readonly<Record<ArbeAlert['level'], string>> = {
  attention: 'Atenção',
  critical: 'Crítico',
};

export interface BadgeView {
  label: string;
  variant: BadgeVariant;
  icon: IconName;
}

export const ARBE_LEVEL_VIEW: Readonly<Record<ArbeAlert['level'], BadgeView>> = {
  attention: { label: 'Atenção', variant: 'attention', icon: 'triangle-alert' },
  critical: { label: 'Crítico', variant: 'danger', icon: 'octagon-alert' },
};

export const CLOSURE_FIELD_LABELS: Readonly<Record<RedAlertClosureField, string>> = {
  contact_time: 'horário do contato',
  contact_by: 'quem fez o contato',
  risk_assessment: 'nível e nota da avaliação de risco',
  referral: 'encaminhamento',
};

export const REVIEW_ABOUT_LABELS: Readonly<Record<ReviewRequest['about'], string>> = {
  zarit_decision: 'Decisão com base na escala',
  arbe_alert: 'Alerta de esgotamento',
};

/** Frase de apoio ao resultado (UX 7.3, exemplo 29): sem as palavras proibidas. */
export const RESULT_SUPPORT_NOTE =
  'Este resultado apoia a sua escuta clínica. A decisão sobre o acompanhamento é do psicólogo responsável.';

/** Tempo restante ou vencido em texto: "Faltam 6 h 19 min", "Vencido há 18 h". */
export function countdownText(minutesLeft: number): string {
  const abs = Math.abs(Math.round(minutesLeft));
  const days = Math.floor(abs / (60 * 24));
  const hours = Math.floor((abs % (60 * 24)) / 60);
  const minutes = abs % 60;
  const text =
    days > 0
      ? `${days} ${days === 1 ? 'dia' : 'dias'}${hours > 0 ? ` ${hours} h` : ''}`
      : hours > 0
        ? `${hours} h${minutes > 0 ? ` ${minutes} min` : ''}`
        : `${minutes} min`;
  return minutesLeft >= 0 ? `Faltam ${text}` : `Vencido há ${text}`;
}

