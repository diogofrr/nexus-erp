import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { homePathFor } from '../../../core/auth/module-map';
import { PROTOTYPE_NOTICE } from '../../../core/privacy/browser-data.service';
import { GlyphComponent } from '../../../shared/ui/overlay/glyph.component';
import { StandaloneFrameComponent } from '../components/standalone-frame.component';
import { SESSION_EXPIRED_TEXT } from './login.page';

/** Acesso negado (SCR-M01-05, AC-GL-04): texto neutro, sem dizer se o recurso existe, e o caminho de volta. */
@Component({
  selector: 'app-forbidden-page',
  imports: [StandaloneFrameComponent, GlyphComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-standalone-frame>
      <div class="empty">
        <span class="empty__icon"><svg appGlyph="lock" glyphSize="lg"></svg></span>
        <h1 class="empty__title">Você não tem acesso a esta página</h1>
        <p class="empty__text">
          O seu perfil não abre este endereço. Volte ao início para continuar. Se você precisa deste
          acesso, fale com a gestão.
        </p>
        <div class="empty__actions">
          <a class="btn btn--primary" [routerLink]="home()" data-role="home">{{ label() }}</a>
        </div>
      </div>
    </app-standalone-frame>
  `,
})
export class ForbiddenPageComponent {
  private readonly auth = inject(AuthService);

  protected readonly home = computed(() => {
    const role = this.auth.role();
    return role ? homePathFor(role) : '/login';
  });
  protected readonly label = computed(() =>
    this.auth.role() === 'provider'
      ? 'Ir para o início'
      : this.auth.role()
        ? 'Ir para o painel'
        : 'Ir para a entrada',
  );
}

/** Página não encontrada (SCR-M01-06): link para o painel (ou para a entrada, sem sessão). */
@Component({
  selector: 'app-not-found-page',
  imports: [StandaloneFrameComponent, GlyphComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-standalone-frame>
      <div class="empty">
        <span class="empty__icon"><svg appGlyph="circle-help" glyphSize="lg"></svg></span>
        <h1 class="empty__title">Página não encontrada</h1>
        <p class="empty__text">
          O endereço pode ter mudado ou não existir. Volte ao início e tente de novo.
        </p>
        <div class="empty__actions">
          <a class="btn btn--primary" [routerLink]="home()" data-role="home">{{ label() }}</a>
        </div>
      </div>
    </app-standalone-frame>
  `,
})
export class NotFoundPageComponent {
  private readonly auth = inject(AuthService);

  protected readonly home = computed(() => {
    const role = this.auth.isAuthenticated() ? this.auth.role() : null;
    return role ? homePathFor(role) : '/login';
  });
  protected readonly label = computed(() =>
    this.auth.isAuthenticated()
      ? this.auth.role() === 'provider'
        ? 'Ir para o início'
        : 'Ir para o painel'
      : 'Ir para a entrada',
  );
}

/**
 * Sessão expirada (SCR-M01-04, AC-M01-07): o serviço de inatividade encerrou a sessão aos 30 minutos. A
 * pessoa vê o que houve e entra de novo; com o mesmo perfil, volta à tela onde estava (A-03).
 */
@Component({
  selector: 'app-session-expired-page',
  imports: [GlyphComponent, RouterLink],
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
        <p class="login__tagline">Quem cuida também precisa de sustentação.</p>
      </section>
      <main class="login__panel" id="conteudo" tabindex="-1">
        <div class="empty">
          <span class="empty__icon empty__icon--attention"
            ><svg appGlyph="clock" glyphSize="lg"></svg
          ></span>
          <h1 class="empty__title">Sua sessão terminou</h1>
          <p class="empty__text">{{ text }}</p>
          <p class="empty__text t-caption">{{ notice }}</p>
          <div class="empty__actions">
            <a class="btn btn--primary" routerLink="/login" data-role="sign-in">Entrar de novo</a>
          </div>
        </div>
      </main>
    </div>
  `,
})
export class SessionExpiredPageComponent {
  protected readonly text = SESSION_EXPIRED_TEXT;
  protected readonly notice = PROTOTYPE_NOTICE;
}
