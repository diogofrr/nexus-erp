import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { SubscriptionService } from '../../../../core/commerce/subscription.service';
import { formatDate, formatMoney } from '../../../../core/format/format';
import { PlanId } from '../../../../core/models';
import { PLAN_ORDER } from '../../../../core/rules/plans';
import { planShortName } from '../../../../core/rules/plan-features';
import { quotaSentence } from '../../../../core/rules/plan-quotas';
import { PageChromeService } from '../../../../layout/state/page-chrome.service';
import { IconComponent } from '../../../../shared/ui/display/icon.component';
import { CheckboxComponent } from '../../../../shared/ui/forms/checkbox.component';
import { CaregiverContextService } from '../../state/caregiver-context.service';
import { CHANNELS_NOTICE } from '../../state/nexus-contact';
import { CgNoteComponent } from '../../ui/cg-note.component';
import { CgPageHeaderComponent } from '../../ui/cg-page-header.component';
import { CgSheetComponent } from '../../ui/cg-sheet.component';
import { CaregiverPlanService } from '../state/caregiver-plan.service';
import { BoardPlan, PlanBoardComponent } from '../ui/plan-board.component';
import {
  CHANGE_FAILED,
  NOT_INCLUDED_NOTICE,
  actionLabelFor,
  allBenefits,
  boardPerks,
  quotaLines,
  changeCopy,
  planPerks,
  priceParts,
  scheduledNote,
} from '../state/plan-copy';

/**
 * Meu plano (UX C18 e B9, `/cuidador/mais/plano`). Um único herói: o plano atual num cartão com a COR do plano (Figura 1), o
 * nome em serifa grande, o preço, a próxima cobrança, a cota do mês (Cuida e Sustenta: "Neste mês: 1 de 2 sessões usadas",
 * docs/20) e 4 destaques com ícone (atendimento individual, terapia de grupo e capacitações com as cotas do docs/20; nenhuma
 * menção a Zarit); a lista inteira fica atrás de **Ver tudo que
 * inclui** (folha). Uma ação principal, **Ver outros planos** (no Livre, **Ver os planos**); **Cancelar plano** é um link calmo
 * no fim, só em plano pago. Mudança agendada vira uma faixa "Seu plano muda para X em DD/MM" com **Manter meu plano** (um
 * toque, sem folha).
 *
 * **Ver outros planos** abre o quadro de comparação (`?ver=planos`): 4 cartões lado a lado em tela larga e carrossel com
 * encaixe no celular, cada um com a sua cor, o preço e os 3 destaques DELE; o atual marcado "Seu plano". Sem "recomendado",
 * sem selo de oferta, sem urgência (RN-PLN-19 e 22). Tocar em **Escolher** abre a folha com o EFEITO dito antes: subir vale
 * hoje, descer e cancelar valem no fim do ciclo pago, com as turmas que a pessoa deixa; na primeira contratação paga, a
 * mesma folha traz o aviso de emergência numa linha com a caixa (um passo só, CXC-010). Plano pago pela empresa não tem botão
 * de troca. Pagamento simulado: nenhum campo de cartão. O plano só aparece aqui, porque a pessoa abriu esta tela; nunca por
 * pontuação, faixa, alerta ou ARBE (RN-PLN-19).
 *
 * Cores (classes `cg-tone--*` do kit, em `_vida.scss`): cada plano define `--tone` (a cor da Figura 1), `--tone-on` (o texto sobre ela, sempre 4,5:1 ou mais; os pares estão
 * em `scripts/check-caregiver-a11y.mjs`), `--tone-soft` e `--tone-text` (fundo claro e texto escuro do mesmo plano).
 */
@Component({
  selector: 'app-cg-plan-page',
  imports: [CheckboxComponent, CgNoteComponent, CgPageHeaderComponent, CgSheetComponent, IconComponent, PlanBoardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `

      @keyframes nx-rise { from { opacity: 0; transform: translateY(0.5rem); } to { opacity: 1; transform: none; } }

      .nx-perks { display: grid; gap: 0.625rem; margin: 0; padding: 0; list-style: none; }
      .nx-perks li { display: flex; align-items: center; gap: 0.75rem; min-width: 0; animation: nx-rise var(--dur-3) var(--ease) both; animation-delay: calc(var(--i, 0) * 60ms + 140ms); }
      .nx-perk__icon { flex: none; display: grid; place-items: center; inline-size: 2.5rem; block-size: 2.5rem; border-radius: 50%; background: var(--tone-soft); color: var(--tone-text); }
      .nx-perk__text { min-width: 0; overflow-wrap: anywhere; }

      .nx-hero { display: grid; border: 0; border-radius: 1.75rem; background: var(--cg-surface); box-shadow: var(--cg-shadow-2); overflow: hidden; }
      @media (min-width: 48rem) { .nx-hero { grid-template-columns: minmax(18rem, 0.85fr) 1.15fr; } }
      .nx-hero__band { position: relative; isolation: isolate; display: grid; gap: 0.25rem; align-content: center; padding: 1.25rem 1.5rem; background-color: var(--tone); background-image: linear-gradient(155deg, var(--tone) 35%, var(--tone-2)); color: var(--tone-on); overflow: hidden; }
      @media (min-width: 48rem) { .nx-hero__band { padding: 2rem; } }
      .nx-hero__mark { position: absolute; z-index: -1; inset-inline-end: -1.25rem; inset-block-end: -0.75rem; inline-size: 9rem; block-size: 6rem; color: currentColor; opacity: 0.2; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
      .nx-hero__eyebrow { margin: 0; font-size: var(--cg-fs-small); font-weight: var(--fw-semibold); }
      .nx-hero__name { margin: 0; font-family: var(--font-serif); font-weight: 400; font-size: calc(2.75rem * var(--cg-zoom)); line-height: 1.05; color: inherit; overflow-wrap: normal; }
      .nx-hero__price { margin: 0.5rem 0 0; font-size: calc(1.5rem * var(--cg-zoom)); font-weight: var(--fw-semibold); line-height: 1.2; font-variant-numeric: tabular-nums; }
      .nx-hero__unit { font-size: var(--cg-fs-body); font-weight: var(--fw-regular); }
      .nx-hero__when { margin: 0; font-size: var(--cg-fs-small); }
      .nx-hero__body { display: grid; gap: 0.5rem; align-content: center; padding: 1.25rem 1.5rem; }
      @media (min-width: 48rem) { .nx-hero__body { padding: 2rem; } }
      .nx-hero__all { justify-self: start; margin-inline-start: -0.5rem; }

      .nx-actions { display: grid; }
      @media (min-width: 48rem) { .nx-actions { display: flex; } .nx-actions .btn { min-width: 15rem; } }
      .nx-quiet { margin: 0; }
      .nx-quiet .cg-link-btn { color: var(--cg-text-soft); font-weight: var(--fw-regular); margin-inline-start: -0.5rem; }

      .nx-all { display: grid; gap: 0.75rem; margin: 0; padding: 0; list-style: none; }
      .nx-all li { display: flex; align-items: center; gap: 0.75rem; }
      .nx-all .nx-perk__icon { inline-size: 2rem; block-size: 2rem; }
      .nx-effect p { margin: 0; }
      .nx-effect__notice { color: var(--cg-text-soft); font-size: var(--cg-fs-small); }

      @media (prefers-reduced-motion: reduce) {
        .nx-perks li { animation: none; }
      }
    `,
  ],
  template: `
    @if (boardOpen()) {
      <app-cg-page-header
        title="Planos"
        description="Escolha com calma. Antes de confirmar, você vê o que muda."
        backLink="/cuidador/mais/plano"
        backLabel="Meu plano"
      />
      <div class="cg-stack">
        @if (service.isCorporate()) {
          <app-cg-note variant="soft" icon="info" data-role="corporate">{{ corporateText() }}</app-cg-note>
        }
        <app-cg-plan-board [plans]="board()" (choose)="openChange($event)" />
      </div>
    } @else {
      <app-cg-page-header title="Meu plano" backLink="/cuidador/mais" backLabel="Mais" />
      <div class="cg-stack">
        @if (result(); as r) {
          <app-cg-note [variant]="r.variant" data-role="result">{{ r.text }}</app-cg-note>
        }

        @if (ctx.scheduledChange(); as scheduled) {
          @let note = scheduledText(scheduled);
          <app-cg-note variant="info" icon="calendar-days" [heading]="note.title" data-role="scheduled">
            {{ note.text }}
            <button cgNoteActions type="button" class="cg-link-btn" data-role="keep-plan" (click)="keep()">Manter meu plano</button>
          </app-cg-note>
        }

        <section [class]="'nx-hero cg-tone--' + ctx.planId()" data-role="current-plan" aria-labelledby="nx-hero-name">
          <div class="nx-hero__band">
            <svg class="nx-hero__mark" viewBox="-18 3 156 98" aria-hidden="true"><use href="icons/sprite.svg#nx-symbol" /></svg>
            <p class="nx-hero__eyebrow">Seu plano agora</p>
            <h2 class="nx-hero__name" id="nx-hero-name"><span class="sr-only">Plano </span>{{ ctx.planName() }}</h2>
            @if (service.isCorporate()) {
              <p class="nx-hero__price" data-role="price">Pago pela empresa</p>
            } @else {
              <p class="nx-hero__price" data-role="price">
                @if (ctx.planId() === 'livre') {
                  Sem custo, sem prazo
                } @else {
                  {{ currentPrice().amount }} <span class="nx-hero__unit">{{ currentPrice().unit }}</span>
                }
              </p>
              @if (situation(); as text) {
                <p class="nx-hero__when" data-role="situation">{{ text }}</p>
              }
            }
            @if (monthQuota(); as quota) {
              <p class="nx-hero__when" data-role="month-quota">{{ quota }}</p>
            }
          </div>
          <div class="nx-hero__body">
            <ul class="nx-perks" data-role="perks">
              @for (perk of heroPerks(); track perk.key; let i = $index) {
                <li [style.--i]="i">
                  <span class="nx-perk__icon"><svg [appIcon]="perk.icon" size="md"></svg></span>
                  <span class="nx-perk__text">{{ perk.label }}</span>
                </li>
              }
            </ul>
            <button type="button" class="cg-link-btn nx-hero__all" data-role="see-all" (click)="includesOpen.set(true)">
              Ver tudo que inclui
              <svg appIcon="chevron-right" size="sm"></svg>
            </button>
          </div>
        </section>

        @if (service.isCorporate()) {
          <app-cg-note variant="soft" icon="info" data-role="corporate">{{ corporateText() }}</app-cg-note>
        } @else {
          <div class="nx-actions">
            <button type="button" class="btn btn--primary" data-role="see-plans" (click)="showBoard()">
              {{ ctx.planId() === 'livre' ? 'Ver os planos' : 'Ver outros planos' }}
            </button>
          </div>
          @if (canCancel()) {
            <p class="nx-quiet">
              <button type="button" class="cg-link-btn" data-role="cancel-plan" (click)="openChange('livre')">Cancelar plano</button>
            </p>
          }
        }
      </div>

      <app-cg-sheet [heading]="'O que o plano ' + ctx.planName() + ' inclui'" [(open)]="includesOpen">
        <ul [class]="'nx-all cg-tone--' + ctx.planId()" data-role="all-benefits">
          @for (item of currentItems(); track item) {
            <li>
              <span class="nx-perk__icon"><svg appIcon="check" size="sm"></svg></span>
              <span class="nx-perk__text">{{ item }}</span>
            </li>
          }
        </ul>
        <button cgSheetActions type="button" class="btn" data-role="close-all" (click)="includesOpen.set(false)">Fechar</button>
      </app-cg-sheet>
    }

    @if (copy(); as c) {
      <app-cg-sheet [heading]="c.heading" [(open)]="sheetOpen">
        <div class="nx-effect cg-stack cg-stack--tight" data-role="effect">
          @for (line of c.lines; track line) {
            <p>{{ line }}</p>
          }
          @if (c.showNotice) {
            <p data-role="notice">{{ notIncluded }}</p>
          }
        </div>
        @if (needsAcceptance()) {
          <!-- O aviso de emergência é uma linha e a caixa fica na MESMA folha: uma decisão, um passo (CXC-010). -->
          <div class="nx-effect cg-stack cg-stack--tight" data-role="emergency">
            <p class="nx-effect__notice">{{ channelsNotice }}</p>
            <app-checkbox [checked]="accepted()" (checkedChange)="onAccept($event)" data-role="accept">Li e entendi</app-checkbox>
            @if (acceptError()) {
              <app-cg-note variant="error" data-role="accept-error">Marque que você leu o aviso para continuar.</app-cg-note>
            }
          </div>
        }
        @if (failure(); as error) {
          <app-cg-note variant="error" data-role="failure">{{ error }}</app-cg-note>
        }
        <ng-container cgSheetActions>
          <button
            type="button"
            class="btn"
            [class.btn--primary]="c.kind !== 'cancel'"
            [class.btn--danger-quiet]="c.kind === 'cancel'"
            data-role="confirm"
            (click)="confirm()"
          >
            {{ c.actionLabel }}
          </button>
          <button type="button" class="cg-link-btn" data-role="back" (click)="sheetOpen.set(false)">Voltar</button>
        </ng-container>
      </app-cg-sheet>
    }
  `,
})
export class PlanPage {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly chrome = inject(PageChromeService);
  private readonly subscriptions = inject(SubscriptionService);
  protected readonly ctx = inject(CaregiverContextService);
  protected readonly service = inject(CaregiverPlanService);

  protected readonly notIncluded = NOT_INCLUDED_NOTICE;
  protected readonly channelsNotice = CHANNELS_NOTICE;

  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly boardOpen = computed(() => this.params().get('ver') === 'planos');

  // ===== O plano atual (o herói) =====

  private readonly currentPlan = computed(() => this.ctx.plans().find((p) => p.id === this.ctx.planId()));

  protected readonly currentPrice = computed(() => {
    const plan = this.currentPlan();
    return plan ? priceParts(plan) : { amount: '', unit: '' };
  });

  /** Os 4 destaques do herói; a lista inteira fica na folha "Ver tudo que inclui". */
  protected readonly heroPerks = computed(() => planPerks(this.ctx.planId(), this.ctx.plans(), 4));

  /** Tudo o que o plano inclui, também o que vem dos planos anteriores (CXC-010). */
  protected readonly currentItems = computed(() => allBenefits(this.ctx.planId(), this.ctx.plans()));

  protected readonly includesOpen = signal(false);

  /** "Neste mês: 1 de 2 sessões usadas", só para quem tem o atendimento individual no plano (Cuida e Sustenta, docs/20). */
  protected readonly monthQuota = computed(() =>
    this.ctx.canUse('individual_session') ? quotaSentence(this.ctx.quotas().individualSessions, 'sessões') : null,
  );

  /** "Próxima cobrança em 18/11/2026"; com mudança agendada, até quando o plano vale. */
  protected readonly situation = computed(() => {
    const sub = this.ctx.subscription();
    if (this.ctx.planId() === 'livre' || !sub) {
      return null;
    }
    const change = this.ctx.scheduledChange();
    if (change) {
      return `Seu plano atual vale até ${formatDate(change.at)}.`;
    }
    return sub.nextCycleAt ? `Próxima cobrança em ${formatDate(sub.nextCycleAt)}` : null;
  });

  /** Só plano pago, que não é da empresa e que ainda não tem cancelamento agendado. */
  protected readonly canCancel = computed(
    () => this.ctx.planId() !== 'livre' && !this.service.isCorporate() && this.ctx.scheduledChange()?.kind !== 'cancel',
  );

  protected corporateText(): string {
    const company = this.service.companyName() ?? 'a empresa';
    return `Este plano é pago pela empresa ${company}. A mudança é feita pelo contrato da empresa.`;
  }

  protected scheduledText(change: NonNullable<ReturnType<CaregiverContextService['scheduledChange']>>): { title: string; text: string } {
    return scheduledNote(change);
  }

  // ===== Comparar planos =====

  protected readonly board = computed<BoardPlan[]>(() => {
    const plans = this.ctx.plans();
    const current = this.ctx.planId();
    const canChange = !this.service.isCorporate();
    return PLAN_ORDER.flatMap((id) => {
      const plan = plans.find((p) => p.id === id);
      if (!plan) {
        return [];
      }
      const price = priceParts(plan);
      return [
        {
          id,
          name: planShortName(id, plans),
          amount: price.amount,
          unit: price.unit,
          inherits: false,
          perks: boardPerks(id),
          quotas: quotaLines(id),
          current: id === current,
          canChoose: id !== current && canChange && actionLabelFor(this.service.quote(id).kind, id) !== null,
        },
      ];
    });
  });

  protected showBoard(): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { ver: 'planos' }, queryParamsHandling: 'merge' });
  }

  private hideBoard(): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { ver: null }, queryParamsHandling: 'merge' });
  }

  // ===== Folha do efeito =====

  protected readonly target = signal<PlanId | null>(null);
  protected readonly sheetOpen = signal(false);
  protected readonly accepted = signal(false);
  protected readonly acceptError = signal(false);
  protected readonly failure = signal<string | null>(null);
  protected readonly result = signal<{ variant: 'ok' | 'info'; text: string } | null>(null);

  protected readonly copy = computed(() => {
    const to = this.target();
    if (!to) {
      return null;
    }
    const plans = this.ctx.plans();
    return changeCopy(this.service.quote(to), (id) => formatMoney(plans.find((p) => p.id === id)?.monthlyPriceCents ?? 0));
  });

  /** Na primeira contratação paga a mesma folha pede o aceite do aviso de emergência (RN-CAN-06). */
  protected readonly needsAcceptance = computed(() => {
    const to = this.target();
    return to !== null && this.service.needsEmergencyAcceptance(to);
  });

  private lastBoard: boolean | null = null;

  constructor() {
    // Uma mudança que já venceu vale ao abrir (o app também aplica ao iniciar e quando a data muda).
    this.subscriptions.applyDueChanges();

    // O foco vai ao título ao abrir e ao fechar o quadro (a URL muda só na consulta, e o shell só cuida de troca de caminho).
    effect(() => {
      const open = this.boardOpen();
      untracked(() => {
        if (this.lastBoard !== null && open !== this.lastBoard) {
          this.chrome.focusHeading();
        }
        this.lastBoard = open;
      });
    });
  }

  protected openChange(to: PlanId): void {
    this.target.set(to);
    this.accepted.set(false);
    this.acceptError.set(false);
    this.failure.set(null);
    this.sheetOpen.set(true);
  }

  protected onAccept(checked: boolean): void {
    this.accepted.set(checked);
    if (checked) {
      this.acceptError.set(false);
    }
  }

  protected confirm(): void {
    const to = this.target();
    if (!to) {
      return;
    }
    const outcome = this.service.confirm(to, { emergencyAccepted: this.accepted() });
    if (!outcome.ok) {
      this.failure.set(outcome.field === 'acceptance' ? null : outcome.error);
      this.acceptError.set(outcome.field === 'acceptance');
      return;
    }
    this.sheetOpen.set(false);
    this.result.set({ variant: 'ok', text: outcome.message });
    if (this.boardOpen()) {
      this.hideBoard();
    } else {
      this.chrome.focusHeading();
    }
  }

  protected keep(): void {
    const outcome = this.service.keep();
    if (!outcome.ok) {
      this.result.set({ variant: 'info', text: CHANGE_FAILED });
      return;
    }
    this.result.set({ variant: 'ok', text: outcome.message });
  }
}
