import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/auth';
import { Clock } from '@core/clock';
import { Database } from '@core/data';
import { formatDateTime } from '@core/format';
import { CareSession } from '@core/models';
import {
  ActiveFilter,
  ActiveFiltersComponent,
  BadgeComponent,
  CellDirective,
  DataTableComponent,
  FilterChipsComponent,
  FilterOption,
  PageHeaderComponent,
  TableColumn,
  TableSort,
  createListState,
} from '@shared/ui';
import { KIND_LABELS, MODALITY_SHORT, SESSION_STATUS_VIEW } from '../state/care-labels';

interface SessionRow {
  id: string;
  startAt: string;
  caregiver: string;
  caregiverCode: string;
  psychologist: string;
  modality: string;
  kind: string;
  status: CareSession['status'];
  note: 'signed' | 'draft' | 'pending' | 'none';
}

const STATE_OPTIONS: FilterOption[] = [
  { value: 'proximas', label: 'Próximas' },
  { value: 'realizadas', label: 'Realizadas' },
  { value: 'sem-anotacao', label: 'Sem anotação' },
  { value: 'faltas', label: 'Faltas' },
  { value: 'canceladas', label: 'Canceladas' },
  { value: 'todas', label: 'Todas' },
];

const NOTE_TEXT: Record<SessionRow['note'], string> = {
  signed: 'Assinada',
  draft: 'Rascunho',
  pending: 'Pendente',
  none: '',
};

/**
 * Sessões e seus estados (apoio das telas SCR-M05-01 e 04): lista com filtros na URL. O psicólogo vê as
 * suas; o responsável técnico e o atendimento veem todas. O estado da anotação aparece só para quem lê
 * anotações (nunca o conteúdo). `?filtro=sem-anotacao` vem do sino.
 */
@Component({
  selector: 'app-sessions-page',
  imports: [
    ActiveFiltersComponent,
    BadgeComponent,
    CellDirective,
    DataTableComponent,
    FilterChipsComponent,
    PageHeaderComponent,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      <app-page-header title="Sessões" [count]="count()" description="Estado de cada sessão, da próxima à mais antiga.">
        <a class="btn" routerLink="/app/atendimento/agenda">Ver a agenda</a>
      </app-page-header>

      <app-data-table
        caption="Sessões de atendimento"
        noun="sessões"
        [rows]="rows()"
        [columns]="columns()"
        [filtersActive]="filtersActive()"
        [sort]="list.sort()"
        (sortChange)="list.setSort($event)"
        [search]="list.search()"
        (searchChange)="list.search.set($event)"
        [page]="list.page()"
        (pageChange)="list.setPage($event)"
        searchable
        rowClickable
        emptyTitle="Nenhuma sessão por aqui"
        emptyText="Quando houver sessões neste filtro, elas aparecem nesta lista."
        (rowClick)="open($event)"
        (filtersCleared)="clearFilters()"
      >
        <div appTableFilters class="cluster">
          <app-filter-chips label="Estado" allLabel="" [options]="stateOptions" [value]="state()" (valueChange)="setState($event)" />
          @if (showPsychologistFilter()) {
            <app-filter-chips label="Psicólogo" [options]="psychologistOptions()" [value]="psychologist()" (valueChange)="list.setFilter('psicologo', $event)" />
          }
        </div>
        <ng-template appCell="startAt" let-row>
          <span class="col-primary t-num">{{ whenOf(row) }}</span>
        </ng-template>
        <ng-template appCell="caregiver" let-row>
          <span class="discreet">{{ row.caregiver }}</span> <span class="code-chip">{{ row.caregiverCode }}</span>
        </ng-template>
        <ng-template appCell="status" let-row>
          <app-badge [variant]="statusView(row).variant" [icon]="statusView(row).icon">{{ statusView(row).label }}</app-badge>
        </ng-template>
        <ng-template appCell="note" let-row>
          @if (row.note === 'none') {
            <span class="t-muted">Não se aplica</span>
          } @else {
            <app-badge [variant]="row.note === 'signed' ? 'success' : 'attention'" [icon]="row.note === 'signed' ? 'circle-check' : 'pencil'">{{ noteText(row) }}</app-badge>
          }
        </ng-template>
        <ng-template appCell="actions" let-row let-selecting="selecting">
          <button type="button" class="btn btn--sm" [disabled]="selecting" (click)="open(row)">Abrir</button>
        </ng-template>
      </app-data-table>
      <app-active-filters [filters]="activeFilters()" (removed)="removeFilter($event)" (cleared)="clearFilters()" />
    </div>
  `,
})
export class SessionsPageComponent {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly stateOptions = STATE_OPTIONS;
  protected readonly list = createListState({
    key: 'care-sessions',
    filterKeys: ['estado', 'filtro', 'psicologo'],
    defaultSort: { key: 'startAt', direction: 'asc' } satisfies TableSort,
  });

  private readonly myPsychologist = computed(() => this.auth.actor()?.psychologistId ?? null);
  protected readonly canSeeNotes = computed(() => this.auth.role() === 'psychologist' || this.auth.role() === 'technical_lead');
  protected readonly showPsychologistFilter = computed(() => this.myPsychologist() === null);
  protected readonly state = computed(() => this.list.filters()['estado'] ?? this.list.filters()['filtro'] ?? 'proximas');
  protected readonly psychologist = computed(() => this.list.filters()['psicologo'] ?? null);
  protected readonly psychologistOptions = computed<FilterOption[]>(() =>
    this.db.psychologists.all().map((p) => ({ value: p.id, label: p.displayName })),
  );
  protected readonly filtersActive = computed(() => this.psychologist() !== null || this.list.search() !== '' || this.state() !== 'proximas');

  protected readonly rows = computed<SessionRow[]>(() => {
    const today = this.clock.today();
    const state = this.state();
    const psy = this.psychologist();
    const mine = this.myPsychologist();
    const caregivers = this.db.caregivers;
    const psychologists = this.db.psychologists;
    const signed = new Map(this.db.sessionNotes.all().map((n) => [n.sessionId, n.status] as const));
    return this.db.careSessions
      .all()
      .filter((s) => {
        if (mine !== null && s.psychologistId !== mine) {
          return false;
        }
        if (psy && s.psychologistId !== psy) {
          return false;
        }
        switch (state) {
          case 'proximas':
            return (s.status === 'scheduled' || s.status === 'confirmed') && s.startAt.slice(0, 10) >= today;
          case 'realizadas':
            return s.status === 'done';
          case 'sem-anotacao':
            return s.status === 'done' && signed.get(s.id) !== 'signed';
          case 'faltas':
            return s.status === 'no_show';
          case 'canceladas':
            return s.status === 'cancelled_by_user' || s.status === 'cancelled_by_psychologist';
          default:
            return true;
        }
      })
      .map((s) => {
        const caregiver = caregivers.get(s.caregiverId);
        const noteStatus = signed.get(s.id);
        return {
          id: s.id,
          startAt: s.startAt,
          caregiver: caregiver?.fullName ?? 'Cuidador',
          caregiverCode: caregiver?.code ?? '',
          psychologist: psychologists.get(s.psychologistId)?.displayName ?? '',
          modality: MODALITY_SHORT[s.modality],
          kind: KIND_LABELS[s.kind],
          status: s.status,
          note: !this.canSeeNotes() || s.status !== 'done' ? 'none' : noteStatus === 'signed' ? 'signed' : noteStatus === 'draft' ? 'draft' : 'pending',
        } satisfies SessionRow;
      });
  });

  protected readonly count = computed(() => `${this.rows().length} ${this.rows().length === 1 ? 'sessão' : 'sessões'}`);

  protected readonly columns = computed<TableColumn<SessionRow>[]>(() => {
    const cols: TableColumn<SessionRow>[] = [
      { key: 'startAt', header: 'Data e hora', primary: true, sortable: true, noSearch: true },
      { key: 'caregiver', header: 'Cuidador', sortable: true, searchText: (r) => `${r.caregiver} ${r.caregiverCode}` },
      { key: 'psychologist', header: 'Psicólogo', sortable: true },
      { key: 'modality', header: 'Como', sortable: true, noSearch: true },
      { key: 'kind', header: 'Tipo', sortable: true, noSearch: true },
      { key: 'status', header: 'Estado', sortable: true, sortValue: (r) => SESSION_STATUS_VIEW[r.status].label, noSearch: true },
    ];
    if (this.canSeeNotes()) {
      cols.push({ key: 'note', header: 'Anotação', sortable: true, noSearch: true });
    }
    cols.push({ key: 'actions', header: 'Ações', actions: true });
    return cols;
  });

  protected readonly activeFilters = computed<ActiveFilter[]>(() => {
    const filters: ActiveFilter[] = [];
    if (this.state() !== 'proximas') {
      filters.push({ key: 'estado', label: `Estado: ${STATE_OPTIONS.find((o) => o.value === this.state())?.label ?? ''}` });
    }
    const psy = this.psychologist();
    if (psy) {
      filters.push({ key: 'psicologo', label: `Psicólogo: ${this.db.psychologists.get(psy)?.displayName ?? ''}` });
    }
    return filters;
  });

  protected whenOf(row: SessionRow): string {
    return formatDateTime(row.startAt);
  }

  protected statusView(row: SessionRow) {
    return SESSION_STATUS_VIEW[row.status];
  }

  protected noteText(row: SessionRow): string {
    return NOTE_TEXT[row.note];
  }

  protected setState(value: string | null): void {
    // Trocar o chip substitui também o filtro vindo do sino.
    this.list.setFilter('filtro', null);
    this.list.setFilter('estado', value === 'proximas' ? null : value);
  }

  protected removeFilter(key: string): void {
    if (key === 'estado') {
      this.list.setFilter('filtro', null);
    }
    this.list.setFilter(key, null);
  }

  protected clearFilters(): void {
    this.list.clear();
    this.list.setFilter('filtro', null);
  }

  protected open(row: SessionRow): void {
    void this.router.navigate(['/app/atendimento/sessoes', row.id]);
  }
}
