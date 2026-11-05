/**
 * Como o aplicativo do cuidador fala de uma pessoa da equipe. Funções puras. Acrescentado por P1 (Hoje e Agenda
 * usam); fica em `state/` para as áreas nunca importarem umas das outras.
 */

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
