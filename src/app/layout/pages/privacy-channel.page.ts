import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Database } from '../../core/data/database';
import { DSR_DEADLINE_DAYS, DSR_TYPE_LABELS } from '../../core/rules/lgpd';
import { IconComponent } from '../../shared/ui/display/icon.component';

/**
 * Privacidade e canal do titular (LP-23, A-43): a página que o rodapé e o menu do usuário abrem, em dois
 * toques desde qualquer tela. Disponível a TODOS os perfis, inclusive o credenciado, fora do RBAC do M12:
 * mostra a encarregada pelos dados (fictícia), o canal, os direitos e a política em linguagem simples.
 */
@Component({
  selector: 'app-privacy-channel-page',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page--narrow">
      <header class="page-header">
        <div class="page-header__row">
          <div class="page-header__titles">
            <h1>Privacidade e canal do titular</h1>
            <p class="page-header__desc">
              Aqui você vê quem cuida dos dados na Nexus, como falar com essa pessoa e para que
              usamos cada dado.
            </p>
          </div>
        </div>
      </header>

      <div class="stack stack--6">
        <section class="card card--pad stack stack--3" aria-labelledby="nx-pc-dpo">
          <h2 class="card__title" id="nx-pc-dpo">Encarregada pelos dados</h2>
          @if (policy(); as doc) {
            <dl class="dl">
              <dt>Nome</dt>
              <dd>{{ doc.dpoName }} (fictícia)</dd>
              <dt>Canal do titular</dt>
              <dd>{{ doc.dpoEmail }}</dd>
              <dt>Prazo de resposta</dt>
              <dd>Até {{ deadlineDays }} dias corridos</dd>
            </dl>
          } @else {
            <p class="t-muted">
              A política de privacidade ainda não foi carregada neste navegador.
            </p>
          }
        </section>

        <section class="card card--pad stack stack--3" aria-labelledby="nx-pc-rights">
          <h2 class="card__title" id="nx-pc-rights">O que você pode pedir</h2>
          <ul class="stack stack--2 list-reset">
            @for (right of rights; track right) {
              <li class="cluster cluster--nowrap">
                <svg appIcon="circle-check" size="sm"></svg><span>{{ right }}</span>
              </li>
            }
          </ul>
          <p class="t-muted t-ui">
            Todo pedido vira uma solicitação do titular, com protocolo e prazo, registrada pelo
            atendimento.
          </p>
        </section>

        @if (paragraphs().length > 0) {
          <section class="card card--pad stack stack--3" aria-labelledby="nx-pc-policy">
            <h2 class="card__title" id="nx-pc-policy">Para que usamos os dados</h2>
            <div class="prose">
              @for (text of paragraphs(); track $index) {
                <p>{{ text }}</p>
              }
            </div>
          </section>
        }
      </div>
    </div>
  `,
})
export class PrivacyChannelPageComponent {
  private readonly db = inject(Database);

  protected readonly deadlineDays = DSR_DEADLINE_DAYS;
  protected readonly rights = Object.values(DSR_TYPE_LABELS);
  protected readonly policy = computed(() =>
    this.db.privacyDocuments.find((d) => d.kind === 'privacy_policy'),
  );
  protected readonly paragraphs = computed(() =>
    (this.policy()?.body ?? '').split(/\n\s*\n/).filter((p) => p.trim().length > 0),
  );
}
