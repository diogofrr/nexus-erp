import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Clock, compareDateTimes } from '@core/clock';
import { Database } from '@core/data';
import { formatDate, formatPercent, formatTime } from '@core/format';
import { ActivityEnrollment } from '@core/models';
import {
  BadgeComponent,
  EmptyStateComponent,
  KpiComponent,
  KpiStripComponent,
  PageHeaderComponent,
} from '@shared/ui';
import { PageContextService, ToastService } from '@shared/ui/overlay';
import { checkedOf } from '@shared/ui/util/form-events';
import { ACTIVITY_STATUS_VIEW } from '../state/groups-labels';
import { GroupsService } from '../state/groups.service';

/**
 * SCR-M07-05, Presença: marcar presentes e ausentes por encontro. A marcação vale para encontro que já começou ou
 * foi realizado; ao marcar o encontro como realizado, a atividade passa a "em andamento". A taxa de presença e o
 * preenchimento (RN-KPI-08) mudam na hora. Nomes só para quem pode vê-los (a sócia vê código).
 */
@Component({
  selector: 'app-attendance-page',
  imports: [BadgeComponent, EmptyStateComponent, KpiComponent, KpiStripComponent, PageHeaderComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      @if (activity(); as a) {
        <app-page-header title="Presença" [description]="a.title">
          <a class="btn" [routerLink]="['/app/grupos', a.id]">Voltar à atividade</a>
        </app-page-header>

        <div class="cluster">
          <app-badge [variant]="status().variant" [icon]="status().icon">{{ status().label }}</app-badge>
        </div>

        <app-kpi-strip aria-label="Indicadores de presença">
          <app-kpi label="Inscritos" [value]="stats().holders" data-role="kpi-enrolled" />
          <app-kpi label="Presenças registradas" [value]="stats().presences" data-role="kpi-presences" />
          <app-kpi label="Taxa de presença" [value]="stats().presencePercent === null ? 'n/d' : percent(stats().presencePercent)" [context]="stats().doneMeetings + ' encontros realizados'" data-role="kpi-rate" />
        </app-kpi-strip>

        @if (a.status === 'draft' || a.status === 'cancelled') {
          <app-empty-state title="Sem encontros em andamento" text="A presença só se marca em atividade publicada e não cancelada." />
        } @else if (rows().length === 0) {
          <app-empty-state title="Ninguém inscrito ainda" text="Quando houver inscritos, a lista de presença aparece aqui." />
        } @else {
          <div class="table-wrap">
            <table class="table" data-role="attendance-table">
              <caption class="sr-only">Presença por encontro em {{ a.title }}</caption>
              <thead>
                <tr>
                  <th scope="col">Participante</th>
                  @for (m of a.meetings; track m.id; let i = $index) {
                    <th scope="col">
                      <span class="t-num">Encontro {{ i + 1 }}</span><br />
                      <span class="t-caption">{{ date(m.startAt) }}, {{ time(m.startAt) }}</span><br />
                      @if (m.done) {
                        <app-badge variant="success" icon="check">Realizado</app-badge>
                      } @else if (a.status !== 'finished' && started(m.startAt)) {
                        <button type="button" class="btn btn--sm" (click)="markDone(m.id)" data-role="mark-done">Marcar como realizado</button>
                      } @else {
                        <app-badge outline icon="clock">A realizar</app-badge>
                      }
                    </th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (row of rows(); track row.enrollment.id) {
                  <tr [attr.data-enrollment]="row.enrollment.id">
                    <th scope="row"><span [class.discreet]="canSeeNames()">{{ row.name }}</span></th>
                    @for (m of a.meetings; track m.id; let i = $index) {
                      <td>
                        <label class="cluster">
                          <input
                            type="checkbox"
                            [checked]="present(row.enrollment, m.id)"
                            [disabled]="!(m.done || started(m.startAt)) || a.status === 'finished'"
                            [attr.aria-label]="row.name + ', encontro ' + (i + 1) + ': presente'"
                            [attr.data-meeting]="m.id"
                            (change)="mark(row.enrollment, m.id, checkedOf($event))"
                          />
                          <span>{{ present(row.enrollment, m.id) ? 'Presente' : m.done || started(m.startAt) ? 'Ausente' : 'A marcar' }}</span>
                        </label>
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <p class="t-caption">A marcação vale para encontros que já começaram ou foram realizados.</p>
        }
      } @else {
        <app-empty-state title="Atividade não encontrada" text="Volte à programação e escolha a atividade de novo.">
          <a class="btn btn--primary" routerLink="/app/grupos">Voltar à programação</a>
        </app-empty-state>
      }
    </div>
  `,
})
export class AttendancePageComponent {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly svc = inject(GroupsService);
  private readonly toasts = inject(ToastService);
  private readonly page = inject(PageContextService);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });

  protected readonly checkedOf = checkedOf;
  protected readonly activity = computed(() => this.db.activities.get(this.params().get('id') ?? ''));
  protected readonly status = computed(() => ACTIVITY_STATUS_VIEW[this.activity()?.status ?? 'draft']);
  protected readonly stats = computed(() => {
    const a = this.activity();
    return a
      ? this.svc.statsOf(a)
      : { holders: 0, waitlisted: 0, capacity: 0, fillPercent: null, doneMeetings: 0, presences: 0, presencePercent: null };
  });
  protected readonly canSeeNames = computed(() => {
    const a = this.activity();
    return !!a && this.svc.canSeeNames(a);
  });
  protected readonly rows = computed(() => {
    const a = this.activity();
    if (!a) {
      return [];
    }
    const names = this.canSeeNames();
    return this.svc
      .holders(a.id)
      .sort((x, y) => x.createdAt.localeCompare(y.createdAt))
      .map((enrollment) => {
        const caregiver = enrollment.caregiverId ? this.db.caregivers.get(enrollment.caregiverId) : undefined;
        const name = enrollment.external
          ? names
            ? enrollment.external.name
            : 'Participante externo'
          : names
            ? (caregiver?.fullName ?? 'Cuidador')
            : (caregiver?.code ?? 'Cuidador');
        return { enrollment, name };
      });
  });

  constructor() {
    effect(() => {
      const a = this.activity();
      this.page.setCrumbs([
        { label: 'Grupos', link: '/app/grupos' },
        { label: a?.title ?? 'Atividade', link: a ? `/app/grupos/${a.id}` : '/app/grupos' },
        { label: 'Presença' },
      ]);
    });
  }

  protected date(value: string): string {
    return formatDate(value);
  }

  protected time(value: string): string {
    return formatTime(value);
  }

  protected percent(value: number | null): string {
    return value === null ? 'n/d' : formatPercent(value, { decimals: 1 });
  }

  protected started(startAt: string): boolean {
    return compareDateTimes(startAt, this.clock.now()) <= 0;
  }

  protected present(enrollment: ActivityEnrollment, meetingId: string): boolean {
    return enrollment.attendance.some((a) => a.meetingId === meetingId && a.present);
  }

  protected mark(enrollment: ActivityEnrollment, meetingId: string, on: boolean): void {
    const result = this.svc.setAttendance(enrollment.id, meetingId, on);
    if (!result.ok) {
      this.toasts.error(result.errors[0]?.message ?? 'Não foi possível registrar a presença.');
    }
  }

  protected markDone(meetingId: string): void {
    const a = this.activity();
    if (!a) {
      return;
    }
    const result = this.svc.markMeetingDone(a.id, meetingId);
    this.toasts.show(
      result.ok
        ? { message: 'Encontro marcado como realizado. A taxa de presença foi atualizada.' }
        : { message: result.errors[0]?.message ?? 'Não foi possível marcar o encontro.', tone: 'danger' },
    );
  }
}
