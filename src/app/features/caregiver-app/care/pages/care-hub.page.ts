import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CgCardComponent } from '../../ui/cg-card.component';
import { CgEmergencyNoteComponent } from '../../ui/cg-emergency-note.component';
import { CgPageHeaderComponent } from '../../ui/cg-page-header.component';
import { CareHubService, HUB_CONTENT_DEFAULT } from '../state/care-hub.service';

/**
 * Cuidar de mim, a porta (UX C7; RN-ATD-03 e 04, RN-PLN-04 e 19, RN-ETICA-15). Quatro cartões, sempre os quatro, na mesma
 * ordem e para todos os planos, SEM cadeado, preço, selo de plano ou número: o bloqueio por plano fica DENTRO de Grupos
 * e Conteúdos, nunca na porta. Em dois cartões a frase muda com fatos da pessoa (a conversa marcada, os grupos);
 * nunca com pontuação, faixa ou alerta. Uma ação por tela: tocar no cartão que combina com o momento.
 */
@Component({
  selector: 'app-care-hub-page',
  imports: [CgPageHeaderComponent, CgCardComponent, CgEmergencyNoteComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-cg-page-header title="Cuidar de mim" description="Um tempo para você, no seu ritmo." />

    <div class="cg-stack">
      <div class="cg-grid" data-role="care-cards">
        <app-cg-card title="Conversar com um psicólogo" icon="heart-handshake" link="/cuidador/cuidar-de-mim/atendimento">
          <span data-role="care-conversation">{{ hub.conversationPhrase() }}</span>
        </app-cg-card>
        <app-cg-card title="Como estou" icon="heart-pulse" link="/cuidador/cuidar-de-mim/como-estou">
          <span data-role="care-wellbeing">{{ hub.wellbeingPhrase() }}</span>
        </app-cg-card>
        <app-cg-card title="Grupos e capacitações" icon="users" link="/cuidador/cuidar-de-mim/grupos">
          <span data-role="care-groups">{{ hub.groupsPhrase() }}</span>
        </app-cg-card>
        <app-cg-card title="Conteúdos" icon="book-open" link="/cuidador/cuidar-de-mim/conteudos">
          <span data-role="care-content">{{ contentText }}</span>
        </app-cg-card>
      </div>
      <app-cg-emergency-note />
    </div>
  `,
})
export class CareHubPage {
  protected readonly hub = inject(CareHubService);
  protected readonly contentText = HUB_CONTENT_DEFAULT;
}
