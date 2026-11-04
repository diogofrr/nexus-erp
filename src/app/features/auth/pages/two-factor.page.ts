import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { PROTOTYPE_NOTICE } from '../../../core/privacy/browser-data.service';
import { BannerComponent } from '../../../shared/ui/overlay/banner.component';
import { GlyphComponent } from '../../../shared/ui/overlay/glyph.component';
import { roleLabel } from '../../../shared/ui/overlay/user-display';
import { destinationAfterLogin } from '../return-url';

/** Mensagens do segundo fator (F01, catálogo de erros do design system 7.4). */
export function wrongCodeText(attemptsLeft: number): string {
  return `O código não confere. Digite os 6 números mostrados na tela. ${
    attemptsLeft === 1 ? 'Resta 1 tentativa.' : `Restam ${attemptsLeft} tentativas.`
  }`;
}

export const CODE_FORMAT_TEXT = 'O código tem 6 números. Digite os 6 números mostrados na tela.';

/**
 * Segundo fator simulado (SCR-M01-02, F01, RN-LGPD-15): o código `123456` aparece na tela (protótipo), com o
 * botão "Usar o código mostrado" (WCAG 3.3.8: ninguém precisa memorizar nem transcrever). Campo único de 6
 * dígitos, sem envio automático (WCAG 3.2.2).
 *
 * - Código errado: mensagem no campo e no resumo de erros, com as tentativas restantes; o texto digitado
 *   fica e é selecionado para troca.
 * - Terceiro erro seguido: o núcleo grava `denied`, a sessão cai e a pessoa volta à entrada com a faixa de
 *   atenção (U-06).
 * - Acerto: grava o login e leva ao link de origem, se o perfil confere (U-02), senão ao painel.
 */
@Component({
  selector: 'app-two-factor-page',
  imports: [BannerComponent, GlyphComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="login">
      <section class="login__brand" aria-label="Nexus">
        <div class="login__logo">
          <svg class="brand-symbol" aria-hidden="true">
            <use href="icons/sprite.svg#nx-symbol" />
          </svg>
          <span class="wordmark">Nexus</span>
        </div>
        <svg class="login__art" viewBox="-18 3 156 98" aria-hidden="true">
          <use href="icons/sprite.svg#nx-hands" />
        </svg>
        <div class="stack stack--3">
          <p class="login__tagline">Quem cuida também precisa de sustentação.</p>
          <p class="login__note">Confirmar o código é o segundo passo para entrar.</p>
        </div>
      </section>

      <main class="login__panel" id="conteudo" tabindex="-1">
        <app-banner variant="prototype">{{ notice }}</app-banner>

        <div>
          <h1>Confirme que é você</h1>
          @if (auth.user(); as user) {
            <p class="page-header__desc">Entrando como {{ user.displayName }} ({{ role() }}).</p>
          }
        </div>

        <form class="login__form" novalidate (submit)="submit($event)">
          @if (error()) {
            <div class="error-summary" role="alert" tabindex="-1" #summary>
              <h2><svg appGlyph="circle-alert"></svg>Há 1 ponto para corrigir</h2>
              <ul>
                <li>
                  <a href="#nx-code" (click)="focusField($event)">{{ error() }}</a>
                </li>
              </ul>
            </div>
          }

          <div class="stack stack--2">
            <p>No protótipo, o código aparece aqui:</p>
            <strong class="t-display t-num code-display" data-role="shown-code">{{
              shownCode()
            }}</strong>
            <div>
              <button
                type="button"
                class="btn btn--soft"
                data-role="use-code"
                (click)="useShownCode()"
              >
                Usar o código mostrado
              </button>
            </div>
          </div>

          <div class="field" [class.field--error]="!!error()">
            <label class="field__label" for="nx-code">Código de 6 números</label>
            <span class="field__hint" id="nx-code-hint"
              >Segundo fator simulado: este código não é enviado a lugar nenhum.</span
            >
            <input
              #code
              class="input code-input"
              id="nx-code"
              name="code"
              type="text"
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength="6"
              [attr.aria-invalid]="error() ? 'true' : null"
              [attr.aria-describedby]="error() ? 'nx-code-hint nx-code-error' : 'nx-code-hint'"
              [value]="value()"
              (input)="onInput($event)"
            />
            @if (error()) {
              <span class="field__error" id="nx-code-error">
                <svg appGlyph="circle-alert"></svg>
                <span><span class="sr-only">Erro: </span>{{ error() }}</span>
              </span>
            }
          </div>

          <div class="cluster">
            <button type="submit" class="btn btn--primary" data-role="confirm">Confirmar</button>
            <button type="button" class="btn btn--ghost" data-role="back" (click)="back()">
              Voltar e escolher outro perfil
            </button>
          </div>
        </form>
      </main>
    </div>
  `,
})
export class TwoFactorPageComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly codeField = viewChild<ElementRef<HTMLInputElement>>('code');
  private readonly summary = viewChild<ElementRef<HTMLElement>>('summary');

  protected readonly notice = PROTOTYPE_NOTICE;
  protected readonly value = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly shownCode = computed(() => this.auth.pendingTwoFactorCode() ?? '');
  protected readonly role = computed(() => {
    const role = this.auth.role();
    return role ? roleLabel(role) : '';
  });

  ngOnInit(): void {
    // Sem perfil escolhido não há o que confirmar: volta à entrada.
    if (!this.auth.isPendingTwoFactor()) {
      void this.router.navigateByUrl('/login');
    }
  }

  protected onInput(event: Event): void {
    // Só dígitos (aceita colar com espaços ou traços); o que foi digitado de errado continua visível até corrigir.
    const digits = (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6);
    this.value.set(digits);
    (event.target as HTMLInputElement).value = digits;
    if (this.error()) {
      this.error.set(null);
    }
  }

  /** O código pode ser preenchido, nunca exige memorizar ou transcrever (WCAG 3.3.8). */
  protected useShownCode(): void {
    this.value.set(this.shownCode());
    this.error.set(null);
    this.codeField()?.nativeElement.focus();
  }

  protected submit(event: Event): void {
    event.preventDefault();
    const outcome = this.auth.verifyTwoFactor(this.value());
    switch (outcome.status) {
      case 'ok':
        void this.router.navigateByUrl(
          destinationAfterLogin(outcome.user.role, this.auth.consumeReturnUrl()),
        );
        return;
      case 'invalid_format':
        this.fail(CODE_FORMAT_TEXT);
        return;
      case 'wrong_code':
        this.fail(wrongCodeText(outcome.attemptsLeft), true);
        return;
      case 'too_many_attempts':
        // A sessão caiu e o núcleo gravou `denied`: a entrada mostra a faixa de atenção.
        void this.router.navigateByUrl('/login');
        return;
      case 'no_pending_session':
        void this.router.navigateByUrl('/login');
        return;
    }
  }

  protected back(): void {
    this.auth.cancelPendingTwoFactor();
    void this.router.navigateByUrl('/login');
  }

  protected focusField(event: Event): void {
    event.preventDefault();
    this.codeField()?.nativeElement.focus();
  }

  /** Mostra o erro, leva o foco ao resumo (WCAG 3.3.1) e seleciona o texto para a troca. */
  private fail(message: string, select = false): void {
    this.error.set(message);
    afterNextRender(
      () => {
        this.summary()?.nativeElement.focus();
        if (select) {
          this.codeField()?.nativeElement.select();
        }
      },
      { injector: this.injector },
    );
  }
}
