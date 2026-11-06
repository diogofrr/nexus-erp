import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CaregiverNetworkService } from '../../../../core/network/caregiver-network.service';
import { CaregiverContextService } from '../../state/caregiver-context.service';
import { CgCardComponent } from '../../ui/cg-card.component';
import { CgNoteComponent } from '../../ui/cg-note.component';
import { CgHeroComponent } from '../../ui/cg-hero.component';
import { NETWORK_NOTICE } from '../state/network-copy';

/**
 * Rede, a porta (UX C12, `/cuidador/rede`): três cartões, na ordem Buscar profissionais e serviços, Meus pedidos e Cartão
 * Nexus, e o aviso "A Nexus organiza a rede. O serviço é feito e pago direto com o profissional." Os 3 aparecem para TODOS os
 * planos, sem cadeado e sem preço. Vida (docs/17-vida-v1.md): o herói e os ladrilhos no azul profundo da Rede, cada ladrilho
 * com o seu desenho (pessoas, calendário, cartão); de 1024 px em diante os três ficam lado a lado. As frases mudam com fatos da pessoa (quantos pedidos esperam resposta; se ela tem o
 * Cartão), nunca com pontuação, faixa, alerta ou ARBE (RN-PLN-19).
 */
@Component({
  selector: 'app-cg-network-door-page',
  imports: [CgHeroComponent, CgCardComponent, CgNoteComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-cg-hero
      title="Rede"
      description="Profissionais e serviços para o cuidado da pessoa idosa. A Nexus organiza e você escolhe."
      illustration="network"
    />
    <div class="cg-stack">
      <div class="cg-grid cg-tiles cg-tiles--3 cg-enter">
        <app-cg-card layout="tile" illustration="group" title="Buscar profissionais e serviços" icon="search" link="/cuidador/rede/buscar">
          Compare as opções por necessidade.
        </app-cg-card>
        <app-cg-card layout="tile" illustration="calendar" title="Meus pedidos" icon="clipboard-list" link="/cuidador/rede/pedidos">
          <span data-role="orders-line">{{ ordersLine() }}</span>
        </app-cg-card>
        <app-cg-card layout="tile" illustration="card" title="Cartão Nexus" icon="credit-card" link="/cuidador/rede/cartao">
          <span data-role="card-line">{{ cardLine() }}</span>
        </app-cg-card>
      </div>
      <app-cg-note variant="info" data-role="notice">{{ notice }}</app-cg-note>
    </div>
  `,
})
export class NetworkDoorPage {
  private readonly network = inject(CaregiverNetworkService);
  private readonly ctx = inject(CaregiverContextService);

  protected readonly notice = NETWORK_NOTICE;

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

  /** Para quem tem o Cartão "Seu número e onde usar."; para o Livre "Um benefício dos planos pagos." (sem cadeado). */
  protected readonly cardLine = computed(() =>
    this.ctx.canUse('card') ? 'Seu número e onde usar.' : 'Um benefício dos planos pagos.',
  );
}
