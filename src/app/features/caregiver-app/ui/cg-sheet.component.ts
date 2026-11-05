import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  effect,
  inject,
  input,
  model,
  viewChild,
} from '@angular/core';
import { closeModalDialog, isDialogOpen, showModalDialog } from '../../../shared/ui/overlay/modal';
import { uniqueId } from '../../../shared/ui/util/ids';

/**
 * Folha de baixo (UX A.2.17): toda confirmação e todo formulário curto, ao alcance do polegar. Abaixo de 768 px
 * fica ancorada na base (raio de 24 px no alto, alça, ações empilhadas com a principal em cima); de 768 px em
 * diante é um diálogo central de 560 px. É um `<dialog>` modal de verdade: o foco vai ao título, o resto da página
 * fica inerte, Esc e toque no fundo fecham e o foco VOLTA a quem abriu. Não empilhe duas folhas.
 *
 * Confirmação de ato com efeito: descreva o que acontece, quando e o que continua em 2 a 4 linhas (use
 * `<ul class="effects">` do design system) e dê ao botão o nome da ação ("Cancelar a conversa"), nunca "Sim".
 * No ato irreversível o foco inicial deve ficar no botão seguro ("Voltar").
 *
 * ```html
 * <app-cg-sheet heading="Cancelar a conversa?" [(open)]="confirming">
 *   <p>A conversa de quinta, 06/11, às 14:00 será cancelada.</p>
 *   <ng-container cgSheetActions>
 *     <button class="btn btn--primary" (click)="cancel()">Cancelar a conversa</button>
 *     <button class="cg-link-btn" (click)="confirming.set(false)">Voltar</button>
 *   </ng-container>
 * </app-cg-sheet>
 * ```
 */
@Component({
  selector: 'app-cg-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cg-sheet-host' },
  template: `
    <dialog
      #dialog
      class="cg-sheet"
      [attr.aria-labelledby]="titleId"
      (close)="onNativeClose()"
      (click)="onDialogClick($event)"
    >
      <div class="cg-sheet__panel">
        <span class="cg-sheet__handle" aria-hidden="true"></span>
        <h2 class="cg-sheet__title" [id]="titleId" tabindex="-1" #title>{{ heading() }}</h2>
        <div class="cg-sheet__body"><ng-content /></div>
        <div class="cg-sheet__actions"><ng-content select="[cgSheetActions]" /></div>
      </div>
    </dialog>
  `,
})
export class CgSheetComponent {
  private readonly injector = inject(Injector);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly title = viewChild.required<ElementRef<HTMLElement>>('title');

  readonly heading = input.required<string>();
  /** A folha está aberta? `[(open)]` abre e fecha. */
  readonly open = model(false);
  /** Foco inicial: no título (padrão) ou no último botão de ação ("Voltar", o seguro). */
  readonly initialFocus = input<'title' | 'safe-action'>('title');

  protected readonly titleId = uniqueId('cg-sheet');

  constructor() {
    effect(() => {
      const wanted = this.open();
      const dialog = this.dialog().nativeElement;
      if (wanted && !isDialogOpen(dialog)) {
        showModalDialog(dialog);
        afterNextRender(() => this.focusInitial(), { injector: this.injector });
      } else if (!wanted && isDialogOpen(dialog)) {
        closeModalDialog(dialog);
      }
    });
  }

  /** Esc fecha pelo navegador: o estado acompanha. */
  protected onNativeClose(): void {
    if (this.open()) {
      this.open.set(false);
    }
  }

  /** Toque no fundo escurecido: o alvo do clique é o próprio `<dialog>`, não o painel. */
  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) {
      this.open.set(false);
    }
  }

  private focusInitial(): void {
    if (this.initialFocus() === 'safe-action') {
      const actions = this.dialog().nativeElement.querySelectorAll<HTMLElement>(
        '.cg-sheet__actions button, .cg-sheet__actions a',
      );
      const safe = actions.item(actions.length - 1);
      if (safe) {
        safe.focus();
        return;
      }
    }
    this.title().nativeElement.focus();
  }
}
