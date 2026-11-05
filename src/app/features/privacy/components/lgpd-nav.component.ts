import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '@core/auth';

interface NavLink {
  path: string;
  label: string;
  /** Só quem pode ver o log, os incidentes e os documentos (`lgpd_audit_log`). */
  restricted: boolean;
}

const LINKS: readonly NavLink[] = [
  { path: 'consentimentos', label: 'Consentimentos', restricted: false },
  { path: 'termos', label: 'Termos', restricted: false },
  { path: 'solicitacoes', label: 'Solicitações do titular', restricted: false },
  { path: 'log', label: 'Log de acessos', restricted: true },
  { path: 'incidentes', label: 'Incidentes', restricted: true },
  { path: 'politica', label: 'Política de privacidade', restricted: true },
  { path: 'ripd', label: 'RIPD', restricted: true },
  { path: 'retencao', label: 'Retenção', restricted: true },
];

/**
 * Navegação do módulo LGPD (as 8 telas do wireframe 6.10). O atendimento só vê o que abre: consentimentos,
 * termos e solicitações do titular (sem o log, os incidentes, a política, o RIPD nem a retenção).
 */
@Component({
  selector: 'app-lgpd-nav',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav aria-label="Privacidade (LGPD)">
      <ul class="cluster list-reset" role="list">
        @for (link of links(); track link.path) {
          <li>
            <a class="btn btn--sm" [routerLink]="['/app/lgpd', link.path]" routerLinkActive="btn--primary" ariaCurrentWhenActive="page">{{ link.label }}</a>
          </li>
        }
      </ul>
    </nav>
  `,
})
export class LgpdNavComponent {
  private readonly auth = inject(AuthService);
  protected readonly links = computed(() => {
    const restricted = this.auth.can('lgpd_audit_log', 'view');
    return LINKS.filter((l) => !l.restricted || restricted);
  });
}
