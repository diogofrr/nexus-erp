/**
 * Ajudantes de teste do núcleo: armazenamento falso (com cota), barramento de eventos entre abas e
 * montagem do ambiente (relógio simulado, banco com seed, sessão). Só para `*.spec.ts`.
 */
import { EnvironmentProviders, Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Clock } from '../clock/clock.service';
import { Database } from '../data/database';
import { ISODate, TimeOfDay } from '../models/primitives';
import {
  CROSS_TAB_SUBSCRIBE,
  CrossTabEvent,
  CrossTabListener,
  LOCAL_STORAGE_BACKEND,
  SESSION_STORAGE_BACKEND,
  StorageBackend,
} from '../storage/storage-tokens';

/** Armazenamento em memória que imita `Storage`, com cota opcional em caracteres. */
export class FakeStorage implements StorageBackend {
  readonly data = new Map<string, string>();
  /** Se definido, `setItem` lança quando o total de caracteres passaria disso. */
  quotaChars: number | null = null;
  /** Se verdadeiro, qualquer `setItem` lança (armazenamento bloqueado). */
  failOnSet = false;

  get length(): number {
    return this.data.size;
  }

  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failOnSet) {
      throw new DOMException('blocked', 'SecurityError');
    }
    if (this.quotaChars !== null) {
      let total = value.length + key.length;
      this.data.forEach((v, k) => {
        if (k !== key) {
          total += v.length + k.length;
        }
      });
      if (total > this.quotaChars) {
        throw new DOMException('quota', 'QuotaExceededError');
      }
    }
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }
}

/** Barramento controlado no lugar do evento `storage` do navegador. */
export class CrossTabBus {
  private listeners: CrossTabListener[] = [];

  readonly subscribe = (listener: CrossTabListener): (() => void) => {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  };

  emit(event: CrossTabEvent): void {
    this.listeners.forEach((l) => l(event));
  }
}

export interface CoreTestOptions {
  /** Data simulada de "hoje" (padrão 2026-11-04, uma quarta-feira). */
  today?: ISODate;
  /** Hora fixa do dia (padrão 12:00). */
  time?: TimeOfDay;
  /** Gera o seed completo (padrão `false`). */
  seed?: boolean;
  local?: FakeStorage;
  session?: FakeStorage;
  /** Simula armazenamento indisponível. */
  noStorage?: boolean;
  /** Providers extras (por exemplo, `provideRouter([])`). */
  providers?: (Provider | EnvironmentProviders)[];
}

export interface CoreTestEnv {
  local: FakeStorage;
  session: FakeStorage;
  bus: CrossTabBus;
  clock: Clock;
  db: Database;
}

export const TEST_TODAY: ISODate = '2026-11-04';

/** Arquivos que o código tentou baixar (`downloadTextFile`) nos testes deste arquivo, na ordem. */
export const TEST_DOWNLOADS: { fileName: string; href: string }[] = [];
let downloadGuardInstalled = false;

/**
 * O jsdom não implementa navegação: o clique no `<a download>` que `downloadTextFile` cria (CSV, JSON) viraria
 * o aviso "Not implemented: navigation to another Document" a cada exportação testada. O clique é
 * interceptado só para esse tipo de link e registrado em `TEST_DOWNLOADS`; qualquer erro real continua
 * aparecendo.
 */
function interceptDownloadClicks(): void {
  if (downloadGuardInstalled || typeof document === 'undefined') {
    return;
  }
  downloadGuardInstalled = true;
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target;
      if (target instanceof HTMLAnchorElement && target.hasAttribute('download')) {
        event.preventDefault();
        TEST_DOWNLOADS.push({ fileName: target.download, href: target.href });
      }
    },
    true,
  );
}

/** Configura o `TestBed` com armazenamento falso, relógio simulado e (opcionalmente) o seed. */
export function configureCoreTest(options: CoreTestOptions = {}): CoreTestEnv {
  interceptDownloadClicks();
  const local = options.local ?? new FakeStorage();
  const session = options.session ?? new FakeStorage();
  const bus = new CrossTabBus();
  TestBed.configureTestingModule({
    providers: [
      { provide: LOCAL_STORAGE_BACKEND, useValue: options.noStorage ? null : local },
      { provide: SESSION_STORAGE_BACKEND, useValue: options.noStorage ? null : session },
      { provide: CROSS_TAB_SUBSCRIBE, useValue: bus.subscribe },
      ...(options.providers ?? []),
    ],
  });
  const clock = TestBed.inject(Clock);
  clock.setSimulated(options.today ?? TEST_TODAY, options.time ?? '12:00');
  const db = TestBed.inject(Database);
  if (options.seed) {
    db.seed();
  }
  return { local, session, bus, clock, db };
}
