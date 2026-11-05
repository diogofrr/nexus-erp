import { NgTemplateOutlet } from '@angular/common';
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
  output,
  untracked,
  viewChild,
} from '@angular/core';
import { IconComponent } from '../display/icon.component';
import { closeModalDialog, showModalDialog } from './modal';

let drawerSequence = 0;

/**
 * Gaveta lateral de detalhe ou de formulário curto (até uns 6 campos). Abre à direita (30 rem; tela cheia
 * no celular), fecha com Esc, com o botão "Fechar" ou ao clicar fora, e devolve o foco a quem abriu.
 *
 * Dois modos:
 * - **Modal** (padrão): `<dialog class="drawer">` com `showModal()`; foco preso.
 * - **Acoplada** (`[docked]="true"`, padrão PD-02: mensagens, solicitações do titular): não é modal; ocupa a
 *   coluna da direita de `.layout-list-detail` e a lista continua navegável. Esc fecha e o foco volta à
 *   linha de origem (`[returnFocusTo]`) ou a quem tinha o foco.
 *
 * ```html
 * <app-drawer [(open)]="detailOpen" heading="Solicitação de acesso" subtitle="Recebida em 02/11/2026">
 *   <dl class="dl">...</dl>
 *   <ng-container drawerFooter>
 *     <button class="btn" (click)="detailOpen.set(false)">Cancelar</button>
 *     <button class="btn btn--primary">Atender</button>
 *   </ng-container>
 * </app-drawer>
 * ```
 */
@Component({
  selector: 'app-drawer',
  imports: [IconComponent, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'drawer-host' },
  template: `
    <ng-template #content>
      <div class="drawer__header">
        <div>
          <h2 class="drawer__title" [id]="titleId" tabindex="-1" #title>{{ heading() }}</h2>
          @if (subtitle()) {
            <p class="t-caption">{{ subtitle() }}</p>
          }
        </div>
        <button
          type="button"
          class="btn btn--ghost btn--icon"
          [attr.aria-label]="closeLabel()"
          (click)="close()"
        >
          <svg appIcon="x"></svg>
        </button>
      </div>
      <div class="drawer__body"><ng-content /></div>
      <div class="drawer__footer"><ng-content select="[drawerFooter]" /></div>
    </ng-template>

    @if (docked()) {
      @if (open()) {
        <aside
          class="drawer drawer--docked"
          [attr.aria-labelledby]="titleId"
          (keydown.escape)="onDockedEscape($event)"
        >
          <ng-container [ngTemplateOutlet]="content" />
        </aside>
      }
    } @else {
      <dialog
        #dlg
        class="drawer"
        [attr.aria-labelledby]="titleId"
        (cancel)="onCancel($event)"
        (click)="onBackdropClick($event)"
      >
        <ng-container [ngTemplateOutlet]="content" />
      </dialog>
    }
  `,
})
export class DrawerComponent {
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Aberta ou fechada. Aceita `[(open)]`. */
  readonly open = model(false);
  readonly heading = input.required<string>();
  readonly subtitle = input<string>('');
  readonly docked = input(false);
  readonly closeLabel = input('Fechar');
  /** Elemento que recebe o foco ao fechar (a linha de origem). Padrão: quem tinha o foco ao abrir. */
  readonly returnFocusTo = input<HTMLElement | null>(null);
  readonly closed = output<void>();

  protected readonly titleId = `nx-drawer-title-${++drawerSequence}`;
  private readonly dialogRef = viewChild<ElementRef<HTMLDialogElement>>('dlg');
  private dockedOpener: HTMLElement | null = null;

  constructor() {
    effect(() => {
      const isOpen = this.open();
      const dialog = this.dialogRef()?.nativeElement;
      const docked = this.docked();
      untracked(() => {
        if (docked) {
          this.syncDocked(isOpen);
        } else if (dialog) {
          this.syncModal(dialog, isOpen);
        }
      });
    });
  }

  close(): void {
    if (this.open()) {
      this.open.set(false);
      this.closed.emit();
    }
  }

  protected onCancel(event: Event): void {
    event.preventDefault();
    this.close();
  }

  protected onDockedEscape(event: Event): void {
    event.preventDefault();
    this.close();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialogRef()?.nativeElement) {
      this.close();
    }
  }

  private syncModal(dialog: HTMLDialogElement, isOpen: boolean): void {
    if (isOpen) {
      showModalDialog(dialog);
      afterNextRender(() => dialog.querySelector<HTMLElement>('.drawer__header .btn')?.focus(), {
        injector: this.injector,
      });
    } else {
      closeModalDialog(dialog);
    }
  }

  private syncDocked(isOpen: boolean): void {
    const doc = this.host.nativeElement.ownerDocument;
    if (isOpen) {
      const active = doc.activeElement;
      this.dockedOpener = active instanceof HTMLElement && active !== doc.body ? active : null;
      afterNextRender(
        () => this.host.nativeElement.querySelector<HTMLElement>('.drawer__title')?.focus(),
        { injector: this.injector },
      );
    } else if (this.dockedOpener !== null || this.returnFocusTo()) {
      const target = this.returnFocusTo() ?? this.dockedOpener;
      this.dockedOpener = null;
      if (target?.isConnected) {
        target.focus();
      }
    }
  }
}
