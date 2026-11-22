import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../../shared/ui/display/icon.component';
import { CaregiverContextService } from '../../state/caregiver-context.service';
import { CgEmptyComponent } from '../../ui/cg-empty.component';
import { CgHeroComponent } from '../../ui/cg-hero.component';
import { FAQ_TOPICS, visibleFaq } from '../state/guide-content';

/**
 * Perguntas frequentes (`/cuidador/mais/guia/perguntas`): as dúvidas mais comuns de quem cuida, por assunto, cada uma
 * abrindo no lugar (`details`), com o atalho para a tela certa. A busca acha por palavra, sem acento nem caixa. Só
 * aparecem as perguntas do plano da pessoa (docs/20, regra de exibição 1). Sem resultado, o caminho é falar com a Nexus.
 */
@Component({
  selector: 'app-guide-faq-page',
  imports: [RouterLink, IconComponent, CgEmptyComponent, CgHeroComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .faq-search { position: relative; display: block; max-width: var(--cg-reading); }
    .faq-search__icon { position: absolute; inset: 50% auto auto 1.125rem; translate: 0 -50%; color: var(--cg-text-soft); pointer-events: none; }
    .faq-search .input { width: 100%; padding-inline-start: 3rem; border-radius: var(--cg-radius-pill); }
    .faq-topic { display: grid; gap: var(--cg-gap-stack); margin-top: 2rem; }
    .faq-topic__title { display: flex; align-items: center; gap: 0.75rem; margin: 0 0 0.25rem; font-family: var(--font-serif); font-weight: 400; }
    .faq-topic__icon { display: grid; place-items: center; width: 2.5rem; height: 2.5rem; border-radius: 50%; background: var(--cg-acc-strong); color: var(--cg-acc-ink); }
    .faq-list { margin: 0; padding: 0; list-style: none; border-radius: var(--cg-radius-card); background: var(--cg-surface); box-shadow: var(--cg-shadow-1); overflow: hidden; }
    .faq-list > li + li { border-top: 1px solid var(--cg-border-subtle); }
    .faq-item > summary {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 1rem;
      min-height: var(--cg-row-h);
      padding: 0.875rem 1.125rem;
      font-weight: var(--fw-semibold);
      color: var(--cg-heading);
      list-style: none;
      cursor: pointer;
      transition: background var(--cg-dur) var(--ease);
    }
    .faq-item > summary::-webkit-details-marker { display: none; }
    .faq-item > summary:hover { background: var(--cg-acc-tint); }
    .faq-item > summary:focus-visible { outline-offset: -3px; }
    .faq-item__chevron { color: var(--cg-text-soft); transition: transform var(--cg-dur-sheet) var(--ease); }
    .faq-item[open] .faq-item__chevron { transform: rotate(180deg); }
    .faq-item__body { display: grid; gap: 0.75rem; justify-items: start; padding: 0 1.125rem 1.125rem; }
    .faq-item__body p { margin: 0; }
    .faq-item__list { display: grid; gap: 0.375rem; margin: 0; padding-inline-start: 1.25rem; }
    .faq-item__body .cg-link-btn { margin-inline-start: -0.5rem; }
    .faq-foot { display: grid; gap: 0.5rem; justify-items: start; margin-top: 2rem; padding: var(--cg-pad-card); border-radius: var(--cg-radius-card); background: var(--cg-acc-tint); }
    .faq-foot p { margin: 0; }
  `,
  template: `
    <app-cg-hero
      title="Perguntas frequentes"
      description="As dúvidas mais comuns de quem cuida, com resposta curta."
      illustration="help"
      backLink="/cuidador/mais"
      backLabel="Mais"
      compact
    />

    <label class="faq-search">
      <span class="sr-only">Buscar uma pergunta</span>
      <svg class="faq-search__icon" appIcon="search" aria-hidden="true"></svg>
      <input
        class="input"
        type="search"
        placeholder="Buscar, por exemplo: remédio"
        autocomplete="off"
        [value]="query()"
        (input)="query.set(valueOf($event))"
        data-role="faq-search"
      />
    </label>

    @for (topic of topics(); track topic.id) {
      <section class="faq-topic" [attr.aria-labelledby]="'faq-' + topic.id" [attr.data-topic]="topic.id">
        <h2 class="faq-topic__title" [id]="'faq-' + topic.id">
          <span class="faq-topic__icon" aria-hidden="true"><svg [appIcon]="topic.icon"></svg></span>
          {{ topic.title }}
        </h2>
        <ul class="faq-list">
          @for (item of topic.items; track item.id) {
            <li>
              <details class="faq-item" [attr.data-question]="item.id" [open]="searching()">
                <summary>
                  <span>{{ item.question }}</span>
                  <svg class="faq-item__chevron" appIcon="chevron-down" aria-hidden="true"></svg>
                </summary>
                <div class="faq-item__body">
                  @for (paragraph of item.answer; track $index) {
                    <p>{{ paragraph }}</p>
                  }
                  @if (item.list; as list) {
                    <ul class="faq-item__list">
                      @for (entry of list; track $index) {
                        <li>{{ entry }}</li>
                      }
                    </ul>
                  }
                  @if (item.link; as link) {
                    <a class="cg-link-btn" [routerLink]="link.path">{{ link.label }}</a>
                  }
                </div>
              </details>
            </li>
          }
        </ul>
      </section>
    } @empty {
      <app-cg-empty illustration="empty" title="Nenhuma pergunta encontrada" text="Tente outra palavra ou fale com a gente.">
        <a class="btn btn--primary" routerLink="/cuidador/mais/ajuda">Falar com a Nexus</a>
      </app-cg-empty>
    }

    @if (topics().length > 0) {
      <div class="faq-foot" data-role="faq-foot">
        <p>Não achou a sua dúvida? A equipe da Nexus responde.</p>
        <a class="btn" routerLink="/cuidador/mais/ajuda">Falar com a Nexus</a>
        <a class="cg-link-btn" routerLink="/cuidador/mais/guia">Ver Começando a cuidar</a>
      </div>
    }
  `,
})
export class GuideFaqPage {
  private readonly ctx = inject(CaregiverContextService);

  protected readonly query = signal('');
  protected readonly searching = computed(() => this.query().trim().length > 0);
  protected readonly topics = computed(() => visibleFaq(FAQ_TOPICS, (feature) => this.ctx.canUse(feature), this.query()));

  protected valueOf(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
