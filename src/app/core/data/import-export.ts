/**
 * Exportação e importação JSON da base de demonstração (M15, AC-M15-02, AC-M15-03, RN-LGPD-18).
 * A importação é ATÔMICA: valida tudo antes e, se algo estiver errado, não altera nada.
 */
import { DemoState, ISODate, ISODateTime } from '../models';
import { isCpfChecksumValid, validateFictitiousEmail } from '../rules/validators';
import { SCHEMA_VERSION } from '../storage/migrations';
import {
  COLLECTION_NAMES,
  CollectionData,
  CollectionName,
  OPTIONAL_ON_IMPORT,
  SingletonTypes,
} from './collections';

export const EXPORT_APP_ID = 'nexus-erp';
export const EXPORT_FORMAT = 1;

export interface ExportEnvelope {
  app: typeof EXPORT_APP_ID;
  format: number;
  schemaVersion: string;
  exportedAt: ISODateTime;
  /** `management`: cópia da visão da gestão, pseudonimizada e sem dado clínico (QA-007). Sem o campo, é completa. */
  scope?: 'full' | 'management';
  clock: { demoToday: ISODate | null };
  demoState: DemoState | null;
  singletons: SingletonTypes;
  collections: CollectionData;
}

/** O arquivo não é uma cópia do sistema (QA-010): uma frase simples, sem nome de campo. */
const NOT_A_COPY =
  'Este arquivo não é uma cópia do Nexus ERP. Use um arquivo baixado em "Baixar cópia (JSON)".';

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
      errors.push(`${where}: este cadastro não está marcado com CPF fictício.`);
    }
    if (typeof item['cpf'] === 'string' && isCpfChecksumValid(item['cpf'])) {
      errors.push(`${where}: o CPF parece real. O protótipo só aceita CPF fictício.`);
    }
    if (typeof item['email'] === 'string' && !validateFictitiousEmail(item['email']).valid) {
      errors.push(`${where}: o e-mail está fora de @exemplo.com.br. O protótipo só aceita e-mail fictício.`);
    }
  }
  if (
    (name === 'users' || name === 'providers') &&
    typeof item['email'] === 'string' &&
    !validateFictitiousEmail(item['email']).valid
  ) {
    errors.push(`${where}: o e-mail está fora de @exemplo.com.br. O protótipo só aceita e-mail fictício.`);
  }
  return errors;
}

/** Valida o conteúdo de um arquivo de exportação (esquema, versão e dados fictícios). */
export function validateImport(raw: unknown): ImportValidation {
  const errors: string[] = [];
  if (!isRecord(raw)) {
    return { ok: false, errors: [NOT_A_COPY] };
  }
  if (raw['app'] !== EXPORT_APP_ID) {
    // Outro tipo de arquivo: não adianta listar o resto (QA-010).
    return { ok: false, errors: [NOT_A_COPY] };
  }
  if (raw['format'] !== EXPORT_FORMAT) {
    errors.push('Este arquivo está num formato que o sistema não reconhece. Baixe uma cópia nova e tente de novo.');
  }
  if (raw['schemaVersion'] !== SCHEMA_VERSION) {
    errors.push(
      typeof raw['schemaVersion'] === 'string'
        ? `Este arquivo veio de outra versão do sistema (a dele é a ${raw['schemaVersion']}, a atual é a ${SCHEMA_VERSION}). Baixe uma cópia nova e tente de novo.`
        : 'Este arquivo não diz de qual versão do sistema veio. Baixe uma cópia nova e tente de novo.',
    );
  }
  const collections = raw['collections'];
  if (!isRecord(collections)) {
    errors.push('Faltam os dados no arquivo (a parte com os cadastros).');
  } else {
    Object.keys(collections).forEach((key) => {
      if (!COLLECTION_NAMES.includes(key as CollectionName)) {
        errors.push(`O arquivo traz um grupo de dados que o sistema não conhece: "${key}".`);
      }
    });
    COLLECTION_NAMES.forEach((name) => {
      const list = collections[name];
      if (list === undefined && OPTIONAL_ON_IMPORT.includes(name)) {
        return;
      }
      if (!Array.isArray(list)) {
        errors.push(`Falta um grupo de dados no arquivo ou ele está danificado: "${name}".`);
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
          errors.push(`${name}[${index}]: há um registro incompleto (sem id ou sem as datas de criação e de alteração).`);
          return;
        }
        if (ids.has(item['id'])) {
          errors.push(`${name}[${index}]: o código interno "${item['id']}" aparece mais de uma vez.`);
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
    errors.push('Faltam os ajustes do sistema no arquivo (configurações, parâmetros financeiros e do piloto).');
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
    return { ok: false, errors: ['O arquivo não é um JSON válido. Use um arquivo baixado em "Baixar cópia (JSON)".'] };
  }
  return validateImport(parsed);
}
