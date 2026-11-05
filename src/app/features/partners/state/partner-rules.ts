/**
 * Regras puras do módulo de parceiros e do canal corporativo (RN-CRT-06, 07, 10, 11 e RN-CORP-06, 07).
 * Sem Angular e sem relógio: recebem os dados e devolvem a decisão e o motivo em texto.
 */
import type {
  CorporateAccount,
  CorporateSeat,
  Partner,
  PartnerRemuneration,
  PartnerStatus,
} from '@core/models';
import { validateFictitiousEmail } from '@core/rules';

export type ValidationKind = 'legal' | 'ethics';

export const VALIDATION_LABEL: Readonly<Record<ValidationKind, string>> = {
  legal: 'validação jurídica',
  ethics: 'validação ética',
};

/** Passos permitidos no funil de parceiros. `ended` é final. */
export const PARTNER_TRANSITIONS: Readonly<Record<PartnerStatus, readonly PartnerStatus[]>> = {
  prospect: ['legal_ethics_review', 'ended'],
  legal_ethics_review: ['active', 'prospect', 'ended'],
  active: ['suspended', 'ended'],
  suspended: ['active', 'ended'],
  ended: [],
};

/** O modelo de remuneração exige validação jurídica e ética? Só "sem remuneração" dispensa (RN-CRT-06). */
export function remunerationNeedsValidation(model: PartnerRemuneration['model']): boolean {
  return model !== 'none';
}

export interface PartnerActivationCheck {
  canActivate: boolean;
  /** Validações que faltam (vazio quando pode ativar). */
  missing: ValidationKind[];
}

/**
 * RN-CRT-06: o parceiro só vai a `active` com "sem remuneração" OU com a validação jurídica E a ética
 * registradas. Antes disso o modelo fica sem efeito.
 */
export function checkPartnerActivation(
  remuneration: Pick<PartnerRemuneration, 'model' | 'legalValidatedAt' | 'ethicsValidatedAt'>,
): PartnerActivationCheck {
  if (!remunerationNeedsValidation(remuneration.model)) {
    return { canActivate: true, missing: [] };
  }
  const missing: ValidationKind[] = [];
  if (!remuneration.legalValidatedAt) {
    missing.push('legal');
  }
  if (!remuneration.ethicsValidatedAt) {
    missing.push('ethics');
  }
  return { canActivate: missing.length === 0, missing };
}

/** "validação jurídica e validação ética". */
export function missingValidationText(missing: readonly ValidationKind[]): string {
  return missing.map((m) => VALIDATION_LABEL[m]).join(' e ');
}

export type MoveCheck = { ok: true } | { ok: false; message: string };

/** Pode mover o parceiro para `to`? Devolve o motivo em texto quando não pode. */
export function checkPartnerMove(
  partner: Pick<Partner, 'status' | 'remuneration'>,
  to: PartnerStatus,
): MoveCheck {
  if (!PARTNER_TRANSITIONS[partner.status].includes(to)) {
    return { ok: false, message: 'Este passo não existe a partir do estado atual.' };
  }
  if (to === 'active') {
    const check = checkPartnerActivation(partner.remuneration);
    if (!check.canActivate) {
      return {
        ok: false,
        message: `Para ativar falta: ${missingValidationText(check.missing)}.`,
      };
    }
  }
  return { ok: true };
}

/** Mudar o modelo de um parceiro ativo ou suspenso devolve o parceiro à validação (RN-CRT-06). */
export function modelChangeSendsBackToReview(
  status: PartnerStatus,
  from: PartnerRemuneration['model'],
  to: PartnerRemuneration['model'],
): boolean {
  return (status === 'active' || status === 'suspended') && from !== to && to !== 'none';
}

// ===== Canal corporativo =====

export const CORPORATE_TRANSITIONS: Readonly<
  Record<CorporateAccount['status'], readonly CorporateAccount['status'][]>
> = {
  prospect: ['negotiation', 'ended'],
  negotiation: ['active', 'prospect', 'ended'],
  active: ['suspended', 'ended'],
  suspended: ['active', 'ended'],
  ended: [],
};

export interface SeatCounts {
  /** Vagas contratadas. */
  contracted: number;
  active: number;
  invited: number;
  /** Ocupadas: ativas mais convites em aberto. */
  occupied: number;
  free: number;
}

export function seatCounts(
  account: Pick<CorporateAccount, 'seats'>,
  seats: readonly Pick<CorporateSeat, 'status'>[],
): SeatCounts {
  const active = seats.filter((s) => s.status === 'active').length;
  const invited = seats.filter((s) => s.status === 'invited').length;
  const occupied = active + invited;
  return {
    contracted: account.seats,
    active,
    invited,
    occupied,
    free: Math.max(0, account.seats - occupied),
  };
}

/**
 * Pode convidar mais um colaborador? O número de colaboradores não passa as vagas contratadas, e só o
 * contrato ativo recebe colaboradores (RN-CORP-06, RN-CORP-07).
 */
export function checkInvite(
  account: Pick<CorporateAccount, 'status' | 'seats'>,
  seats: readonly Pick<CorporateSeat, 'status'>[],
): MoveCheck {
  if (account.status !== 'active') {
    return { ok: false, message: 'Só um contrato ativo recebe colaboradores.' };
  }
  const counts = seatCounts(account, seats);
  if (counts.free === 0) {
    return {
      ok: false,
      message: `As ${counts.contracted} vagas contratadas já estão ocupadas. Remova um colaborador ou contrate mais vagas.`,
    };
  }
  return { ok: true };
}

/** E-mail do colaborador: só `@exemplo.com.br` (dado fictício, AC-GL-12). `null` quando está certo. */
export function inviteEmailError(email: string): string | null {
  const result = validateFictitiousEmail(email.trim());
  return result.valid ? null : result.message;
}
