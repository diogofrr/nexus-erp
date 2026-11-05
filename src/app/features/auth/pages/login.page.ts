import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { AppUser } from '../../../core/models/access';
import { PROTOTYPE_NOTICE } from '../../../core/privacy/browser-data.service';
import { StorageService } from '../../../core/storage/storage.service';
import { BannerComponent } from '../../../shared/ui/overlay/banner.component';
import { IconComponent } from '../../../shared/ui/display/icon.component';
import { initialsOf, roleLabel } from '../../../shared/ui/overlay/user-display';
import { destinationAfterLogin } from '../return-url';

/** Texto da faixa de armazenamento bloqueado (F01, estados de erro). */
export const STORAGE_BLOCKED_TEXT =
  'O navegador está bloqueando o armazenamento do site, e o protótipo precisa dele. Libere o armazenamento para este endereço e recarregue a página.';

export const TWO_FACTOR_FAILED_TEXT =
  'Por segurança, voltamos à entrada depois de 3 códigos incorretos. Escolha o perfil e tente de novo.';

export const SESSION_EXPIRED_TEXT =
  'Sua sessão terminou por inatividade. Entre de novo para continuar.';

/** Grupos da entrada: a equipe agrupada pela função (Gestão, Psicologia, Atendimento). */
interface ProfileGroup {
  id: string;
  title: string;
  users: readonly AppUser[];
}

/**
 * Entrada (SCR-M01-01, F01): a pessoa escolhe um dos 8 usuários de demonstração da equipe, agrupados por
 * função (Gestão, Psicologia, Atendimento). Não há senha: todos confirmam o código de 6 dígitos na tela
 * seguinte. Mostra o aviso de protótipo (AC-GL-05) e, quando é o caso, a faixa do motivo de a pessoa estar de
 * volta aqui (3 códigos errados, inatividade, armazenamento bloqueado).
 */
@Component({
  selector: 'app-login-page',
  imports: [BannerComponent, IconComponent, NgTemplateOutlet],
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
          <p class="login__note">
            Back-office da Nexus. Escolha um perfil de demonstração para entrar.
          </p>
        </div>
      </section>

      <main class="login__panel" id="conteudo" tabindex="-1">
        <app-banner variant="prototype">{{ notice }}</app-banner>

        @if (reason(); as text) {
          <app-banner variant="attention" liveRole="alert">{{ text }}</app-banner>
        }
        @if (storageBlocked()) {
          <app-banner variant="danger" heading="Armazenamento bloqueado">{{
            blockedText
          }}</app-banner>
        }

        <div>
          <h1>Entrar como</h1>
          <p class="page-header__desc">Não há senha. A equipe confirma um código de 6 dígitos.</p>
        </div>

        @for (group of groups(); track group.id) {
          <section class="profile-group" [attr.aria-labelledby]="'nx-login-' + group.id">
            <h2 [id]="'nx-login-' + group.id">{{ group.title }} ({{ group.users.length }})</h2>
            <div class="list-card">
              @for (user of group.users; track user.id) {
                <ng-container
                  [ngTemplateOutlet]="card"
                  [ngTemplateOutletContext]="{ $implicit: user }"
                />
              }
            </div>
          </section>
        }
      </main>
    </div>

    <ng-template #card let-user>
      <button
        type="button"
        class="list-row"
        [attr.aria-disabled]="user.active ? null : 'true'"
        [attr.aria-label]="
          'Entrar como ' + user.displayName + '. ' + role(user) + '. ' + user.demoDescription
        "
        (click)="choose(user)"
      >
        <span class="avatar">{{ initials(user) }}</span>
        <span>
          <span class="list-row__title">{{ user.displayName }}</span>
          <span class="list-row__meta">{{ role(user) }}</span>
          <span class="list-row__meta list-row__meta--wrap">{{ user.demoDescription }}</span>
        </span>
        @if (!user.active) {
          <span class="badge badge--outline">Acesso desativado</span>
        } @else if (user.requiresTwoFactor) {
          <span class="badge"><svg appIcon="key-round" size="sm"></svg>Código</span>
        } @else {
          <svg appIcon="chevron-right"></svg>
        }
      </button>
    </ng-template>
  `,
})
export class LoginPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly storage = inject(StorageService);

  protected readonly notice = PROTOTYPE_NOTICE;
  protected readonly blockedText = STORAGE_BLOCKED_TEXT;

  protected readonly groups = computed<ProfileGroup[]>(() => {
    const users = this.auth.demoUsers();
    const of = (...roles: AppUser['role'][]): AppUser[] =>
      users.filter((u) => roles.includes(u.role));
    return [
      { id: 'management', title: 'Gestão', users: of('partner', 'technical_lead') },
      { id: 'psychology', title: 'Psicologia', users: of('psychologist') },
      { id: 'support', title: 'Atendimento', users: of('support') },
    ].filter((g) => g.users.length > 0);
  });

  /** Por que a pessoa voltou à entrada (F01): três códigos errados ou inatividade. */
  protected readonly reason = computed(() => {
    switch (this.auth.endReason()) {
      case 'two_factor_failures':
        return TWO_FACTOR_FAILED_TEXT;
      case 'inactivity':
        return SESSION_EXPIRED_TEXT;
      default:
        return null;
    }
  });

  protected readonly storageBlocked = computed(() =>
    this.storage.notices().some((n) => n.kind === 'unavailable'),
  );

  protected initials(user: AppUser): string {
    return initialsOf(user.displayName);
  }

  protected role(user: AppUser): string {
    return roleLabel(user.role);
  }

  /** Escolhe o perfil: a equipe vai ao segundo fator (F01). */
  protected choose(user: AppUser): void {
    if (!user.active) {
      return;
    }
    const outcome = this.auth.selectProfile(user.id);
    if (outcome.status === 'needs_two_factor') {
      void this.router.navigateByUrl('/login/2fa');
    } else if (outcome.status === 'authenticated') {
      void this.router.navigateByUrl(
        destinationAfterLogin(user.role, this.auth.consumeReturnUrl()),
      );
    }
  }
}
