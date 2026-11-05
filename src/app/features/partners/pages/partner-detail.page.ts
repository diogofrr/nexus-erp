import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { formatDate, formatMoney, formatPercent } from '@core/format';
import type { CardUsage, Partner, PartnerStatus } from '@core/models';
import {
  BadgeComponent,
  CellDirective,
  DataTableComponent,
  DescriptionItem,
  DescriptionListComponent,
  EmptyStateComponent,
  IconComponent,
  KpiComponent,
  KpiStripComponent,
  PageHeaderComponent,
  TabItem,
  TabsComponent,
  TableColumn,
  TimelineComponent,
  TimelineItem,
} from '@shared/ui';
import { BannerComponent, DialogService, PageContextService, ToastService } from '@shared/ui/overlay';
import { PartnerFormDrawerComponent } from '../components/partner-form.drawer';
import {
  PARTNER_FUNNEL,
  PARTNER_CATEGORY_LABEL,
  PARTNER_STATUS_LABEL,
  PARTNER_STATUS_LOOK,
  REMUNERATION_LABEL,
} from '../state/partner-labels';
import {
  PARTNER_TRANSITIONS,
  VALIDATION_LABEL,
  ValidationKind,
  checkPartnerMove,
  remunerationNeedsValidation,
} from '../state/partner-rules';
import { PartnersService } from '../state/partners.service';

interface UsageRow {
  id: string;
  date: string;
  code: string;
  amount: number;
  discount: number;
}

type Tab = 'resumo' | 'uso' | 'historico';

/**
 * SCR-M09-02 Ficha do parceiro (PD-03): dados, desconto, validação jurídica e ética da remuneração (duas
 * caixas com data, RN-CRT-06), próximo passo no funil, uso do cartão e histórico. Quem usou o cartão
 * aparece só pelo código pseudonimizado. O atendimento só lê: nenhum botão de escrita.
 */
@Component({
  selector: 'app-partner-detail-page',
  imports: [
    RouterLink,
    BadgeComponent,
    BannerComponent,
    CellDirective,
    DataTableComponent,
    DescriptionListComponent,
    EmptyStateComponent,
    IconComponent,
    KpiComponent,
    KpiStripComponent,
    PageHeaderComponent,
    PartnerFormDrawerComponent,
    TabsComponent,
    TimelineComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      @if (partner(); as p) {
        <app-page-header [title]="p.name" [description]="subtitle()">
          @if (service.canWrite() && p.status !== 'ended') {
            <button type="button" class="btn" data-role="edit-partner" (click)="editOpen.set(true)">
              <svg appIcon="pencil"></svg>Editar dados
            </button>
          }
        </app-page-header>

        <div class="cluster mb-4">
          <app-badge [variant]="look().variant" [icon]="look().icon" large data-role="status">{{ statusLabel() }}</app-badge>
        </div>

        <app-tabs label="Ficha do parceiro" [tabs]="tabs()" [selected]="tab()" (selectedChange)="setTab($event)">
          @switch (tab()) {
            @case ('resumo') {
              <div class="layout-main-aside">
                <div class="stack stack--6">
                  <section class="card card--pad stack stack--3" aria-labelledby="pd-data">
                    <h2 class="card__title" id="pd-data">Dados do parceiro</h2>
                    <app-description-list [items]="dataItems()" />
                  </section>

                  <section class="card card--pad stack stack--3" aria-labelledby="pd-validation" data-role="validation">
                    <h2 class="card__title" id="pd-validation">Validação jurídica e ética</h2>
                    @if (!needsValidation()) {
                      <app-banner variant="info" heading="Sem remuneração, sem validação">
                        Este parceiro não tem remuneração. Ele pode ser ativado sem a validação jurídica e ética.
                      </app-banner>
                    } @else {
                      <p class="t-muted t-ui">
                        O modelo de remuneração só vale depois das duas validações, com informação clara ao
                        usuário e sem diferença de tratamento entre parceiros.
                      </p>
                      <ul class="stack stack--2" role="list">
                        @for (kind of kinds; track kind) {
                          <li class="cluster cluster--between">
                            @if (service.canWrite() && p.status !== 'ended') {
                              <label class="check">
                                <input
                                  type="checkbox"
                                  [attr.data-role]="'validation-' + kind"
                                  [checked]="isValidated(kind)"
                                  (change)="toggleValidation(kind, $event)"
                                />
                                <span>Registrar {{ labelOf(kind) }}</span>
                              </label>
                            } @else {
                              <span>{{ capitalLabel(kind) }}</span>
                            }
                            <app-badge
                              [variant]="isValidated(kind) ? 'success' : 'attention'"
                              [icon]="isValidated(kind) ? 'circle-check' : 'clock'"
                              [attr.data-role]="'validation-state-' + kind"
                            >
                              {{ validationText(kind) }}
                            </app-badge>
                          </li>
                        }
                      </ul>
                    }
                  </section>
                </div>

                <aside class="stack stack--6" aria-label="Funil e próximos passos">
                  <section class="card card--pad stack stack--3" aria-labelledby="pd-funnel">
                    <h2 class="card__title" id="pd-funnel">Funil de parceiros</h2>
                    <ol class="stack stack--2" role="list">
                      @for (step of funnelSteps(); track step.status) {
                        <li class="cluster">
                          <app-badge
                            [variant]="step.current ? look().variant : 'neutral'"
                            [icon]="step.current ? 'circle-dot' : step.passed ? 'check' : 'circle-dashed'"
                            [outline]="!step.current"
                          >
                            {{ step.label }}
                          </app-badge>
                          @if (step.current) {
                            <span class="t-caption">Estado atual</span>
                          }
                        </li>
                      }
                    </ol>
                  </section>

                  @if (service.canWrite()) {
                    <section class="card card--pad stack stack--3" aria-labelledby="pd-next" data-role="next-steps">
                      <h2 class="card__title" id="pd-next">Próximo passo</h2>
                      @if (p.status === 'ended') {
                        <p class="t-muted t-ui">Parceria encerrada. Não há próximos passos.</p>
                      }
                      @for (move of moves(); track move.to) {
                        <div class="stack stack--2">
                          <button
                            type="button"
                            class="btn"
                            [class.btn--primary]="move.primary"
                            [class.btn--danger-quiet]="move.danger"
                            [class.btn--ghost]="move.ghost"
                            [attr.data-role]="'move-' + move.to"
                            [attr.aria-disabled]="move.reason ? 'true' : null"
                            [attr.aria-describedby]="move.reason ? 'reason-' + move.to : null"
                            (click)="move.reason ? null : doMove(move.to)"
                          >
                            {{ move.label }}
                          </button>
                          @if (move.reason) {
                            <span class="t-caption" [id]="'reason-' + move.to" data-role="move-reason">{{ move.reason }}</span>
                          }
                        </div>
                      }
                    </section>
                  }
                </aside>
              </div>
            }
            @case ('uso') {
              <section class="stack stack--6" aria-labelledby="pd-use">
                <h2 id="pd-use" class="sr-only">Uso do cartão neste parceiro</h2>
                <app-kpi-strip aria-label="Resumo do uso do cartão">
                  <app-kpi label="Usos do cartão" [value]="totals().uses" />
                  <app-kpi label="Valor das compras" [value]="money(totals().amountCents)" />
                  <app-kpi label="Descontos concedidos" [value]="money(totals().discountCents)" />
                </app-kpi-strip>
                @if (usageRows().length === 0) {
                  <div class="card">
                    <app-empty-state
                      compact
                      title="Nenhum uso do cartão neste parceiro"
                      text="Quando um usuário aplicar o desconto aqui, o uso aparece nesta lista, só com o código do cuidador."
                    />
                  </div>
                } @else {
                  <app-data-table
                    caption="Usos do Cartão Nexus neste parceiro"
                    noun="usos"
                    [rows]="usageRows()"
                    [columns]="usageColumns"
                    [stack]="true"
                  >
                    <ng-template appCell="code" let-row><span class="code-chip">{{ row.code }}</span></ng-template>
                    <ng-template appCell="amount" let-row>{{ money(row.amount) }}</ng-template>
                    <ng-template appCell="discount" let-row>{{ money(row.discount) }}</ng-template>
                  </app-data-table>
                }
              </section>
            }
            @case ('historico') {
              <section class="card card--pad stack stack--3" aria-labelledby="pd-history">
                <h2 class="card__title" id="pd-history">Histórico do parceiro</h2>
                <app-timeline label="Histórico do parceiro" [items]="history()" />
              </section>
            }
          }
        </app-tabs>

        @if (service.canWrite()) {
          <app-partner-form-drawer [(open)]="editOpen" [partner]="p" />
        }
      } @else {
        <div class="card">
          <app-empty-state title="Não encontramos este parceiro" text="Ele pode ter sido digitado errado no endereço. Volte à lista para escolher outro.">
            <a class="btn btn--primary" routerLink="/app/parceiros">Ver parceiros</a>
          </app-empty-state>
        </div>
      }
    </div>
  `,
})
export class PartnerDetailPageComponent {
  protected readonly service = inject(PartnersService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly page = inject(PageContextService);

  private readonly id = toSignal(this.route.paramMap.pipe(map((m) => m.get('id') ?? '')), {
    initialValue: this.route.snapshot.paramMap.get('id') ?? '',
  });
  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  protected readonly kinds: readonly ValidationKind[] = ['legal', 'ethics'];
  protected readonly editOpen = signal(false);

  protected readonly partner = computed<Partner | undefined>(() => {
    // Lê a coleção para a ficha reagir a qualquer mudança.
    this.service.partners();
    return this.service.get(this.id());
  });

  protected readonly tab = computed<Tab>(() => {
    const raw = this.query().get('aba');
    return raw === 'uso' || raw === 'historico' ? raw : 'resumo';
  });
  protected readonly tabs = computed<TabItem[]>(() => [
    { id: 'resumo', label: 'Resumo' },
    { id: 'uso', label: 'Uso do cartão', badge: this.totals().uses },
    { id: 'historico', label: 'Histórico' },
  ]);

  protected readonly look = computed(() => PARTNER_STATUS_LOOK[this.partner()?.status ?? 'prospect']);
  protected readonly statusLabel = computed(
    () => PARTNER_STATUS_LABEL[this.partner()?.status ?? 'prospect'],
  );
  protected readonly subtitle = computed(() => {
    const p = this.partner();
    return p ? `${PARTNER_CATEGORY_LABEL[p.category]} · ${p.city}` : '';
  });
  protected readonly needsValidation = computed(() => {
    const p = this.partner();
    return p ? remunerationNeedsValidation(p.remuneration.model) : false;
  });

  protected readonly dataItems = computed<DescriptionItem[]>(() => {
    const p = this.partner();
    if (!p) {
      return [];
    }
    return [
      { label: 'Categoria', value: PARTNER_CATEGORY_LABEL[p.category] },
      { label: 'Cidade', value: p.city },
      { label: 'Contato', value: `${p.contactName} (${p.contactEmail})` },
      { label: 'Desconto no Cartão Nexus', value: formatPercent(p.discountPercent, { decimals: 1 }) },
      { label: 'Remuneração', value: REMUNERATION_LABEL[p.remuneration.model] },
      { label: 'Observações', value: p.remuneration.notes ?? null },
    ];
  });

  protected readonly funnelSteps = computed(() => {
    const current = this.partner()?.status ?? 'prospect';
    const index = PARTNER_FUNNEL.indexOf(current);
    return PARTNER_FUNNEL.map((status, i) => ({
      status,
      label: PARTNER_STATUS_LABEL[status],
      current: status === current,
      passed: i < index,
    }));
  });

  protected readonly moves = computed(() => {
    const p = this.partner();
    if (!p) {
      return [];
    }
    return PARTNER_TRANSITIONS[p.status].map((to) => {
      const check = checkPartnerMove(p, to);
      return {
        to,
        label: this.moveLabel(p.status, to),
        primary: to === 'active' || (p.status === 'prospect' && to === 'legal_ethics_review'),
        danger: to === 'ended',
        ghost: to === 'prospect',
        reason: check.ok ? null : check.message,
      };
    });
  });

  protected readonly totals = computed(() => {
    this.service.partners();
    return this.service.totalsOf(this.id());
  });
  protected readonly usageRows = computed<UsageRow[]>(() =>
    this.service.usagesOf(this.id()).map((u: CardUsage) => ({
      id: u.id,
      date: formatDate(u.date),
      code: this.service.codeOfCard(u.cardId),
      amount: u.amountCents,
      discount: u.discountCents,
    })),
  );
  protected readonly usageColumns: readonly TableColumn<UsageRow>[] = [
    { key: 'date', header: 'Data', primary: true },
    { key: 'code', header: 'Cuidador (código)' },
    { key: 'amount', header: 'Valor da compra', align: 'end' },
    { key: 'discount', header: 'Desconto', align: 'end' },
  ];

  protected readonly history = computed<TimelineItem[]>(() => {
    this.service.partners();
    return this.service.historyOf(this.id()).map((e) => ({
      id: e.id,
      title: e.title,
      at: e.at,
      ...(e.text ? { text: e.text } : {}),
    }));
  });

  constructor() {
    effect(() => {
      const p = this.partner();
      this.page.setCrumbs([
        { label: 'Parceiros do Cartão', link: '/app/parceiros' },
        { label: p ? p.name : 'Parceiro' },
      ]);
    });
  }

  protected money(cents: number): string {
    return formatMoney(cents);
  }

  protected labelOf(kind: ValidationKind): string {
    return VALIDATION_LABEL[kind];
  }

  protected capitalLabel(kind: ValidationKind): string {
    const text = VALIDATION_LABEL[kind];
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  protected isValidated(kind: ValidationKind): boolean {
    const r = this.partner()?.remuneration;
    return kind === 'legal' ? !!r?.legalValidatedAt : !!r?.ethicsValidatedAt;
  }

  protected validationText(kind: ValidationKind): string {
    const r = this.partner()?.remuneration;
    const date = kind === 'legal' ? r?.legalValidatedAt : r?.ethicsValidatedAt;
    return date ? `Registrada em ${formatDate(date)}` : 'Pendente';
  }

  protected setTab(tab: string | undefined): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { aba: tab && tab !== 'resumo' ? tab : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected toggleValidation(kind: ValidationKind, event: Event): void {
    const p = this.partner();
    if (!p) {
      return;
    }
    const checked = (event.target as HTMLInputElement).checked;
    const result = this.service.setValidation(p.id, kind, checked);
    if (!result.ok) {
      (event.target as HTMLInputElement).checked = !checked;
      this.toasts.error(result.message);
      return;
    }
    if (checked) {
      this.toasts.success(`${this.capitalLabel(kind)} registrada em ${formatDate(this.today())}.`);
    } else {
      this.toasts.show({
        message: `${this.capitalLabel(kind)} desfeita.`,
        action: {
          label: 'Desfazer',
          run: () => {
            this.service.setValidation(p.id, kind, true);
          },
        },
      });
    }
  }

  protected async doMove(to: PartnerStatus): Promise<void> {
    const p = this.partner();
    if (!p) {
      return;
    }
    const name = p.name;
    if (to === 'legal_ethics_review' || to === 'prospect') {
      const result = this.service.moveTo(p.id, to);
      this.report(result.ok, result.ok ? `${name} foi para ${PARTNER_STATUS_LABEL[to]}.` : result.message);
      return;
    }
    const config = this.dialogConfig(p, to);
    const { confirmed } = await this.dialogs.confirm({
      ...config,
      run: () => {
        const result = this.service.moveTo(p.id, to);
        if (!result.ok) {
          throw new Error(result.message);
        }
      },
    });
    if (confirmed) {
      this.toasts.success(config.done);
    }
  }

  private dialogConfig(p: Partner, to: PartnerStatus) {
    const discount = formatPercent(p.discountPercent, { decimals: 1 });
    switch (to) {
      case 'active':
        return {
          title: `${p.status === 'suspended' ? 'Reativar' : 'Ativar'} ${p.name}?`,
          message: `O parceiro volta a aceitar o Cartão Nexus, com ${discount} de desconto.`,
          effects: { keep: ['o histórico de usos do cartão'] },
          confirmLabel: p.status === 'suspended' ? 'Reativar parceiro' : 'Ativar parceiro',
          done: `${p.name} está ativo e aceita o Cartão Nexus.`,
        };
      case 'suspended':
        return {
          title: `Suspender ${p.name}?`,
          message: 'A parceria fica pausada até a gestão reativar.',
          effects: {
            block: ['novos usos do Cartão Nexus neste parceiro', 'a lista de parceiros aos usuários'],
            keep: ['o histórico de usos do cartão'],
          },
          confirmLabel: 'Suspender parceiro',
          done: `${p.name} foi suspenso.`,
        };
      default:
        return {
          title: `Encerrar a parceria com ${p.name}?`,
          message: 'O parceiro deixa de aceitar o Cartão Nexus.',
          effects: {
            block: ['novos usos do Cartão Nexus neste parceiro'],
            keep: ['o histórico de usos do cartão e das validações'],
          },
          irreversibleNote: 'Não dá para reativar. Uma nova parceria começa como novo cadastro.',
          confirmLabel: 'Encerrar parceria',
          done: `A parceria com ${p.name} foi encerrada.`,
        };
    }
  }

  private report(ok: boolean, message: string): void {
    if (ok) {
      this.toasts.success(message);
    } else {
      this.toasts.error(message);
    }
  }

  private moveLabel(from: PartnerStatus, to: PartnerStatus): string {
    switch (to) {
      case 'legal_ethics_review':
        return 'Enviar para validação jurídica e ética';
      case 'active':
        return from === 'suspended' ? 'Reativar parceiro' : 'Ativar parceiro';
      case 'suspended':
        return 'Suspender parceiro';
      case 'prospect':
        return 'Voltar para prospecção';
      default:
        return 'Encerrar parceria';
    }
  }

  private today(): string {
    return this.service.today();
  }
}
