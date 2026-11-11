/**
 * Versão de esquema e migrações dos dados guardados no navegador.
 *
 * Quando o formato de uma coleção mudar, incremente `SCHEMA_VERSION` e registre uma migração em
 * `MIGRATIONS` (de uma versão para a seguinte). O `StorageService` aplica a cadeia na inicialização.
 */

/** Versão atual do esquema dos dados (também gravada nas exportações JSON). */
export const SCHEMA_VERSION = '2';

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

type Row = Record<string, unknown>;

function rows(ctx: MigrationContext, name: string): Row[] | null {
  const value = ctx.read(name);
  return Array.isArray(value) ? (value as Row[]) : null;
}

/** Categoria padrão dos conteúdos antigos (sem categoria): rotina e organização. */
const DEFAULT_CONTENT_CATEGORY = 'routine_organization';

/**
 * v1 para v2 (docs/20-regras-planos-v2.md): os tipos de atividade viram `open_circle | training | group_therapy`
 * (`support_group` vira `group_therapy`, `open_conversation_circle` vira `open_circle`); a terapia de grupo é do Cuida em
 * diante e a capacitação passa a valer para todos (`minPlan` refeito, `requiresEligibility` falso); as inscrições e as
 * sessões ganham `includedInPlan` (sessão de R$ 0,00 = incluída); os conteúdos ganham `category`.
 */
export const MIGRATION_V1_TO_V2: Migration = {
  from: '1',
  to: '2',
  description: 'Tipos de encontro, cotas por plano e categorias de conteúdo (docs/20).',
  run(ctx) {
    const activities = rows(ctx, 'activities');
    const kindOf = new Map<string, string>();
    if (activities) {
      ctx.write(
        'activities',
        activities.map((a) => {
          const kind = a['kind'] === 'support_group' ? 'group_therapy' : a['kind'] === 'open_conversation_circle' ? 'open_circle' : a['kind'];
          kindOf.set(String(a['id']), String(kind));
          return { ...a, kind, minPlan: kind === 'group_therapy' ? 'cuida' : null, requiresEligibility: false };
        }),
      );
    }
    const enrollments = rows(ctx, 'activityEnrollments');
    if (enrollments) {
      ctx.write(
        'activityEnrollments',
        enrollments.map((e) => {
          const kind = kindOf.get(String(e['activityId']));
          const counts = kind === 'group_therapy' || kind === 'training';
          return e['includedInPlan'] === undefined ? { ...e, includedInPlan: counts && e['paid'] !== true } : e;
        }),
      );
    }
    const sessions = rows(ctx, 'careSessions');
    if (sessions) {
      ctx.write(
        'careSessions',
        sessions.map((s) => (s['includedInPlan'] === undefined ? { ...s, includedInPlan: s['priceCents'] === 0 } : s)),
      );
    }
    const contents = rows(ctx, 'guidanceContents');
    if (contents) {
      ctx.write(
        'guidanceContents',
        contents.map((c) => (c['category'] === undefined ? { ...c, category: DEFAULT_CONTENT_CATEGORY } : c)),
      );
    }
  },
};

/** Cadeia de migrações. */
export const MIGRATIONS: readonly Migration[] = [MIGRATION_V1_TO_V2];

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
