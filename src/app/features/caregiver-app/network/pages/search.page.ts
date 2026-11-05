import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
import { CATEGORIES, CONDITIONS_FROM_ESSENCIAL, categoryLabel, parseCategory, ratingText } from '../state/network-copy';

/** No máximo 3 profissionais lado a lado (UX C13). */
const MAX_COMPARE = 3;

/**
 * Buscar profissionais e serviços (UX C13, `/cuidador/rede/buscar`). O campo "Buscar pelo nome" (o texto NUNCA vai para a URL,
 * AC-CG-122), as 10 necessidades em botões de 56 px (`?categoria=`) e a lista em cartões. Sempre MAIS DE UMA opção quando
 * existir; se só há uma, "Única opção disponível no momento." e ela não some; se não há nenhuma, "Nenhuma opção em ... por
 * enquanto" com **Falar com a gente** (RN-REDE-10). A ordem é "em destaque primeiro, depois ordem alfabética" (S-08): o destaque
 * nunca tira ninguém da lista e nenhum texto diz "recomendado" (RN-REDE-19, RN-ATD-13). A nota só aparece com 5 avaliações ou
 * mais. NUNCA aparecem suspenso, descredenciado ou candidato, nem faixa de monitoramento, "risco de saída", taxa de recusa ou
 * comissão (RN-REDE-18 e 30): o núcleo só entrega a ficha pública. "Só quem atende em casa" filtra; "Comparar" põe 2 ou 3 lado a
 * lado, e no Livre a linha de condições diz "a partir do plano Essencial".
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
      .nx-meta { margin: 0; color: var(--cg-text-soft); font-size: var(--cg-fs-small); }
      .nx-tags { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0; }
      .nx-compare-cols { display: grid; gap: var(--cg-gap-block); grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr)); }
      .nx-compare-col { display: grid; gap: 0.5rem; align-content: start; padding: var(--cg-pad-card); border: 1px solid var(--cg-border); border-radius: var(--cg-radius-control); }
      .nx-compare-col h3, .nx-compare-col p { margin: 0; overflow-wrap: anywhere; }
      .nx-compare-col dt { font-weight: var(--fw-semibold); color: var(--cg-heading); }
      .nx-compare-col dd { margin: 0 0 0.5rem; }
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
          <h2 class="cg-section__title" id="search-results" data-role="count">{{ countText() }}</h2>

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
                  <p class="nx-meta">{{ p.specialtyLabel }} · {{ p.city }}</p>
                  @if (p.homeCare || p.highlight) {
                    <p class="nx-tags">
                      @if (p.homeCare) {
                        <app-badge variant="info" icon="house">Atende em casa</app-badge>
                      }
                      @if (p.highlight) {
                        <app-badge variant="success" icon="award">Em destaque</app-badge>
                      }
                    </p>
                  }
                  <p class="nx-meta" data-role="rating">{{ rating(p) }}</p>
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
      <div class="nx-compare-cols" data-role="compare-cols">
        @for (p of compared(); track p.id) {
          <section class="nx-compare-col" data-role="compare-col">
            <h3 class="cg-card__title">{{ p.name }}</h3>
            <dl>
              <dt>Nota</dt>
              <dd>{{ rating(p) }}</dd>
              <dt>Atende em casa</dt>
              <dd>{{ p.homeCare ? 'Sim' : 'Não' }}</dd>
              <dt>Condições</dt>
              <dd>{{ conditionsFor(p) }}</dd>
            </dl>
            <a class="cg-link-btn" [routerLink]="['/cuidador/rede/profissional', p.id]">Ver ficha</a>
          </section>
        }
      </div>
      <ng-container cgSheetActions>
        <button type="button" class="btn btn--primary" (click)="compareOpen.set(false)">Fechar</button>
      </ng-container>
    </app-cg-sheet>
  `,
})
export class SearchPage {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly network = inject(CaregiverNetworkService);
  private readonly contact = inject(ContactDialogService);
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
