import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import { CgRatingComponent, CgRatingValue } from './cg-rating.component';

/**
 * Frase que fica escrita ACIMA do botão "Enviar avaliação" enquanto falta nota (UX A.2.22), ou `null` quando as
 * duas notas existem. As duas notas são obrigatórias (RN-ARP-02).
 */
export function ratingPairMissingText(
  quality: CgRatingValue | null,
  punctuality: CgRatingValue | null,
): string | null {
  if (quality === null && punctuality === null) {
    return 'Falta escolher as duas notas';
  }
  if (quality === null) {
    return 'Falta escolher a nota do serviço';
  }
  if (punctuality === null) {
    return 'Falta escolher a nota da pontualidade e do atendimento';
  }
  return null;
}

/**
 * Avaliação de um serviço da rede com DUAS notas obrigatórias (RN-ARP-02): "Como foi o serviço?" (qualidade
 * técnica) e "Como foi a pontualidade e o atendimento?" (pontualidade e cordialidade). O comentário é um campo
 * comum, opcional, que a tela põe abaixo. Cada nota cabe em 328 px (5 x 48 + 4 x 8).
 *
 * ```html
 * <app-cg-rating-pair [(quality)]="quality" [(punctuality)]="punctuality" />
 * @if (missing(); as text) { <p>{{ text }}</p> }
 * ```
 */
@Component({
  selector: 'app-cg-rating-pair',
  imports: [CgRatingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cg-rating-pair' },
  template: `
    <app-cg-rating label="Como foi o serviço?" [(value)]="quality" />
    <app-cg-rating label="Como foi a pontualidade e o atendimento?" [(value)]="punctuality" />
  `,
})
export class CgRatingPairComponent {
  /** Qualidade técnica (de 1 a 5). */
  readonly quality = model<CgRatingValue | null>(null);
  /** Pontualidade e cordialidade (de 1 a 5). */
  readonly punctuality = model<CgRatingValue | null>(null);
}
