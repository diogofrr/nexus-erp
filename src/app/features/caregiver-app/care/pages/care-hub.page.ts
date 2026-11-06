import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CgCardComponent } from '../../ui/cg-card.component';
import { CgEmergencyNoteComponent } from '../../ui/cg-emergency-note.component';
import { CgHeroComponent } from '../../ui/cg-hero.component';
import { CareHubService, HUB_CONTENT_DEFAULT } from '../state/care-hub.service';

/**
 * Cuidar de mim, a porta (UX C7; RN-ATD-03 e 04, RN-PLN-04 e 19, RN-ETICA-15). Quatro cartões, sempre os quatro, na mesma
 * ordem e para todos os planos, SEM cadeado, preço, selo de plano ou número: o bloqueio por plano fica DENTRO de Grupos
 * e Conteúdos, nunca na porta. Em dois cartões a frase muda com fatos da pessoa (a conversa marcada, os grupos);
 * nunca com pontuação, faixa ou alerta. Uma ação por tela: tocar no cartão que combina com o momento.
 * Vida (docs/17-vida-v1.md): o herói e os ladrilhos na areia dourada, cada ladrilho com o seu desenho (conversa, coração,
 * grupo, livro) e a seta em círculo; em tela larga ficam 2 x 2, com o desenho maior.
 */
@Component({
  selector: 'app-care-hub-page',
  imports: [CgHeroComponent, CgCardComponent, CgEmergencyNoteComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-cg-hero title="Cuidar de mim" description="Um tempo para você, no seu ritmo." illustration="heart" />

    <div class="cg-stack">
      <div class="cg-grid cg-tiles cg-enter" data-role="care-cards">
        <app-cg-card layout="tile" illustration="chat" title="Conversar com um psicólogo" icon="heart-handshake" link="/cuidador/cuidar-de-mim/atendimento">
          <span data-role="care-conversation">{{ hub.conversationPhrase() }}</span>
        </app-cg-card>
        <app-cg-card layout="tile" illustration="heart" title="Como estou" icon="heart-pulse" link="/cuidador/cuidar-de-mim/como-estou">
          <span data-role="care-wellbeing">{{ hub.wellbeingPhrase() }}</span>
        </app-cg-card>
        <app-cg-card layout="tile" illustration="group" title="Grupos e capacitações" icon="users" link="/cuidador/cuidar-de-mim/grupos">
          <span data-role="care-groups">{{ hub.groupsPhrase() }}</span>
        </app-cg-card>
        <app-cg-card layout="tile" illustration="book" title="Conteúdos" icon="book-open" link="/cuidador/cuidar-de-mim/conteudos">
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
