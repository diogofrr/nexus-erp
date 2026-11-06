import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Clock } from '../../../../core/clock/clock.service';
import { SubscriptionService } from '../../../../core/commerce/subscription.service';
import { Database } from '../../../../core/data/database';
import { formatMoney, formatNumber } from '../../../../core/format/format';
import { PartnerCategory } from '../../../../core/models';
import { cardSavings, partnersForCard } from '../../../../core/rules/benefit-card';
import { EmptyStateComponent } from '../../../../shared/ui/display/empty-state.component';
import { IconComponent, IconName } from '../../../../shared/ui/display/icon.component';
import { ToastService } from '../../../../shared/ui/overlay/toast.service';
import { copyOrSelect } from '../../../../shared/ui/util/clipboard';
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

/** O ícone de cada tipo de parceiro (o texto da categoria vem escrito ao lado). */
const PARTNER_ICON: Readonly<Record<PartnerCategory, IconName>> = {
  pharmacy: 'pill',
  clinic: 'stethoscope',
  market: 'store',
  optical: 'eye',
  laboratory: 'activity',
  gym: 'heart-pulse',
  other: 'handshake',
};

interface PartnerRow {
  id: string;
  name: string;
  category: string;
  icon: IconName;
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
 * Cartão Nexus (UX C16, `/cuidador/rede/cartao`). Para quem tem plano pago: um cartão que PARECE cartão (proporção de cartão, a
 * cor do plano, o símbolo da marca, o chip e o número `NX-0000-0000`), "Mostre o número no balcão do parceiro.", **Copiar
 * número**, onde usar (só parceiros ATIVOS, cada um com o seu percentual) e o que já economizou (o total do mês em destaque e as
 * 3 últimas compras; o resto em "Ver todas"). Vale enquanto o plano pago estiver ativo (S-22); com cancelamento agendado diz até
 * quando. No plano Livre (ou cartão inativo) é um convite calmo: o desenho de um cartão, sem número, sem percentual, sem nome de
 * parceiro e sem preço (RN-CRT-02, RN-PLN-08). Nada aqui depende de pontuação, alerta ou ARBE (RN-PLN-19).
 *
 * Cores: as mesmas do plano (`--tone` e `--tone-on`, pares em `scripts/check-caregiver-a11y.mjs`); o texto do cartão passa 4,5:1.
 */
@Component({
  selector: 'app-cg-card-page',
  imports: [RouterLink, IconComponent, EmptyStateComponent, CgPageHeaderComponent, CgNoteComponent, CgPlanTagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `

      .nx-wallet { display: grid; gap: 1.5rem; align-items: center; }
      @media (min-width: 48rem) { .nx-wallet { grid-template-columns: minmax(0, 26rem) minmax(0, 1fr); gap: 2.5rem; } }
      .nx-card {
        position: relative; isolation: isolate; overflow: hidden;
        display: grid; grid-template-rows: auto 1fr auto; gap: 0.75rem;
        inline-size: 100%; max-inline-size: 26rem; aspect-ratio: 1.586 / 1; padding: 1.25rem;
        border-radius: 1.25rem; background-color: var(--tone); background-image: linear-gradient(150deg, var(--tone) 30%, var(--tone-2));
        color: var(--tone-on);
        box-shadow: var(--shadow-3), inset 0 0 0 1px color-mix(in srgb, var(--tone-on) 16%, transparent);
        animation: nx-card-in var(--dur-3) var(--ease) both;
      }
      @keyframes nx-card-in { from { opacity: 0; transform: translateY(0.5rem) scale(0.98); } to { opacity: 1; transform: none; } }
      .nx-card__mark { position: absolute; z-index: -1; inset-inline-end: -1.5rem; inset-block-end: -1rem; inline-size: 12rem; block-size: 8rem; color: currentColor; opacity: 0.2; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
      .nx-card__top { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
      .nx-card__brand { display: inline-flex; align-items: center; gap: 0.5rem; font-weight: var(--fw-semibold); letter-spacing: 0.24em; font-size: var(--cg-fs-small); }
      .nx-card__brand svg { inline-size: 2.25rem; block-size: 1.5rem; }
      .nx-card__gold { align-self: center; justify-self: start; inline-size: 2.75rem; block-size: 2.1rem; border-radius: 0.5rem; background: linear-gradient(135deg, #f3dc8f 0%, #d6ac3a 55%, #b8901f 100%); box-shadow: inset 0 0 0 1px rgb(74 56 10 / 0.35); }
      .nx-card__bottom { display: grid; gap: 0.25rem; }
      .nx-card__number { margin: 0; font-size: calc(1.625rem * min(var(--cg-zoom), 1.15)); font-weight: var(--fw-semibold); letter-spacing: 0.08em; font-variant-numeric: tabular-nums; user-select: all; overflow-wrap: anywhere; }
      .nx-card__name { margin: 0; font-size: var(--cg-fs-small); font-weight: var(--fw-semibold); letter-spacing: 0.1em; text-transform: uppercase; overflow-wrap: anywhere; }
      .nx-wallet__info { display: grid; gap: 0.75rem; justify-items: stretch; }
      @media (min-width: 48rem) { .nx-wallet__info { justify-items: start; } }
      .nx-card__hint { margin: 0; font-size: var(--cg-fs-lead); color: var(--cg-heading); }
      .nx-card__validity { margin: 0; color: var(--cg-text-soft); }

      .nx-ghost { display: grid; align-content: space-between; inline-size: 100%; max-inline-size: 26rem; aspect-ratio: 1.586 / 1; padding: 1.25rem; border: 2px dashed var(--cg-acc-solid); border-radius: 1.25rem; background: var(--cg-acc-tint); color: var(--cg-acc-ink); }
      .nx-ghost__brand { display: inline-flex; align-items: center; gap: 0.5rem; font-weight: var(--fw-semibold); letter-spacing: 0.24em; font-size: var(--cg-fs-small); }
      .nx-ghost__brand svg { inline-size: 2.25rem; block-size: 1.5rem; }
      .nx-ghost__lines { display: grid; gap: 0.5rem; }
      .nx-ghost__lines span { display: block; inline-size: 70%; block-size: 0.75rem; border-radius: 0.375rem; background: var(--cg-acc-strong); }
      .nx-ghost__lines span:last-child { inline-size: 40%; }
      .nx-invite__lead { margin: 0; font-size: var(--cg-fs-lead); color: var(--cg-heading); }

      .nx-saved { display: grid; gap: 0.25rem; margin-bottom: 1rem; padding: 1rem 1.25rem; border: 1px solid var(--cg-acc-strong); border-radius: var(--cg-radius-card); background: var(--cg-acc-tint); }
      .nx-saved__amount { margin: 0; display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.25rem 0.75rem; }
      .nx-saved__num { font-family: var(--font-serif); font-size: calc(2.25rem * min(var(--cg-zoom), 1.15)); line-height: 1.1; color: var(--cg-acc-ink); font-variant-numeric: tabular-nums; }
      .nx-saved__total { margin: 0; color: var(--cg-text-soft); }
      .nx-more { margin: 0; padding: 0 1rem 1rem 4.5rem; color: var(--cg-text-soft); }
      .nx-line { margin: 0 0 0.75rem; }

      @media (prefers-reduced-motion: reduce) {
        .nx-card { animation: none; }
      }
    `,
  ],
  template: `
    <app-cg-page-header title="Cartão Nexus" backLink="/cuidador/rede" backLabel="Rede" />

    @if (card(); as c) {
      <div class="cg-stack">
        <div class="nx-wallet">
          <section [class]="'nx-card cg-tone--' + ctx.planId()" aria-label="Seu Cartão Nexus">
            <svg class="nx-card__mark" viewBox="-18 3 156 98" aria-hidden="true"><use href="icons/sprite.svg#nx-symbol" /></svg>
            <div class="nx-card__top">
              <span class="nx-card__brand">
                <svg class="brand-symbol" viewBox="-18 3 156 98" aria-hidden="true"><use href="icons/sprite.svg#nx-symbol" /></svg>
                NEXUS
              </span>
              <app-cg-plan-tag [plan]="ctx.planId()" />
            </div>
            <span class="nx-card__gold" aria-hidden="true"></span>
            <div class="nx-card__bottom">
              <p class="nx-card__number" data-role="card-number" #numberEl>{{ c.number }}</p>
              <p class="nx-card__name">{{ ctx.caregiver()?.fullName }}</p>
            </div>
          </section>

          <div class="nx-wallet__info">
            <p class="nx-card__hint">Mostre o número no balcão do parceiro.</p>
            <p class="nx-card__validity" data-role="validity">{{ validity() }}</p>
            <button type="button" class="btn btn--primary" data-role="copy" (click)="copy(c.number)">
              <svg appIcon="copy" size="sm"></svg>Copiar número
            </button>
            @if (copyFailed()) {
              <app-cg-note variant="soft" icon="info">{{ fallback }}</app-cg-note>
            }
          </div>
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
                    <span class="cg-row__icon"><svg [appIcon]="p.icon" size="lg"></svg></span>
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
            <div class="nx-saved">
              @let s = saved();
              <p class="nx-saved__amount" [attr.data-role]="s.headline.role">
                <span class="nx-saved__num">{{ s.headline.amount }}</span>&ngsp;
                <span>{{ s.headline.caption }}</span>
              </p>
              @if (s.note; as note) {
                <p class="nx-saved__total" [attr.data-role]="note.role">{{ note.text }}</p>
              }
            </div>
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
      <!-- Convite calmo: o desenho de um cartão (sem número) e uma frase. Sem preço, sem percentual, sem nome de parceiro. -->
      <div class="nx-wallet" data-role="invite">
        <div class="nx-ghost" aria-hidden="true">
          <span class="nx-ghost__brand">
            <svg class="brand-symbol" viewBox="-18 3 156 98" aria-hidden="true"><use href="icons/sprite.svg#nx-symbol" /></svg>
            NEXUS
          </span>
          <span class="nx-ghost__lines"><span></span><span></span></span>
        </div>
        <div class="nx-wallet__info">
          <p class="nx-invite__lead">
            O Cartão Nexus dá descontos em farmácias, clínicas e outros parceiros. Ele vem com os planos pagos.
          </p>
          <a class="btn" routerLink="/cuidador/mais/plano">Ver os planos</a>
        </div>
      </div>
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
      icon: PARTNER_ICON[p.category],
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

  /**
   * O número em destaque é o do mês ("R$ 76,83 economizados neste mês, em 4 compras"); sem compras no mês, o destaque é o
   * total, e a linha de apoio diz que o mês ainda não teve compras. Com compras no mês, a linha de apoio traz o total, se ele
   * for além do mês.
   */
  protected readonly saved = computed(() => {
    const s = this.savings();
    const times = (n: number): string => `${n} ${n === 1 ? 'compra' : 'compras'}`;
    if (s.monthCount === 0) {
      return {
        headline: { role: 'grand-total', amount: formatMoney(s.totalCents), caption: `economizados ao todo, em ${times(s.totalCount)}` },
        note: { role: 'month-total', text: 'Neste mês: ainda sem compras com o cartão.' },
      };
    }
    return {
      headline: { role: 'month-total', amount: formatMoney(s.monthCents), caption: `economizados neste mês, em ${times(s.monthCount)}` },
      note: s.totalCount > s.monthCount ? { role: 'grand-total', text: `Ao todo: ${formatMoney(s.totalCents)} em ${s.totalCount} compras.` } : null,
    };
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
