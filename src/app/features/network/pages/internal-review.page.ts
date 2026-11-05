import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { Database } from '@core/data';
import { formatDate, formatDateTime, formatNumber } from '@core/format';
import { InternalReview } from '@core/models';
import { NetworkService } from '@core/network';
import {
  BadgeComponent,
  EmptyStateComponent,
  FormFieldComponent,
  NxInputDirective,
  PageHeaderComponent,
  RadioGroupComponent,
  RadioOption,
  TimelineComponent,
  TimelineItem,
} from '@shared/ui';
import { DialogService, ToastService } from '@shared/ui/overlay';
import { ArpBandComponent, ProviderStatusComponent } from '../components/badges.component';
import { ReasonDrawerComponent, ReasonSubmit } from '../components/reason-drawer.component';
import { NetworkAdminService } from '../state/network-admin.service';
import { PROVIDER_STATUS_VIEW, categoryLabel } from '../state/network-labels';

type Decision = NonNullable<InternalReview['decision']>;

const DECISION_OPTIONS: readonly RadioOption<Decision>[] = [
  {
    value: 'confirm_deaccreditation',
    label: 'Confirmar descredenciamento',
    hint: 'O credenciamento é encerrado e o e-mail de encerramento fica registrado.',
  },
  {
    value: 'reinstate',
    label: 'Reinstalar',
    hint: 'O prestador volta à busca. A próxima auditoria reclassifica. Exige o motivo.',
  },
  {
    value: 'keep_monitoring',
    label: 'Manter em monitoramento',
    hint: 'O prestador volta à busca com acompanhamento. A nota é opcional.',
  },
];

const TRIGGER_TEXT: Readonly<Record<InternalReview['trigger'], string>> = {
  average_below_4: 'Média abaixo de 4,0 na auditoria',
  grave_complaints: 'Três ou mais reclamações graves',
  manual: 'Suspensão feita pela gestão',
};

const DECISION_TEXT: Readonly<Record<Decision, string>> = {
  confirm_deaccreditation: 'Descredenciamento confirmado',
  reinstate: 'Reinstalado',
  keep_monitoring: 'Mantido em monitoramento',
};

/**
 * Avaliação interna (SCR-M08-08, F08 parte C, RN-ARP-10 e 11): o resumo do caso, a justificativa que o
 * prestador enviou (a gestão registra o que recebeu) e a decisão: confirmar o descredenciamento (com o texto do
 * e-mail de encerramento, que fica registrado), reinstalar (com motivo) ou manter em monitoramento.
 */
@Component({
  selector: 'app-network-internal-review-page',
  imports: [
    RouterLink,
    ArpBandComponent,
    BadgeComponent,
    EmptyStateComponent,
    FormFieldComponent,
    NxInputDirective,
    PageHeaderComponent,
    ProviderStatusComponent,
    RadioGroupComponent,
    ReasonDrawerComponent,
    TimelineComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      @if (!review() || !provider()) {
        <div class="card">
          <app-empty-state
            kind="error"
            title="Não encontramos esta avaliação interna"
            text="Ela pode ter sido removida. Volte aos prestadores para continuar."
          >
            <a class="btn" routerLink="/app/rede/prestadores">Voltar aos prestadores</a>
          </app-empty-state>
        </div>
      } @else {
        @let r = review()!;
        @let p = provider()!;
        <app-page-header
          title="Avaliação interna"
          [description]="p.name + ' · ' + category()"
          [breadcrumbs]="[{ label: 'Prestadores', link: '/app/rede/prestadores' }, { label: p.name, link: '/app/rede/prestadores/' + p.id }, { label: 'Avaliação interna' }]"
        >
          <a class="btn" [routerLink]="['/app/rede/prestadores', p.id]">Ver ficha do prestador</a>
        </app-page-header>

        <div class="stack stack--6">
          <section class="card card--pad stack stack--3" aria-labelledby="nx-case-title" data-role="case-summary">
            <h2 class="card__title" id="nx-case-title">Resumo do caso</h2>
            <div class="cluster">
              <app-provider-status [status]="p.status" />
              @if (summary(); as s) {
                @if (s.evaluationCount > 0 || s.band === 'deaccreditation') {
                  <app-arp-band [band]="s.band" />
                }
              }
            </div>
            <dl class="dl">
              <dt>O que abriu o caso</dt>
              <dd>{{ trigger(r) }}</dd>
              <dt>Aberta em</dt>
              <dd>{{ date(r.openedAt) }}</dd>
              @if (summary(); as s) {
                <dt>Média</dt>
                <dd data-role="case-average">{{ s.average === null ? 'Sem média (menos de 5 avaliações)' : averageText() }}</dd>
                <dt>Avaliações</dt>
                <dd>{{ s.evaluationCount }}</dd>
                <dt>Reclamações graves</dt>
                <dd>{{ s.graveCount }}</dd>
              }
            </dl>
            <app-timeline label="Histórico de estado do prestador" [items]="timeline()" />
          </section>

          <section class="card card--pad stack stack--3" aria-labelledby="nx-sent-title" data-role="provider-justification">
            <h2 class="card__title" id="nx-sent-title">O que o prestador enviou</h2>
            @if (r.justification) {
              <p class="t-caption">Recebida em {{ dateTime(r.justificationAt) }}</p>
              <blockquote class="t-ui" data-role="justification-text">{{ r.justification }}</blockquote>
            } @else {
              <p class="t-ui" data-role="no-justification">Nenhuma justificativa enviada até agora.</p>
            }
            @if (manager() && !r.decision) {
              <div>
                <button type="button" class="btn" data-role="register-justification" (click)="justificationOpen.set(true)">
                  {{ r.justification ? 'Atualizar a justificativa recebida' : 'Registrar justificativa recebida' }}
                </button>
              </div>
            }
          </section>

          <section class="card card--pad stack stack--3" aria-labelledby="nx-decision-title" data-role="decision">
            <h2 class="card__title" id="nx-decision-title">Decisão</h2>
            @if (r.decision) {
              <app-badge variant="success" icon="circle-check">{{ decisionText(r.decision) }}</app-badge>
              <dl class="dl">
                <dt>Decidido em</dt>
                <dd>{{ date(r.decidedAt) }}</dd>
                @if (r.decisionNote) {
                  <dt>Nota da decisão</dt>
                  <dd>{{ r.decisionNote }}</dd>
                }
              </dl>
              @if (r.closureEmail; as mail) {
                <div class="card card--sunken card--pad stack stack--2" data-role="closure-email">
                  <p class="t-strong">E-mail de encerramento registrado</p>
                  <p class="t-caption">Para {{ mail.to }} em {{ dateTime(mail.sentAt) }}</p>
                  <p class="t-strong">{{ mail.subject }}</p>
                  <p class="t-ui">{{ mail.body }}</p>
                </div>
              }
            } @else if (!manager()) {
              <p class="t-ui">A decisão é da gestão. Aqui você acompanha o caso.</p>
            } @else {
              <form class="stack stack--3" novalidate (submit)="decide($event)" data-role="decision-form">
                <app-form-field label="O que a gestão decide" group controlId="decision-choice" [error]="choiceError()">
                  <app-radio-group [options]="decisionOptions" [value]="choice()" (valueChange)="choice.set($event)" />
                </app-form-field>

                @if (choice() === 'confirm_deaccreditation') {
                  <div class="stack stack--3" data-role="closure-editor">
                    <p class="t-ui">
                      O ERP registra o e-mail no histórico. O envio é feito por você, fora do ERP.
                    </p>
                    <app-form-field label="Para" controlId="closure-to">
                      <input appInput [value]="provider()?.email ?? ''" readonly />
                    </app-form-field>
                    <app-form-field label="Assunto" controlId="closure-subject">
                      <input appInput [value]="subject()" (input)="onSubject($event)" />
                    </app-form-field>
                    <app-form-field label="Texto do e-mail" controlId="closure-body" [error]="bodyError()">
                      <textarea appInput rows="6" [value]="body()" (input)="onBody($event)"></textarea>
                    </app-form-field>
                    <details class="card card--sunken card--pad">
                      <summary>Pré-visualização do e-mail</summary>
                      <p class="t-caption">Para {{ provider()?.email }}</p>
                      <p class="t-strong">{{ subject() }}</p>
                      <p class="t-ui" data-role="email-preview">{{ body() }}</p>
                    </details>
                  </div>
                }
                @if (choice() === 'reinstate' || choice() === 'keep_monitoring') {
                  <app-form-field
                    [label]="choice() === 'reinstate' ? 'Motivo da reinstalação' : 'Nota'"
                    [optional]="choice() === 'keep_monitoring'"
                    controlId="decision-note"
                    [error]="noteError()"
                  >
                    <textarea appInput rows="3" [value]="note()" (input)="onNote($event)"></textarea>
                  </app-form-field>
                }
                @if (serverError()) {
                  <p class="field__error" role="alert" data-role="server-error">{{ serverError() }}</p>
                }
                <div>
                  <button
                    type="submit"
                    class="btn"
                    [class.btn--danger]="choice() === 'confirm_deaccreditation'"
                    [class.btn--primary]="choice() !== 'confirm_deaccreditation'"
                    data-role="decide"
                  >
                    {{ confirmLabel() }}
                  </button>
                </div>
              </form>
            }
          </section>
        </div>
      }
    </div>

    <app-reason-drawer
      [(open)]="justificationOpen"
      heading="Registrar justificativa recebida"
      [subtitle]="provider()?.name ?? ''"
      label="Justificativa do prestador"
      hint="Cole ou resuma o que o prestador enviou. A data de hoje fica registrada."
      [minLength]="10"
      requiredMessage="Escreva a justificativa com ao menos 10 caracteres."
      confirmLabel="Registrar justificativa"
      [rows]="6"
      [initialText]="review()?.justification ?? ''"
      [error]="actionError()"
      (submitted)="saveJustification($event)"
    />
  `,
})
export class InternalReviewPage {
  private readonly route = inject(ActivatedRoute);
  private readonly db = inject(Database);
  private readonly network = inject(NetworkService);
  private readonly admin = inject(NetworkAdminService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);

  protected readonly decisionOptions = DECISION_OPTIONS;
  protected readonly justificationOpen = signal(false);
  protected readonly actionError = signal<string | null>(null);
  protected readonly choice = signal<string | null>(null);
  protected readonly subject = signal('Encerramento do credenciamento na rede Nexus');
  protected readonly body = signal(
    'Informamos o encerramento do seu credenciamento na rede Nexus, após a avaliação interna do caso. Agradecemos o período de parceria e ficamos à disposição.',
  );
  protected readonly note = signal('');
  protected readonly tried = signal(false);
  protected readonly serverError = signal<string | null>(null);

  private readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), {
    initialValue: this.route.snapshot.paramMap.get('id') ?? '',
  });

  protected readonly review = computed(() => this.db.internalReviews.get(this.id()));
  protected readonly provider = computed(() => {
    const r = this.review();
    return r ? this.db.providers.get(r.providerId) : undefined;
  });
  protected readonly summary = computed(() => {
    const r = this.review();
    return r ? this.network.summaryOf(r.providerId) : undefined;
  });
  protected readonly manager = computed(() => this.admin.isManager());
  protected readonly category = computed(() => {
    const p = this.provider();
    return p ? categoryLabel(p.category) : '';
  });
  protected readonly averageText = computed(() => {
    const s = this.summary();
    return s && s.average !== null ? formatNumber(s.average, 2) : '';
  });

  protected readonly timeline = computed<TimelineItem[]>(() => {
    const r = this.review();
    if (!r) {
      return [];
    }
    return this.db.providerStatusEvents
      .all()
      .filter((e) => e.providerId === r.providerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 6)
      .map((e) => ({
        id: e.id,
        title: e.from === e.to ? 'Comunicação registrada' : PROVIDER_STATUS_VIEW[e.to].label,
        text: e.reason,
        at: e.createdAt,
      }));
  });

  protected readonly confirmLabel = computed(() => {
    switch (this.choice()) {
      case 'confirm_deaccreditation':
        return 'Confirmar descredenciamento';
      case 'reinstate':
        return 'Reinstalar prestador';
      case 'keep_monitoring':
        return 'Manter em monitoramento';
      default:
        return 'Registrar decisão';
    }
  });

  protected choiceError(): string | null {
    return this.tried() && !this.choice() ? 'Escolha o que a gestão decide.' : null;
  }

  protected bodyError(): string | null {
    return this.tried() && this.choice() === 'confirm_deaccreditation' && !this.body().trim()
      ? 'Escreva o texto do e-mail de encerramento.'
      : null;
  }

  protected noteError(): string | null {
    return this.tried() && this.choice() === 'reinstate' && !this.note().trim()
      ? 'Escreva o motivo da reinstalação.'
      : null;
  }

  protected trigger(review: InternalReview): string {
    return TRIGGER_TEXT[review.trigger];
  }

  protected decisionText(decision: Decision): string {
    return DECISION_TEXT[decision];
  }

  protected date(value: string | undefined): string {
    return value ? formatDate(value) : '';
  }

  protected dateTime(value: string | undefined): string {
    return value ? formatDateTime(value) : '';
  }

  protected onSubject(event: Event): void {
    this.subject.set((event.target as HTMLInputElement).value);
  }

  protected onBody(event: Event): void {
    this.body.set((event.target as HTMLTextAreaElement).value);
  }

  protected onNote(event: Event): void {
    this.note.set((event.target as HTMLTextAreaElement).value);
  }

  protected saveJustification(input: ReasonSubmit): void {
    const r = this.review();
    if (!r) {
      return;
    }
    const result = this.admin.registerJustification(r.id, input.text);
    if (!result.ok) {
      this.actionError.set(result.error);
      return;
    }
    this.actionError.set(null);
    this.justificationOpen.set(false);
    this.toasts.success('Justificativa registrada no caso.');
  }

  protected async decide(event: Event): Promise<void> {
    event.preventDefault();
    this.tried.set(true);
    this.serverError.set(null);
    const r = this.review();
    const p = this.provider();
    const choice = this.choice() as Decision | null;
    if (!r || !p || !choice || this.bodyError() || this.noteError()) {
      return;
    }
    if (choice === 'confirm_deaccreditation') {
      const { confirmed } = await this.dialogs.confirm({
        title: `Descredenciar ${p.name}?`,
        message: 'O prestador sai da busca e o vínculo é encerrado.',
        effects: {
          block: ['o prestador, que não aparece mais na busca da rede'],
          keep: ['o e-mail de encerramento registrado no histórico', 'o histórico de avaliações'],
        },
        irreversibleNote: 'Esta decisão é definitiva.',
        confirmLabel: 'Descredenciar',
      });
      if (!confirmed) {
        return;
      }
    }
    const result = this.admin.decideReview(r.id, choice, {
      note: this.note(),
      email: { to: p.email, subject: this.subject(), body: this.body() },
    });
    if (!result.ok) {
      this.serverError.set(result.error);
      return;
    }
    this.toasts.success(
      choice === 'confirm_deaccreditation'
        ? `${p.name} foi descredenciado. O e-mail de encerramento ficou registrado.`
        : choice === 'reinstate'
          ? `${p.name} voltou à busca. A próxima auditoria reclassifica.`
          : `${p.name} voltou à busca em monitoramento.`,
    );
  }
}
