import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';
import { ModuleKey } from '../../../core/auth/module-map';
import { NavGroupId } from '../../../core/search/screens';
import { StorageService } from '../../../core/storage/storage.service';

export type ThemeName = 'light' | 'dark';
export type TableDensity = 'comfortable' | 'compact';

/** Preferências de menu de UM usuário: grupos recolhidos e atalhos fixados (U-01, até 3). */
export interface UserNavPrefs {
  collapsed: NavGroupId[];
  pinned: ModuleKey[];
}

interface StoredPrefs {
  theme: ThemeName;
  density: TableDensity;
  /** Atalhos de uma tecla (J, K, N, G+letra) ligados? Desligáveis por WCAG 2.1.4. */
  singleKeyShortcuts: boolean;
  /** Modo discreto (U-04): borra nomes e contatos nas telas; revela por clique. */
  discreet: boolean;
  reduceMotion: boolean;
  /** "Preencher com exemplo" nos formulários (U-07): ajuda de QA e CS/CX, ligada por padrão. */
  fillWithExample: boolean;
  /** Menu lateral recolhido em trilho (a partir de 1280 px). */
  menuRail: boolean;
  users: Record<string, UserNavPrefs>;
}

const KEY = 'ui-prefs';
export const MAX_PINNED = 3;

const DEFAULTS: StoredPrefs = {
  theme: 'light',
  density: 'comfortable',
  singleKeyShortcuts: true,
  discreet: false,
  reduceMotion: false,
  fillWithExample: true,
  menuRail: false,
  users: {},
};

/**
 * Repositório de preferências de interface (`nexus-erp:ui-prefs`, UX 3.2 e 3.7): tema claro ou escuro,
 * densidade das tabelas, atalhos de uma tecla, modo discreto, reduzir movimento, menu em trilho e, por
 * usuário, grupos recolhidos e itens fixados. Nada toca o armazenamento do navegador fora do
 * `StorageService` (AC-GL-03).
 *
 * O tema vai para `<html data-theme>`, o modo discreto para `data-discreet` e o movimento reduzido para
 * `data-reduce-motion`; o CSS do design system reage a esses atributos. O tema NÃO segue o sistema
 * operacional sozinho: a escolha é da pessoa (design system 3.2).
 */
@Injectable({ providedIn: 'root' })
export class UiPrefsService {
  private readonly storage = inject(StorageService);
  private readonly doc = inject(DOCUMENT);
  private state: StoredPrefs = this.load();

  readonly theme = signal<ThemeName>(this.state.theme);
  readonly density = signal<TableDensity>(this.state.density);
  readonly singleKeyShortcuts = signal(this.state.singleKeyShortcuts);
  readonly discreet = signal(this.state.discreet);
  readonly reduceMotion = signal(this.state.reduceMotion);
  /** Os formulários oferecem "Preencher com exemplo"? (U-07) */
  readonly fillWithExample = signal(this.state.fillWithExample);
  readonly menuRail = signal(this.state.menuRail);
  private readonly users = signal<Record<string, UserNavPrefs>>(this.state.users);

  constructor() {
    effect(() => {
      const root = this.doc.documentElement;
      if (this.theme() === 'dark') {
        root.setAttribute('data-theme', 'dark');
      } else {
        root.removeAttribute('data-theme');
      }
      this.toggleAttribute(root, 'data-discreet', this.discreet());
      this.toggleAttribute(root, 'data-reduce-motion', this.reduceMotion());
    });
  }

  setTheme(theme: ThemeName): void {
    this.theme.set(theme);
    this.save({ theme });
  }

  toggleTheme(): void {
    this.setTheme(this.theme() === 'dark' ? 'light' : 'dark');
  }

  setDensity(density: TableDensity): void {
    this.density.set(density);
    this.save({ density });
  }

  setSingleKeyShortcuts(on: boolean): void {
    this.singleKeyShortcuts.set(on);
    this.save({ singleKeyShortcuts: on });
  }

  setDiscreet(on: boolean): void {
    this.discreet.set(on);
    this.save({ discreet: on });
  }

  setReduceMotion(on: boolean): void {
    this.reduceMotion.set(on);
    this.save({ reduceMotion: on });
  }

  setFillWithExample(on: boolean): void {
    this.fillWithExample.set(on);
    this.save({ fillWithExample: on });
  }

  setMenuRail(on: boolean): void {
    this.menuRail.set(on);
    this.save({ menuRail: on });
  }

  // ===== Menu por usuário =====

  collapsedGroups(userId: string): readonly NavGroupId[] {
    return this.users()[userId]?.collapsed ?? [];
  }

  pinned(userId: string): readonly ModuleKey[] {
    return this.users()[userId]?.pinned ?? [];
  }

  setGroupCollapsed(userId: string, group: NavGroupId, collapsed: boolean): void {
    const current = this.users()[userId] ?? { collapsed: [], pinned: [] };
    const without = current.collapsed.filter((g) => g !== group);
    this.saveUser(userId, { ...current, collapsed: collapsed ? [...without, group] : without });
  }

  /** Fixa ou desafixa. Devolve `false` se já há 3 fixados e a pessoa tentou fixar mais um. */
  togglePin(userId: string, key: ModuleKey): boolean {
    const current = this.users()[userId] ?? { collapsed: [], pinned: [] };
    if (current.pinned.includes(key)) {
      this.saveUser(userId, { ...current, pinned: current.pinned.filter((k) => k !== key) });
      return true;
    }
    if (current.pinned.length >= MAX_PINNED) {
      return false;
    }
    this.saveUser(userId, { ...current, pinned: [...current.pinned, key] });
    return true;
  }

  /** Relê do armazenamento (depois de "apagar tudo" ou de uma importação). */
  reload(): void {
    this.state = this.load();
    this.theme.set(this.state.theme);
    this.density.set(this.state.density);
    this.singleKeyShortcuts.set(this.state.singleKeyShortcuts);
    this.discreet.set(this.state.discreet);
    this.reduceMotion.set(this.state.reduceMotion);
    this.fillWithExample.set(this.state.fillWithExample);
    this.menuRail.set(this.state.menuRail);
    this.users.set(this.state.users);
  }

  private saveUser(userId: string, prefs: UserNavPrefs): void {
    const users = { ...this.users(), [userId]: prefs };
    this.users.set(users);
    this.save({ users });
  }

  private save(partial: Partial<StoredPrefs>): void {
    this.state = { ...this.state, ...partial };
    this.storage.writeLocal(KEY, this.state);
  }

  private load(): StoredPrefs {
    const stored = this.storage.readLocal<Partial<StoredPrefs> | null>(KEY, null);
    return { ...DEFAULTS, ...(stored ?? {}), users: { ...(stored?.users ?? {}) } };
  }

  private toggleAttribute(root: HTMLElement, name: string, on: boolean): void {
    if (on) {
      root.setAttribute(name, 'true');
    } else {
      root.removeAttribute(name);
    }
  }
}
