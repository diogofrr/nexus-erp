import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/auth';
import { Database } from '@core/data';
import { formatPercent, formatYearMonth } from '@core/format';
import { OccupancyView } from '@core/models';
import { OVERLOAD_THRESHOLD_PERCENT } from '@core/rules';
import {
  BadgeComponent,
  EmptyStateComponent,
  IconComponent,
  OccupancyBarComponent,
  PageHeaderComponent,
} from '@shared/ui';
import { RedistributeDrawerComponent } from '../components/redistribute-drawer.component';
import { CareSessionsService, OccupancyRow } from '../state/care-sessions.service';

/**
 * SCR-M05-06, Ocupação (RN-EQP-01 a 08, K20, K21): por psicólogo e mês, horas disponibilizadas, realizadas e
 * percentual. Acima de 80% em dois meses fechados seguidos aparece o aviso (com o tom da marca: fala COM o
 * psicólogo, não sobre ele). O mês corrente é "parcial" e não entra na regra; mês sem agenda mostra "n/d".
 * A gestão e o responsável técnico veem horas por psicólogo, nunca um cuidador. Quem redistribui: RT e gestão.
 */
@Component({
  selector: 'app-occupancy-page',
  imports: [
    BadgeComponent,
    EmptyStateComponent,
    IconComponent,
    OccupancyBarComponent,
    PageHeaderComponent,
    RedistributeDrawerComponent,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      <app-page-header title="Ocupação" [description]="description()">
        @if (canSeeRooms()) {
          <a class="btn" routerLink="/app/atendimento/salas">Salas do coworking</a>
        }
      </app-page-header>

      @if (rows().length === 0) {
        <app-empty-state
          title="Nenhuma agenda para mostrar"
          text="Quando houver psicólogos com agenda, as horas disponibilizadas e realizadas aparecem aqui."
        />
      } @else {
        @for (row of rows(); track row.psychologist.id) {
          <section class="card card--pad stack stack--3" [attr.data-psychologist]="row.psychologist.id" [attr.aria-labelledby]="'occ-' + row.psychologist.id">
            <div class="cluster cluster--between">
              <h2 class="card__title" [id]="'occ-' + row.psychologist.id">{{ row.psychologist.displayName }}</h2>
              <div class="cluster">
                @if (row.overload) {
                  <app-badge variant="attention" icon="triangle-alert" data-role="overload-badge">Agenda acima de 80% por dois meses seguidos</app-badge>
                } @else {
                  <app-badge variant="success" icon="circle-check">Sem alerta de agenda</app-badge>
                }
                @if (canRedistribute()) {
                  <button type="button" class="btn btn--sm" (click)="redistribute(row.psychologist.id)" data-role="redistribute">
                    <svg appIcon="users-round" size="sm"></svg>Redistribuir
                  </button>
                }
              </div>
            </div>

            <div class="table-wrap">
              <table class="table" data-role="occupancy-table">
                <caption class="sr-only">Ocupação de {{ row.psychologist.displayName }} nos últimos meses</caption>
                <thead>
                  <tr>
                    <th scope="col">Mês</th>
                    <th scope="col" class="t-right">Horas disponibilizadas</th>
                    <th scope="col" class="t-right">Horas realizadas</th>
                    <th scope="col" class="t-right">Ocupação</th>
                  </tr>
                </thead>
                <tbody>
                  @for (month of row.months; track month.month) {
                    <tr [attr.data-month]="month.month">
                      <th scope="row">
                        {{ monthName(month.month) }}
                        @if (month.isPartialMonth) {
                          <app-badge outline icon="clock">parcial</app-badge>
                        }
                      </th>
                      <td class="t-right t-num">{{ month.availableHours }}</td>
                      <td class="t-right t-num">{{ month.doneHours }}</td>
                      <td class="t-right t-num" data-role="percent">{{ percentText(month) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <app-occupancy-bar [name]="'Último mês fechado'" [percent]="row.months[1]?.occupancyPercent ?? null" [limit]="limit" />

            @if (row.overload) {
              <p class="banner banner--attention" role="note" data-role="overload-text">
                @if (isOwn(row)) {
                  Sua agenda está acima de 80% há dois meses seguidos. A gestão e o responsável técnico também
                  veem este aviso, para ajudar a redistribuir os casos.
                } @else {
                  A agenda de {{ row.psychologist.displayName }} está acima de 80% há dois meses seguidos. O aviso é para
                  ajudar a redistribuir os casos, não mede o profissional.
                }
              </p>
            }
          </section>
        }

        <section class="card card--pad stack stack--2" aria-labelledby="occ-legend">
          <h2 id="occ-legend" class="card__title">Como ler esta tela</h2>
          <ul class="stack stack--2 t-ui">
            <li><strong>Ocupação</strong> é a razão entre horas realizadas e horas disponibilizadas no mês.</li>
            <li><strong>Parcial</strong>: o mês em andamento aparece, mas não conta na regra dos dois meses seguidos.</li>
            <li><strong>n/d</strong>: o psicólogo não tinha agenda naquele mês, então não há percentual nem alerta.</li>
            <li>O limite é estritamente maior que 80%: exatamente 80,0% não dispara o aviso.</li>
            <li>A equipe só é ampliada quando o resultado mensal permitir. Essa decisão é dos sócios.</li>
          </ul>
        </section>
      }
    </div>

    <app-redistribute-drawer [(open)]="redistributeOpen" [fromId]="redistributeFrom()" />
  `,
})
export class OccupancyPageComponent {
  private readonly db = inject(Database);
  private readonly auth = inject(AuthService);
  private readonly svc = inject(CareSessionsService);

  protected readonly limit = OVERLOAD_THRESHOLD_PERCENT;
  protected readonly redistributeOpen = signal(false);
  protected readonly redistributeFrom = signal('');

  private readonly myPsychologist = computed(() => this.auth.actor()?.psychologistId ?? null);
  protected readonly canRedistribute = computed(
    () => this.auth.role() === 'technical_lead' || this.auth.role() === 'partner',
  );
  protected readonly canSeeRooms = computed(() => this.auth.can('rooms', 'view'));
  protected readonly description = computed(() =>
    this.myPsychologist() !== null
      ? 'Suas horas disponibilizadas e realizadas, mês a mês.'
      : 'Horas disponibilizadas, realizadas e ocupação por psicólogo. Nenhum cuidador aparece aqui.',
  );

  protected readonly rows = computed<OccupancyRow[]>(() => {
    this.db.availabilitySlots.all();
    this.db.careSessions.all();
    this.db.monthSummaries.all();
    const mine = this.myPsychologist();
    return this.db.psychologists
      .all()
      .filter((p) => mine === null || p.id === mine)
      .map((p) => this.svc.occupancyFor(p));
  });

  protected isOwn(row: OccupancyRow): boolean {
    return this.myPsychologist() === row.psychologist.id;
  }

  protected monthName(month: string): string {
    return formatYearMonth(month);
  }

  protected percentText(month: OccupancyView): string {
    return month.occupancyPercent === null ? 'n/d' : formatPercent(month.occupancyPercent, { decimals: 1 });
  }

  protected redistribute(fromId: string): void {
    this.redistributeFrom.set(fromId);
    this.redistributeOpen.set(true);
  }
}
