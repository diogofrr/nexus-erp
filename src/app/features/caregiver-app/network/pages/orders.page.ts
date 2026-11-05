import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Clock } from '../../../../core/clock/clock.service';
import { dateOf } from '../../../../core/clock/date-utils';
import { ID } from '../../../../core/models';
import { CaregiverNetworkService, OrderView } from '../../../../core/network/caregiver-network.service';
import { BadgeComponent } from '../../../../shared/ui/display/badge.component';
import { EmptyStateComponent } from '../../../../shared/ui/display/empty-state.component';
import { IconComponent } from '../../../../shared/ui/display/icon.component';
import { FormFieldComponent } from '../../../../shared/ui/forms/form-field.component';
import { NxInputDirective } from '../../../../shared/ui/forms/input.directive';
import { ToastService } from '../../../../shared/ui/overlay/toast.service';
import { PageChromeService } from '../../../../layout/state/page-chrome.service';
import { CaregiverContextService } from '../../state/caregiver-context.service';
import { dayMonth, formatDayShort, relativeDateTime } from '../../state/day-format';
import { CgNoteComponent, CgNoteVariant } from '../../ui/cg-note.component';
import { CgPageHeaderComponent } from '../../ui/cg-page-header.component';
import { CgRatingPairComponent, ratingPairMissingText } from '../../ui/cg-rating-pair.component';
import { CgRatingValue } from '../../ui/cg-rating.component';
import { CgSheetComponent } from '../../ui/cg-sheet.component';
import {
  OrderGroup,
  StatusView,
  categoryLabel,
  modalityLabel,
  orderGroupOf,
  requestStatusView,
} from '../state/network-copy';

type SheetMode = 'details' | 'cancel' | 'evaluate' | 'correct';

interface OrderRow {
  id: ID;
  providerName: string;
  need: string;
  meta: string;
  status: StatusView;
  group: OrderGroup;
}

interface Banner {
  variant: CgNoteVariant;
  text: string;
}

/**
 * Meus pedidos (UX C15, `/cuidador/rede/pedidos`). Três grupos: **Precisa da sua avaliação**, **Em andamento** e **Anteriores**
 * (recolhido), cada pedido com a situação em texto e ícone, nunca só cor. Tocar no pedido abre a folha com o que foi pedido,
 * onde, a linha do tempo curta e as ações: **Cancelar pedido** (enviado ou aceito, com o efeito dito antes), **Avaliar** (duas
 * notas de 1 a 5 mais comentário, uma avaliação por serviço concluído) e **Corrigir minha avaliação** (até 7 dias, depois
 * "Prazo de correção encerrado."). `?avaliar=<id do pedido>` (de Hoje) abre a avaliação direto e `?pedido=<id>` abre o pedido.
 * Recusado: "O profissional não pôde atender." com "Ver outras opções de {necessidade}", sem culpa. A resposta do profissional é
 * registrada pela equipe. Nenhum dado interno do profissional aparece, nem avaliação ou comentário de outra pessoa.
 */
@Component({
  selector: 'app-cg-orders-page',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    BadgeComponent,
    EmptyStateComponent,
    IconComponent,
    FormFieldComponent,
    NxInputDirective,
    CgNoteComponent,
    CgPageHeaderComponent,
    CgRatingPairComponent,
    CgSheetComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .nx-order { display: grid; gap: 0.25rem; justify-items: start; }
      .nx-meta { margin: 0; color: var(--cg-text-soft); font-size: var(--cg-fs-small); }
      .nx-steps { margin: 0; padding-inline-start: 1.25rem; display: grid; gap: 0.25rem; }
      .nx-prev > summary { display: flex; align-items: center; gap: 0.5rem; min-height: var(--cg-target); padding: 0.5rem 0; font-family: var(--font-serif); font-size: var(--cg-fs-h2); color: var(--cg-heading); cursor: pointer; }
      .nx-prev[open] > summary { margin-bottom: 0.75rem; }
      .nx-sheet-block { display: grid; gap: 0.75rem; }
      .nx-sheet-block p { margin: 0; }
      .nx-missing { margin: 0; color: var(--cg-soft-fg); font-weight: var(--fw-semibold); }
    `,
  ],
  template: `
    <app-cg-page-header title="Meus pedidos" backLink="/cuidador/rede" backLabel="Rede" />
    <div class="cg-stack">
      @if (banner(); as b) {
        <app-cg-note [variant]="b.variant" data-role="result">{{ b.text }}</app-cg-note>
      }

      @if (rows().length === 0) {
        <app-empty-state title="Você ainda não fez pedidos" text="Quando você pedir um serviço a um profissional da rede, ele aparece aqui.">
          <a class="btn" routerLink="/cuidador/rede/buscar">Buscar profissionais</a>
        </app-empty-state>
      } @else {
        @if (toEvaluate().length > 0) {
          <section aria-labelledby="orders-evaluate" data-role="group-evaluate">
            <h2 class="cg-section__title" id="orders-evaluate">Precisa da sua avaliação</h2>
            <ul class="cg-list">
              @for (row of toEvaluate(); track row.id) {
                <li>
                  <ng-container [ngTemplateOutlet]="orderRow" [ngTemplateOutletContext]="{ row: row }" />
                </li>
              }
            </ul>
          </section>
        }

        @if (inProgress().length > 0) {
          <section aria-labelledby="orders-open" data-role="group-open">
            <h2 class="cg-section__title" id="orders-open">Em andamento</h2>
            <ul class="cg-list">
              @for (row of inProgress(); track row.id) {
                <li>
                  <ng-container [ngTemplateOutlet]="orderRow" [ngTemplateOutletContext]="{ row: row }" />
                </li>
              }
            </ul>
          </section>
        }

        @if (previous().length > 0) {
          <details class="nx-prev" data-role="group-previous">
            <summary>Anteriores ({{ previous().length }})</summary>
            <ul class="cg-list">
              @for (row of previous(); track row.id) {
                <li>
                  <ng-container [ngTemplateOutlet]="orderRow" [ngTemplateOutletContext]="{ row: row }" />
                </li>
              }
            </ul>
          </details>
        }
      }
    </div>

    <ng-template #orderRow let-row="row">
      <button type="button" class="cg-row" data-role="order" [attr.data-order]="row.id" (click)="openRow(row)">
        <span class="cg-row__icon"><svg appIcon="clipboard-list" size="lg"></svg></span>
        <span class="cg-row__text nx-order">
          <span class="cg-row__title">{{ row.providerName }}</span>
          <span class="cg-row__desc">{{ row.need }}</span>
          <span class="nx-meta">{{ row.meta }}</span>
          <app-badge [variant]="row.status.variant" [icon]="row.status.icon" data-role="status">{{ row.status.label }}</app-badge>
        </span>
        <span class="cg-row__end"><svg appIcon="chevron-right"></svg></span>
      </button>
    </ng-template>

    <app-cg-sheet [heading]="heading()" [open]="sheetOpen()" (openChange)="onSheetChange($event)">
      @if (selected(); as o) {
        @switch (mode()) {
          @case ('details') {
            <div class="nx-sheet-block" data-role="details">
              <p><strong>O que você pediu:</strong> {{ o.request.need }}</p>
              <p><strong>Onde:</strong> {{ modality(o) }}</p>
              <p><app-badge [variant]="statusOf(o).variant" [icon]="statusOf(o).icon">{{ statusOf(o).label }}</app-badge></p>
              <ul class="nx-steps" aria-label="Linha do tempo do pedido">
                @for (step of stepLines(); track step) {
                  <li>{{ step }}</li>
                }
              </ul>
              @if (o.request.status === 'refused_by_provider') {
                <p data-role="refused">O profissional não pôde atender.</p>
                <a class="cg-link-btn" data-role="other-options" routerLink="/cuidador/rede/buscar" [queryParams]="{ categoria: o.request.specialty }" (click)="closeSheet()">
                  Ver outras opções de {{ category(o) }}
                </a>
              }
              @if (o.evaluation; as ev) {
                <p data-role="evaluation">
                  Você avaliou este serviço: {{ ev.technical }} de 5 no serviço e {{ ev.punctuality }} de 5 na pontualidade e no atendimento.
                </p>
                @if (ev.canEdit) {
                  <p data-role="editable">Você pode corrigir até {{ dayMonthOf(ev.editableUntil) }}.</p>
                } @else {
                  <p data-role="editable">Prazo de correção encerrado.</p>
                }
              }
            </div>
          }
          @case ('cancel') {
            <p data-role="cancel-effect">O profissional deixa de receber o seu pedido. Você pode pedir de novo quando quiser.</p>
          }
          @default {
            <div class="nx-sheet-block" data-role="evaluate">
              <app-cg-rating-pair [(quality)]="quality" [(punctuality)]="punctuality" />
              <app-form-field label="Quer contar mais?" optional controlId="evaluation-comment">
                <textarea appInput rows="3" maxlength="500" [value]="comment()" (input)="onComment($event)"></textarea>
              </app-form-field>
              <p>Sua avaliação ajuda outras famílias. O profissional não vê o seu nome.</p>
              @if (missing(); as text) {
                <p class="nx-missing" id="rating-missing" data-role="missing">{{ text }}</p>
              }
            </div>
          }
        }
        @if (failure(); as error) {
          <app-cg-note variant="error" data-role="failure">{{ error }}</app-cg-note>
        }
      }
      @if (selected(); as o) {
        <ng-container cgSheetActions>
          @switch (mode()) {
            @case ('details') {
              @if (group(o) === 'evaluate') {
                <button type="button" class="btn btn--primary" data-role="evaluate" (click)="startEvaluate(o)">Avaliar</button>
              }
              @if (o.evaluation?.canEdit) {
                <button type="button" class="btn" data-role="correct" (click)="startCorrect(o)">Corrigir minha avaliação</button>
              }
              @if (isOpen(o)) {
                <button type="button" class="btn btn--danger-quiet" data-role="cancel" (click)="startCancel()">Cancelar pedido</button>
              }
              <button type="button" class="cg-link-btn" data-role="back" (click)="closeSheet()">Voltar</button>
            }
            @case ('cancel') {
              <button type="button" class="btn btn--danger-quiet" data-role="confirm-cancel" (click)="confirmCancel(o)">Cancelar pedido</button>
              <button type="button" class="cg-link-btn" data-role="back" (click)="closeSheet()">Voltar</button>
            }
            @default {
              <button
                type="button"
                class="btn btn--primary"
                data-role="send-evaluation"
                [disabled]="missing() !== null"
                [attr.aria-describedby]="missing() !== null ? 'rating-missing' : null"
                (click)="submitEvaluation(o)"
              >
                {{ mode() === 'correct' ? 'Salvar correção' : 'Enviar avaliação' }}
              </button>
              <button type="button" class="cg-link-btn" data-role="back" (click)="closeSheet()">Voltar</button>
            }
          }
        </ng-container>
      }
    </app-cg-sheet>
  `,
})
export class OrdersPage {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly network = inject(CaregiverNetworkService);
  private readonly clock = inject(Clock);
  private readonly toast = inject(ToastService);
  private readonly chrome = inject(PageChromeService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly ctx = inject(CaregiverContextService);

  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });

  private readonly orders = computed<OrderView[]>(() => {
    const id = this.ctx.caregiverId();
    return id ? this.network.ordersOf(id) : [];
  });

  protected readonly rows = computed<OrderRow[]>(() => {
    const today = this.clock.today();
    return this.orders().map((o) => ({
      id: o.request.id,
      providerName: o.providerName,
      need: o.request.need,
      meta: `Pedido em ${formatDayShort(dateOf(o.request.requestedAt), today)} · ${categoryLabel(o.request.specialty)}`,
      status: requestStatusView(o.request),
      group: orderGroupOf(o.request),
    }));
  });
  protected readonly toEvaluate = computed(() => this.rows().filter((r) => r.group === 'evaluate'));
  protected readonly inProgress = computed(() => this.rows().filter((r) => r.group === 'open'));
  protected readonly previous = computed(() => this.rows().filter((r) => r.group === 'previous'));

  // ===== A folha =====

  protected readonly sheetOpen = signal(false);
  protected readonly mode = signal<SheetMode>('details');
  private readonly selectedId = signal<ID | null>(null);
  protected readonly selected = computed(() => this.orders().find((o) => o.request.id === this.selectedId()) ?? null);

  protected readonly quality = signal<CgRatingValue | null>(null);
  protected readonly punctuality = signal<CgRatingValue | null>(null);
  protected readonly comment = signal('');
  protected readonly failure = signal<string | null>(null);
  protected readonly banner = signal<Banner | null>(null);

  protected readonly missing = computed(() => ratingPairMissingText(this.quality(), this.punctuality()));

  protected readonly heading = computed(() => {
    const selected = this.selected();
    switch (this.mode()) {
      case 'cancel':
        return 'Cancelar este pedido?';
      case 'evaluate':
        return 'Avaliar o serviço';
      case 'correct':
        return 'Corrigir minha avaliação';
      default:
        return selected?.providerName ?? 'Pedido';
    }
  });

  constructor() {
    // Os links de Hoje e da ficha: `?avaliar=<pedido>` abre a avaliação e `?pedido=<pedido>` abre o pedido.
    effect(() => {
      const evaluateId = this.params().get('avaliar');
      const orderId = this.params().get('pedido');
      untracked(() => {
        if (evaluateId) {
          this.openFromLink(evaluateId, true);
        } else if (orderId) {
          this.openFromLink(orderId, false);
        }
      });
    });
  }

  private openFromLink(id: ID, evaluate: boolean): void {
    const order = this.orders().find((o) => o.request.id === id);
    if (!order) {
      return;
    }
    this.selectedId.set(id);
    this.resetForm();
    this.mode.set(evaluate && orderGroupOf(order.request) === 'evaluate' ? 'evaluate' : 'details');
    this.sheetOpen.set(true);
  }

  protected openRow(row: OrderRow): void {
    this.selectedId.set(row.id);
    this.resetForm();
    this.mode.set(row.group === 'evaluate' ? 'evaluate' : 'details');
    this.sheetOpen.set(true);
  }

  protected onSheetChange(open: boolean): void {
    this.sheetOpen.set(open);
    if (!open) {
      this.clearLinkParams();
    }
  }

  protected closeSheet(): void {
    this.sheetOpen.set(false);
    this.clearLinkParams();
  }

  private clearLinkParams(): void {
    if (this.params().has('avaliar') || this.params().has('pedido')) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { avaliar: null, pedido: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  private resetForm(): void {
    this.quality.set(null);
    this.punctuality.set(null);
    this.comment.set('');
    this.failure.set(null);
  }

  // ===== Textos de cada pedido =====

  protected group(o: OrderView): OrderGroup {
    return orderGroupOf(o.request);
  }

  protected isOpen(o: OrderView): boolean {
    return this.group(o) === 'open';
  }

  protected statusOf(o: OrderView): StatusView {
    return requestStatusView(o.request);
  }

  protected modality(o: OrderView): string {
    return modalityLabel(o.request.modality);
  }

  protected category(o: OrderView): string {
    return categoryLabel(o.request.specialty);
  }

  protected dayMonthOf(date: string): string {
    return dayMonth(date);
  }

  /** A linha do tempo curta do pedido aberto na folha. */
  protected readonly stepLines = computed(() => {
    const o = this.selected();
    return o ? this.steps(o) : [];
  });

  /** A linha do tempo curta: enviado, a resposta e a conclusão. */
  private steps(o: OrderView): string[] {
    const today = this.clock.today();
    const r = o.request;
    const lines = [`Pedido enviado ${relativeDateTime(r.requestedAt, today)}.`];
    if (r.respondedAt) {
      const label =
        r.status === 'accepted' || r.status === 'completed' || r.status === 'evaluated'
          ? 'Aceito'
          : r.status === 'cancelled_by_user'
            ? 'Cancelado por você'
            : r.status === 'cancelled_by_provider'
              ? 'Cancelado pelo profissional'
              : 'O profissional respondeu';
      lines.push(`${label} ${relativeDateTime(r.respondedAt, today)}.`);
    }
    if (r.completedAt) {
      lines.push(`Serviço concluído ${relativeDateTime(r.completedAt, today)}.`);
    }
    return lines;
  }

  // ===== Ações =====

  protected startCancel(): void {
    this.failure.set(null);
    this.mode.set('cancel');
    this.focusSheet(true);
  }

  protected confirmCancel(o: OrderView): void {
    const result = this.network.cancelRequest(this.ctx.requireCaregiverId(), o.request.id);
    if (!result.ok) {
      this.failure.set(result.error);
      return;
    }
    this.closeSheet();
    this.mode.set('details');
    const message = 'Pedido cancelado. Você pode pedir de novo quando quiser.';
    this.banner.set({ variant: 'soft', text: message });
    this.toast.show({ message, durationMs: 8000 });
  }

  protected startEvaluate(o: OrderView): void {
    this.resetForm();
    this.selectedId.set(o.request.id);
    this.mode.set('evaluate');
    this.focusSheet(false);
  }

  protected startCorrect(o: OrderView): void {
    const ev = o.evaluation;
    this.resetForm();
    this.quality.set((ev?.technical as CgRatingValue | undefined) ?? null);
    this.punctuality.set((ev?.punctuality as CgRatingValue | undefined) ?? null);
    this.comment.set(ev?.comment ?? '');
    this.mode.set('correct');
    this.focusSheet(false);
  }

  protected onComment(event: Event): void {
    this.comment.set((event.target as HTMLTextAreaElement).value);
  }

  protected submitEvaluation(o: OrderView): void {
    const caregiverId = this.ctx.requireCaregiverId();
    const input = { technical: this.quality(), punctuality: this.punctuality(), comment: this.comment() };
    const correcting = this.mode() === 'correct';
    const result = correcting
      ? this.network.correctEvaluation(caregiverId, o.request.id, input)
      : this.network.evaluate(caregiverId, o.request.id, input);
    if (!result.ok) {
      this.failure.set(result.error);
      return;
    }
    this.closeSheet();
    this.mode.set('details');
    const until = dayMonth(result.value.editableUntil);
    const message = `${correcting ? 'Avaliação corrigida' : 'Avaliação enviada'}. Você pode corrigir até ${until}.`;
    this.banner.set({ variant: 'ok', text: message });
    this.toast.show({ message, durationMs: 8000 });
    this.chrome.focusHeading();
  }

  /** Dentro da folha aberta, a troca de passo leva o foco ao título (ou ao botão seguro, no cancelamento). */
  private focusSheet(safe: boolean): void {
    afterNextRender(
      () => {
        const root = this.host.nativeElement.querySelector('dialog[open]');
        const target = safe
          ? (root?.querySelector('.cg-sheet__actions button:last-of-type') as HTMLElement | null)
          : (root?.querySelector('.cg-sheet__title') as HTMLElement | null);
        target?.focus();
      },
      { injector: this.injector },
    );
  }
}
