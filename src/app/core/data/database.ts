import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Clock } from '../clock/clock.service';
import { DemoState } from '../models';
import { generateSeed } from '../seed/seed';
import { STORAGE_KEYS, StorageService, StorageUsage } from '../storage/storage.service';
import { SCHEMA_VERSION } from '../storage/migrations';
import {
  APPEND_ONLY_COLLECTIONS,
  COLLECTION_NAMES,
  CollectionData,
  CollectionName,
  CollectionTypes,
  ID_PREFIXES,
  SingletonTypes,
} from './collections';
import { defaultAppSettings, defaultPilotConfig } from './defaults';
import { EXPORT_APP_ID, EXPORT_FORMAT, ExportEnvelope, parseImport } from './import-export';
import {
  AppendOnlyRepository,
  EntityRepository,
  RepositoryAdmin,
  SingletonStore,
} from './repository';
import { restoreFinancialParams } from '../rules/finance';

export interface ImportResult {
  ok: boolean;
  errors: string[];
}

/**
 * Banco de dados do protótipo: expõe UM repositório tipado por entidade (sobre signals, persistidos em
 * `localStorage` por coleção com o prefixo `nexus-erp:`), mais seed, reset, exportação e importação.
 *
 * Os módulos de funcionalidade leem e gravam SEMPRE por aqui, nunca pelo armazenamento do navegador (AC-GL-03).
 *
 * ```ts
 * const db = inject(Database);
 * const caregivers = db.caregivers.query((c) => c.status === 'active');
 * db.caregivers.update('cg_0001', { dailyCareHours: 9 });
 * ```
 */
@Injectable({ providedIn: 'root' })
export class Database {
  private readonly storage = inject(StorageService);
  private readonly clock = inject(Clock);

  // ===== Acesso (M01) =====
  readonly users = this.repo('users');
  /** Log de auditoria: append-only. Use o `AuditLogService` para gravar. */
  readonly accessLog = this.appendOnly('accessLog');

  // ===== Planos e assinaturas (M04) =====
  readonly plans = this.repo('plans');
  readonly subscriptions = this.repo('subscriptions');
  readonly planChanges = this.repo('planChanges');
  readonly benefitCards = this.repo('benefitCards');
  readonly cardUsages = this.repo('cardUsages');

  // ===== Cuidadores e pessoas idosas (M03) =====
  readonly caregivers = this.repo('caregivers');
  readonly elders = this.repo('elders');
  readonly medications = this.repo('medications');
  /** Tomadas de remédio marcadas pelo cuidador no aplicativo ("dei"). */
  readonly doseChecks = this.repo('doseChecks');
  readonly careAppointments = this.repo('careAppointments');
  readonly wellbeingChecks = this.repo('wellbeingChecks');
  readonly appUsage = this.repo('appUsage');

  // ===== Atendimento psicológico (M05) =====
  readonly psychologists = this.repo('psychologists');
  readonly rooms = this.repo('rooms');
  readonly availabilitySlots = this.repo('availabilitySlots');
  readonly careSessions = this.repo('careSessions');
  readonly sessionNotes = this.repo('sessionNotes');
  readonly monthSummaries = this.repo('monthSummaries');

  // ===== Zarit e ARBE (M06) =====
  readonly zaritAssessments = this.repo('zaritAssessments');
  readonly zaritAlerts = this.repo('zaritAlerts');
  readonly arbeAlerts = this.repo('arbeAlerts');
  readonly reviewRequests = this.repo('reviewRequests');

  // ===== Grupos e capacitações (M07) =====
  readonly activities = this.repo('activities');
  readonly activityEnrollments = this.repo('activityEnrollments');

  // ===== Rede credenciada (M08) =====
  readonly providers = this.repo('providers');
  readonly accreditations = this.repo('accreditations');
  readonly providerDocuments = this.repo('providerDocuments');
  readonly serviceRequests = this.repo('serviceRequests');
  readonly providerEvaluations = this.repo('providerEvaluations');
  readonly arpSnapshots = this.repo('arpSnapshots');
  readonly internalReviews = this.repo('internalReviews');
  readonly providerStatusEvents = this.repo('providerStatusEvents');

  // ===== Parceiros e canal corporativo (M09) =====
  readonly partners = this.repo('partners');
  readonly corporateAccounts = this.repo('corporateAccounts');
  readonly corporateSeats = this.repo('corporateSeats');

  // ===== Mensagens e reclamações (M11) =====
  readonly messages = this.repo('messages');
  readonly complaints = this.repo('complaints');
  readonly messageTemplates = this.repo('messageTemplates');

  // ===== LGPD (M12) =====
  readonly consentTerms = this.repo('consentTerms');
  readonly consents = this.repo('consents');
  /** Histórico de consentimentos: append-only. Use o `ConsentService`. */
  readonly consentEvents = this.appendOnly('consentEvents');
  readonly dataSubjectRequests = this.repo('dataSubjectRequests');
  readonly incidents = this.repo('incidents');
  readonly retentionPolicies = this.repo('retentionPolicies');
  readonly privacyDocuments = this.repo('privacyDocuments');

  // ===== Governança (M13) =====
  readonly pops = this.repo('pops');
  readonly popReviews = this.repo('popReviews');
  readonly popAcknowledgements = this.repo('popAcknowledgements');
  readonly risks = this.repo('risks');
  readonly referrals = this.repo('referrals');
  readonly occurrences = this.repo('occurrences');
  readonly trainingEvents = this.repo('trainingEvents');
  readonly guidanceContents = this.repo('guidanceContents');
  readonly norms = this.repo('norms');

  // ===== Financeiro e piloto (M10) =====
  readonly pilotEnrollments = this.repo('pilotEnrollments');

  // ===== Painel (M02) =====
  readonly notifications = this.repo('notifications');

  // ===== Documentos únicos (M15, M10) =====
  readonly settings = new SingletonStore(this.storage, STORAGE_KEYS.settings, defaultAppSettings);
  readonly financialParams = new SingletonStore(
    this.storage,
    STORAGE_KEYS.financialParams,
    restoreFinancialParams,
  );
  readonly pilotConfig = new SingletonStore(
    this.storage,
    STORAGE_KEYS.pilotConfig,
    defaultPilotConfig,
  );

  private readonly demoStateSignal = signal<DemoState | null>(
    this.storage.readLocal<DemoState | null>(STORAGE_KEYS.demoState, null),
  );
  /** Estado da demonstração (semente, data de geração). `null` antes do primeiro seed. */
  readonly demoState = this.demoStateSignal.asReadonly();

  private readonly registry = new Map<CollectionName, RepositoryAdmin>();

  constructor() {
    COLLECTION_NAMES.forEach((name) => this.registry.set(name, this.byName(name)));
    const sub = this.storage.changes$.subscribe((change) => this.onExternalChange(change.name));
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
  }

  /** Acesso administrativo a uma coleção pelo nome (importação, exportação, ferramentas de QA). */
  admin(name: CollectionName): RepositoryAdmin {
    return this.registry.get(name) as RepositoryAdmin;
  }

  // ===== Seed, reset e limpeza (M15) =====

  /** Garante esquema e dados. Na primeira visita, gera o seed. Devolve `true` se gerou. */
  ensureSeeded(): boolean {
    this.storage.ensureSchema();
    if (this.demoStateSignal() === null && this.caregivers.size() === 0) {
      this.seed();
      return true;
    }
    return false;
  }

  /**
   * Gera o seed determinístico (semente `nexus-seed-1`) relativo a `Clock.today()` e SUBSTITUI todos os dados.
   * Mesma data, mesmo resultado.
   */
  seed(): void {
    const dataset = generateSeed(this.clock.today());
    COLLECTION_NAMES.forEach((name) => this.admin(name).replaceAll(dataset.collections[name]));
    this.settings.set(dataset.singletons.settings);
    this.financialParams.set(dataset.singletons.financialParams);
    this.pilotConfig.set(dataset.singletons.pilotConfig);
    const state: DemoState = { ...dataset.demoState, seededAt: this.clock.now() };
    this.demoStateSignal.set(state);
    this.storage.writeLocal(STORAGE_KEYS.demoState, state);
  }

  /** "Resetar para o seed" (AC-M15-01): apaga tudo e gera o seed de novo. */
  reset(): void {
    this.wipe();
    this.seed();
  }

  /** "Apagar tudo" (dados de demonstração): esvazia coleções e parâmetros. Mantém relógio e aviso de uso. */
  wipe(): void {
    COLLECTION_NAMES.forEach((name) => this.admin(name).clear());
    this.settings.clear();
    this.financialParams.clear();
    this.pilotConfig.clear();
    this.demoStateSignal.set(null);
    this.storage.removeLocal(STORAGE_KEYS.demoState);
  }

  // ===== Exportação e importação =====

  buildExport(): ExportEnvelope {
    const collections = {} as Record<string, unknown[]>;
    COLLECTION_NAMES.forEach((name) => {
      collections[name] = [...this.admin(name).snapshot()];
    });
    const singletons: SingletonTypes = {
      settings: this.settings.get(),
      financialParams: this.financialParams.get(),
      pilotConfig: this.pilotConfig.get(),
    };
    return {
      app: EXPORT_APP_ID,
      format: EXPORT_FORMAT,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: this.clock.now(),
      clock: { demoToday: this.clock.simulatedDate() },
      demoState: this.demoStateSignal(),
      singletons,
      collections: collections as unknown as CollectionData,
    };
  }

  /** JSON de TODAS as entidades (M15 "exportar tudo"). `pretty` indenta com 2 espaços. */
  exportJson(pretty = false): string {
    return JSON.stringify(this.buildExport(), null, pretty ? 2 : undefined);
  }

  /**
   * Importa um JSON exportado. Valida esquema, versão e dados fictícios ANTES de gravar; se algo falhar,
   * devolve os erros e NÃO altera nada (AC-M15-03).
   */
  importJson(text: string): ImportResult {
    const parsed = parseImport(text);
    if (!parsed.ok) {
      return { ok: false, errors: parsed.errors };
    }
    const { envelope } = parsed;
    const imported: Partial<CollectionData> = envelope.collections;
    COLLECTION_NAMES.forEach((name) => this.admin(name).replaceAll(imported[name] ?? []));
    this.settings.set({ ...defaultAppSettings(), ...envelope.singletons.settings });
    this.financialParams.set({
      ...restoreFinancialParams(),
      ...envelope.singletons.financialParams,
    });
    this.pilotConfig.set({ ...defaultPilotConfig(), ...envelope.singletons.pilotConfig });
    this.demoStateSignal.set(envelope.demoState);
    if (envelope.demoState) {
      this.storage.writeLocal(STORAGE_KEYS.demoState, envelope.demoState);
    } else {
      this.storage.removeLocal(STORAGE_KEYS.demoState);
    }
    this.clock.setSimulated(envelope.clock.demoToday);
    return { ok: true, errors: [] };
  }

  /** Tamanho ocupado no navegador (M12-10, M15-01). */
  storageUsage(): StorageUsage {
    return this.storage.usage();
  }

  // ===== Internos =====

  private repo<K extends CollectionName>(name: K): EntityRepository<CollectionTypes[K]> {
    return new EntityRepository<CollectionTypes[K]>(this.storage, this.clock, {
      collection: name,
      idPrefix: ID_PREFIXES[name],
    });
  }

  private appendOnly<K extends CollectionName>(name: K): AppendOnlyRepository<CollectionTypes[K]> {
    return new AppendOnlyRepository<CollectionTypes[K]>(this.storage, this.clock, {
      collection: name,
      idPrefix: ID_PREFIXES[name],
    });
  }

  private byName(name: CollectionName): RepositoryAdmin {
    const record = this as unknown as Record<string, RepositoryAdmin | undefined>;
    const found = record[name];
    if (!found) {
      throw new Error(`Coleção sem repositório: ${name}`);
    }
    return found;
  }

  /** Outra aba gravou: relê a coleção (ou tudo, se `localStorage.clear()`). */
  private onExternalChange(name: string): void {
    if (name === '*') {
      COLLECTION_NAMES.forEach((n) => this.admin(n).reload());
      this.settings.reload();
      this.financialParams.reload();
      this.pilotConfig.reload();
      return;
    }
    if ((COLLECTION_NAMES as readonly string[]).includes(name)) {
      this.admin(name as CollectionName).reload();
      return;
    }
    if (name === STORAGE_KEYS.settings) {
      this.settings.reload();
    } else if (name === STORAGE_KEYS.financialParams) {
      this.financialParams.reload();
    } else if (name === STORAGE_KEYS.pilotConfig) {
      this.pilotConfig.reload();
    } else if (name === STORAGE_KEYS.demoState) {
      this.demoStateSignal.set(
        this.storage.readLocal<DemoState | null>(STORAGE_KEYS.demoState, null),
      );
    }
  }

  /** Coleções append-only (para documentação e testes). */
  static readonly appendOnlyCollections: readonly CollectionName[] = APPEND_ONLY_COLLECTIONS;
}
