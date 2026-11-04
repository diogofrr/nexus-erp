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
import { AuthService } from '../../../core/auth/auth.service';
import { InactivityService } from '../../../core/auth/inactivity.service';
import { GlyphComponent } from './glyph.component';
import { closeModalDialog, showModalDialog } from './modal';

/** `119` segundos viram `1:59`. */
export function formatCountdown(totalSeconds: number | null): string {
  const safe = Math.max(0, totalSeconds ?? 0);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** `100` segundos viram "1 minuto e 40 segundos" (para o leitor de tela). */
export function spokenTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  const m = `${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
  const sec = `${seconds} ${seconds === 1 ? 'segundo' : 'segundos'}`;
  return minutes === 0 ? sec : seconds === 0 ? m : `${m} e ${sec}`;
}

/**
 * Aviso de sessão expirando (SCR-M01-04, AC-M01-07, UX 6.8): diálogo modal aos 28 minutos de inatividade
 * com a contagem regressiva e dois botões, "Continuar conectado" (foco inicial) e "Sair agora".
 *
 * A contagem é visual. O leitor de tela recebe o aviso ao abrir, em 1:00 e em 0:30, nunca a cada segundo
 * (WCAG 2.2.1). Interagir fora do diálogo não o fecha (o `InactivityService` só reinicia pelo "continuar").
 * Esc equivale a "Continuar conectado". Ao chegar a zero, o serviço encerra a sessão e o aplicativo leva
 * à tela de sessão expirada. Monte UMA vez, na raiz.
 */
@Component({
  selector: 'app-session-dialog',
  imports: [GlyphComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dlg
      class="dialog"
      role="alertdialog"
      aria-labelledby="nx-session-title"
      aria-describedby="nx-session-live"
      (cancel)="onCancel($event)"
      (keydown.escape)="onCancel($event)"
    >
      <div class="dialog__header">
        <span class="dialog__icon dialog__icon--attention"
          ><svg appGlyph="clock" glyphSize="lg"></svg
        ></span>
        <h2 class="dialog__title" id="nx-session-title">Sua sessão está para terminar</h2>
      </div>
      <div class="dialog__body">
        <p aria-hidden="true">
          Sua sessão termina em
          <strong class="t-num" data-role="countdown">{{ countdown() }}</strong> por inatividade.
          Quer continuar conectado?
        </p>
        <p class="sr-only" id="nx-session-live" aria-live="polite">{{ liveMessage() }}</p>
        <p class="t-caption">O que você estava preenchendo fica guardado como rascunho.</p>
      </div>
      <div class="dialog__footer">
        <button type="button" class="btn" data-role="leave" (click)="leave()">Sair agora</button>
        <button type="button" class="btn btn--primary" data-role="extend" (click)="extend()">
          Continuar conectado
        </button>
      </div>
    </dialog>
  `,
})
export class SessionDialogComponent {
  private readonly inactivity = inject(InactivityService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  protected readonly countdown = computed(() => formatCountdown(this.inactivity.secondsLeft()));
  protected readonly liveMessage = signal('');
  private announced = new Set<number>();

  constructor() {
    // Abre e fecha o diálogo conforme o aviso do serviço de inatividade.
    effect(() => {
      const visible = this.inactivity.warningVisible();
      untracked(() => (visible ? this.open() : this.close()));
    });
    // Avisos para o leitor de tela: ao abrir, em 1:00 e em 0:30.
    effect(() => {
      const visible = this.inactivity.warningVisible();
      const left = this.inactivity.secondsLeft();
      untracked(() => this.announce(visible, left));
    });
  }

  protected extend(): void {
    this.inactivity.extend();
  }

  protected leave(): void {
    this.auth.logout('user');
    void this.router.navigateByUrl('/login');
  }

  protected onCancel(event: Event): void {
    event.preventDefault();
    this.extend();
  }

  private open(): void {
    const dialog = this.dialogRef().nativeElement;
    showModalDialog(dialog);
    afterNextRender(() => dialog.querySelector<HTMLElement>('[data-role="extend"]')?.focus(), {
      injector: this.injector,
    });
  }

  private close(): void {
    closeModalDialog(this.dialogRef().nativeElement);
  }

  private announce(visible: boolean, left: number | null): void {
    if (!visible || left === null) {
      this.announced = new Set<number>();
      this.liveMessage.set('');
      return;
    }
    if (this.announced.size === 0) {
      // Ao abrir: o aviso completo. Marca como já ditos os limiares que o tempo restante já passou.
      this.announced.add(0);
      [60, 30].filter((t) => left <= t).forEach((t) => this.announced.add(t));
      this.liveMessage.set(
        `Sua sessão termina por inatividade em ${spokenTime(left)}. Quer continuar conectado?`,
      );
    } else if (left <= 30 && !this.announced.has(30)) {
      this.announced.add(30);
      this.liveMessage.set('Faltam 30 segundos para a sessão terminar.');
    } else if (left <= 60 && !this.announced.has(60)) {
      this.announced.add(60);
      this.liveMessage.set('Falta 1 minuto para a sessão terminar.');
    }
  }
}
