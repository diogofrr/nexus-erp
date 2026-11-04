import { ROLE_LABELS } from '../../../core/auth/permissions';
import { Role } from '../../../core/models/access';

/** Perfil por extenso, sempre visível no menu do usuário (UX 3.4: a pessoa troca de perfil muitas vezes). */
export function roleLabel(role: Role): string {
  return ROLE_LABELS[role];
}

const TITLES = new Set(['dr.', 'dra.', 'sr.', 'sra.', 'cuidadora', 'cuidador', 'enf.']);

/** Iniciais para o avatar: primeira e última palavra do nome, sem títulos (`Dra. Cecília Montenegro` vira `CM`). */
export function initialsOf(displayName: string): string {
  const words = displayName
    .split(/\s+/)
    .filter((w) => w.length > 0 && !TITLES.has(w.toLowerCase()));
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

/** Primeiro nome sem título, para saudações ("Bom dia, Cecília"). */
export function firstNameOf(displayName: string): string {
  const words = displayName
    .split(/\s+/)
    .filter((w) => w.length > 0 && !TITLES.has(w.toLowerCase()));
  return words[0] ?? displayName;
}
