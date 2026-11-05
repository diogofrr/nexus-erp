import {
  AccreditationStatus,
  ArpBand,
  ChecklistKey,
  GraveCategory,
  ProviderCategory,
  ProviderDocument,
  ProviderStatus,
  ServiceRequestStatus,
} from '@core/models';
import { IconName, BadgeVariant } from '@shared/ui';

/** Nome da categoria na interface (RN-REDE-02). */
export function categoryLabel(category: ProviderCategory): string {
  switch (category) {
    case 'physiotherapy':
      return 'Fisioterapia';
    case 'professional_caregiver':
      return 'Cuidador(a) profissional';
    case 'home_care':
      return 'Home care';
    case 'nursing':
      return 'Enfermagem';
    case 'pharmacy':
      return 'Farmácia';
    case 'clinic':
      return 'Clínica';
    case 'psychology':
      return 'Psicologia';
    case 'nutrition':
      return 'Nutrição';
    case 'legal':
      return 'Advocacia';
    case 'specialized_service':
      return 'Serviço especializado';
    default:
      return 'Saúde bucal';
  }
}

export interface StatusView {
  label: string;
  variant: BadgeVariant;
  icon: IconName;
}

export const PROVIDER_STATUS_VIEW: Readonly<Record<ProviderStatus, StatusView>> = {
  active: { label: 'Ativo', variant: 'success', icon: 'circle-check' },
  monitoring: { label: 'Em monitoramento', variant: 'attention', icon: 'triangle-alert' },
  suspended: { label: 'Suspenso', variant: 'danger', icon: 'ban' },
  deaccredited: { label: 'Descredenciado', variant: 'neutral', icon: 'user-x' },
  candidate: { label: 'Candidato', variant: 'info', icon: 'clock' },
  rejected: { label: 'Reprovado', variant: 'danger', icon: 'circle-alert' },
};

export const BAND_VIEW: Readonly<Record<ArpBand, StatusView>> = {
  excellence: { label: 'Excelência', variant: 'success', icon: 'award' },
  alert: { label: 'Alerta', variant: 'attention', icon: 'triangle-alert' },
  deaccreditation: { label: 'Descredenciamento', variant: 'danger', icon: 'ban' },
  no_average: { label: 'Sem média (menos de 5 avaliações)', variant: 'neutral', icon: 'circle-dashed' },
};

export const ACCREDITATION_STATUS_LABEL: Readonly<Record<AccreditationStatus, string>> = {
  requested: 'Solicitado',
  in_review: 'Em análise',
  pending_documents: 'Documentos pendentes',
  approved: 'Aprovado',
  rejected: 'Reprovado',
  active: 'Ativo',
};

export const ACCREDITATION_STATUS_VARIANT: Readonly<Record<AccreditationStatus, BadgeVariant>> = {
  requested: 'info',
  in_review: 'info',
  pending_documents: 'attention',
  approved: 'success',
  rejected: 'danger',
  active: 'success',
};

export const REQUEST_STATUS_VIEW: Readonly<Record<ServiceRequestStatus, StatusView>> = {
  requested: { label: 'Aguardando resposta', variant: 'attention', icon: 'clock' },
  accepted: { label: 'Aceita', variant: 'info', icon: 'circle-check' },
  refused_by_provider: { label: 'Recusada pelo prestador', variant: 'neutral', icon: 'circle-alert' },
  cancelled_by_provider: { label: 'Cancelada pelo prestador', variant: 'neutral', icon: 'circle-alert' },
  cancelled_by_user: { label: 'Cancelada pelo usuário', variant: 'neutral', icon: 'x' },
  completed: { label: 'Concluída', variant: 'success', icon: 'check' },
  evaluated: { label: 'Avaliada', variant: 'success', icon: 'star' },
};

export const DOCUMENT_KIND_LABEL: Readonly<Record<ProviderDocument['kind'], string>> = {
  council_registry: 'Registro no conselho',
  training_proof: 'Comprovação de formação',
  contract: 'Contrato de credenciamento',
  data_protection_term: 'Termo de proteção de dados',
  identity: 'Documento de identificação',
};

export const GRAVE_CATEGORY_LABEL: Readonly<Record<GraveCategory, string>> = {
  unjustified_absence: 'Falta sem justificativa',
  confidentiality_breach: 'Quebra de sigilo',
  other: 'Outra',
};

export const CHECKLIST_SHORT: Readonly<Record<ChecklistKey, string>> = {
  council_registry: 'registro no conselho',
  training_proof: 'comprovação de formação',
  accreditation_contract: 'contrato de credenciamento',
  data_protection_term: 'termo de proteção de dados',
  continuous_evaluation_accepted: 'aceite da avaliação contínua',
};

export const MODALITY_LABEL = { home: 'Em domicílio', at_provider: 'No local do prestador' } as const;

/** "Conselho: CREFITO-MG 00001-F (fictício)". Sem conselho: "Sem conselho de classe". */
export function councilText(council: {
  body: string;
  number?: string;
  state?: string;
  fictitious?: boolean;
}): string {
  if (council.body === 'NONE') {
    return 'Sem conselho de classe';
  }
  const place = council.state ? `-${council.state}` : '';
  const number = council.number ? ` ${council.number}` : '';
  return `${council.body}${place}${number}${council.fictitious ? ' (fictício)' : ''}`;
}

export function pluralize(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Categoria, especialidade e conselho em uma linha, sem repetir o que é igual. */
export function subtitleOf(category: string, specialty: string, council: string): string {
  return [category, specialty.toLowerCase() === category.toLowerCase() ? '' : specialty, council]
    .filter((part) => part !== '')
    .join(' · ');
}
