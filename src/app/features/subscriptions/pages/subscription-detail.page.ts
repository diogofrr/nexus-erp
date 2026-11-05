import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '@core/auth';
import { PLAN_SHORT_NAMES, SubscriptionService } from '@core/commerce/subscription.service';
import { Database } from '@core/data';
import { caregiverLabel } from '@core/privacy/caregiver-label';
import { EmptyStateComponent, PageHeaderComponent } from '@shared/ui';
import { PageContextService } from '@shared/ui/overlay';
import { SubscriptionPanelComponent } from '@shared/ui/plan/subscription-panel.component';

/**
 * SCR-M04-03 Detalhe da assinatura: histórico de trocas, cartão e as ações de upgrade, descida (no fim
 * do ciclo), cancelamento, "Manter o plano atual" e reativação. A gestão vê o cuidador só pelo código.
 */
@Component({
  selector: 'app-subscription-detail-page',
  imports: [EmptyStateComponent, PageHeaderComponent, RouterLink, SubscriptionPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      @if (subscription(); as sub) {
        <app-page-header [title]="label()" [description]="'Assinatura ' + planName()">
          <a class="btn" [routerLink]="['/app/cuidadores', sub.caregiverId]">Abrir o cuidador</a>
        </app-page-header>
        <app-subscription-panel [caregiverId]="sub.caregiverId" />
      } @else {
        <app-empty-state kind="error" title="Assinatura não encontrada" text="Confira o endereço ou volte à lista de assinaturas.">
          <a class="btn" routerLink="/app/assinaturas">Voltar para Assinaturas</a>
        </app-empty-state>
      }
    </div>
  `,
})
export class SubscriptionDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly db = inject(Database);
  private readonly auth = inject(AuthService);
  private readonly service = inject(SubscriptionService);
  private readonly page = inject(PageContextService);
  private readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), { initialValue: '' });

  protected readonly subscription = computed(() => {
    this.db.subscriptions.all();
    return this.db.subscriptions.get(this.id());
  });
  protected readonly label = computed(() => {
    const sub = this.subscription();
    const cg = sub ? this.db.caregivers.get(sub.caregiverId) : undefined;
    return cg ? caregiverLabel(this.auth.role(), cg).text : '';
  });
  protected readonly planName = computed(() => PLAN_SHORT_NAMES[this.subscription()?.planId ?? 'livre']);

  constructor() {
    this.service.applyDueChanges();
    effect(() => {
      const sub = this.subscription();
      if (!sub) {
        return;
      }
      untracked(() =>
        this.page.setCrumbs([
          { label: 'Assinaturas', link: '/app/assinaturas' },
          { label: this.db.caregivers.get(sub.caregiverId)?.code ?? 'Assinatura' },
        ]),
      );
    });
  }
}
