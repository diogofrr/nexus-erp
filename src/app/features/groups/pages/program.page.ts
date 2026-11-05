import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/auth';
import { Clock, addMonths, firstDayOfYearMonth } from '@core/clock';
import { Database } from '@core/data';
import { formatDate, formatTime, formatYearMonth } from '@core/format';
import { Activity } from '@core/models';
import {
  ActiveFilter,
  ActiveFiltersComponent,
  BadgeComponent,
  CellDirective,
  DataTableComponent,
  EmptyStateComponent,
  FilterChipsComponent,
  FilterOption,
  FormFieldComponent,
  IconComponent,
  NxInputDirective,
  PageHeaderComponent,
  SegmentOption,
  SegmentedComponent,
  TableColumn,
  TableSort,
  createListState,
} from '@shared/ui';
import { valueOf } from '@shared/ui/util/form-events';
import { GroupMembershipService } from '@core/groups';
import {
  ACTIVITY_STATUS_VIEW,
  CHARACTER_LABELS,
  GROUP_THEMES,
  KIND_LABELS,
  MODE_LABELS,
  THEME_LABELS,
  TRAINING_THEMES,
} from '../state/groups-labels';
import { GroupsService } from '../state/groups.service';

interface ActivityRow {
  id: string;
  title: string;
  kind: Activity['kind'];
  kindText: string;
  theme: string;
  character: string;
  status: Activity['status'];
  next: string;
  nextText: string;
  seats: string;
  leaders: string;
  place: string;
}

const KIND_OPTIONS: FilterOption[] = (Object.keys(KIND_LABELS) as Activity['kind'][]).map((value) => ({
  value,
  label: KIND_LABELS[value],
}));
const STATUS_OPTIONS: FilterOption[] = (Object.keys(ACTIVITY_STATUS_VIEW) as Activity['status'][]).map((value) => ({
  value,
  label: ACTIVITY_STATUS_VIEW[value].label,
}));
const PLACE_OPTIONS: FilterOption[] = [
  { value: 'online', label: 'On-line' },
  { value: 'in_person', label: 'Presencial' },
];
const VIEWS: SegmentOption<'lista' | 'calendario'>[] = [
  { value: 'lista', label: 'Lista', icon: 'layout-list' },
  { value: 'calendario', label: 'Calendário', icon: 'calendar' },
];

/**
 * SCR-M07-01, Programação: lista e calendário mensal de grupos de apoio, capacitações, terapia de grupo e rodas
 * de conversa abertas. Filtros por tipo, tema, estado e local ficam na URL. Cada atividade mostra o caráter
 * ("orientação e psicoeducação" ou "psicoterapia") e as vagas; a lotada mostra a lista de espera. O psicólogo vê
 * por padrão os grupos que conduz.
 */
@Component({
  selector: 'app-groups-program-page',
  imports: [
    ActiveFiltersComponent,
    BadgeComponent,
    CellDirective,
    DataTableComponent,
    EmptyStateComponent,
    FilterChipsComponent,
    FormFieldComponent,
    IconComponent,
    NxInputDirective,
    PageHeaderComponent,
    RouterLink,
    SegmentedComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      <app-page-header
        title="Grupos e capacitações"
        [count]="count()"
        description="Programação mensal: grupos de apoio, capacitações, terapia de grupo e rodas de conversa abertas."
      >
        @if (canCreate()) {
          <a class="btn btn--primary" routerLink="/app/grupos/novo" data-role="new-activity">
            <svg appIcon="plus" size="sm"></svg>Nova atividade
          </a>
        }
        @if (canSeeIndicators()) {
          <a class="btn" routerLink="/app/grupos/indicadores" data-role="indicators-link">Indicadores de participação</a>
        }
      </app-page-header>

      <app-segmented label="Visão da programação" [options]="views" [value]="view()" (valueChange)="setView($event)" />

      <div class="cluster" data-role="filters">
        @if (isPsychologist()) {
          <app-filter-chips label="Quem conduz" allLabel="" [options]="whoOptions" [value]="who()" (valueChange)="list.setFilter('quem', $event)" />
        }
        <app-filter-chips label="Tipo" [options]="kindOptions" [value]="kind()" (valueChange)="list.setFilter('tipo', $event)" />
        <app-filter-chips label="Estado" [options]="statusOptions" [value]="status()" (valueChange)="list.setFilter('estado', $event)" />
        <app-filter-chips label="Local" [options]="placeOptions" [value]="place()" (valueChange)="list.setFilter('local', $event)" />
        <app-form-field label="Tema" controlId="program-theme" class="program-theme">
          <select appInput [value]="theme() ?? ''" (change)="list.setFilter('tema', valueOf($event) || null)" data-role="theme-filter">
            <option value="">Todos os temas</option>
            <optgroup label="Grupos">
              @for (t of groupThemes; track t) {
                <option [value]="t" [selected]="theme() === t">{{ themeLabel(t) }}</option>
              }
            </optgroup>
            <optgroup label="Capacitações">
              @for (t of trainingThemes; track t) {
                <option [value]="t" [selected]="theme() === t">{{ themeLabel(t) }}</option>
              }
            </optgroup>
          </select>
        </app-form-field>
      </div>

      @if (view() === 'lista') {
        <app-data-table
          caption="Programação de grupos e capacitações"
          noun="atividades"
          [rows]="rows()"
          [columns]="columns"
          [filtersActive]="activeFilters().length > 0 || list.search() !== ''"
          [sort]="list.sort()"
          (sortChange)="list.setSort($event)"
          [search]="list.search()"
          (searchChange)="list.search.set($event)"
          searchable
          rowClickable
          emptyTitle="Nenhuma atividade encontrada"
          emptyText="Tire um filtro ou crie uma atividade nova para a programação do mês."
          (rowClick)="open($event)"
          (filtersCleared)="list.clear()"
        >
          <ng-template appCell="title" let-row>
            <span class="col-primary">{{ row.title }}</span>
            <span class="t-caption"> {{ row.theme }}</span>
          </ng-template>
          <ng-template appCell="character" let-row>
            <app-badge [variant]="row.kind === 'group_therapy' ? 'gold' : 'info'" [icon]="row.kind === 'group_therapy' ? 'heart-pulse' : 'book-open'">{{ row.character }}</app-badge>
          </ng-template>
          <ng-template appCell="status" let-row>
            <app-badge [variant]="statusView(row.status).variant" [icon]="statusView(row.status).icon">{{ statusView(row.status).label }}</app-badge>
          </ng-template>
          <ng-template appCell="actions" let-row let-selecting="selecting">
            <button type="button" class="btn btn--sm" [disabled]="selecting" (click)="open(row)">Abrir</button>
          </ng-template>
        </app-data-table>
        <app-active-filters [filters]="activeFilters()" (removed)="list.setFilter($event, null)" (cleared)="list.clear()" />
      } @else {
        <section class="stack stack--3" aria-label="Calendário do mês">
          <div class="cluster cluster--between">
            <strong class="t-ui" aria-live="polite" data-role="month-label">{{ monthLabel() }}</strong>
            <div class="cluster">
              <button type="button" class="btn btn--sm" (click)="shiftMonth(-1)"><svg appIcon="chevron-left" size="sm"></svg>Mês anterior</button>
              <button type="button" class="btn btn--sm" (click)="shiftMonth(1)">Próximo mês<svg appIcon="chevron-right" size="sm"></svg></button>
            </div>
          </div>
          @if (calendar().length === 0) {
            <app-empty-state title="Nenhum encontro neste mês" text="Nenhuma atividade tem encontro marcado neste mês com os filtros atuais." />
          } @else {
            <ul class="list-card" role="list" data-role="calendar">
              @for (item of calendar(); track item.key) {
                <li>
                  <button type="button" class="list-row" (click)="goTo(item.id)">
                    <span class="t-num">{{ item.when }}</span>&ngsp;
                    <span>
                      <span class="list-row__title">{{ item.title }}</span>
                      <span class="list-row__meta">{{ item.kindText }} · {{ item.character }}</span>
                    </span>&ngsp;
                    <app-badge [variant]="statusView(item.status).variant" [icon]="statusView(item.status).icon">{{ statusView(item.status).label }}</app-badge>
                  </button>
                </li>
              }
            </ul>
          }
        </section>
      }
    </div>
  `,
})
export class ProgramPageComponent {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly auth = inject(AuthService);
  private readonly svc = inject(GroupsService);
  private readonly membership = inject(GroupMembershipService);
  private readonly router = inject(Router);

  protected readonly valueOf = valueOf;
  protected readonly views = VIEWS;
  protected readonly kindOptions = KIND_OPTIONS;
  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly placeOptions = PLACE_OPTIONS;
  protected readonly whoOptions: FilterOption[] = [
    { value: 'meus', label: 'Meus grupos' },
    { value: 'todos', label: 'Todos' },
  ];
  protected readonly groupThemes = GROUP_THEMES;
  protected readonly trainingThemes = TRAINING_THEMES;
  protected readonly list = createListState({
    key: 'groups',
    filterKeys: ['tipo', 'tema', 'estado', 'local', 'quem', 'visao'],
    defaultSort: { key: 'next', direction: 'asc' } satisfies TableSort,
  });

  protected readonly isPsychologist = computed(() => this.auth.role() === 'psychologist');
  protected readonly canCreate = computed(() => this.svc.canCreate());
  protected readonly canSeeIndicators = computed(() => this.auth.hasRole('partner', 'psychologist', 'technical_lead'));
  protected readonly view = computed<'lista' | 'calendario'>(() => (this.list.filters()['visao'] === 'calendario' ? 'calendario' : 'lista'));
  protected readonly kind = computed<string | null>(() => this.list.filters()['tipo'] ?? null);
  protected readonly status = computed<string | null>(() => this.list.filters()['estado'] ?? null);
  protected readonly place = computed<string | null>(() => this.list.filters()['local'] ?? null);
  protected readonly theme = computed<string | null>(() => this.list.filters()['tema'] ?? null);
  protected readonly who = computed<string | null>(() => (this.isPsychologist() ? (this.list.filters()['quem'] ?? 'meus') : null));
  private readonly month = signal(this.clock.today().slice(0, 7));

  protected readonly columns: TableColumn<ActivityRow>[] = [
    { key: 'title', header: 'Atividade', primary: true, sortable: true, searchText: (r) => `${r.title} ${r.theme} ${r.kindText}` },
    { key: 'kindText', header: 'Tipo', sortable: true, noSearch: true },
    { key: 'character', header: 'Caráter', sortable: true, noSearch: true },
    { key: 'status', header: 'Estado', sortable: true, sortValue: (r) => ACTIVITY_STATUS_VIEW[r.status].label, noSearch: true },
    { key: 'nextText', header: 'Próximo encontro', sortable: true, sortValue: (r) => r.next || '9999', noSearch: true },
    { key: 'seats', header: 'Vagas', noSearch: true },
    { key: 'leaders', header: 'Responsável', sortable: true },
    { key: 'actions', header: 'Ações', actions: true },
  ];

  private readonly filtered = computed<Activity[]>(() => {
    // O estado se corrige sozinho quando a mudança de plano tirou alguém da turma (RN-GRP-17).
    this.db.subscriptions.all();
    const kind = this.kind();
    const status = this.status();
    const place = this.place();
    const theme = this.theme();
    const who = this.who();
    return this.db.activities.all().filter((a) => {
      if (kind && a.kind !== kind) {
        return false;
      }
      if (status && a.status !== status) {
        return false;
      }
      if (place && a.mode !== place) {
        return false;
      }
      if (theme && a.theme !== theme) {
        return false;
      }
      if (who === 'meus' && !this.svc.leads(a)) {
        return false;
      }
      return true;
    });
  });

  protected readonly rows = computed<ActivityRow[]>(() =>
    this.filtered().map((a) => {
      const next = this.svc.nextMeeting(a);
      const stats = this.svc.statsOf(a);
      const full = a.status === 'full' || (stats.holders >= a.capacity && a.status !== 'finished' && a.status !== 'cancelled');
      return {
        id: a.id,
        title: a.title,
        kind: a.kind,
        kindText: KIND_LABELS[a.kind],
        theme: THEME_LABELS[a.theme],
        character: CHARACTER_LABELS[a.character],
        status: a.status,
        next: next?.startAt ?? '',
        nextText: next ? `${formatDate(next.startAt)} às ${formatTime(next.startAt)}` : 'Sem encontro a vir',
        seats: full
          ? `Lotado: ${stats.holders} de ${a.capacity}${stats.waitlisted > 0 ? `, ${stats.waitlisted} na lista de espera` : ''}`
          : `${stats.holders} de ${a.capacity} vagas`,
        leaders: a.leaders.map((l) => l.name).join(', '),
        place: `${MODE_LABELS[a.mode]}`,
      };
    }),
  );
  protected readonly count = computed(() => `${this.rows().length} ${this.rows().length === 1 ? 'atividade' : 'atividades'}`);

  protected readonly activeFilters = computed<ActiveFilter[]>(() => {
    const filters: ActiveFilter[] = [];
    if (this.kind()) {
      filters.push({ key: 'tipo', label: `Tipo: ${KIND_LABELS[this.kind() as Activity['kind']] ?? ''}` });
    }
    if (this.status()) {
      filters.push({ key: 'estado', label: `Estado: ${ACTIVITY_STATUS_VIEW[this.status() as Activity['status']]?.label ?? ''}` });
    }
    if (this.place()) {
      filters.push({ key: 'local', label: `Local: ${this.place() === 'online' ? 'On-line' : 'Presencial'}` });
    }
    if (this.theme()) {
      filters.push({ key: 'tema', label: `Tema: ${this.themeLabel(this.theme() as string)}` });
    }
    return filters;
  });

  protected readonly monthLabel = computed(() => formatYearMonth(this.month()));
  protected readonly calendar = computed(() => {
    const month = this.month();
    return this.filtered()
      .flatMap((a) =>
        a.meetings
          .filter((m) => m.startAt.slice(0, 7) === month)
          .map((m) => ({
            key: m.id,
            id: a.id,
            at: m.startAt,
            when: `${formatDate(m.startAt).slice(0, 5)} às ${formatTime(m.startAt)}`,
            title: a.title,
            kindText: KIND_LABELS[a.kind],
            character: CHARACTER_LABELS[a.character],
            status: a.status,
          })),
      )
      .sort((x, y) => x.at.localeCompare(y.at));
  });

  constructor() {
    this.membership.reconcileAll();
  }

  protected themeLabel(theme: string): string {
    return THEME_LABELS[theme as keyof typeof THEME_LABELS] ?? theme;
  }

  protected statusView(status: Activity['status']) {
    return ACTIVITY_STATUS_VIEW[status];
  }

  protected setView(view: 'lista' | 'calendario' | undefined): void {
    this.list.setFilter('visao', view === 'calendario' ? 'calendario' : null);
  }

  protected shiftMonth(direction: -1 | 1): void {
    this.month.set(addMonths(firstDayOfYearMonth(this.month()), direction).slice(0, 7));
  }

  protected open(row: ActivityRow): void {
    void this.router.navigate(['/app/grupos', row.id]);
  }

  protected goTo(id: string): void {
    void this.router.navigate(['/app/grupos', id]);
  }
}
