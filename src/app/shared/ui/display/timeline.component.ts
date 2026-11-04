import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { formatDateTime } from '@core/format';
import type { ISODateTime } from '@core/models';

export type TimelineTone = 'default' | 'done' | 'attention' | 'danger' | 'gold';

export interface TimelineItem {
  id?: string;
  title: string;
  text?: string;
  /** Instante (formatado `04/11/2026 09:30`). */
  at?: ISODateTime;
  /** Texto de hora já pronto (tem prioridade sobre `at`). */
  timeLabel?: string;
  tone?: TimelineTone;
}

const TONE_TEXT: Record<TimelineTone, string> = {
  default: '',
  done: 'Concluído',
  attention: 'Atenção',
  danger: 'Urgente',
  gold: 'Destaque',
};

/**
 * Linha do tempo (PD-15): histórico do Zarit, consentimentos, status do prestador, log. É APPEND-ONLY:
 * não existe editar nem apagar. A cor do marcador também tem texto (para leitor de tela).
 *
 * ```html
 * <app-timeline label="Histórico de consentimento" [items]="events" />
 * ```
 */
@Component({
  selector: 'app-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="timeline" [attr.aria-label]="label()">
      @for (item of items(); track item.id ?? $index) {
        <li
          class="timeline__item"
          [class.timeline__item--done]="item.tone === 'done'"
          [class.timeline__item--attention]="item.tone === 'attention'"
          [class.timeline__item--danger]="item.tone === 'danger'"
          [class.timeline__item--gold]="item.tone === 'gold'"
        >
          <span class="timeline__dot" aria-hidden="true"></span>
          <div>
            @if (item.timeLabel || item.at) {
              <div class="timeline__time">{{ item.timeLabel ?? formatAt(item.at) }}</div>
            }
            <div class="timeline__title">
              {{ item.title }}
              @if (toneText(item.tone)) {
                <span class="sr-only"> ({{ toneText(item.tone) }})</span>
              }
            </div>
            @if (item.text) {
              <p class="timeline__text">{{ item.text }}</p>
            }
          </div>
        </li>
      }
    </ol>
  `,
})
export class TimelineComponent {
  readonly items = input.required<readonly TimelineItem[]>();
  readonly label = input.required<string>();

  protected formatAt(at: ISODateTime | undefined): string {
    return formatDateTime(at);
  }

  protected toneText(tone: TimelineTone | undefined): string {
    return TONE_TEXT[tone ?? 'default'];
  }
}
