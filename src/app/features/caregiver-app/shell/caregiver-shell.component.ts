import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ToastProfile, ToastService } from '../../../shared/ui/overlay/toast.service';
import { ViewportService } from '../../../layout/state/viewport.service';
import { CaregiverContextService } from '../state/caregiver-context.service';
import { STORAGE_NOT_SAVING_TEXT, StorageStatusService } from '../state/storage-status.service';
import { CgContactDialogComponent } from '../ui/cg-contact-dialog.component';
import { CgHeaderComponent } from '../ui/cg-header.component';
import { CgNavComponent } from '../ui/cg-nav.component';
import { CgNoteComponent } from '../ui/cg-note.component';
import { CgProtoNoteComponent } from '../ui/cg-proto-note.component';
import { CaregiverUserMenuComponent } from './caregiver-user-menu.component';

/**
 * O aviso rápido do aplicativo do cuidador: um por vez, e some sozinho em 8 s (com ou sem "Desfazer", UX 5.8). Fica no alto,
 * abaixo do cabeçalho, para nunca cobrir um botão nem a barra inferior (ver `_caregiver.scss`).
 */
export const CAREGIVER_TOAST_PROFILE: ToastProfile = { maxStack: 1, defaultMs: 8000, undoMs: 8000 };

/**
 * Casca do aplicativo do cuidador (`/cuidador/**`, UX A.2 e A.3). Reúne, nesta ordem: o link "Ir para o
 * conteúdo", o cabeçalho (marca, **Ajuda agora** sempre visível e o menu do usuário), o conteúdo numa coluna
 * central (720 px no celular e no tablet, 960 px em tela larga), o aviso de protótipo no fim do conteúdo e, no
 * celular, a barra inferior de 5 itens (de 1024 px em diante a mesma navegação vai para o cabeçalho).
 *
 * - A raiz leva a classe `cg-app` e `data-text` (`normal`, `large`, `xlarge`): o tamanho da letra vale na hora e
 *   fica guardado no navegador (`FontScaleService`). Todo o CSS do aplicativo vive em `src/styles/_caregiver.scss`.
 * - O app do cuidador é só claro `[S-01]`: o shell força `data-theme="light"` no `<html>` (sem gravar a
 *   preferência da equipe) e marca `data-app="caregiver"` para o toast e a confirmação ganharem as medidas do
 *   cuidador. Ao sair, devolve o que havia.
 * - Sem sessão (cadastro de quem é novo e "Ajuda agora") não há barra de navegação nem menu do usuário: só a
 *   marca, a Ajuda agora e o link "Entrar".
 * - O título da aba (`data.title` de cada rota) e o foco no `h1` a cada tela vêm do `PageChromeService` da raiz,
 *   o mesmo da equipe.
 */
@Component({
  selector: 'app-caregiver-shell',
  imports: [
    RouterLink,
    RouterOutlet,
    CgHeaderComponent,
    CgNavComponent,
    CgNoteComponent,
    CgProtoNoteComponent,
    CgContactDialogComponent,
    CaregiverUserMenuComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cg-app', '[attr.data-text]': 'ctx.fontScale()' },
  template: `
    <a class="skip-link" href="#conteudo" (click)="skipToContent($event)">Ir para o conteúdo</a>

    <app-cg-header [showNav]="ctx.isSignedIn() && wide()">
      @if (ctx.isSignedIn()) {
        <app-cg-user-menu />
      } @else {
        <a class="cg-link-btn cg-header__login" routerLink="/login">Entrar</a>
      }
    </app-cg-header>

    <main class="cg-main" id="conteudo" tabindex="-1">
      @if (storage.failing()) {
        <!-- QAC-010: o que a pessoa faz não está sendo guardado; a faixa é calma e diz o que fazer. -->
        <div class="cg-col cg-system-note">
          <app-cg-note variant="error" icon="circle-alert"><span data-role="storage-note">{{ storageText }}</span></app-cg-note>
        </div>
      }
      <div class="cg-col">
        <router-outlet />
      </div>
      <app-cg-proto-note />
    </main>

    @if (ctx.isSignedIn() && !wide() && !keyboardOpen()) {
      <app-cg-nav variant="bottom" />
    }

    <app-cg-contact-dialog />
  `,
})
export class CaregiverShellComponent {
  protected readonly ctx = inject(CaregiverContextService);
  private readonly viewport = inject(ViewportService);
  private readonly doc = inject(DOCUMENT);
  private readonly toasts = inject(ToastService);

  /** 1024 px ou mais: a navegação vai para o cabeçalho e a barra inferior não existe. */
  protected readonly wide = computed(() => this.viewport.navLayout() !== 'drawer');
  protected readonly storage = inject(StorageStatusService);
  protected readonly storageText = STORAGE_NOT_SAVING_TEXT;
  /**
   * Teclado virtual aberto: a barra inferior some para não cobrir o campo (AC-CG-05). Só vale com um campo de texto com
   * foco, a janela visual encolhida e SEM zoom de pinça (`visualViewport.scale <= 1`): o zoom de quem tem baixa visão
   * não é teclado e não pode esconder a navegação (QAC-011).
   */
  protected readonly keyboardOpen = signal(false);

  constructor() {
    const root = this.doc.documentElement;
    const previousTheme = root.getAttribute('data-theme');
    const previousApp = root.getAttribute('data-app');
    root.setAttribute('data-theme', 'light');
    root.setAttribute('data-app', 'caregiver');
    const restoreToasts = this.toasts.useProfile(CAREGIVER_TOAST_PROFILE);

    const view = this.doc.defaultView;
    const visual = view?.visualViewport ?? null;
    const onResize = (): void => {
      if (view && visual) {
        const shrunk = visual.height < view.innerHeight * 0.75;
        this.keyboardOpen.set(shrunk && visual.scale <= 1 && isTextField(this.doc.activeElement));
      }
    };
    visual?.addEventListener('resize', onResize);
    // O foco muda antes ou depois de a janela encolher (abrir e fechar o teclado): reconfere nos dois casos.
    this.doc.addEventListener('focusin', onResize);
    this.doc.addEventListener('focusout', onResize);

    inject(DestroyRef).onDestroy(() => {
      visual?.removeEventListener('resize', onResize);
      this.doc.removeEventListener('focusin', onResize);
      this.doc.removeEventListener('focusout', onResize);
      restoreAttribute(root, 'data-theme', previousTheme);
      restoreAttribute(root, 'data-app', previousApp);
      restoreToasts();
    });
  }

  /** "Ir para o conteúdo" sem depender do `href` (a base `/` o levaria para a raiz). */
  protected skipToContent(event: Event): void {
    event.preventDefault();
    const main = this.doc.getElementById('conteudo');
    main?.focus();
    main?.scrollIntoView?.({ block: 'start' });
  }
}

/** Campo em que se digita (texto, número, e-mail, área de texto, lista, editável)? Caixa, opção e botão não abrem o teclado. */
function isTextField(element: Element | null): boolean {
  if (!element) {
    return false;
  }
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    return true;
  }
  if (element instanceof HTMLInputElement) {
    return !['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'range', 'color', 'image'].includes(element.type);
  }
  return element instanceof HTMLElement && element.isContentEditable;
}

function restoreAttribute(root: HTMLElement, name: string, previous: string | null): void {
  if (previous === null) {
    root.removeAttribute(name);
  } else {
    root.setAttribute(name, previous);
  }
}
