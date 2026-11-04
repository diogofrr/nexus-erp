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
import { ActiveDialog, ConfirmResult, DialogService, DialogTone } from './dialog.service';
import { GlyphComponent } from './glyph.component';
import { closeModalDialog, showModalDialog } from './modal';

const TONE_ICON: Record<DialogTone, string> = {
  danger: 'octagon-alert',
  attention: 'triangle-alert',
  info: 'info',
};

/** Falha ao concluir o trabalho do diálogo (frase do catálogo de erros, 7.4 do design system). */
export const DIALOG_RUN_ERROR =
  'Não foi possível concluir. Tente de novo; se continuar, avise a equipe.';

/**
 * Desenha o diálogo de confirmação do `DialogService` num `<dialog>` nativo aberto por `showModal()`:
 * foco preso, Esc cancela, o foco volta a quem abriu. Monte UMA vez, na raiz do aplicativo.
 */
@Component({
  selector: 'app-dialog-host',
  imports: [GlyphComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dlg
      class="dialog"
      [attr.aria-labelledby]="titleId()"
      [attr.aria-describedby]="bodyId()"
      (cancel)="onCancelEvent($event)"
      (keydown.escape)="onEscape($event)"
    >
      @if (active(); as d) {
        <div class="dialog__header">
          <span
            class="dialog__icon"
            [class.dialog__icon--danger]="d.tone === 'danger'"
            [class.dialog__icon--attention]="d.tone === 'attention'"
          >
            <svg [appGlyph]="icon()" glyphSize="lg"></svg>
          </span>
          <h2 class="dialog__title" [id]="titleId()">{{ d.config.title }}</h2>
        </div>
        <div class="dialog__body" [id]="bodyId()">
          @if (d.config.message) {
            <p>{{ d.config.message }}</p>
          }
          @if (hasEffects()) {
            <ul class="effects">
              @if (d.config.effects?.erase?.length) {
                <li class="is-erase">
                  <svg appGlyph="trash-2"></svg>
                  <span
                    ><strong>Será eliminado:</strong> {{ joinItems(d.config.effects.erase) }}.</span
                  >
                </li>
              }
              @if (d.config.effects?.block?.length) {
                <li class="is-block">
                  <svg appGlyph="lock"></svg>
                  <span
                    ><strong>Ficará bloqueado:</strong>
                    {{ joinItems(d.config.effects.block) }}.</span
                  >
                </li>
              }
              @if (d.config.effects?.keep?.length) {
                <li class="is-keep">
                  <svg appGlyph="shield-check"></svg>
                  <span
                    ><strong>Continua registrado:</strong>
                    {{ joinItems(d.config.effects.keep) }}.</span
                  >
                </li>
              }
            </ul>
          }
          @if (d.config.irreversibleNote) {
            <p>
              <strong>{{ d.config.irreversibleNote }}</strong>
            </p>
          }
          @if (d.config.checkbox; as box) {
            <label class="check">
              <input type="checkbox" [checked]="boxChecked()" (change)="onBoxChange($event)" />
              <span>{{ box.label }}</span>
            </label>
          }
          @if (d.level === 3 && d.config.typeToConfirm) {
            <div class="field">
              <label class="field__label" [for]="inputId()"
                >Digite {{ d.config.typeToConfirm }} para continuar</label
              >
              <input
                class="input"
                [id]="inputId()"
                type="text"
                autocomplete="off"
                autocapitalize="characters"
                spellcheck="false"
                [value]="typed()"
                [attr.aria-describedby]="inputId() + '-hint'"
                (input)="onTyped($event)"
                (keydown.enter)="onConfirm()"
              />
              <span class="field__hint" [id]="inputId() + '-hint'">
                O botão fica ativo quando o texto for igual a {{ d.config.typeToConfirm }}.
              </span>
            </div>
          }
          @if (error()) {
            <p class="field__error" role="alert">
              <svg appGlyph="circle-alert"></svg>
              <span><span class="sr-only">Erro: </span>{{ error() }}</span>
            </p>
          }
        </div>
        <div class="dialog__footer">
          <button
            type="button"
            class="btn"
            data-role="cancel"
            [disabled]="busy()"
            (click)="onCancel()"
          >
            {{ d.config.cancelLabel ?? 'Voltar' }}
          </button>
          <button
            type="button"
            class="btn"
            [class.btn--danger]="d.tone === 'danger'"
            [class.btn--primary]="d.tone !== 'danger'"
            data-role="confirm"
            [disabled]="!canConfirm()"
            [attr.aria-busy]="busy() ? 'true' : null"
            (click)="onConfirm()"
          >
            <span>{{
              busy() && d.config.busyLabel ? d.config.busyLabel : d.config.confirmLabel
            }}</span>
          </button>
        </div>
      }
    </dialog>
  `,
})
export class DialogHostComponent {
  private readonly service = inject(DialogService);
  private readonly injector = inject(Injector);
  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  protected readonly active = this.service.current;
  protected readonly typed = signal('');
  protected readonly boxChecked = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly titleId = computed(() => `nx-dialog-title-${this.active()?.id ?? 0}`);
  protected readonly bodyId = computed(() => `nx-dialog-body-${this.active()?.id ?? 0}`);
  protected readonly inputId = computed(() => `nx-dialog-input-${this.active()?.id ?? 0}`);
  protected readonly icon = computed(() => {
    const d = this.active();
    return d ? (d.config.icon ?? TONE_ICON[d.tone]) : 'info';
  });
  protected readonly hasEffects = computed(() => {
    const e = this.active()?.config.effects;
    return !!e && !!(e.erase?.length || e.block?.length || e.keep?.length);
  });
  protected readonly canConfirm = computed(() => {
    const d = this.active();
    if (!d || this.busy()) {
      return false;
    }
    if (d.level === 3 && d.config.typeToConfirm) {
      return this.matches(d, this.typed());
    }
    return true;
  });

  constructor() {
    effect(() => {
      const d = this.active();
      untracked(() => (d ? this.open(d) : this.closeNative()));
    });
  }

  protected joinItems(items: readonly string[] | undefined): string {
    return (items ?? []).join('; ');
  }

  protected onTyped(event: Event): void {
    this.typed.set((event.target as HTMLInputElement).value);
  }

  protected onBoxChange(event: Event): void {
    this.boxChecked.set((event.target as HTMLInputElement).checked);
  }

  protected onCancelEvent(event: Event): void {
    event.preventDefault();
    this.onCancel();
  }

  protected onEscape(event: Event): void {
    event.preventDefault();
    this.onCancel();
  }

  protected onCancel(): void {
    const d = this.active();
    if (!d || this.busy()) {
      return;
    }
    this.finish(d, { confirmed: false, checkbox: this.boxChecked() });
  }

  protected async onConfirm(): Promise<void> {
    const d = this.active();
    if (!d || !this.canConfirm()) {
      return;
    }
    const result: ConfirmResult = { confirmed: true, checkbox: this.boxChecked() };
    if (d.config.run) {
      this.busy.set(true);
      this.error.set(null);
      try {
        await d.config.run(result);
      } catch {
        this.busy.set(false);
        this.error.set(DIALOG_RUN_ERROR);
        return;
      }
      this.busy.set(false);
    }
    this.finish(d, result);
  }

  private finish(d: ActiveDialog, result: ConfirmResult): void {
    closeModalDialog(this.dialogRef().nativeElement);
    this.service.settle(d.id, result);
  }

  private matches(d: ActiveDialog, typed: string): boolean {
    return typed.trim().toLowerCase() === (d.config.typeToConfirm ?? '').trim().toLowerCase();
  }

  private open(d: ActiveDialog): void {
    this.typed.set('');
    this.busy.set(false);
    this.error.set(null);
    this.boxChecked.set(d.config.checkbox?.checked ?? false);
    const dialog = this.dialogRef().nativeElement;
    showModalDialog(dialog);
    afterNextRender(
      () => {
        const which = d.config.initialFocus ?? 'cancel';
        dialog.querySelector<HTMLElement>(`[data-role="${which}"]`)?.focus();
      },
      { injector: this.injector },
    );
  }

  private closeNative(): void {
    closeModalDialog(this.dialogRef().nativeElement);
  }
}
