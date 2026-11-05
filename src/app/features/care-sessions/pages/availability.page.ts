import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '@core/auth';
import { Clock, addDays, compareDateTimes, toIsoDateTime } from '@core/clock';
import { Database } from '@core/data';
import { formatDate } from '@core/format';
import { ISODate } from '@core/models';
import { BadgeComponent, IconComponent, IconName, PageHeaderComponent } from '@shared/ui';
import { ToastService } from '@shared/ui/overlay';
import { dayAndMonth, mondayOf, weekCaption, weekDaysFrom } from '../state/care-helpers';
import { AGENDA_HOURS, CareSessionsService, SlotState } from '../state/care-sessions.service';

type CellState = SlotState | 'booked' | 'past';

const NEXT_STATE: Record<SlotState, SlotState> = {
  none: 'open',
  open: 'priority',
  priority: 'blocked',
  blocked: 'none',
};

const CELL_VIEW: Record<CellState, { label: string; icon: IconName }> = {
  none: { label: 'Sem vaga', icon: 'minus' },
  open: { label: 'Aberta', icon: 'circle-dashed' },
  priority: { label: 'Prioritária', icon: 'star' },
  blocked: { label: 'Bloqueada', icon: 'ban' },
  booked: { label: 'Reservada', icon: 'user' },
  past: { label: 'Já passou', icon: 'clock' },
};

/**
 * SCR-M05-02, Disponibilidade (RN-ATD-12, RN-ATD-14): o psicólogo define as vagas de 1 hora da semana, de
 * segunda a sexta, das 08h às 18h, e marca vagas "prioritárias" (reservadas a cuidadores em alerta amarelo e
 * aos planos Cuida e Sustenta). Cada clique muda a vaga: sem vaga, aberta, prioritária, bloqueada. Vaga
 * reservada só muda cancelando a sessão. "Repetir semana anterior" copia o desenho sem pisar no que já existe.
 */
@Component({
  selector: 'app-availability-page',
  imports: [BadgeComponent, IconComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      <app-page-header
        title="Disponibilidade"
        description="Defina as vagas de 1 hora da sua semana. As vagas prioritárias ficam para quem precisa de acompanhamento mais próximo."
      >
        <button type="button" class="btn" (click)="repeatPrevious()" data-role="repeat-week">
          <svg appIcon="refresh-cw" size="sm"></svg>Repetir semana anterior
        </button>
      </app-page-header>

      <div class="cluster cluster--between">
        <div class="cluster">
          <button type="button" class="btn btn--sm" (click)="shift(-1)" data-role="prev">
            <svg appIcon="chevron-left" size="sm"></svg>Anterior
          </button>
          <strong class="t-ui" aria-live="polite" data-role="range">{{ range() }}</strong>
          <button type="button" class="btn btn--sm" (click)="shift(1)" data-role="next">
            Próxima<svg appIcon="chevron-right" size="sm"></svg>
          </button>
        </div>
        <div class="cluster" data-role="summary">
          <app-badge variant="info" icon="circle-dashed">{{ counts().open }} abertas</app-badge>
          <app-badge variant="gold" icon="star">{{ counts().priority }} prioritárias</app-badge>
          <app-badge outline icon="ban">{{ counts().blocked }} bloqueadas</app-badge>
          <app-badge variant="success" icon="user">{{ counts().booked }} reservadas</app-badge>
        </div>
      </div>

      <p class="t-ui" role="status" data-role="announce">{{ announce() }}</p>

      <div class="table-wrap">
        <table class="table" data-role="grid">
          <caption class="sr-only">{{ caption() }}</caption>
          <thead>
            <tr>
              <th scope="col">Hora</th>
              @for (day of days(); track day) {
                <th scope="col">{{ dayLabel(day) }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (hour of hours; track hour) {
              <tr>
                <th scope="row" class="t-num">{{ hour }}</th>
                @for (day of days(); track day) {
                  <td>
                    <button
                      type="button"
                      class="btn btn--sm w-full"
                      [disabled]="isLocked(day, hour)"
                      [attr.data-state]="stateOf(day, hour)"
                      [attr.data-cell]="day + ' ' + hour"
                      [attr.aria-label]="cellLabel(day, hour)"
                      (click)="cycle(day, hour)"
                    >
                      <svg [appIcon]="view(day, hour).icon" size="sm"></svg>{{ view(day, hour).label }}
                    </button>
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
      <p class="t-caption">
        Cada clique muda a vaga: sem vaga, aberta, prioritária, bloqueada e de novo sem vaga. A mudança vale na hora.
      </p>
    </div>
  `,
})
export class AvailabilityPageComponent {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly auth = inject(AuthService);
  private readonly svc = inject(CareSessionsService);
  private readonly toasts = inject(ToastService);

  protected readonly hours = AGENDA_HOURS;
  protected readonly monday = signal<ISODate>(mondayOf(this.clock.today()));
  protected readonly announce = signal('');
  protected readonly days = computed(() => weekDaysFrom(this.monday()));
  protected readonly caption = computed(() => weekCaption(this.days()).replace('Agenda', 'Disponibilidade'));
  protected readonly range = computed(() => `${formatDate(this.days()[0])} a ${formatDate(this.days()[4])}`);
  private readonly psychologistId = computed(() => this.auth.actor()?.psychologistId ?? '');

  private readonly cells = computed(() => {
    const map = new Map<string, CellState>();
    const psy = this.psychologistId();
    const days = new Set(this.days());
    const now = this.clock.now();
    this.db.availabilitySlots.all().forEach((slot) => {
      if (slot.psychologistId !== psy || !days.has(slot.date)) {
        return;
      }
      const key = `${slot.date} ${slot.start}`;
      if (slot.status === 'booked' && !this.svc.isSlotFree(slot)) {
        map.set(key, 'booked');
      } else if (compareDateTimes(toIsoDateTime(slot.date, slot.start), now) <= 0) {
        map.set(key, 'past');
      } else if (slot.status === 'blocked') {
        map.set(key, 'blocked');
      } else {
        map.set(key, slot.priorityOnly ? 'priority' : 'open');
      }
    });
    return map;
  });

  protected readonly counts = computed(() => {
    const count = { open: 0, priority: 0, blocked: 0, booked: 0 };
    this.cells().forEach((state) => {
      if (state === 'open' || state === 'priority' || state === 'blocked' || state === 'booked') {
        count[state] += 1;
      }
    });
    return count;
  });

  protected stateOf(day: ISODate, hour: string): CellState {
    const found = this.cells().get(`${day} ${hour}`);
    if (found) {
      return found;
    }
    return compareDateTimes(toIsoDateTime(day, hour), this.clock.now()) <= 0 ? 'past' : 'none';
  }

  protected view(day: ISODate, hour: string) {
    return CELL_VIEW[this.stateOf(day, hour)];
  }

  protected isLocked(day: ISODate, hour: string): boolean {
    const state = this.stateOf(day, hour);
    return state === 'booked' || state === 'past';
  }

  protected dayLabel(day: ISODate): string {
    return dayAndMonth(day);
  }

  protected cellLabel(day: ISODate, hour: string): string {
    const state = this.stateOf(day, hour);
    const base = `${dayAndMonth(day)}, ${hour}: ${CELL_VIEW[state].label}`;
    return state === 'booked' || state === 'past' ? base : `${base}. Alterar a vaga`;
  }

  protected cycle(day: ISODate, hour: string): void {
    const state = this.stateOf(day, hour);
    if (state === 'booked' || state === 'past') {
      return;
    }
    const next = NEXT_STATE[state];
    const result = this.svc.setSlotState(this.psychologistId(), day, hour, next);
    if (!result.ok) {
      this.toasts.error(result.errors[0]?.message ?? 'Não foi possível mudar a vaga.');
      return;
    }
    this.announce.set(`${dayAndMonth(day)}, ${hour}: ${CELL_VIEW[next].label.toLowerCase()}.`);
  }

  protected shift(direction: -1 | 1): void {
    this.monday.set(addDays(this.monday(), direction * 7));
  }

  protected repeatPrevious(): void {
    const from = addDays(this.monday(), -7);
    const result = this.svc.copyWeek(this.psychologistId(), from, this.monday());
    if (!result.ok) {
      this.toasts.error(result.errors[0]?.message ?? 'Não foi possível repetir a semana.');
      return;
    }
    const created = result.value;
    this.toasts.show({
      message:
        created === 0
          ? 'Nada a copiar: a semana anterior não tem vagas novas para esta semana.'
          : `${created} ${created === 1 ? 'vaga copiada' : 'vagas copiadas'} da semana anterior.`,
      tone: created === 0 ? 'attention' : 'success',
    });
  }
}
