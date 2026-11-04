import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { IconComponent } from '../display/icon.component';

export interface ErrorSummaryItem {
  /** Id do controle (o mesmo de `controlId` do `app-form-field`), para o link focar o campo. */
  controlId: string;
  /** A MESMA frase que aparece embaixo do campo. */
  message: string;
}

/**
 * Resumo de erros no topo do formulário (`.error-summary`, `role="alert"`). Cada item é um link que leva o
 * foco ao campo. Quando passa de vazio a cheio, o foco vai para o resumo (ao enviar o formulário). Fica
 * escondido (e fora da árvore de acessibilidade) quando não há erros.
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
    tabindex: '-1',
    '[hidden]': 'items().length === 0',
  },
  template: `
    <h2><svg appIcon="circle-alert"></svg>{{ title() }}</h2>
    <ul>
      @for (item of items(); track item.controlId) {
        <li>
          <a [attr.href]="'#' + item.controlId" (click)="goTo($event, item)">{{ item.message }}</a>
        </li>
      }
    </ul>
  `,
})
export class ErrorSummaryComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly doc = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  readonly items = input<readonly ErrorSummaryItem[]>([]);
  /** Leva o foco ao resumo quando ele aparece. */
  readonly autoFocus = input(true, { transform: booleanAttribute });

  protected readonly title = computed(() => {
    const n = this.items().length;
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
