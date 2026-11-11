import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CaregiverContextService } from '../../state/caregiver-context.service';
import { canBookSession } from '../../state/plan-access';
import { CgCardComponent } from '../../ui/cg-card.component';
import { CgHeroComponent } from '../../ui/cg-hero.component';
import { CareHubService, HUB_CONTENT_DEFAULT } from '../state/care-hub.service';

/**
 * Cuidar de mim, a porta (UX C7; docs/20, regras de exibição 1 e 4; RN-PLN-19, RN-ETICA-15). Um herói com uma linha e
 * uma grade de ladrilhos da mesma altura, nada mais. Para Cuida e Sustenta, quatro ladrilhos: Conversar com um
 * psicólogo, Como estou, Encontros e Conteúdos. Para Livre e Essencial, três: o atendimento individual não é vendido a
 * esses planos, então o ladrilho NÃO aparece (nem cadeado, nem "disponível no plano"). Em dois ladrilhos a frase muda
 * com fatos da pessoa (a conversa marcada, os encontros), nunca com pontuação, faixa ou alerta. Aviso de emergência
 * só em Ajuda agora, Conversar com um psicólogo e Como estou: aqui não.
 * Vida (docs/17-vida-v1.md): o herói e os ladrilhos na areia dourada, cada ladrilho com o seu desenho (conversa, coração,
 * grupo, livro) e a seta em círculo; em tela larga ficam em grade (2 x 2 com quatro, uma linha com três).
 */
@Component({
  selector: 'app-care-hub-page',
  imports: [CgHeroComponent, CgCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-cg-hero title="Cuidar de mim" description="Um tempo para você, no seu ritmo." illustration="heart" />

    <div class="cg-stack">
      <div class="cg-grid cg-tiles cg-equal cg-enter" [class.cg-tiles--3]="!withSession()" data-role="care-cards">
        @if (withSession()) {
          <app-cg-card layout="tile" illustration="chat" title="Conversar com um psicólogo" icon="heart-handshake" link="/cuidador/cuidar-de-mim/atendimento">
            <span data-role="care-conversation">{{ hub.conversationPhrase() }}</span>
          </app-cg-card>
        }
        <app-cg-card layout="tile" illustration="heart" title="Como estou" icon="heart-pulse" link="/cuidador/cuidar-de-mim/como-estou">
          <span data-role="care-wellbeing">{{ hub.wellbeingPhrase() }}</span>
        </app-cg-card>
        <app-cg-card layout="tile" illustration="group" title="Encontros" icon="users" link="/cuidador/cuidar-de-mim/grupos">
          <span data-role="care-groups">{{ hub.groupsPhrase() }}</span>
        </app-cg-card>
        <app-cg-card layout="tile" illustration="book" title="Conteúdos" icon="book-open" link="/cuidador/cuidar-de-mim/conteudos">
          <span data-role="care-content">{{ contentText }}</span>
        </app-cg-card>
      </div>
    </div>
  `,
})
export class CareHubPage {
  protected readonly hub = inject(CareHubService);
  private readonly ctx = inject(CaregiverContextService);
  protected readonly contentText = HUB_CONTENT_DEFAULT;

  /** O ladrilho da conversa só existe para quem o plano atende (Cuida e Sustenta). */
  protected readonly withSession = computed(() => canBookSession(this.ctx));
}
