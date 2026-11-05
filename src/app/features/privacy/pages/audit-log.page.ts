import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AuditFilter, AuditLogService } from '@core/audit';
import { ACTION_LABELS, entityLabel } from '@core/audit/audit-labels';
import { AuthService, ROLE_LABELS } from '@core/auth';
import { Database } from '@core/data';
import { downloadTextFile } from '@core/export/file-download';
import { formatDateTime } from '@core/format';
import type { AccessAction, AccessLogEntry, Role } from '@core/models';
import { pseudonymFromId } from '@core/privacy';
import {
  ActiveFilter,
  ActiveFiltersComponent,
  BadgeComponent,
  BadgeVariant,
  CellDirective,
  DataTableComponent,
  FormFieldComponent,
  KpiComponent,
  KpiStripComponent,
  NxInputDirective,
  NxMaskDirective,
  PageHeaderComponent,
  TableColumn,
  TableDensity,
  createListState,
} from '@shared/ui';
import { ToastService } from '@shared/ui/overlay';
import { LgpdNavComponent } from '../components/lgpd-nav.component';

interface LogRow {
  id: string;
  at: string;
  userId: string;
  user: string;
  role: Role;
  roleLabel: string;
  action: AccessAction;
  actionLabel: string;
  entity: string;
  subject: string;
  justification: string;
  detail: string;
}

const ACTION_BADGES: Record<AccessAction, BadgeVariant> = {
  login: 'neutral',
  logout: 'neutral',
  view: 'info',
  create: 'success',
  update: 'attention',
  delete: 'danger',
  export: 'gold',
  print: 'gold',
  reveal: 'attention',
  denied: 'danger',
  supervise: 'info',
};

const ACTIONS = Object.keys(ACTION_LABELS) as AccessAction[];
const ROLES: Role[] = ['partner', 'technical_lead', 'psychologist', 'support'];
const CODE_RE = /^CUI-\d{4}$/i;

/**
 * SCR-M12-05 Log de auditoria: só a gestão (leitura) e o responsável técnico (total) abrem. Filtros por
 * usuário, perfil, ação, titular (pelo código) e período, tudo na URL; exportar CSV sem conteúdo clínico é do
 * responsável técnico. O registro não tem editar nem apagar (append-only). O titular aparece pelo código.
 */
@Component({
  selector: 'app-audit-log-page',
  imports: [
    ActiveFiltersComponent,
    BadgeComponent,
    CellDirective,
    DataTableComponent,
    FormFieldComponent,
    KpiComponent,
    KpiStripComponent,
    LgpdNavComponent,
    NxInputDirective,
    NxMaskDirective,
    PageHeaderComponent,
    ReactiveFormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      <app-page-header title="Log de acessos" [count]="countText()" description="Quem viu, mostrou, alterou ou exportou dado sensível. O registro não se edita nem se apaga.">
        @if (canExport()) {
          <button type="button" class="btn" (click)="exportCsv()">Exportar CSV</button>
        }
      </app-page-header>
      <app-lgpd-nav />

      <app-kpi-strip aria-label="Resumo do período filtrado">
        <app-kpi label="Consultas" [value]="counts().view.toString()" context="leituras de dado sensível" />
        <app-kpi label="Supervisões" [value]="counts().supervise.toString()" context="com justificativa" />
        <app-kpi label="Dados mostrados" [value]="counts().reveal.toString()" context="com motivo" />
        <app-kpi label="Exportações" [value]="(counts().export + counts().print).toString()" context="inclui impressões" />
        <app-kpi label="Acessos negados" [value]="counts().denied.toString()" context="telas sem permissão" />
      </app-kpi-strip>

      <form class="form-grid" (submit)="$event.preventDefault()" aria-label="Filtros do log">
        <app-form-field label="Usuário" controlId="nx-log-user">
          <select appInput [formControl]="userCtl">
            <option value="">Todos</option>
            @for (u of users(); track u.id) { <option [value]="u.id">{{ u.displayName }}</option> }
          </select>
        </app-form-field>
        <app-form-field label="Perfil" controlId="nx-log-role">
          <select appInput [formControl]="roleCtl">
            <option value="">Todos</option>
            @for (r of roles; track r) { <option [value]="r">{{ roleLabel(r) }}</option> }
          </select>
        </app-form-field>
        <app-form-field label="Ação" controlId="nx-log-action">
          <select appInput [formControl]="actionCtl">
            <option value="">Todas</option>
            @for (a of actions; track a) { <option [value]="a">{{ actionLabel(a) }}</option> }
          </select>
        </app-form-field>
        <app-form-field label="Titular" hint="Pelo código, por exemplo CUI-0001." controlId="nx-log-subject" [error]="subjectError()">
          <input appInput [formControl]="subjectCtl" autocomplete="off" />
        </app-form-field>
        <app-form-field label="De" hint="Digite dia, mês e ano." controlId="nx-log-from">
          <input appInput appMask="date" [formControl]="fromCtl" />
        </app-form-field>
        <app-form-field label="Até" controlId="nx-log-to">
          <input appInput appMask="date" [formControl]="toCtl" />
        </app-form-field>
      </form>
      <app-active-filters [filters]="activeFilters()" (removed)="removeFilter($event)" (cleared)="clearFilters()" />

      <app-data-table
        caption="Log de acessos"
        noun="registros"
        [rows]="rows()"
        [columns]="columns"
        [stack]="false"
        [filtersActive]="list.hasActive()"
        [search]="list.search()"
        (searchChange)="list.search.set($event)"
        [sort]="list.sort()"
        (sortChange)="list.setSort($event)"
        [page]="list.page()"
        (pageChange)="list.setPage($event)"
        [(density)]="density"
        searchable
        densityToggle
        searchLabel="Buscar no log"
        searchPlaceholder="Entidade, detalhe ou justificativa"
        emptyTitle="Nenhum registro por aqui"
        emptyText="Quando alguém acessar dado sensível, o registro aparece aqui."
        (filtersCleared)="clearFilters()"
      >
        <ng-template appCell="action" let-row><app-badge [variant]="variant(row.action)" dot>{{ row.actionLabel }}</app-badge></ng-template>
        <ng-template appCell="subject" let-row>
          @if (row.subject) { <span class="code-chip">{{ row.subject }}</span> } @else { <span class="t-muted">Não se aplica</span> }
        </ng-template>
      </app-data-table>
    </div>
  `,
})
export class AuditLogPage {
  private readonly db = inject(Database);
  private readonly auth = inject(AuthService);
  private readonly audit = inject(AuditLogService);
  private readonly doc = inject(DOCUMENT);
  private readonly toasts = inject(ToastService);

  protected readonly actions = ACTIONS;
  protected readonly roles = ROLES;
  protected readonly density = signal<TableDensity>('compact');
  protected readonly list = createListState({
    key: 'lgpd-log',
    filterKeys: ['usuario', 'perfil', 'acao', 'titular', 'de', 'ate'],
    defaultSort: { key: 'at', direction: 'desc' },
  });
  protected readonly canExport = computed(() => this.auth.can('lgpd_audit_log', 'export'));
  protected readonly subjectError = signal<string | null>(null);

  protected readonly userCtl = new FormControl('', { nonNullable: true });
  protected readonly roleCtl = new FormControl('', { nonNullable: true });
  protected readonly actionCtl = new FormControl('', { nonNullable: true });
  protected readonly subjectCtl = new FormControl('', { nonNullable: true });
  protected readonly fromCtl = new FormControl<string | null>(null);
  protected readonly toCtl = new FormControl<string | null>(null);

  protected readonly users = computed(() => this.db.users.all());

  protected readonly columns: TableColumn<LogRow>[] = [
    { key: 'at', header: 'Data e hora', sortable: true, value: (r) => formatDateTime(r.at), sortValue: (r) => r.at, noSearch: true },
    { key: 'user', header: 'Usuário', sortable: true, primary: true },
    { key: 'roleLabel', header: 'Perfil', sortable: true },
    { key: 'action', header: 'Ação', sortable: true, sortValue: (r) => r.actionLabel, noSearch: true },
    { key: 'entity', header: 'Entidade', sortable: true },
    { key: 'subject', header: 'Titular', sortable: true, sortValue: (r) => r.subject, noSearch: true },
    { key: 'justification', header: 'Justificativa' },
    { key: 'detail', header: 'Detalhe' },
  ];

  private readonly filter = computed<AuditFilter>(() => {
    const f = this.list.filters();
    const subject = f['titular'] ? this.db.caregivers.find((c) => c.code.toLowerCase() === f['titular']?.toLowerCase())?.id : undefined;
    return {
      ...(f['usuario'] ? { userId: f['usuario'] } : {}),
      ...(f['perfil'] ? { role: f['perfil'] as Role } : {}),
      ...(f['acao'] ? { action: f['acao'] as AccessAction } : {}),
      ...(f['titular'] ? { subjectCaregiverId: subject ?? '__nenhum__' } : {}),
      ...(f['de'] ? { from: f['de'] } : {}),
      ...(f['ate'] ? { to: f['ate'] } : {}),
    };
  });

  private readonly entries = computed<AccessLogEntry[]>(() => {
    this.db.accessLog.all();
    return this.audit.query(this.filter());
  });

  protected readonly rows = computed<LogRow[]>(() => {
    const users = new Map(this.db.users.all().map((u) => [u.id, u.displayName] as const));
    const caregivers = new Map(this.db.caregivers.all().map((c) => [c.id, c.code] as const));
    return this.entries().map((e) => ({
      id: e.id,
      at: e.at,
      userId: e.userId,
      user: users.get(e.userId) ?? 'Usuário',
      role: e.role,
      roleLabel: ROLE_LABELS[e.role],
      action: e.action,
      actionLabel: ACTION_LABELS[e.action],
      entity: entityLabel(e.entity),
      subject: e.subjectCaregiverId ? (caregivers.get(e.subjectCaregiverId) ?? pseudonymFromId(e.subjectCaregiverId)) : '',
      justification: e.justification ?? '',
      detail: e.detail ?? '',
    }));
  });
  protected readonly counts = computed(() => this.audit.countByAction(this.entries()));
  protected readonly countText = computed(() => `${this.rows().length} registros`);

  protected readonly activeFilters = computed<ActiveFilter[]>(() => {
    const f = this.list.filters();
    const out: ActiveFilter[] = [];
    if (f['usuario']) { out.push({ key: 'usuario', label: `Usuário: ${this.db.users.get(f['usuario'])?.displayName ?? f['usuario']}` }); }
    if (f['perfil']) { out.push({ key: 'perfil', label: `Perfil: ${ROLE_LABELS[f['perfil'] as Role] ?? f['perfil']}` }); }
    if (f['acao']) { out.push({ key: 'acao', label: `Ação: ${ACTION_LABELS[f['acao'] as AccessAction] ?? f['acao']}` }); }
    if (f['titular']) { out.push({ key: 'titular', label: `Titular: ${f['titular']}` }); }
    if (f['de']) { out.push({ key: 'de', label: `De: ${f['de'].split('-').reverse().join('/')}` }); }
    if (f['ate']) { out.push({ key: 'ate', label: `Até: ${f['ate'].split('-').reverse().join('/')}` }); }
    return out;
  });

  constructor() {
    // Os controles começam com o que está na URL e, ao mudar, atualizam a URL.
    const f = this.list.filters();
    this.userCtl.setValue(f['usuario'] ?? '');
    this.roleCtl.setValue(f['perfil'] ?? '');
    this.actionCtl.setValue(f['acao'] ?? '');
    this.subjectCtl.setValue(f['titular'] ?? '');
    this.fromCtl.setValue(f['de'] ?? null);
    this.toCtl.setValue(f['ate'] ?? null);
    this.userCtl.valueChanges.subscribe((v) => this.list.setFilter('usuario', v || null));
    this.roleCtl.valueChanges.subscribe((v) => this.list.setFilter('perfil', v || null));
    this.actionCtl.valueChanges.subscribe((v) => this.list.setFilter('acao', v || null));
    this.fromCtl.valueChanges.subscribe((v) => this.list.setFilter('de', v && this.fromCtl.valid ? v : null));
    this.toCtl.valueChanges.subscribe((v) => this.list.setFilter('ate', v && this.toCtl.valid ? v : null));
    this.subjectCtl.valueChanges.subscribe((v) => {
      const text = v.trim();
      if (text === '') {
        this.subjectError.set(null);
        this.list.setFilter('titular', null);
      } else if (CODE_RE.test(text)) {
        this.subjectError.set(null);
        this.list.setFilter('titular', text.toUpperCase());
      } else {
        this.subjectError.set('Digite o código no formato CUI-0001.');
      }
    });
  }

  protected roleLabel(role: Role): string {
    return ROLE_LABELS[role];
  }

  protected actionLabel(action: AccessAction): string {
    return ACTION_LABELS[action];
  }

  protected variant(action: AccessAction): BadgeVariant {
    return ACTION_BADGES[action];
  }

  protected removeFilter(key: string): void {
    this.list.setFilter(key, null);
    const reset: Record<string, () => void> = {
      usuario: () => this.userCtl.setValue('', { emitEvent: false }),
      perfil: () => this.roleCtl.setValue('', { emitEvent: false }),
      acao: () => this.actionCtl.setValue('', { emitEvent: false }),
      titular: () => this.subjectCtl.setValue('', { emitEvent: false }),
      de: () => this.fromCtl.setValue(null, { emitEvent: false }),
      ate: () => this.toCtl.setValue(null, { emitEvent: false }),
    };
    reset[key]?.();
  }

  protected clearFilters(): void {
    ['usuario', 'perfil', 'acao', 'titular', 'de', 'ate'].forEach((k) => this.removeFilter(k));
    this.list.clear();
  }

  /** CSV sem conteúdo clínico: o titular sai pelo código (LP-16). */
  protected exportCsv(): void {
    const entries = this.entries();
    const csv = this.audit.toCsv(entries);
    this.audit.exported('access_log_csv', undefined, 'log sem conteúdo clínico');
    const ok = downloadTextFile(this.doc, 'log-de-acessos.csv', csv, 'text/csv;charset=utf-8');
    this.toasts.show({
      message: ok ? `Log exportado: ${entries.length} registros, sem conteúdo clínico.` : 'Não foi possível baixar o arquivo neste navegador.',
      tone: ok ? 'success' : 'danger',
    });
  }
}
