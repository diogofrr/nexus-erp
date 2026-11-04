/**
 * Exportação e importação JSON da base de demonstração (M15, AC-M15-02, AC-M15-03, RN-LGPD-18).
 * A importação é ATÔMICA: valida tudo antes e, se algo estiver errado, não altera nada.
 */
import { DemoState, ISODate, ISODateTime } from '../models';
import { isCpfChecksumValid, validateFictitiousEmail } from '../rules/validators';
import { SCHEMA_VERSION } from '../storage/migrations';
import { COLLECTION_NAMES, CollectionData, CollectionName, SingletonTypes } from './collections';

export const EXPORT_APP_ID = 'nexus-erp';
export const EXPORT_FORMAT = 1;

export interface ExportEnvelope {
  app: typeof EXPORT_APP_ID;
  format: number;
  schemaVersion: string;
  exportedAt: ISODateTime;
  clock: { demoToday: ISODate | null };
  demoState: DemoState | null;
  singletons: SingletonTypes;
  collections: CollectionData;
}

export type ImportValidation =
  { ok: true; envelope: ExportEnvelope } | { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Entidades com checagem de dados fictícios (LP-02): nada de dado real entra por importação. */
function checkSpecificShape(
  name: CollectionName,
  item: Record<string, unknown>,
  index: number,
): string[] {
  const where = `${name}[${index}]`;
  const errors: string[] = [];
  if (name === 'caregivers') {
    if (item['cpfIsFictitious'] !== true) {
      errors.push(`${where}: cpfIsFictitious deve ser true.`);
    }
    if (typeof item['cpf'] === 'string' && isCpfChecksumValid(item['cpf'])) {
      errors.push(`${where}: o CPF parece real; use CPF fictício.`);
    }
    if (typeof item['email'] === 'string' && !validateFictitiousEmail(item['email']).valid) {
      errors.push(`${where}: e-mail fora de @exemplo.com.br.`);
    }
  }
  if (
    (name === 'users' || name === 'providers') &&
    typeof item['email'] === 'string' &&
    !validateFictitiousEmail(item['email']).valid
  ) {
    errors.push(`${where}: e-mail fora de @exemplo.com.br.`);
  }
  return errors;
}

/** Valida o conteúdo de um arquivo de exportação (esquema, versão e dados fictícios). */
export function validateImport(raw: unknown): ImportValidation {
  const errors: string[] = [];
  if (!isRecord(raw)) {
    return { ok: false, errors: ['O arquivo não é um JSON de exportação do Nexus ERP.'] };
  }
  if (raw['app'] !== EXPORT_APP_ID) {
    errors.push('O arquivo não foi gerado pelo Nexus ERP.');
  }
  if (raw['format'] !== EXPORT_FORMAT) {
    errors.push(`Formato de arquivo não suportado (esperado ${EXPORT_FORMAT}).`);
  }
  if (raw['schemaVersion'] !== SCHEMA_VERSION) {
    errors.push(
      `Versão de esquema incompatível: o arquivo é "${String(raw['schemaVersion'])}" e o sistema usa "${SCHEMA_VERSION}".`,
    );
  }
  const collections = raw['collections'];
  if (!isRecord(collections)) {
    errors.push('O arquivo não tem a seção "collections".');
  } else {
    Object.keys(collections).forEach((key) => {
      if (!COLLECTION_NAMES.includes(key as CollectionName)) {
        errors.push(`Coleção desconhecida: "${key}".`);
      }
    });
    COLLECTION_NAMES.forEach((name) => {
      const list = collections[name];
      if (!Array.isArray(list)) {
        errors.push(`Coleção ausente ou inválida: "${name}".`);
        return;
      }
      const ids = new Set<string>();
      list.forEach((item: unknown, index: number) => {
        if (
          !isRecord(item) ||
          typeof item['id'] !== 'string' ||
          typeof item['createdAt'] !== 'string' ||
          typeof item['updatedAt'] !== 'string'
        ) {
          errors.push(`${name}[${index}]: registro sem id, createdAt ou updatedAt.`);
          return;
        }
        if (ids.has(item['id'])) {
          errors.push(`${name}[${index}]: id repetido "${item['id']}".`);
        }
        ids.add(item['id']);
        errors.push(...checkSpecificShape(name, item, index));
      });
    });
  }
  const singletons = raw['singletons'];
  if (
    !isRecord(singletons) ||
    !isRecord(singletons['settings']) ||
    !isRecord(singletons['financialParams']) ||
    !isRecord(singletons['pilotConfig'])
  ) {
    errors.push('Faltam os parâmetros (settings, financialParams, pilotConfig).');
  }
  if (errors.length > 0) {
    // Mostra no máximo 12 mensagens para não afogar a interface.
    return { ok: false, errors: errors.slice(0, 12) };
  }
  return { ok: true, envelope: raw as unknown as ExportEnvelope };
}

/** Lê o texto do arquivo e valida. JSON inválido vira erro, nunca exceção. */
export function parseImport(text: string): ImportValidation {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['O arquivo não é um JSON válido.'] };
  }
  return validateImport(parsed);
}
