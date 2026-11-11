import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Database } from '../../../../core/data/database';
import { formatMoney } from '../../../../core/format/format';
import { planShortName } from '../../../../core/rules/plan-features';
import { CaregiverContextService } from '../../state/caregiver-context.service';
import { ContactDialogService } from '../../state/contact-dialog.service';
import { dayMonth } from '../../state/day-format';
import { initialsOf } from '../../../../shared/ui/overlay/user-display';
import { CgHeroComponent } from '../../ui/cg-hero.component';
import { CgPlanTagComponent } from '../../ui/cg-plan-tag.component';
import { CgRowComponent } from '../../ui/cg-row.component';
import { CgSectionComponent } from '../../ui/cg-section.component';
import { CgTextSizeComponent } from '../../ui/cg-text-size.component';
import { CaregiverSignOutService } from '../caregiver-sign-out.service';

/**
 * Mais (a porta, UX C17; docs/20, regra de exibição 4): o que não é do dia a dia, em grupos com título. O herói traz o
 * nome da pessoa com a etiqueta do plano; depois três grupos de itens, **Conta** (Meu plano, Meu perfil, Família),
 * **Ajuda** (Falar com a Nexus, Ajuda agora) e **Privacidade** (Privacidade e meus dados); o painel **Tamanho da letra**;
 * e Sair. Meu plano é um item como os outros: o apoio é informação neutra ("Cuida · R$ 119,90 por mês", "Livre · sem
 * custo", "Muda para o Livre em 13/11"), sem chamada, contador, ponto de notificação nem selo de novidade. Sair não pede
 * confirmação (é reversível: entrar de novo). A porta é da Base; as telas de dentro são das áreas `plan`, `help`,
 * `family`, `privacy` e `start` (perfil).
 */
@Component({
  selector: 'app-more-hub-page',
  imports: [CgHeroComponent, CgPlanTagComponent, CgRowComponent, CgSectionComponent, CgTextSizeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .more-cols {
      display: grid;
      gap: var(--cg-gap-block);
      grid-template-columns: minmax(0, 1fr);
      align-items: start;
    }
    @media (min-width: 64rem) {
      .more-cols {
        grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
        gap: 2rem;
      }
    }
    .more-groups,
    .more-side {
      display: grid;
      gap: var(--cg-gap-block);
    }
    .more-side .cg-section {
      margin-top: 0;
    }
  `,
  template: `
    <app-cg-hero title="Mais" illustration="welcome">
      <p class="cg-who">
        <span class="cg-who__avatar" aria-hidden="true">{{ initials() }}</span>
        <strong class="cg-who__name">{{ ctx.caregiver()?.fullName }}</strong>
        <app-cg-plan-tag [plan]="ctx.planId()" />
      </p>
    </app-cg-hero>

    <div class="more-cols">
      <div class="more-groups cg-enter">
        <app-cg-section title="Conta" data-role="group-account">
          <ul class="cg-list">
            <li class="cg-sec--cuidar">
              <app-cg-row title="Meu plano" [description]="planLine()" icon="credit-card" link="/cuidador/mais/plano" />
            </li>
            <li class="cg-sec--mais">
              <app-cg-row title="Meu perfil" description="Seus dados e os de quem você cuida" icon="user-round" link="/cuidador/mais/perfil" />
            </li>
            <li class="cg-sec--rotina">
              <app-cg-row title="Família" description="Compartilhe a rotina com quem ajuda você" icon="users" link="/cuidador/mais/familia" />
            </li>
          </ul>
        </app-cg-section>

        <app-cg-section title="Ajuda" data-role="group-help">
          <ul class="cg-list">
            <li class="cg-sec--hoje">
              <app-cg-row title="Falar com a Nexus" description="Aplicativo, WhatsApp e telefone" icon="messages-square" link="/cuidador/mais/ajuda" />
            </li>
            <li class="cg-sec--hoje">
              <app-cg-row title="Ajuda agora" description="SAMU 192, CVV 188 e a equipe" icon="life-buoy" link="/cuidador/ajuda-agora" />
            </li>
          </ul>
        </app-cg-section>

        <app-cg-section title="Privacidade" data-role="group-privacy">
          <ul class="cg-list">
            <li class="cg-sec--rede">
              <app-cg-row title="Privacidade e meus dados" [description]="privacyLine()" icon="shield-check" link="/cuidador/mais/privacidade" />
            </li>
          </ul>
        </app-cg-section>
      </div>

      <div class="more-side">
        <section class="cg-section cg-panel" aria-labelledby="cg-more-text">
          <h2 class="cg-section__title" id="cg-more-text">Tamanho da letra</h2>
          <app-cg-text-size />
        </section>

        <div class="cg-actions">
          <button type="button" class="btn" data-role="sign-out" (click)="signOut()">Sair</button>
          <button type="button" class="cg-link-btn" data-role="contact" (click)="contact.open()">
            Como falar com a gente
          </button>
        </div>
      </div>
    </div>
  `,
})
export class MoreHubPageComponent {
  protected readonly ctx = inject(CaregiverContextService);
  protected readonly contact = inject(ContactDialogService);
  private readonly db = inject(Database);
  private readonly signOutService = inject(CaregiverSignOutService);

  /** As iniciais do nome, no avatar (decorativo: o nome vem escrito ao lado). */
  protected readonly initials = computed(() => initialsOf(this.ctx.caregiver()?.fullName ?? ''));

  /** "Cuida · R$ 119,90 por mês", "Livre · sem custo" ou "Muda para o Livre em 13/11". */
  protected readonly planLine = computed(() => {
    const change = this.ctx.scheduledChange();
    if (change) {
      return `Muda para o ${planShortName(change.to, this.ctx.plans())} em ${dayMonth(change.at)}`;
    }
    const price = this.ctx.plan()?.monthlyPriceCents ?? 0;
    return price > 0
      ? `${this.ctx.planName()} · ${formatMoney(price)} por mês`
      : `${this.ctx.planName()} · sem custo`;
  });

  /** Um pedido de dados (cópia, correção, eliminação...) ainda em andamento muda o apoio do item. */
  protected readonly privacyLine = computed(() => {
    const id = this.ctx.caregiverId();
    const open = id
      ? this.db.dataSubjectRequests.count(
          (r) => r.caregiverId === id && (r.status === 'open' || r.status === 'in_progress'),
        ) > 0
      : false;
    return open ? 'Há um pedido em andamento' : 'Suas autorizações, cópia e eliminação dos dados';
  });

  protected signOut(): void {
    void this.signOutService.signOut();
  }
}
