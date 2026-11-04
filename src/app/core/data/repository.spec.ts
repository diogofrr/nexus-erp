import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Clock } from '../clock/clock.service';
import { Audited } from '../models/primitives';
import { StorageService } from '../storage/storage.service';
import { configureCoreTest } from '../testing/test-helpers';
import {
  AppendOnlyRepository,
  DuplicateEntityError,
  EntityNotFoundError,
  EntityRepository,
  SingletonStore,
} from './repository';

interface Thing extends Audited {
  name: string;
  qty: number;
  tag?: string;
}

function repo(): {
  repository: EntityRepository<Thing>;
  storage: StorageService;
  clock: Clock;
  env: ReturnType<typeof configureCoreTest>;
} {
  const env = configureCoreTest({ today: '2026-11-04', time: '09:30' });
  const storage = TestBed.inject(StorageService);
  const clock = TestBed.inject(Clock);
  return {
    repository: new EntityRepository<Thing>(storage, clock, {
      collection: 'things',
      idPrefix: 'th',
    }),
    storage,
    clock,
    env,
  };
}

describe('EntityRepository: criar, obter, atualizar e remover', () => {
  it('cria com id sequencial e carimbos do Clock', () => {
    const { repository } = repo();
    const a = repository.create({ name: 'A', qty: 1 });
    const b = repository.create({ name: 'B', qty: 2 });
    expect(a.id).toBe('th_0001');
    expect(b.id).toBe('th_0002');
    expect(a.createdAt).toBe('2026-11-04T09:30:00-03:00');
    expect(a.updatedAt).toBe(a.createdAt);
    expect(repository.get('th_0002')).toEqual(b);
    expect(repository.list()).toHaveLength(2);
    expect(repository.exists('th_0001')).toBe(true);
    expect(repository.get('nada')).toBeUndefined();
  });

  it('aceita id explícito (seed) e recusa repetido', () => {
    const { repository } = repo();
    expect(repository.create({ id: 'x1', name: 'X', qty: 0 }).id).toBe('x1');
    expect(() => repository.create({ id: 'x1', name: 'Y', qty: 0 })).toThrow(DuplicateEntityError);
  });

  it('o próximo id continua depois do maior número já usado', () => {
    const { repository } = repo();
    repository.replaceAll([
      { id: 'th_0007', createdAt: 'a', updatedAt: 'a', name: 'sete', qty: 7 },
      { id: 'zz', createdAt: 'a', updatedAt: 'a', name: 'sem numero', qty: 0 },
    ] as Thing[]);
    expect(repository.create({ name: 'novo', qty: 1 }).id).toBe('th_0008');
  });

  it('atualiza só o que mudou e mantém id e criação; updatedAt acompanha o relógio', () => {
    const { repository, clock } = repo();
    const created = repository.create({ name: 'A', qty: 1 });
    clock.setSimulated('2026-11-05', '10:00');
    const updated = repository.update(created.id, { qty: 5, tag: 'novo' });
    expect(updated).toMatchObject({
      id: created.id,
      name: 'A',
      qty: 5,
      tag: 'novo',
      createdAt: created.createdAt,
      updatedAt: '2026-11-05T10:00:00-03:00',
    });
    expect(repository.get(created.id)).toEqual(updated);
    expect(() => repository.update('nada', { qty: 1 })).toThrow(EntityNotFoundError);
    expect(repository.updateWith(created.id, (t) => ({ qty: t.qty + 1 })).qty).toBe(6);
  });

  it('remove e devolve se existia', () => {
    const { repository } = repo();
    const a = repository.create({ name: 'A', qty: 1 });
    expect(repository.remove(a.id)).toBe(true);
    expect(repository.remove(a.id)).toBe(false);
    expect(repository.list()).toHaveLength(0);
    expect(() => repository.require(a.id)).toThrow(EntityNotFoundError);
  });

  it('upsert insere ou substitui', () => {
    const { repository } = repo();
    repository.upsert({ id: 'u1', createdAt: 'c', updatedAt: 'u', name: 'U', qty: 1 });
    repository.upsert({ id: 'u1', createdAt: 'c', updatedAt: 'u', name: 'U2', qty: 2 });
    expect(repository.list()).toHaveLength(1);
    expect(repository.get('u1')?.name).toBe('U2');
  });
});

describe('EntityRepository: consultar, contar e operações em lote', () => {
  it('query, find, count', () => {
    const { repository } = repo();
    repository.createMany([
      { name: 'A', qty: 1 },
      { name: 'B', qty: 2 },
      { name: 'C', qty: 3 },
    ]);
    expect(repository.query((t) => t.qty >= 2).map((t) => t.name)).toEqual(['B', 'C']);
    expect(repository.find((t) => t.name === 'C')?.qty).toBe(3);
    expect(repository.count()).toBe(3);
    expect(repository.count((t) => t.qty === 1)).toBe(1);
    expect(repository.size()).toBe(3);
  });

  it('createMany grava uma única vez e devolve ids únicos', () => {
    const { repository, env } = repo();
    const before = env.local.data.get('nexus-erp:things');
    expect(before).toBeUndefined();
    const created = repository.createMany([
      { name: 'A', qty: 1 },
      { name: 'B', qty: 2 },
    ]);
    expect(created.map((c) => c.id)).toEqual(['th_0001', 'th_0002']);
    expect(JSON.parse(env.local.data.get('nexus-erp:things') as string)).toHaveLength(2);
    expect(() =>
      repository.createMany([
        { id: 'dup', name: 'x', qty: 0 },
        { id: 'dup', name: 'y', qty: 0 },
      ]),
    ).toThrow(DuplicateEntityError);
    expect(repository.count()).toBe(2); // nada foi gravado
  });

  it('updateWhere e removeWhere devolvem quantos mudaram', () => {
    const { repository } = repo();
    repository.createMany([
      { name: 'A', qty: 1 },
      { name: 'B', qty: 2 },
      { name: 'C', qty: 3 },
    ]);
    expect(repository.updateWhere((t) => t.qty > 1, { tag: 'maior' })).toBe(2);
    expect(repository.count((t) => t.tag === 'maior')).toBe(2);
    expect(
      repository.updateWhere(
        (t) => t.qty > 1,
        (t) => ({ qty: t.qty * 10 }),
      ),
    ).toBe(2);
    expect(repository.updateWhere(() => false, { tag: 'x' })).toBe(0);
    expect(repository.removeWhere((t) => t.qty >= 20)).toBe(2);
    expect(repository.removeWhere((t) => t.qty >= 20)).toBe(0);
    expect(repository.list()).toHaveLength(1);
  });
});

describe('EntityRepository: signals e persistência', () => {
  it('watch e watchOne são signals derivados que reagem às mudanças', () => {
    const { repository } = repo();
    const big = repository.watch((t) => t.qty > 5);
    const first = repository.watchOne('th_0001');
    expect(big()).toHaveLength(0);
    expect(first()).toBeUndefined();
    repository.create({ name: 'A', qty: 9 });
    expect(big()).toHaveLength(1);
    expect(first()?.name).toBe('A');
    repository.update('th_0001', { qty: 1 });
    expect(big()).toHaveLength(0);
    expect(first()?.qty).toBe(1);
    expect(repository.all().length).toBe(1);
  });

  it('persiste a coleção em nexus-erp:<coleção> e recarrega ao criar de novo', () => {
    const { repository, storage, clock, env } = repo();
    repository.create({ name: 'A', qty: 1 });
    expect(JSON.parse(env.local.data.get('nexus-erp:things') as string)[0]).toMatchObject({
      name: 'A',
    });
    const again = new EntityRepository<Thing>(storage, clock, {
      collection: 'things',
      idPrefix: 'th',
    });
    expect(again.list()).toHaveLength(1);
    expect(again.create({ name: 'B', qty: 2 }).id).toBe('th_0002');
  });

  it('reload relê o armazenamento (mudança feita por outra aba)', () => {
    const { repository, env } = repo();
    repository.create({ name: 'A', qty: 1 });
    env.local.data.set(
      'nexus-erp:things',
      JSON.stringify([
        { id: 'th_0009', createdAt: 'c', updatedAt: 'u', name: 'outra aba', qty: 9 },
      ]),
    );
    repository.reload();
    expect(repository.list().map((t) => t.name)).toEqual(['outra aba']);
  });

  it('um valor guardado que não é lista vira coleção vazia', () => {
    const { storage, clock, env } = repo();
    env.local.data.set('nexus-erp:things', '{"nao":"lista"}');
    expect(
      new EntityRepository<Thing>(storage, clock, { collection: 'things', idPrefix: 'th' }).list(),
    ).toEqual([]);
  });

  it('snapshot, clear e replaceAll', () => {
    const { repository } = repo();
    repository.create({ name: 'A', qty: 1 });
    expect(repository.snapshot()).toHaveLength(1);
    repository.clear();
    expect(repository.list()).toHaveLength(0);
    repository.replaceAll([{ id: 'a', createdAt: 'c', updatedAt: 'u', name: 'A', qty: 1 }]);
    expect(repository.get('a')?.name).toBe('A');
  });
});

describe('AppendOnlyRepository (log e consentimentos)', () => {
  it('só tem append: não existe update nem remove', () => {
    const env = configureCoreTest();
    const append = new AppendOnlyRepository<Thing>(
      TestBed.inject(StorageService),
      TestBed.inject(Clock),
      { collection: 'logs', idPrefix: 'lg' },
    );
    const created = append.append({ name: 'evento', qty: 1 });
    expect(created.id).toBe('lg_0001');
    expect(
      append.appendMany([
        { name: 'a', qty: 1 },
        { name: 'b', qty: 2 },
      ]),
    ).toHaveLength(2);
    expect(append.count()).toBe(3);
    expect('update' in append).toBe(false);
    expect('remove' in append).toBe(false);
    expect('create' in append).toBe(false);
    expect(JSON.parse(env.local.data.get('nexus-erp:logs') as string)).toHaveLength(3);
    expect(() => append.appendMany([{ id: 'lg_0001', name: 'dup', qty: 0 }])).toThrow(
      DuplicateEntityError,
    );
  });
});

describe('SingletonStore', () => {
  it('lê o padrão, grava, mescla e restaura', () => {
    configureCoreTest();
    const storage = TestBed.inject(StorageService);
    const store = new SingletonStore(storage, 'settings-test', () => ({ a: 1, b: 'x' }));
    expect(store.get()).toEqual({ a: 1, b: 'x' });
    store.patch({ a: 5 });
    expect(store.value()).toEqual({ a: 5, b: 'x' });
    expect(
      new SingletonStore(storage, 'settings-test', () => ({ a: 1, b: 'x', c: true })).get(),
    ).toEqual({ a: 5, b: 'x', c: true });
    expect(store.reset()).toEqual({ a: 1, b: 'x' });
    store.set({ a: 2, b: 'y' });
    store.clear();
    expect(store.get()).toEqual({ a: 1, b: 'x' });
    expect(storage.hasLocal('settings-test')).toBe(false);
  });
});
