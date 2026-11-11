import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Clock } from '../clock/clock.service';
import { StorageService } from '../storage/storage.service';
import { FakeStorage, configureCoreTest } from '../testing/test-helpers';
import { COLLECTION_NAMES, ID_PREFIXES } from './collections';
import { Database } from './database';
import { EXPORT_APP_ID, parseImport, validateImport } from './import-export';

describe('Database: seed, reset e primeira visita', () => {
  it('expõe um repositório por coleção, todas com prefixo de id e nome de chave', () => {
    const { db } = configureCoreTest();
    COLLECTION_NAMES.forEach((name) => {
      expect(db.admin(name).collection).toBe(name);
      expect(ID_PREFIXES[name].length).toBeGreaterThan(0);
    });
    expect(new Set(Object.values(ID_PREFIXES)).size).toBe(COLLECTION_NAMES.length);
    // 57 + `doseChecks` (tomada de remédio, aplicativo do cuidador: docs/11-cuidador-arquitetura.md).
    expect(COLLECTION_NAMES).toHaveLength(58);
  });

  it('ensureSeeded gera o seed só na primeira visita', () => {
    const { db, local } = configureCoreTest();
    expect(db.demoState()).toBeNull();
    expect(db.ensureSeeded()).toBe(true);
    expect(db.caregivers.size()).toBe(340);
    expect(db.demoState()).toMatchObject({
      seedName: 'nexus-seed-1',
      seededForToday: '2026-11-04',
    });
    expect(local.data.get('nexus-erp:schema-version')).toBe('"2"');
    expect(db.ensureSeeded()).toBe(false);
  });

  it('o seed usa o relógio: data simulada diferente, prazos diferentes', () => {
    const { db, clock } = configureCoreTest({ today: '2026-11-04' });
    db.seed();
    expect(db.zaritAlerts.get('zal_0001')?.deadlineAt).toBe('2026-11-04T23:59:00-03:00');
    clock.setSimulated('2027-03-10', '12:00');
    db.seed();
    expect(db.zaritAlerts.get('zal_0001')?.deadlineAt).toBe('2027-03-10T23:59:00-03:00');
  });

  it('as contagens da tabela 5.15 após o seed (AC-M15-01)', () => {
    const { db } = configureCoreTest({ seed: true });
    expect(db.users.size()).toBe(8);
    expect(db.caregivers.size()).toBe(340);
    expect(db.elders.size()).toBe(340);
    expect(db.subscriptions.size()).toBe(340);
    expect(db.benefitCards.count((c) => c.status === 'active')).toBe(17);
    expect(db.providers.size()).toBe(20);
    expect(db.serviceRequests.size()).toBe(213);
    expect(db.providerEvaluations.size()).toBe(124);
    expect(db.activities.size()).toBe(11);
    expect(db.messages.size()).toBe(28);
    expect(db.complaints.size()).toBe(5);
    expect(db.dataSubjectRequests.size()).toBe(5);
    expect(db.accessLog.size()).toBe(80);
    expect(db.pops.size()).toBe(10);
    expect(db.risks.size()).toBe(12);
    expect(db.referrals.size()).toBe(10);
    expect(db.occurrences.size()).toBe(3);
    expect(db.settings.get().groupDefaultCapacity).toBe(12);
    expect(db.financialParams.get().reserveCents).toBe(930_000);
    expect(db.pilotConfig.get().goalsLocked).toBe(true);
  });

  it('reset desfaz as alterações e devolve exatamente o seed', () => {
    const { db } = configureCoreTest({ seed: true });
    db.caregivers.update('cg_0001', { fullName: 'Nome Alterado' });
    db.messages.clear();
    db.settings.patch({ groupDefaultCapacity: 20 });
    db.reset();
    expect(db.caregivers.get('cg_0001')?.fullName).toBe('Ana Paula Ferraz');
    expect(db.messages.size()).toBe(28);
    expect(db.settings.get().groupDefaultCapacity).toBe(12);
  });

  it('wipe apaga tudo mas mantém o relógio simulado', () => {
    const { db, clock } = configureCoreTest({ seed: true });
    db.wipe();
    expect(db.caregivers.size()).toBe(0);
    expect(db.demoState()).toBeNull();
    expect(clock.isSimulated()).toBe(true);
  });

  it('os dados persistem em localStorage e voltam numa nova sessão do aplicativo', () => {
    const { local } = configureCoreTest({ seed: true });
    TestBed.resetTestingModule();
    const again = configureCoreTest({ local });
    expect(again.db.caregivers.size()).toBe(340);
    expect(again.db.demoState()).not.toBeNull();
  });

  it('o armazenamento total cabe na cota de 5 milhões de caracteres do navegador', () => {
    const { db } = configureCoreTest({ seed: true });
    const usage = db.storageUsage();
    expect(usage.totalBytes / 2).toBeLessThan(3_000_000);
    expect(usage.mode).toBe('persistent');
  });
});

describe('Database: exportar e importar JSON (AC-M15-02, 03)', () => {
  it('exportar e importar o mesmo arquivo restaura o estado', () => {
    const { db } = configureCoreTest({ seed: true });
    const json = db.exportJson();
    db.caregivers.update('cg_0002', { fullName: 'Outro Nome' });
    db.messages.clear();
    const result = db.importJson(json);
    expect(result).toEqual({ ok: true, errors: [] });
    expect(db.caregivers.get('cg_0002')?.fullName).toBe('Maria Aparecida Lemos');
    expect(db.messages.size()).toBe(28);
    // `exportedAt` é o relógio real e muda de um segundo para o outro: o resto do arquivo tem de ser idêntico.
    const withoutStamp = (text: string): string => text.replace(/"exportedAt":"[^"]+"/, '"exportedAt":""');
    expect(withoutStamp(db.exportJson())).toBe(withoutStamp(json));
  });

  it('o arquivo traz todas as entidades, a versão e a data simulada', () => {
    const { db } = configureCoreTest({ seed: true });
    const envelope = db.buildExport();
    expect(envelope.app).toBe(EXPORT_APP_ID);
    expect(envelope.schemaVersion).toBe('2');
    expect(envelope.clock.demoToday).toBe('2026-11-04');
    expect(Object.keys(envelope.collections)).toHaveLength(COLLECTION_NAMES.length);
    expect(envelope.collections.caregivers).toHaveLength(340);
    expect(db.exportJson(true)).toContain('\n  ');
  });

  it('JSON inválido é recusado sem alterar nada', () => {
    const { db } = configureCoreTest({ seed: true });
    const before = db.caregivers.list();
    const result = db.importJson('{isto nao e json');
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('JSON válido');
    expect(db.caregivers.list()).toBe(before);
  });

  it('versão de esquema incompatível é recusada', () => {
    const { db } = configureCoreTest({ seed: true });
    const envelope = { ...db.buildExport(), schemaVersion: '99' };
    const result = db.importJson(JSON.stringify(envelope));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('outra versão do sistema');
    expect(db.caregivers.size()).toBe(340);
  });

  it('arquivo de outro sistema, coleção faltando ou registro sem id são recusados', () => {
    const { db } = configureCoreTest({ seed: true });
    const good = db.buildExport();
    expect(validateImport(null).ok).toBe(false);
    expect(validateImport({ ...good, app: 'outro' }).ok).toBe(false);
    const missing = { ...good, collections: { ...good.collections } } as {
      collections: Record<string, unknown>;
    };
    delete missing.collections['caregivers'];
    expect(validateImport(missing).ok).toBe(false);
    const noId = { ...good, collections: { ...good.collections, rooms: [{ name: 'x' }] } };
    const res = validateImport(noId);
    expect(res.ok).toBe(false);
    expect(res.ok ? [] : res.errors.join(' ')).toContain('sem id');
    const dup = {
      ...good,
      collections: {
        ...good.collections,
        rooms: [good.collections.rooms[0], good.collections.rooms[0]],
      },
    };
    expect(validateImport(dup).ok).toBe(false);
    const unknown = { ...good, collections: { ...good.collections, inventada: [] } };
    expect(validateImport(unknown).ok).toBe(false);
    const noSingletons = { ...good, singletons: {} };
    expect(validateImport(noSingletons).ok).toBe(false);
    expect(parseImport('[]').ok).toBe(false);
  });

  it('dado real não entra por importação: CPF válido e e-mail fora de @exemplo.com.br são recusados (LP-02)', () => {
    const { db } = configureCoreTest({ seed: true });
    const good = db.buildExport();
    const real = {
      ...(good.collections.caregivers[0] as object),
      cpf: '529.982.247-25',
      email: 'pessoa@gmail.com',
    };
    const result = validateImport({
      ...good,
      collections: { ...good.collections, caregivers: [real] },
    });
    expect(result.ok).toBe(false);
    const errors = result.ok ? '' : result.errors.join(' ');
    expect(errors).toContain('parece real');
    expect(errors).toContain('@exemplo.com.br');
    const flagless = { ...(good.collections.caregivers[0] as object), cpfIsFictitious: false };
    expect(
      validateImport({ ...good, collections: { ...good.collections, caregivers: [flagless] } }).ok,
    ).toBe(false);
  });
});

describe('Database: outra aba', () => {
  it('uma gravação em outra aba recarrega a coleção afetada', () => {
    const { db, bus, local } = configureCoreTest({ seed: true });
    expect(db.rooms.size()).toBe(3);
    local.data.set('nexus-erp:rooms', '[]');
    bus.emit({ key: 'nexus-erp:rooms', newValue: '[]', isLocal: true });
    expect(db.rooms.size()).toBe(0);
    local.data.set(
      'nexus-erp:settings',
      JSON.stringify({ ...db.settings.get(), groupDefaultCapacity: 30 }),
    );
    bus.emit({ key: 'nexus-erp:settings', newValue: null, isLocal: true });
    expect(db.settings.get().groupDefaultCapacity).toBe(30);
    bus.emit({ key: null, newValue: null, isLocal: true });
    expect(db.rooms.size()).toBe(0);
  });
});

describe('Database sem armazenamento', () => {
  it('funciona em memória e avisa', () => {
    const { db } = configureCoreTest({ noStorage: true });
    db.seed();
    expect(db.caregivers.size()).toBe(340);
    expect(TestBed.inject(StorageService).mode()).toBe('memory');
    expect(TestBed.inject(Clock).today()).toBe('2026-11-04');
    expect(TestBed.inject(Database)).toBe(db);
    void FakeStorage;
  });
});
