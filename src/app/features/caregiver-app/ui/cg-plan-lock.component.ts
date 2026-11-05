import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CaregiverFeature } from '../../../core/rules/plan-features';
import { IconComponent } from '../../../shared/ui/display/icon.component';
import { uniqueId } from '../../../shared/ui/util/ids';
import { CaregiverContextService } from '../state/caregiver-context.service';

/**
 * Bloqueio por plano (UX A.2.15): diz, SEM pressão, que um recurso é de outro plano. Cartão suave com cadeado,
 * "Disponível no plano Cuida", uma frase do que é e o plano atual, e o botão de texto "Ver os planos". Sem
 * preço em destaque, sem "Assine agora", sem contagem. Aparece IGUAL para todo mundo do mesmo plano e nunca por
 * causa de pontuação, faixa, alerta ou ARBE (RN-PLN-19). Só renderiza quando o plano NÃO libera o recurso
 * (`CaregiverContextService.canUse`); com o recurso liberado não desenha nada, então pode ficar no template
 * ao lado do conteúdo.
 *
 * Nunca bloqueie o que é para todos: atendimento psicológico, rodas abertas, conteúdos básicos, ajuda e
 * privacidade. Mostre uma alternativa gratuita quando houver, projetada como conteúdo.
 *
 * ```html
 * <app-cg-plan-lock feature="groups" description="Grupos e capacitações fazem parte do plano Cuida.">
 *   As rodas de conversa abertas são para todos.
 * </app-cg-plan-lock>
 * ```
 */
@Component({
  selector: 'app-cg-plan-lock',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cg-plan-lock-host' },
  template: `
    @if (blocked()) {
      <section class="cg-card cg-card--soft cg-plan-lock" [attr.aria-labelledby]="titleId">
        <h3 class="cg-card__title" [id]="titleId">
          <svg appIcon="lock" size="lg"></svg>
          <span>Disponível no plano {{ minPlanName() }}</span>
        </h3>
        <p class="cg-plan-lock__text">
          {{ description() }} Seu plano agora é o {{ ctx.planName() }}.
        </p>
        <div class="cg-plan-lock__extra"><ng-content /></div>
        <a class="cg-link-btn" routerLink="/cuidador/mais/plano">Ver os planos</a>
      </section>
    }
  `,
})
export class CgPlanLockComponent {
  protected readonly ctx = inject(CaregiverContextService);

  readonly feature = input.required<CaregiverFeature>();
  /** O que é o recurso, em uma frase. Sem ela, "Este recurso faz parte do plano Cuida." */
  readonly descriptionText = input<string>('', { alias: 'description' });

  protected readonly titleId = uniqueId('cg-lock');
  protected readonly blocked = computed(() => !this.ctx.canUse(this.feature()));
  protected readonly access = computed(() => this.ctx.access(this.feature()));
  protected readonly minPlanName = computed(() => {
    const min = this.access().minPlan;
    return this.ctx.plans().find((p) => p.id === min)?.name.replace(/^Nexus\s+/, '') ?? min;
  });
  protected readonly description = computed(
    () => this.descriptionText() || `Este recurso faz parte do plano ${this.minPlanName()}.`,
  );
}
