import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { SubscriptionService } from '../../../../core/commerce/subscription.service';
import { formatDate, formatMoney } from '../../../../core/format/format';
import { PlanId } from '../../../../core/models';
import { PLAN_ORDER } from '../../../../core/rules/plans';
import { planShortName } from '../../../../core/rules/plan-features';
import { PageChromeService } from '../../../../layout/state/page-chrome.service';
import { BadgeComponent } from '../../../../shared/ui/display/badge.component';
import { CheckboxComponent } from '../../../../shared/ui/forms/checkbox.component';
import { CaregiverContextService } from '../../state/caregiver-context.service';
import { CHANNELS_NOTICE } from '../../state/nexus-contact';
import { CgCardComponent } from '../../ui/cg-card.component';
import { CgNoteComponent } from '../../ui/cg-note.component';
import { CgPageHeaderComponent } from '../../ui/cg-page-header.component';
import { CgPlanTagComponent } from '../../ui/cg-plan-tag.component';
import { CgSheetComponent } from '../../ui/cg-sheet.component';
import { CaregiverPlanService } from '../state/caregiver-plan.service';
import {
  CANCEL_ANY_MONTH,
  CHANGE_FAILED,
  NOT_INCLUDED_NOTICE,
  actionLabelFor,
  allBenefits,
  changeCopy,
  ownBenefits,
  priceLine,
} from '../state/plan-copy';

interface BoardPlan {
  id: PlanId;
  name: string;
  price: string;
  /** "Tudo do plano anterior, mais:" (todos menos o Livre). */
  inherits: boolean;
  items: string[];
  current: boolean;
  /** Texto do botão de troca; `null` no plano atual e quando a pessoa não pode trocar. */
  action: string | null;
}

/**
 * Meu plano (UX C18 e B9, `/cuidador/mais/plano`). O cartão do plano atual (etiqueta, preço, situação e o que inclui),
 * **Ver outros planos** (no Livre, **Ver os planos**) e, só em plano pago, **Cancelar plano**. O quadro dos 4 planos abre em
 * folha de tela cheia (`?ver=planos`), sem letra miúda, com o aviso "a mensalidade não inclui serviços da rede nem atendimento
 * psicológico". Tocar num plano abre a folha com o EFEITO dito antes: subir vale hoje, descer e cancelar valem no fim do
 * ciclo pago, com as turmas que a pessoa deixa. Mudança agendada tem **Manter meu plano** (um toque, sem folha). Plano
 * pago pela empresa não tem botão de troca. Pagamento simulado: nenhum campo de cartão. O plano só aparece aqui, porque a
 * pessoa abriu esta tela; nunca por pontuação, faixa, alerta ou ARBE (RN-PLN-19).
 */
@Component({
  selector: 'app-cg-plan-page',
  imports: [
    BadgeComponent,
    CheckboxComponent,
    CgCardComponent,
    CgNoteComponent,
    CgPageHeaderComponent,
    CgPlanTagComponent,
    CgSheetComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .nx-price { margin: 0; font-size: var(--cg-fs-lead); font-weight: var(--fw-semibold); color: var(--cg-heading); }
      .nx-items { margin: 0; padding-inline-start: 1.25rem; display: grid; gap: 0.25rem; }
      .nx-plans { display: grid; gap: var(--cg-gap-block); margin: 0; padding: 0; list-style: none; grid-template-columns: minmax(0, 1fr); }
      @media (min-width: 64rem) { .nx-plans { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      .nx-plan { display: grid; gap: 0.75rem; align-content: start; height: 100%; }
      .nx-plan__head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.5rem; }
      .nx-plan__more { margin: 0; font-weight: var(--fw-semibold); }
      .nx-effect p { margin: 0; }
      .nx-effect__notice { color: var(--cg-text-soft); font-size: var(--cg-fs-small); }
    `,
  ],
  template: `
    @if (boardOpen()) {
      <app-cg-page-header title="Planos" backLink="/cuidador/mais/plano" backLabel="Meu plano" />
      <div class="cg-stack">
        <app-cg-note variant="info" data-role="not-included">{{ notIncluded }}</app-cg-note>
        <p data-role="cancel-any-month">{{ cancelAnyMonth }}</p>
        @if (service.isCorporate()) {
          <app-cg-note variant="soft" icon="info" data-role="corporate">{{ corporateText() }}</app-cg-note>
        }
        <ul class="nx-plans">
          @for (plan of board(); track plan.id) {
            <li>
              <section class="cg-card nx-plan" [attr.aria-labelledby]="'plan-' + plan.id" data-role="board-plan">
                <div class="nx-plan__head">
                  <h2 class="cg-card__title" [id]="'plan-' + plan.id">Plano {{ plan.name }}</h2>
                  @if (plan.current) {
                    <app-badge variant="info" icon="check">Seu plano agora</app-badge>
                  }
                </div>
                <p class="nx-price">{{ plan.price }}</p>
                @if (plan.inherits) {
                  <p class="nx-plan__more">Tudo do plano anterior, mais:</p>
                }
                <ul class="nx-items">
                  @for (item of plan.items; track item) {
                    <li>{{ item }}</li>
                  }
                </ul>
                @if (plan.action; as label) {
                  <button type="button" class="btn" [attr.data-plan]="plan.id" (click)="openChange(plan.id)">{{ label }}</button>
                }
              </section>
            </li>
          }
        </ul>
      </div>
    } @else {
      <app-cg-page-header title="Meu plano" backLink="/cuidador/mais" backLabel="Mais" />
      <div class="cg-stack">
        @if (result(); as r) {
          <app-cg-note [variant]="r.variant" data-role="result">{{ r.text }}</app-cg-note>
        }

        <app-cg-card title="Seu plano agora" data-role="current-plan">
          <app-cg-plan-tag [plan]="ctx.planId()" />
          @if (service.isCorporate()) {
            <p class="nx-price">Pago pela empresa</p>
          } @else {
            <p class="nx-price" data-role="price">{{ currentPrice() }}</p>
            @if (situation(); as text) {
              <p data-role="situation">{{ text }}</p>
            }
          }
          <ul class="nx-items">
            @for (item of currentItems(); track item) {
              <li>{{ item }}</li>
            }
          </ul>
          @if (!service.isCorporate()) {
            <div cgCardFooter class="cg-stack cg-stack--tight">
              <button type="button" class="btn" data-role="see-plans" (click)="showBoard()">
                {{ ctx.planId() === 'livre' ? 'Ver os planos' : 'Ver outros planos' }}
              </button>
              @if (canCancel()) {
                <button type="button" class="cg-link-btn" data-role="cancel-plan" (click)="openChange('livre')">Cancelar plano</button>
              }
            </div>
          }
        </app-cg-card>

        @if (service.isCorporate()) {
          <app-cg-note variant="soft" icon="info" data-role="corporate">{{ corporateText() }}</app-cg-note>
        }

        @if (ctx.scheduledChange(); as scheduled) {
          <app-cg-note variant="info" data-role="scheduled">
            {{ scheduledText(scheduled.label) }}
            <button cgNoteActions type="button" class="cg-link-btn" data-role="keep-plan" (click)="keep()">Manter meu plano</button>
          </app-cg-note>
        }
      </div>
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
  protected readonly cancelAnyMonth = CANCEL_ANY_MONTH;

  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly boardOpen = computed(() => this.params().get('ver') === 'planos');

  // ===== Cartão do plano atual =====

  private readonly currentPlan = computed(() => this.ctx.plans().find((p) => p.id === this.ctx.planId()));

  protected readonly currentPrice = computed(() =>
    this.ctx.planId() === 'livre' ? 'Sem custo, sem prazo' : this.currentPlan() ? priceLine(this.currentPlan()!) : '',
  );

  /** Tudo o que o plano inclui, também o que vem dos planos anteriores (CXC-010). */
  protected readonly currentItems = computed(() => allBenefits(this.ctx.planId(), this.ctx.plans()));

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

  protected scheduledText(label: string): string {
    return `${label}.`;
  }

  // ===== Quadro dos 4 planos =====

  protected readonly board = computed<BoardPlan[]>(() => {
    const plans = this.ctx.plans();
    const current = this.ctx.planId();
    const canChange = !this.service.isCorporate();
    return PLAN_ORDER.flatMap((id) => {
      const plan = plans.find((p) => p.id === id);
      if (!plan) {
        return [];
      }
      return [
        {
          id,
          name: planShortName(id, plans),
          price: priceLine(plan),
          inherits: id !== 'livre',
          items: ownBenefits(id, plans),
          current: id === current,
          action: id === current || !canChange ? null : actionLabelFor(this.service.quote(id).kind, id),
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
