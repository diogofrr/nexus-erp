import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/auth';
import { Clock, daysBetween } from '@core/clock';
import { Database } from '@core/data';
import { formatDate, formatNumber } from '@core/format';
import { ArpBand, ProviderCategory, ProviderStatus } from '@core/models';
import { NetworkService, ProviderSummary } from '@core/network';
import { RefusalStats } from '@core/rules';
import {
  ActiveFilter,
  ActiveFiltersComponent,
  CellDirective,
  DataTableComponent,
  FilterChipsComponent,
  FilterOption,
  KpiComponent,
  KpiStripComponent,
  PageHeaderComponent,
  TableColumn,
  MOBILE_QUERY,
  createListState,
  mediaQuery,
} from '@shared/ui';
import { ArpBandComponent, ProviderStatusComponent, RefusalComponent } from '../components/badges.component';
import { NetworkAdminService } from '../state/network-admin.service';
import { categoryLabel, councilText } from '../state/network-labels';

interface ProviderRow {
  id: string;
  name: string;
  specialty: string;
  category: ProviderCategory;
  categoryText: string;
  status: ProviderStatus;
  average: number | null;
  averageText: string;
  evaluationCount: number;
  band: ArpBand;
  refusal: RefusalStats;
  refusalPercent: number;
  exitRisk: boolean;
  expiring: boolean;
  council: string;
  councilChecked: string;
  rank: number;
}

const STATE_GROUPS: Readonly<Record<string, readonly ProviderStatus[]>> = {
  ativo: ['active'],
  monitoramento: ['monitoring'],
  suspenso: ['suspended'],
  candidato: ['candidate'],
  encerrado: ['deaccredited', 'rejected'],
};

const STATE_OPTIONS: readonly FilterOption[] = [
  { value: 'ativo', label: 'Ativos' },
  { value: 'monitoramento', label: 'Em monitoramento' },
  { value: 'suspenso', label: 'Suspensos' },
  { value: 'candidato', label: 'Candidatos' },
  { value: 'encerrado', label: 'Encerrados' },
];

const ATTENTION_OPTIONS: readonly FilterOption[] = [
  { value: 'atencao', label: 'Precisa de atenção' },
  { value: 'risco-de-saida', label: 'Risco de saída' },
  { value: 'documento-vencendo', label: 'Documento vencendo ou vencido' },
  { value: 'excelencia', label: 'Em excelência' },
  { value: 'alerta', label: 'Em alerta' },
];

/** Prestadores que pedem atenção vêm primeiro (UX 5.1): suspenso, monitoramento, recusa alta, depois o nome. */
function attentionRank(row: Pick<ProviderRow, 'status' | 'exitRisk'>): number {
  if (row.status === 'suspended') {
    return 0;
  }
  if (row.status === 'monitoring') {
    return 1;
  }
  if (row.exitRisk) {
    return 2;
  }
  return row.status === 'active' ? 4 : 3;
}

/**
 * Prestadores (SCR-M08-01): a lista da rede com categoria, estado, nota, faixa, taxa de recusa e o selo "risco
 * de saída". O responsável técnico só vê as psicólogas e os psicólogos da rede, para validar o registro no CRP
 * (RN-REDE-04); nenhum outro dado de prestador chega a ele (escopo 1.3).
 */
@Component({
  selector: 'app-network-providers-page',
  imports: [
    RouterLink,
    ActiveFiltersComponent,
    ArpBandComponent,
    CellDirective,
    DataTableComponent,
    FilterChipsComponent,
    KpiComponent,
    KpiStripComponent,
    PageHeaderComponent,
    ProviderStatusComponent,
    RefusalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Prestadores" [count]="countText()" [description]="description()">
        @if (manager()) {
          <a class="btn btn--primary" routerLink="/app/rede/credenciamento/novo" data-role="new-process">
            Novo credenciamento
          </a>
        }
      </app-page-header>

      <div class="stack stack--6">
        @if (!limited()) {
          <app-kpi-strip aria-label="A rede em números">
            <app-kpi label="Ativos" [value]="kpis().active" context="na busca" />
            <app-kpi label="Em monitoramento" [value]="kpis().monitoring" context="na busca, com acompanhamento" />
            <app-kpi label="Suspensos" [value]="kpis().suspended" context="fora da busca" />
            <app-kpi label="Risco de saída" [value]="kpis().exitRisk" context="recusa alta em 30 dias" />
          </app-kpi-strip>
        }

        <app-data-table
          [caption]="limited() ? 'Psicólogas e psicólogos da rede' : 'Prestadores da rede credenciada'"
          noun="prestadores"
          [rows]="visibleRows()"
          [columns]="columns()"
          searchable
          searchLabel="Buscar prestador"
          searchPlaceholder="Buscar por nome ou especialidade"
          rowClickable
          [sort]="list.sort()"
          [filtersActive]="list.hasActive()"
          emptyTitle="Nenhum prestador por aqui"
          emptyText="Quando houver prestadores nesta lista, eles aparecem aqui com nota, faixa e taxa de recusa."
          (sortChange)="list.setSort($event)"
          (rowClick)="open($event)"
          (filtersCleared)="list.clear()"
        >
          @if (!limited()) {
            <div appTableFilters class="stack stack--2">
              <details class="filters-sheet" data-role="filters" [open]="!narrow()">
                <summary class="t-strong">Filtros{{ activeFilters().length > 0 ? ' (' + activeFilters().length + ')' : '' }}</summary>
                <div class="stack stack--2 mt-2">
                  <app-filter-chips
                    label="Estado"
                    [options]="stateOptions"
                    [value]="list.filters()['estado'] ?? null"
                    (valueChange)="list.setFilter('estado', $event)"
                  />
                  <app-filter-chips
                    label="Visão"
                    [options]="attentionOptions"
                    [value]="list.filters()['filtro'] ?? null"
                    allLabel="Qualquer situação"
                    (valueChange)="list.setFilter('filtro', $event)"
                  />
                  <label class="cluster">
                    <span class="t-caption">Categoria</span>
                    <select
                      class="select select--sm"
                      aria-label="Categoria"
                      data-role="category-filter"
                      (change)="onCategory($event)"
                    >
                      <option value="" [selected]="!list.filters()['categoria']">Todas as categorias</option>
                      @for (option of categoryOptions(); track option.value) {
                        <option [value]="option.value" [selected]="list.filters()['categoria'] === option.value">
                          {{ option.label }}
                        </option>
                      }
                    </select>
                  </label>
                </div>
              </details>
            </div>
          }

          <ng-template appCell="name" let-row>
            <div>
              <a class="row-link" [routerLink]="['/app/rede/prestadores', row.id]">{{ row.name }}</a>
              <span class="t-caption block">{{ row.specialty }}</span>
            </div>
          </ng-template>
          <ng-template appCell="status" let-row><app-provider-status [status]="row.status" /></ng-template>
          <ng-template appCell="average" let-row>
            @if (row.average === null) {
              <span class="t-muted">Sem média</span>
              @if (row.evaluationCount > 0) {
                <span class="t-caption block t-nowrap">{{ row.evaluationCount }} de 5 avaliações</span>
              }
            } @else {
              <span class="t-num">{{ row.averageText }}</span>
              <span class="t-caption block t-nowrap">{{ row.evaluationCount }} avaliações</span>
            }
          </ng-template>
          <ng-template appCell="band" let-row>
            @if (row.evaluationCount > 0 || row.band === 'deaccreditation') {
              <app-arp-band [band]="row.band" />
            } @else {
              <span class="t-muted">Ainda sem avaliações</span>
            }
          </ng-template>
          <ng-template appCell="refusal" let-row><app-refusal [stats]="row.refusal" /></ng-template>
          <ng-template appCell="actions" let-row>
            <a class="btn btn--sm" [routerLink]="['/app/rede/prestadores', row.id]">Abrir</a>
          </ng-template>
        </app-data-table>

        <app-active-filters
          [filters]="activeFilters()"
          (removed)="list.setFilter($event, null)"
          (cleared)="list.clear()"
        />
      </div>
    </div>
  `,
})
export class ProvidersPage {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly network = inject(NetworkService);
  private readonly admin = inject(NetworkAdminService);

  readonly list = createListState({
    key: 'network-providers',
    filterKeys: ['estado', 'categoria', 'filtro'],
  });

  protected readonly narrow = mediaQuery(MOBILE_QUERY);
  protected readonly stateOptions = STATE_OPTIONS;
  protected readonly attentionOptions = ATTENTION_OPTIONS;
  protected readonly manager = computed(() => this.admin.isManager());
  /** O responsável técnico só vê quem precisa validar (psicologia). */
  protected readonly limited = computed(() => this.auth.hasRole('technical_lead'));

  private readonly allRows = computed<ProviderRow[]>(() => {
    const limited = this.limited();
    return this.network
      .summaries()
      .filter((s) => !limited || s.provider.category === 'psychology')
      .map((s) => this.toRow(s))
      .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, 'pt-BR'));
  });

  protected readonly visibleRows = computed(() => {
    const { estado, categoria, filtro } = this.list.filters();
    return this.allRows().filter((row) => {
      if (estado && !(STATE_GROUPS[estado] ?? []).includes(row.status)) {
        return false;
      }
      if (categoria && row.category !== categoria) {
        return false;
      }
      if (filtro === 'risco-de-saida') {
        return row.exitRisk;
      }
      if (filtro === 'documento-vencendo') {
        return row.expiring;
      }
      if (filtro === 'excelencia' || filtro === 'alerta') {
        // Só quem aparece na busca (ativo ou em monitoramento), como a contagem do painel da gestão.
        const band: ArpBand = filtro === 'excelencia' ? 'excellence' : 'alert';
        return row.band === band && (row.status === 'active' || row.status === 'monitoring');
      }
      if (filtro === 'atencao') {
        return row.rank <= 2 || row.expiring;
      }
      return true;
    });
  });

  protected readonly kpis = computed(() => {
    const rows = this.allRows();
    const count = (status: ProviderStatus): string =>
      formatNumber(rows.filter((r) => r.status === status).length);
    return {
      active: count('active'),
      monitoring: count('monitoring'),
      suspended: count('suspended'),
      exitRisk: formatNumber(rows.filter((r) => r.exitRisk && (r.status === 'active' || r.status === 'monitoring')).length),
    };
  });

  protected readonly categoryOptions = computed<FilterOption[]>(() => {
    const present = new Set(this.allRows().map((r) => r.category));
    return [...present]
      .map((value) => ({ value, label: categoryLabel(value) }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  });

  protected readonly countText = computed(() => {
    const n = this.visibleRows().length;
    return `${n} ${n === 1 ? 'prestador' : 'prestadores'}`;
  });

  protected readonly description = computed(() =>
    this.limited()
      ? 'Psicólogas e psicólogos da rede. Você valida o registro no conselho de cada um.'
      : 'Quem aparece na busca, como vai na avaliação e quem precisa da sua atenção.',
  );

  protected readonly activeFilters = computed<ActiveFilter[]>(() => {
    const { estado, categoria, filtro } = this.list.filters();
    const out: ActiveFilter[] = [];
    const state = STATE_OPTIONS.find((o) => o.value === estado);
    if (state) {
      out.push({ key: 'estado', label: `Estado: ${state.label}` });
    }
    if (categoria) {
      out.push({ key: 'categoria', label: `Categoria: ${categoryLabel(categoria as ProviderCategory)}` });
    }
    const attention = ATTENTION_OPTIONS.find((o) => o.value === filtro);
    if (attention) {
      out.push({ key: 'filtro', label: attention.label });
    }
    return out;
  });

  protected readonly columns = computed<TableColumn<ProviderRow>[]>(() =>
    this.limited()
      ? [
          { key: 'name', header: 'Prestador', primary: true, sortable: true, value: (r) => r.name },
          { key: 'categoryText', header: 'Categoria', value: (r) => r.categoryText },
          { key: 'status', header: 'Estado', noSearch: true },
          { key: 'council', header: 'Conselho', value: (r) => r.council },
          { key: 'councilChecked', header: 'Registro', value: (r) => r.councilChecked },
          { key: 'actions', header: 'Ações', actions: true, noSearch: true },
        ]
      : [
          { key: 'name', header: 'Prestador', primary: true, sortable: true, value: (r) => `${r.name} ${r.specialty}` , sortValue: (r) => r.name },
          { key: 'categoryText', header: 'Categoria', sortable: true, value: (r) => r.categoryText },
          { key: 'status', header: 'Estado', noSearch: true },
          { key: 'average', header: 'Nota', sortable: true, noSearch: true, align: 'end', sortValue: (r) => r.average },
          { key: 'band', header: 'Faixa', noSearch: true },
          { key: 'refusal', header: 'Recusa em 30 dias', sortable: true, noSearch: true, sortValue: (r) => r.refusalPercent },
          { key: 'actions', header: 'Ações', actions: true, noSearch: true },
        ],
  );

  private toRow(summary: ProviderSummary): ProviderRow {
    const { provider } = summary;
    const accreditation = this.admin.accreditationOf(provider.id);
    const council = accreditation?.checklist.council_registry;
    const exitRisk = summary.refusal.exitRisk && (provider.status === 'active' || provider.status === 'monitoring');
    const base = { status: provider.status, exitRisk };
    const expiringSoon = this.db.providerDocuments.count(
      (d) =>
        d.providerId === provider.id &&
        (provider.status === 'active' || provider.status === 'monitoring') &&
        d.validUntil !== undefined &&
        daysBetween(this.clock.today(), d.validUntil) <= 30,
    );
    return {
      id: provider.id,
      name: provider.name,
      specialty: provider.specialtyLabel,
      category: provider.category,
      categoryText: categoryLabel(provider.category),
      status: provider.status,
      average: summary.average,
      averageText: summary.average === null ? '' : formatNumber(summary.average, 2),
      evaluationCount: summary.evaluationCount,
      band: summary.band,
      refusal: summary.refusal,
      refusalPercent: summary.refusal.percent ?? -1,
      exitRisk,
      expiring: expiringSoon > 0,
      council: `${councilText(provider.council)}${provider.council.validUntil ? `, válido até ${formatDate(provider.council.validUntil)}` : ''}`,
      councilChecked:
        council?.status === 'ok'
          ? `Validado${council.checkedAt ? ` em ${formatDate(council.checkedAt)}` : ''}`
          : 'A validar',
      rank: attentionRank(base),
    };
  }

  protected onCategory(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.list.setFilter('categoria', value || null);
  }

  protected open(row: ProviderRow): void {
    void this.router.navigate(['/app/rede/prestadores', row.id]);
  }
}
