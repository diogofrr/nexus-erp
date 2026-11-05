import { ChangeDetectionStrategy, Component, computed, inject, input, model, output, signal } from '@angular/core';
import { Database } from '@core/data';
import { formatMoney } from '@core/format';
import type { ID, PlanId } from '@core/models';
import { ChangeQuote, ChangeResult, PLAN_SHORT_NAMES, SubscriptionError, SubscriptionService } from '@core/commerce/subscription.service';
import { BENEFIT_LABELS, PLAN_ORDER, planBenefits } from '@core/rules';
import { PlanBadgeComponent } from '../display/badge.component';
import { DrawerComponent } from '../overlay/drawer.component';
import { ToastService } from '../overlay/toast.service';
import { uniqueId } from '../util/ids';

interface PlanOption {
  id: PlanId;
  name: string;
  price: string;
  current: boolean;
  enters: string[];
  leaves: string[];
}

/**
 * Gaveta "Trocar plano" (F03, SCR-M03-03 aba Plano e cartão e SCR-M04-03). Mostra os 4 planos com o que
 * ENTRA e o que SAI em relação ao atual; ao escolher, o painel diz o efeito em frase e o botão ganha o
 * nome da ação. Upgrade vale hoje e emite o cartão; descida e cancelamento valem no fim do ciclo; plano
 * pago por empresa não muda aqui. Quem hospeda decide se mostra o botão (permissão).
 */
@Component({
  selector: 'app-plan-change-drawer',
  imports: [DrawerComponent, PlanBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-drawer [(open)]="open" [heading]="heading()" [subtitle]="subtitle()" (closed)="reset()">
      @if (open() && sub(); as subscription) {
        <div class="stack stack--6">
          @if (payerBlock()) {
            <p class="banner banner--attention" role="status">{{ payerBlock() }}</p>
          }
          <fieldset class="stack stack--3" [disabled]="!!payerBlock()">
            <legend class="field__label">Escolha o novo plano</legend>
            @for (option of options(); track option.id) {
              <label class="radio" [attr.data-plan]="option.id">
                <input
                  type="radio"
                  [name]="group"
                  [checked]="selected() === option.id"
                  [disabled]="option.current"
                  (change)="choose(option.id)"
                />
                <span>
                  <span class="cluster">
                    <app-plan-badge [plan]="option.id" />
                    <strong>{{ option.price }}</strong>
                    @if (option.current) {
                      <span class="badge badge--info">Plano atual</span>
                    }
                  </span>
                  @if (option.current) {
                    <small>O cuidador já está neste plano.</small>
                  } @else {
                    @if (option.enters.length > 0) {
                      <small>Entra: {{ option.enters.join(', ') }}.</small>
                    }
                    @if (option.leaves.length > 0) {
                      <small>Sai: {{ option.leaves.join(', ') }}.</small>
                    }
                  }
                </span>
              </label>
            }
          </fieldset>
          @if (quote(); as q) {
            <p class="banner" [class.banner--attention]="q.timing === 'blocked'" role="status" data-role="effect">
              {{ q.effect }}
            </p>
          }
          @if (error()) {
            <p class="field__error" role="alert">{{ error() }}</p>
          }
        </div>
      }
      <ng-container drawerFooter>
        <button type="button" class="btn" (click)="open.set(false)">Voltar</button>
        <button
          type="button"
          class="btn btn--primary"
          [disabled]="!quote() || quote()?.timing === 'blocked' || busy()"
          (click)="confirm()"
        >
          {{ quote()?.actionLabel || 'Escolha um plano' }}
        </button>
      </ng-container>
    </app-drawer>
  `,
})
export class PlanChangeDrawerComponent {
  private readonly db = inject(Database);
  private readonly service = inject(SubscriptionService);
  private readonly toasts = inject(ToastService);

  readonly subscriptionId = input.required<ID>();
  readonly open = model(false);
  readonly changed = output<ChangeResult>();

  protected readonly group = uniqueId('app-plan-choice');
  protected readonly selected = signal<PlanId | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected readonly sub = computed(() => this.db.subscriptions.get(this.subscriptionId()));
  protected readonly heading = computed(() => (this.sub()?.planId === 'livre' ? 'Assinar um plano' : 'Trocar plano'));
  protected readonly subtitle = computed(() => {
    const sub = this.sub();
    return sub ? `Plano atual: ${PLAN_SHORT_NAMES[sub.planId]}` : '';
  });

  protected readonly payerBlock = computed<string | null>(() => {
    const sub = this.sub();
    if (!sub || sub.payer !== 'corporate') {
      return null;
    }
    const other = PLAN_ORDER.find((p) => p !== sub.planId) ?? 'livre';
    return this.service.quote(sub, other).blockedReason ?? null;
  });

  protected readonly options = computed<PlanOption[]>(() => {
    const sub = this.sub();
    if (!sub) {
      return [];
    }
    const currentBenefits = new Set(planBenefits(sub.planId));
    return PLAN_ORDER.map((id) => {
      const benefits = new Set(planBenefits(id));
      return {
        id,
        name: PLAN_SHORT_NAMES[id],
        price: formatMoney(this.db.plans.get(id)?.monthlyPriceCents ?? 0),
        current: id === sub.planId,
        enters: [...benefits].filter((b) => !currentBenefits.has(b)).map((b) => BENEFIT_LABELS[b]),
        leaves: [...currentBenefits].filter((b) => !benefits.has(b)).map((b) => BENEFIT_LABELS[b]),
      };
    });
  });

  protected readonly quote = computed<ChangeQuote | null>(() => {
    const sub = this.sub();
    const to = this.selected();
    return sub && to ? this.service.quote(sub, to) : null;
  });

  protected choose(plan: PlanId): void {
    this.error.set(null);
    this.selected.set(plan);
  }

  protected reset(): void {
    this.selected.set(null);
    this.error.set(null);
  }

  protected confirm(): void {
    const to = this.selected();
    if (!to || this.busy()) {
      return;
    }
    this.busy.set(true);
    try {
      const result = this.service.changePlan(this.subscriptionId(), to);
      this.toasts.success(result.message);
      this.changed.emit(result);
      this.reset();
      this.open.set(false);
    } catch (error) {
      this.error.set(
        error instanceof SubscriptionError
          ? error.message
          : 'Não foi possível salvar. Tente de novo; se continuar, avise a equipe.',
      );
    } finally {
      this.busy.set(false);
    }
  }
}
