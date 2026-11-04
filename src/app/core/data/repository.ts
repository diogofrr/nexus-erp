import { Signal, computed, signal } from '@angular/core';
import { Clock } from '../clock/clock.service';
import { Audited, ID } from '../models/primitives';
import { StorageService } from '../storage/storage.service';

/** Campos que o repositório preenche sozinho. */
export type ManagedFields = 'id' | 'createdAt' | 'updatedAt';

/** O que se passa ao criar: a entidade sem os campos gerenciados (o `id` é opcional, para seeds). */
export type NewEntity<T extends Audited> = Omit<T, ManagedFields> & { id?: ID };

/** O que se passa ao atualizar: qualquer campo, menos os gerenciados. */
export type EntityPatch<T extends Audited> = Partial<Omit<T, ManagedFields>>;

export class EntityNotFoundError extends Error {
  constructor(collection: string, id: ID) {
    super(`Registro "${id}" não encontrado em "${collection}".`);
    this.name = 'EntityNotFoundError';
  }
}

export class DuplicateEntityError extends Error {
  constructor(collection: string, id: ID) {
    super(`Já existe um registro "${id}" em "${collection}".`);
    this.name = 'DuplicateEntityError';
  }
}

/** Operações administrativas usadas pelo `Database` (seed, reset, importação, exportação). */
export interface RepositoryAdmin {
  readonly collection: string;
  /** Troca TODO o conteúdo (sem validar) e persiste. */
  replaceAll(items: readonly unknown[]): void;
  /** Apaga todo o conteúdo e persiste. */
  clear(): void;
  /** Cópia dos itens para exportação. */
  snapshot(): readonly unknown[];
  /** Relê do armazenamento (mudança feita por outra aba). */
  reload(): void;
}

export interface RepositoryConfig {
  /** Nome da coleção (chave `nexus-erp:<collection>`). */
  collection: string;
  /** Prefixo dos IDs gerados (`cg` gera `cg_0001`). */
  idPrefix: string;
}

/** Leitura reativa sobre signals + persistência. Base de `EntityRepository` e `AppendOnlyRepository`. */
export abstract class ReadableRepository<T extends Audited> implements RepositoryAdmin {
  readonly collection: string;
  protected readonly idPrefix: string;
  private readonly store: ReturnType<typeof signal<readonly T[]>>;
  private readonly index = computed(() => new Map(this.store().map((e) => [e.id, e] as const)));
  private seq = -1;

  /** Todos os registros, como signal somente leitura. */
  readonly all: Signal<readonly T[]>;
  /** Quantidade de registros, reativa. */
  readonly size: Signal<number>;

  protected constructor(
    protected readonly storage: StorageService,
    protected readonly clock: Clock,
    config: RepositoryConfig,
  ) {
    this.collection = config.collection;
    this.idPrefix = config.idPrefix;
    this.store = signal<readonly T[]>(this.load());
    this.all = this.store.asReadonly();
    this.size = computed(() => this.store().length);
  }

  // ===== Leitura =====

  list(): readonly T[] {
    return this.store();
  }

  get(id: ID): T | undefined {
    return this.index().get(id);
  }

  /** Como `get`, mas lança `EntityNotFoundError` se não existir. */
  require(id: ID): T {
    const found = this.get(id);
    if (!found) {
      throw new EntityNotFoundError(this.collection, id);
    }
    return found;
  }

  exists(id: ID): boolean {
    return this.index().has(id);
  }

  query(predicate: (entity: T) => boolean): T[] {
    return this.store().filter(predicate);
  }

  find(predicate: (entity: T) => boolean): T | undefined {
    return this.store().find(predicate);
  }

  count(predicate?: (entity: T) => boolean): number {
    return predicate ? this.store().filter(predicate).length : this.store().length;
  }

  /** Signal derivado com os registros que passam no filtro (reativo a qualquer mudança da coleção). */
  watch(predicate?: (entity: T) => boolean): Signal<readonly T[]> {
    return computed(() => (predicate ? this.store().filter(predicate) : this.store()));
  }

  /** Signal derivado de UM registro. */
  watchOne(id: ID): Signal<T | undefined> {
    return computed(() => this.index().get(id));
  }

  // ===== Administração =====

  replaceAll(items: readonly unknown[]): void {
    this.commit(items as readonly T[]);
    this.seq = -1;
  }

  clear(): void {
    this.commit([]);
    this.seq = -1;
  }

  snapshot(): readonly T[] {
    return this.store();
  }

  reload(): void {
    this.store.set(this.load());
    this.seq = -1;
  }

  // ===== Internos =====

  protected commit(next: readonly T[]): void {
    this.store.set(next);
    this.storage.writeLocal(this.collection, next);
  }

  protected nextId(): ID {
    if (this.seq < 0) {
      this.seq = this.store().reduce((max, e) => {
        const m = /(\d+)$/.exec(e.id);
        return m ? Math.max(max, Number(m[1])) : max;
      }, 0);
    }
    let id: ID;
    do {
      this.seq += 1;
      id = `${this.idPrefix}_${String(this.seq).padStart(4, '0')}`;
    } while (this.index().has(id));
    return id;
  }

  protected buildEntity(draft: NewEntity<T>): T {
    const now = this.clock.now();
    const id = draft.id ?? this.nextId();
    if (draft.id !== undefined && this.index().has(draft.id)) {
      throw new DuplicateEntityError(this.collection, draft.id);
    }
    return { ...draft, id, createdAt: now, updatedAt: now } as unknown as T;
  }

  private load(): readonly T[] {
    const stored = this.storage.readLocal<unknown>(this.collection, []);
    return Array.isArray(stored) ? (stored as T[]) : [];
  }
}

/** Repositório completo: listar, obter, criar, atualizar, remover, consultar, contar e observar. */
export class EntityRepository<T extends Audited> extends ReadableRepository<T> {
  constructor(storage: StorageService, clock: Clock, config: RepositoryConfig) {
    super(storage, clock, config);
  }

  create(draft: NewEntity<T>): T {
    const entity = this.buildEntity(draft);
    this.commit([...this.list(), entity]);
    return entity;
  }

  /** Cria vários de uma vez e grava uma única vez. */
  createMany(drafts: readonly NewEntity<T>[]): T[] {
    const created: T[] = [];
    const pending = [...this.list()];
    const ids = new Set(pending.map((e) => e.id));
    drafts.forEach((draft) => {
      const entity = this.buildEntity(draft);
      if (ids.has(entity.id)) {
        throw new DuplicateEntityError(this.collection, entity.id);
      }
      ids.add(entity.id);
      pending.push(entity);
      created.push(entity);
    });
    this.commit(pending);
    return created;
  }

  update(id: ID, patch: EntityPatch<T>): T {
    const current = this.require(id);
    const updated = {
      ...current,
      ...patch,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: this.clock.now(),
    } as T;
    this.commit(this.list().map((e) => (e.id === id ? updated : e)));
    return updated;
  }

  /** Atualiza com uma função (útil para contadores e listas). */
  updateWith(id: ID, mutate: (current: T) => EntityPatch<T>): T {
    return this.update(id, mutate(this.require(id)));
  }

  /** Atualiza vários registros que passam no filtro e grava uma única vez. Devolve quantos mudaram. */
  updateWhere(
    predicate: (entity: T) => boolean,
    patch: EntityPatch<T> | ((entity: T) => EntityPatch<T>),
  ): number {
    const now = this.clock.now();
    let changed = 0;
    const next = this.list().map((e) => {
      if (!predicate(e)) {
        return e;
      }
      changed += 1;
      const p = typeof patch === 'function' ? patch(e) : patch;
      return { ...e, ...p, id: e.id, createdAt: e.createdAt, updatedAt: now } as T;
    });
    if (changed > 0) {
      this.commit(next);
    }
    return changed;
  }

  /** Insere ou substitui pelo `id`. */
  upsert(entity: T): T {
    const exists = this.exists(entity.id);
    const next = { ...entity, updatedAt: this.clock.now() } as T;
    this.commit(
      exists ? this.list().map((e) => (e.id === entity.id ? next : e)) : [...this.list(), next],
    );
    return next;
  }

  remove(id: ID): boolean {
    if (!this.exists(id)) {
      return false;
    }
    this.commit(this.list().filter((e) => e.id !== id));
    return true;
  }

  /** Remove todos que passam no filtro. Devolve quantos foram removidos. */
  removeWhere(predicate: (entity: T) => boolean): number {
    const before = this.list().length;
    const next = this.list().filter((e) => !predicate(e));
    if (next.length !== before) {
      this.commit(next);
    }
    return before - next.length;
  }
}

/**
 * Repositório APPEND-ONLY (log de auditoria e eventos de consentimento): só `append`.
 * Não existe `update` nem `remove`: o histórico não se edita (LP-04, LP-15).
 */
export class AppendOnlyRepository<T extends Audited> extends ReadableRepository<T> {
  constructor(storage: StorageService, clock: Clock, config: RepositoryConfig) {
    super(storage, clock, config);
  }

  append(draft: NewEntity<T>): T {
    const entity = this.buildEntity(draft);
    this.commit([...this.list(), entity]);
    return entity;
  }

  appendMany(drafts: readonly NewEntity<T>[]): T[] {
    const built: T[] = [];
    const ids = new Set(this.list().map((e) => e.id));
    drafts.forEach((draft) => {
      const entity = this.buildEntity(draft);
      if (ids.has(entity.id)) {
        throw new DuplicateEntityError(this.collection, entity.id);
      }
      ids.add(entity.id);
      built.push(entity);
    });
    this.commit([...this.list(), ...built]);
    return built;
  }
}

/** Documento único persistido (configurações, parâmetros financeiros). */
export class SingletonStore<T extends object> {
  private readonly state: ReturnType<typeof signal<T>>;
  readonly value: Signal<T>;

  constructor(
    private readonly storage: StorageService,
    readonly key: string,
    private readonly defaults: () => T,
  ) {
    this.state = signal<T>(this.load());
    this.value = this.state.asReadonly();
  }

  get(): T {
    return this.state();
  }

  set(next: T): void {
    this.state.set(next);
    this.storage.writeLocal(this.key, next);
  }

  patch(partial: Partial<T>): T {
    const next = { ...this.state(), ...partial };
    this.set(next);
    return next;
  }

  /** Volta aos valores padrão. */
  reset(): T {
    const next = this.defaults();
    this.set(next);
    return next;
  }

  reload(): void {
    this.state.set(this.load());
  }

  clear(): void {
    this.state.set(this.defaults());
    this.storage.removeLocal(this.key);
  }

  private load(): T {
    const stored = this.storage.readLocal<T | null>(this.key, null);
    return stored && typeof stored === 'object'
      ? { ...this.defaults(), ...stored }
      : this.defaults();
  }
}
