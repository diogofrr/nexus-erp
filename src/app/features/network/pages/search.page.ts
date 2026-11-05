import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Database } from '@core/data';
import { formatNumber } from '@core/format';
import { ProviderCategory } from '@core/models';
import { NetworkService, ProviderSummary } from '@core/network';
import { isSearchable, searchProviders } from '@core/rules';
import {
  BadgeComponent,
  EmptyStateComponent,
  FilterChipsComponent,
  FilterOption,
  PageHeaderComponent,
  createListState,
} from '@shared/ui';
import { BannerComponent } from '@shared/ui/overlay';
import { categoryLabel, councilText } from '../state/network-labels';

/**
 * Busca como o usuário vê (SCR-M08-09, RN-REDE-10, 17 a 19, 30): simula a busca por especialidade. Mostra todos
 * os ativos e em monitoramento da especialidade, com o destaque da excelência primeiro e sem esconder os demais;
 * suspensos e descredenciados não aparecem. Uma só opção vem com o aviso "única opção disponível"; nenhuma opção
 * sugere o encaminhamento. A zona de monitoramento não é exibida ao usuário (só a gestão vê a marca aqui).
 */
@Component({
  selector: 'app-network-search-page',
  imports: [
    RouterLink,
    BadgeComponent,
    BannerComponent,
    EmptyStateComponent,
    FilterChipsComponent,
    PageHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header
        title="Busca como o usuário vê"
        description="Escolha a especialidade para ver as opções que o usuário recebe, na ordem em que aparecem."
      />
      <div class="stack stack--6">
        <app-filter-chips
          label="Especialidade"
          [options]="options()"
          [value]="selected()"
          allLabel=""
          (valueChange)="choose($event)"
        />

        @if (outcome(); as result) {
          <section class="stack stack--3" aria-labelledby="nx-search-title" data-role="search-result" [attr.data-availability]="result.availability">
            <h2 class="card__title" id="nx-search-title">
              {{ categoryText() }}: {{ countText() }}
            </h2>
            @if (result.availability === 'single_option') {
              <app-banner variant="info" heading="Única opção disponível no momento">
                Só um prestador está na busca desta especialidade. Ele aparece para o usuário com este aviso.
              </app-banner>
            }
            @if (result.availability === 'none') {
              <div class="card">
                <app-empty-state
                  title="Nenhuma opção disponível no momento"
                  text="Nenhum prestador desta especialidade está na busca. Sugerimos orientar o usuário pela rede de apoio."
                >
                  <a class="btn" routerLink="/app/governanca/encaminhamentos" data-role="to-referral">Ver encaminhamentos</a>
                </app-empty-state>
              </div>
            } @else {
              <ol class="stack stack--3" aria-label="Opções na ordem da busca">
                @for (row of rows(); track row.id) {
                  <li class="card card--pad stack stack--2" data-role="search-option" [attr.data-provider]="row.id">
                    <div class="cluster cluster--between">
                      <h3 class="card__title">
                        <a [routerLink]="['/app/rede/prestadores', row.id]">{{ row.name }}</a>
                      </h3>
                      <div class="cluster">
                        @if (row.highlight) {
                          <app-badge variant="success" icon="award">Em destaque</app-badge>
                        }
                        @if (row.monitoring) {
                          <app-badge variant="attention" outline icon="triangle-alert">Em monitoramento (só a gestão vê)</app-badge>
                        }
                      </div>
                    </div>
                    <p class="t-ui">{{ row.specialty }} · {{ row.council }} · {{ row.city }}</p>
                    <p class="t-ui">
                      @if (row.average !== null) {
                        Nota <strong class="t-num">{{ row.average }}</strong> ({{ row.count }} avaliações)
                      } @else {
                        Ainda sem média de avaliações
                      }
                      · {{ row.home ? 'Atende em domicílio' : 'Atendimento no local do prestador' }}
                    </p>
                    <p class="t-caption">{{ row.conditions }}</p>
                  </li>
                }
              </ol>
              <p class="t-caption">
                A Nexus organiza a rede e não presta o serviço. A escolha é da família e o pagamento é feito direto ao profissional.
              </p>
            }
            @if (hidden().length > 0) {
              <section class="card card--sunken card--pad stack stack--2" data-role="hidden-from-search" aria-labelledby="nx-hidden-title">
                <h3 class="card__title" id="nx-hidden-title">Fora da busca nesta especialidade</h3>
                <ul class="stack stack--2">
                  @for (item of hidden(); track item.id) {
                    <li>
                      <a [routerLink]="['/app/rede/prestadores', item.id]">{{ item.name }}</a>
                      <span class="t-caption"> ({{ item.status }})</span>
                    </li>
                  }
                </ul>
              </section>
            }
          </section>
        }
      </div>
    </div>
  `,
})
export class SearchPage {
  private readonly db = inject(Database);
  private readonly network = inject(NetworkService);

  readonly list = createListState({ key: 'network-search', filterKeys: ['categoria'] });

  protected readonly options = computed<FilterOption[]>(() => {
    const present = new Set<ProviderCategory>(
      this.db.providers.all().filter((p) => p.status !== 'candidate' && p.status !== 'rejected').map((p) => p.category),
    );
    return [...present]
      .map((value) => ({ value, label: categoryLabel(value) }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  });

  protected readonly selected = computed<string | null>(() => {
    const wanted = this.list.filters()['categoria'];
    const options = this.options();
    return options.find((o) => o.value === wanted)?.value ?? options[0]?.value ?? null;
  });

  protected readonly categoryText = computed(() => {
    const value = this.selected();
    return value ? categoryLabel(value as ProviderCategory) : '';
  });

  private readonly summaries = computed(() => {
    const category = this.selected();
    return category ? this.network.summaries().filter((s) => s.provider.category === category) : [];
  });

  protected readonly outcome = computed(() => {
    const category = this.selected() as ProviderCategory | null;
    if (!category) {
      return null;
    }
    const byId = new Map<string, ProviderSummary>(this.summaries().map((s) => [s.provider.id, s] as const));
    return searchProviders(
      this.summaries().map((s) => s.provider),
      category,
      (p) => byId.get(p.id)?.average ?? null,
    );
  });

  protected readonly rows = computed(() => {
    const result = this.outcome();
    if (!result) {
      return [];
    }
    const byId = new Map<string, ProviderSummary>(this.summaries().map((s) => [s.provider.id, s] as const));
    return result.options.map((p) => {
      const s = byId.get(p.id);
      return {
        id: p.id,
        name: p.name,
        specialty: p.specialtyLabel,
        council: councilText(p.council),
        city: p.city,
        home: p.homeCare,
        conditions: p.conditionsForNexusUsers,
        highlight: p.highlight,
        monitoring: p.status === 'monitoring',
        average: s?.average === null || s === undefined ? null : formatNumber(s.average, 2),
        count: s?.evaluationCount ?? 0,
      };
    });
  });

  protected readonly countText = computed(() => {
    const n = this.rows().length;
    return n === 0 ? 'nenhuma opção' : n === 1 ? '1 opção' : `${n} opções`;
  });

  protected readonly hidden = computed(() =>
    this.summaries()
      .filter((s) => !isSearchable(s.provider.status) && s.provider.status !== 'candidate' && s.provider.status !== 'rejected')
      .map((s) => ({
        id: s.provider.id,
        name: s.provider.name,
        status: s.provider.status === 'suspended' ? 'suspenso' : 'descredenciado',
      })),
  );

  protected choose(value: string | null): void {
    this.list.setFilter('categoria', value);
  }

}
