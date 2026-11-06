import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, input, model, signal, viewChild } from '@angular/core';
import { IconComponent } from '@shared/ui';
import { copyOrSelect } from '../../../../shared/ui/util/clipboard';
import { COPY_NUMBER_FAILED, NUMBER_COPIED } from '../../state/copy-feedback';
import { CgNoteComponent } from '../../ui/cg-note.component';
import { CgSheetComponent } from '../../ui/cg-sheet.component';
import { HelpNumber, NO_CALL_IN_PROTOTYPE } from '../state/help-numbers';

/**
 * Diálogo do número de ajuda (UX C3, AC-CG-35, S-13): número grande (40 px), "Copiar número" e a frase de que, no
 * protótipo, a ligação não é feita. NUNCA abre `tel:`. Se o navegador negar a área de transferência, o número fica
 * selecionado e a frase diz como copiar à mão. Abre sem sessão e sem consentimento.
 *
 * ```html
 * <app-call-number-sheet [number]="shown()" [(open)]="sheetOpen" />
 * ```
 */
@Component({
  selector: 'app-call-number-sheet',
  imports: [CgSheetComponent, CgNoteComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .call__number {
        margin: 0;
        font-size: 2.5rem;
        line-height: 1.1;
        font-weight: 600;
        letter-spacing: 0.04em;
        color: var(--cg-heading);
        font-variant-numeric: tabular-nums;
        user-select: all;
        outline: none;
      }
      .call__status { margin: 0; min-height: 1.5em; color: var(--cg-text-soft); }
    `,
  ],
  template: `
    <app-cg-sheet [heading]="heading()" [(open)]="open">
      @if (help(); as item) {
        <p class="cg-muted">{{ item.about }}</p>
        <p class="call__number" data-role="call-number" #numberEl>{{ item.number }}</p>
        <p class="call__status" role="status" aria-live="polite" data-role="call-feedback">{{ feedback() }}</p>
        <app-cg-note variant="soft" icon="info">{{ notice }}</app-cg-note>
      }
      <ng-container cgSheetActions>
        <button type="button" class="btn btn--primary" (click)="copy()">
          <svg appIcon="copy" size="sm"></svg>Copiar número
        </button>
        <button type="button" class="cg-link-btn" (click)="open.set(false)">Voltar</button>
      </ng-container>
    </app-cg-sheet>
  `,
})
export class CallNumberSheetComponent {
  private readonly doc = inject(DOCUMENT);
  private readonly numberEl = viewChild<ElementRef<HTMLElement>>('numberEl');

  /** O número a mostrar; `null` com a folha fechada. */
  readonly help = input<HelpNumber | null>(null);
  readonly open = model(false);

  protected readonly notice = NO_CALL_IN_PROTOTYPE;
  protected readonly feedback = signal('');

  constructor() {
    effect(() => {
      if (!this.open()) {
        this.feedback.set('');
      }
    });
  }

  protected heading(): string {
    const item = this.help();
    return item ? `${item.name} ${item.number}` : 'Ligar';
  }

  protected async copy(): Promise<void> {
    const item = this.help();
    if (!item) {
      return;
    }
    const copied = await copyOrSelect(item.number, this.numberEl()?.nativeElement, this.doc);
    this.feedback.set(copied ? NUMBER_COPIED : COPY_NUMBER_FAILED);
  }
}
