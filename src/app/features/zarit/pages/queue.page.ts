import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuditLogService } from '@core/audit';
import { AuthService } from '@core/auth';
import { Clock } from '@core/clock';
import { Database } from '@core/data';
import { formatDate } from '@core/format';
import { ConsentService } from '@core/privacy/consent.service';
import { zaritDaysToDue } from '@core/rules';
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
  TableColumn,
  ZaritBandBadgeComponent,
  createListState,
} from '@shared/ui';
import { DrawerComponent } from '@shared/ui/overlay';
import { valueOf } from '@shared/ui/util/form-events';
import { AlertCountdownComponent } from '../components/alert-countdown.component';
import { QueueReason, QueueRow, buildQueue, matchesFilter } from '@core/rules/zarit-queue';
import { ZaritAccessService } from '../state/zarit-access.service';

interface QueueTableRow extends QueueRow {
  id: string;
  name: string;
  code: string;
  psychologist: string;
  reasonText: string;
  extraText: string;
}

const CHIPS: { value: string; label: string }[] = [
  { value: 'vermelhos', label: 'Vermelhos' },
  { value: 'amarelos', label: 'Amarelos' },
  { value: 'arbe', label: 'Esgotamento (ARBE)' },
  { value: 'zarit', label: 'Zarit vencendo' },
];

const FILTER_LABELS: Record<string, string> = {
  vermelhos: 'Alertas vermelhos',
  amarelos: 'Alertas amarelos',
  arbe: 'Esgotamento (ARBE)',
  zarit: 'Zarit vencendo',
  'contato-hoje': 'Contato do mesmo dia pendente',
  'contato-vencido': 'Prazo de contato vencido',
  'em-andamento': 'Alertas em andamento',
  tarefas: 'Tarefa: revisar rede de apoio',
  'aplicacao-vencendo': 'Aplicação vencendo',
  'alertas-a-confirmar': 'Alertas a confirmar',
};

/**
 * SCR-M06-01 e SCR-M05-09, Fila de acompanhamento (PD-05, A-20: uma tela, dois acessos). Cuidadores com alerta
 * aberto, aplicação da escala vencida ou a vencer, na ordem: vermelho vencido, vermelho do dia, ARBE crítico,
 * amarelo, Zarit vencida, Zarit a vencer. O psicólogo vê os seus; o responsável técnico vê todos. A gestão não
 * abre esta tela e o atendimento não vê nada daqui. `?filtro=` vem do sino; `?acao=aplicar` vem da paleta.
 */
@Component({
  selector: 'app-queue-page',
  imports: [
    ActiveFiltersComponent,
    AlertCountdownComponent,
    BadgeComponent,
    CellDirective,
    DataTableComponent,
    DrawerComponent,
    EmptyStateComponent,
    FilterChipsComponent,
    FormFieldComponent,
    IconComponent,
    NxInputDirective,
    PageHeaderComponent,
    RouterLink,
    ZaritBandBadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      <app-page-header
        title="Fila de acompanhamento"
        [count]="count()"
        description="Quem precisa de contato, revisão ou aplicação da escala, do mais urgente ao menos."
      >
        @if (canApply()) {
          <button type="button" class="btn btn--primary" (click)="openApply()" data-role="open-apply">
            <svg appIcon="heart-pulse" size="sm"></svg>Aplicar a escala
          </button>
        }
        <a class="btn" routerLink="/app/acompanhamento/arbe">Alertas de esgotamento</a>
      </app-page-header>

      @if (allRows().length === 0) {
        <app-empty-state
          title="Nenhum alerta aberto por aqui"
          text="Quando uma aplicação da escala indicar atenção, o caso aparece nesta fila para você acompanhar."
        >
          @if (canApply()) {
            <button type="button" class="btn btn--primary" (click)="openApply()">Aplicar a escala</button>
          }
          <a class="btn" routerLink="/app/acompanhamento/agregado">Ver o painel agregado</a>
        </app-empty-state>
      } @else {
        <app-data-table
          caption="Fila de acompanhamento"
          noun="cuidadores"
          [rows]="rows()"
          [columns]="columns()"
          [filtersActive]="filterValue() !== null || list.search() !== ''"
          [search]="list.search()"
          (searchChange)="list.search.set($event)"
          [sort]="list.sort()"
          (sortChange)="list.setSort($event)"
          searchable
          rowClickable
          (rowClick)="open($event)"
          (filtersCleared)="clearFilters()"
          emptyTitle="Nenhum caso neste filtro"
          emptyText="Tire o filtro para ver toda a fila."
        >
          <div appTableFilters class="cluster">
            <app-filter-chips label="Situação" [options]="chipOptions()" [value]="chipValue()" (valueChange)="setFilter($event)" />
          </div>
          <ng-template appCell="name" let-row>
            <span class="col-primary discreet">{{ row.name }}</span> <span class="code-chip">{{ row.code }}</span>
          </ng-template>
          <ng-template appCell="reasonText" let-row>
            <span data-role="reason">{{ row.reasonText }}</span>
            @if (row.extraText) {
              <span class="t-caption"> {{ row.extraText }}</span>
            }
          </ng-template>
          <ng-template appCell="score" let-row>
            @if (row.score !== null) {
              <app-zarit-band-badge [score]="row.score" />
            } @else {
              <span class="t-muted">Sem aplicação</span>
            }
          </ng-template>
          <ng-template appCell="deadline" let-row>
            @if (row.alert?.level === 'red' && row.alert?.deadlineAt && row.alert?.status === 'open') {
              <app-alert-countdown [deadlineAt]="row.alert.deadlineAt" />
            } @else if (row.dueDate) {
              <app-badge variant="attention" icon="calendar-days">{{ dueText(row.dueDate) }}</app-badge>
            } @else {
              <span class="t-muted">Sem prazo de relógio</span>
            }
          </ng-template>
          <ng-template appCell="actions" let-row let-selecting="selecting">
            <button
              type="button"
              class="btn btn--sm"
              [disabled]="selecting"
              [attr.aria-label]="actionAria(row)"
              (click)="open(row)"
              data-role="row-action"
            >
              {{ actionLabel(row) }}
            </button>
          </ng-template>
        </app-data-table>
        <app-active-filters [filters]="activeFilters()" (removed)="clearFilters()" (cleared)="clearFilters()" />
      }
    </div>

    <app-drawer [(open)]="applyOpen" heading="Aplicar a escala" subtitle="Escolha o cuidador. A escala só começa com o consentimento de saúde ativo.">
      <div class="stack stack--6" data-role="apply-form">
        <app-form-field label="Cuidador" controlId="apply-caregiver" [error]="applyError()" hint="Busque pelo nome ou pelo código e escolha na lista.">
          <input class="input mb-2" type="search" aria-label="Buscar cuidador por nome ou código" placeholder="Buscar cuidador" [value]="applyTerm()" (input)="applyTerm.set(valueOf($event))" />
          <select appInput [value]="applyCaregiver()" (change)="applyCaregiver.set(valueOf($event))" data-role="apply-select">
            <option value="">Escolha o cuidador</option>
            @for (c of applyOptions(); track c.id) {
              <option [value]="c.id" [selected]="c.id === applyCaregiver()">{{ c.fullName }} ({{ c.code }})</option>
            }
          </select>
        </app-form-field>
      </div>
      <ng-container drawerFooter>
        <button type="button" class="btn" (click)="applyOpen.set(false)">Voltar</button>
        <button type="button" class="btn btn--primary" (click)="startApply()" data-role="apply-start">Continuar</button>
      </ng-container>
    </app-drawer>
  `,
})
export class QueuePageComponent {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly auth = inject(AuthService);
  private readonly access = inject(ZaritAccessService);
  private readonly consent = inject(ConsentService);
  private readonly audit = inject(AuditLogService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });

  protected readonly valueOf = valueOf;
  protected readonly list = createListState({ key: 'zarit-queue', filterKeys: ['filtro'] });
  protected readonly canApply = computed(() => this.auth.role() === 'psychologist');
  protected readonly isSupervisor = computed(() => this.access.isSupervisor());

  protected readonly applyOpen = signal(false);
  protected readonly applyTerm = signal('');
  protected readonly applyCaregiver = signal('');
  protected readonly applyError = signal<string | null>(null);

  protected readonly filterValue = computed(() => this.list.filters()['filtro'] ?? null);

  /** A fila inteira do perfil (sem filtro). */
  protected readonly allRows = computed<QueueTableRow[]>(() => {
    const caregivers = this.access.visibleCaregivers();
    const names = new Map(caregivers.map((c) => [c.id, c] as const));
    const rows = buildQueue({
      caregivers,
      alerts: this.db.zaritAlerts.all(),
      arbe: this.db.arbeAlerts.all(),
      assessments: this.db.zaritAssessments.all(),
      consentActive: (id) => this.consent.isActive(id, 'health_data'),
      now: this.clock.now(),
      today: this.clock.today(),
    });
    return rows.map((row) => {
      const caregiver = names.get(row.caregiverId);
      return {
        ...row,
        id: row.caregiverId,
        name: caregiver?.fullName ?? 'Cuidador',
        code: caregiver?.code ?? '',
        psychologist: this.db.psychologists.get(caregiver?.assignedPsychologistId ?? '')?.displayName ?? '',
        reasonText: this.reasonText(row.reason, row),
        extraText: this.extraText(row),
      };
    });
  });

  protected readonly rows = computed(() => this.allRows().filter((r) => matchesFilter(r, this.filterValue())));
  protected readonly count = computed(() => `${this.rows().length} ${this.rows().length === 1 ? 'caso' : 'casos'}`);

  protected readonly chipOptions = computed<FilterOption[]>(() =>
    CHIPS.map((c) => ({ ...c, count: this.allRows().filter((r) => matchesFilter(r, c.value)).length })),
  );
  /** Só os quatro chips fixos aparecem marcados; chaves do sino (`contato-hoje`...) aparecem como filtro ativo. */
  protected readonly chipValue = computed(() => (CHIPS.some((c) => c.value === this.filterValue()) ? this.filterValue() : null));
  protected readonly activeFilters = computed<ActiveFilter[]>(() => {
    const value = this.filterValue();
    return value ? [{ key: 'filtro', label: `Filtro: ${FILTER_LABELS[value] ?? value}` }] : [];
  });

  protected readonly columns = computed<TableColumn<QueueTableRow>[]>(() => {
    const cols: TableColumn<QueueTableRow>[] = [
      { key: 'name', header: 'Cuidador', primary: true, sortable: true, searchText: (r) => `${r.name} ${r.code}` },
      { key: 'reasonText', header: 'Situação', sortable: true, sortValue: (r) => r.rank, noSearch: true },
      { key: 'score', header: 'Última pontuação', sortable: true, sortValue: (r) => r.score, noSearch: true },
      { key: 'deadline', header: 'Prazo', noSearch: true, sortable: true, sortValue: (r) => r.minutesLeft ?? Number.MAX_SAFE_INTEGER },
    ];
    if (this.isSupervisor()) {
      cols.push({ key: 'psychologist', header: 'Psicólogo', sortable: true });
    }
    cols.push({ key: 'actions', header: 'Ações', actions: true });
    return cols;
  });

  protected readonly applyOptions = computed(() => {
    const term = this.applyTerm().trim().toLowerCase();
    const selected = this.applyCaregiver();
    const all = this.access.visibleCaregivers().filter((c) => c.status === 'active');
    const found = all
      .filter((c) => !term || c.fullName.toLowerCase().includes(term) || c.code.toLowerCase().includes(term))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'pt-BR'))
      .slice(0, 30);
    const chosen = all.find((c) => c.id === selected);
    return chosen && !found.some((c) => c.id === selected) ? [chosen, ...found] : found;
  });

  constructor() {
    this.audit.view('zarit_queue', undefined, undefined, 'fila de acompanhamento aberta');
    // `?acao=aplicar` (paleta de comandos) abre a escolha do cuidador.
    effect(() => {
      if (this.query().get('acao') !== 'aplicar') {
        return;
      }
      untracked(() => {
        if (this.canApply()) {
          this.openApply();
        }
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { acao: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      });
    });
  }

  private reasonText(reason: QueueReason, row: QueueRow): string {
    switch (reason) {
      case 'red_overdue':
        return 'Prazo de contato vencido';
      case 'red_today':
        return row.alert?.status === 'open'
          ? 'Contato do mesmo dia pendente'
          : row.alert?.status === 'contacted'
            ? 'Avaliação do caso pendente'
            : 'Encerramento do caso pendente';
      case 'arbe_critical':
        return 'Alerta de esgotamento (ARBE): crítico';
      case 'yellow':
        return row.supportTaskPending ? 'Alerta amarelo: revisar rede de apoio' : 'Alerta amarelo em acompanhamento';
      case 'arbe_attention':
        return 'Alerta de esgotamento (ARBE): atenção';
      case 'zarit_overdue':
        return 'Aplicação da escala vencida';
      default:
        return 'Aplicação da escala a vencer';
    }
  }

  private extraText(row: QueueRow): string {
    const extras = row.reasons.slice(1);
    if (extras.length === 0) {
      return '';
    }
    const labels: Record<QueueReason, string> = {
      red_overdue: 'contato vencido',
      red_today: 'contato do dia',
      arbe_critical: 'ARBE crítico',
      yellow: 'alerta amarelo',
      arbe_attention: 'ARBE atenção',
      zarit_overdue: 'escala vencida',
      zarit_due: 'escala a vencer',
    };
    return `Também: ${extras.map((e) => labels[e]).join(', ')}.`;
  }

  protected dueText(due: string): string {
    const days = zaritDaysToDue(due, this.clock.today());
    if (days < 0) {
      return `Venceu em ${formatDate(due)}`;
    }
    return days === 0 ? 'Vence hoje' : `Vence em ${days} ${days === 1 ? 'dia' : 'dias'}`;
  }

  protected actionLabel(row: QueueTableRow): string {
    if (row.alert) {
      return 'Abrir alerta';
    }
    if (row.arbe) {
      return 'Ver alerta';
    }
    return this.canApply() ? 'Aplicar' : 'Ver histórico';
  }

  /** O botão diz a quem se refere (CX-031): "Aplicar a escala em Carla", para o leitor de tela não ouvir 35 "Aplicar". */
  protected actionAria(row: QueueTableRow): string {
    const label = this.actionLabel(row);
    if (label === 'Aplicar') {
      return `Aplicar a escala em ${row.name}`;
    }
    return `${label} de ${row.name}`;
  }

  protected open(row: QueueTableRow): void {
    if (row.alert) {
      void this.router.navigate(['/app/acompanhamento/alertas', row.alert.id]);
    } else if (row.arbe) {
      void this.router.navigate(['/app/acompanhamento/arbe']);
    } else if (this.canApply()) {
      void this.router.navigate(['/app/acompanhamento/zarit', row.caregiverId, 'nova']);
    } else {
      void this.router.navigate(['/app/acompanhamento/cuidador', row.caregiverId]);
    }
  }

  protected setFilter(value: string | null): void {
    this.list.setFilter('filtro', value);
  }

  protected clearFilters(): void {
    this.list.clear();
  }

  protected openApply(): void {
    this.applyTerm.set('');
    this.applyCaregiver.set('');
    this.applyError.set(null);
    this.applyOpen.set(true);
  }

  protected startApply(): void {
    const id = this.applyCaregiver();
    if (!id) {
      this.applyError.set('Escolha o cuidador que vai responder à escala.');
      return;
    }
    this.applyOpen.set(false);
    void this.router.navigate(['/app/acompanhamento/zarit', id, 'nova']);
  }
}
