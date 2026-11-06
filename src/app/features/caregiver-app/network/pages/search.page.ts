import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProviderCategory } from '../../../../core/models';
import { CaregiverNetworkService, ProviderPublicView } from '../../../../core/network/caregiver-network.service';
import { BadgeComponent } from '../../../../shared/ui/display/badge.component';
import { EmptyStateComponent } from '../../../../shared/ui/display/empty-state.component';
import { IconComponent } from '../../../../shared/ui/display/icon.component';
import { FormFieldComponent } from '../../../../shared/ui/forms/form-field.component';
import { NxInputDirective } from '../../../../shared/ui/forms/input.directive';
import { CaregiverContextService } from '../../state/caregiver-context.service';
import { ContactDialogService } from '../../state/contact-dialog.service';
import { CgNoteComponent } from '../../ui/cg-note.component';
import { CgPageHeaderComponent } from '../../ui/cg-page-header.component';
import { CgSheetComponent } from '../../ui/cg-sheet.component';
import { CATEGORIES, CONDITIONS_FROM_ESSENCIAL, categoryLabel, parseCategory, ratingShort, ratingText } from '../state/network-copy';

/** No máximo 3 profissionais lado a lado (UX C13). */
const MAX_COMPARE = 3;

/** Uma linha da comparação: o que é e o que cada profissional tem (na ordem das colunas). */
interface CompareRow {
  key: 'rating' | 'home' | 'conditions';
  label: string;
  cells: string[];
}

/**
 * Buscar profissionais e serviços (UX C13, `/cuidador/rede/buscar`). O campo "Buscar pelo nome" (o texto NUNCA vai para a URL,
 * AC-CG-122), as 10 necessidades em botões de 56 px (`?categoria=`) e a lista em cartões. Sempre MAIS DE UMA opção quando
 * existir; se só há uma, "Única opção disponível no momento." e ela não some; se não há nenhuma, "Nenhuma opção em ... por
 * enquanto" com **Falar com a gente** (RN-REDE-10). A ordem é "em destaque primeiro, depois ordem alfabética" (S-08): o destaque
 * nunca tira ninguém da lista e nenhum texto diz "recomendado" (RN-REDE-19, RN-ATD-13). A nota só aparece com 5 avaliações ou
 * mais. NUNCA aparecem suspenso, descredenciado ou candidato, nem faixa de monitoramento, "risco de saída", taxa de recusa ou
 * comissão (RN-REDE-18 e 30): o núcleo só entrega a ficha pública. "Só quem atende em casa" filtra; "Comparar" põe 2 ou 3 lado a
 * lado numa tabela curta (nota, atende em casa, condições) que só mostra o que MUDA entre eles; o que é igual vem numa linha
 * "Igual nas duas opções". No Livre a linha de condições diz "a partir do plano Essencial". Escolher uma necessidade leva a tela
 * até os resultados (CXC-011).
 */
@Component({
  selector: 'app-cg-search-page',
  imports: [
    RouterLink,
    BadgeComponent,
    EmptyStateComponent,
    IconComponent,
    FormFieldComponent,
    NxInputDirective,
    CgNoteComponent,
    CgPageHeaderComponent,
    CgSheetComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .nx-cats { display: grid; gap: 0.5rem; grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 0; padding: 0; list-style: none; }
      @media (min-width: 48rem) { .nx-cats { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
      .nx-cat { display: flex; align-items: center; justify-content: center; gap: 0.5rem; width: 100%; min-height: var(--cg-target-lg); padding: 0.5rem 0.75rem; border: 2px solid var(--cg-action); border-radius: var(--cg-radius-control); background: var(--cg-surface); color: var(--cg-heading); font: inherit; font-weight: var(--fw-semibold); text-align: center; cursor: pointer; }
      .nx-cat[aria-pressed='true'] { background: var(--cg-action); color: #fff; }
      .nx-toggle { justify-content: flex-start; }
      .nx-results { display: grid; gap: var(--cg-gap-stack); margin: 0; padding: 0; list-style: none; grid-template-columns: minmax(0, 1fr); }
      @media (min-width: 64rem) { .nx-results { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      .nx-result { position: relative; display: grid; gap: 0.5rem; align-content: start; padding: var(--cg-pad-card); border: 1px solid var(--cg-border); border-radius: var(--cg-radius-card); background: var(--cg-surface); }
      .nx-result__title { margin: 0; }
      .nx-result__link { color: var(--cg-heading); text-decoration: none; overflow-wrap: anywhere; }
      .nx-result__link::after { content: ''; position: absolute; inset: 0; border-radius: var(--cg-radius-card); }
      .nx-result__link:focus-visible { outline: none; }
      .nx-result__link:focus-visible::after { outline: 3px solid var(--cg-focus); outline-offset: 3px; }
      .nx-result .check { position: relative; z-index: 1; width: fit-content; min-height: var(--cg-target); }
      #search-results { scroll-margin-top: calc(var(--cg-header-h) + 0.75rem); outline: none; }
      .nx-compare { width: 100%; border-collapse: collapse; table-layout: fixed; }
      .nx-compare th, .nx-compare td { padding: 0.5rem; border-bottom: 1px solid var(--cg-border-subtle); text-align: left; vertical-align: top; overflow-wrap: anywhere; }
      .nx-compare thead th { color: var(--cg-heading); font-weight: var(--fw-semibold); }
      .nx-compare tbody th { color: var(--cg-text-soft); font-size: var(--cg-fs-small); font-weight: var(--fw-semibold); width: 28%; }
      .nx-compare-same { display: grid; gap: 0.25rem; }
      .nx-compare-same h3, .nx-compare-same p, .nx-compare-same ul { margin: 0; }
      .nx-compare-same ul { padding-left: 1.25rem; }
      /* No celular a tabela vira blocos: o que muda, e embaixo o valor de cada profissional, com o nome. */
      @media (max-width: 40rem) {
        .nx-compare, .nx-compare tbody, .nx-compare tr, .nx-compare th, .nx-compare td { display: block; width: auto; }
        .nx-compare thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
        .nx-compare tbody th { padding-bottom: 0; border-bottom: 0; }
        .nx-compare td::before { content: attr(data-label) ': '; font-weight: var(--fw-semibold); color: var(--cg-heading); }
        .nx-compare td { padding-block: 0.125rem; border-bottom: 0; }
        .nx-compare tr { padding-bottom: 0.5rem; border-bottom: 1px solid var(--cg-border-subtle); }
      }
    `,
  ],
  template: `
    <app-cg-page-header title="Buscar" backLink="/cuidador/rede" backLabel="Rede" />
    <div class="cg-stack">
      <app-form-field label="Buscar pelo nome" optional controlId="search-name">
        <input appInput type="search" autocomplete="off" [value]="name()" (input)="onName($event)" />
      </app-form-field>

      <section aria-labelledby="search-needs">
        <h2 class="cg-section__title" id="search-needs">O que você procura?</h2>
        <ul class="nx-cats">
          @for (c of categories; track c.value) {
            <li>
              <button type="button" class="nx-cat" [attr.aria-pressed]="category() === c.value" [attr.data-category]="c.value" (click)="chooseCategory(c.value)">
                @if (category() === c.value) {
                  <svg appIcon="check" size="sm"></svg>
                }
                {{ c.label }}
              </button>
            </li>
          }
        </ul>
      </section>

      @if (category() || trimmedName()) {
        <section aria-labelledby="search-results" class="cg-stack cg-stack--tight">
          <h2 class="cg-section__title" id="search-results" data-role="count" tabindex="-1">{{ countText() }}</h2>

          @if (category()) {
            <button type="button" class="nx-cat nx-toggle" data-role="home-filter" [attr.aria-pressed]="homeOnly()" (click)="toggleHome()">
              @if (homeOnly()) {
                <svg appIcon="check" size="sm"></svg>
              }
              Só quem atende em casa
            </button>
            @if (categoryTotal() === 1) {
              <app-cg-note variant="info" data-role="single">Única opção disponível no momento.</app-cg-note>
            }
          }

          @if (results().length === 0) {
            @if (category(); as current) {
              @if (categoryTotal() === 0) {
                <app-empty-state [title]="'Nenhuma opção em ' + label(current) + ' por enquanto'" text="Estamos ampliando a rede. A equipe pode ajudar a procurar." data-role="empty">
                  <button type="button" class="btn" (click)="talk()">Falar com a gente</button>
                </app-empty-state>
              } @else {
                <app-empty-state [title]="'Ninguém atende em casa em ' + label(current)" text="Desligue o filtro para ver todas as opções." data-role="empty">
                  <button type="button" class="btn" (click)="toggleHome()">Ver todas as opções</button>
                </app-empty-state>
              }
            } @else {
              <app-empty-state [title]="'Nada encontrado para ' + trimmedName()" text="Confira o nome ou escolha uma necessidade." data-role="empty" />
            }
          } @else {
            @if (selected().length >= maxCompare) {
              <app-cg-note variant="soft" icon="info" data-role="compare-limit">Você já escolheu 3. Desmarque um para comparar outro.</app-cg-note>
            }
            <ul class="nx-results" aria-label="Resultados da busca">
              @for (p of results(); track p.id) {
                <li class="nx-result" data-role="result">
                  <h3 class="cg-card__title nx-result__title">
                    <a class="nx-result__link" [routerLink]="['/cuidador/rede/profissional', p.id]">{{ p.name }}</a>
                  </h3>
                  <p class="cg-meta">{{ p.specialtyLabel }} · {{ p.city }}</p>
                  @if (p.homeCare || p.highlight) {
                    <p class="cg-tags">
                      @if (p.homeCare) {
                        <app-badge variant="info" icon="house">Atende em casa</app-badge>
                      }
                      @if (p.highlight) {
                        <app-badge variant="success" icon="award">Em destaque</app-badge>
                      }
                    </p>
                  }
                  <p class="cg-meta" data-role="rating">{{ rating(p) }}</p>
                  <label class="check">
                    <input
                      type="checkbox"
                      [checked]="isSelected(p.id)"
                      [disabled]="!isSelected(p.id) && selected().length >= maxCompare"
                      [attr.aria-label]="'Comparar ' + p.name"
                      (change)="toggleCompare(p.id)"
                    />
                    <span>Comparar</span>
                  </label>
                </li>
              }
            </ul>
          }
        </section>
      }

      @if (selected().length >= 2) {
        <div class="cg-action-bar">
          <button type="button" class="btn btn--primary" data-role="compare" (click)="compareOpen.set(true)">
            Comparar escolhidos ({{ selected().length }})
          </button>
        </div>
      }
    </div>

    <app-cg-sheet heading="Lado a lado" [(open)]="compareOpen">
      <table class="nx-compare" data-role="compare-table">
        <caption class="sr-only">Comparação das opções escolhidas</caption>
        <thead>
          <tr>
            <th scope="col"><span class="sr-only">O que muda</span></th>
            @for (p of compared(); track p.id) {
              <th scope="col" data-role="compare-name">{{ p.name }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of changingRows(); track row.key) {
            <tr data-role="compare-row">
              <th scope="row">{{ row.label }}</th>
              @for (cell of row.cells; track $index) {
                <td [attr.data-label]="compared()[$index]?.name">{{ cell }}</td>
              }
            </tr>
          }
          <tr data-role="compare-links">
            <th scope="row">Ficha</th>
            @for (p of compared(); track p.id) {
              <td [attr.data-label]="p.name"><a class="cg-link-btn" [routerLink]="['/cuidador/rede/profissional', p.id]">Ver ficha<span class="sr-only"> de {{ p.name }}</span></a></td>
            }
          </tr>
        </tbody>
      </table>
      @if (sameLines().length > 0) {
        <section class="nx-compare-same" data-role="compare-same" aria-labelledby="compare-same-title">
          <h3 class="cg-card__title" id="compare-same-title">Igual {{ compared().length === 2 ? 'nas duas' : 'nas ' + compared().length }} opções</h3>
          <ul>
            @for (line of sameLines(); track line) {
              <li>{{ line }}</li>
            }
          </ul>
        </section>
      }
      <ng-container cgSheetActions>
        <button type="button" class="cg-link-btn" (click)="compareOpen.set(false)">Voltar</button>
      </ng-container>
    </app-cg-sheet>
  `,
})
export class SearchPage {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly network = inject(CaregiverNetworkService);
  private readonly contact = inject(ContactDialogService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly ctx = inject(CaregiverContextService);

  protected readonly categories = CATEGORIES;
  protected readonly maxCompare = MAX_COMPARE;

  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly category = computed(() => parseCategory(this.params().get('categoria')));
  protected readonly homeOnly = computed(() => this.params().get('casa') === '1');

  /** O texto do nome fica só em memória (nunca na URL). */
  protected readonly name = signal('');
  protected readonly trimmedName = computed(() => this.name().trim());

  protected readonly selected = signal<string[]>([]);
  protected readonly compareOpen = signal(false);

  protected readonly results = computed<ProviderPublicView[]>(() =>
    this.network.search({ category: this.category(), name: this.name(), homeOnly: this.homeOnly() }),
  );
  /** Quantos profissionais a necessidade tem no total (sem filtro): decide "única opção" e "nenhuma opção" (RN-REDE-10). */
  protected readonly categoryTotal = computed(() => {
    const category = this.category();
    return category ? this.network.countIn(category) : 0;
  });

  protected readonly countText = computed(() => {
    const n = this.results().length;
    const category = this.category();
    if (category) {
      const where = this.homeOnly() ? ` que atendem em casa em ${categoryLabel(category)}` : ` em ${categoryLabel(category)}`;
      return n === 1 ? `1 opção${where}.` : `${n} opções${where}.`;
    }
    return n === 1 ? '1 resultado.' : `${n} resultados.`;
  });

  protected readonly compared = computed(() => {
    const ids = new Set(this.selected());
    return this.network.searchable().filter((p) => ids.has(p.id));
  });

  /** As linhas da comparação: nota, atende em casa e condições, uma célula por profissional. */
  private readonly compareRows = computed<CompareRow[]>(() => {
    const list = this.compared();
    return [
      { key: 'rating', label: 'Nota', cells: list.map((p) => ratingShort(p)) },
      { key: 'home', label: 'Atende em casa', cells: list.map((p) => (p.homeCare ? 'Sim' : 'Não')) },
      { key: 'conditions', label: 'Condições', cells: list.map((p) => this.conditionsFor(p)) },
    ];
  });
  private static allEqual(cells: readonly string[]): boolean {
    return cells.every((cell) => cell === cells[0]);
  }
  /** Só as linhas em que as opções são diferentes (CXC-012): a linha igual para todas não é repetida. */
  protected readonly changingRows = computed(() => this.compareRows().filter((row) => !SearchPage.allEqual(row.cells)));
  /** O que é igual para todas as opções, uma vez só, em frases curtas. */
  protected readonly sameLines = computed(() =>
    this.compareRows()
      .filter((row) => this.compared().length > 0 && SearchPage.allEqual(row.cells))
      .map((row) =>
        row.key === 'conditions' && !this.ctx.canUse('network_conditions') ? CONDITIONS_FROM_ESSENCIAL : `${row.label}: ${row.cells[0]}`,
      ),
  );

  private scrollToResults = false;

  constructor() {
    // Escolher uma necessidade leva a tela até os resultados (CXC-011): "toquei e nada aconteceu" não acontece mais.
    effect(() => {
      const category = this.category();
      untracked(() => {
        if (category && this.scrollToResults) {
          this.scrollToResults = false;
          afterNextRender(() => this.revealResults(), { injector: this.injector });
        }
      });
    });
  }

  private revealResults(): void {
    const heading = this.host.nativeElement.querySelector<HTMLElement>('#search-results');
    heading?.scrollIntoView?.({ block: 'start' });
    heading?.focus({ preventScroll: true });
  }

  protected label(category: ProviderCategory): string {
    return categoryLabel(category);
  }

  protected rating(p: ProviderPublicView): string {
    return ratingText(p);
  }

  /** Livre vê a lista e compara, mas a linha de condições diz "a partir do plano Essencial" (RN-REDE-25). */
  protected conditionsFor(p: ProviderPublicView): string {
    return this.ctx.canUse('network_conditions') ? p.conditions : CONDITIONS_FROM_ESSENCIAL;
  }

  protected onName(event: Event): void {
    this.name.set((event.target as HTMLInputElement).value);
  }

  protected chooseCategory(value: string): void {
    this.selected.set([]);
    if (value === this.category()) {
      this.revealResults();
      return;
    }
    this.scrollToResults = true;
    void this.router.navigate([], { relativeTo: this.route, queryParams: { categoria: value }, queryParamsHandling: 'merge' });
  }

  protected toggleHome(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { casa: this.homeOnly() ? null : '1' },
      queryParamsHandling: 'merge',
    });
  }

  protected isSelected(id: string): boolean {
    return this.selected().includes(id);
  }

  protected toggleCompare(id: string): void {
    this.selected.update((list) => {
      if (list.includes(id)) {
        return list.filter((x) => x !== id);
      }
      return list.length >= MAX_COMPARE ? list : [...list, id];
    });
  }

  protected talk(): void {
    this.contact.open();
  }
}
