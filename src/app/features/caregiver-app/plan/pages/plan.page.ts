import { ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, computed, effect, inject, signal, untracked } from '@angular/core';
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
import { ToastService } from '../../../../shared/ui/overlay/toast.service';
import { CaregiverContextService } from '../../state/caregiver-context.service';
import { CgCardComponent } from '../../ui/cg-card.component';
import { CgEmergencyNoteComponent } from '../../ui/cg-emergency-note.component';
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
    CgEmergencyNoteComponent,
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
      .nx-effect { display: grid; gap: 0.75rem; }
      .nx-effect p { margin: 0; }
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
                  <h3 class="cg-card__title" [id]="'plan-' + plan.id">Plano {{ plan.name }}</h3>
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
      <app-cg-page-header title="Meu plano" />
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
      <app-cg-sheet [heading]="step() === 'accept' ? 'Antes de confirmar' : c.heading" [(open)]="sheetOpen">
        @if (step() === 'effect') {
          <div class="nx-effect" data-role="effect">
            @for (line of c.lines; track line) {
              <p>{{ line }}</p>
            }
            @if (c.showNotice) {
              <p data-role="notice">{{ notIncluded }}</p>
            }
          </div>
        } @else {
          <app-cg-emergency-note />
          <app-checkbox [checked]="accepted()" (checkedChange)="onAccept($event)" data-role="accept">Li e entendi</app-checkbox>
          @if (acceptError()) {
            <app-cg-note variant="error" data-role="accept-error">Marque que você leu o aviso para continuar.</app-cg-note>
          }
        }
        @if (failure(); as error) {
          <app-cg-note variant="error" data-role="failure">{{ error }}</app-cg-note>
        }
        <ng-container cgSheetActions>
          @if (step() === 'effect') {
            <button
              type="button"
              class="btn"
              [class.btn--primary]="c.kind !== 'cancel'"
              [class.btn--danger-quiet]="c.kind === 'cancel'"
              data-role="confirm"
              (click)="next()"
            >
              {{ c.actionLabel }}
            </button>
          } @else {
            <button type="button" class="btn btn--primary" data-role="confirm" (click)="confirm()">Confirmar mudança de plano</button>
          }
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
  private readonly toast = inject(ToastService);
  private readonly subscriptions = inject(SubscriptionService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly ctx = inject(CaregiverContextService);
  protected readonly service = inject(CaregiverPlanService);

  protected readonly notIncluded = NOT_INCLUDED_NOTICE;
  protected readonly cancelAnyMonth = CANCEL_ANY_MONTH;

  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly boardOpen = computed(() => this.params().get('ver') === 'planos');

  // ===== Cartão do plano atual =====

  private readonly currentPlan = computed(() => this.ctx.plans().find((p) => p.id === this.ctx.planId()));

  protected readonly currentPrice = computed(() =>
    this.ctx.planId() === 'livre' ? 'Sem custo, sem prazo' : this.currentPlan() ? priceLine(this.currentPlan()!) : '',
  );

  protected readonly currentItems = computed(() => ownBenefits(this.ctx.planId(), this.ctx.plans()));

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
  protected readonly step = signal<'effect' | 'accept'>('effect');
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
    this.step.set('effect');
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

  /** Botão do efeito: na primeira contratação paga pede o aceite do aviso; nos demais casos confirma na hora. */
  protected next(): void {
    const to = this.target();
    if (!to) {
      return;
    }
    if (this.service.needsEmergencyAcceptance(to)) {
      this.step.set('accept');
      this.focusSheetTitle();
      return;
    }
    this.confirm();
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
    this.toast.show({ message: outcome.message, durationMs: 8000 });
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
    this.toast.show({ message: outcome.message, durationMs: 8000 });
  }

  /** Dentro da folha aberta, a troca de passo leva o foco ao novo título. */
  private focusSheetTitle(): void {
    afterNextRender(
      () => this.host.nativeElement.querySelector<HTMLElement>('dialog[open] .cg-sheet__title')?.focus(),
      { injector: this.injector },
    );
  }
}
