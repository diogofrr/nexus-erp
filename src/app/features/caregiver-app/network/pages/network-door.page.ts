import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CaregiverNetworkService } from '../../../../core/network/caregiver-network.service';
import { CaregiverContextService } from '../../state/caregiver-context.service';
import { hasCard } from '../../state/plan-access';
import { CgCardComponent } from '../../ui/cg-card.component';
import { CgHeroComponent } from '../../ui/cg-hero.component';
import { NETWORK_NOTICE } from '../state/network-copy';

/**
 * Rede, a porta (UX C12, `/cuidador/rede`; docs/20, regras de exibição 1 e 4). Um herói com uma linha (a frase de que a
 * Nexus organiza a rede e o serviço é feito e pago direto com o profissional, RN-REDE-17) e a grade de ladrilhos da mesma
 * altura: Buscar profissionais e serviços, Meus pedidos e, SÓ para quem tem o Cartão Nexus (Essencial em diante), Cartão
 * Nexus. Quem não tem o cartão não vê nada sobre ele aqui (nem convite, nem cadeado): isso fica em Meu plano. Sem preço.
 * Vida (docs/17-vida-v1.md): o herói e os ladrilhos no azul profundo da Rede, cada ladrilho com o seu desenho; de 1024 px
 * em diante ficam lado a lado. As frases mudam com fatos da pessoa (quantos pedidos esperam resposta), nunca com
 * pontuação, faixa, alerta ou ARBE (RN-PLN-19).
 */
@Component({
  selector: 'app-cg-network-door-page',
  imports: [CgHeroComponent, CgCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-cg-hero title="Rede" [description]="notice" illustration="network" />
    <div class="cg-stack">
      <div class="cg-grid cg-tiles cg-equal cg-enter" [class.cg-tiles--3]="withCard()" data-role="network-cards">
        <app-cg-card layout="tile" illustration="group" title="Buscar profissionais e serviços" icon="search" link="/cuidador/rede/buscar">
          Compare as opções por necessidade.
        </app-cg-card>
        <app-cg-card layout="tile" illustration="calendar" title="Meus pedidos" icon="clipboard-list" link="/cuidador/rede/pedidos">
          <span data-role="orders-line">{{ ordersLine() }}</span>
        </app-cg-card>
        @if (withCard()) {
          <app-cg-card layout="tile" illustration="card" title="Cartão Nexus" icon="credit-card" link="/cuidador/rede/cartao">
            <span data-role="card-line">Seu número e onde usar.</span>
          </app-cg-card>
        }
      </div>
    </div>
  `,
})
export class NetworkDoorPage {
  private readonly network = inject(CaregiverNetworkService);
  private readonly ctx = inject(CaregiverContextService);

  protected readonly notice = NETWORK_NOTICE;

  /** O ladrilho do Cartão Nexus só existe para quem tem o cartão (RN-CRT-02). */
  protected readonly withCard = computed(() => hasCard(this.ctx));

  protected readonly ordersLine = computed(() => {
    const id = this.ctx.caregiverId();
    if (!id) {
      return 'Você ainda não fez pedidos.';
    }
    const awaiting = this.network.awaitingCount(id);
    if (awaiting > 0) {
      return awaiting === 1 ? '1 pedido aguardando resposta.' : `${awaiting} pedidos aguardando resposta.`;
    }
    const toEvaluate = this.network.toEvaluateCount(id);
    if (toEvaluate > 0) {
      return toEvaluate === 1 ? '1 serviço para avaliar.' : `${toEvaluate} serviços para avaliar.`;
    }
    return this.network.requestsOf(id).length === 0 ? 'Você ainda não fez pedidos.' : 'Acompanhe os seus pedidos.';
  });
}
