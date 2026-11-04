import { InjectionToken } from '@angular/core';

/** Subconjunto da API `Storage` que o `StorageService` usa. `localStorage` e `sessionStorage` satisfazem. */
export interface StorageBackend {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Acesso ao armazenamento do navegador. ESTE é o único arquivo do projeto que menciona
 * `localStorage` e `sessionStorage` (AC-GL-03). Retorna `null` quando o armazenamento está
 * indisponível (modo privado restrito, política do navegador, SSR): o serviço cai para memória.
 */
function browserStorage(kind: 'local' | 'session'): StorageBackend | null {
  try {
    if (typeof window === 'undefined') {
      return null;
    }
    const backend = kind === 'local' ? window.localStorage : window.sessionStorage;
    const probe = 'nexus-erp:__probe__';
    backend.setItem(probe, '1');
    backend.removeItem(probe);
    return backend;
  } catch {
    return null;
  }
}

/** Backend dos dados persistentes (`localStorage`). Em testes, substitua por um fake. */
export const LOCAL_STORAGE_BACKEND = new InjectionToken<StorageBackend | null>(
  'LOCAL_STORAGE_BACKEND',
  {
    providedIn: 'root',
    factory: () => browserStorage('local'),
  },
);

/** Backend da sessão (`sessionStorage`): fecha com a aba. */
export const SESSION_STORAGE_BACKEND = new InjectionToken<StorageBackend | null>(
  'SESSION_STORAGE_BACKEND',
  {
    providedIn: 'root',
    factory: () => browserStorage('session'),
  },
);

/** Escuta o evento `storage` entre abas. Em testes, substitua por um `Subject` controlado. */
export interface CrossTabEvent {
  key: string | null;
  newValue: string | null;
  /** `true` quando o evento veio do `localStorage` (e não do `sessionStorage`). */
  isLocal: boolean;
}

export type CrossTabListener = (event: CrossTabEvent) => void;

export const CROSS_TAB_SUBSCRIBE = new InjectionToken<(listener: CrossTabListener) => () => void>(
  'CROSS_TAB_SUBSCRIBE',
  {
    providedIn: 'root',
    factory: () => (listener: CrossTabListener) => {
      if (typeof window === 'undefined') {
        return () => undefined;
      }
      const handler = (e: StorageEvent): void => {
        listener({
          key: e.key,
          newValue: e.newValue,
          isLocal: e.storageArea === window.localStorage,
        });
      };
      window.addEventListener('storage', handler);
      return () => window.removeEventListener('storage', handler);
    },
  },
);
