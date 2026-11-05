import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Clock } from '@core/clock';
import { Database } from '@core/data';
import { formatDate } from '@core/format';
import { ID, TrainingEvent } from '@core/models';
import { DrawerComponent, ToastService, UiPrefsService } from '@shared/ui/overlay';
import {
  BadgeComponent,
  CardComponent,
  EmptyStateComponent,
  FormFieldComponent,
  IconComponent,
  NxInputDirective,
  NxMaskDirective,
  PageHeaderComponent,
} from '@shared/ui';
import { startWith } from 'rxjs';
import { GovernanceTabsComponent } from '../components/governance-tabs.component';
import { GovernanceService, TrainingStatusRow } from '../state/governance.service';

const FRONT_ORDER: readonly TrainingEvent['front'][] = [
  'provider_integration',
  'group_professionals',
  'management',
  'continuing',
];

const FRONT_LABEL: Record<TrainingEvent['front'], string> = {
  provider_integration: 'Integração dos credenciados',
  group_professionals: 'Formação dos profissionais de grupos e capacitações',
  management: 'Formação da equipe de gestão',
  continuing: 'Formação continuada',
};

const FRONT_TEXT: Record<TrainingEvent['front'], string> = {
  provider_integration:
    'Modelo Nexus, regras de atendimento, sigilo, proteção de dados e vedação de captação paralela. É pré-requisito para ativar o credenciado.',
  group_professionals:
    'Perfil do público, sobrecarga, luto ambíguo, linguagem acessível e cuidados na demonstração prática.',
  management: 'Uso da plataforma, atendimento ao usuário, encaminhamentos e situações de risco.',
  continuing: 'Encontros periódicos com a rede, alternando estudo de casos e atualização técnica. Periodicidade: trimestral.',
};

interface Invitee {
  type: 'provider' | 'user';
  id: ID;
  name: string;
}

/**
 * SCR-M13-09 Formação (`/app/governanca/formacao`). As três frentes de formação mais a continuada, com os eventos,
 * a presença de cada pessoa e o status por prestador e por membro da equipe (`pending` ou `done`). Quem tem
 * `governance` total cria eventos e marca presença, só a partir do dia do evento. Presente na integração conclui a
 * integração do prestador (RN-CAP-02, RN-CAP-07).
 */
@Component({
  selector: 'app-governance-training-page',
  imports: [
    ReactiveFormsModule,
    BadgeComponent,
    CardComponent,
    DrawerComponent,
    EmptyStateComponent,
    FormFieldComponent,
    IconComponent,
    NxInputDirective,
    NxMaskDirective,
    PageHeaderComponent,
    GovernanceTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .plain-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }
  `,
  template: `
    <div class="page stack stack--6">
      <app-page-header
        title="Formação e capacitação"
        description="A formação existe para reduzir a variação entre os serviços: a Nexus vende, sobretudo, confiança."
      >
        @if (svc.canEditTraining()) {
          <button type="button" class="btn btn--primary" data-role="new" (click)="openNew()">Novo evento</button>
        }
      </app-page-header>
      <app-governance-tabs />

      <div class="grid grid--2">
        <app-card title="Integração dos prestadores" [subtitle]="pendingIntegration() + ' pendentes'">
          <ul class="list-card plain-list" data-role="integration-status">
            @for (row of svc.integrationStatus(); track row.personId) {
              <li class="list-row">
                <span><svg appIcon="stethoscope"></svg></span>
                <span><span class="list-row__title">{{ row.name }}</span></span>
                <app-badge [variant]="row.status === 'done' ? 'success' : 'attention'" [icon]="row.status === 'done' ? 'circle-check' : 'clock'">
                  {{ row.status === 'done' ? 'Concluída' : 'Pendente' }}
                </app-badge>
              </li>
            } @empty {
              <li class="list-row"><span></span><span class="t-muted">Nenhum prestador na rede.</span><span></span></li>
            }
          </ul>
        </app-card>
        <app-card title="Formação da equipe" [subtitle]="pendingTeam() + ' pendentes'">
          <ul class="list-card plain-list" data-role="team-status">
            @for (row of svc.teamStatus(); track row.personId) {
              <li class="list-row">
                <span><svg appIcon="user"></svg></span>
                <span><span class="list-row__title">{{ row.name }}</span></span>
                <app-badge [variant]="row.status === 'done' ? 'success' : 'attention'" [icon]="row.status === 'done' ? 'circle-check' : 'clock'">
                  {{ row.status === 'done' ? 'Concluída' : 'Pendente' }}
                </app-badge>
              </li>
            }
          </ul>
        </app-card>
      </div>

      @for (front of fronts; track front) {
        <section class="stack stack--3" [attr.data-front]="front" [attr.aria-labelledby]="'front-' + front">
          <div>
            <h2 [id]="'front-' + front" class="t-strong">{{ frontLabel(front) }}</h2>
            <p class="t-ui t-muted">{{ frontText(front) }}</p>
          </div>
          @for (event of eventsOf(front); track event.id) {
            <app-card [title]="event.title" [subtitle]="eventSubtitle(event)">
              <ul class="stack stack--2" [attr.data-event]="event.id">
                @for (a of event.attendees; track $index; let i = $index) {
                  <li class="cluster cluster--between">
                    <label class="check">
                      <input
                        type="checkbox"
                        [checked]="a.present"
                        [disabled]="!canMark(event)"
                        (change)="setPresent(event, i, $event)"
                        [attr.aria-label]="'Presença de ' + attendeeName(a)"
                      />
                      <span>{{ attendeeName(a) }}</span>
                    </label>
                    <app-badge [variant]="a.present ? 'success' : future(event) ? 'neutral' : 'attention'" dot>
                      {{ a.present ? 'Presente' : future(event) ? 'Aguardando' : 'Ausente' }}
                    </app-badge>
                  </li>
                }
              </ul>
              @if (future(event)) {
                <p class="t-caption">A presença é registrada a partir do dia do evento.</p>
              }
            </app-card>
          } @empty {
            <app-empty-state compact title="Nenhum evento nesta frente" text="Quando houver um encontro, ele aparece aqui com a presença de cada pessoa." />
          }
        </section>
      }

      @if (svc.canEditTraining()) {
      <app-drawer [(open)]="newOpen" heading="Novo evento de formação" subtitle="Escolha a frente e quem convidar">
        <form id="training-form" class="stack stack--3" novalidate [formGroup]="form" (ngSubmit)="submit()">
          <app-form-field label="Frente" controlId="trn-front">
            <select appInput formControlName="front">
              @for (f of fronts; track f) {
                <option [value]="f">{{ frontLabel(f) }}</option>
              }
            </select>
          </app-form-field>
          <app-form-field label="Título do evento" controlId="trn-title" [error]="err('title')">
            <input appInput formControlName="title" autocomplete="off" />
          </app-form-field>
          <app-form-field label="Data" controlId="trn-date" [error]="err('date')">
            <input appInput appMask="date" formControlName="date" />
          </app-form-field>
          <app-form-field label="Quem convidar" group controlId="trn-invitees" [error]="err('invitees')">
            <div role="group" aria-label="Pessoas convidadas" data-role="invitees">
              @for (p of invitees(); track p.id) {
                <label class="check">
                  <input type="checkbox" [checked]="chosen().includes(p.id)" (change)="toggle(p.id)" />
                  <span>{{ p.name }}</span>
                </label>
              } @empty {
                <p class="t-ui t-muted">Não há ninguém para convidar nesta frente.</p>
              }
            </div>
          </app-form-field>
          @if (prefs.fillWithExample()) {
            <div>
              <button type="button" class="btn btn--ghost btn--sm" data-role="fill-example" (click)="fillExample()">Preencher com exemplo</button>
            </div>
          }
        </form>
        <ng-container drawerFooter>
          <button type="button" class="btn" (click)="newOpen.set(false)">Cancelar</button>
          <button type="submit" form="training-form" class="btn btn--primary" data-role="submit">Criar evento</button>
        </ng-container>
      </app-drawer>
      }
    </div>
  `,
})
export class TrainingPageComponent {
  protected readonly svc = inject(GovernanceService);
  protected readonly prefs = inject(UiPrefsService);
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly toasts = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly fronts = FRONT_ORDER;

  protected readonly pendingIntegration = computed(
    () => this.svc.integrationStatus().filter((r: TrainingStatusRow) => r.status === 'pending').length,
  );
  protected readonly pendingTeam = computed(
    () => this.svc.teamStatus().filter((r: TrainingStatusRow) => r.status === 'pending').length,
  );

  protected frontLabel(front: TrainingEvent['front']): string {
    return FRONT_LABEL[front];
  }
  protected frontText(front: TrainingEvent['front']): string {
    return FRONT_TEXT[front];
  }
  protected eventsOf(front: TrainingEvent['front']): TrainingEvent[] {
    return this.svc.trainingEvents().filter((e) => e.front === front);
  }
  protected future(event: TrainingEvent): boolean {
    return event.date > this.clock.today();
  }
  protected canMark(event: TrainingEvent): boolean {
    return this.svc.canEditTraining() && !this.future(event);
  }
  protected eventSubtitle(event: TrainingEvent): string {
    const present = event.attendees.filter((a) => a.present).length;
    return `${formatDate(event.date)} · ${this.future(event) ? 'agendado' : 'realizado'} · ${present} de ${event.attendees.length} presentes`;
  }
  protected attendeeName(a: TrainingEvent['attendees'][number]): string {
    return this.svc.personName(a.personType, a.personId);
  }

  protected setPresent(event: TrainingEvent, index: number, domEvent: Event): void {
    const present = (domEvent.target as HTMLInputElement).checked;
    const result = this.svc.setAttendance(event.id, index, present);
    if (!result.ok) {
      (domEvent.target as HTMLInputElement).checked = !present;
      this.toasts.attention(result.message ?? 'Não foi possível registrar a presença.');
      return;
    }
    const a = event.attendees[index];
    const name = a ? this.attendeeName(a) : 'Pessoa';
    this.toasts.success(
      present
        ? `Presença de ${name} registrada${event.front === 'provider_integration' && a?.personType === 'provider' ? '. Integração concluída.' : '.'}`
        : `Presença de ${name} removida.`,
    );
  }

  // ===== Novo evento =====

  protected readonly newOpen = signal(false);
  private readonly submitted = signal(false);
  protected readonly chosen = signal<ID[]>([]);
  protected readonly form = this.fb.group({
    front: this.fb.control<TrainingEvent['front']>('provider_integration'),
    title: this.fb.control(''),
    date: this.fb.control<string | null>(null) as FormControl<string | null>,
  });
  private readonly front = toSignal(this.form.controls.front.valueChanges.pipe(startWith('provider_integration' as TrainingEvent['front'])), {
    initialValue: 'provider_integration' as TrainingEvent['front'],
  });
  private readonly titleText = toSignal(this.form.controls.title.valueChanges.pipe(startWith('')), { initialValue: '' });
  private readonly dateValue = toSignal(this.form.controls.date.valueChanges.pipe(startWith(null as string | null)), {
    initialValue: null as string | null,
  });

  constructor() {
    // Trocar a frente troca quem pode ser convidado: a escolha anterior deixa de valer.
    effect(() => {
      this.front();
      untracked(() => this.chosen.set([]));
    });
  }

  protected readonly invitees = computed<Invitee[]>(() => {
    const front = this.front();
    if (front === 'provider_integration' || front === 'continuing') {
      return this.db.providers
        .all()
        .filter((p) => p.status !== 'rejected' && p.status !== 'deaccredited')
        .map((p) => ({ type: 'provider' as const, id: p.id, name: p.name }));
    }
    return this.db.users
      .all()
      .filter((u) => u.active && (front === 'management' || u.role === 'psychologist'))
      .map((u) => ({ type: 'user' as const, id: u.id, name: u.displayName }));
  });

  protected readonly errors = computed<Record<string, string>>(() => {
    if (!this.submitted()) {
      return {};
    }
    const found: Record<string, string> = {};
    if (this.titleText().trim().length < 3) {
      found['title'] = 'Informe o título do evento.';
    }
    if (!this.dateValue()) {
      found['date'] = 'Informe a data do evento.';
    }
    if (this.chosen().length === 0) {
      found['invitees'] = 'Escolha ao menos uma pessoa para convidar.';
    }
    return found;
  });

  protected err(field: string): string | null {
    return this.errors()[field] ?? null;
  }

  protected fillExample(): void {
    this.form.patchValue({ front: 'provider_integration', title: 'Integração de credenciados: turma extra', date: this.clock.today() });
    const first = this.db.providers.find((p) => p.status !== 'rejected' && p.status !== 'deaccredited' && !p.integrationDoneAt);
    this.chosen.set(first ? [first.id] : []);
    this.submitted.set(false);
  }

  protected openNew(): void {
    this.form.reset({ front: 'provider_integration', title: '', date: this.clock.today() });
    this.chosen.set([]);
    this.submitted.set(false);
    this.newOpen.set(true);
  }

  protected toggle(id: ID): void {
    this.chosen.update((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  }

  protected submit(): void {
    this.submitted.set(true);
    if (Object.keys(this.errors()).length > 0) {
      return;
    }
    const v = this.form.getRawValue();
    const people = this.invitees().filter((p) => this.chosen().includes(p.id));
    const result = this.svc.createTrainingEvent({
      front: v.front,
      title: v.title,
      date: v.date as string,
      attendees: people.map((p) => ({ personType: p.type, personId: p.id })),
    });
    if (!result.ok) {
      this.toasts.attention(result.message ?? 'Não foi possível criar o evento.');
      return;
    }
    this.newOpen.set(false);
    this.toasts.success(`Evento criado: ${v.title.trim()}, em ${formatDate(v.date as string)}.`);
  }
}
