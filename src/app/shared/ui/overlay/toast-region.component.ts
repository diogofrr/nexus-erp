import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IconComponent, IconName } from '../display/icon.component';
import { isTypingTarget } from './modal';
import { ToastItem, ToastService, ToastTone } from './toast.service';

const TONE_ICON: Record<ToastTone, IconName> = {
  success: 'circle-check',
  attention: 'triangle-alert',
  danger: 'octagon-alert',
  info: 'info',
};

/**
 * Região de toasts (canto inferior direito; no celular, centralizada). Fica numa região `aria-live`. Pausa a contagem com o mouse em cima ou com o foco dentro.
 * `Ctrl+Z` (ou `Cmd+Z`) desfaz o toast mais recente que tem "Desfazer", fora de campos de texto.
 * Monte UMA vez, na raiz do aplicativo.
 */
@Component({
  selector: 'app-toast-region',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKeydown($event)' },
  template: `
    <div class="toast-region" aria-live="polite" aria-atomic="false">
      @for (toast of toasts.toasts(); track toast.id) {
        <div
          class="toast"
          [class.toast--success]="toast.tone === 'success'"
          [class.toast--attention]="toast.tone === 'attention'"
          [class.toast--danger]="toast.tone === 'danger'"
          [attr.role]="toast.tone === 'danger' ? 'alert' : 'status'"
          (mouseenter)="toasts.hold(toast.id)"
          (mouseleave)="toasts.release(toast.id)"
          (focusin)="toasts.hold(toast.id)"
          (focusout)="toasts.release(toast.id)"
        >
          <svg [appIcon]="iconOf(toast)"></svg>
          <div class="flex-1">
            @if (toast.title) {
              <strong>{{ toast.title }}</strong>
            }
            <span>{{ toast.message }}</span>
          </div>
          @if (toast.action; as action) {
            <button type="button" class="toast__action" (click)="toasts.runAction(toast.id)">
              {{ action.label }}
            </button>
          }
          <button
            type="button"
            class="btn btn--ghost btn--icon btn--sm toast__close"
            aria-label="Fechar aviso"
            (click)="toasts.dismiss(toast.id)"
          >
            <svg appIcon="x" size="sm"></svg>
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastRegionComponent {
  protected readonly toasts = inject(ToastService);

  protected iconOf(toast: ToastItem): IconName {
    return TONE_ICON[toast.tone];
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key.toLowerCase() !== 'z' || !(event.ctrlKey || event.metaKey) || event.shiftKey) {
      return;
    }
    if (isTypingTarget(event.target)) {
      return;
    }
    if (this.toasts.undoLatest()) {
      event.preventDefault();
    }
  }
}
