import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { formatDate, formatMoney } from '@core/format';
import type { CorporateAccount, CorporateSeat } from '@core/models';
import { maskEmail } from '@core/privacy';
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
  PLAN_NAMES,
  PageHeaderComponent,
  PlanBadgeComponent,
  TabItem,
  TableColumn,
  TabsComponent,
  TimelineComponent,
  TimelineItem,
} from '@shared/ui';
import { DialogService, PageContextService, ToastService } from '@shared/ui/overlay';
import { CompanyFormDrawerComponent } from '../components/company-form.drawer';
import { AdhesionDrawerComponent, InviteSeatDrawerComponent } from '../components/seat.drawers';
import { CompaniesService } from '../state/companies.service';
import {
  CORPORATE_FUNNEL,
  CORPORATE_STATUS_LABEL,
  CORPORATE_STATUS_LOOK,
  SEAT_STATUS_LABEL,
  plural,
} from '../state/partner-labels';
import { CORPORATE_TRANSITIONS } from '../state/partner-rules';

interface SeatRow {
  id: string;
  n: number;
  who: string;
  isCode: boolean;
  status: CorporateSeat['status'];
  statusLabel: string;
}

type Tab = 'resumo' | 'colaboradores' | 'historico';

/**
 * SCR-M09-04 Ficha da empresa (PD-03): contrato (contato de RH, plano por vaga, preço por vaga fora da
 * projeção), colaboradores por código pseudonimizado e adesão agregada. A empresa nunca vê dado individual
 * de saúde nem uso do atendimento: só vagas e agregados com mínimo de 5 (RN-CORP-08).
 */
@Component({
  selector: 'app-company-detail-page',
  imports: [
    RouterLink,
    AdhesionDrawerComponent,
    BadgeComponent,
    CellDirective,
    CompanyFormDrawerComponent,
    DataTableComponent,
    DescriptionListComponent,
    EmptyStateComponent,
    IconComponent,
    InviteSeatDrawerComponent,
    KpiComponent,
    KpiStripComponent,
    PageHeaderComponent,
    PlanBadgeComponent,
    TabsComponent,
    TimelineComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      @if (account(); as a) {
        <app-page-header [title]="a.companyName" [description]="subtitle()">
          @if (service.canWrite() && a.status !== 'ended') {
            <button type="button" class="btn" data-role="edit-company" (click)="editOpen.set(true)">
              <svg appIcon="pencil"></svg>Editar contrato
            </button>
          }
        </app-page-header>

        <div class="cluster mb-4">
          <app-badge [variant]="look().variant" [icon]="look().icon" large data-role="status">{{ statusLabel() }}</app-badge>
          <app-plan-badge [plan]="a.planId" large />
        </div>

        <app-tabs label="Ficha da empresa" [tabs]="tabs()" [selected]="tab()" (selectedChange)="setTab($event)">
          @switch (tab()) {
            @case ('resumo') {
              <div class="layout-main-aside">
                <div class="stack stack--6">
                  <section class="card card--pad stack stack--3" aria-labelledby="cd-contract">
                    <h2 class="card__title" id="cd-contract">Contrato</h2>
                    <app-description-list [items]="contractItems()" />
                    <p class="t-caption" data-role="price-note">O preço por vaga não faz parte da projeção do plano.</p>
                  </section>

                  <section class="card card--pad stack stack--3" aria-labelledby="cd-adhesion" data-role="adhesion">
                    <h2 class="card__title" id="cd-adhesion">Adesão agregada</h2>
                    <app-kpi-strip aria-label="Vagas do contrato">
                      <app-kpi label="Vagas contratadas" [value]="counts().contracted" />
                      <app-kpi label="Vagas ativas" [value]="counts().active" />
                      <app-kpi label="Convites em aberto" [value]="counts().invited" />
                      <app-kpi label="Vagas livres" [value]="counts().free" />
                    </app-kpi-strip>
                    @if (adhesion().participation.kind === 'private') {
                      <app-empty-state
                        compact
                        kind="private"
                        title="Menos de 5 colaboradores ativos"
                        text="Por privacidade, não mostramos a participação em grupos e capacitações. A empresa vê só as vagas e a adesão agregada."
                      />
                    } @else {
                      <p data-role="participation">
                        Participação em grupos e capacitações:
                        <strong>{{ participationText() }}</strong>
                        colaboradores.
                      </p>
                    }
                    <p class="t-caption">
                      A empresa nunca vê dado de saúde nem o uso do atendimento de um colaborador.
                    </p>
                  </section>
                </div>

                <aside class="stack stack--6" aria-label="Funil e próximos passos">
                  <section class="card card--pad stack stack--3" aria-labelledby="cd-funnel">
                    <h2 class="card__title" id="cd-funnel">Funil do contrato</h2>
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
                    <section class="card card--pad stack stack--3" aria-labelledby="cd-next" data-role="next-steps">
                      <h2 class="card__title" id="cd-next">Próximo passo</h2>
                      @if (a.status === 'ended') {
                        <p class="t-muted t-ui">Contrato encerrado. Não há próximos passos.</p>
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
            @case ('colaboradores') {
              <section class="stack stack--6" aria-labelledby="cd-seats">
                <div class="cluster cluster--between">
                  <h2 class="card__title" id="cd-seats">
                    Colaboradores ({{ counts().active }} de {{ counts().contracted }} vagas ativas)
                  </h2>
                  @if (service.canWrite() && a.status !== 'ended') {
                    <div class="stack stack--2">
                      <button
                        type="button"
                        class="btn btn--primary"
                        data-role="invite"
                        [attr.aria-disabled]="inviteBlocked() ? 'true' : null"
                        [attr.aria-describedby]="inviteBlocked() ? 'invite-reason' : null"
                        (click)="invite()"
                      >
                        <svg appIcon="plus"></svg>Convidar colaborador
                      </button>
                      @if (inviteBlocked(); as reason) {
                        <span class="t-caption" id="invite-reason" data-role="invite-reason">{{ reason }}</span>
                      }
                    </div>
                  }
                </div>
                @if (seatRows().length === 0) {
                  <div class="card">
                    <app-empty-state
                      compact
                      title="Nenhum colaborador nesta empresa"
                      text="Convide colaboradores por e-mail. Quando aceitarem, a vaga fica ativa e o plano passa a ser pago pela empresa."
                    />
                  </div>
                } @else {
                  <app-data-table caption="Vagas e colaboradores da empresa" noun="vagas" [rows]="seatRows()" [columns]="seatColumns" [stack]="true">
                    <ng-template appCell="who" let-row>
                      @if (row.isCode) {
                        <span class="code-chip"><svg appIcon="shield-check" size="sm"></svg>{{ row.who }}</span>
                      } @else {
                        <span>{{ row.who }}</span>
                      }
                    </ng-template>
                    <ng-template appCell="status" let-row>
                      <app-badge [variant]="row.status === 'active' ? 'success' : 'info'" [icon]="row.status === 'active' ? 'circle-check' : 'clock'">{{ row.statusLabel }}</app-badge>
                    </ng-template>
                    <ng-template appCell="actions" let-row let-selecting="selecting">
                      @if (service.canWrite() && a.status !== 'ended') {
                        <div class="cluster">
                          @if (row.status === 'invited' && a.status === 'active') {
                            <button type="button" class="btn btn--sm" data-role="adhesion" [disabled]="selecting" (click)="openAdhesion(row.id)">Registrar adesão</button>
                          }
                          <button type="button" class="btn btn--sm btn--danger-quiet" data-role="remove-seat" [disabled]="selecting" (click)="removeSeat(row)">
                            {{ row.status === 'invited' ? 'Cancelar convite' : 'Remover colaborador' }}
                          </button>
                        </div>
                      }
                    </ng-template>
                  </app-data-table>
                }
              </section>
            }
            @case ('historico') {
              <section class="card card--pad stack stack--3" aria-labelledby="cd-history">
                <h2 class="card__title" id="cd-history">Histórico da empresa</h2>
                <app-timeline label="Histórico da empresa" [items]="history()" />
              </section>
            }
          }
        </app-tabs>

        @if (service.canWrite()) {
          <app-company-form-drawer [(open)]="editOpen" [account]="a" />
          <app-invite-seat-drawer [(open)]="inviteOpen" [accountId]="a.id" />
          @if (adhesionSeat(); as seatId) {
            <app-adhesion-drawer [(open)]="adhesionOpen" [seatId]="seatId" />
          }
        }
      } @else {
        <div class="card">
          <app-empty-state title="Não encontramos esta empresa" text="Ela pode ter sido digitada errada no endereço. Volte à lista para escolher outra.">
            <a class="btn btn--primary" routerLink="/app/empresas">Ver empresas</a>
          </app-empty-state>
        </div>
      }
    </div>
  `,
})
export class CompanyDetailPageComponent {
  protected readonly service = inject(CompaniesService);
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

  protected readonly editOpen = signal(false);
  protected readonly inviteOpen = signal(false);
  protected readonly adhesionOpen = signal(false);
  protected readonly adhesionSeat = signal<string | null>(null);

  protected readonly account = computed<CorporateAccount | undefined>(() => {
    this.service.accounts();
    return this.service.get(this.id());
  });
  protected readonly counts = computed(() => {
    this.service.accounts();
    return this.service.countsOf(this.id());
  });
  protected readonly adhesion = computed(() => {
    this.service.accounts();
    return this.service.adhesionOf(this.id());
  });
  protected readonly participationText = computed(() => {
    const p = this.adhesion().participation;
    if (p.kind !== 'aggregate') {
      return '';
    }
    return p.value.sufficient ? String(p.value.value) : p.value.shortLabel;
  });

  protected readonly tab = computed<Tab>(() => {
    const raw = this.query().get('aba');
    return raw === 'colaboradores' || raw === 'historico' ? raw : 'resumo';
  });
  protected readonly tabs = computed<TabItem[]>(() => [
    { id: 'resumo', label: 'Resumo' },
    { id: 'colaboradores', label: 'Colaboradores', badge: this.counts().active },
    { id: 'historico', label: 'Histórico' },
  ]);

  protected readonly look = computed(
    () => CORPORATE_STATUS_LOOK[this.account()?.status ?? 'prospect'],
  );
  protected readonly statusLabel = computed(
    () => CORPORATE_STATUS_LABEL[this.account()?.status ?? 'prospect'],
  );
  protected readonly subtitle = computed(() => {
    const a = this.account();
    return a ? `CNPJ fictício ${a.cnpj} · plano ${PLAN_NAMES[a.planId]} por vaga` : '';
  });

  protected readonly contractItems = computed<DescriptionItem[]>(() => {
    const a = this.account();
    if (!a) {
      return [];
    }
    return [
      { label: 'Plano por vaga', value: PLAN_NAMES[a.planId] },
      { label: 'Vagas contratadas', value: a.seats },
      { label: 'Preço por vaga (por mês)', value: formatMoney(a.seatPriceCents) },
      { label: 'Início do contrato', value: a.startDate ? formatDate(a.startDate) : null },
      { label: 'Fim do contrato', value: a.endDate ? formatDate(a.endDate) : null },
      { label: 'Contato de RH', value: `${a.hrContactName} (${a.hrContactEmail})` },
    ];
  });

  protected readonly funnelSteps = computed(() => {
    const current = this.account()?.status ?? 'prospect';
    const index = CORPORATE_FUNNEL.indexOf(current);
    return CORPORATE_FUNNEL.map((status, i) => ({
      status,
      label: CORPORATE_STATUS_LABEL[status],
      current: status === current,
      passed: i < index,
    }));
  });

  protected readonly moves = computed(() => {
    const a = this.account();
    if (!a) {
      return [];
    }
    return CORPORATE_TRANSITIONS[a.status].map((to) => ({
      to,
      label: this.moveLabel(a.status, to),
      primary: to === 'active' || (a.status === 'prospect' && to === 'negotiation'),
      danger: to === 'ended',
      ghost: to === 'prospect',
      reason:
        to === 'active' && (a.seats < 1 || a.seatPriceCents <= 0)
          ? 'Para ativar falta: vagas contratadas e preço por vaga.'
          : null,
    }));
  });

  protected readonly inviteBlocked = computed(() => {
    this.service.accounts();
    this.counts();
    const check = this.service.inviteCheck(this.id());
    return check.ok ? null : check.message;
  });

  protected readonly seatRows = computed<SeatRow[]>(() => {
    this.service.accounts();
    return this.service
      .seatsOf(this.id())
      .sort((a, b) => (a.status === b.status ? a.id.localeCompare(b.id) : a.status === 'active' ? -1 : 1))
      .map((seat, i) => {
        const code = this.service.codeOfSeat(seat);
        return {
          id: seat.id,
          n: i + 1,
          who: code ?? maskEmail(seat.invitedEmail),
          isCode: code !== null,
          status: seat.status,
          statusLabel: SEAT_STATUS_LABEL[seat.status],
        };
      });
  });
  protected readonly seatColumns: readonly TableColumn<SeatRow>[] = [
    { key: 'n', header: 'Vaga', primary: true, value: (r) => `Vaga ${r.n}` },
    { key: 'who', header: 'Colaborador (código ou e-mail oculto)', noSearch: true },
    { key: 'status', header: 'Situação', noSearch: true },
    { key: 'actions', header: 'Ações', actions: true, noSearch: true },
  ];

  protected readonly history = computed<TimelineItem[]>(() => {
    this.service.accounts();
    return this.service.historyOf(this.id()).map((e) => ({
      id: e.id,
      title: e.title,
      at: e.at,
      ...(e.text ? { text: e.text } : {}),
    }));
  });

  constructor() {
    effect(() => {
      const a = this.account();
      this.page.setCrumbs([
        { label: 'Empresas', link: '/app/empresas' },
        { label: a ? a.companyName : 'Empresa' },
      ]);
    });
  }

  protected setTab(tab: string | undefined): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { aba: tab && tab !== 'resumo' ? tab : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected invite(): void {
    if (this.inviteBlocked()) {
      return;
    }
    this.inviteOpen.set(true);
  }

  protected openAdhesion(seatId: string): void {
    this.adhesionSeat.set(seatId);
    this.adhesionOpen.set(true);
  }

  protected async removeSeat(row: SeatRow): Promise<void> {
    const invited = row.status === 'invited';
    const { confirmed } = await this.dialogs.confirm({
      title: invited ? 'Cancelar o convite desta vaga?' : `Remover o colaborador ${row.who}?`,
      message: invited
        ? 'A vaga volta a ficar livre.'
        : 'A vaga volta a ficar livre e o colaborador passa para o plano Livre.',
      effects: invited
        ? { keep: ['o histórico da empresa'] }
        : {
            block: ['o plano pago pela empresa (passa ao Livre)', 'o Cartão Nexus (fica inativo)'],
            keep: ['o cadastro, o atendimento e os consentimentos do colaborador'],
          },
      confirmLabel: invited ? 'Cancelar convite' : 'Remover colaborador',
      run: () => {
        const result = this.service.removeSeat(row.id);
        if (!result.ok) {
          throw new Error(result.message);
        }
      },
    });
    if (confirmed) {
      this.toasts.success(invited ? 'Convite cancelado. A vaga está livre.' : 'Colaborador removido. A vaga está livre.');
    }
  }

  protected async doMove(to: CorporateAccount['status']): Promise<void> {
    const a = this.account();
    if (!a) {
      return;
    }
    if (to === 'negotiation' || to === 'prospect') {
      const result = this.service.moveTo(a.id, to);
      if (result.ok) {
        this.toasts.success(`${a.companyName} foi para ${CORPORATE_STATUS_LABEL[to]}.`);
      } else {
        this.toasts.error(result.message);
      }
      return;
    }
    if (to === 'ended') {
      await this.confirmEnd(a);
      return;
    }
    const suspend = to === 'suspended';
    const { confirmed } = await this.dialogs.confirm({
      title: `${suspend ? 'Suspender' : a.status === 'suspended' ? 'Reativar' : 'Ativar'} o contrato de ${a.companyName}?`,
      message: suspend
        ? 'Os colaboradores continuam com o plano até a decisão sobre o contrato.'
        : 'O contrato ativo recebe colaboradores, que contam como assinantes.',
      effects: suspend
        ? { block: ['novos convites de colaboradores'], keep: ['o plano e o cartão dos colaboradores ativos'] }
        : { keep: ['o histórico do contrato'] },
      confirmLabel: suspend ? 'Suspender contrato' : a.status === 'suspended' ? 'Reativar contrato' : 'Ativar contrato',
      run: () => {
        const result = this.service.moveTo(a.id, to);
        if (!result.ok) {
          throw new Error(result.message);
        }
      },
    });
    if (confirmed) {
      this.toasts.success(
        suspend ? `O contrato de ${a.companyName} foi suspenso.` : `O contrato de ${a.companyName} está ativo.`,
      );
    }
  }

  private async confirmEnd(a: CorporateAccount): Promise<void> {
    const preview = this.service.endPreview(a.id);
    const block: string[] = [];
    if (preview.activeSeats > 0) {
      block.push(
        `o plano pago de ${plural(preview.activeSeats, 'colaborador', 'colaboradores')} (passam ao Livre)`,
      );
    }
    if (preview.cardsToInactivate > 0) {
      block.push(`${plural(preview.cardsToInactivate, 'cartão', 'cartões')} (ficam inativos no mesmo instante)`);
    }
    if (preview.invitedSeats > 0) {
      block.push(`${plural(preview.invitedSeats, 'convite', 'convites')} em aberto (cancelados)`);
    }
    const negotiating = a.status === 'prospect' || a.status === 'negotiation';
    const { confirmed } = await this.dialogs.confirm({
      title: negotiating ? `Encerrar a negociação com ${a.companyName}?` : `Encerrar o contrato de ${a.companyName}?`,
      message: negotiating
        ? 'A empresa sai do funil do canal corporativo.'
        : 'Cada colaborador ativo passa ao plano Livre e pode assumir um plano pago por conta própria.',
      effects: {
        ...(block.length > 0 ? { block } : {}),
        keep: ['o cadastro, o atendimento e os consentimentos dos colaboradores', 'o histórico do contrato'],
      },
      irreversibleNote: 'Não dá para reativar. Um novo contrato começa como novo cadastro.',
      confirmLabel: negotiating ? 'Encerrar negociação' : 'Encerrar contrato',
      run: () => {
        const result = this.service.endContract(a.id);
        if (!result.ok) {
          throw new Error(result.message);
        }
      },
    });
    if (confirmed) {
      this.toasts.success(
        preview.activeSeats > 0
          ? `Contrato encerrado. ${plural(preview.activeSeats, 'colaborador passou', 'colaboradores passaram')} ao plano Livre.`
          : 'Contrato encerrado.',
      );
    }
  }

  private moveLabel(from: CorporateAccount['status'], to: CorporateAccount['status']): string {
    switch (to) {
      case 'negotiation':
        return 'Iniciar negociação';
      case 'active':
        return from === 'suspended' ? 'Reativar contrato' : 'Ativar contrato';
      case 'suspended':
        return 'Suspender contrato';
      case 'prospect':
        return 'Voltar para prospecção';
      default:
        return from === 'prospect' || from === 'negotiation' ? 'Encerrar negociação' : 'Encerrar contrato';
    }
  }
}
