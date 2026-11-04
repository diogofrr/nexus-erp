import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { GlyphComponent } from './glyph.component';
import { isTypingTarget } from './modal';
import { ToastItem, ToastService, ToastTone } from './toast.service';

const TONE_ICON: Record<ToastTone, string> = {
  success: 'circle-check',
  attention: 'triangle-alert',
  danger: 'octagon-alert',
  info: 'info',
};

/**
 * Região de toasts (canto inferior direito; no celular, centralizada e acima da barra inferior do
 * portal). Fica numa região `aria-live`. Pausa a contagem com o mouse em cima ou com o foco dentro.
 * `Ctrl+Z` (ou `Cmd+Z`) desfaz o toast mais recente que tem "Desfazer", fora de campos de texto.
 * Monte UMA vez, na raiz do aplicativo.
 */
@Component({
  selector: 'app-toast-region',
  imports: [GlyphComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKeydown($event)' },
  template: `
    <div
      class="toast-region"
      [class.toast-region--above-nav]="aboveNav()"
      aria-live="polite"
      aria-atomic="false"
    >
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
          <svg [appGlyph]="iconOf(toast)"></svg>
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
            <svg appGlyph="x" glyphSize="sm"></svg>
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastRegionComponent {
  protected readonly toasts = inject(ToastService);
  private readonly router = inject(Router);

  /** No portal, a barra inferior ocupa o rodapé: o toast sobe. */
  protected readonly aboveNav = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects.startsWith('/portal')),
      startWith(this.router.url.startsWith('/portal')),
    ),
    { initialValue: false },
  );

  protected iconOf(toast: ToastItem): string {
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
