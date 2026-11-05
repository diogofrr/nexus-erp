/**
 * Como cada perfil enxerga um cuidador em listas, cabeçalhos e migalhas (LP-08, UX 6.2): a gestão vê só o
 * código `CUI-0042`; a equipe com acesso identificado vê o nome. Nenhum campo oculto: o nome da gestão
 * nem entra no texto devolvido.
 */
import { Role } from '../models/access';
import { Caregiver } from '../models/caregivers';

/** Perfis que veem nome, contato mascarado e demais dados identificados do cuidador. */
export function canSeeCaregiverIdentity(role: Role | null): boolean {
  return role === 'support' || role === 'technical_lead' || role === 'psychologist';
}

export interface CaregiverLabel {
  /** Nome (equipe) ou código (gestão). */
  text: string;
  code: string;
  /** `true` quando o texto é o código pseudonimizado. */
  pseudonymized: boolean;
}

export function caregiverLabel(
  role: Role | null,
  caregiver: Pick<Caregiver, 'fullName' | 'code'>,
): CaregiverLabel {
  const identified = canSeeCaregiverIdentity(role);
  return {
    text: identified ? caregiver.fullName : caregiver.code,
    code: caregiver.code,
    pseudonymized: !identified,
  };
}
