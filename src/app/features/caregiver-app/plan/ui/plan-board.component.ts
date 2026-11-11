import { ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, effect, inject, input, output, untracked, viewChild } from '@angular/core';
import { PlanId } from '../../../../core/models';
import { IconComponent } from '../../../../shared/ui/display/icon.component';
import { CANCEL_ANY_MONTH, NOT_INCLUDED_NOTICE, Perk } from '../state/plan-copy';

/** Um plano no quadro de comparação (UX C18): o que a pessoa lê e se pode escolhê-lo. */
export interface BoardPlan {
  id: PlanId;
  name: string;
  amount: string;
  unit: string;
  /** "Tudo do plano anterior, mais:" (todos menos o Livre). */
  inherits: boolean;
  /** Os 3 destaques PRÓPRIOS do plano, nunca a lista inteira. */
  perks: Perk[];
  /** As linhas de cota do docs/20 (atendimento individual, terapia de grupo, capacitações), iguais nos 4 cartões para comparar. */
  quotas: { key: string; label: string; value: string }[];
  current: boolean;
  /** `true` quando a pessoa pode trocar para este plano (não é o atual e o plano não é da empresa). */
  canChoose: boolean;
}

/**
 * Comparar planos (UX C18, `?ver=planos`): os 4 planos, cada um com a SUA cor (Figura 1), o preço e os 3 destaques dele. De
 * 1200 px em diante ficam lado a lado; abaixo disso é um carrossel de rolagem horizontal com encaixe (o próximo cartão aparece
 * pela borda) que já abre com o plano atual no meio. O atual leva a marca "Seu plano" no lugar do botão; os outros, o botão
 * calmo **Escolher** (o efeito vem na folha, dito antes). Sem "recomendado", sem selo de oferta, sem urgência (RN-PLN-19 e 22).
 * Embaixo, o aviso fixo da mensalidade (RN-PLN-22) e "Você pode cancelar em qualquer mês, sem multa."
 *
 * Cores: `--tone` (a cor do plano), `--tone-on` (o texto sobre ela, 4,5:1 ou mais), `--tone-soft`, `--tone-text` e `--tone-line`;
 * os pares estão em `scripts/check-caregiver-a11y.mjs` (seção "Meu plano").
 */
@Component({
  selector: 'app-cg-plan-board',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host { display: block; }
      @keyframes nx-rise { from { opacity: 0; transform: translateY(0.5rem); } to { opacity: 1; transform: none; } }
      .nx-board__track { display: flex; gap: 1rem; margin: 0 calc(var(--cg-gutter) * -1); padding: 0.5rem var(--cg-gutter) 1.25rem; list-style: none; overflow-x: auto; overscroll-behavior-x: contain; scroll-snap-type: x mandatory; scroll-padding-inline: var(--cg-gutter); position: relative; }
      .nx-board__track > li { display: flex; flex: 0 0 min(17.5rem, 78%); scroll-snap-align: center; }
      @media (min-width: 75rem) {
        :host { inline-size: 72rem; margin-inline: calc((100% - 72rem) / 2); }
        .nx-board__track { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 0; padding: 0.5rem 0 1.25rem; overflow: visible; }
        .nx-board__track > li { flex: none; }
      }
      .nx-tier { display: flex; flex-direction: column; inline-size: 100%; border: 1px solid var(--cg-border); border-radius: var(--radius-xl); background: var(--cg-surface); box-shadow: var(--shadow-1); overflow: hidden; }
      .nx-tier.is-current { border: 2px solid var(--tone-line); box-shadow: var(--shadow-2); }
      .nx-tier__band { display: grid; gap: 0.375rem; align-content: end; padding: 1.25rem 1.25rem 1rem; background-color: var(--tone); background-image: linear-gradient(155deg, var(--tone) 35%, var(--tone-2)); color: var(--tone-on); }
      .nx-tier__name { display: grid; margin: 0; color: inherit; font-family: var(--font-sans); font-size: var(--cg-fs-small); font-weight: var(--fw-semibold); line-height: 1.2; }
      .nx-tier__title { font-family: var(--font-serif); font-weight: 400; font-size: calc(2.25rem * var(--cg-zoom)); line-height: 1.1; }
      .nx-tier__body { display: flex; flex: 1; flex-direction: column; gap: 0.75rem; padding: 1.25rem; }
      .nx-tier__here { display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin: auto 0 0; min-block-size: var(--cg-target); border-radius: var(--cg-radius-control); background: var(--tone-soft); color: var(--tone-text); font-weight: var(--fw-semibold); }
      .nx-price { margin: 0; font-family: var(--font-serif); font-size: calc(1.875rem * var(--cg-zoom)); line-height: 1.15; color: var(--tone-text); font-variant-numeric: tabular-nums; }
      .nx-price__unit { font-family: var(--font-sans); font-size: var(--cg-fs-small); color: var(--cg-text-soft); }
      .nx-tier__perks { flex: 1; }
      .nx-plan__more { margin: 0 0 0.5rem; color: var(--cg-text-soft); font-size: var(--cg-fs-small); }
      .nx-perks { display: grid; gap: 0.625rem; margin: 0; padding: 0; list-style: none; }
      .nx-perks li { display: flex; align-items: center; gap: 0.75rem; min-width: 0; animation: nx-rise var(--dur-3) var(--ease) both; animation-delay: 140ms; }
      .nx-perk__icon { flex: none; display: grid; place-items: center; inline-size: 2rem; block-size: 2rem; border-radius: 50%; background: var(--tone-soft); color: var(--tone-text); }
      .nx-perk__text { min-width: 0; overflow-wrap: anywhere; font-size: var(--cg-fs-small); line-height: 1.35; }
      .nx-quotas { display: grid; gap: 0.5rem; margin: 0 0 1rem; padding: 0.75rem; border-radius: var(--cg-radius-control); background: var(--tone-soft); }
      .nx-quota { display: grid; gap: 0.125rem; }
      .nx-quota dt { font-size: var(--cg-fs-small); color: var(--tone-text); }
      .nx-quota dd { margin: 0; font-weight: var(--fw-semibold); color: var(--tone-text); }
      .nx-tier .btn { margin-top: auto; inline-size: 100%; }
      .nx-fine { display: grid; gap: 0.5rem; margin: 0.25rem 0 0; padding: 0; list-style: none; color: var(--cg-text-soft); font-size: var(--cg-fs-small); }
      .nx-fine li { display: flex; align-items: flex-start; gap: 0.5rem; }
      .nx-fine .icon { flex: none; margin-top: 0.125rem; color: var(--cg-soft-icon); }
      .nx-fine p { margin: 0; }
      @media (prefers-reduced-motion: reduce) { .nx-perks li { animation: none; } }
    `,
  ],
  template: `
    <ul class="nx-board__track" #track tabindex="0" aria-label="Os quatro planos. Role para o lado para ver todos.">
      @for (plan of plans(); track plan.id) {
        <li>
          <section
            [class]="'nx-tier cg-tone--' + plan.id + (plan.current ? ' is-current' : '')"
            [attr.aria-labelledby]="'plan-' + plan.id"
            data-role="board-plan"
          >
            <div class="nx-tier__band">
              <h2 class="nx-tier__name" [id]="'plan-' + plan.id">
                <span>Plano </span>
                <span class="nx-tier__title">{{ plan.name }}</span>
              </h2>
            </div>
            <div class="nx-tier__body">
              <p class="nx-price">{{ plan.amount }} <span class="nx-price__unit">{{ plan.unit }}</span></p>
              <div class="nx-tier__perks">
                @if (plan.inherits) {
                  <p class="nx-plan__more">Tudo do plano anterior, mais:</p>
                }
                <dl class="nx-quotas" data-role="quotas">
                  @for (q of plan.quotas; track q.key) {
                    <div class="nx-quota" [attr.data-quota]="q.key">
                      <dt>{{ q.label }}</dt>
                      <dd>{{ q.value }}</dd>
                    </div>
                  }
                </dl>
                <ul class="nx-perks nx-items">
                  @for (perk of plan.perks; track perk.key) {
                    <li>
                      <span class="nx-perk__icon"><svg [appIcon]="perk.icon" size="sm"></svg></span>
                      <span class="nx-perk__text">{{ perk.label }}</span>
                    </li>
                  }
                </ul>
              </div>
              @if (plan.current) {
                <!-- No lugar do botão, a marca do plano atual (sem ação). -->
                <p class="nx-tier__here" data-role="here"><svg appIcon="check" size="sm"></svg>Seu plano</p>
              } @else if (plan.canChoose) {
                <button type="button" class="btn" [attr.data-plan]="plan.id" (click)="choose.emit(plan.id)">
                  Escolher<span class="sr-only"> o plano {{ plan.name }}</span>
                </button>
              }
            </div>
          </section>
        </li>
      }
    </ul>
    <ul class="nx-fine">
      <li>
        <svg appIcon="info" size="sm"></svg>
        <p data-role="not-included">{{ notIncluded }}</p>
      </li>
      <li>
        <svg appIcon="circle-check" size="sm"></svg>
        <p data-role="cancel-any-month">{{ cancelAnyMonth }}</p>
      </li>
    </ul>
  `,
})
export class PlanBoardComponent {
  private readonly injector = inject(Injector);
  private readonly track = viewChild<ElementRef<HTMLElement>>('track');

  readonly plans = input.required<readonly BoardPlan[]>();
  /** A pessoa tocou em **Escolher** num plano. */
  readonly choose = output<PlanId>();

  protected readonly notIncluded = NOT_INCLUDED_NOTICE;
  protected readonly cancelAnyMonth = CANCEL_ANY_MONTH;

  constructor() {
    // No carrossel do celular, o plano atual já aparece no meio (sem animação).
    effect(() => {
      const track = this.track();
      if (track) {
        untracked(() => afterNextRender(() => this.centerCurrent(track.nativeElement), { injector: this.injector }));
      }
    });
  }

  private centerCurrent(track: HTMLElement): void {
    const card = track.querySelector<HTMLElement>('.is-current');
    if (card && track.scrollWidth > track.clientWidth) {
      const item = card.parentElement ?? card;
      track.scrollLeft = Math.max(0, item.offsetLeft - (track.clientWidth - item.offsetWidth) / 2);
    }
  }
}
