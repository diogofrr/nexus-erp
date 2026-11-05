import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@core/auth';
import { Clock } from '@core/clock';
import { Database } from '@core/data';
import type { Complaint } from '@core/models';
import { isComplaintOverdue } from '@core/rules';
import {
  ActiveFilter,
  ActiveFiltersComponent,
  BadgeComponent,
  DataTableComponent,
  FilterChipsComponent,
  FilterOption,
  IconComponent,
  PageHeaderComponent,
  TableColumn,
  CellDirective,
  createListState,
} from '@shared/ui';
import { ComplaintDrawerComponent } from '../components/complaint-drawer.component';
import { ComplaintsService } from '../state/complaints.service';
import {
  COMPLAINT_OPEN_STATES,
  COMPLAINT_STATUS_LABELS,
  COMPLAINT_TARGET_LABELS,
  CHANNEL_LABELS,
  complaintDeadline,
} from '../state/message-view';

const VIEWS = ['vencidas', 'abertas', 'graves'] as const;
type View = (typeof VIEWS)[number];
const VIEW_LABELS: Record<View, string> = { vencidas: 'Vencidas', abertas: 'Abertas', graves: 'Graves' };
const STATES: readonly Complaint['status'][] = ['open', 'in_progress', 'answered', 'closed', 'dismissed'];

/**
 * Reclamações (SCR-M11-04, PD-01 e PD-05, POP-08): lista por estado e prazo, o prazo mais próximo primeiro.
 * Filtros na URL (`?filtro=vencidas|abertas|graves`, `?estado=open`). O responsável técnico vê só as graves e
 * as de suspeita de violência; a gestão vê o código do cuidador e o texto oculto (LP-08).
 */
@Component({
  selector: 'app-complaints-page',
  imports: [
    ActiveFiltersComponent,
    BadgeComponent,
    CellDirective,
    ComplaintDrawerComponent,
    DataTableComponent,
    FilterChipsComponent,
    IconComponent,
    PageHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Reclamações" [count]="countText()" description="Resposta em até 5 dias úteis.">
        @if (canWrite()) {
          <button type="button" class="btn btn--primary" data-role="new-complaint" (click)="drawerOpen.set(true)">
            <svg appIcon="plus" size="sm"></svg>Nova reclamação
          </button>
        }
      </app-page-header>

      <app-data-table
        caption="Reclamações"
        noun="reclamações"
        [rows]="rows()"
        [columns]="columns"
        [state]="state()"
        [sort]="list.sort()"
        (sortChange)="list.setSort($event)"
        [filtersActive]="list.hasActive()"
        [(search)]="list.search"
        searchable
        searchLabel="Buscar reclamação"
        searchPlaceholder="Protocolo, prestador ou cuidador"
        rowClickable
        emptyTitle="Nenhuma reclamação por aqui"
        emptyText="Quando uma reclamação for aberta, ela aparece aqui com o prazo de resposta."
        (rowClick)="open($event)"
        (filtersCleared)="list.clear()"
        (retry)="state.set('ready')"
      >
        <div appTableFilters class="cluster">
          <app-filter-chips label="Visão" [options]="viewOptions()" [value]="view()" allLabel="Todas" (valueChange)="list.setFilter('filtro', $event)" />
          <app-filter-chips label="Estado" [options]="stateOptions()" [value]="status()" allLabel="Todos os estados" (valueChange)="list.setFilter('estado', $event)" />
        </div>
        <ng-template appCell="protocol" let-row>
          <a class="row-link" [attr.href]="'/app/reclamacoes/' + row.id" (click)="$event.preventDefault(); open(row)">{{ row.protocol }}</a>
        </ng-template>
        <ng-template appCell="status" let-row>
          <app-badge [variant]="statusVariant(row)" dot>{{ statusLabel(row) }}</app-badge>
        </ng-template>
        <ng-template appCell="target" let-row>
          <span>{{ targetLabel(row) }}</span>
        </ng-template>
        <ng-template appCell="severity" let-row>
          @if (row.suspectedElderAbuse) {
            <app-badge variant="danger" icon="shield-alert">
              {{ isTechnicalLead() ? 'Suspeita de violência (POP-07)' : 'Enviado ao responsável técnico' }}
            </app-badge>
          } @else if (row.severity === 'grave') {
            <app-badge variant="danger" icon="triangle-alert">Grave</app-badge>
          } @else {
            <span class="t-muted">Normal</span>
          }
        </ng-template>
        <ng-template appCell="caregiver" let-row>
          <span class="discreet">{{ caregiverLabel(row) }}</span>
        </ng-template>
        <ng-template appCell="due" let-row>
          @let d = deadline(row);
          <app-badge [variant]="d.tone === 'danger' ? 'danger' : d.tone === 'attention' ? 'attention' : d.tone === 'done' ? 'success' : 'info'" icon="clock">
            {{ d.label }}
          </app-badge>
          <span class="sr-only">. {{ d.absolute }}</span>
        </ng-template>
      </app-data-table>

      @if (activeFilters().length > 0) {
        <div class="mt-3">
          <app-active-filters [filters]="activeFilters()" (removed)="list.setFilter($event, null)" (cleared)="list.clear()" />
        </div>
      }
    </div>
    <app-complaint-drawer [(open)]="drawerOpen" (created)="open($event)" />
  `,
})
export class ComplaintsPage {
  private readonly db = inject(Database);
  private readonly auth = inject(AuthService);
  private readonly clock = inject(Clock);
  private readonly service = inject(ComplaintsService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);

  readonly list = createListState({
    key: 'complaints',
    filterKeys: ['filtro', 'estado'],
    defaultSort: { key: 'due', direction: 'asc' },
  });

  protected readonly drawerOpen = signal(false);
  protected readonly state = signal<'ready' | 'loading' | 'error' | 'forbidden'>('loading');
  protected readonly canWrite = computed(() => this.auth.can('complaints', 'create'));
  protected readonly isTechnicalLead = computed(() => this.auth.role() === 'technical_lead');

  protected readonly columns: readonly TableColumn<Complaint>[] = [
    { key: 'protocol', header: 'Protocolo', primary: true, sortable: true, value: (c) => c.protocol },
    { key: 'status', header: 'Estado', value: (c) => COMPLAINT_STATUS_LABELS[c.status], sortable: true },
    { key: 'target', header: 'Sobre', value: (c) => this.targetLabel(c), sortable: true },
    { key: 'severity', header: 'Gravidade', value: (c) => (c.severity === 'grave' ? 'Grave' : 'Normal'), sortable: true },
    { key: 'caregiver', header: 'Cuidador', value: (c) => this.caregiverLabel(c) },
    { key: 'channel', header: 'Canal', value: (c) => CHANNEL_LABELS[c.channel], muted: true },
    {
      key: 'due',
      header: 'Prazo',
      value: (c) => this.deadline(c).label,
      sortable: true,
      // Abertas primeiro, pelo prazo mais próximo; encerradas no fim (UX 5.1).
      sortValue: (c) => `${COMPLAINT_OPEN_STATES.includes(c.status) ? '0' : '9'}${c.dueAt}`,
    },
  ];

  protected readonly visible = computed(() => {
    const role = this.auth.role();
    return role ? this.service.visibleTo(role) : [];
  });

  protected readonly view = computed<View | null>(() => VIEWS.find((v) => v === this.list.filters()['filtro']) ?? null);
  protected readonly status = computed<string | null>(() => STATES.find((s) => s === this.list.filters()['estado']) ?? null);

  private matches(c: Complaint, view: View | null): boolean {
    switch (view) {
      case 'vencidas':
        return isComplaintOverdue(c, this.clock.now());
      case 'abertas':
        return COMPLAINT_OPEN_STATES.includes(c.status);
      case 'graves':
        return c.severity === 'grave' || c.suspectedElderAbuse;
      default:
        return true;
    }
  }

  protected readonly rows = computed(() => {
    const view = this.view();
    const status = this.status();
    return this.visible().filter((c) => this.matches(c, view) && (!status || c.status === status));
  });

  protected readonly viewOptions = computed<FilterOption[]>(() =>
    VIEWS.map((v) => ({
      value: v,
      label: VIEW_LABELS[v],
      count: this.visible().filter((c) => this.matches(c, v)).length,
    })),
  );

  protected readonly stateOptions = computed<FilterOption[]>(() =>
    STATES.map((s) => ({
      value: s,
      label: COMPLAINT_STATUS_LABELS[s],
      count: this.visible().filter((c) => c.status === s).length,
    })),
  );

  protected readonly activeFilters = computed<ActiveFilter[]>(() => {
    const list: ActiveFilter[] = [];
    const view = this.view();
    const status = this.status();
    if (view) {
      list.push({ key: 'filtro', label: `Visão: ${VIEW_LABELS[view]}` });
    }
    if (status) {
      list.push({ key: 'estado', label: `Estado: ${COMPLAINT_STATUS_LABELS[status as Complaint['status']]}` });
    }
    return list;
  });

  protected readonly countText = computed(() => {
    const n = this.visible().length;
    const overdue = this.visible().filter((c) => isComplaintOverdue(c, this.clock.now())).length;
    return `${n} ${n === 1 ? 'reclamação' : 'reclamações'}${overdue > 0 ? `, ${overdue} ${overdue === 1 ? 'vencida' : 'vencidas'}` : ''}`;
  });

  constructor() {
    afterNextRender(() => this.state.set('ready'), { injector: this.injector });
  }

  protected statusLabel(c: Complaint): string {
    return COMPLAINT_STATUS_LABELS[c.status];
  }

  protected statusVariant(c: Complaint): 'success' | 'info' | 'attention' | 'neutral' {
    switch (c.status) {
      case 'closed':
        return 'success';
      case 'dismissed':
        return 'neutral';
      case 'answered':
        return 'info';
      default:
        return 'attention';
    }
  }

  protected deadline(c: Complaint) {
    return complaintDeadline(c, this.clock.now());
  }

  protected targetLabel(c: Complaint): string {
    const base = COMPLAINT_TARGET_LABELS[c.target.type];
    const provider = c.target.providerId ? this.db.providers.get(c.target.providerId) : undefined;
    return provider ? `${base}: ${provider.name}` : base;
  }

  protected caregiverLabel(c: Complaint): string {
    if (!c.caregiverId) {
      return 'Não identificado';
    }
    const cg = this.db.caregivers.get(c.caregiverId);
    return cg ? (this.auth.role() === 'partner' ? cg.code : cg.fullName) : 'Não identificado';
  }

  protected open(c: Complaint): void {
    void this.router.navigate(['/app/reclamacoes', c.id]);
  }
}
