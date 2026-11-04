/**
 * Mascaramento em tela (LP-07, RN-LGPD-26): CPF `***.***.***-**`, telefone `(34) 9****-0123`,
 * e-mail `a***@exemplo.com.br`, nome `Ana P. F.`. "Mostrar" o dado completo exige perfil autorizado e
 * justificativa, e gera `reveal` no log (`AuditLogService.reveal`).
 */

export const CPF_MASK = '***.***.***-**';

/** CPF totalmente mascarado. */
export function maskCpf(cpf: string | null | undefined): string {
  return cpf ? CPF_MASK : '';
}

/** Telefone: mantém o DDD e os 4 últimos dígitos. `(34) 90000-0123` vira `(34) 9****-0123`. */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) {
    return '';
  }
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) {
    return '****';
  }
  const ddd = digits.slice(0, 2);
  const number = digits.slice(2);
  const last4 = number.slice(-4);
  return number.length === 9 ? `(${ddd}) ${number[0]}****-${last4}` : `(${ddd}) ****-${last4}`;
}

/** E-mail: primeira letra e o domínio. `ana@exemplo.com.br` vira `a***@exemplo.com.br`. */
export function maskEmail(email: string | null | undefined): string {
  if (!email) {
    return '';
  }
  const at = email.indexOf('@');
  if (at < 1) {
    return '***';
  }
  return `${email[0]}***${email.slice(at)}`;
}

/** Nome: primeiro nome e iniciais dos demais. `Ana Paula Ferraz` vira `Ana P. F.`. */
export function maskName(name: string | null | undefined): string {
  if (!name) {
    return '';
  }
  const parts = name.trim().split(/\s+/);
  const [first, ...rest] = parts;
  const initials = rest
    .filter((p) => p.length > 0)
    .map((p) => `${(p[0] as string).toUpperCase()}.`);
  return [first, ...initials].join(' ');
}

export type MaskKind = 'cpf' | 'phone' | 'email' | 'name';

/** Aplica a máscara pelo tipo. */
export function maskValue(kind: MaskKind, value: string | null | undefined): string {
  switch (kind) {
    case 'cpf':
      return maskCpf(value);
    case 'phone':
      return maskPhone(value);
    case 'email':
      return maskEmail(value);
    default:
      return maskName(value);
  }
}

/** O texto parece uma máscara (útil em testes e para não mascarar duas vezes)? */
export function isMasked(value: string): boolean {
  return value.includes('***');
}
