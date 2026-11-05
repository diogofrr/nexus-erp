import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { Database } from '@core/data';
import { formatDate, formatDateTime, formatNumber } from '@core/format';
import { ServiceRequest, ServiceRequestStatus } from '@core/models';
import {
  BadgeComponent,
  CellDirective,
  DataTableComponent,
  EmptyStateComponent,
  FilterChipsComponent,
  FilterOption,
  PageHeaderComponent,
  TableColumn,
  createListState,
  mediaQuery,
} from '@shared/ui';
import { DialogService, DrawerComponent, ToastService } from '@shared/ui/overlay';
import { ReasonDrawerComponent, ReasonSubmit } from '../components/reason-drawer.component';
import { EvaluationDrawerComponent, RequestCreateDrawerComponent } from '../components/request-drawers.component';
import { NetworkAdminService, Result } from '../state/network-admin.service';
import { MODALITY_LABEL, REQUEST_STATUS_VIEW, categoryLabel } from '../state/network-labels';

interface RequestRow {
  id: string;
  requestedAt: string;
  dateText: string;
  providerId: string;
  provider: string;
  need: string;
  caregiver: string;
  pseudonym: boolean;
  status: ServiceRequestStatus;
  withoutEvaluation: boolean;
}

type ReasonMode = 'refuse' | 'cancel_user' | 'cancel_provider';

const STATE_OPTIONS: readonly FilterOption[] = [
  { value: 'novas', label: 'Novas e sem retorno' },
  { value: 'aceitas', label: 'Aceitas' },
  { value: 'sem-avaliacao', label: 'Concluídas sem avaliação' },
  { value: 'encerradas', label: 'Recusadas ou canceladas' },
];

const REASON_VIEW: Readonly<Record<ReasonMode, { heading: string; label: string; confirm: string; message: string; effect: string }>> = {
  refuse: {
    heading: 'Registrar recusa do prestador',
    label: 'Motivo da recusa',
    confirm: 'Registrar recusa',
    message: 'Escreva o motivo da recusa.',
    effect: 'A recusa entra na taxa de recusa dos últimos 30 dias do prestador.',
  },
  cancel_user: {
    heading: 'Cancelar a pedido do usuário',
    label: 'Motivo do cancelamento',
    confirm: 'Cancelar solicitação',
    message: 'Escreva o motivo do cancelamento.',
    effect: 'O cancelamento a pedido do usuário não conta na taxa de recusa do prestador.',
  },
  cancel_provider: {
    heading: 'Registrar cancelamento do prestador',
    label: 'Motivo do cancelamento',
    confirm: 'Registrar cancelamento',
    message: 'Escreva o motivo do cancelamento.',
    effect: 'O cancelamento pelo prestador entra na taxa de recusa dos últimos 30 dias.',
  },
};

/**
 * Solicitações de serviço (SCR-M08-05, PD-01 e PD-02): lista com filtros na URL e detalhe em gaveta acoplada.
 * Novas e sem retorno vêm primeiro. A gestão registra a resposta do prestador, a conclusão e os
 * cancelamentos; a gestão e o atendimento registram o pedido e a avaliação em nome do usuário (RN-CAN-05).
 */
@Component({
  selector: 'app-network-requests-page',
  imports: [
    RouterLink,
    BadgeComponent,
    CellDirective,
    DataTableComponent,
    DrawerComponent,
    EmptyStateComponent,
    EvaluationDrawerComponent,
    FilterChipsComponent,
    PageHeaderComponent,
    ReasonDrawerComponent,
    RequestCreateDrawerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Solicitações de serviço" [count]="countText()" description="Pedidos dos usuários aos prestadores da rede, do pedido à avaliação.">
        @if (canRegister()) {
          <button type="button" class="btn btn--primary" data-role="new-request" (click)="createOpen.set(true)">
            Registrar solicitação
          </button>
        }
      </app-page-header>

      <div [class.layout-list-detail]="detailOpen()" data-role="requests-layout">
        <div class="stack stack--3" [hidden]="narrow() && detailOpen()">
          <app-data-table
            caption="Solicitações de serviço"
            noun="solicitações"
            [rows]="visibleRows()"
            [columns]="columns"
            searchable
            searchLabel="Buscar solicitação"
            searchPlaceholder="Buscar por prestador ou necessidade"
            rowClickable
            [filtersActive]="list.hasActive()"
            emptyTitle="Nenhuma solicitação por aqui"
            emptyText="Quando um usuário pedir um serviço da rede, a solicitação aparece nesta lista."
            (rowClick)="openRequest($event.id)"
            (filtersCleared)="list.clear()"
          >
            <div appTableFilters>
              <app-filter-chips
                label="Estado da solicitação"
                [options]="stateOptions"
                [value]="list.filters()['estado'] ?? null"
                (valueChange)="list.setFilter('estado', $event)"
              />
            </div>
            <ng-template appCell="provider" let-row>
              <a class="row-link" [routerLink]="['/app/rede/prestadores', row.providerId]">{{ row.provider }}</a>
            </ng-template>
            <ng-template appCell="caregiver" let-row>
              <span class="discreet">{{ row.caregiver }}</span>
            </ng-template>
            <ng-template appCell="status" let-row>
              <app-badge [variant]="view(row.status).variant" [icon]="view(row.status).icon">{{ view(row.status).label }}</app-badge>
            </ng-template>
            <ng-template appCell="actions" let-row>
              <button type="button" class="btn btn--sm" (click)="openRequest(row.id)">Abrir</button>
            </ng-template>
          </app-data-table>
        </div>

        <app-drawer
          [docked]="true"
          [open]="detailOpen()"
          heading="Solicitação de serviço"
          [subtitle]="selected() ? 'Pedido em ' + dateTime(selected()!.requestedAt) : ''"
          (closed)="closeRequest()"
        >
          @if (selected(); as r) {
            <div class="stack stack--6" data-role="request-detail">
              <div class="cluster">
                <app-badge [variant]="view(r.status).variant" [icon]="view(r.status).icon">{{ view(r.status).label }}</app-badge>
              </div>
              <dl class="dl">
                <dt>Prestador</dt>
                <dd><a [routerLink]="['/app/rede/prestadores', r.providerId]">{{ providerName() }}</a></dd>
                <dt>Categoria</dt>
                <dd>{{ providerCategory() }}</dd>
                <dt>Necessidade</dt>
                <dd>{{ r.need }}</dd>
                <dt>Atendimento</dt>
                <dd>{{ modality(r.modality) }}</dd>
                <dt>Cuidador</dt>
                <dd><span class="discreet">{{ caregiver() }}</span></dd>
                @if (r.respondedAt) {
                  <dt>Resposta em</dt>
                  <dd>{{ dateTime(r.respondedAt) }}</dd>
                }
                @if (r.completedAt) {
                  <dt>Concluída em</dt>
                  <dd>{{ dateTime(r.completedAt) }}</dd>
                }
                @if (r.reason) {
                  <dt>Motivo</dt>
                  <dd>{{ r.reason }}</dd>
                }
                @if (evaluationText()) {
                  <dt>Avaliação</dt>
                  <dd>{{ evaluationText() }}</dd>
                }
              </dl>
              <div class="stack stack--2" data-role="request-actions">
                @if (r.status === 'requested' && manager()) {
                  <button type="button" class="btn btn--primary" data-role="accept" (click)="accept()">Registrar aceite</button>
                  <button type="button" class="btn" data-role="refuse" (click)="startReason('refuse')">Registrar recusa</button>
                }
                @if (r.status === 'accepted' && manager()) {
                  <button type="button" class="btn btn--primary" data-role="complete" (click)="complete()">Registrar conclusão</button>
                  <button type="button" class="btn" data-role="cancel-provider" (click)="startReason('cancel_provider')">
                    Registrar cancelamento do prestador
                  </button>
                }
                @if ((r.status === 'requested' || r.status === 'accepted') && canRegister()) {
                  <button type="button" class="btn btn--danger-quiet" data-role="cancel-user" (click)="startReason('cancel_user')">
                    Cancelar a pedido do usuário
                  </button>
                }
                @if (r.status === 'completed' && canEvaluate()) {
                  <button type="button" class="btn btn--primary" data-role="register-evaluation" (click)="evaluationOpen.set(true)">
                    Registrar avaliação
                  </button>
                }
                @if (r.status === 'completed' && !canEvaluate()) {
                  <p class="t-caption">Este perfil não registra avaliações.</p>
                }
                @if (r.status === 'evaluated') {
                  <a class="btn" [routerLink]="['/app/rede/avaliacoes']" [queryParams]="{ prestador: r.providerId }">Ver avaliações do prestador</a>
                }
              </div>
            </div>
          } @else if (detailOpen()) {
            <app-empty-state
              compact
              kind="error"
              title="Não encontramos esta solicitação"
              text="Ela pode ter sido removida. Volte à lista para continuar."
            />
          }
        </app-drawer>
      </div>
    </div>

    <app-request-create-drawer [(open)]="createOpen" (created)="openRequest($event)" />
    <app-evaluation-drawer [(open)]="evaluationOpen" [requestId]="selectedId()" />
    <app-reason-drawer
      [(open)]="reasonOpen"
      [heading]="reasonView().heading"
      [subtitle]="providerName()"
      [label]="reasonView().label"
      [requiredMessage]="reasonView().message"
      [confirmLabel]="reasonView().confirm"
      [effect]="reasonView().effect"
      [error]="actionError()"
      (submitted)="submitReason($event)"
    />
  `,
})
export class RequestsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly db = inject(Database);
  private readonly admin = inject(NetworkAdminService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);

  readonly list = createListState({ key: 'network-requests', filterKeys: ['estado'] });

  protected readonly stateOptions = STATE_OPTIONS;
  protected readonly narrow = mediaQuery('(max-width: 1023.98px)');
  protected readonly createOpen = signal(false);
  protected readonly evaluationOpen = signal(false);
  protected readonly reasonOpen = signal(false);
  protected readonly actionError = signal<string | null>(null);
  private readonly reasonMode = signal<ReasonMode>('refuse');

  protected readonly selectedId = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('solicitacao'))),
    { initialValue: this.route.snapshot.queryParamMap.get('solicitacao') },
  );
  protected readonly detailOpen = computed(() => this.selectedId() !== null);
  protected readonly selected = computed(() => {
    const id = this.selectedId();
    return id ? this.db.serviceRequests.get(id) : undefined;
  });

  protected readonly manager = computed(() => this.admin.isManager());
  protected readonly canRegister = computed(() => this.admin.canRegisterRequests());
  protected readonly canEvaluate = computed(() => this.admin.canRegisterEvaluations());
  protected readonly reasonView = computed(() => REASON_VIEW[this.reasonMode()]);

  protected readonly columns: TableColumn<RequestRow>[] = [
    { key: 'dateText', header: 'Pedido em', primary: true, sortable: true, sortValue: (r) => r.requestedAt },
    { key: 'provider', header: 'Prestador', sortable: true, value: (r) => r.provider },
    { key: 'need', header: 'Necessidade' },
    { key: 'caregiver', header: 'Cuidador', value: (r) => r.caregiver },
    { key: 'status', header: 'Estado', noSearch: true },
    { key: 'actions', header: 'Ações', actions: true, noSearch: true },
  ];

  private readonly rows = computed<RequestRow[]>(() => {
    const providers = new Map(this.db.providers.all().map((p) => [p.id, p] as const));
    return this.db.serviceRequests
      .all()
      .map((r) => {
        const who = this.admin.caregiverLabel(r.caregiverId);
        return {
          id: r.id,
          requestedAt: r.requestedAt,
          dateText: formatDateTime(r.requestedAt),
          providerId: r.providerId,
          provider: providers.get(r.providerId)?.name ?? 'Prestador removido',
          need: r.need,
          caregiver: who.text,
          pseudonym: who.pseudonym,
          status: r.status,
          withoutEvaluation: r.status === 'completed',
        };
      })
      .sort((a, b) => {
        const aNew = a.status === 'requested' ? 0 : 1;
        const bNew = b.status === 'requested' ? 0 : 1;
        return aNew - bNew || b.requestedAt.localeCompare(a.requestedAt);
      });
  });

  protected readonly visibleRows = computed(() => {
    const filter = this.list.filters()['estado'];
    return this.rows().filter((row) => {
      switch (filter) {
        case 'novas':
          return row.status === 'requested';
        case 'aceitas':
          return row.status === 'accepted';
        case 'sem-avaliacao':
          return row.status === 'completed';
        case 'encerradas':
          return (
            row.status === 'refused_by_provider' ||
            row.status === 'cancelled_by_provider' ||
            row.status === 'cancelled_by_user'
          );
        default:
          return true;
      }
    });
  });

  protected readonly countText = computed(() => {
    const n = this.visibleRows().length;
    return `${formatNumber(n)} ${n === 1 ? 'solicitação' : 'solicitações'}`;
  });

  protected readonly providerName = computed(() => {
    const r = this.selected();
    return r ? (this.db.providers.get(r.providerId)?.name ?? '') : '';
  });
  protected readonly providerCategory = computed(() => {
    const r = this.selected();
    const p = r ? this.db.providers.get(r.providerId) : undefined;
    return p ? categoryLabel(p.category) : '';
  });
  protected readonly caregiver = computed(() => {
    const r = this.selected();
    return r ? this.admin.caregiverLabel(r.caregiverId).text : '';
  });
  protected readonly evaluationText = computed(() => {
    const r = this.selected();
    const evaluation = r?.evaluationId ? this.db.providerEvaluations.get(r.evaluationId) : undefined;
    return evaluation ? `Nota ${formatNumber(evaluation.score, 1)}, registrada em ${formatDate(evaluation.createdAt)}` : '';
  });

  protected view(status: ServiceRequestStatus): (typeof REQUEST_STATUS_VIEW)[ServiceRequestStatus] {
    return REQUEST_STATUS_VIEW[status];
  }

  protected modality(value: ServiceRequest['modality']): string {
    return MODALITY_LABEL[value];
  }

  protected dateTime(value: string): string {
    return formatDateTime(value);
  }

  protected openRequest(id: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { solicitacao: id },
      queryParamsHandling: 'merge',
    });
  }

  protected closeRequest(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { solicitacao: null },
      queryParamsHandling: 'merge',
    });
  }

  private report(result: Result, message: string): void {
    if (result.ok) {
      this.toasts.success(message);
    } else {
      this.toasts.error(result.error);
    }
  }

  protected async accept(): Promise<void> {
    const r = this.selected();
    if (!r) {
      return;
    }
    const { confirmed } = await this.dialogs.confirm({
      title: `Registrar o aceite de ${this.providerName()}?`,
      message: 'O prestador aceitou atender este pedido.',
      effects: { keep: ['a solicitação, que passa a Aceita'] },
      confirmLabel: 'Registrar aceite',
    });
    if (confirmed) {
      this.report(this.admin.respond(r.id, { accept: true }), 'Aceite registrado. A solicitação está Aceita.');
    }
  }

  protected async complete(): Promise<void> {
    const r = this.selected();
    if (!r) {
      return;
    }
    const { confirmed } = await this.dialogs.confirm({
      title: 'Registrar a conclusão do serviço?',
      message: 'Depois de concluída, a solicitação pode ser avaliada pelo usuário.',
      effects: { keep: ['a solicitação, que passa a Concluída'] },
      confirmLabel: 'Registrar conclusão',
    });
    if (confirmed) {
      this.report(this.admin.complete(r.id), 'Serviço concluído. Falta registrar a avaliação do usuário.');
    }
  }

  protected startReason(mode: ReasonMode): void {
    this.reasonMode.set(mode);
    this.actionError.set(null);
    this.reasonOpen.set(true);
  }

  protected submitReason(input: ReasonSubmit): void {
    const r = this.selected();
    if (!r) {
      return;
    }
    const mode = this.reasonMode();
    const result =
      mode === 'refuse'
        ? this.admin.respond(r.id, { accept: false, reason: input.text })
        : this.admin.cancel(r.id, mode === 'cancel_user' ? 'user' : 'provider', input.text);
    if (!result.ok) {
      this.actionError.set(result.error);
      return;
    }
    this.actionError.set(null);
    this.reasonOpen.set(false);
    this.toasts.success(mode === 'refuse' ? 'Recusa registrada. Ela entra na taxa de recusa do prestador.' : 'Cancelamento registrado.');
  }
}
