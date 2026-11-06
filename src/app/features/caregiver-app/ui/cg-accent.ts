/**
 * As seções do aplicativo, cada uma com a sua tinta calma (docs/17-vida-kit.md). O shell marca a seção corrente em
 * `data-section` e tudo o que está dentro herda o acento; `accent` nos componentes do kit força outro (a Entrada, um
 * bloco de uma seção dentro de outra).
 */
export const CG_ACCENTS = ['hoje', 'rotina', 'cuidar', 'rede', 'mais'] as const;
export type CgAccent = (typeof CG_ACCENTS)[number];

/** A classe que força o acento (` cg-sec--rede`, com o espaço na frente), ou `''` para herdar o da seção corrente. */
export function accentClass(accent: CgAccent | null | undefined): string {
  return accent ? ` cg-sec--${accent}` : '';
}

/** A seção de uma rota do aplicativo (`/cuidador/rede/buscar` é `rede`); `null` fora das cinco seções. */
export function sectionOfUrl(url: string): CgAccent | null {
  const path = url.split(/[?#]/)[0] ?? '';
  const first = path.replace(/^\/cuidador\/?/, '').split('/')[0] ?? '';
  switch (first) {
    case 'hoje':
      return 'hoje';
    case 'rotina':
      return 'rotina';
    case 'cuidar-de-mim':
      return 'cuidar';
    case 'rede':
      return 'rede';
    case 'mais':
      return 'mais';
    default:
      return null;
  }
}
