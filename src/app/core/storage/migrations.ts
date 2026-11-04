/**
 * Versão de esquema e migrações dos dados guardados no navegador.
 *
 * Quando o formato de uma coleção mudar, incremente `SCHEMA_VERSION` e registre uma migração em
 * `MIGRATIONS` (de uma versão para a seguinte). O `StorageService` aplica a cadeia na inicialização.
 */

/** Versão atual do esquema dos dados (também gravada nas exportações JSON). */
export const SCHEMA_VERSION = '1';

/** Acesso restrito que uma migração recebe para ler e reescrever coleções. */
export interface MigrationContext {
  names(): string[];
  read(name: string): unknown;
  write(name: string, value: unknown): void;
  remove(name: string): void;
}

export interface Migration {
  from: string;
  to: string;
  description: string;
  run(ctx: MigrationContext): void;
}

/** Cadeia de migrações. Vazia enquanto o esquema é a versão 1. */
export const MIGRATIONS: readonly Migration[] = [];

export type MigrationPlan =
  | { kind: 'none' }
  | { kind: 'apply'; steps: readonly Migration[] }
  | { kind: 'unsupported'; reason: 'newer_than_app' | 'no_path' };

/** Compara versões `"1"`, `"1.2"`, `"2"` (numérico por segmento). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((s) => Number(s));
  const pb = b.split('.').map((s) => Number(s));
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

/** Calcula o caminho de migração de `from` até `to` (puro e testável). */
export function planMigrations(
  from: string,
  to: string = SCHEMA_VERSION,
  migrations: readonly Migration[] = MIGRATIONS,
): MigrationPlan {
  if (compareVersions(from, to) === 0) {
    return { kind: 'none' };
  }
  if (compareVersions(from, to) > 0) {
    return { kind: 'unsupported', reason: 'newer_than_app' };
  }
  const steps: Migration[] = [];
  let current = from;
  while (compareVersions(current, to) < 0) {
    const next = migrations.find((m) => m.from === current);
    if (!next) {
      return { kind: 'unsupported', reason: 'no_path' };
    }
    steps.push(next);
    current = next.to;
  }
  return { kind: 'apply', steps };
}
