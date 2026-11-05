import type {
  CorporateAccount,
  CorporateSeat,
  PartnerCategory,
  PartnerRemuneration,
  PartnerStatus,
} from '@core/models';
import type { BadgeVariant, IconName } from '@shared/ui';

/** Ordem do funil de parceiros (RN-CRT-10, SCR-M09-01). */
export const PARTNER_FUNNEL: readonly PartnerStatus[] = [
  'prospect',
  'legal_ethics_review',
  'active',
  'suspended',
  'ended',
];

export const PARTNER_STATUS_LABEL: Readonly<Record<PartnerStatus, string>> = {
  prospect: 'Prospecção',
  legal_ethics_review: 'Validação jurídica e ética',
  active: 'Ativo',
  suspended: 'Suspenso',
  ended: 'Encerrado',
};

export interface StatusLook {
  variant: BadgeVariant;
  icon: IconName;
}

export const PARTNER_STATUS_LOOK: Readonly<Record<PartnerStatus, StatusLook>> = {
  prospect: { variant: 'neutral', icon: 'circle-dashed' },
  legal_ethics_review: { variant: 'attention', icon: 'clock' },
  active: { variant: 'success', icon: 'circle-check' },
  suspended: { variant: 'danger', icon: 'pause' },
  ended: { variant: 'neutral', icon: 'ban' },
};

export const PARTNER_CATEGORY_LABEL: Readonly<Record<PartnerCategory, string>> = {
  pharmacy: 'Farmácia',
  clinic: 'Clínica',
  market: 'Mercado',
  optical: 'Ótica',
  laboratory: 'Laboratório',
  gym: 'Academia',
  other: 'Outro serviço',
};

export const PARTNER_CATEGORIES: readonly PartnerCategory[] = [
  'pharmacy',
  'clinic',
  'market',
  'optical',
  'laboratory',
  'gym',
  'other',
];

/** Só modelos para serviços que não são privativos da Psicologia (RN-CRT-07). */
export const REMUNERATION_LABEL: Readonly<Record<PartnerRemuneration['model'], string>> = {
  none: 'Sem remuneração',
  fixed_fee: 'Valor fixo mensal',
  commission_non_psychological: 'Percentual sobre vendas de produtos e serviços do parceiro',
};

export const REMUNERATION_MODELS: readonly PartnerRemuneration['model'][] = [
  'none',
  'fixed_fee',
  'commission_non_psychological',
];

export const CORPORATE_FUNNEL: readonly CorporateAccount['status'][] = [
  'prospect',
  'negotiation',
  'active',
  'suspended',
  'ended',
];

export const CORPORATE_STATUS_LABEL: Readonly<Record<CorporateAccount['status'], string>> = {
  prospect: 'Prospecção',
  negotiation: 'Em negociação',
  active: 'Contrato ativo',
  suspended: 'Suspenso',
  ended: 'Encerrado',
};

export const CORPORATE_STATUS_LOOK: Readonly<Record<CorporateAccount['status'], StatusLook>> = {
  prospect: { variant: 'neutral', icon: 'circle-dashed' },
  negotiation: { variant: 'info', icon: 'handshake' },
  active: { variant: 'success', icon: 'circle-check' },
  suspended: { variant: 'danger', icon: 'pause' },
  ended: { variant: 'neutral', icon: 'ban' },
};

export const SEAT_STATUS_LABEL: Readonly<Record<CorporateSeat['status'], string>> = {
  invited: 'Convite enviado',
  active: 'Ativo',
  removed: 'Removido',
};

export function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}
