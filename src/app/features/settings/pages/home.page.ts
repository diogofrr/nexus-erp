import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { ScreenDef, screensFor } from '../../../core/search/screens';
import { IconComponent, IconName, toIconName } from '../../../shared/ui/display/icon.component';
import { UiPrefsService } from '../../../shared/ui/overlay/ui-prefs.service';

const DESCRIPTIONS: Readonly<Record<string, string>> = {
  dados: 'Baixar a cópia, importar de volta, voltar aos dados de demonstração ou apagar tudo.',
  relogio: 'Mudar a data de hoje para testar prazos, aplicações da escala e auditoria.',
  parametros: 'Benefícios e desconto por plano, capacidade de grupo, taxa de recusa, prazos e SLA.',
  arbe: 'Limites do alerta de risco de esgotamento do cuidador.',
  conteudos: 'Conteúdos de orientação: rascunho, revisão e publicação.',
  usuarios: 'Os 12 usuários de demonstração e quem está conectado.',
  suposicoes: 'Cada suposição do protótipo, com o valor padrão e o atual.',
  sobre: 'Versão, aviso de protótipo e de onde vêm as regras.',
};

/**
 * Configurações (M15): porta de entrada com um cartão por tela que o perfil pode abrir (a sócia vê todas; o
 * responsável técnico só ARBE e conteúdos, AC-M15-08) e as preferências de interface de quem está conectado:
 * tema claro ou escuro e "Preencher com exemplo" (U-07).
 */
@Component({
  selector: 'app-settings-home-page',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page--narrow">
      <header class="page-header">
        <div class="page-header__row">
          <div class="page-header__titles">
            <h1>Configurações</h1>
            <p class="page-header__desc">
              Controle do protótipo: dados, relógio, parâmetros e preferências.
            </p>
          </div>
        </div>
      </header>

      <div class="stack stack--6">
        <section aria-labelledby="nx-settings-areas">
          <h2 class="sr-only" id="nx-settings-areas">Áreas de configuração</h2>
          <div class="grid grid--2" data-role="areas">
            @for (area of areas(); track area.id) {
              <a
                class="card card--pad card--interactive stack stack--2"
                [routerLink]="area.link"
                [attr.data-area]="slug(area)"
              >
                <span class="cluster">
                  <svg [appIcon]="iconOf(area)"></svg>
                  <strong class="t-strong">{{ area.label }}</strong>
                </span>
                <span class="t-muted t-ui">{{ description(area) }}</span>
              </a>
            }
          </div>
        </section>

        <section class="card card--pad stack stack--3" aria-labelledby="nx-settings-prefs">
          <h2 class="card__title" id="nx-settings-prefs">Preferências de quem está conectado</h2>
          <div class="stack stack--2">
            <p class="t-strong t-ui" id="nx-theme-label">Tema</p>
            <div class="segmented" role="group" aria-labelledby="nx-theme-label">
              <button
                type="button"
                class="segmented__btn"
                data-role="theme-light"
                [attr.aria-pressed]="prefs.theme() === 'light'"
                (click)="prefs.setTheme('light')"
              >
                <svg appIcon="sun" size="sm"></svg>Claro
              </button>
              <button
                type="button"
                class="segmented__btn"
                data-role="theme-dark"
                [attr.aria-pressed]="prefs.theme() === 'dark'"
                (click)="prefs.setTheme('dark')"
              >
                <svg appIcon="moon" size="sm"></svg>Escuro
              </button>
            </div>
            <p class="t-muted t-ui">
              O tema escuro é para o fim do expediente. A escolha fica guardada neste navegador.
            </p>
          </div>
          <label class="switch">
            <input
              type="checkbox"
              data-role="fill-example"
              [checked]="prefs.fillWithExample()"
              (change)="onFillExample($event)"
            />
            <span>Mostrar "Preencher com exemplo" nos formulários</span>
          </label>
          <p class="t-muted t-ui">
            Ajuda quem testa o protótipo a preencher um formulário com dados fictícios de exemplo.
          </p>
        </section>
      </div>
    </div>
  `,
})
export class SettingsHomePageComponent {
  private readonly auth = inject(AuthService);
  protected readonly prefs = inject(UiPrefsService);

  /** As telas de Configurações que o perfil abre, pela mesma matriz do menu. */
  protected iconOf(area: ScreenDef): IconName {
    return toIconName(area.icon);
  }

  protected readonly areas = computed<ScreenDef[]>(() => {
    const role = this.auth.role();
    return role
      ? screensFor(role).filter(
          (s) => s.link.startsWith('/app/configuracoes/') && s.link !== '/app/configuracoes/',
        )
      : [];
  });

  protected slug(area: ScreenDef): string {
    return area.link.split('/').pop() ?? '';
  }

  protected description(area: ScreenDef): string {
    return DESCRIPTIONS[this.slug(area)] ?? '';
  }

  protected onFillExample(event: Event): void {
    this.prefs.setFillWithExample((event.target as HTMLInputElement).checked);
  }
}
