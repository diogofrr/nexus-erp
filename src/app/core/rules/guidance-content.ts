/**
 * Conteúdos de orientação vistos pelo cuidador (RN-USR-07, RN-PLN-04 e 05, RN-ETICA-05, RN-POP-09). Funções puras.
 *
 * - Só conteúdo PUBLICADO (aprovado pela equipe) aparece; rascunho e em revisão não.
 * - Os conteúdos exclusivos são do Essencial em diante; os demais são para todos. Para o Livre o exclusivo NÃO aparece
 *   (nem como vitrine, nem com cadeado: docs/20, regra de exibição 1).
 * - Cada conteúdo tem uma categoria (docs/20): a tela agrupa por seção e filtra por ela.
 * - A ordem é da mais nova para a mais antiga, igual para todos: nada é escolhido por pontuação, faixa, alerta ou ARBE
 *   (RN-PLN-19, RN-ZRT-09).
 */
import { GuidanceCategory, GuidanceContent } from '../models';

/** Palavras lidas por minuto (leitura calma, para quem está cansado). */
export const READING_WORDS_PER_MINUTE = 150;

/** As categorias, na ordem das seções da tela (docs/20: toda página é cabeçalho, seções e cartões). */
export const GUIDANCE_CATEGORIES: readonly GuidanceCategory[] = [
  'routine_organization',
  'self_care',
  'medication_health',
  'communication_with_elder',
  'rights_public_network',
];

export const GUIDANCE_CATEGORY_LABELS: Readonly<Record<GuidanceCategory, string>> = {
  routine_organization: 'Rotina e organização',
  self_care: 'Cuidar de você',
  medication_health: 'Remédios e saúde',
  communication_with_elder: 'Comunicação com a pessoa idosa',
  rights_public_network: 'Direitos e rede pública',
};

/** Os conteúdos agrupados por categoria, na ordem das seções; categorias vazias não entram. */
export function contentsByCategory<T extends Pick<GuidanceContent, 'category'>>(
  contents: readonly T[],
): { category: GuidanceCategory; label: string; items: T[] }[] {
  return GUIDANCE_CATEGORIES.flatMap((category) => {
    const items = contents.filter((c) => c.category === category);
    return items.length > 0 ? [{ category, label: GUIDANCE_CATEGORY_LABELS[category], items }] : [];
  });
}

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
