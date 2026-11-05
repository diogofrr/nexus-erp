import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Database } from '../../../../core/data/database';
import { GuidanceContent } from '../../../../core/models';
import { canReadContent, contentParagraphs, publishedContents, readingTimeLabel } from '../../../../core/rules/guidance-content';
import { EmptyStateComponent } from '../../../../shared/ui/display/empty-state.component';
import { PageChromeService } from '../../../../layout/state/page-chrome.service';
import { CaregiverContextService } from '../../state/caregiver-context.service';
import { CgNoteComponent } from '../../ui/cg-note.component';
import { CgPageHeaderComponent } from '../../ui/cg-page-header.component';
import { CgPlanLockComponent } from '../../ui/cg-plan-lock.component';
import { CgRowComponent } from '../../ui/cg-row.component';

/** Rodapé da leitura (UX C11): o conteúdo orienta e não substitui profissional nem diz o que fazer com remédio. */
export const CONTENT_FOOTER =
  'Este conteúdo orienta e não substitui o médico, o psicólogo ou outro profissional. Dúvida sobre remédio: fale com o médico ou a farmácia.';

interface ContentItem {
  id: string;
  title: string;
  time: string;
}

/**
 * Conteúdos (UX C11, `/cuidador/cuidar-de-mim/conteudos`): leituras curtas de orientação. Duas listas, "Para todos" e,
 * do Essencial em diante, "Do seu plano" (os exclusivos); no Livre, UM cartão de bloqueio no lugar dessa lista, sem
 * listar os títulos exclusivos como isca. Tocar numa leitura abre o texto em folha de tela cheia, com `?conteudo=` na
 * URL (S-21): título em serifa, texto de 18 px ou mais em até 66 caracteres por linha, tempo de leitura, o aviso de que
 * não substitui profissional e "Voltar". Só aparece conteúdo PUBLICADO. A ordem é da mais nova para a mais antiga, igual
 * para todos: nada é escolhido por pontuação, faixa, alerta ou ARBE (RN-PLN-19, RN-ZRT-09).
 */
@Component({
  selector: 'app-cg-content-page',
  imports: [RouterLink, CgPageHeaderComponent, CgRowComponent, CgPlanLockComponent, CgNoteComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .cg-reading__time { margin: 0; color: var(--cg-text-soft); font-size: var(--cg-fs-small); }
    `,
  ],
  template: `
    @if (reading(); as item) {
      <app-cg-page-header [title]="item.title" backLink="/cuidador/cuidar-de-mim/conteudos" backLabel="Conteúdos" />
      <article class="cg-reading cg-stack cg-stack--tight" data-role="reading">
        <p class="cg-reading__time" data-role="reading-time">{{ item.time }}</p>
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
      <app-cg-page-header title="Conteúdos" description="Leituras curtas. Escolha uma." />

      @if (missing()) {
        <app-cg-note variant="soft" icon="info">
          Não encontramos esta leitura.
          <a cgNoteActions class="cg-link-btn" routerLink="/cuidador/cuidar-de-mim/conteudos">Voltar</a>
        </app-cg-note>
      }

      @if (openItems().length === 0 && !showLock() && exclusiveItems().length === 0) {
        <app-empty-state title="Ainda não há leituras" text="Quando a equipe publicar, elas aparecem aqui." />
      } @else {
        @if (openItems().length > 0) {
          <section class="cg-section" aria-labelledby="content-open">
            <h2 class="cg-section__title" id="content-open">Para todos</h2>
            <ul class="cg-list">
              @for (item of openItems(); track item.id) {
                <li>
                  <app-cg-row icon="book-open" [title]="item.title" [description]="item.time" (activated)="open(item.id)" />
                </li>
              }
            </ul>
          </section>
        }

        @if (exclusiveItems().length > 0) {
          <section class="cg-section" aria-labelledby="content-plan">
            <h2 class="cg-section__title" id="content-plan">Do seu plano</h2>
            <ul class="cg-list">
              @for (item of exclusiveItems(); track item.id) {
                <li>
                  <app-cg-row icon="book-open" [title]="item.title" [description]="item.time" (activated)="open(item.id)" />
                </li>
              }
            </ul>
          </section>
        }

        @if (showLock()) {
          <section class="cg-section">
            <app-cg-plan-lock feature="exclusive_content" description="Os conteúdos exclusivos fazem parte do plano Essencial.">
              Todas as leituras acima são para você.
            </app-cg-plan-lock>
          </section>
        }
      }
    }
  `,
})
export class ContentPage {
  private readonly db = inject(Database);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly chrome = inject(PageChromeService);
  protected readonly ctx = inject(CaregiverContextService);

  protected readonly footer = CONTENT_FOOTER;

  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  private readonly requestedId = computed(() => this.params().get('conteudo'));

  private readonly published = computed(() => publishedContents(this.db.guidanceContents.list()));
  private readonly canSeeExclusive = computed(() => this.ctx.canUse('exclusive_content'));

  private readonly asItem = (c: GuidanceContent): ContentItem => ({ id: c.id, title: c.title, time: readingTimeLabel(c.body) });

  protected readonly openItems = computed(() => this.published().filter((c) => !c.exclusive).map(this.asItem));
  protected readonly exclusiveItems = computed(() =>
    this.canSeeExclusive() ? this.published().filter((c) => c.exclusive).map(this.asItem) : [],
  );
  /** O Livre vê UM cartão no lugar da lista exclusiva, só se houver o que desbloquear. */
  protected readonly showLock = computed(
    () => !this.canSeeExclusive() && this.published().some((c) => c.exclusive),
  );

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
