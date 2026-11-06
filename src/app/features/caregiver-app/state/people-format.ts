/**
 * Como o aplicativo do cuidador fala de uma pessoa da equipe. Funções puras, a única fonte desses textos: Hoje, Agenda,
 * Conversar com um psicólogo e Como estou usam a mesma; ficam em `state/` para as áreas nunca importarem umas das outras.
 */

/** Primeiro nome com o tratamento: "Dra. Beatriz" (sem tratamento, só o primeiro nome). */
export function shortName(displayName: string): string {
  const parts = displayName.split(/\s+/);
  return /^(dr|dra)\.?$/i.test(parts[0] ?? '') ? parts.slice(0, 2).join(' ') : (parts[0] ?? displayName);
}

/** "psicóloga" ou "psicólogo", pelo tratamento do nome. */
export function psychologistRole(displayName: string): string {
  return /^dra\.?\s/i.test(displayName) ? 'psicóloga' : 'psicólogo';
}

/** "a Dra. Beatriz Nogueira" ou "o Dr. Rafael Moreira": a conversa é "com a Dra. ...". Outro nome fica como está. */
export function withArticle(name: string): string {
  if (/^Dra\.?\s/i.test(name)) {
    return `a ${name}`;
  }
  if (/^Dr\.?\s/i.test(name)) {
    return `o ${name}`;
  }
  return name;
}

/** "da Dra. Beatriz", "do Dr. Rafael" ou "de Rafael": de quem é algo ("Resposta da Dra. Beatriz"). */
export function withArticleOf(name: string): string {
  if (/^Dra\.?\s/i.test(name)) {
    return `da ${name}`;
  }
  if (/^Dr\.?\s/i.test(name)) {
    return `do ${name}`;
  }
  return `de ${name}`;
}

/** O primeiro nome de um nome completo ("Ana Paula Ferraz" vira "Ana"). */
export function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}
