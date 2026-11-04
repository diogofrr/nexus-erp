/**
 * Navegação por teclado em listas de uma dimensão (abas, segmentado): setas, Home e End.
 * Devolve o índice que deve receber o foco, ou `null` se a tecla não é de navegação.
 * Pula itens desabilitados e dá a volta nas pontas.
 */
export function rovingIndex(
  key: string,
  current: number,
  count: number,
  isDisabled: (index: number) => boolean = () => false,
): number | null {
  if (count <= 0) {
    return null;
  }
  const step = (from: number, dir: 1 | -1): number => {
    let i = from;
    for (let n = 0; n < count; n += 1) {
      i = (i + dir + count) % count;
      if (!isDisabled(i)) {
        return i;
      }
    }
    return from;
  };
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return step(current, 1);
    case 'ArrowLeft':
    case 'ArrowUp':
      return step(current, -1);
    case 'Home':
      return isDisabled(0) ? step(0, 1) : 0;
    case 'End':
      return isDisabled(count - 1) ? step(count - 1, -1) : count - 1;
    default:
      return null;
  }
}
