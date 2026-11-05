import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { SearchGroup, SearchResult, SearchService } from '../../core/search/search.service';
import { IconComponent, IconName, toIconName } from '../../shared/ui/display/icon.component';
import { closeModalDialog, showModalDialog } from '../../shared/ui/overlay/modal';
import { PaletteService } from './palette.service';

/** Espera entre a última tecla e a busca (UX 3.5). */
export const SEARCH_DEBOUNCE_MS = 150;

interface PaletteItem {
  result: SearchResult;
  index: number;
  domId: string;
}

interface PaletteGroup {
  key: string;
  label: string;
  total: number;
  domId: string;
  items: PaletteItem[];
}

/**
 * Busca global e paleta de comandos (SCR-M02-02, UX 3.5): `<dialog class="dialog cmdk">` aberto por
 * `Ctrl+K`, pelo campo da barra superior ou por `/`. Tela cheia no celular.
 *
 * - Sem digitar: ações do perfil e recentes. Com 2 caracteres ou mais (ou `CUI-`): resultados agrupados,
 *   com contagem, 150 ms depois da última tecla, sem acento e sem diferenciar maiúscula.
 * - Combobox acessível: `role="combobox"` no campo, `role="listbox"` na lista e `aria-activedescendant`;
 *   ao filtrar anuncia "5 resultados".
 * - Teclado: setas movem, `Enter` abre, `Ctrl+Enter` abre em nova aba, `Tab` pula de grupo, `Esc` fecha.
 * - O texto digitado nunca vai para a URL, o título da aba nem o log (LP-21).
 * - A paleta nunca executa ação destrutiva: abre a tela ou o formulário.
 */
@Component({
  selector: 'app-command-palette',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dlg
      class="dialog cmdk"
      aria-label="Busca global e paleta de comandos"
      (cancel)="onCancel($event)"
      (keydown)="onKeydown($event)"
      (click)="onBackdropClick($event)"
    >
      <div class="cmdk__input">
        <div class="input-wrap">
          <svg appIcon="search"></svg>
          <input
            #input
            class="input"
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="nx-cmdk-list"
            aria-label="Buscar ou ir para"
            placeholder="Buscar ou ir para..."
            autocomplete="off"
            spellcheck="false"
            [attr.aria-expanded]="flat().length > 0"
            [attr.aria-activedescendant]="activeDomId()"
            [value]="query()"
            (input)="onInput($event)"
          />
        </div>
      </div>
      <div class="cmdk__list" id="nx-cmdk-list" role="listbox" aria-label="Resultados">
        @for (group of groups(); track group.key) {
          <div role="group" [attr.aria-labelledby]="group.domId">
            <p class="cmdk__group" [id]="group.domId">
              {{ group.label }} <span class="t-num">({{ group.total }})</span>
            </p>
            @for (item of group.items; track item.result.id) {
              <button
                type="button"
                tabindex="-1"
                class="cmdk__item"
                role="option"
                [id]="item.domId"
                [attr.aria-selected]="item.index === active() ? 'true' : 'false'"
                (click)="activate(item.result)"
                (mousemove)="active.set(item.index)"
              >
                <svg [appIcon]="iconOf(item.result.icon)"></svg>
                @if (item.result.code && item.result.title === item.result.code) {
                  <span class="code-chip"
                    ><svg appIcon="shield-check"></svg>{{ item.result.code }}</span
                  >
                  <span class="t-caption t-truncate">{{ item.result.subtitle }}</span>
                } @else {
                  <span class="flex-1 min-w-0">
                    <span class="t-truncate block">{{ item.result.title }}</span>
                    @if (item.result.subtitle) {
                      <span class="t-caption t-truncate block">{{ item.result.subtitle }}</span>
                    }
                  </span>
                }
              </button>
            }
          </div>
        }
        @if (response().message) {
          <p class="t-ui t-muted p-4" data-role="message">{{ response().message }}</p>
        }
      </div>
      <p class="sr-only" role="status" aria-live="polite">{{ liveStatus() }}</p>
      <div class="cmdk__foot">
        <span><kbd class="kbd">↑ ↓</kbd>navegar</span>
        <span><kbd class="kbd">Enter</kbd>abrir</span>
        <span><kbd class="kbd">Esc</kbd>fechar</span>
        <span class="t-caption">Só mostra o que o seu perfil pode ver.</span>
      </div>
    </dialog>
  `,
})
export class CommandPaletteComponent {
  private readonly palette = inject(PaletteService);
  private readonly search = inject(SearchService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');
  private readonly inputRef = viewChild.required<ElementRef<HTMLInputElement>>('input');
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  /** O que está no campo (imediato). */
  protected readonly query = signal('');
  /** O que vale para a busca (150 ms depois). */
  private readonly settled = signal('');
  protected readonly active = signal(0);

  protected readonly response = computed(() => this.search.search(this.settled()));

  protected readonly groups = computed<PaletteGroup[]>(() => {
    let index = 0;
    return this.response().groups.map((g: SearchGroup) => ({
      key: g.key,
      label: g.label,
      total: g.total,
      domId: `nx-cmdk-group-${g.key}`,
      items: g.results.map((result) => ({
        result,
        index: index++,
        domId: `nx-cmdk-opt-${index - 1}`,
      })),
    }));
  });

  protected readonly flat = computed(() => this.groups().flatMap((g) => g.items));
  protected readonly activeDomId = computed(() => this.flat()[this.active()]?.domId ?? null);

  protected readonly liveStatus = computed(() => {
    if (this.settled().trim().length < 2) {
      return '';
    }
    const total = this.response().total;
    return total === 0 ? 'Nenhum resultado' : total === 1 ? '1 resultado' : `${total} resultados`;
  });

  constructor() {
    effect(() => {
      const open = this.palette.isOpen();
      untracked(() => (open ? this.open() : this.close()));
    });
    // A seleção volta ao primeiro item quando os resultados mudam, e o item ativo fica à vista.
    effect(() => {
      this.response();
      untracked(() => this.active.set(0));
    });
    effect(() => {
      const id = this.activeDomId();
      if (id) {
        untracked(() =>
          afterNextRender(
            () => document.getElementById(id)?.scrollIntoView?.({ block: 'nearest' }),
            { injector: this.injector },
          ),
        );
      }
    });
  }

  protected onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.query.set(value);
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }
    if (value.trim().length < 2) {
      this.settled.set(value);
      return;
    }
    this.debounceTimer = setTimeout(() => this.settled.set(value), SEARCH_DEBOUNCE_MS);
  }

  protected onCancel(event: Event): void {
    event.preventDefault();
    this.palette.close();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialogRef().nativeElement) {
      this.palette.close();
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.flat().length;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.active.set(count === 0 ? 0 : (this.active() + 1) % count);
        return;
      case 'ArrowUp':
        event.preventDefault();
        this.active.set(count === 0 ? 0 : (this.active() - 1 + count) % count);
        return;
      case 'Home':
        if (event.ctrlKey) {
          event.preventDefault();
          this.active.set(0);
        }
        return;
      case 'End':
        if (event.ctrlKey) {
          event.preventDefault();
          this.active.set(Math.max(0, count - 1));
        }
        return;
      case 'Tab':
        event.preventDefault();
        this.jumpGroup(event.shiftKey ? -1 : 1);
        return;
      case 'Enter': {
        event.preventDefault();
        const item = this.flat()[this.active()];
        if (item) {
          this.activate(item.result, event.ctrlKey || event.metaKey);
        }
        return;
      }
      case 'Escape':
        event.preventDefault();
        this.palette.close();
        return;
    }
  }

  /** Abre o resultado: na mesma aba, ou em nova aba com `Ctrl+Enter`. */
  protected iconOf(name: string): IconName {
    return toIconName(name);
  }

  protected activate(result: SearchResult, newTab = false): void {
    this.search.recordOpened(result);
    this.palette.close();
    if (newTab) {
      const tree = this.router.createUrlTree([result.link], {
        ...(result.queryParams ? { queryParams: result.queryParams } : {}),
      });
      window.open(this.router.serializeUrl(tree), '_blank', 'noopener');
      return;
    }
    void this.router.navigate([result.link], {
      ...(result.queryParams ? { queryParams: result.queryParams } : {}),
    });
  }

  private jumpGroup(direction: 1 | -1): void {
    const groups = this.groups();
    if (groups.length === 0) {
      return;
    }
    const current = groups.findIndex((g) => g.items.some((i) => i.index === this.active()));
    const next = (current + direction + groups.length) % groups.length;
    const first = groups[next]?.items[0];
    if (first) {
      this.active.set(first.index);
    }
  }

  private open(): void {
    this.query.set('');
    this.settled.set('');
    this.active.set(0);
    showModalDialog(this.dialogRef().nativeElement);
    afterNextRender(() => this.inputRef().nativeElement.focus(), { injector: this.injector });
  }

  private close(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    closeModalDialog(this.dialogRef().nativeElement);
  }
}
