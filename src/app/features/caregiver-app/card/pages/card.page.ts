import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { Clock } from '../../../../core/clock/clock.service';
import { SubscriptionService } from '../../../../core/commerce/subscription.service';
import { Database } from '../../../../core/data/database';
import { formatMoney, formatNumber } from '../../../../core/format/format';
import { PartnerCategory } from '../../../../core/models';
import { cardSavings, partnersForCard } from '../../../../core/rules/benefit-card';
import { copyOrSelect } from '../../../../shared/ui/util/clipboard';
import { ToastService } from '../../../../shared/ui/overlay/toast.service';
import { IconComponent } from '../../../../shared/ui/display/icon.component';
import { EmptyStateComponent } from '../../../../shared/ui/display/empty-state.component';
import { RouterLink } from '@angular/router';
import { CaregiverContextService } from '../../state/caregiver-context.service';
import { COPY_NUMBER_FAILED, NUMBER_COPIED } from '../../state/copy-feedback';
import { dayMonth, formatDayShort } from '../../state/day-format';
import { CgNoteComponent } from '../../ui/cg-note.component';
import { CgPageHeaderComponent } from '../../ui/cg-page-header.component';
import { CgPlanTagComponent } from '../../ui/cg-plan-tag.component';

const PARTNER_CATEGORY: Readonly<Record<PartnerCategory, string>> = {
  pharmacy: 'Farmácia',
  clinic: 'Clínica',
  market: 'Mercado',
  optical: 'Ótica',
  laboratory: 'Laboratório',
  gym: 'Academia',
  other: 'Outros parceiros',
};

/** Frase do plano B quando o navegador não deixa copiar: o número fica selecionável (`user-select: all`). */

interface PartnerRow {
  id: string;
  name: string;
  category: string;
  percent: string;
  city: string;
}

interface UsageRow {
  id: string;
  partner: string;
  when: string;
  discount: string;
}

/**
 * Cartão Nexus (UX C16, `/cuidador/rede/cartao`). Para quem tem plano pago: o cartão com o número `NX-0000-0000`, "Mostre o
 * número no balcão do parceiro.", **Copiar número**, onde usar (só parceiros ATIVOS, cada um com o seu percentual) e o que
 * já economizou (total do mês e lista de usos). Vale enquanto o plano pago estiver ativo (S-22); com cancelamento
 * agendado diz até quando. No plano Livre (ou cartão inativo) é um convite calmo: sem percentual, sem nome de parceiro, sem
 * preço e sem número (RN-CRT-02, RN-PLN-08). Nada aqui depende de pontuação, alerta ou ARBE (RN-PLN-19).
 */
@Component({
  selector: 'app-cg-card-page',
  imports: [RouterLink, IconComponent, EmptyStateComponent, CgPageHeaderComponent, CgNoteComponent, CgPlanTagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .nx-card { display: grid; gap: 1rem; padding: var(--cg-pad-card); border-radius: var(--cg-radius-card); background: var(--cg-emergency-bg); color: #fff; }
      .nx-card__top { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
      .nx-card__brand { display: inline-flex; align-items: center; gap: 0.5rem; font-weight: var(--fw-semibold); letter-spacing: 0.08em; }
      .nx-card__brand svg { width: 2rem; height: 2rem; }
      .nx-card__name { margin: 0; font-family: var(--font-serif); font-size: var(--cg-fs-h2); overflow-wrap: anywhere; }
      .nx-card__number { margin: 0; font-size: 1.75rem; font-weight: var(--fw-semibold); letter-spacing: 0.04em; font-variant-numeric: tabular-nums; user-select: all; overflow-wrap: anywhere; }
      .nx-card__hint { margin: 0; color: var(--cg-text); }
      .nx-card__status { margin: 0; min-height: 1.5rem; font-weight: var(--fw-semibold); &:empty { display: none; } }
      .nx-more { margin: 0; padding: 0 1rem 1rem 4.5rem; color: var(--cg-text-soft); }
      .nx-line { margin: 0 0 0.75rem; }
    `,
  ],
  template: `
    <app-cg-page-header title="Cartão Nexus" backLink="/cuidador/rede" backLabel="Rede" />

    @if (card(); as c) {
      <div class="cg-stack">
        <section class="nx-card" aria-label="Seu Cartão Nexus">
          <div class="nx-card__top">
            <span class="nx-card__brand">
              <svg class="brand-symbol" aria-hidden="true"><use href="icons/sprite.svg#nx-symbol" /></svg>
              NEXUS
            </span>
            <app-cg-plan-tag [plan]="ctx.planId()" />
          </div>
          <p class="nx-card__name">{{ ctx.caregiver()?.fullName }}</p>
          <p class="nx-card__number" data-role="card-number" #numberEl>{{ c.number }}</p>
        </section>

        <div class="cg-stack cg-stack--tight">
          <p class="nx-card__hint">Mostre o número no balcão do parceiro.</p>
          <p class="nx-card__hint" data-role="validity">{{ validity() }}</p>
          <div class="cg-actions">
            <button type="button" class="btn btn--primary" (click)="copy(c.number)">
              <svg appIcon="copy" size="sm"></svg>Copiar número
            </button>
          </div>
          @if (copyFailed()) {
            <app-cg-note variant="soft" icon="info">{{ fallback }}</app-cg-note>
          }
        </div>

        <section class="cg-section" aria-labelledby="card-where">
          <h2 class="cg-section__title" id="card-where">Onde usar</h2>
          @if (partners().length === 0) {
            <app-empty-state compact title="Ainda não há parceiros por aqui" text="Quando houver, eles aparecem nesta lista." />
          } @else {
            <ul class="cg-list">
              @for (p of partners(); track p.id) {
                <li>
                  <button type="button" class="cg-row" [attr.aria-expanded]="openPartner() === p.id" (click)="togglePartner(p.id)">
                    <span class="cg-row__icon"><svg appIcon="store" size="lg"></svg></span>
                    <span class="cg-row__text">
                      <span class="cg-row__title">{{ p.name }}</span>
                      <span class="cg-row__desc">{{ p.category }} · {{ p.percent }} de desconto</span>
                    </span>
                    <span class="cg-row__end"><svg [appIcon]="openPartner() === p.id ? 'chevron-down' : 'chevron-right'"></svg></span>
                  </button>
                  @if (openPartner() === p.id) {
                    <p class="nx-more">{{ p.city }}. Mostre o número do cartão no balcão.</p>
                  }
                </li>
              }
            </ul>
          }
        </section>

        <section class="cg-section" aria-labelledby="card-saved">
          <h2 class="cg-section__title" id="card-saved">O que você já economizou</h2>
          @if (usages().length === 0) {
            <p class="nx-line">Você ainda não usou o cartão.</p>
          } @else {
            <p class="nx-line" data-role="month-total">{{ monthLine() }}</p>
            @if (totalLine(); as total) {
              <p class="nx-line" data-role="grand-total">{{ total }}</p>
            }
            <ul class="cg-list" aria-label="Usos do cartão">
              @for (u of shownUsages(); track u.id) {
                <li>
                  <div class="cg-row" data-role="usage">
                    <span class="cg-row__icon"><svg appIcon="credit-card" size="lg"></svg></span>
                    <span class="cg-row__text">
                      <span class="cg-row__title">{{ u.partner }}</span>
                      <span class="cg-row__desc">{{ u.when }} · desconto de {{ u.discount }}</span>
                    </span>
                  </div>
                </li>
              }
            </ul>
            @if (usages().length > recentUsages) {
              <div>
                <button type="button" class="cg-link-btn" data-role="all-usages" [attr.aria-expanded]="showAllUsages()" (click)="showAllUsages.set(!showAllUsages())">
                  {{ showAllUsages() ? 'Ver menos' : 'Ver todas (' + usages().length + ')' }}
                </button>
              </div>
            }
          }
        </section>
      </div>
    } @else if (ctx.canUse('card')) {
      <app-cg-note variant="soft" icon="info">
        Não encontramos um cartão ativo para você. A equipe pode ajudar.
      </app-cg-note>
    } @else {
      <app-cg-note variant="soft" icon="credit-card">
        O Cartão Nexus dá descontos em farmácias, clínicas e outros parceiros. Ele vem com os planos pagos.
        <a cgNoteActions class="cg-link-btn" routerLink="/cuidador/mais/plano">Ver os planos</a>
      </app-cg-note>
    }
  `,
})
export class CardPage {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly subscriptions = inject(SubscriptionService);
  private readonly toast = inject(ToastService);
  private readonly doc = inject(DOCUMENT);
  protected readonly ctx = inject(CaregiverContextService);

  protected readonly fallback = COPY_NUMBER_FAILED;
  protected readonly copyFailed = signal(false);
  private readonly numberEl = viewChild<ElementRef<HTMLElement>>('numberEl');
  protected readonly openPartner = signal<string | null>(null);

  /** O cartão ativo, só para quem tem plano pago e a assinatura vigente (RN-CRT-02 e 03). */
  protected readonly card = computed(() => {
    const id = this.ctx.caregiverId();
    if (!id || !this.ctx.canUse('card')) {
      return null;
    }
    const card = this.subscriptions.cardOf(id);
    return card?.status === 'active' ? card : null;
  });

  /** Cancelamento agendado para o Livre: o cartão vale até a data (S-22). */
  protected readonly validity = computed(() => {
    const change = this.ctx.scheduledChange();
    if (change && change.to === 'livre') {
      return `Seu cartão vale até ${dayMonth(change.at)}, quando o plano muda para o Livre.`;
    }
    return 'Vale enquanto o seu plano estiver ativo.';
  });

  protected readonly partners = computed<PartnerRow[]>(() =>
    partnersForCard(this.db.partners.list()).map((p) => ({
      id: p.id,
      name: p.name,
      category: PARTNER_CATEGORY[p.category],
      percent: `${formatNumber(p.discountPercent, Number.isInteger(p.discountPercent) ? 0 : 1)}%`,
      city: p.city,
    })),
  );

  private readonly rawUsages = computed(() => {
    const card = this.card();
    return card ? this.subscriptions.usagesOf(card.id) : [];
  });

  protected readonly usages = computed<UsageRow[]>(() =>
    this.rawUsages().map((u) => ({
      id: u.id,
      partner: this.db.partners.get(u.partnerId)?.name ?? 'Parceiro Nexus',
      when: formatDayShort(u.date, this.clock.today()),
      discount: formatMoney(u.discountCents),
    })),
  );

  /** As 3 últimas compras e o total ficam à vista; o resto atrás de "Ver todas" (CXC-026). */
  protected readonly recentUsages = 3;
  protected readonly showAllUsages = signal(false);
  protected readonly shownUsages = computed(() => (this.showAllUsages() ? this.usages() : this.usages().slice(0, this.recentUsages)));

  private readonly savings = computed(() => cardSavings(this.rawUsages(), this.clock.today()));

  protected readonly monthLine = computed(() => {
    const s = this.savings();
    return s.monthCount === 0
      ? 'Neste mês: ainda sem compras com o cartão.'
      : `Neste mês: ${formatMoney(s.monthCents)} em ${s.monthCount} ${s.monthCount === 1 ? 'compra' : 'compras'}.`;
  });

  /** O total só aparece quando traz algo além do mês. */
  protected readonly totalLine = computed(() => {
    const s = this.savings();
    return s.totalCount > s.monthCount
      ? `Ao todo: ${formatMoney(s.totalCents)} em ${s.totalCount} compras.`
      : null;
  });

  constructor() {
    // Uma mudança de plano que já venceu vale ao abrir: o cartão some no dia em que a assinatura deixa de valer (AC-CG-143).
    this.subscriptions.applyDueChanges();
  }

  protected togglePartner(id: string): void {
    this.openPartner.update((current) => (current === id ? null : id));
  }

  protected async copy(number: string): Promise<void> {
    const ok = await copyOrSelect(number, this.numberEl()?.nativeElement, this.doc);
    this.copyFailed.set(!ok);
    if (ok) {
      this.toast.show({ message: NUMBER_COPIED, durationMs: 8000 });
    }
  }
}
