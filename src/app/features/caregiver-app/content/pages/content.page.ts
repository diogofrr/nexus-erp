import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Database } from '../../../../core/data/database';
import { GuidanceCategory, GuidanceContent } from '../../../../core/models';
import {
  GUIDANCE_CATEGORY_LABELS,
  canReadContent,
  contentParagraphs,
  contentsByCategory,
  publishedContents,
  readingTimeLabel,
} from '../../../../core/rules/guidance-content';
import { PageChromeService } from '../../../../layout/state/page-chrome.service';
import { IconComponent } from '../../../../shared/ui/display/icon.component';
import { CaregiverContextService } from '../../state/caregiver-context.service';
import { CgEmptyComponent } from '../../ui/cg-empty.component';
import { CgHeroComponent } from '../../ui/cg-hero.component';
import { CgIllustrationComponent } from '../../ui/cg-illustration.component';
import { CgNoteComponent } from '../../ui/cg-note.component';
import { CgSealComponent } from '../../ui/cg-seal.component';

/** Rodapé da leitura (UX C11): o conteúdo orienta e não substitui profissional nem diz o que fazer com remédio. */
export const CONTENT_FOOTER =
  'Este conteúdo orienta e não substitui o médico, o psicólogo ou outro profissional. Dúvida sobre remédio: fale com o médico ou a farmácia.';

interface ContentItem {
  id: string;
  title: string;
  time: string;
  category: GuidanceCategory;
  /** Conteúdo exclusivo do plano (só aparece para quem o tem). */
  exclusive: boolean;
}

interface CategorySection {
  category: GuidanceCategory;
  label: string;
  items: ContentItem[];
}

/**
 * Conteúdos (docs/20; UX C11, `/cuidador/cuidar-de-mim/conteudos`): leituras curtas de orientação, em cartões com um desenho no
 * alto e o tempo de leitura ("Leitura de 1 minuto"), organizadas por categoria (Rotina e organização, Cuidar de você, Remédios
 * e saúde, Comunicação com a pessoa idosa, Direitos e rede pública), com filtro por categoria quando há mais de uma. Os
 * conteúdos exclusivos entram na categoria deles com o selo "Do seu plano" para quem os tem (Essencial em diante); para o Livre
 * eles NÃO aparecem, nem como vitrine nem com cadeado (regra de exibição 1 do dono). Tocar numa leitura abre o texto em tela
 * cheia, com `?conteudo=` na URL (S-21): título em serifa, texto de 18 px ou mais, tempo de leitura, o aviso de que não
 * substitui profissional e "Voltar". Só aparece conteúdo PUBLICADO. A ordem é da mais nova para a mais antiga, igual para
 * todos: nada é escolhido por pontuação, faixa, alerta ou ARBE (RN-PLN-19, RN-ZRT-09). A cor do desenho do cartão alterna entre
 * três tintas calmas, só para a lista não ficar monótona.
 */
@Component({
  selector: 'app-cg-content-page',
  imports: [NgTemplateOutlet, RouterLink, IconComponent, CgEmptyComponent, CgHeroComponent, CgIllustrationComponent, CgNoteComponent, CgSealComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .nx-chips { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0; padding: 0; list-style: none; }
      .nx-chip { min-block-size: var(--cg-target); padding: 0.375rem 1rem; border: 1px solid var(--cg-border); border-radius: var(--cg-radius-pill); background: var(--cg-surface); color: var(--cg-text); font: inherit; font-weight: var(--fw-semibold); cursor: pointer; }
      .nx-chip[aria-pressed='true'] { background: var(--cg-acc-solid); border-color: var(--cg-acc-solid); color: #ffffff; }
      .nx-reads { display: grid; gap: var(--cg-gap-stack); margin: 0; padding: 0; list-style: none; grid-template-columns: minmax(0, 1fr); }
      @media (min-width: 40rem) { .nx-reads { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; } }
      @media (min-width: 64rem) { .nx-reads { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
      .nx-reads > li { display: flex; }
      .nx-read { display: grid; grid-template-rows: auto 1fr; inline-size: 100%; padding: 0; border: 1px solid var(--cg-border); border-radius: var(--cg-radius-card); background: var(--cg-surface); color: var(--cg-text); font: inherit; text-align: start; cursor: pointer; overflow: hidden; box-shadow: var(--cg-shadow-1); transition: box-shadow var(--cg-dur) var(--ease), transform var(--cg-dur) var(--ease); }
      .nx-read:hover { box-shadow: var(--cg-shadow-2); }
      .nx-read:active { transform: scale(0.985); }
      .nx-read__cover { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; min-block-size: 5.25rem; padding: 0.75rem 1rem 0.75rem 1.25rem; }
      .nx-read__cover--0 { background: linear-gradient(120deg, var(--cg-acc-tint), var(--cg-acc-strong)); }
      .nx-read__cover--1 { background: linear-gradient(120deg, var(--cg-care-bg), var(--cg-care-border)); }
      .nx-read__cover--2 { background: linear-gradient(120deg, var(--cg-ok-bg), var(--cg-ok-border)); }
      .nx-read__time { display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.125rem 0.625rem; border-radius: var(--cg-radius-pill); background: var(--cg-surface); color: var(--cg-text); font-size: var(--cg-fs-caption); font-weight: var(--fw-semibold); }
      .nx-read__time .icon { color: var(--cg-soft-icon); }
      .nx-read__body { display: grid; gap: 0.5rem; padding: 1rem 1.25rem 1.25rem; }
      .nx-read__line { display: flex; align-items: flex-start; gap: 0.75rem; }
      .nx-read__title { flex: 1; min-inline-size: 0; font-size: var(--cg-fs-lead); font-weight: var(--fw-semibold); line-height: 1.3; color: var(--cg-heading); overflow-wrap: anywhere; }
      .nx-read__go { flex: none; margin-top: 0.125rem; color: var(--cg-text-soft); }
    `,
  ],
  template: `
    @if (reading(); as item) {
      <app-cg-hero [title]="item.title" illustration="book" backLink="/cuidador/cuidar-de-mim/conteudos" backLabel="Conteúdos" />
      <article class="cg-reading cg-stack cg-stack--tight" data-role="reading">
        <p class="cg-meta" data-role="reading-time">{{ item.time }}</p>
        @for (paragraph of item.paragraphs; track $index) {
          <p>{{ paragraph }}</p>
        }
      </article>
      <div class="cg-reading cg-section">
        <app-cg-note variant="soft" icon="info">{{ footer }}</app-cg-note>
      </div>
      <div class="cg-action-bar">
        <a class="btn" routerLink="/cuidador/cuidar-de-mim/conteudos">Voltar</a>
      </div>
    } @else {
      <app-cg-hero title="Conteúdos" description="Leituras curtas. Escolha uma." illustration="book" backLink="/cuidador/cuidar-de-mim" backLabel="Cuidar de mim" />

      @if (missing()) {
        <app-cg-note variant="soft" icon="info">
          Não encontramos esta leitura.
          <a cgNoteActions class="cg-link-btn" routerLink="/cuidador/cuidar-de-mim/conteudos">Voltar</a>
        </app-cg-note>
      }

      @if (allSections().length === 0) {
        <app-cg-empty illustration="book" [headingLevel]="2" title="Ainda não há leituras" text="Quando a equipe publicar, elas aparecem aqui." />
      } @else {
        @if (allSections().length > 1) {
          <ul class="nx-chips" data-role="filter" aria-label="Filtrar por categoria">
            <li><button type="button" class="nx-chip" [attr.aria-pressed]="filter() === null" (click)="filter.set(null)">Todas</button></li>
            @for (section of allSections(); track section.category) {
              <li><button type="button" class="nx-chip" [attr.aria-pressed]="filter() === section.category" [attr.data-category]="section.category" (click)="filter.set(section.category)">{{ section.label }}</button></li>
            }
          </ul>
        }
        @for (section of sections(); track section.category) {
          <section class="cg-section" [attr.aria-labelledby]="'content-' + section.category" [attr.data-category]="section.category">
            <h2 class="cg-section__title" [id]="'content-' + section.category">{{ section.label }}</h2>
            <ul class="nx-reads cg-enter">
              @for (item of section.items; track item.id; let i = $index) {
                <ng-container [ngTemplateOutlet]="read" [ngTemplateOutletContext]="{ $implicit: item, i: i }" />
              }
            </ul>
          </section>
        }
      }
    }

    <ng-template #read let-item let-i="i">
      <li>
        <button type="button" class="nx-read" data-role="read" (click)="open(item.id)">
          <span [class]="'nx-read__cover nx-read__cover--' + (i % 3)">
            <span class="nx-read__time"><svg appIcon="clock" size="sm"></svg>{{ item.time }}</span>
            <app-cg-illustration name="book" size="sm" tone="brand" />
          </span>
          <span class="nx-read__body">
            <span class="nx-read__line">
              <span class="nx-read__title">{{ item.title }}</span>
              <svg class="nx-read__go" appIcon="chevron-right"></svg>
            </span>
            @if (item.exclusive) {
              <span class="cg-tags"><app-cg-seal tone="gold" icon="star" data-role="exclusive">Do seu plano</app-cg-seal></span>
            }
          </span>
        </button>
      </li>
    </ng-template>
  `,
})
export class ContentPage {
  private readonly db = inject(Database);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly chrome = inject(PageChromeService);
  protected readonly ctx = inject(CaregiverContextService);

  protected readonly footer = CONTENT_FOOTER;
  protected readonly categoryLabels = GUIDANCE_CATEGORY_LABELS;

  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  private readonly requestedId = computed(() => this.params().get('conteudo'));

  /** O filtro por categoria (`null` = todas). */
  protected readonly filter = signal<GuidanceCategory | null>(null);

  private readonly published = computed(() => publishedContents(this.db.guidanceContents.list()));
  private readonly canSeeExclusive = computed(() => this.ctx.canUse('exclusive_content'));

  private readonly asItem = (c: GuidanceContent): ContentItem => ({
    id: c.id,
    title: c.title,
    time: readingTimeLabel(c.body),
    category: c.category,
    exclusive: c.exclusive,
  });

  /** O que esta pessoa pode ler: o exclusivo só com o plano que o inclui (senão nem aparece). */
  private readonly readable = computed(() => this.published().filter((c) => canReadContent(c, this.canSeeExclusive())).map(this.asItem));

  /** Todas as seções com leitura (a ordem das categorias é fixa). */
  protected readonly allSections = computed<CategorySection[]>(() => contentsByCategory(this.readable()));

  /** As seções que passam no filtro. */
  protected readonly sections = computed<CategorySection[]>(() => {
    const filter = this.filter();
    return this.allSections().filter((s) => filter === null || s.category === filter);
  });

  /** A leitura aberta, só se existe, está publicada e o plano a libera (senão, a mesma frase de "não encontrada"). */
  protected readonly reading = computed(() => {
    const id = this.requestedId();
    const content = id ? this.published().find((c) => c.id === id) : undefined;
    if (!content || !canReadContent(content, this.canSeeExclusive())) {
      return null;
    }
    return { ...this.asItem(content), paragraphs: contentParagraphs(content.body) };
  });
  protected readonly missing = computed(() => !!this.requestedId() && this.reading() === null);

  private lastShown: string | null = null;

  constructor() {
    // O foco vai ao título ao abrir e ao fechar a leitura (a URL muda só na consulta, e o shell só cuida de troca de caminho).
    effect(() => {
      const current = this.reading()?.id ?? (this.missing() ? 'missing' : null);
      untracked(() => {
        if (this.lastShown !== null || current !== null) {
          if (current !== this.lastShown) {
            this.chrome.focusHeading();
          }
        }
        this.lastShown = current;
      });
    });
  }

  protected open(id: string): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { conteudo: id }, queryParamsHandling: 'merge' });
  }
}
