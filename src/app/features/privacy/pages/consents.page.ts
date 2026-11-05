import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/auth';
import { Database } from '@core/data';
import type { ConsentKey, ConsentStatus, ID } from '@core/models';
import { caregiverLabel } from '@core/privacy/caregiver-label';
import { CONSENT_KEYS, isConsentOutdated } from '@core/rules';
import {
  ActiveFilter,
  ActiveFiltersComponent,
  BadgeComponent,
  BadgeVariant,
  CellDirective,
  DataTableComponent,
  FilterChipsComponent,
  FilterOption,
  PageHeaderComponent,
  TableColumn,
  createListState,
} from '@shared/ui';
import { DrawerComponent } from '@shared/ui/overlay';
import { ConsentManagerComponent } from '@shared/ui/consent/consent-manager.component';
import { LgpdNavComponent } from '../components/lgpd-nav.component';

interface Cell {
  status: ConsentStatus;
  outdated: boolean;
}

interface ConsentRow {
  id: ID;
  code: string;
  label: string;
  pseudonymized: boolean;
  cells: Record<ConsentKey, Cell>;
  revoked: boolean;
  pending: boolean;
  refused: boolean;
  outdated: boolean;
}

const SHORT: Record<ConsentKey, string> = {
  health_data: 'Saúde',
  people_analytics: 'Indicadores',
  family_sharing: 'Família',
  image_testimony: 'Imagem',
  whatsapp_contact: 'WhatsApp',
  pilot_tcle: 'Piloto',
};
const STATUS: Record<ConsentStatus, { variant: BadgeVariant; label: string; outline?: boolean }> = {
  granted: { variant: 'success', label: 'Ativo' },
  refused: { variant: 'neutral', label: 'Recusado', outline: true },
  revoked: { variant: 'danger', label: 'Revogado' },
  pending: { variant: 'attention', label: 'Pendente' },
};
const VIEWS: readonly { value: string; label: string }[] = [
  { value: 'revogados', label: 'Revogados' },
  { value: 'pendentes', label: 'Pendentes' },
  { value: 'recusados', label: 'Recusados' },
  { value: 'desatualizados', label: 'Desatualizados' },
];

/**
 * SCR-M12-01 Consentimentos: matriz de titulares por seis consentimentos, com filtros (revogados,
 * pendentes, recusados, desatualizados) e, por titular, uma gaveta com o histórico append-only e as ações
 * de registrar concordância, recusa e revogação (com diálogo de efeito). Cada consentimento é independente.
 */
@Component({
  selector: 'app-consents-page',
  imports: [
    ActiveFiltersComponent,
    BadgeComponent,
    CellDirective,
    ConsentManagerComponent,
    DataTableComponent,
    DrawerComponent,
    FilterChipsComponent,
    LgpdNavComponent,
    PageHeaderComponent,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      <app-page-header title="Consentimentos" [count]="countText()" description="Seis consentimentos por titular, cada um com histórico que não se edita nem se apaga." />
      <app-lgpd-nav />

      <app-filter-chips label="Mostrar" [options]="viewOptions()" [value]="view()" (valueChange)="list.setFilter('visao', $event)" allLabel="Todos" [allCount]="rows().length" />
      <app-active-filters [filters]="activeFilters()" (removed)="list.setFilter($event, null)" (cleared)="list.clear()" />

      <app-data-table
        caption="Consentimentos por titular"
        noun="titulares"
        [rows]="filtered()"
        [columns]="columns()"
        [stack]="false"
        [rowLabel]="rowLabel"
        [filtersActive]="list.hasActive()"
        [sort]="list.sort()"
        (sortChange)="list.setSort($event)"
        [search]="list.search()"
        (searchChange)="list.search.set($event)"
        [page]="list.page()"
        (pageChange)="list.setPage($event)"
        searchable
        rowClickable
        searchLabel="Buscar titular"
        [searchPlaceholder]="partner() ? 'Buscar por código, por exemplo CUI-0001' : 'Buscar por nome ou código'"
        emptyTitle="Nenhum titular por aqui"
        emptyText="Quando houver cadastros, os consentimentos aparecem aqui."
        (rowClick)="openRow($event)"
        (filtersCleared)="list.clear()"
      >
        <ng-template appCell="person" let-row>
          @if (row.pseudonymized) { <span class="code-chip">{{ row.code }}</span> } @else { <span class="col-primary discreet">{{ row.label }}</span> <span class="code-chip">{{ row.code }}</span> }
        </ng-template>
        @for (key of keys; track key) {
          <ng-template [appCell]="key" let-row>
            <app-badge [variant]="badge(row.cells[key]).variant" [outline]="!!badge(row.cells[key]).outline" dot>{{ badge(row.cells[key]).label }}</app-badge>
            @if (row.cells[key].outdated) { <app-badge variant="gold" icon="triangle-alert">Desatualizado</app-badge> }
          </ng-template>
        }
        <ng-template appCell="actions" let-row>
          <button type="button" class="btn btn--sm" [attr.aria-label]="'Ver consentimentos e histórico de ' + row.code" (click)="openRow(row)">Histórico</button>
        </ng-template>
      </app-data-table>
    </div>

    <app-drawer [(open)]="drawerOpen" [heading]="'Consentimentos de ' + (current()?.label ?? '')" [subtitle]="current()?.code ?? ''">
      @if (drawerOpen() && current(); as row) {
        <div class="stack stack--6">
          <app-consent-manager [caregiverId]="row.id" />
          @if (canOpenProfile()) {
            <a class="btn" [routerLink]="['/app/cuidadores', row.id]" [queryParams]="{ aba: 'consentimentos' }">Abrir o cadastro</a>
          }
        </div>
      }
      <ng-container drawerFooter><button type="button" class="btn" (click)="drawerOpen.set(false)">Fechar</button></ng-container>
    </app-drawer>
  `,
})
export class ConsentsPage {
  private readonly db = inject(Database);
  private readonly auth = inject(AuthService);

  protected readonly keys = CONSENT_KEYS;
  protected readonly list = createListState({ key: 'lgpd-consents', filterKeys: ['visao'], defaultSort: { key: 'person', direction: 'asc' } });
  protected readonly drawerOpen = signal(false);
  private readonly currentId = signal<ID | null>(null);
  protected readonly partner = computed(() => this.auth.role() === 'partner');
  protected readonly canOpenProfile = computed(() => this.auth.can('caregiver_registry', 'view') || this.auth.can('caregiver_registry', 'view_aggregate'));
  protected readonly rowLabel = (row: ConsentRow): string => row.code;

  protected readonly rows = computed<ConsentRow[]>(() => {
    const role = this.auth.role();
    const active = new Map<ConsentKey, string>();
    this.db.consentTerms.all().forEach((t) => {
      if (t.active) {
        active.set(t.key, t.version);
      }
    });
    const byCaregiver = new Map<ID, Map<ConsentKey, { status: ConsentStatus; version: string }>>();
    this.db.consents.all().forEach((c) => {
      const inner = byCaregiver.get(c.caregiverId) ?? new Map<ConsentKey, { status: ConsentStatus; version: string }>();
      inner.set(c.key, { status: c.status, version: c.currentTermVersion });
      byCaregiver.set(c.caregiverId, inner);
    });
    return this.db.caregivers.all().map((cg): ConsentRow => {
      const own = byCaregiver.get(cg.id);
      const cells = Object.fromEntries(
        CONSENT_KEYS.map((key) => {
          const c = own?.get(key);
          const status = c?.status ?? 'pending';
          const outdated = status === 'granted' && !!c && isConsentOutdated(c.version, active.get(key) ?? c.version);
          return [key, { status, outdated }];
        }),
      ) as Record<ConsentKey, Cell>;
      const all = Object.values(cells);
      const label = caregiverLabel(role, cg);
      return {
        id: cg.id,
        code: cg.code,
        label: label.text,
        pseudonymized: label.pseudonymized,
        cells,
        revoked: all.some((c) => c.status === 'revoked'),
        pending: all.some((c) => c.status === 'pending'),
        refused: all.some((c) => c.status === 'refused'),
        outdated: all.some((c) => c.outdated),
      };
    });
  });

  protected readonly view = computed(() => this.list.filters()['visao'] ?? null);
  protected readonly filtered = computed(() => {
    const v = this.view();
    return this.rows().filter(
      (r) =>
        !v ||
        (v === 'revogados' && r.revoked) ||
        (v === 'pendentes' && r.pending) ||
        (v === 'recusados' && r.refused) ||
        (v === 'desatualizados' && r.outdated),
    );
  });
  protected readonly countText = computed(() => `${this.filtered().length} titulares`);
  protected readonly viewOptions = computed<FilterOption[]>(() => [
    { value: 'revogados', label: 'Revogados', count: this.rows().filter((r) => r.revoked).length },
    { value: 'pendentes', label: 'Pendentes', count: this.rows().filter((r) => r.pending).length },
    { value: 'recusados', label: 'Recusados', count: this.rows().filter((r) => r.refused).length },
    { value: 'desatualizados', label: 'Desatualizados', count: this.rows().filter((r) => r.outdated).length },
  ]);
  protected readonly activeFilters = computed<ActiveFilter[]>(() => {
    const v = VIEWS.find((x) => x.value === this.view());
    return v ? [{ key: 'visao', label: `Mostrar: ${v.label}` }] : [];
  });

  protected readonly current = computed(() => this.rows().find((r) => r.id === this.currentId()) ?? null);

  protected readonly columns = computed<TableColumn<ConsentRow>[]>(() => [
    { key: 'person', header: this.partner() ? 'Código' : 'Titular', primary: true, sortable: true, sortValue: (r) => (this.partner() ? r.code : r.label), searchText: (r) => `${r.pseudonymized ? '' : r.label} ${r.code}` },
    ...CONSENT_KEYS.map((key): TableColumn<ConsentRow> => ({ key, header: SHORT[key], sortable: true, noSearch: true, sortValue: (r) => r.cells[key].status })),
    { key: 'actions', header: 'Ações', actions: true },
  ]);

  protected badge(cell: Cell): { variant: BadgeVariant; label: string; outline?: boolean } {
    return STATUS[cell.status];
  }

  protected openRow(row: ConsentRow): void {
    this.currentId.set(row.id);
    this.drawerOpen.set(true);
  }
}
