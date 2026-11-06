import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { MIGRATIONS, MigrationContext, SCHEMA_VERSION, planMigrations } from './migrations';
import {
  CROSS_TAB_SUBSCRIBE,
  CrossTabEvent,
  LOCAL_STORAGE_BACKEND,
  SESSION_STORAGE_BACKEND,
  StorageBackend,
} from './storage-tokens';

/** Prefixo de TODA chave guardada no navegador (AC-GL-03). */
export const STORAGE_PREFIX = 'nexus-erp:';

/** Chaves fixas fora das coleções. */
export const STORAGE_KEYS = {
  schemaVersion: 'schema-version',
  session: 'session',
  /** Sessão do cuidador (`sessionStorage`), separada da sessão da equipe. */
  caregiverSession: 'caregiver-session',
  /** Tamanho da letra do aplicativo do cuidador (Normal, Grande, Bem grande), guardado no navegador. */
  caregiverFontScale: 'caregiver-font-scale',
  /** Como o cuidador prefere ver a Agenda: calendário ou lista (guardado no navegador, não por pessoa). */
  caregiverAgendaView: 'caregiver-agenda-view',
  clock: 'clock',
  uiNotice: 'ui-notice',
  settings: 'settings',
  financialParams: 'financial-params',
  pilotConfig: 'pilot-config',
  demoState: 'demo-state',
} as const;

export type StorageArea = 'local' | 'session';

export type StorageNoticeKind =
  | 'unavailable'
  | 'quota_exceeded'
  | 'corrupted'
  | 'schema_newer_than_app'
  | 'schema_no_migration_path';

/** Aviso que a interface deve mostrar ao usuário (o armazenamento nunca lança erro). */
export interface StorageNotice {
  kind: StorageNoticeKind;
  /** Nome da chave (sem prefixo), quando aplicável. */
  name?: string;
  area: StorageArea;
  message: string;
}

export type WriteResult =
  | { ok: true; persisted: true }
  | { ok: true; persisted: false; reason: 'quota_exceeded' | 'unavailable' };

export interface StorageChange {
  /** Nome sem prefixo. */
  name: string;
  /** Valor JSON novo; `null` se foi removido. */
  newValue: string | null;
}

export interface StorageUsageItem {
  name: string;
  area: StorageArea;
  bytes: number;
}

export interface StorageUsage {
  totalBytes: number;
  items: StorageUsageItem[];
  mode: 'persistent' | 'memory';
}

const MESSAGES: Record<StorageNoticeKind, string> = {
  unavailable:
    'O armazenamento deste navegador está indisponível. Os dados ficam só em memória e somem ao recarregar a página.',
  quota_exceeded:
    'O espaço de armazenamento do navegador acabou. Os últimos dados ficam só em memória. Exporte a demonstração e limpe dados antigos.',
  corrupted: 'Um dado guardado no navegador estava corrompido e foi ignorado.',
  schema_newer_than_app:
    'Os dados guardados são de uma versão mais nova do sistema. Atualize a página ou resete a demonstração.',
  schema_no_migration_path:
    'Os dados guardados são de uma versão antiga sem caminho de migração. Resete a demonstração.',
};

/**
 * Serviço único de armazenamento (AC-GL-03). Nenhum outro código toca o armazenamento do navegador.
 *
 * - Chaves sempre com o prefixo `nexus-erp:`; os métodos recebem o nome SEM prefixo.
 * - Leitura segura: JSON inválido devolve o valor padrão (e gera um aviso).
 * - Escrita segura: cota cheia ou armazenamento indisponível NUNCA lançam erro; o dado cai para
 *   memória e o serviço publica um aviso em `notices`.
 * - Evento entre abas: `changes$` emite quando outra aba grava uma chave `nexus-erp:`.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly localBackend = inject(LOCAL_STORAGE_BACKEND);
  private readonly sessionBackend = inject(SESSION_STORAGE_BACKEND);
  private readonly subscribeCrossTab = inject(CROSS_TAB_SUBSCRIBE);

  /** Dados que não puderam ser persistidos (ou sem backend): vivem só nesta aba. */
  private readonly memory: Record<StorageArea, Map<string, string>> = {
    local: new Map<string, string>(),
    session: new Map<string, string>(),
  };

  private readonly noticesSignal = signal<readonly StorageNotice[]>([]);
  private readonly modeSignal = signal<'persistent' | 'memory'>(
    this.localBackend ? 'persistent' : 'memory',
  );
  private readonly changesSubject = new Subject<StorageChange>();

  /** Avisos ativos (sem duplicatas de tipo e chave). */
  readonly notices = this.noticesSignal.asReadonly();
  /** `memory` quando o `localStorage` está indisponível ou alguma gravação caiu para memória. */
  readonly mode = this.modeSignal.asReadonly();
  readonly isPersistent = computed(() => this.modeSignal() === 'persistent');
  /** Mudanças feitas por OUTRAS abas. */
  readonly changes$: Observable<StorageChange> = this.changesSubject.asObservable();

  constructor() {
    if (!this.localBackend) {
      this.pushNotice({ kind: 'unavailable', area: 'local', message: MESSAGES.unavailable });
    }
    const unsubscribe = this.subscribeCrossTab((event) => this.handleCrossTab(event));
    inject(DestroyRef).onDestroy(unsubscribe);
  }

  // ===== Dados persistentes (localStorage) =====

  readLocal<T>(name: string, fallback: T): T {
    return this.read('local', name, fallback);
  }

  writeLocal(name: string, value: unknown): WriteResult {
    return this.write('local', name, value);
  }

  removeLocal(name: string): void {
    this.remove('local', name);
  }

  hasLocal(name: string): boolean {
    return this.rawGet('local', name) !== null;
  }

  // ===== Sessão (sessionStorage) =====

  readSession<T>(name: string, fallback: T): T {
    return this.read('session', name, fallback);
  }

  writeSession(name: string, value: unknown): WriteResult {
    return this.write('session', name, value);
  }

  removeSession(name: string): void {
    this.remove('session', name);
  }

  // ===== Inventário, uso e limpeza =====

  /** Nomes (sem prefixo) das chaves persistentes. */
  listLocalNames(): string[] {
    return this.listNames('local');
  }

  /** Tamanho ocupado, por chave (UTF-16: 2 bytes por caractere, como o navegador conta a cota). */
  usage(): StorageUsage {
    const items: StorageUsageItem[] = [];
    (['local', 'session'] as const).forEach((area) => {
      this.listNames(area).forEach((name) => {
        const raw = this.rawGet(area, name) ?? '';
        items.push({ name, area, bytes: (STORAGE_PREFIX.length + name.length + raw.length) * 2 });
      });
    });
    return {
      totalBytes: items.reduce((sum, i) => sum + i.bytes, 0),
      items: items.sort((a, b) => b.bytes - a.bytes),
      mode: this.modeSignal(),
    };
  }

  /** Apaga TODAS as chaves `nexus-erp:` (local, sessão e memória). Usado por "apagar tudo" (M12-10, M15). */
  clearAll(): void {
    (['local', 'session'] as const).forEach((area) => {
      this.listNames(area).forEach((name) => this.remove(area, name));
      this.memory[area].clear();
    });
    this.noticesSignal.set([]);
    this.modeSignal.set(this.localBackend ? 'persistent' : 'memory');
    if (!this.localBackend) {
      this.pushNotice({ kind: 'unavailable', area: 'local', message: MESSAGES.unavailable });
    }
  }

  /** Remove avisos já mostrados. */
  dismissNotice(notice: StorageNotice): void {
    this.noticesSignal.update((list) => list.filter((n) => n !== notice));
  }

  // ===== Versão de esquema e migração =====

  /** Versão de esquema guardada (`null` se nunca gravada). */
  storedSchemaVersion(): string | null {
    const raw = this.rawGet('local', STORAGE_KEYS.schemaVersion);
    if (raw === null) {
      return null;
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      return typeof parsed === 'string' ? parsed : null;
    } catch {
      return null;
    }
  }

  /**
   * Garante que os dados guardados estão na versão atual. Chame uma vez na inicialização.
   * Devolve `true` se os dados são utilizáveis.
   */
  ensureSchema(): boolean {
    const stored = this.storedSchemaVersion();
    if (stored === null) {
      this.write('local', STORAGE_KEYS.schemaVersion, SCHEMA_VERSION);
      return true;
    }
    const plan = planMigrations(stored, SCHEMA_VERSION, MIGRATIONS);
    if (plan.kind === 'none') {
      return true;
    }
    if (plan.kind === 'unsupported') {
      this.pushNotice({
        kind:
          plan.reason === 'newer_than_app' ? 'schema_newer_than_app' : 'schema_no_migration_path',
        area: 'local',
        message:
          plan.reason === 'newer_than_app'
            ? MESSAGES.schema_newer_than_app
            : MESSAGES.schema_no_migration_path,
      });
      return false;
    }
    const ctx: MigrationContext = {
      names: () => this.listNames('local'),
      read: (name) => this.read<unknown>('local', name, null),
      write: (name, value) => void this.write('local', name, value),
      remove: (name) => this.remove('local', name),
    };
    plan.steps.forEach((step) => step.run(ctx));
    this.write('local', STORAGE_KEYS.schemaVersion, SCHEMA_VERSION);
    return true;
  }

  // ===== Eventos entre abas =====

  /** Exposto para testes: simula um evento `storage` de outra aba. */
  handleCrossTab(event: CrossTabEvent): void {
    if (!event.isLocal) {
      return;
    }
    if (event.key === null) {
      // `localStorage.clear()` em outra aba.
      this.changesSubject.next({ name: '*', newValue: null });
      return;
    }
    if (!event.key.startsWith(STORAGE_PREFIX)) {
      return;
    }
    const name = event.key.slice(STORAGE_PREFIX.length);
    // O valor mais novo está no armazenamento real: descarta qualquer cópia em memória defasada.
    this.memory.local.delete(name);
    this.changesSubject.next({ name, newValue: event.newValue });
  }

  // ===== Internos =====

  private backend(area: StorageArea): StorageBackend | null {
    return area === 'local' ? this.localBackend : this.sessionBackend;
  }

  private rawGet(area: StorageArea, name: string): string | null {
    const inMemory = this.memory[area].get(name);
    if (inMemory !== undefined) {
      return inMemory;
    }
    const backend = this.backend(area);
    if (!backend) {
      return null;
    }
    try {
      return backend.getItem(STORAGE_PREFIX + name);
    } catch {
      return null;
    }
  }

  private read<T>(area: StorageArea, name: string, fallback: T): T {
    const raw = this.rawGet(area, name);
    if (raw === null) {
      return fallback;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      this.pushNotice({ kind: 'corrupted', name, area, message: MESSAGES.corrupted });
      return fallback;
    }
  }

  private write(area: StorageArea, name: string, value: unknown): WriteResult {
    let raw: string;
    try {
      raw = JSON.stringify(value);
    } catch {
      // Valor não serializável (ciclo): trata como falha de persistência, sem derrubar a aplicação.
      this.pushNotice({ kind: 'corrupted', name, area, message: MESSAGES.corrupted });
      return { ok: true, persisted: false, reason: 'unavailable' };
    }
    const backend = this.backend(area);
    if (!backend) {
      this.memory[area].set(name, raw);
      this.modeSignal.set('memory');
      return { ok: true, persisted: false, reason: 'unavailable' };
    }
    try {
      backend.setItem(STORAGE_PREFIX + name, raw);
      this.memory[area].delete(name);
      return { ok: true, persisted: true };
    } catch {
      this.memory[area].set(name, raw);
      this.modeSignal.set('memory');
      this.pushNotice({ kind: 'quota_exceeded', name, area, message: MESSAGES.quota_exceeded });
      return { ok: true, persisted: false, reason: 'quota_exceeded' };
    }
  }

  private remove(area: StorageArea, name: string): void {
    this.memory[area].delete(name);
    const backend = this.backend(area);
    if (!backend) {
      return;
    }
    try {
      backend.removeItem(STORAGE_PREFIX + name);
    } catch {
      // Remoção que falha não tem efeito prático; segue sem aviso.
    }
  }

  private listNames(area: StorageArea): string[] {
    const names = new Set<string>();
    this.memory[area].forEach((_value, name) => names.add(name));
    const backend = this.backend(area);
    if (backend) {
      try {
        for (let i = 0; i < backend.length; i += 1) {
          const key = backend.key(i);
          if (key !== null && key.startsWith(STORAGE_PREFIX)) {
            names.add(key.slice(STORAGE_PREFIX.length));
          }
        }
      } catch {
        // Sem acesso à lista: devolve só o que está em memória.
      }
    }
    return [...names].sort();
  }

  private pushNotice(notice: StorageNotice): void {
    this.noticesSignal.update((list) =>
      list.some((n) => n.kind === notice.kind && n.name === notice.name && n.area === notice.area)
        ? list
        : [...list, notice],
    );
  }
}
