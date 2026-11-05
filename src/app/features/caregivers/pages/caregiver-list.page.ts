import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/auth';
import { Database } from '@core/data';
import { downloadTextFile } from '@core/export/file-download';
import type { ID, PlanId } from '@core/models';
import { canSeeCaregiverIdentity } from '@core/privacy/caregiver-label';
import {
  ActiveFilter,
  ActiveFiltersComponent,
  BadgeComponent,
  CellDirective,
  DataTableComponent,
  FilterChipsComponent,
  FilterOption,
  IconComponent,
  PLAN_NAMES,
  PageHeaderComponent,
  PlanBadgeComponent,
  MOBILE_QUERY,
  RowKey,
  TableColumn,
  TableDensity,
  createListState,
  filterRows,
  mediaQuery,
} from '@shared/ui';
import { ToastService } from '@shared/ui/overlay';
import { ShortcutService } from '@layout/shortcuts/shortcut.service';
import { CaregiverDirectory, CaregiverRow, scaleSortValue } from '../state/caregiver-directory.service';
import { STATUS_BADGES, STATUS_SHORT_LABELS } from '../state/caregiver-labels';
import { CaregiverService } from '../state/caregiver.service';
import { SubscriptionService } from '@core/commerce/subscription.service';
import type { CaregiverStatus } from '@core/models';

const PLAN_IDS: readonly PlanId[] = ['livre', 'essencial', 'cuida', 'sustenta'];
const STATUS_IDS: readonly CaregiverStatus[] = ['active', 'paused_by_consent_revocation', 'closure_requested', 'closed'];

/** Visões prontas da lista (UX 5.1). A chave também vem das notificações (`?filtro=`). */
const VIEWS: readonly { value: string; label: string; partner: boolean }[] = [
  { value: 'pendentes', label: 'Aplicação da escala pendente', partner: false },
  { value: 'sem-consentimento', label: 'Sem consentimento de saúde', partner: false },
  { value: 'sem-psicologo', label: 'Sem psicólogo responsável', partner: false },
  { value: 'encerramento', label: 'Encerramento pedido', partner: true },
];

/**
 * SCR-M03-01 Lista de cuidadores (PD-01). Filtros e ordem na URL, busca em memória, 25 por página, seleção
 * para ações seguras (exportar, atribuir psicólogo pelo RT). A gestão vê só código, plano, situação e
 * piloto; o atendimento e o responsável técnico veem nome e telefone mascarado; o psicólogo só lista os
 * cuidadores dele. A escala aparece só como "pendente" ou "em dia" (E-05).
 */
@Component({
  selector: 'app-caregiver-list-page',
  imports: [
    ActiveFiltersComponent,
    BadgeComponent,
    CellDirective,
    DataTableComponent,
    FilterChipsComponent,
    IconComponent,
    NgTemplateOutlet,
    PageHeaderComponent,
    PlanBadgeComponent,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      <app-page-header [title]="heading()" [count]="countText()" [description]="description()">
        @if (canCreate()) {
          <a class="btn btn--primary" routerLink="novo"><svg appIcon="plus"></svg>Novo cuidador</a>
        }
      </app-page-header>

      @if (partner()) {
        <p class="t-caption">A gestão vê códigos para proteger a privacidade dos cuidadores. Isso é uma regra do produto.</p>
      }

      <ng-template #filterGroups>
        <div class="cluster cluster--4" role="group" aria-label="Filtros da lista">
        <div class="stack stack--2"><span class="t-ui t-strong">Plano</span><app-filter-chips label="Plano" [options]="planOptions()" [value]="plan()" (valueChange)="list.setFilter('plano', $event)" [allCount]="total()" /></div>
        <div class="stack stack--2"><span class="t-ui t-strong">Situação</span><app-filter-chips label="Situação" [options]="statusOptions()" [value]="status()" (valueChange)="list.setFilter('status', $event)" allLabel="Todas" /></div>
        <div class="stack stack--2"><span class="t-ui t-strong">Piloto</span><app-filter-chips label="Piloto" [options]="pilotOptions" [value]="pilot()" (valueChange)="list.setFilter('piloto', $event)" allLabel="Todos" /></div>
        @if (identified() && cities().length > 1) {
          <label class="cluster">
            <span class="t-ui">Cidade</span>
            <select class="select select--sm" (change)="onCity($event)">
              <option value="" [selected]="!city()">Todas</option>
              @for (name of cities(); track name) {
                <option [value]="name" [selected]="city() === name">{{ name }}</option>
              }
            </select>
          </label>
        }
        <label class="cluster">
          <span class="t-ui">Mostrar</span>
          <select class="select select--sm" (change)="onView($event)">
            <option value="" [selected]="!view()">Todos os cuidadores</option>
            @for (item of views(); track item.value) {
              <option [value]="item.value" [selected]="view() === item.value">{{ item.label }}</option>
            }
          </select>
        </label>
        </div>
      </ng-template>
      @if (mobile()) {
        <details class="card card--pad" data-role="filters-sheet">
          <summary class="btn btn--sm">Filtros ({{ activeFilters().length }})</summary>
          <div class="mt-3"><ng-container *ngTemplateOutlet="filterGroups" /></div>
        </details>
      } @else {
        <ng-container *ngTemplateOutlet="filterGroups" />
      }
      <app-active-filters [filters]="activeFilters()" (removed)="list.setFilter($event, null)" (cleared)="clearFilters()" />

      <p class="t-caption">A exportação não inclui nome, CPF, telefone, e-mail nem dados de saúde.</p>

      <app-data-table
        caption="Cuidadores cadastrados"
        noun="cuidadores"
        [rows]="filtered()"
        [columns]="columns()"
        [state]="state()"
        [rowLabel]="rowLabel"
        [filtersActive]="list.hasActive()"
        [sort]="list.sort()"
        (sortChange)="list.setSort($event)"
        [search]="list.search()"
        (searchChange)="list.search.set($event)"
        [page]="list.page()"
        (pageChange)="list.setPage($event)"
        [(selection)]="selection"
        [(density)]="density"
        searchable
        selectable
        rowClickable
        densityToggle
        searchLabel="Buscar na lista"
        [searchPlaceholder]="partner() ? 'Buscar por código, por exemplo CUI-0001' : 'Buscar por nome ou código'"
        emptyTitle="Nenhum cuidador por aqui"
        [emptyText]="emptyText()"
        (rowClick)="open($event)"
        (retry)="state.set('ready')"
        (filtersCleared)="clearFilters()"
      >
        <button appTableActions type="button" class="btn btn--sm" (click)="exportCsv()">
          <svg appIcon="download" size="sm"></svg>Exportar CSV
        </button>
        <div appBulkActions class="cluster">
          <button type="button" class="btn btn--sm" (click)="exportCsv(true)">Exportar seleção (CSV)</button>
          @if (canAssign()) {
            <label class="cluster">
              <span class="sr-only">Psicólogo responsável</span>
              <select class="select select--sm" aria-label="Psicólogo responsável" (change)="onPsychologist($event)">
                <option value="">Escolha o psicólogo</option>
                @for (p of psychologists(); track p.id) {
                  <option [value]="p.id">{{ p.displayName }}</option>
                }
              </select>
            </label>
            <button type="button" class="btn btn--sm btn--primary" [attr.aria-disabled]="!chosenPsychologist()" (click)="assignSelected()">
              Atribuir psicólogo
            </button>
            @if (!chosenPsychologist()) {
              <span class="t-caption">Escolha o psicólogo ao lado.</span>
            }
          }
        </div>
        <ng-template appCell="person" let-row>
          @if (row.name) {
            <span class="col-primary discreet">{{ row.name }}</span>
            <span class="code-chip">{{ row.code }}</span>
          } @else {
            <span class="code-chip">{{ row.code }}</span>
            <span class="sr-only">(código pseudonimizado)</span>
          }
        </ng-template>
        <ng-template appCell="plan" let-row><app-plan-badge [plan]="row.planId" /></ng-template>
        <ng-template appCell="status" let-row>
          <app-badge [variant]="statusBadge(row).variant" [icon]="statusBadge(row).icon">{{ statusLabel(row) }}</app-badge>
        </ng-template>
        <ng-template appCell="scale" let-row>
          <app-badge [variant]="row.scale.kind === 'pending' ? 'attention' : row.scale.kind === 'up_to_date' ? 'success' : 'neutral'" [outline]="row.scale.kind === 'none' || row.scale.kind === 'no_consent'" dot>
            {{ row.scale.label }}
          </app-badge>
        </ng-template>
        <ng-template appCell="pilot" let-row>
          @if (row.isPilot) {
            <app-badge variant="info" icon="activity">Participa</app-badge>
          } @else {
            <span class="t-muted">Não</span>
          }
        </ng-template>
        <ng-template appCell="psychologist" let-row>
          @if (row.psychologistName) {
            {{ row.psychologistName }}
          } @else {
            <app-badge variant="attention" outline dot>A atribuir</app-badge>
          }
        </ng-template>
        <ng-template appCell="actions" let-row let-selecting="selecting">
          <button type="button" class="btn btn--sm" [disabled]="selecting" [attr.aria-label]="'Abrir cuidador ' + row.code" (click)="open(row)">Abrir</button>
        </ng-template>
      </app-data-table>
    </div>
  `,
})
export class CaregiverListPage {
  private readonly auth = inject(AuthService);
  private readonly db = inject(Database);
  private readonly router = inject(Router);
  private readonly doc = inject(DOCUMENT);
  private readonly toasts = inject(ToastService);
  private readonly service = inject(CaregiverService);
  private readonly directory = inject(CaregiverDirectory);
  private readonly subscriptions = inject(SubscriptionService);

  protected readonly role = this.auth.role;
  protected readonly mobile = mediaQuery(MOBILE_QUERY);
  protected readonly partner = computed(() => this.role() === 'partner');
  protected readonly identified = computed(() => canSeeCaregiverIdentity(this.role()));
  protected readonly canCreate = computed(() => this.auth.can('caregiver_registry', 'create'));
  protected readonly canAssign = computed(() => this.role() === 'technical_lead');

  protected readonly list = createListState({
    key: 'caregivers',
    filterKeys: ['plano', 'status', 'piloto', 'cidade', 'filtro'],
    defaultSort: { key: 'person', direction: 'asc' },
  });
  protected readonly state = signal<'ready' | 'loading' | 'error' | 'forbidden'>('ready');
  protected readonly selection = signal<readonly RowKey[]>([]);
  protected readonly density = signal<TableDensity>('comfortable');
  protected readonly chosenPsychologist = signal<ID | null>(null);

  protected readonly pilotOptions: FilterOption[] = [
    { value: 'sim', label: 'Participa' },
    { value: 'nao', label: 'Não participa' },
  ];
  protected readonly rowLabel = (row: CaregiverRow): string => row.code;

  protected readonly plan = computed(() => this.list.filters()['plano'] ?? null);
  protected readonly status = computed(() => this.list.filters()['status'] ?? null);
  protected readonly pilot = computed(() => this.list.filters()['piloto'] ?? null);
  protected readonly city = computed(() => this.list.filters()['cidade'] ?? null);
  protected readonly view = computed(() => this.list.filters()['filtro'] ?? null);

  protected readonly all = this.directory.rows;
  protected readonly total = computed(() => this.all().length);
  protected readonly psychologists = this.directory.psychologists;
  protected readonly views = computed(() => VIEWS.filter((v) => !this.partner() || v.partner));
  protected readonly cities = computed(() => [...new Set(this.all().map((r) => r.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')));

  protected readonly heading = computed(() => (this.role() === 'psychologist' ? 'Meus cuidadores' : 'Cuidadores'));
  protected readonly description = computed(() =>
    this.role() === 'psychologist' ? `Mostrando seus ${this.total()} cuidadores.` : undefined,
  );

  protected readonly planOptions = computed<FilterOption[]>(() =>
    PLAN_IDS.map((id) => ({ value: id, label: PLAN_NAMES[id], count: this.all().filter((r) => r.planId === id).length })),
  );
  protected readonly statusOptions = computed<FilterOption[]>(() =>
    STATUS_IDS.map((id) => ({
      value: id,
      label: STATUS_SHORT_LABELS[id],
      count: this.all().filter((r) => r.status === id).length,
    })),
  );

  /** Linhas depois dos filtros em chips (a busca por texto é da tabela). */
  protected readonly filtered = computed<CaregiverRow[]>(() => {
    const f = this.list.filters();
    return this.all().filter(
      (r) =>
        (!f['plano'] || r.planId === f['plano']) &&
        (!f['status'] || r.status === f['status']) &&
        (!f['piloto'] || (f['piloto'] === 'sim') === r.isPilot) &&
        (!f['cidade'] || r.city === f['cidade']) &&
        this.matchesView(r, f['filtro']),
    );
  });

  protected readonly countText = computed(() => {
    const n = this.filtered().length;
    return `${n} ${n === 1 ? 'cuidador' : 'cuidadores'}`;
  });

  protected readonly activeFilters = computed<ActiveFilter[]>(() => {
    const out: ActiveFilter[] = [];
    if (this.plan()) {
      out.push({ key: 'plano', label: `Plano: ${PLAN_NAMES[this.plan() as PlanId] ?? this.plan()}` });
    }
    if (this.status()) {
      out.push({ key: 'status', label: `Situação: ${STATUS_SHORT_LABELS[this.status() as CaregiverStatus] ?? this.status()}` });
    }
    if (this.pilot()) {
      out.push({ key: 'piloto', label: `Piloto: ${this.pilot() === 'sim' ? 'participa' : 'não participa'}` });
    }
    if (this.city()) {
      out.push({ key: 'cidade', label: `Cidade: ${this.city()}` });
    }
    const view = VIEWS.find((v) => v.value === this.view());
    if (view) {
      out.push({ key: 'filtro', label: view.label });
    }
    return out;
  });

  protected readonly emptyText = computed(() =>
    this.canCreate()
      ? 'Quando houver cuidadores, eles aparecem aqui. Use "Novo cuidador" para fazer o primeiro cadastro.'
      : 'Quando houver cuidadores, eles aparecem aqui.',
  );

  protected readonly columns = computed<TableColumn<CaregiverRow>[]>(() => {
    const person: TableColumn<CaregiverRow> = {
      key: 'person',
      header: this.partner() ? 'Código' : 'Cuidador',
      primary: true,
      sortable: true,
      sortValue: (r) => (this.partner() ? r.code : (r.name ?? r.code)),
      searchText: (r) => `${r.name ?? ''} ${r.code}`,
    };
    const plan: TableColumn<CaregiverRow> = {
      key: 'plan',
      header: 'Plano',
      sortable: true,
      sortValue: (r) => PLAN_IDS.indexOf(r.planId),
      noSearch: true,
    };
    const status: TableColumn<CaregiverRow> = {
      key: 'status',
      header: 'Situação',
      sortable: true,
      sortValue: (r) => STATUS_IDS.indexOf(r.status),
      noSearch: true,
    };
    const pilot: TableColumn<CaregiverRow> = { key: 'pilot', header: 'Piloto', sortable: true, sortValue: (r) => (r.isPilot ? 0 : 1), noSearch: true };
    const actions: TableColumn<CaregiverRow> = { key: 'actions', header: 'Ações', actions: true };
    if (this.partner()) {
      return [person, plan, status, pilot, { key: 'enrolledAt', header: 'Adesão', sortable: true, noSearch: true, value: (r) => r.enrolledAt.split('-').reverse().join('/'), sortValue: (r) => r.enrolledAt }, actions];
    }
    const base: TableColumn<CaregiverRow>[] = [
      person,
      plan,
      status,
      { key: 'scale', header: 'Aplicação da escala', sortable: true, sortValue: (r) => scaleSortValue(r.scale), noSearch: true },
      { key: 'city', header: 'Cidade', sortable: true, noSearch: true },
      { key: 'phone', header: 'Telefone', noSearch: true },
      pilot,
    ];
    if (this.role() !== 'psychologist') {
      base.push({ key: 'psychologist', header: 'Psicólogo', sortable: true, sortValue: (r) => r.psychologistName ?? '', noSearch: true });
    }
    return [...base, actions];
  });

  constructor() {
    // Ao abrir a lista, o que venceu pelo relógio (inclusive o simulado) passa a valer.
    this.subscriptions.applyDueChanges();
    const host = inject<ElementRef<HTMLElement>>(ElementRef);
    // A tecla "/" foca a busca da lista e "N" abre o cadastro novo (só para quem cadastra).
    afterNextRender(() => host.nativeElement.querySelector('input[type="search"]')?.setAttribute('data-search-field', ''));
    inject(ShortcutService)
      .page$.pipe(takeUntilDestroyed())
      .subscribe(({ id, event }) => {
        if (id === 'list-new' && this.canCreate()) {
          event.preventDefault();
          void this.router.navigate(['/app/cuidadores/novo']);
        }
      });
  }

  protected statusBadge(row: CaregiverRow): (typeof STATUS_BADGES)[CaregiverStatus] {
    return STATUS_BADGES[row.status];
  }

  protected statusLabel(row: CaregiverRow): string {
    return STATUS_SHORT_LABELS[row.status];
  }

  private matchesView(row: CaregiverRow, view: string | undefined): boolean {
    switch (view) {
      case 'pendentes':
        return row.scale.kind === 'pending';
      case 'sem-consentimento':
        return row.scale.kind === 'no_consent';
      case 'sem-psicologo':
        return row.psychologistId === null && row.status !== 'closed';
      case 'encerramento':
        return row.status === 'closure_requested';
      default:
        return true;
    }
  }

  protected onCity(event: Event): void {
    this.list.setFilter('cidade', (event.target as HTMLSelectElement).value || null);
  }

  protected onView(event: Event): void {
    this.list.setFilter('filtro', (event.target as HTMLSelectElement).value || null);
  }

  protected onPsychologist(event: Event): void {
    this.chosenPsychologist.set((event.target as HTMLSelectElement).value || null);
  }

  protected clearFilters(): void {
    this.list.clear();
    this.selection.set([]);
  }

  protected open(row: CaregiverRow): void {
    void this.router.navigate(['/app/cuidadores', row.id]);
  }

  /** Nível 1 (UX 5.8): atribui, avisa com "Desfazer". Só o responsável técnico atribui (AC-M03-14). */
  protected assignSelected(): void {
    const psychologistId = this.chosenPsychologist();
    const ids = this.selection().map(String);
    if (!this.canAssign() || !psychologistId || ids.length === 0) {
      return;
    }
    const previous = this.service.assignPsychologist(ids, psychologistId);
    const name = this.db.psychologists.get(psychologistId)?.displayName ?? 'o psicólogo';
    this.selection.set([]);
    this.toasts.show({
      message: `${ids.length} ${ids.length === 1 ? 'cuidador atribuído' : 'cuidadores atribuídos'} a ${name}.`,
      action: { label: 'Desfazer', run: () => this.service.restoreAssignments(previous) },
    });
  }

  /** Exporta a lista visível (ou só a seleção) sem dados sensíveis (LP-12). */
  protected exportCsv(onlySelection = false): void {
    const term = this.list.search();
    let rows = term ? filterRows(this.filtered(), this.columns(), term) : this.filtered();
    if (onlySelection) {
      const keys = new Set(this.selection().map(String));
      rows = rows.filter((r) => keys.has(r.id));
    }
    const names = Object.fromEntries(PLAN_IDS.map((id) => [id, PLAN_NAMES[id]]));
    const ok = downloadTextFile(this.doc, 'cuidadores.csv', this.service.listCsv(rows, names), 'text/csv;charset=utf-8');
    this.toasts.show({
      message: ok
        ? `Lista exportada: ${rows.length} ${rows.length === 1 ? 'cuidador' : 'cuidadores'}, sem CPF, telefone, e-mail nem dados de saúde.`
        : 'Não foi possível baixar o arquivo neste navegador.',
      tone: ok ? 'success' : 'danger',
    });
  }
}

