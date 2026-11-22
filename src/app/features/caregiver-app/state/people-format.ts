import { ActivityLeader } from '../../../core/models';

/**
 * Como o aplicativo do cuidador fala de uma pessoa da equipe. Funções puras, a única fonte desses textos: Hoje, Agenda,
 * Conversar com um psicólogo e Como estou usam a mesma; ficam em `state/` para as áreas nunca importarem umas das outras.
 *
 * A equipe de psicologia aparece pelo nome, sem "Dr." nem "Dra." (decisão do dono, 22/11/2026). Sem tratamento, o
 * aplicativo não supõe gênero pelo nome: "com Isabelle", "de Isabelle", "da equipe de psicologia". Nomes que ainda têm
 * tratamento (profissionais da rede, por exemplo) continuam concordando com ele.
 */

/** Primeiro nome, com o tratamento quando houver: "Isabelle" ou "Dra. Renata". */
export function shortName(displayName: string): string {
  const parts = displayName.split(/\s+/);
  return /^(dr|dra)\.?$/i.test(parts[0] ?? '') ? parts.slice(0, 2).join(' ') : (parts[0] ?? displayName);
}

/** O papel na frase "Com Isabelle Ramos, da equipe de psicologia": neutro, sem gênero. */
export function psychologistRole(_displayName: string): string {
  return 'da equipe de psicologia';
}

/** "a Dra. Renata Sampaio" ou "o Dr. ..." quando há tratamento; sem tratamento, o nome como está ("com Isabelle"). */
export function withArticle(name: string): string {
  if (/^Dra\.?\s/i.test(name)) {
    return `a ${name}`;
  }
  if (/^Dr\.?\s/i.test(name)) {
    return `o ${name}`;
  }
  return name;
}

/** "da Dra. Renata", "do Dr. ..." ou "de Isabelle": de quem é algo ("Resposta de Isabelle"). */
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

/**
 * Quem conduz, curto, para o cartão e a lista: "Com Marina Gomes" ou "Com Enf. Priscila Gouveia". Tira o que vem entre
 * parênteses no nome ("(convidado)", "(profissional parceira)"). `null` sem condutor.
 */
export function leadersShort(leaders: readonly ActivityLeader[]): string | null {
  const names = leaders.map((l) => l.name.replace(/\s*\([^)]*\)\s*$/, '').trim()).filter((n) => n.length > 0);
  if (names.length === 0) {
    return null;
  }
  const last = names[names.length - 1];
  return `Com ${names.length === 1 ? last : `${names.slice(0, -1).join(', ')} e ${last}`}`;
}
