import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { CrossTabBus, FakeStorage } from '../testing/test-helpers';
import {
  MIGRATIONS,
  Migration,
  SCHEMA_VERSION,
  compareVersions,
  planMigrations,
} from './migrations';
import { STORAGE_PREFIX, StorageService } from './storage.service';
import {
  CROSS_TAB_SUBSCRIBE,
  LOCAL_STORAGE_BACKEND,
  SESSION_STORAGE_BACKEND,
} from './storage-tokens';

function setup(options: { local?: FakeStorage | null; session?: FakeStorage | null } = {}): {
  service: StorageService;
  local: FakeStorage;
  session: FakeStorage;
  bus: CrossTabBus;
} {
  const local = options.local === undefined ? new FakeStorage() : options.local;
  const session = options.session === undefined ? new FakeStorage() : options.session;
  const bus = new CrossTabBus();
  TestBed.configureTestingModule({
    providers: [
      { provide: LOCAL_STORAGE_BACKEND, useValue: local },
      { provide: SESSION_STORAGE_BACKEND, useValue: session },
      { provide: CROSS_TAB_SUBSCRIBE, useValue: bus.subscribe },
    ],
  });
  return {
    service: TestBed.inject(StorageService),
    local: local as FakeStorage,
    session: session as FakeStorage,
    bus,
  };
}

describe('StorageService: chaves e leitura segura', () => {
  it('toda chave leva o prefixo nexus-erp: (AC-GL-03)', () => {
    const { service, local, session } = setup();
    service.writeLocal('caregivers', [{ id: 'cg_1' }]);
    service.writeSession('session', { userId: 'u1' });
    expect([...local.data.keys()]).toEqual(['nexus-erp:caregivers']);
    expect([...session.data.keys()]).toEqual(['nexus-erp:session']);
    expect(STORAGE_PREFIX).toBe('nexus-erp:');
  });

  it('lê o que gravou e devolve o padrão quando não há nada', () => {
    const { service } = setup();
    expect(service.readLocal('x', 42)).toBe(42);
    service.writeLocal('x', { a: [1, 2] });
    expect(service.readLocal('x', null)).toEqual({ a: [1, 2] });
    expect(service.hasLocal('x')).toBe(true);
    service.removeLocal('x');
    expect(service.hasLocal('x')).toBe(false);
  });

  it('JSON corrompido devolve o padrão e gera aviso, sem lançar erro', () => {
    const { service, local } = setup();
    local.data.set('nexus-erp:broken', '{nao eh json');
    expect(service.readLocal('broken', ['padrao'])).toEqual(['padrao']);
    expect(service.notices().some((n) => n.kind === 'corrupted' && n.name === 'broken')).toBe(true);
  });

  it('valores não serializáveis não derrubam a aplicação', () => {
    const { service } = setup();
    const cyclic: Record<string, unknown> = {};
    cyclic['self'] = cyclic;
    expect(service.writeLocal('ciclo', cyclic)).toMatchObject({ ok: true, persisted: false });
  });
});

describe('StorageService: cota cheia e armazenamento indisponível', () => {
  it('cota cheia cai para memória, avisa e continua lendo o dado', () => {
    const { service, local } = setup();
    local.quotaChars = 60;
    const result = service.writeLocal('grande', 'x'.repeat(200));
    expect(result).toEqual({ ok: true, persisted: false, reason: 'quota_exceeded' });
    expect(service.mode()).toBe('memory');
    expect(service.isPersistent()).toBe(false);
    expect(service.notices().some((n) => n.kind === 'quota_exceeded')).toBe(true);
    expect(service.readLocal('grande', '')).toBe('x'.repeat(200));
    expect(local.data.has('nexus-erp:grande')).toBe(false);
  });

  it('uma gravação que volta a caber persiste de novo e sai da memória', () => {
    const { service, local } = setup();
    local.quotaChars = 60;
    service.writeLocal('k', 'x'.repeat(200));
    local.quotaChars = null;
    expect(service.writeLocal('k', 'ok')).toEqual({ ok: true, persisted: true });
    expect(local.data.get('nexus-erp:k')).toBe('"ok"');
  });

  it('armazenamento bloqueado (exceção em setItem) também cai para memória', () => {
    const { service, local } = setup();
    local.failOnSet = true;
    expect(service.writeLocal('a', 1)).toMatchObject({ persisted: false });
    expect(service.readLocal('a', 0)).toBe(1);
  });

  it('sem armazenamento (modo privado restrito): tudo em memória e aviso de indisponível', () => {
    const { service } = setup({ local: null, session: null });
    expect(service.mode()).toBe('memory');
    expect(service.notices().some((n) => n.kind === 'unavailable')).toBe(true);
    expect(service.writeLocal('dados', [1])).toEqual({
      ok: true,
      persisted: false,
      reason: 'unavailable',
    });
    expect(service.readLocal('dados', [])).toEqual([1]);
    service.writeSession('s', 'x');
    expect(service.readSession('s', '')).toBe('x');
    expect(service.listLocalNames()).toEqual(['dados']);
  });
});

describe('StorageService: inventário, uso e limpeza', () => {
  it('lista só as chaves do prefixo, calcula o uso e apaga tudo', () => {
    const { service, local, session } = setup();
    local.data.set('outro-app:chave', 'nao mexer');
    service.writeLocal('a', 'aaa');
    service.writeLocal('b', 'bb');
    service.writeSession('session', 's');
    expect(service.listLocalNames()).toEqual(['a', 'b']);
    const usage = service.usage();
    expect(usage.items.map((i) => i.name).sort()).toEqual(['a', 'b', 'session']);
    expect(usage.totalBytes).toBeGreaterThan(0);
    expect(usage.mode).toBe('persistent');
    service.clearAll();
    expect(service.listLocalNames()).toEqual([]);
    expect(session.data.size).toBe(0);
    expect(local.data.get('outro-app:chave')).toBe('nao mexer');
  });
});

describe('StorageService: eventos entre abas', () => {
  it('emite quando outra aba grava uma chave nexus-erp: e descarta a cópia em memória defasada', () => {
    const { service, bus, local } = setup();
    const seen: string[] = [];
    service.changes$.subscribe((c) => seen.push(`${c.name}=${c.newValue}`));
    bus.emit({ key: 'nexus-erp:caregivers', newValue: '[]', isLocal: true });
    bus.emit({ key: 'outro-app:x', newValue: '1', isLocal: true });
    bus.emit({ key: 'nexus-erp:session', newValue: '{}', isLocal: false });
    bus.emit({ key: null, newValue: null, isLocal: true });
    expect(seen).toEqual(['caregivers=[]', '*=null']);
    local.quotaChars = 5;
    service.writeLocal('k', 'x'.repeat(50));
    local.quotaChars = null;
    local.data.set('nexus-erp:k', '"novo"');
    bus.emit({ key: 'nexus-erp:k', newValue: '"novo"', isLocal: true });
    expect(service.readLocal('k', '')).toBe('novo');
  });
});

describe('Versão de esquema e migrações', () => {
  it('na primeira vez grava a versão atual', () => {
    const { service } = setup();
    expect(service.storedSchemaVersion()).toBeNull();
    expect(service.ensureSchema()).toBe(true);
    expect(service.storedSchemaVersion()).toBe(SCHEMA_VERSION);
  });

  it('dados de versão mais nova que o app não são usados e geram aviso', () => {
    const { service } = setup();
    service.writeLocal('schema-version', '99');
    expect(service.ensureSchema()).toBe(false);
    expect(service.notices().some((n) => n.kind === 'schema_newer_than_app')).toBe(true);
  });

  it('versão antiga sem caminho de migração gera aviso', () => {
    const { service } = setup();
    service.writeLocal('schema-version', '0');
    expect(service.ensureSchema()).toBe(false);
    expect(service.notices().some((n) => n.kind === 'schema_no_migration_path')).toBe(true);
  });

  it('planeja a cadeia de migração (puro)', () => {
    const steps: Migration[] = [
      { from: '1', to: '2', description: 'a', run: () => undefined },
      { from: '2', to: '3', description: 'b', run: () => undefined },
    ];
    expect(planMigrations('1', '1', steps)).toEqual({ kind: 'none' });
    expect(planMigrations('1', '3', steps)).toEqual({ kind: 'apply', steps });
    expect(planMigrations('2', '3', steps)).toEqual({ kind: 'apply', steps: [steps[1]] });
    expect(planMigrations('4', '3', steps)).toEqual({
      kind: 'unsupported',
      reason: 'newer_than_app',
    });
    expect(planMigrations('0', '3', steps)).toEqual({ kind: 'unsupported', reason: 'no_path' });
    expect(MIGRATIONS).toEqual([]);
    expect(compareVersions('1.2', '1.10')).toBeLessThan(0);
    expect(compareVersions('2', '1.9')).toBeGreaterThan(0);
  });
});
