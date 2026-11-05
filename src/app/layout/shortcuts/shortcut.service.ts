import { Injectable, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ModuleKey, canAccessModule, moduleByKey } from '../../core/auth/module-map';
import { Role } from '../../core/models/access';
import { isTypingTarget } from '../../shared/ui/overlay/modal';
import { LayoutDialogsService } from '../state/layout-dialogs.service';
import { UiPrefsService } from '../../shared/ui/overlay/ui-prefs.service';
import { PaletteService } from '../search/palette.service';

/** O que um atalho de página pede à tela atual. Quem assina decide se faz algo. */
export type PageShortcutId =
  | 'list-next'
  | 'list-previous'
  | 'list-filters'
  | 'list-new'
  | 'message-reply'
  | 'step-previous'
  | 'step-next'
  | 'scale-answer'
  | 'form-submit';

export interface PageShortcutEvent {
  id: PageShortcutId;
  /** Para `scale-answer`: o valor de 0 a 4. */
  value?: number;
  /** O evento original: chame `preventDefault()` se a tela tratou o atalho. */
  event: KeyboardEvent;
}

/** Linha da tela de atalhos (`?`). */
export interface ShortcutHelp {
  keys: string[];
  text: string;
  /** Rótulo do grupo na tela de atalhos. */
  group: 'Em toda tela' | 'Ir para' | 'Em listas e na caixa' | 'Aplicação da escala';
}

/** Destino de `G` e depois uma letra (UX 5.16). */
const GO_TO: Record<string, { key: ModuleKey; label: string; letter: string }> = {
  p: { key: 'dashboard', label: 'Ir ao Painel', letter: 'P' },
  c: { key: 'caregivers', label: 'Ir a Cuidadores', letter: 'C' },
  m: { key: 'messages', label: 'Ir a Mensagens', letter: 'M' },
  a: { key: 'zarit', label: 'Ir a Acompanhamento', letter: 'A' },
};

const CHORD_WINDOW_MS = 1500;

/** Atalhos que o perfil tem. O atalho só aparece para quem pode usar a ação (G+A não existe para o atendimento). */
export function shortcutsFor(role: Role): ShortcutHelp[] {
  const list: ShortcutHelp[] = [
    { keys: ['Ctrl', 'K'], text: 'Abre a busca e a paleta de comandos', group: 'Em toda tela' },
    { keys: ['/'], text: 'Foca a busca da lista, ou abre a paleta', group: 'Em toda tela' },
    { keys: ['?'], text: 'Abre esta lista de atalhos', group: 'Em toda tela' },
    {
      keys: ['Esc'],
      text: 'Fecha diálogo, painel ou paleta e devolve o foco',
      group: 'Em toda tela',
    },
    {
      keys: ['Ctrl', 'Z'],
      text: 'Desfaz o último aviso que tem "Desfazer", enquanto aberto',
      group: 'Em toda tela',
    },
  ];
  Object.values(GO_TO).forEach((target) => {
    if (canAccessModule(role, moduleByKey(target.key))) {
      list.push({ keys: ['G', target.letter], text: target.label, group: 'Ir para' });
    }
  });
  list.push(
    { keys: ['J'], text: 'Próximo item da lista', group: 'Em listas e na caixa' },
    { keys: ['K'], text: 'Item anterior da lista', group: 'Em listas e na caixa' },
    { keys: ['Enter'], text: 'Abre o item em foco', group: 'Em listas e na caixa' },
    { keys: ['F'], text: 'Abre o menu de filtros', group: 'Em listas e na caixa' },
    {
      keys: ['N'],
      text: 'Novo item do contexto (na caixa, Registrar contato)',
      group: 'Em listas e na caixa',
    },
    { keys: ['Ctrl', 'Enter'], text: 'Envia o formulário em foco', group: 'Em listas e na caixa' },
  );
  if (canAccessModule(role, moduleByKey('messages'))) {
    list.push({
      keys: ['R'],
      text: 'Responder, com a mensagem aberta',
      group: 'Em listas e na caixa',
    });
  }
  if (canAccessModule(role, moduleByKey('zarit'))) {
    list.push(
      { keys: ['0', 'a', '4'], text: 'Responde o item da escala', group: 'Aplicação da escala' },
      { keys: ['←', '→'], text: 'Item anterior e próximo', group: 'Aplicação da escala' },
    );
  }
  return list;
}

/**
 * Atalhos de teclado (UX 5.16). Regra de acessibilidade (WCAG 2.1.4): atalho de UMA tecla (`J`, `K`, `N`,
 * `F`, `?`, `/`, `G` e letra) só vale FORA de campo de texto e pode ser desligado nas preferências. Atalhos
 * com `Ctrl` ou `Cmd` ficam sempre ativos.
 *
 * O shell liga `handle()` ao `keydown` do documento. Os atalhos globais (Ctrl+K, `/`, `?`, G+letra) o serviço
 * resolve sozinho. Os de página (J, K, F, N, R, 0 a 4, setas, Ctrl+Enter) viram eventos em `page$`:
 *
 * ```ts
 * inject(ShortcutService).page$.pipe(takeUntilDestroyed()).subscribe(({ id, event }) => {
 *   if (id === 'list-next') { this.selectNext(); event.preventDefault(); }
 * });
 * ```
 */
@Injectable({ providedIn: 'root' })
export class ShortcutService implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly palette = inject(PaletteService);
  private readonly dialogs = inject(LayoutDialogsService);
  private readonly prefs = inject(UiPrefsService);

  private readonly pageSubject = new Subject<PageShortcutEvent>();
  /** Atalhos de página, para as telas assinarem. */
  readonly page$ = this.pageSubject.asObservable();

  private chordTimer: ReturnType<typeof setTimeout> | null = null;
  private awaitingChord = false;

  ngOnDestroy(): void {
    this.clearChord();
  }

  /** Trata um `keydown` do documento. */
  handle(event: KeyboardEvent): void {
    const role = this.auth.role();
    if (!role || !this.auth.isAuthenticated() || event.defaultPrevented || event.isComposing) {
      return;
    }
    const key = event.key;
    const mod = event.ctrlKey || event.metaKey;

    // Atalhos com Ctrl ou Cmd: sempre ativos.
    if (mod && !event.altKey && key.toLowerCase() === 'k') {
      event.preventDefault();
      this.palette.open();
      return;
    }
    if (mod && key === 'Enter') {
      this.emit('form-submit', event);
      return;
    }
    if (mod || event.altKey) {
      return;
    }

    // Os de uma tecla: só fora de campo de texto, sem modal aberto e se estiverem ligados.
    if (isTypingTarget(event.target) || this.modalOpen()) {
      return;
    }
    if (!this.prefs.singleKeyShortcuts()) {
      return;
    }
    if (this.awaitingChord) {
      this.clearChord();
      this.goTo(role, key.toLowerCase(), event);
      return;
    }
    switch (key) {
      case '/': {
        const field = event.target instanceof HTMLElement ? this.searchField(event.target) : null;
        event.preventDefault();
        if (field) {
          field.focus();
        } else {
          this.palette.open();
        }
        return;
      }
      case '?':
        event.preventDefault();
        this.dialogs.openShortcuts();
        return;
      case 'g':
      case 'G':
        this.awaitingChord = true;
        this.chordTimer = setTimeout(() => this.clearChord(), CHORD_WINDOW_MS);
        return;
      case 'j':
      case 'J':
        this.emit('list-next', event);
        return;
      case 'k':
      case 'K':
        this.emit('list-previous', event);
        return;
      case 'f':
      case 'F':
        this.emit('list-filters', event);
        return;
      case 'n':
      case 'N':
        this.emit('list-new', event);
        return;
      case 'r':
      case 'R':
        this.emit('message-reply', event);
        return;
      case 'ArrowLeft':
        this.emit('step-previous', event);
        return;
      case 'ArrowRight':
        this.emit('step-next', event);
        return;
      default:
        if (/^[0-4]$/.test(key)) {
          this.emit('scale-answer', event, Number(key));
        }
    }
  }

  private goTo(role: Role, letter: string, event: KeyboardEvent): void {
    const target = GO_TO[letter];
    if (target && canAccessModule(role, moduleByKey(target.key))) {
      event.preventDefault();
      void this.router.navigateByUrl(moduleByKey(target.key).path);
    }
  }

  private emit(id: PageShortcutId, event: KeyboardEvent, value?: number): void {
    this.pageSubject.next({ id, event, ...(value !== undefined ? { value } : {}) });
  }

  private searchField(origin: HTMLElement): HTMLElement | null {
    return origin.ownerDocument.querySelector<HTMLElement>('[data-search-field]');
  }

  private modalOpen(): boolean {
    return typeof document !== 'undefined' && document.querySelector('dialog[open]') !== null;
  }

  private clearChord(): void {
    this.awaitingChord = false;
    if (this.chordTimer !== null) {
      clearTimeout(this.chordTimer);
      this.chordTimer = null;
    }
  }
}
