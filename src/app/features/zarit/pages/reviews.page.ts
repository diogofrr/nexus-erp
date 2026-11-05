import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { inject } from '@angular/core';
import { Database } from '@core/data';
import { formatDate, formatDateTime } from '@core/format';
import { ReviewRequest } from '@core/models';
import {
  BadgeComponent,
  DeadlineBadgeComponent,
  EmptyStateComponent,
  FilterChipsComponent,
  FilterOption,
  FormFieldComponent,
  IconComponent,
  NxInputDirective,
  PageHeaderComponent,
} from '@shared/ui';
import { DrawerComponent, ToastService } from '@shared/ui/overlay';
import { valueOf } from '@shared/ui/util/form-events';
import { ZaritAccessService } from '../state/zarit-access.service';
import { REVIEW_ABOUT_LABELS } from '../state/zarit-labels';
import { FieldError, ZaritService } from '../state/zarit.service';

const STATE_OPTIONS: FilterOption[] = [
  { value: 'pendentes', label: 'Pendentes' },
  { value: 'respondidos', label: 'Respondidos' },
  { value: 'todos', label: 'Todos' },
];

/**
 * SCR-M06-09, Pedidos de revisão (RN-ZRT-20): o cuidador pode pedir a revisão de qualquer decisão tomada com
 * base nos resultados e alertas. O sistema registra o pedido, o prazo (15 dias, como os direitos do titular) e a
 * resposta do psicólogo do caso. Como o aplicativo do cuidador está fora do protótipo, o pedido também pode ser
 * registrado aqui, em nome do cuidador.
 */
@Component({
  selector: 'app-reviews-page',
  imports: [
    BadgeComponent,
    DeadlineBadgeComponent,
    DrawerComponent,
    EmptyStateComponent,
    FilterChipsComponent,
    FormFieldComponent,
    IconComponent,
    NxInputDirective,
    PageHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      <app-page-header
        title="Pedidos de revisão"
        [count]="count()"
        description="Pedidos do cuidador para rever uma decisão tomada com base nos resultados. Cada um tem prazo e resposta registrada."
      >
        <button type="button" class="btn btn--primary" (click)="openNew()" data-role="new-review">
          <svg appIcon="plus" size="sm"></svg>Registrar pedido
        </button>
      </app-page-header>

      <app-filter-chips label="Situação" allLabel="" [options]="stateOptions" [value]="state()" (valueChange)="state.set($event ?? 'pendentes')" />

      @if (rows().length === 0) {
        <app-empty-state title="Nenhum pedido de revisão aqui" text="Quando um cuidador pedir a revisão de uma decisão, o pedido aparece nesta lista, com prazo." />
      }
      @for (row of rows(); track row.request.id) {
        <article class="card card--pad stack stack--3" [attr.data-review]="row.request.id">
          <div class="cluster cluster--between">
            <h2 class="card__title"><span class="discreet">{{ row.name }}</span> <span class="code-chip">{{ row.code }}</span></h2>
            <div class="cluster">
              <app-badge outline>{{ about(row.request.about) }}</app-badge>
              @if (row.request.answeredAt) {
                <app-badge variant="success" icon="circle-check">Respondido em {{ date(row.request.answeredAt) }}</app-badge>
              } @else {
                <app-deadline-badge [due]="row.request.dueAt" unit="days" />
              }
            </div>
          </div>
          <p class="discreet" data-role="request-text">{{ row.request.text }}</p>
          <p class="t-caption">Registrado em {{ dateTime(row.request.createdAt) }}. Prazo até {{ date(row.request.dueAt) }}.</p>
          @if (row.request.answer) {
            <div class="card card--sunken card--pad">
              <p class="t-strong">Resposta</p>
              <p class="discreet" data-role="answer-text">{{ row.request.answer }}</p>
            </div>
          } @else if (row.canAct) {
            <app-form-field label="Resposta ao cuidador" [controlId]="'answer-' + row.request.id" [error]="answerError(row.request.id)">
              <textarea appInput rows="3" [value]="answers()[row.request.id] ?? ''" (input)="setAnswer(row.request.id, valueOf($event))" data-role="answer-input"></textarea>
            </app-form-field>
            <div>
              <button type="button" class="btn btn--primary" (click)="answer(row.request)" data-role="answer-submit">Registrar resposta</button>
            </div>
          }
        </article>
      }
    </div>

    <app-drawer [(open)]="newOpen" heading="Registrar pedido de revisão" [subtitle]="'Em nome do cuidador, com o prazo de ' + deadlineDays() + ' dias.'">
      <div class="stack stack--6" data-role="review-form">
        <app-form-field label="Cuidador" controlId="review-caregiver" [error]="err('caregiver')">
          <select appInput [value]="caregiverId()" (change)="caregiverId.set(valueOf($event))" data-role="review-caregiver">
            <option value="">Escolha o cuidador</option>
            @for (c of caregivers(); track c.id) {
              <option [value]="c.id" [selected]="c.id === caregiverId()">{{ c.fullName }} ({{ c.code }})</option>
            }
          </select>
        </app-form-field>
        <app-form-field label="O pedido é sobre" controlId="review-about">
          <select appInput [value]="about_()" (change)="about_.set(valueOf($event))">
            <option value="zarit_decision" [selected]="about_() === 'zarit_decision'">Uma decisão tomada com base na escala</option>
            <option value="arbe_alert" [selected]="about_() === 'arbe_alert'">Um alerta de esgotamento (ARBE)</option>
          </select>
        </app-form-field>
        <app-form-field label="Pedido do cuidador" controlId="review-text" [error]="err('text')">
          <textarea appInput rows="4" [value]="text()" (input)="text.set(valueOf($event))" data-role="review-text"></textarea>
        </app-form-field>
      </div>
      <ng-container drawerFooter>
        <button type="button" class="btn" (click)="newOpen.set(false)">Voltar</button>
        <button type="button" class="btn btn--primary" (click)="register()" data-role="review-submit">Registrar pedido</button>
      </ng-container>
    </app-drawer>
  `,
})
export class ReviewsPageComponent {
  private readonly db = inject(Database);
  private readonly svc = inject(ZaritService);
  private readonly access = inject(ZaritAccessService);
  private readonly toasts = inject(ToastService);

  protected readonly valueOf = valueOf;
  protected readonly stateOptions = STATE_OPTIONS;
  protected readonly state = signal('pendentes');
  protected readonly answers = signal<Record<string, string>>({});
  protected readonly answerErrors = signal<Record<string, string>>({});

  protected readonly newOpen = signal(false);
  protected readonly caregiverId = signal('');
  protected readonly about_ = signal('zarit_decision');
  protected readonly text = signal('');
  protected readonly errors = signal<FieldError[]>([]);

  protected readonly caregivers = computed(() =>
    this.access.visibleCaregivers().filter((c) => c.status === 'active').sort((a, b) => a.fullName.localeCompare(b.fullName, 'pt-BR')),
  );

  protected readonly rows = computed(() => {
    const visible = new Map(this.access.visibleCaregivers().map((c) => [c.id, c] as const));
    const state = this.state();
    return this.db.reviewRequests
      .all()
      .filter((r) => visible.has(r.caregiverId))
      .filter((r) => (state === 'todos' ? true : state === 'respondidos' ? !!r.answeredAt : !r.answeredAt))
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
      .map((request) => ({
        request,
        name: visible.get(request.caregiverId)?.fullName ?? 'Cuidador',
        code: visible.get(request.caregiverId)?.code ?? '',
        canAct: this.access.canAct(request.caregiverId),
      }));
  });
  protected readonly deadlineDays = computed(() => this.db.settings.value().dsrDeadlineDays);
  protected readonly count = computed(() => `${this.rows().length} ${this.rows().length === 1 ? 'pedido' : 'pedidos'}`);

  protected about(about: ReviewRequest['about']): string {
    return REVIEW_ABOUT_LABELS[about];
  }

  protected date(value: string): string {
    return formatDate(value);
  }

  protected dateTime(value: string): string {
    return formatDateTime(value);
  }

  protected err(field: string): string | null {
    return this.errors().find((e) => e.field === field)?.message ?? null;
  }

  protected answerError(id: string): string | null {
    return this.answerErrors()[id] ?? null;
  }

  protected setAnswer(id: string, value: string): void {
    this.answers.update((current) => ({ ...current, [id]: value }));
  }

  protected answer(request: ReviewRequest): void {
    const result = this.svc.answerReview(request.id, this.answers()[request.id] ?? '');
    if (!result.ok) {
      this.answerErrors.update((current) => ({ ...current, [request.id]: result.errors[0]?.message ?? '' }));
      return;
    }
    this.answerErrors.update((current) => ({ ...current, [request.id]: '' }));
    this.toasts.success('Resposta registrada. O pedido fica com data e hora no histórico.');
  }

  protected openNew(): void {
    this.caregiverId.set('');
    this.about_.set('zarit_decision');
    this.text.set('');
    this.errors.set([]);
    this.newOpen.set(true);
  }

  protected register(): void {
    const result = this.svc.registerReviewRequest(
      this.caregiverId(),
      this.about_() === 'arbe_alert' ? 'arbe_alert' : 'zarit_decision',
      this.text(),
    );
    if (!result.ok) {
      this.errors.set(result.errors);
      return;
    }
    this.newOpen.set(false);
    this.state.set('pendentes');
    this.toasts.success(`Pedido de revisão registrado, com prazo de ${this.deadlineDays()} dias.`);
  }
}
