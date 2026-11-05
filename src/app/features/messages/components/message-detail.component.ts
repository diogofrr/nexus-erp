import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuditLogService } from '@core/audit';
import { AuthService } from '@core/auth';
import { Clock } from '@core/clock';
import { Database } from '@core/data';
import { formatDateTime, formatTime } from '@core/format';
import type { Message } from '@core/models';
import { countSupportRequests } from '@core/rules';
import {
  BadgeComponent,
  BadgeVariant,
  DeadlineBadgeComponent,
  FormFieldComponent,
  IconComponent,
  MaskedFieldComponent,
  NxInputDirective,
  SwitchComponent,
  TimelineComponent,
  TimelineItem,
} from '@shared/ui';
import { DialogService, ToastService } from '@shared/ui/overlay';
import { MessagesService } from '../state/messages.service';
import {
  CHANNEL_ICONS,
  CHANNEL_LABELS,
  HOURS_HELP,
  MESSAGE_STATUS_LABELS,
  absoluteDue,
  expedientNote,
  slaText,
} from '../state/message-view';
import { CaregiverPickerComponent } from './caregiver-picker.component';

/** Texto de quem não pode ler o conteúdo identificável (a gestão vê só código e prazos, LP-08). */
export const HIDDEN_TEXT = 'Texto oculto: pode identificar o titular.';

/**
 * Conteúdo da gaveta de uma mensagem (SCR-M11-02, F17): quem escreveu, canal e prazo em horas úteis, conversa,
 * resposta com modelos em 1 clique, Assumir, pedido de apoio, vincular cuidador, abrir reclamação e o botão
 * fixo **Sinalizar risco** (A-38), visível em TODA mensagem.
 */
@Component({
  selector: 'app-message-detail',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    BadgeComponent,
    DeadlineBadgeComponent,
    FormFieldComponent,
    IconComponent,
    MaskedFieldComponent,
    NxInputDirective,
    SwitchComponent,
    TimelineComponent,
    CaregiverPickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack stack--3" data-role="message-detail">
      <div class="cluster cluster--between">
        <button type="button" class="btn btn--sm btn--ghost" data-role="back" (click)="closed.emit()">
          <svg appIcon="chevron-left" size="sm"></svg>Voltar à lista
        </button>
        <span class="cluster" role="group" aria-label="Mensagem na lista">
          <button
            type="button"
            class="btn btn--sm btn--ghost btn--icon"
            aria-label="Mensagem anterior"
            data-role="previous"
            [disabled]="position().index <= 0"
            (click)="previous.emit()"
          >
            <svg appIcon="chevron-left" size="sm"></svg>
          </button>
          <span class="t-caption t-num" data-role="position">
            @if (position().index >= 0) {
              {{ position().index + 1 }} de {{ position().total }}
            } @else {
              Fora do filtro atual
            }
          </span>
          <button
            type="button"
            class="btn btn--sm btn--ghost btn--icon"
            aria-label="Próxima mensagem"
            data-role="next"
            [disabled]="position().index >= position().total - 1"
            (click)="next.emit()"
          >
            <svg appIcon="chevron-right" size="sm"></svg>
          </button>
        </span>
      </div>

      <div class="cluster cluster--between" data-role="message-head">
        <div class="stack stack--2">
          <strong class="discreet" data-role="contact">{{ contact().label }}</strong>
          <span class="cluster">
            @if (contact().tag; as tag) {
              <app-badge variant="info" outline>{{ tag }}</app-badge>
            }
            <app-badge [icon]="channelIcon()">{{ channelLabel() }}</app-badge>
            <app-badge [variant]="statusVariant()" dot>{{ statusLabel() }}</app-badge>
            @if (message().status !== 'answered') {
              <app-deadline-badge [due]="message().dueAt" />
            }
          </span>
        </div>
        @if (message().riskFlag) {
          <app-badge variant="danger" icon="siren" data-role="risk-flagged">Risco sinalizado</app-badge>
        } @else {
          <button type="button" class="btn btn--danger-quiet" data-role="flag-risk" (click)="flagRisk()">
            <svg appIcon="siren" size="sm"></svg>Sinalizar risco
          </button>
        }
      </div>

      @if (message().riskFlag) {
        <div class="banner banner--attention" role="status" data-role="risk-note">
          <svg appIcon="triangle-alert"></svg>
          <div class="banner__body">
            <p class="banner__text">{{ riskNote() }}</p>
          </div>
        </div>
      }
      @if (riskNeedsCaregiver()) {
        <div class="banner banner--attention" role="status" data-role="risk-needs-caregiver">
          <svg appIcon="triangle-alert"></svg>
          <div class="banner__body">
            <p class="banner__text">
              Vincule o cuidador envolvido a esta mensagem para avisar o responsável técnico.
            </p>
          </div>
        </div>
      }

      <dl class="dl" data-role="message-info">
        <dt>Prazo do canal</dt>
        <dd>
          {{ channelLabel() }}: {{ slaWords() }}.
          <span data-role="due-absolute">Prazo: {{ dueAbsolute() }}.</span>
          <details class="t-caption">
            <summary>O que são horas úteis?</summary>
            {{ hoursHelp }}
          </details>
        </dd>
        @if (outOfHours(); as note) {
          <dt>Fora do expediente</dt>
          <dd data-role="out-of-hours">{{ note }}</dd>
        }
        <dt>Recebida em</dt>
        <dd>{{ receivedText() }}</dd>
        @if (message().assignedToUserId) {
          <dt>Quem cuida</dt>
          <dd>{{ assigneeName() }}</dd>
        }
        @if (caregiverId()) {
          <dt>Pedidos de apoio (30 dias)</dt>
          <dd class="t-num" data-role="support-count">{{ supportCount() }}</dd>
        }
        @if (contact().caregiver; as cg) {
          @if (!pseudonymized()) {
            <dt>Telefone</dt>
            <dd>
              <app-masked-field
                kind="phone"
                label="Telefone"
                [value]="cg.phone"
                entity="caregiver"
                [entityId]="cg.id"
                field="phone"
                [subjectId]="cg.id"
              />
            </dd>
            <dt>E-mail</dt>
            <dd>
              <app-masked-field
                kind="email"
                label="E-mail"
                [value]="cg.email"
                entity="caregiver"
                [entityId]="cg.id"
                field="email"
                [subjectId]="cg.id"
              />
            </dd>
          }
          <dt>Cadastro</dt>
          <dd><a [routerLink]="['/app/cuidadores', cg.id]">Abrir o cadastro</a></dd>
        }
        @if (contact().provider; as pv) {
          <dt>Contato</dt>
          <dd>{{ pv.email }}</dd>
        }
      </dl>

      <section class="stack stack--2" aria-label="Conversa" data-role="conversation">
        @if (hiddenBody()) {
          <p class="placeholder-line" data-role="hidden-text"><svg appIcon="lock" size="sm"></svg>{{ hiddenText }}</p>
        } @else {
          <app-timeline label="Conversa" [items]="thread()" />
        }
      </section>

      @if (!contact().caregiver) {
        <section class="sunken p-3 stack stack--2" data-role="link-section">
          <app-caregiver-picker
            id="link-caregiver"
            label="Vincular a um cuidador"
            hint="A mensagem passa a aparecer no cadastro dele."
            [value]="null"
            (valueChange)="link($event)"
          />
        </section>
      }

      @if (canWrite()) {
        <div class="cluster" data-role="message-actions">
          @if (!mine() && message().status !== 'answered') {
            <button type="button" class="btn btn--sm" data-role="assume" (click)="assume()">
              <svg appIcon="user-check" size="sm"></svg>Assumir
            </button>
          }
          <button type="button" class="btn btn--sm" data-role="open-complaint" (click)="complaintRequested.emit(message())">
            <svg appIcon="flag" size="sm"></svg>Abrir reclamação
          </button>
        </div>
        @if (message().caregiverId) {
          <app-switch [checked]="message().isSupportRequest" data-role="support-request" (checkedChange)="toggleSupport($event)">
            Pedido de apoio
          </app-switch>
          <p class="t-caption t-muted">Registra esta mensagem como pedido de apoio. A equipe técnica acompanha.</p>
        }
      }

      @if (canReply()) {
        <form class="stack stack--2" novalidate (submit)="submitReply($event)" data-role="reply-form">
          <div class="stack stack--2">
            <span class="field__label" id="tpl-label">Modelos de resposta</span>
            <div class="chip-group" role="group" aria-labelledby="tpl-label" data-role="templates">
              @for (tpl of templates(); track tpl.id) {
                <button type="button" class="chip" data-role="template" (click)="useTemplate(tpl.body)">
                  {{ tpl.title }}
                </button>
              }
            </div>
          </div>
          <app-form-field label="Sua resposta" controlId="reply-body" [forceErrors]="submitted()">
            <textarea
              #replyBox
              appInput
              rows="5"
              data-role="reply-body"
              [formControl]="reply"
              (keydown.control.enter)="send()"
            ></textarea>
          </app-form-field>
          <div class="cluster cluster--end">
            <button type="submit" class="btn btn--primary" data-role="send-reply">Enviar resposta</button>
          </div>
        </form>
      } @else if (!canWrite()) {
        <p class="t-caption t-muted" data-role="read-only">
          Você acompanha esta mensagem em modo leitura. A resposta é do atendimento.
        </p>
      } @else if (hiddenBody()) {
        <p class="t-caption t-muted" data-role="partner-note">
          A gestão acompanha prazos e volumes. A resposta é do atendimento.
        </p>
      }
    </div>
  `,
})
export class MessageDetailComponent {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly auth = inject(AuthService);
  private readonly audit = inject(AuditLogService);
  private readonly service = inject(MessagesService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);

  readonly message = input.required<Message>();
  readonly position = input.required<{ index: number; total: number }>();
  readonly closed = output<void>();
  readonly previous = output<void>();
  readonly next = output<void>();
  readonly complaintRequested = output<Message>();

  private readonly replyBox = viewChild<ElementRef<HTMLTextAreaElement>>('replyBox');

  protected readonly hoursHelp = HOURS_HELP;
  protected readonly hiddenText = HIDDEN_TEXT;
  protected readonly submitted = signal(false);
  protected readonly riskNeedsCaregiver = signal(false);
  protected readonly reply = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(2)],
  });

  private readonly messageId = computed(() => this.message().id);
  protected readonly contact = computed(() => this.service.contactOf(this.message(), this.auth.role()));
  protected readonly pseudonymized = computed(() => this.auth.role() === 'partner');
  protected readonly caregiverId = computed(() => this.message().caregiverId);
  protected readonly channelLabel = computed(() => CHANNEL_LABELS[this.message().channel]);
  protected readonly channelIcon = computed(() => CHANNEL_ICONS[this.message().channel]);
  protected readonly templates = computed(() => this.db.messageTemplates.all());

  protected readonly canWrite = computed(() => this.auth.can('message_inbox', 'update'));
  /** A gestão não lê o texto do cuidador (LP-08): acompanha prazos e volumes. */
  protected readonly hiddenBody = computed(
    () => this.auth.role() === 'partner' && this.message().caregiverId !== undefined,
  );
  protected readonly canReply = computed(() => this.canWrite() && !this.hiddenBody());
  protected readonly mine = computed(() => this.message().assignedToUserId === this.auth.user()?.id);

  protected readonly statusLabel = computed(() => {
    const m = this.message();
    const overdue = this.service.isOverdue(m);
    return MESSAGE_STATUS_LABELS[overdue ? 'overdue' : m.status];
  });
  protected readonly statusVariant = computed<BadgeVariant>(() => {
    const m = this.message();
    return this.service.isOverdue(m) ? 'danger' : m.status === 'answered' ? 'success' : 'info';
  });

  protected readonly slaWords = computed(() =>
    slaText(this.message().channel, this.db.settings.get().slaHours),
  );
  protected readonly dueAbsolute = computed(() => absoluteDue(this.message().dueAt, this.clock.today()));
  protected readonly outOfHours = computed(() => {
    const m = this.message();
    return expedientNote(m.receivedAt, m.dueAt, this.db.settings.get().slaHours[m.channel]);
  });
  protected readonly receivedText = computed(() => formatDateTime(this.message().receivedAt));
  protected readonly assigneeName = computed(() => {
    const id = this.message().assignedToUserId;
    return id ? (this.db.users.get(id)?.displayName ?? 'Equipe') : '';
  });
  protected readonly supportCount = computed(() => {
    const id = this.message().caregiverId;
    return id
      ? countSupportRequests(
          this.db.messages.all(),
          id,
          this.clock.today(),
          this.db.settings.get().arbe.windowDays,
        )
      : 0;
  });

  protected readonly riskNote = computed(() => {
    const at = this.service.riskNoticeAt(this.message());
    return at
      ? `Responsável técnico avisado às ${formatTime(at)}.`
      : 'Sinalizada ao responsável técnico.';
  });

  protected readonly thread = computed<TimelineItem[]>(() => {
    const m = this.message();
    const role = this.auth.role();
    // O responsável técnico acompanha só o caso sinalizado, não o histórico inteiro do cuidador.
    const messages = role === 'technical_lead' ? [m] : this.service.threadOf(m);
    const contactLabel = this.contact().label;
    return messages.map((x) => ({
      id: x.id,
      title: x.direction === 'out' ? 'Equipe Nexus' : contactLabel,
      text: x.body,
      at: x.receivedAt,
      tone: x.id === m.id ? ('gold' as const) : ('default' as const),
    }));
  });

  constructor() {
    // Abrir uma mensagem de cuidador é leitura de dado sensível: vai para o log (AC-GL-10).
    effect(() => {
      const id = this.messageId();
      untracked(() => {
        const m = this.db.messages.get(id);
        this.audit.view('message', id, m?.caregiverId);
        this.reply.reset('');
        this.submitted.set(false);
        this.riskNeedsCaregiver.set(false);
      });
    });
  }

  /** Atalho `R`: leva o foco à resposta. */
  focusReply(): void {
    this.replyBox()?.nativeElement.focus();
  }

  protected useTemplate(body: string): void {
    const current = this.reply.value.trim();
    this.reply.setValue(current ? `${current}\n\n${body}` : body);
    this.replyBox()?.nativeElement.focus();
  }

  protected submitReply(event: Event): void {
    event.preventDefault();
    this.send();
  }

  protected send(): void {
    this.submitted.set(true);
    this.reply.markAsTouched();
    if (this.reply.invalid) {
      return;
    }
    this.service.reply(this.message().id, this.reply.value);
    this.reply.reset('');
    this.submitted.set(false);
    this.toasts.success('Resposta enviada. A mensagem passou a Respondida.');
  }

  protected assume(): void {
    this.service.assume(this.message().id);
    this.toasts.success('Você assumiu esta mensagem.');
  }

  protected link(caregiverId: string | null): void {
    if (!caregiverId) {
      return;
    }
    this.service.linkCaregiver(this.message().id, caregiverId);
    this.toasts.success('Cuidador vinculado. A mensagem passa a aparecer no cadastro dele.');
  }

  protected toggleSupport(on: boolean): void {
    const outcome = this.service.setSupportRequest(this.message().id, on);
    this.toasts.success(
      on
        ? `Pedido de apoio registrado. A equipe técnica acompanha. São ${outcome.count} nos últimos 30 dias.`
        : 'Pedido de apoio desmarcado.',
    );
  }

  /** A-38: dois cliques. O diálogo traz o que fazer em emergência e o botão avisa o responsável técnico. */
  protected async flagRisk(): Promise<void> {
    const m = this.message();
    if (!m.caregiverId) {
      this.riskNeedsCaregiver.set(true);
      return;
    }
    const caregiverId = m.caregiverId;
    let at = '';
    const result = await this.dialogs.confirm({
      title: 'Sinalizar risco nesta mensagem?',
      message:
        'Use quando a pessoa fala em risco de vida, de suicídio ou em sofrimento muito grave. O responsável técnico é avisado agora e o protocolo de situações de risco (POP-05) é iniciado. Em emergência, oriente a ligar para o SAMU (192) ou o CVV (188).',
      tone: 'danger',
      confirmLabel: 'Avisar o responsável técnico',
      busyLabel: 'Avisando...',
      run: () => {
        at = this.service.flagRisk(m.id, caregiverId).at;
      },
    });
    if (result.confirmed) {
      this.toasts.success(`Responsável técnico avisado às ${formatTime(at)}.`);
    }
  }
}
