/**
 * Pseudonimização (RN-LGPD-09, LP-08): a gestão enxerga o cuidador por código determinístico
 * `CUI-0042`, plano, status e agregados. Nunca nome, contato, CPF ou texto livre. Não existe botão de
 * reidentificar para o `partner`.
 */
import { Caregiver, CaregiverStatus } from '../models/caregivers';
import { PlanId } from '../models/plans';

const CODE_RE = /^CUI-(\d{4})$/;

/** `CUI-0042` a partir do sequencial 42. */
export function caregiverCode(sequence: number): string {
  return `CUI-${String(Math.abs(Math.trunc(sequence)) % 10_000).padStart(4, '0')}`;
}

/** Sequencial de um código `CUI-0042` (ou `null` se o formato não bate). */
export function parseCaregiverCode(code: string): number | null {
  const m = CODE_RE.exec(code);
  return m ? Number(m[1]) : null;
}

export function isCaregiverCode(value: string): boolean {
  return CODE_RE.test(value);
}

/**
 * Código determinístico a partir de qualquer id. Se o id termina em número (`cg_0042`), o código é
 * `CUI-0042`; senão usa um hash FNV-1a do id. Mesma entrada, mesma saída.
 */
export function pseudonymFromId(id: string): string {
  const m = /(\d+)$/.exec(id);
  if (m) {
    return caregiverCode(Number(m[1]));
  }
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return caregiverCode(hash % 10_000);
}

/** O que a gestão vê de um cuidador. */
export interface PseudonymizedCaregiver {
  id: string;
  code: string;
  status: CaregiverStatus;
  planId?: PlanId;
  isPilot: boolean;
}

/** Visão da gestão: só código, status e plano. Sem nome, CPF, contato, cidade nem datas pessoais. */
export function pseudonymizeCaregiver(
  caregiver: Pick<Caregiver, 'id' | 'code' | 'status' | 'isPilot'>,
  planId?: PlanId,
): PseudonymizedCaregiver {
  const view: PseudonymizedCaregiver = {
    id: caregiver.id,
    code: caregiver.code,
    status: caregiver.status,
    isPilot: caregiver.isPilot,
  };
  if (planId) {
    view.planId = planId;
  }
  return view;
}

/** Identificadores que NUNCA podem aparecer na visão pseudonimizada (para testes e revisão). */
export const IDENTIFYING_FIELDS: readonly (keyof Caregiver)[] = [
  'fullName',
  'cpf',
  'email',
  'phone',
  'whatsapp',
  'birthDate',
  'city',
  'sociodemographics',
];
