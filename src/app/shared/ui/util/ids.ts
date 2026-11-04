let counter = 0;

/** Id único e estável por execução, para ligar rótulo, dica e erro (`aria-describedby`). */
export function uniqueId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}
