import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '@core/auth';
import { EmptyStateComponent } from '@shared/ui';
import { PartnerPanelComponent } from '../panels/partner.panel';
import { PsychologistPanelComponent } from '../panels/psychologist.panel';
import { SupportPanelComponent } from '../panels/support.panel';
import { TechnicalLeadPanelComponent } from '../panels/technical-lead.panel';

/**
 * SCR-M02-01 Painel (`/app/painel`). Um painel diferente para cada perfil da equipe, cada um só com os blocos
 * do escopo e só com o que o perfil pode ver. A busca global (Ctrl+K) e as notificações (sino) ficam no shell.
 */
@Component({
  selector: 'app-dashboard-page',
  imports: [
    EmptyStateComponent,
    PartnerPanelComponent,
    PsychologistPanelComponent,
    SupportPanelComponent,
    TechnicalLeadPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (auth.role()) {
      @case ('partner') {
        <app-partner-panel />
      }
      @case ('technical_lead') {
        <app-technical-lead-panel />
      }
      @case ('psychologist') {
        <app-psychologist-panel />
      }
      @case ('support') {
        <app-support-panel />
      }
      @default {
        <div class="page">
          <h1>Painel</h1>
          <app-empty-state
            kind="forbidden"
            title="Sem painel para o seu perfil"
            text="Este painel é da equipe da Nexus."
          />
        </div>
      }
    }
  `,
})
export class DashboardPageComponent {
  protected readonly auth = inject(AuthService);
}
