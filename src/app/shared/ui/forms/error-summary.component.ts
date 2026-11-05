import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterEveryRender,
  afterNextRender,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { IconComponent } from '../display/icon.component';

export interface ErrorSummaryItem {
  /** Id do controle (o mesmo de `controlId` do `app-form-field`), para o link focar o campo. */
  controlId: string;
  /** A MESMA frase que aparece embaixo do campo. */
  message: string;
}

/** O campo (ou algo dentro dele) está marcado como inválido na tela? */
function isFlaggedInvalid(element: Element): boolean {
  return (
    element.getAttribute('aria-invalid') === 'true' ||
    element.classList.contains('field--error') ||
    element.querySelector('[aria-invalid="true"], .field--error') !== null
  );
}

/**
 * Resumo de erros no topo do formulário (`.error-summary`, `role="alert"`). Cada item é um link que leva o
 * foco ao campo. Quando passa de vazio a cheio, o foco vai para o resumo (ao enviar o formulário). Fica
 * escondido, sem texto nenhum (nada de "Há 0 pontos", QA-008), quando não há erros.
 *
 * Conforme a pessoa corrige os campos, o item some do resumo (CX-043) e o resumo deixa de ser anunciado de
 * novo (V33: o leitor de tela ouve o aviso uma vez, quando ele aparece). Só somem os itens que o componente viu
 * marcados como inválidos no campo (`aria-invalid` ou `.field--error`); o resto continua até o próximo envio.
 *
 * ```html
 * <app-error-summary [items]="errors()" />
 * ```
 */
@Component({
  selector: 'app-error-summary',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'error-summary',
    role: 'alert',
    '[attr.aria-live]': "announce() ? null : 'off'",
    tabindex: '-1',
    '[hidden]': 'visibleItems().length === 0',
  },
  template: `
    @if (visibleItems().length > 0) {
      <h2><svg appIcon="circle-alert"></svg>{{ title() }}</h2>
      <ul>
        @for (item of visibleItems(); track item.controlId) {
          <li>
            <a [attr.href]="'#' + item.controlId" (click)="goTo($event, item)">{{ item.message }}</a>
          </li>
        }
      </ul>
    }
  `,
})
export class ErrorSummaryComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly doc = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  readonly items = input<readonly ErrorSummaryItem[]>([]);
  /** Leva o foco ao resumo quando ele aparece. */
  readonly autoFocus = input(true, { transform: booleanAttribute });

  /** Ids dos itens já corrigidos pela pessoa (o campo deixou de estar inválido). */
  private readonly resolved = signal<ReadonlySet<string>>(new Set());
  /** `false` depois da primeira correção: o resumo muda em silêncio, sem anunciar de novo. */
  protected readonly announce = signal(true);
  /** Itens que o componente viu inválidos no campo; só esses podem sumir quando forem corrigidos. */
  private tracked = new Set<string>();

  protected readonly visibleItems = computed(() => this.items().filter((item) => !this.resolved().has(item.controlId)));

  protected readonly title = computed(() => {
    const n = this.visibleItems().length;
    return `Há ${n} ${n === 1 ? 'ponto' : 'pontos'} para corrigir`;
  });

  constructor() {
    let previous = 0;
    effect(() => {
      const count = this.items().length;
      if (count > 0 && previous === 0 && this.autoFocus()) {
        afterNextRender(() => this.focus(), { injector: this.injector });
      }
      previous = count;
    });
    // Itens novos (outro envio): recomeça a conferência e volta a anunciar.
    effect(() => {
      this.items();
      untracked(() => {
        this.tracked = new Set();
        this.resolved.set(new Set());
        this.announce.set(true);
      });
    });
    afterEveryRender(() => this.syncResolved());
  }

  private syncResolved(): void {
    const items = this.items();
    if (items.length === 0) {
      return;
    }
    const next = new Set<string>();
    items.forEach((item) => {
      const element = this.doc.getElementById(item.controlId);
      if (element && isFlaggedInvalid(element)) {
        this.tracked.add(item.controlId);
      } else if (this.tracked.has(item.controlId)) {
        next.add(item.controlId);
      }
    });
    const current = this.resolved();
    if (next.size === current.size && [...next].every((id) => current.has(id))) {
      return;
    }
    this.resolved.set(next);
    if (next.size > 0) {
      this.announce.set(false);
    }
  }

  /** Leva o foco ao resumo (chame de novo a cada tentativa de envio com os mesmos erros). */
  focus(): void {
    this.host.nativeElement.focus();
  }

  protected goTo(event: Event, item: ErrorSummaryItem): void {
    event.preventDefault();
    const target = this.doc.getElementById(item.controlId);
    // Um grupo (opção única, caixas) não é focável: leva o foco ao primeiro controle dentro dele.
    const focusable = target?.matches('input, select, textarea, button, a[href]')
      ? target
      : target?.querySelector<HTMLElement>('input, select, textarea, button');
    focusable?.focus();
  }
}
