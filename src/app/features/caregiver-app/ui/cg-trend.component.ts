import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';

export interface CgTrendItem {
  id: string;
  /** Data por extenso curto ("04/11"). */
  dateLabel: string;
  /** A faixa pelo nome oficial ("Sobrecarga moderada"), nunca só o número (RN-ZRT-08). Vai em legenda pequena quando há `meaning`. */
  bandLabel: string;
  /** A frase da faixa em linguagem de todo dia ("O cuidado está pesando muito"): vai PRIMEIRO, em destaque (CXC-004). */
  meaning?: string;
  /** Faixa de 1 a 4: escolhe o tom da rampa de azul (do mais claro ao mais escuro). */
  band: 1 | 2 | 3 | 4;
  /** Pontuação, só como legenda pequena ("63 pontos"). Nunca em destaque. */
  scoreText?: string;
  /** A mais recente leva o anel e a etiqueta "Última conversa". */
  latest?: boolean;
}

/**
 * O que o leitor de tela lê em cada item (UX A.2.21): "04/11, o cuidado está pesando muito, sobrecarga severa, 63 pontos". A pontuação entra só
 * quando existe; a última conversa leva a etiqueta no fim.
 */
export function trendItemLabel(item: CgTrendItem): string {
  const band = item.bandLabel.charAt(0).toLowerCase() + item.bandLabel.slice(1);
  const meaning = item.meaning ? item.meaning.charAt(0).toLowerCase() + item.meaning.slice(1) : undefined;
  return [item.dateLabel, meaning, band, item.scoreText, item.latest ? 'última conversa' : undefined]
    .filter((part): part is string => !!part)
    .join(', ');
}

/**
 * Linha do tempo da evolução (UX A.2.21; RN-ZRT-19 e 23): o cuidador vê a própria evolução SEM alarme. Lista do
 * mais recente para o mais antigo; cada item mostra a data, a faixa por extenso e, só em legenda, a pontuação. Os
 * pontos usam uma rampa de uma cor só (azul, do mais claro ao mais escuro): sem octógono, sem triângulo, sem
 * vermelho, sem âmbar, nenhum número grande. A frase "Não é um diagnóstico" vai na folha "Entender as faixas".
 *
 * Com `trail`, uma trilha de pontos (um por conversa, do mais antigo ao mais novo, até 6, na mesma rampa de uma cor) aparece
 * acima da lista: só desenho (`aria-hidden`), sem número; o texto da lista diz tudo. A última conversa leva o anel.
 *
 * ```html
 * <app-cg-trend [items]="items()" />
 * <app-cg-trend [items]="visible()" trail />
 * ```
 */
@Component({
  selector: 'app-cg-trend',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cg-trend-host' },
  template: `
    @if (trailItems().length > 1) {
      <ol class="cg-trend__trail" aria-hidden="true">
        @for (item of trailItems(); track item.id; let i = $index) {
          <li class="cg-trend__trail-dot" [class.is-latest]="item.latest" [attr.data-band]="item.band" [style.--i]="i"></li>
        }
      </ol>
    }
    <ol class="cg-trend" aria-label="Suas conversas com a equipe">
      @for (item of items(); track item.id) {
        <li class="cg-trend__item" [class.is-latest]="item.latest" [attr.aria-label]="label(item)">
          <span class="cg-trend__dot" [attr.data-band]="item.band" aria-hidden="true"></span>
          <span class="cg-trend__date">{{ item.dateLabel }}</span>
          @if (item.meaning) {
            <span class="cg-trend__meaning">{{ item.meaning }}</span>
          }
          <span class="cg-trend__band">{{ item.bandLabel }}</span>
          @if (item.scoreText) {
            <span class="cg-trend__score">{{ item.scoreText }}</span>
          }
          @if (item.latest) {
            <span class="cg-trend__tag">Última conversa</span>
          }
        </li>
      }
    </ol>
  `,
})
export class CgTrendComponent {
  readonly items = input.required<readonly CgTrendItem[]>();
  /** Desenha a trilha de pontos acima da lista (precisa de 2 conversas ou mais). */
  readonly trail = input(false, { transform: booleanAttribute });

  /** Do mais antigo ao mais novo, no máximo 6 (a lista vem do mais recente para o mais antigo). */
  protected readonly trailItems = computed(() => (this.trail() ? [...this.items().slice(0, 6)].reverse() : []));

  protected readonly label = trendItemLabel;
}
