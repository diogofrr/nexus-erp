import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Clock } from '@core/clock';
import { Database } from '@core/data';
import { formatDate } from '@core/format';
import { Accreditation, AccreditationStatus, Provider } from '@core/models';
import { isDocumentExpired } from '@core/rules';
import {
  BadgeComponent,
  EmptyStateComponent,
  FilterChipsComponent,
  FilterOption,
  KanbanBoardComponent,
  KanbanCardDirective,
  KanbanColumn,
  PageHeaderComponent,
  createListState,
} from '@shared/ui';
import { NetworkAdminService } from '../state/network-admin.service';
import { ACCREDITATION_STATUS_LABEL, categoryLabel, pluralize } from '../state/network-labels';

interface ProcessCard {
  id: string;
  name: string;
  category: string;
  missing: string;
  expired: boolean;
  integrationPending: boolean;
  dateText: string;
}

const COLUMN_ORDER: readonly AccreditationStatus[] = [
  'requested',
  'in_review',
  'pending_documents',
  'approved',
  'rejected',
];

const FILTERS: readonly FilterOption[] = [
  { value: 'documento-vencido', label: 'Documento vencido' },
  { value: 'integracao-pendente', label: 'Integração pendente' },
];

/**
 * Credenciamento (SCR-M08-03, PD-06): quadro por estado, somente leitura. Nada se arrasta: o processo muda de
 * estado por decisão, na tela do processo (A-32, WCAG 2.5.7). Cada cartão diz em uma frase o que falta. No
 * celular o quadro vira lista por estado.
 */
@Component({
  selector: 'app-network-accreditation-board-page',
  imports: [
    RouterLink,
    BadgeComponent,
    EmptyStateComponent,
    FilterChipsComponent,
    KanbanBoardComponent,
    KanbanCardDirective,
    PageHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header
        title="Credenciamento"
        [count]="countText()"
        description="Os candidatos por estado. Abra um cartão para conferir os critérios e decidir."
      >
        @if (manager()) {
          <a class="btn btn--primary" routerLink="/app/rede/credenciamento/novo" data-role="new-process">
            Novo credenciamento
          </a>
        }
      </app-page-header>

      <div class="stack stack--6">
        <app-filter-chips
          label="Atenção"
          [options]="filterOptions"
          [value]="list.filters()['filtro'] ?? null"
          allLabel="Todos os processos"
          (valueChange)="list.setFilter('filtro', $event)"
        />

        @if (total() === 0) {
          <div class="card">
            <app-empty-state
              title="Nenhum processo de credenciamento"
              text="Quando um prestador pedir para entrar na rede, o processo aparece aqui com os critérios a conferir."
            >
              @if (manager()) {
                <a class="btn btn--primary" routerLink="/app/rede/credenciamento/novo">Abrir um processo</a>
              }
            </app-empty-state>
          </div>
        } @else {
          <app-kanban-board [columns]="columns()" emptyText="Nenhum processo aqui." (cardOpened)="open($event.item)">
            <ng-template appKanbanCard let-card>
              <strong>{{ card.name }}</strong>
              <span class="t-caption block">{{ card.category }}</span>
              <span class="t-caption block">{{ card.missing }}</span>
              <span class="t-caption block">Desde {{ card.dateText }}</span>
              @if (card.expired) {
                <app-badge variant="danger" icon="circle-alert">Documento vencido</app-badge>
              }
              @if (card.integrationPending) {
                <app-badge variant="attention" icon="clock">Integração pendente</app-badge>
              }
            </ng-template>
          </app-kanban-board>
        }
      </div>
    </div>
  `,
})
export class AccreditationBoardPage {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly router = inject(Router);
  private readonly admin = inject(NetworkAdminService);

  readonly list = createListState({ key: 'network-accreditation', filterKeys: ['filtro'] });

  protected readonly filterOptions = FILTERS;
  protected readonly manager = computed(() => this.admin.isManager());

  private readonly cards = computed(() => {
    const today = this.clock.today();
    const providers = new Map(this.db.providers.all().map((p) => [p.id, p] as const));
    const documents = this.db.providerDocuments.all();
    const filter = this.list.filters()['filtro'];
    return this.db.accreditations
      .all()
      .filter((a) => a.status !== 'active')
      .map((a) => ({ accreditation: a, provider: providers.get(a.providerId) }))
      .filter((x): x is { accreditation: Accreditation; provider: Provider } => x.provider !== undefined)
      .map(({ accreditation, provider }) => {
        const expired = documents.some((d) => d.providerId === provider.id && isDocumentExpired(d, today));
        const integrationPending = accreditation.status === 'approved' && !provider.integrationDoneAt;
        const missing = this.admin.missingCount(accreditation);
        const card: ProcessCard & { status: AccreditationStatus; createdAt: string } = {
          id: accreditation.id,
          name: provider.name,
          category: categoryLabel(provider.category),
          missing:
            accreditation.status === 'rejected'
              ? `Reprovado${accreditation.decidedAt ? ` em ${formatDate(accreditation.decidedAt)}` : ''}`
              : accreditation.status === 'approved'
                ? provider.integrationDoneAt
                  ? 'Falta ativar o prestador'
                  : 'Falta concluir a integração'
                : missing === 0
                  ? 'Todos os critérios cumpridos'
                  : `Faltam ${pluralize(missing, 'critério', 'critérios')}`,
          expired,
          integrationPending,
          dateText: formatDate(accreditation.createdAt),
          status: accreditation.status,
          createdAt: accreditation.createdAt,
        };
        return card;
      })
      .filter((c) => {
        if (filter === 'documento-vencido') {
          return c.expired;
        }
        if (filter === 'integracao-pendente') {
          return c.integrationPending;
        }
        return true;
      })
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  });

  protected readonly total = computed(() => this.cards().length);
  protected readonly countText = computed(() => {
    const n = this.total();
    return `${n} ${n === 1 ? 'processo' : 'processos'}`;
  });

  protected readonly columns = computed<KanbanColumn<ProcessCard>[]>(() =>
    COLUMN_ORDER.map((status) => ({
      id: status,
      label: ACCREDITATION_STATUS_LABEL[status],
      items: this.cards().filter((c) => c.status === status),
    })),
  );

  protected open(card: ProcessCard): void {
    void this.router.navigate(['/app/rede/credenciamento', card.id]);
  }
}
