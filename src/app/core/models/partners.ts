import { Audited, Cents, ID, ISODate } from './primitives';
import { PaidPlanId } from './plans';

export type PartnerStatus = 'prospect' | 'legal_ethics_review' | 'active' | 'suspended' | 'ended';

export type PartnerCategory =
  'pharmacy' | 'clinic' | 'market' | 'optical' | 'laboratory' | 'gym' | 'other';

export interface PartnerRemuneration {
  /** Nunca há remuneração sobre atendimento psicológico (RN-CRT-07). */
  model: 'none' | 'fixed_fee' | 'commission_non_psychological';
  notes?: string;
  legalValidatedAt?: ISODate;
  ethicsValidatedAt?: ISODate;
}

export interface Partner extends Audited {
  name: string;
  category: PartnerCategory;
  status: PartnerStatus;
  /** 0 a 100, uma casa decimal (RN-CRT-11). */
  discountPercent: number;
  contactName: string;
  contactEmail: string;
  city: string;
  remuneration: PartnerRemuneration;
}

export type CorporateStatus = 'prospect' | 'negotiation' | 'active' | 'suspended' | 'ended';

export interface CorporateAccount extends Audited {
  companyName: string;
  /** Fictício, com dígitos verificadores inválidos. */
  cnpj: string;
  hrContactName: string;
  hrContactEmail: string;
  status: CorporateStatus;
  planId: PaidPlanId;
  seats: number;
  /** [suposição], fora da projeção (RN-CORP-05). */
  seatPriceCents: Cents;
  startDate?: ISODate;
  endDate?: ISODate;
}

export interface CorporateSeat extends Audited {
  corporateAccountId: ID;
  caregiverId?: ID;
  invitedEmail: string;
  status: 'invited' | 'active' | 'removed';
}
