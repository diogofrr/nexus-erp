import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ID } from '../../../../core/models';
import { IconComponent } from '../../../../shared/ui/display/icon.component';
import { CgEventBadgeComponent } from '../../ui/cg-event-badge.component';
import { CgRowComponent } from '../../ui/cg-row.component';
import { AgendaEntry } from '../state/agenda-entry';

/**
 * Uma linha da Agenda (UX C5), a mesma no calendário (os compromissos do dia escolhido) e na lista: hora e título, o
 * apoio ("onde ou com quem") e, no fim, a etiqueta "Já passou" (compromisso de hoje cuja hora passou), "Para você"
 * (a conversa do próprio cuidador com o psicólogo, que leva a Conversar com um psicólogo) ou o selo do tipo do encontro
 * em que a pessoa está inscrita (que leva a Encontros). Tocar num compromisso pede o detalhe (`open`). Com `plain`, é
 * só texto: os dias que já passaram não se mexem.
 */
@Component({
  selector: 'app-agenda-entry',
  imports: [CgEventBadgeComponent, CgRowComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .routine-late {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0 0.5rem;
      border: 0;
      border-radius: var(--cg-radius-pill);
      background: var(--cg-late-bg);
      color: var(--cg-late-fg);
      font-size: var(--cg-fs-caption);
      font-weight: var(--fw-semibold);
    }
    .routine-plain {
      display: flex;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      color: var(--cg-text-soft);
    }
    .routine-plain__time {
      font-variant-numeric: tabular-nums;
      font-weight: var(--fw-semibold);
    }
  `,
  template: `
    @if (plain()) {
      <div class="routine-plain">
        <span class="routine-plain__time">{{ entry().time }}</span>
        <span>{{ entry().title }}@if (entry().support) {, {{ entry().support }}}</span>
      </div>
    } @else if (entry().forYou) {
      <app-cg-row
        [title]="entry().time + ' ' + entry().title"
        [icon]="entry().icon"
        [link]="entry().link ?? '/cuidador/cuidar-de-mim/atendimento'"
        [linkQuery]="entry().linkQuery"
      >
        @if (entry().eventType; as type) {
          <app-cg-event-badge cgRowEnd [type]="type" size="sm" />
        } @else {
          <span cgRowEnd class="cg-tag">Para você</span>
        }
      </app-cg-row>
    } @else {
      <app-cg-row
        [title]="entry().time + ' ' + entry().title"
        [description]="entry().support ?? undefined"
        [icon]="entry().icon"
        (activated)="open.emit(entry().appointment?.id ?? '')"
      >
        @if (entry().passed) {
          <span cgRowEnd class="routine-late"><svg appIcon="clock" size="sm"></svg>Já passou</span>
        }
      </app-cg-row>
    }
  `,
})
export class AgendaEntryComponent {
  readonly entry = input.required<AgendaEntry>();
  /** Só texto (dia que já passou). */
  readonly plain = input(false);
  /** A pessoa tocou num compromisso dela: o id dele. */
  readonly open = output<ID>();
}
