import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Database } from '@core/data';
import { formatDate, formatNumber } from '@core/format';
import { GraveCategory } from '@core/models';
import {
  BadgeComponent,
  CellDirective,
  DataTableComponent,
  FilterChipsComponent,
  FilterOption,
  PageHeaderComponent,
  RadioOption,
  TableColumn,
  createListState,
} from '@shared/ui';
import { ToastService } from '@shared/ui/overlay';
import { ReasonDrawerComponent, ReasonSubmit } from '../components/reason-drawer.component';
import { NetworkAdminService } from '../state/network-admin.service';
import { GRAVE_CATEGORY_LABEL } from '../state/network-labels';

interface EvaluationRow {
  id: string;
  createdAt: string;
  dateText: string;
  providerId: string;
  provider: string;
  technical: number;
  punctuality: number;
  scoreText: string;
  comment: string;
  caregiver: string;
  grave: GraveCategory | undefined;
}

const FILTERS: readonly FilterOption[] = [
  { value: 'graves', label: 'Reclamações graves' },
  { value: 'comentadas', label: 'Com comentário' },
];

const GRAVE_OPTIONS: readonly RadioOption<string>[] = (
  Object.entries(GRAVE_CATEGORY_LABEL) as [GraveCategory, string][]
).map(([value, label]) => ({ value, label }));

/**
 * Avaliações da rede (SCR-M08-06): as duas notas de cada serviço (qualidade técnica e pontualidade com
 * cordialidade), o comentário e a classificação de "reclamação grave", que conta na ARP do prestador
 * (RN-ARP-09). A gestão vê o cuidador pelo código; o atendimento, pelo nome. A avaliação é registrada em
 * Solicitações, no serviço concluído.
 */
@Component({
  selector: 'app-network-evaluations-page',
  imports: [
    RouterLink,
    BadgeComponent,
    CellDirective,
    DataTableComponent,
    FilterChipsComponent,
    PageHeaderComponent,
    ReasonDrawerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header
        title="Avaliações da rede"
        [count]="countText()"
        [description]="description()"
      >
        @if (canEvaluate()) {
          <a class="btn btn--primary" routerLink="/app/rede/solicitacoes" [queryParams]="{ estado: 'sem-avaliacao' }" data-role="to-register">
            Registrar avaliação
          </a>
        }
      </app-page-header>

      <app-data-table
        caption="Avaliações dos prestadores"
        noun="avaliações"
        [rows]="visibleRows()"
        [columns]="columns"
        searchable
        searchLabel="Buscar avaliação"
        searchPlaceholder="Buscar por prestador ou comentário"
        [filtersActive]="list.hasActive()"
        emptyTitle="Nenhuma avaliação por aqui"
        emptyText="Quando um usuário avaliar um serviço concluído, a avaliação aparece nesta lista."
        (filtersCleared)="list.clear()"
      >
        <div appTableFilters class="cluster">
          <app-filter-chips
            label="Tipo de avaliação"
            [options]="filters"
            [value]="list.filters()['filtro'] ?? null"
            (valueChange)="list.setFilter('filtro', $event)"
          />
          @if (list.filters()['prestador']; as providerId) {
            <span class="chip chip--removable">
              Prestador: {{ providerName(providerId) }}
              <button type="button" class="chip__remove" aria-label="Remover filtro de prestador" (click)="list.setFilter('prestador', null)">x</button>
            </span>
          }
        </div>
        <ng-template appCell="provider" let-row>
          <a class="row-link" [routerLink]="['/app/rede/prestadores', row.providerId]">{{ row.provider }}</a>
        </ng-template>
        <ng-template appCell="caregiver" let-row><span class="discreet">{{ row.caregiver }}</span></ng-template>
        <ng-template appCell="grave" let-row>
          @if (row.grave) {
            <app-badge variant="danger" icon="flag">{{ graveText(row.grave) }}</app-badge>
          } @else if (manager()) {
            <button type="button" class="btn btn--sm" data-role="classify-grave" (click)="start(row.id)">
              Classificar como grave
            </button>
          } @else {
            <span class="t-muted">Não</span>
          }
        </ng-template>
      </app-data-table>
    </div>

    <app-reason-drawer
      [(open)]="graveOpen"
      heading="Classificar como reclamação grave"
      [subtitle]="targetProvider()"
      optionsLabel="Categoria da reclamação"
      [options]="graveOptions"
      optionRequiredMessage="Escolha a categoria da reclamação grave."
      label="Observação"
      [textRequired]="false"
      confirmLabel="Classificar como grave"
      effect="Reclamações graves contam na avaliação do prestador. Três ou mais levam à suspensão da busca e à avaliação interna."
      [error]="actionError()"
      (submitted)="classify($event)"
    />
  `,
})
export class EvaluationsPage {
  private readonly db = inject(Database);
  private readonly admin = inject(NetworkAdminService);
  private readonly toasts = inject(ToastService);

  readonly list = createListState({ key: 'network-evaluations', filterKeys: ['filtro', 'prestador'] });

  protected readonly filters = FILTERS;
  protected readonly graveOptions = GRAVE_OPTIONS;
  protected readonly graveOpen = signal(false);
  protected readonly actionError = signal<string | null>(null);
  private readonly target = signal<string | null>(null);

  protected readonly manager = computed(() => this.admin.isManager());
  protected readonly canEvaluate = computed(() => this.admin.canRegisterEvaluations());
  protected readonly description = computed(() =>
    this.manager()
      ? 'Notas e comentários dos serviços da rede. O cuidador aparece pelo código.'
      : 'Notas e comentários dos serviços da rede.',
  );

  protected readonly columns: TableColumn<EvaluationRow>[] = [
    { key: 'dateText', header: 'Data', primary: true, sortable: true, sortValue: (r) => r.createdAt },
    { key: 'provider', header: 'Prestador', sortable: true, value: (r) => r.provider },
    { key: 'technical', header: 'Qualidade técnica', align: 'end', sortable: true, noSearch: true },
    { key: 'punctuality', header: 'Pontualidade e cordialidade', align: 'end', sortable: true, noSearch: true },
    { key: 'scoreText', header: 'Nota', align: 'end', noSearch: true },
    { key: 'comment', header: 'Comentário' },
    { key: 'caregiver', header: 'Cuidador', value: (r) => r.caregiver },
    { key: 'grave', header: 'Reclamação grave', noSearch: true },
  ];

  private readonly rows = computed<EvaluationRow[]>(() => {
    const providers = new Map(this.db.providers.all().map((p) => [p.id, p.name] as const));
    return this.db.providerEvaluations
      .all()
      .map((e) => ({
        id: e.id,
        createdAt: e.createdAt,
        dateText: formatDate(e.createdAt),
        providerId: e.providerId,
        provider: providers.get(e.providerId) ?? 'Prestador removido',
        technical: e.technicalQuality,
        punctuality: e.punctualityCourtesy,
        scoreText: formatNumber(e.score, 1),
        comment: e.comment ?? 'Sem comentário',
        caregiver: this.admin.caregiverLabel(e.caregiverId).text,
        grave: e.grave?.category,
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });

  protected readonly visibleRows = computed(() => {
    const { filtro, prestador } = this.list.filters();
    return this.rows().filter((row) => {
      if (prestador && row.providerId !== prestador) {
        return false;
      }
      if (filtro === 'graves') {
        return row.grave !== undefined;
      }
      if (filtro === 'comentadas') {
        return row.comment !== 'Sem comentário';
      }
      return true;
    });
  });

  protected readonly countText = computed(() => {
    const n = this.visibleRows().length;
    return `${formatNumber(n)} ${n === 1 ? 'avaliação' : 'avaliações'}`;
  });

  protected readonly targetProvider = computed(() => {
    const id = this.target();
    const evaluation = id ? this.db.providerEvaluations.get(id) : undefined;
    return evaluation ? (this.db.providers.get(evaluation.providerId)?.name ?? '') : '';
  });

  protected providerName(id: string): string {
    return this.db.providers.get(id)?.name ?? '';
  }

  protected graveText(category: GraveCategory): string {
    return GRAVE_CATEGORY_LABEL[category];
  }

  protected start(id: string): void {
    this.target.set(id);
    this.actionError.set(null);
    this.graveOpen.set(true);
  }

  protected classify(input: ReasonSubmit): void {
    const id = this.target();
    if (!id || !input.choice) {
      return;
    }
    const result = this.admin.classifyGrave(id, input.choice as GraveCategory);
    if (!result.ok) {
      this.actionError.set(result.error);
      return;
    }
    this.actionError.set(null);
    this.graveOpen.set(false);
    this.toasts.success(
      result.value.suspended
        ? `Classificada como grave. ${result.value.message}`
        : 'Classificada como grave. Ela já conta na próxima auditoria.',
    );
  }
}
