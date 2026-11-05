import { ChangeDetectionStrategy, Component, booleanAttribute, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/auth';
import { Clock } from '@core/clock';
import {
  PLAN_SHORT_NAMES,
  SUBSCRIPTION_DISPLAY_LABELS,
  SubscriptionError,
  SubscriptionService,
  scheduledChangeOf,
  subscriptionDisplay,
} from '@core/commerce/subscription.service';
import { Database } from '@core/data';
import { formatDate, formatMoney } from '@core/format';
import type { ID, PlanChange } from '@core/models';
import { BadgeComponent, PlanBadgeComponent } from '../display/badge.component';
import { CardComponent } from '../display/card.component';
import { TimelineComponent, TimelineItem } from '../display/timeline.component';
import { ToastService } from '../overlay/toast.service';
import { PlanChangeDrawerComponent } from './plan-change-drawer.component';

function changeTitle(change: PlanChange, future: boolean): string {
  const from = PLAN_SHORT_NAMES[change.from];
  const to = PLAN_SHORT_NAMES[change.to];
  switch (change.kind) {
    case 'upgrade':
      return `Upgrade: ${from} para ${to}`;
    case 'downgrade':
      return future ? `Mudança agendada: ${from} para ${to}` : `Mudança de plano: ${from} para ${to}`;
    case 'cancel':
      return future ? 'Cancelamento agendado' : 'Cancelamento: o plano voltou ao Livre';
    default:
      return 'Plano mantido';
  }
}

/**
 * Plano e cartão de UM cuidador (F03): plano atual, cobrança simulada, mudança agendada com "Manter o
 * plano atual", Cartão Nexus e histórico de trocas. Serve à aba Plano e cartão (SCR-M03-03) e à tela da
 * assinatura (SCR-M04-03). Quem pode editar (atendimento e gestão) troca o plano por uma gaveta que diz o
 * efeito antes de confirmar; o psicólogo e o responsável técnico só leem.
 */
@Component({
  selector: 'app-subscription-panel',
  imports: [BadgeComponent, CardComponent, PlanBadgeComponent, PlanChangeDrawerComponent, RouterLink, TimelineComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack stack--6">
      @if (sub(); as subscription) {
        @if (scheduled(); as change) {
          <div class="banner banner--attention" role="status" data-role="scheduled">
            <div class="banner__body">
              <span class="banner__title">{{ change.label }}</span>
              <span class="banner__text">Até lá, o plano atual continua valendo, inclusive os benefícios.</span>
              @if (canEdit()) {
                <span class="banner__actions"><button type="button" class="btn btn--sm" (click)="keep()">Manter o plano atual</button></span>
              }
            </div>
          </div>
        }
        <div class="grid grid--2 grid--gap-6">
          <app-card title="Plano atual">
            <div class="stack stack--3">
              <div class="cluster">
                <app-plan-badge [plan]="subscription.planId" large />
                <strong class="t-num">{{ price() }}</strong>
                <span class="t-caption">por mês</span>
              </div>
              <dl class="dl">
                <dt>Situação</dt>
                <dd><app-badge [variant]="display() === 'active' ? 'success' : display() === 'cancelled' ? 'neutral' : 'attention'" dot>{{ displayLabel() }}</app-badge></dd>
                <dt>Quem paga</dt>
                <dd>{{ company() ? 'Empresa: ' + company() : 'O próprio cuidador' }}</dd>
                <dt>Desde</dt>
                <dd>{{ date(subscription.startedAt) }}</dd>
                @if (subscription.nextCycleAt) {
                  <dt>Próximo ciclo</dt>
                  <dd>{{ date(subscription.nextCycleAt) }} <span class="t-caption">(cobrança simulada)</span></dd>
                }
              </dl>
              <div class="cluster">
                @if (canEdit()) {
                  <button type="button" class="btn btn--primary" (click)="drawerOpen.set(true)">
                    {{ subscription.planId === 'livre' ? 'Assinar um plano' : 'Trocar plano' }}
                  </button>
                }
                @if (canOpenSubscription()) {
                  <a class="btn" [routerLink]="['/app/assinaturas', subscription.id]">Ver a assinatura</a>
                }
              </div>
            </div>
          </app-card>
          <app-card title="Cartão Nexus">
            @if (card(); as c) {
              <dl class="dl">
                <dt>Número</dt>
                <dd class="t-num">{{ c.number }}</dd>
                <dt>Situação</dt>
                <dd><app-badge [variant]="c.status === 'active' ? 'success' : 'neutral'" [icon]="c.status === 'active' ? 'circle-check' : 'ban'">{{ c.status === 'active' ? 'Ativo' : 'Inativo' }}</app-badge></dd>
                <dt>Emitido em</dt>
                <dd>{{ date(c.issuedAt) }}</dd>
                <dt>Usos</dt>
                <dd>{{ usages().count }} {{ usages().count === 1 ? 'uso' : 'usos' }}, economia de {{ money(usages().saved) }}</dd>
              </dl>
            } @else {
              <p class="t-muted">Cartão Nexus a partir do Essencial. Os descontos do cartão são exclusivos de plano pago.</p>
            }
          </app-card>
        </div>
        @if (subscription.status === 'cancelled' && canEdit()) {
          <div class="banner banner--attention" role="status">
            <div class="banner__body">
              <span class="banner__title">Assinatura cancelada</span>
              <span class="banner__text">Reativar cria uma assinatura nova no plano Livre.</span>
              <span class="banner__actions"><button type="button" class="btn btn--sm" (click)="reactivate()">Reativar assinatura</button></span>
            </div>
          </div>
        }
        <app-card title="Histórico de trocas" subtitle="O registro não se edita">
          @if (history().length === 0) {
            <p class="t-muted">Este cuidador nunca trocou de plano.</p>
          } @else {
            <app-timeline label="Histórico de trocas de plano" [items]="history()" />
          }
        </app-card>
        <app-plan-change-drawer [subscriptionId]="subscription.id" [(open)]="drawerOpen" />
      } @else {
        <p class="t-muted">Este cuidador ainda não tem assinatura registrada.</p>
      }
    </div>
  `,
})
export class SubscriptionPanelComponent {
  private readonly auth = inject(AuthService);
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly service = inject(SubscriptionService);
  private readonly toasts = inject(ToastService);

  readonly caregiverId = input.required<ID>();
  /** Mostra o link para a tela da assinatura (usado dentro da ficha do cuidador). */
  readonly linkToDetail = input(false, { transform: booleanAttribute });
  protected readonly drawerOpen = signal(false);

  protected readonly canEdit = computed(() => this.auth.can('plans_subscriptions', 'update'));
  protected readonly canOpenSubscription = computed(() => this.linkToDetail() && this.auth.role() !== 'psychologist');

  protected readonly sub = computed(() => {
    this.db.subscriptions.all();
    return this.service.current(this.caregiverId());
  });
  protected readonly scheduled = computed(() => {
    const s = this.sub();
    return s ? scheduledChangeOf(s) : null;
  });
  protected readonly display = computed(() => {
    const s = this.sub();
    return s ? subscriptionDisplay(s) : 'active';
  });
  protected readonly displayLabel = computed(() => SUBSCRIPTION_DISPLAY_LABELS[this.display()]);
  protected readonly price = computed(() => formatMoney(this.db.plans.get(this.sub()?.planId ?? 'livre')?.monthlyPriceCents ?? 0));
  protected readonly company = computed(() => {
    const s = this.sub();
    return s ? this.service.payerCompany(s) : null;
  });
  protected readonly card = computed(() => {
    this.db.benefitCards.all();
    return this.service.cardOf(this.caregiverId());
  });
  protected readonly usages = computed(() => {
    this.db.cardUsages.all();
    const c = this.card();
    const list = c ? this.service.usagesOf(c.id) : [];
    return { count: list.length, saved: list.reduce((sum, u) => sum + u.discountCents, 0) };
  });
  protected readonly history = computed<TimelineItem[]>(() => {
    this.db.planChanges.all();
    const s = this.sub();
    if (!s) {
      return [];
    }
    const today = this.clock.today();
    return this.service.historyOf(s.id).map((c) => {
      const future = c.effectiveAt > today;
      return {
        id: c.id,
        title: changeTitle(c, future),
        timeLabel: formatDate(c.effectiveAt),
        tone: future ? 'attention' : c.kind === 'cancel' ? 'danger' : c.kind === 'upgrade' ? 'done' : 'default',
        text: `Registrado por ${this.db.users.get(c.byUserId)?.displayName ?? 'usuário'}.`,
      };
    });
  });

  protected date(value: string): string {
    return formatDate(value);
  }

  protected money(cents: number): string {
    return formatMoney(cents);
  }

  protected reactivate(): void {
    const s = this.sub();
    if (!s) {
      return;
    }
    try {
      this.service.reactivate(s.id);
      this.toasts.success('Assinatura reativada no plano Livre.');
    } catch (error) {
      this.toasts.error(error instanceof SubscriptionError ? error.message : 'Não foi possível salvar.');
    }
  }

  protected keep(): void {
    const s = this.sub();
    if (!s) {
      return;
    }
    try {
      this.service.keepPlan(s.id);
      this.toasts.success('Plano mantido.');
    } catch (error) {
      this.toasts.error(error instanceof SubscriptionError ? error.message : 'Não foi possível salvar.');
    }
  }
}
