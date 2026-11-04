import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { PROTOTYPE_NOTICE } from '../../../core/privacy/browser-data.service';
import { SCHEMA_VERSION } from '../../../core/storage/migrations';
import { APP_VERSION } from '../../../shared/ui/overlay/app-info';
import { GlyphComponent } from '../../../shared/ui/overlay/glyph.component';
import { initialsOf, roleLabel } from '../../../shared/ui/overlay/user-display';

/**
 * Usuários de demonstração (SCR-M15-05, somente leitura): os 12 usuários do seed, o perfil de cada um, se o
 * acesso está ativo, se exige segundo fator e quem está conectado agora.
 */
@Component({
  selector: 'app-settings-users-page',
  imports: [GlyphComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-header">
        <div class="page-header__row">
          <div class="page-header__titles">
            <h1>Usuários de demonstração</h1>
            <p class="page-header__desc">
              {{ auth.demoUsers().length }} usuários fictícios. Para trocar de perfil, use o menu do
              usuário na barra superior.
            </p>
          </div>
        </div>
      </header>
      <div class="table-wrap">
        <table class="table table--stack" data-density="comfortable">
          <caption class="sr-only">
            Usuários de demonstração
          </caption>
          <thead>
            <tr>
              <th scope="col">Usuário</th>
              <th scope="col">Perfil</th>
              <th scope="col">Acesso</th>
              <th scope="col">Segundo fator</th>
              <th scope="col">Agora</th>
            </tr>
          </thead>
          <tbody>
            @for (user of auth.demoUsers(); track user.id) {
              <tr [attr.aria-selected]="auth.user()?.id === user.id">
                <td data-label="Usuário" class="col-primary">
                  <span class="cluster">
                    <span
                      class="avatar avatar--sm"
                      [class.avatar--gold]="user.role === 'provider'"
                      >{{ initials(user.displayName) }}</span
                    >
                    {{ user.displayName }}
                  </span>
                </td>
                <td data-label="Perfil">{{ role(user.role) }}</td>
                <td data-label="Acesso">
                  <span
                    class="badge badge--dot"
                    [class.badge--success]="user.active"
                    [class.badge--outline]="!user.active"
                    >{{ user.active ? 'Ativo' : 'Desativado' }}</span
                  >
                </td>
                <td data-label="Segundo fator">
                  {{ user.requiresTwoFactor ? 'Exige código' : 'Não exige' }}
                </td>
                <td data-label="Agora">
                  @if (auth.user()?.id === user.id) {
                    <span class="badge badge--gold"
                      ><svg appGlyph="user-check" glyphSize="sm"></svg>Conectado</span
                    >
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class UsersPageComponent {
  protected readonly auth = inject(AuthService);

  protected initials(name: string): string {
    return initialsOf(name);
  }

  protected role(role: Parameters<typeof roleLabel>[0]): string {
    return roleLabel(role);
  }
}

/** Sobre (SCR-M15-07): versão, aviso de protótipo e de onde vêm as regras. */
@Component({
  selector: 'app-settings-about-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page--narrow">
      <header class="page-header">
        <div class="page-header__row">
          <div class="page-header__titles">
            <h1>Sobre o protótipo</h1>
            <p class="page-header__desc">
              Nexus ERP: back-office da Nexus e portal do profissional credenciado.
            </p>
          </div>
        </div>
      </header>
      <section class="card card--pad stack stack--3">
        <dl class="dl">
          <dt>Versão</dt>
          <dd class="t-num">{{ version }}</dd>
          <dt>Formato dos dados</dt>
          <dd class="t-num">{{ schema }}</dd>
          <dt>Aviso</dt>
          <dd>{{ notice }}</dd>
        </dl>
        <div class="prose">
          <p>
            As regras de negócio vêm do plano de negócios da Nexus. Onde o plano foi omisso, o
            protótipo registra uma suposição e a mostra em Configurações, com o valor padrão e o
            atual.
          </p>
          <p>
            Nenhuma informação sai deste navegador: não há servidor, análise de uso nem chamada
            externa. Todos os cuidadores, prestadores e documentos são fictícios.
          </p>
        </div>
      </section>
    </div>
  `,
})
export class AboutPageComponent {
  protected readonly version = APP_VERSION;
  protected readonly schema = SCHEMA_VERSION;
  protected readonly notice = PROTOTYPE_NOTICE;
}
