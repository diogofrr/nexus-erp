import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ViewportService } from '../../../layout/state/viewport.service';
import { CaregiverContextService } from '../state/caregiver-context.service';
import { CgContactDialogComponent } from '../ui/cg-contact-dialog.component';
import { CgHeaderComponent } from '../ui/cg-header.component';
import { CgNavComponent } from '../ui/cg-nav.component';
import { CgProtoNoteComponent } from '../ui/cg-proto-note.component';
import { CaregiverUserMenuComponent } from './caregiver-user-menu.component';

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

  /** 1024 px ou mais: a navegação vai para o cabeçalho e a barra inferior não existe. */
  protected readonly wide = computed(() => this.viewport.navLayout() !== 'drawer');
  /** Teclado virtual aberto: a barra inferior some para não cobrir o campo (AC-CG-05). */
  protected readonly keyboardOpen = signal(false);

  constructor() {
    const root = this.doc.documentElement;
    const previousTheme = root.getAttribute('data-theme');
    const previousApp = root.getAttribute('data-app');
    root.setAttribute('data-theme', 'light');
    root.setAttribute('data-app', 'caregiver');

    const view = this.doc.defaultView;
    const visual = view?.visualViewport ?? null;
    const onResize = (): void => {
      if (view && visual) {
        this.keyboardOpen.set(visual.height < view.innerHeight * 0.75);
      }
    };
    visual?.addEventListener('resize', onResize);

    inject(DestroyRef).onDestroy(() => {
      visual?.removeEventListener('resize', onResize);
      restoreAttribute(root, 'data-theme', previousTheme);
      restoreAttribute(root, 'data-app', previousApp);
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

function restoreAttribute(root: HTMLElement, name: string, previous: string | null): void {
  if (previous === null) {
    root.removeAttribute(name);
  } else {
    root.setAttribute(name, previous);
  }
}
