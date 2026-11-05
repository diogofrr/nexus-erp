/**
 * Conteúdos de orientação vistos pelo cuidador (RN-USR-07, RN-PLN-04 e 05, RN-ETICA-05, RN-POP-09). Funções puras.
 *
 * - Só conteúdo PUBLICADO (aprovado pela equipe) aparece; rascunho e em revisão não.
 * - Os conteúdos exclusivos são do Essencial em diante; os demais são para todos.
 * - A ordem é da mais nova para a mais antiga, igual para todos: nada é escolhido por pontuação, faixa, alerta ou ARBE
 *   (RN-PLN-19, RN-ZRT-09).
 */
import { GuidanceContent } from '../models';

/** Palavras lidas por minuto (leitura calma, para quem está cansado). */
export const READING_WORDS_PER_MINUTE = 150;

/** Conteúdos publicados, do mais novo ao mais antigo (aprovação, senão criação; empate pelo id, o maior primeiro). */
export function publishedContents(contents: readonly GuidanceContent[]): GuidanceContent[] {
  const stamp = (c: GuidanceContent): string => c.approvedAt ?? c.createdAt;
  return contents
    .filter((c) => c.status === 'published')
    .sort((a, b) => stamp(b).localeCompare(stamp(a)) || b.id.localeCompare(a.id));
}

/** O cuidador pode ler este conteúdo? Exclusivo só com o plano que o inclui (`canSeeExclusive`). */
export function canReadContent(content: Pick<GuidanceContent, 'status' | 'exclusive'>, canSeeExclusive: boolean): boolean {
  return content.status === 'published' && (!content.exclusive || canSeeExclusive);
}

/** Minutos de leitura (no mínimo 1): "Leitura de 3 minutos". */
export function readingMinutes(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / READING_WORDS_PER_MINUTE));
}

/** "Leitura de 1 minuto" ou "Leitura de 3 minutos". */
export function readingTimeLabel(body: string): string {
  const minutes = readingMinutes(body);
  return `Leitura de ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
}

/** Parágrafos do texto (separados por linha em branco; uma linha só vira um parágrafo). */
export function contentParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
