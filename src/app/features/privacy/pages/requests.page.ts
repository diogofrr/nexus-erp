import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@core/auth';
import { Clock } from '@core/clock';
import { Database } from '@core/data';
import { formatDate } from '@core/format';
import type { Channel, DataSubjectRequest, DsrType, ID } from '@core/models';
import { DataSubjectRequestService } from '@core/privacy';
import { caregiverLabel } from '@core/privacy/caregiver-label';
import { DSR_DEADLINE_DAYS, DSR_TYPE_LABELS, DsrDeadlineState } from '@core/rules';
import {
  ActiveFilter,
  ActiveFiltersComponent,
  BadgeComponent,
  CellDirective,
  DataTableComponent,
  ErrorSummaryComponent,
  ErrorSummaryItem,
  FilterChipsComponent,
  FilterOption,
  FormFieldComponent,
  NxInputDirective,
  NxMaskDirective,
  NxValidators,
  PageHeaderComponent,
  SearchFieldComponent,
  TableColumn,
  createListState,
  normalizeText,
} from '@shared/ui';
import { BannerComponent, DrawerComponent, ToastService } from '@shared/ui/overlay';
import { LgpdNavComponent } from '../components/lgpd-nav.component';
import { DEADLINE_BADGES, DSR_STATUS_BADGES, DSR_STATUS_LABELS } from '../state/privacy-labels';

interface RequestRow {
  id: ID;
  protocol: string;
  caregiverId: ID;
  label: string;
  code: string;
  pseudonymized: boolean;
  type: DsrType;
  status: DataSubjectRequest['status'];
  openedAt: string;
  dueAt: string;
  deadlineState: DsrDeadlineState;
  deadlineLabel: string;
}

const VIEWS: readonly { value: string; label: string; match: (s: DataSubjectRequest['status']) => boolean }[] = [
  { value: 'abertas', label: 'Abertas', match: (s) => s === 'open' },
  { value: 'andamento', label: 'Em andamento', match: (s) => s === 'in_progress' },
  { value: 'concluidas', label: 'Concluídas', match: (s) => s === 'completed' },
  { value: 'rejeitadas', label: 'Rejeitadas', match: (s) => s === 'rejected_with_reason' },
];

const CHANNELS: { value: Channel | 'in_person'; label: string }[] = [
  { value: 'in_person', label: 'Presencial' },
  { value: 'phone', label: 'Telefone' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'app', label: 'Aplicativo' },
  { value: 'email', label: 'E-mail' },
];

/**
 * SCR-M12-03 Solicitações do titular (PD-01 e PD-05): protocolo `DSR-0000`, prazo de 15 dias corridos com
 * contador ("Vence em 5 dias", "Vence em breve (2 dias)", "Vencida há N dias": texto, ícone e cor), ordenadas
 * pelo prazo mais próximo. O atendimento registra em nome do titular; "Nova solicitação" abre uma gaveta
 * (também por `?acao=nova`). O tratamento é na tela da solicitação.
 */
@Component({
  selector: 'app-requests-page',
  imports: [
    ActiveFiltersComponent,
    BadgeComponent,
    BannerComponent,
    CellDirective,
    DataTableComponent,
    DrawerComponent,
    ErrorSummaryComponent,
    FilterChipsComponent,
    FormFieldComponent,
    LgpdNavComponent,
    NxInputDirective,
    NxMaskDirective,
    PageHeaderComponent,
    ReactiveFormsModule,
    SearchFieldComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      <app-page-header title="Solicitações do titular" [count]="countText()" [description]="'Prazo de ' + days + ' dias corridos para cada pedido.'">
        @if (canCreate()) {
          <button type="button" class="btn btn--primary" (click)="openDrawer()">Nova solicitação</button>
        }
      </app-page-header>
      <app-lgpd-nav />

      <div class="cluster cluster--4" role="group" aria-label="Filtros da lista">
        <div class="stack stack--2"><span class="t-ui t-strong">Situação</span><app-filter-chips label="Situação" [options]="viewOptions()" [value]="view()" (valueChange)="list.setFilter('visao', $event)" allLabel="Todas" [allCount]="rows().length" /></div>
        <div class="stack stack--2"><span class="t-ui t-strong">Prazo</span><app-filter-chips label="Prazo" [options]="deadlineOptions()" [value]="deadline()" (valueChange)="list.setFilter('filtro', $event)" allLabel="Todos os prazos" /></div>
      </div>
      <app-active-filters [filters]="activeFilters()" (removed)="list.setFilter($event, null)" (cleared)="list.clear()" />

      <app-data-table
        caption="Solicitações do titular"
        noun="solicitações"
        [rows]="filtered()"
        [columns]="columns()"
        [filtersActive]="list.hasActive()"
        [sort]="list.sort()"
        (sortChange)="list.setSort($event)"
        [search]="list.search()"
        (searchChange)="list.search.set($event)"
        [page]="list.page()"
        (pageChange)="list.setPage($event)"
        searchable
        rowClickable
        searchLabel="Buscar solicitação"
        searchPlaceholder="Protocolo ou código do titular"
        emptyTitle="Nenhuma solicitação por aqui"
        emptyText="Quando um titular fizer um pedido, ele aparece aqui com o prazo."
        (rowClick)="open($event)"
        (filtersCleared)="list.clear()"
      >
        <ng-template appCell="person" let-row>
          @if (row.pseudonymized) { <span class="code-chip">{{ row.code }}</span> } @else { <span class="discreet">{{ row.label }}</span> <span class="code-chip">{{ row.code }}</span> }
        </ng-template>
        <ng-template appCell="deadline" let-row>
          <app-badge [variant]="deadlineBadge(row).variant" [icon]="deadlineBadge(row).icon">{{ row.deadlineLabel }}</app-badge>
        </ng-template>
        <ng-template appCell="status" let-row>
          <app-badge [variant]="statusBadge(row).variant" [icon]="statusBadge(row).icon">{{ statusLabel(row) }}</app-badge>
        </ng-template>
        <ng-template appCell="actions" let-row>
          <button type="button" class="btn btn--sm" [attr.aria-label]="'Atender a solicitação ' + row.protocol" (click)="open(row)">
            {{ row.status === 'completed' || row.status === 'rejected_with_reason' ? 'Ver' : 'Atender' }}
          </button>
        </ng-template>
      </app-data-table>
    </div>

    <app-drawer [(open)]="drawerOpen" heading="Nova solicitação do titular" subtitle="Registrada em nome do titular">
      <form id="nx-dsr-form" class="stack stack--3" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <app-error-summary [items]="summary()" />
        <div class="field">
          <span class="field__label" id="nx-dsr-holder-label">Titular</span>
          @if (holder(); as h) {
            <div class="cluster">
              <span class="code-chip">{{ h.code }}</span>
              @if (!h.pseudonymized) { <span class="discreet">{{ h.label }}</span> }
              <button type="button" class="btn btn--sm" (click)="clearHolder()">Trocar titular</button>
            </div>
          } @else {
            <app-search-field [label]="partner() ? 'Buscar titular por código' : 'Buscar titular por nome ou código'" placeholder="Código ou nome" [(value)]="holderSearch" />
            @if (matches().length > 0) {
              <ul class="stack stack--2 list-reset" aria-label="Titulares encontrados">
                @for (m of matches(); track m.id) {
                  <li><button type="button" class="btn btn--sm" (click)="pickHolder(m.id)">{{ m.pseudonymized ? m.code : m.label + ', ' + m.code }}</button></li>
                }
              </ul>
            }
            @if (holderError()) { <span class="field__error" role="alert"><span class="sr-only">Erro: </span>{{ holderError() }}</span> }
          }
        </div>
        <app-form-field label="Tipo de pedido" controlId="nx-dsr-type" [forceErrors]="submitted()">
          <select appInput formControlName="type">
            <option [ngValue]="null">Escolha o tipo</option>
            @for (t of typeOptions; track t.value) { <option [ngValue]="t.value">{{ t.label }}</option> }
          </select>
        </app-form-field>
        @if (duplicate(); as d) {
          <app-banner variant="attention" heading="Já existe um pedido igual aberto" liveRole="status">
            <span data-role="duplicate">
              A solicitação {{ d.protocol }} ({{ typeLabel(d.type) }}) deste titular está aberta, com prazo até {{ date(d.dueAt) }}.
              Abra essa ou registre mesmo assim.
            </span>
            <div class="cluster mt-2">
              <button type="button" class="btn btn--sm" data-role="duplicate-open" (click)="openDuplicate(d.id)">Abrir {{ d.protocol }}</button>
              @if (allowDuplicate()) {
                <span class="t-caption" data-role="duplicate-allowed">Certo. Vou registrar outra mesmo assim.</span>
              } @else {
                <button type="button" class="btn btn--sm btn--ghost" data-role="duplicate-force" (click)="allowDuplicate.set(true)">Registrar mesmo assim</button>
              }
            </div>
          </app-banner>
        }
        <app-form-field label="Canal por onde chegou" controlId="nx-dsr-channel" [forceErrors]="submitted()">
          <select appInput formControlName="channel">
            @for (c of channels; track c.value) { <option [ngValue]="c.value">{{ c.label }}</option> }
          </select>
        </app-form-field>
        <app-form-field label="Data do pedido" hint="O prazo conta a partir daqui." controlId="nx-dsr-date" [forceErrors]="submitted()">
          <input appInput appMask="date" formControlName="date" />
        </app-form-field>
        <app-form-field label="O que o titular pediu" hint="Em palavras simples. Não escreva dado de saúde." controlId="nx-dsr-description" [forceErrors]="submitted()">
          <textarea appInput formControlName="description" rows="3"></textarea>
        </app-form-field>
      </form>
      <ng-container drawerFooter>
        <button type="button" class="btn" (click)="drawerOpen.set(false)">Voltar</button>
        <button type="submit" form="nx-dsr-form" class="btn btn--primary">Registrar solicitação</button>
      </ng-container>
    </app-drawer>
  `,
})
export class RequestsPage {
  private readonly db = inject(Database);
  private readonly auth = inject(AuthService);
  private readonly clock = inject(Clock);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(DataSubjectRequestService);
  private readonly toasts = inject(ToastService);
  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });

  protected readonly days = DSR_DEADLINE_DAYS;
  protected readonly channels = CHANNELS;
  protected readonly typeOptions = (Object.keys(DSR_TYPE_LABELS) as DsrType[]).map((value) => ({ value, label: DSR_TYPE_LABELS[value] }));
  protected readonly list = createListState({ key: 'lgpd-requests', filterKeys: ['visao', 'filtro'], defaultSort: { key: 'deadline', direction: 'asc' } });
  protected readonly canCreate = computed(() => this.auth.can('lgpd_consents_requests', 'create'));
  protected readonly partner = computed(() => this.auth.role() === 'partner');

  protected readonly drawerOpen = signal(false);
  protected readonly submitted = signal(false);
  protected readonly summary = signal<ErrorSummaryItem[]>([]);
  protected readonly holderError = signal<string | null>(null);
  protected readonly holderSearch = signal('');
  protected readonly holderId = signal<ID | null>(null);
  protected readonly allowDuplicate = signal(false);
  private readonly typeValue = signal<DsrType | null>(null);
  protected readonly form = new FormGroup({
    type: new FormControl<DsrType | null>(null, [NxValidators.required('o tipo de pedido')]),
    channel: new FormControl<Channel | 'in_person'>('in_person', { nonNullable: true }),
    date: new FormControl<string | null>(null, [NxValidators.required('a data do pedido')]),
    description: new FormControl('', { nonNullable: true, validators: [NxValidators.required('o que o titular pediu')] }),
  });

  protected readonly rows = computed<RequestRow[]>(() => {
    const role = this.auth.role();
    const today = this.clock.today();
    const caregivers = new Map(this.db.caregivers.all().map((c) => [c.id, c] as const));
    return this.db.dataSubjectRequests.all().flatMap((r): RequestRow[] => {
      const cg = caregivers.get(r.caregiverId);
      if (!cg) {
        return [];
      }
      const label = caregiverLabel(role, cg);
      const dl = this.service.deadline(r, today);
      return [
        {
          id: r.id,
          protocol: r.protocol,
          caregiverId: cg.id,
          label: label.text,
          code: cg.code,
          pseudonymized: label.pseudonymized,
          type: r.type,
          status: r.status,
          openedAt: r.openedAt,
          dueAt: r.dueAt,
          deadlineState: dl.state,
          deadlineLabel: dl.label,
        },
      ];
    });
  });

  protected readonly view = computed(() => this.list.filters()['visao'] ?? null);
  protected readonly deadline = computed(() => this.list.filters()['filtro'] ?? null);
  protected readonly filtered = computed(() => {
    const v = VIEWS.find((x) => x.value === this.view());
    const d = this.deadline();
    return this.rows().filter(
      (r) =>
        (!v || v.match(r.status)) &&
        (!d || (d === 'vencendo' && r.deadlineState === 'due_soon') || (d === 'vencidas' && r.deadlineState === 'overdue')),
    );
  });
  protected readonly countText = computed(() => {
    const n = this.filtered().length;
    return `${n} ${n === 1 ? 'solicitação' : 'solicitações'}`;
  });
  protected readonly viewOptions = computed<FilterOption[]>(() =>
    VIEWS.map((v) => ({ value: v.value, label: v.label, count: this.rows().filter((r) => v.match(r.status)).length })),
  );
  protected readonly deadlineOptions = computed<FilterOption[]>(() => [
    { value: 'vencendo', label: 'Vencendo em breve', count: this.rows().filter((r) => r.deadlineState === 'due_soon').length },
    { value: 'vencidas', label: 'Vencidas', count: this.rows().filter((r) => r.deadlineState === 'overdue').length },
  ]);
  protected readonly activeFilters = computed<ActiveFilter[]>(() => {
    const out: ActiveFilter[] = [];
    const v = VIEWS.find((x) => x.value === this.view());
    if (v) {
      out.push({ key: 'visao', label: `Situação: ${v.label}` });
    }
    if (this.deadline()) {
      out.push({ key: 'filtro', label: this.deadline() === 'vencidas' ? 'Prazo: vencidas' : 'Prazo: vencendo em breve' });
    }
    return out;
  });

  protected readonly columns = computed<TableColumn<RequestRow>[]>(() => [
    { key: 'protocol', header: 'Protocolo', primary: true, sortable: true },
    { key: 'person', header: this.partner() ? 'Código' : 'Titular', sortable: true, sortValue: (r) => (this.partner() ? r.code : r.label), searchText: (r) => `${r.pseudonymized ? '' : r.label} ${r.code} ${r.protocol}` },
    { key: 'type', header: 'Tipo', sortable: true, value: (r) => DSR_TYPE_LABELS[r.type], noSearch: true },
    { key: 'opened', header: 'Aberta em', sortable: true, noSearch: true, value: (r) => formatDate(r.openedAt), sortValue: (r) => r.openedAt },
    { key: 'deadline', header: 'Prazo', sortable: true, noSearch: true, sortValue: (r) => `${r.deadlineState === 'done' ? '1' : '0'}${r.dueAt}` },
    { key: 'status', header: 'Situação', sortable: true, noSearch: true, sortValue: (r) => r.status },
    { key: 'actions', header: 'Ações', actions: true },
  ]);

  protected readonly holder = computed(() => {
    const id = this.holderId();
    const cg = id ? this.db.caregivers.get(id) : undefined;
    if (!cg) {
      return null;
    }
    const l = caregiverLabel(this.auth.role(), cg);
    return { code: cg.code, label: l.text, pseudonymized: l.pseudonymized };
  });
  protected readonly matches = computed(() => {
    const term = normalizeText(this.holderSearch());
    if (term.length < 2) {
      return [];
    }
    const role = this.auth.role();
    return this.db.caregivers
      .all()
      .map((cg) => ({ id: cg.id, ...caregiverLabel(role, cg) }))
      .filter((m) => normalizeText(`${m.pseudonymized ? '' : m.text} ${m.code}`).includes(term))
      .slice(0, 6)
      .map((m) => ({ id: m.id, label: m.text, code: m.code, pseudonymized: m.pseudonymized }));
  });

  /** CX-036: pedido do mesmo tipo, para o mesmo titular, que ainda está aberto ou em andamento. */
  protected readonly duplicate = computed(() => {
    const holder = this.holderId();
    const type = this.typeValue();
    this.db.dataSubjectRequests.all();
    if (!holder || !type) {
      return null;
    }
    return (
      this.db.dataSubjectRequests.find(
        (r) => r.caregiverId === holder && r.type === type && (r.status === 'open' || r.status === 'in_progress'),
      ) ?? null
    );
  });

  constructor() {
    this.form.controls.type.valueChanges.subscribe((t) => {
      this.typeValue.set(t);
      this.allowDuplicate.set(false);
    });
    // `?acao=nova` (paleta e atalhos) e `?cuidador=` (ficha do cuidador) abrem a gaveta já com o titular.
    effect(() => {
      const q = this.query();
      if (q.get('acao') !== 'nova' || !this.canCreate()) {
        return;
      }
      untracked(() => {
        const id = q.get('cuidador');
        this.openDrawer(id && this.db.caregivers.exists(id) ? id : undefined);
        void this.router.navigate([], { relativeTo: this.route, queryParams: { acao: null, cuidador: null }, queryParamsHandling: 'merge', replaceUrl: true });
      });
    });
  }

  protected statusLabel(row: RequestRow): string {
    return DSR_STATUS_LABELS[row.status];
  }
  protected statusBadge(row: RequestRow): (typeof DSR_STATUS_BADGES)[DataSubjectRequest['status']] {
    return DSR_STATUS_BADGES[row.status];
  }
  protected deadlineBadge(row: RequestRow): (typeof DEADLINE_BADGES)[DsrDeadlineState] {
    return DEADLINE_BADGES[row.deadlineState];
  }

  protected typeLabel(type: DsrType): string {
    return DSR_TYPE_LABELS[type];
  }

  protected date(value: string): string {
    return formatDate(value);
  }

  protected openDuplicate(id: ID): void {
    this.drawerOpen.set(false);
    void this.router.navigate(['/app/lgpd/solicitacoes', id]);
  }

  protected open(row: RequestRow): void {
    void this.router.navigate(['/app/lgpd/solicitacoes', row.id]);
  }

  protected openDrawer(holderId?: ID): void {
    this.submitted.set(false);
    this.summary.set([]);
    this.holderError.set(null);
    this.holderSearch.set('');
    this.holderId.set(holderId ?? null);
    this.allowDuplicate.set(false);
    this.form.reset({ type: null, channel: 'in_person', date: this.clock.today(), description: '' });
    this.typeValue.set(null);
    this.drawerOpen.set(true);
  }

  protected pickHolder(id: ID): void {
    this.holderId.set(id);
    this.allowDuplicate.set(false);
    this.holderError.set(null);
  }

  protected clearHolder(): void {
    this.holderId.set(null);
  }

  protected save(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    const items: ErrorSummaryItem[] = [];
    if (!this.holderId()) {
      this.holderError.set('Escolha o titular da solicitação.');
      items.push({ controlId: 'nx-dsr-holder-label', message: 'Escolha o titular da solicitação.' });
    }
    ([
      ['nx-dsr-type', 'o tipo de pedido', this.form.controls.type],
      ['nx-dsr-date', 'a data do pedido', this.form.controls.date],
      ['nx-dsr-description', 'o que o titular pediu', this.form.controls.description],
    ] as const).forEach(([id, what, control]) => {
      if (control.invalid) {
        items.push({ controlId: id, message: `Informe ${what}.` });
      }
    });
    const duplicate = this.duplicate();
    if (duplicate && !this.allowDuplicate()) {
      items.push({
        controlId: 'nx-dsr-type',
        message: `Já existe a ${duplicate.protocol} aberta para este titular e este tipo. Abra essa ou escolha "Registrar mesmo assim".`,
      });
    }
    const date = this.form.controls.date.value;
    if (date && date > this.clock.today()) {
      items.push({ controlId: 'nx-dsr-date', message: 'A data do pedido não pode ser no futuro.' });
    }
    this.summary.set(items);
    if (items.length > 0) {
      return;
    }
    const v = this.form.getRawValue();
    try {
      const opened = this.service.open({ caregiverId: this.holderId() as ID, type: v.type as DsrType, openedAt: v.date as string });
      const request = this.db.dataSubjectRequests.update(opened.id, { channel: v.channel, description: v.description.trim() });
      this.toasts.show({
        message: `Solicitação ${request.protocol} registrada. Prazo: ${formatDate(request.dueAt)} (${this.days} dias corridos).`,
        action: { label: 'Abrir', run: () => void this.router.navigate(['/app/lgpd/solicitacoes', request.id]) },
      });
      this.drawerOpen.set(false);
    } catch {
      this.toasts.error('Não foi possível salvar. Tente de novo; se continuar, avise a equipe.');
    }
  }
}
