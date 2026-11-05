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
import { Router, RouterLink } from '@angular/router';
import { AuditLogService } from '@core/audit';
import { AuthService } from '@core/auth';
import { Clock } from '@core/clock';
import { Database } from '@core/data';
import { formatDate, formatDateTime, formatTime } from '@core/format';
import type { DsrType, Message } from '@core/models';
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
  SUBJECT_REQUEST_LABELS,
  SubjectRequestKind,
  absoluteDue,
  expedientNote,
  firstNameOf,
  personalizeReply,
  slaText,
  suggestSubjectRequest,
  templateRelevance,
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
          <app-badge variant="danger" icon="siren" data-role="risk-flagged">
            {{ message().riskDoubt ? 'Avisada em dúvida' : 'Risco sinalizado' }}
          </app-badge>
        } @else {
          <span class="cluster">
            <button type="button" class="btn btn--danger-quiet" data-role="flag-risk" (click)="flagRisk()">
              <svg appIcon="siren" size="sm"></svg>Sinalizar risco
            </button>
            <button type="button" class="btn btn--sm" data-role="flag-doubt" (click)="flagDoubt()">
              Em dúvida, avisar o RT
            </button>
          </span>
        }
      </div>

      @if (!message().riskFlag) {
        <details class="sunken p-3 t-ui" data-role="risk-help">
          <summary>Como decidir: risco ou cansaço?</summary>
          <div class="stack stack--2">
            <p class="t-caption">
              "Sinalizar risco" avisa a responsável técnica agora e inicia o POP-05. Use quando a pessoa fala em
              risco de vida, em se machucar ou em sofrimento muito grave. Em emergência, oriente a ligar para o SAMU
              (192) ou o CVV (188).
            </p>
            <div class="grid grid--2">
              <div>
                <strong>Costuma ser risco</strong>
                <ul class="t-caption">
                  <li>"Não aguento mais, queria sumir."</li>
                  <li>"Penso em me machucar."</li>
                  <li>"Não vejo saída para isso."</li>
                  <li>"Tenho medo do que posso fazer."</li>
                </ul>
              </div>
              <div>
                <strong>Costuma não ser risco</strong>
                <ul class="t-caption">
                  <li>"Estou muito cansada esta semana."</li>
                  <li>"Preciso de uma pausa."</li>
                  <li>"Foi um dia difícil."</li>
                  <li>"Não estou dormindo bem."</li>
                </ul>
              </div>
            </div>
            <p class="t-caption" data-role="doubt-help">
              Em dúvida, use "Em dúvida, avisar o RT": a responsável técnica é avisada, lê a mensagem e decide se
              inicia o POP-05. Esse botão não inicia o protocolo. Na dúvida, avise: é melhor avisar do que deixar
              passar.
            </p>
          </div>
        </details>
      }

      @if (message().riskFlag) {
        <div class="banner banner--attention" role="status" data-role="risk-note">
          <svg appIcon="triangle-alert"></svg>
          <div class="banner__body">
            <p class="banner__text">{{ riskNote() }}</p>
          </div>
        </div>
      }
      @if (message().riskFlag && message().riskDoubt && isTechnicalLead()) {
        <div class="sunken p-3 stack stack--2" data-role="doubt-decision">
          <p class="t-ui">O atendimento não teve certeza se há risco. Você decide o que fazer.</p>
          <div class="cluster">
            <button type="button" class="btn btn--primary btn--sm" data-role="start-pop05" (click)="decideDoubt('start_pop05')">
              Iniciar o POP-05
            </button>
            <button type="button" class="btn btn--sm" data-role="no-risk" (click)="decideDoubt('no_risk')">
              Avaliei e não há risco
            </button>
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
          @if (canRegisterSubjectRequest()) {
            <button
              type="button"
              class="btn btn--sm"
              data-role="open-subject-request"
              [attr.aria-expanded]="subjectOpen()"
              (click)="toggleSubjectRequest()"
            >
              <svg appIcon="shield-check" size="sm"></svg>Registrar solicitação do titular
            </button>
          }
        </div>
        @if (subjectOpen()) {
          <form class="sunken p-3 stack stack--3" novalidate (submit)="submitSubjectRequest($event)" data-role="subject-request-form">
            <p class="t-caption">
              Registra o pedido do titular no núcleo de privacidade, já com o titular e o canal desta mensagem. O
              prazo de 15 dias corridos começa agora.
            </p>
            <app-form-field label="Titular" controlId="subject-holder">
              <input appInput [value]="contact().label" readonly data-role="subject-holder" />
            </app-form-field>
            <app-form-field label="Canal do pedido" controlId="subject-channel">
              <input appInput [value]="channelLabel()" readonly data-role="subject-channel" />
            </app-form-field>
            <app-form-field label="O que o titular pede" controlId="subject-type" [error]="subjectError('type')">
              <select appInput [value]="subjectType()" (change)="subjectType.set(selectValue($event))" data-role="subject-type">
                <option value="">Escolha o tipo de pedido</option>
                @for (opt of subjectTypeOptions; track opt.value) {
                  <option [value]="opt.value" [selected]="opt.value === subjectType()">{{ opt.label }}</option>
                }
              </select>
            </app-form-field>
            <app-form-field label="Em palavras simples" controlId="subject-description" hint="Sem dado de saúde. Você pode editar." [error]="subjectError('description')">
              <textarea
                appInput
                rows="3"
                [value]="subjectDescription()"
                (input)="subjectDescription.set(textValue($event))"
                data-role="subject-description"
              ></textarea>
            </app-form-field>
            <div class="cluster cluster--end">
              <button type="button" class="btn btn--sm" (click)="subjectOpen.set(false)">Voltar</button>
              <button type="submit" class="btn btn--primary btn--sm" data-role="submit-subject-request">Registrar solicitação</button>
            </div>
          </form>
        }
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
            <span class="t-caption" data-role="template-help">
              Os mais indicados para esta mensagem vêm primeiro. O texto chega com o nome de quem escreveu
              @if (overdue()) {
                e com um pedido de desculpas pela demora
              }
              e você pode editar antes de enviar.
            </span>
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
  private readonly router = inject(Router);

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
  // Solicitação do titular a partir da mensagem (CX-035)
  protected readonly subjectOpen = signal(false);
  protected readonly subjectType = signal<string>('');
  protected readonly subjectDescription = signal('');
  protected readonly subjectErrors = signal<{ field: string; message: string }[]>([]);
  protected readonly subjectTypeOptions = (Object.keys(SUBJECT_REQUEST_LABELS) as SubjectRequestKind[]).map((value) => ({
    value,
    label: SUBJECT_REQUEST_LABELS[value],
  }));
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
  /** Modelos na ordem em que mais servem a esta mensagem (CX-039). */
  protected readonly templates = computed(() => {
    const message = this.message();
    return this.db.messageTemplates
      .all()
      .map((template, index) => ({ template, index, score: templateRelevance(template, message) }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((item) => item.template);
  });
  protected readonly overdue = computed(() => this.service.isOverdue(this.message()));
  protected readonly isTechnicalLead = computed(() => this.auth.role() === 'technical_lead');
  /** Só quem registra em nome do titular (o atendimento) e só com o cuidador vinculado. */
  protected readonly canRegisterSubjectRequest = computed(
    () => this.auth.role() === 'support' && this.message().caregiverId !== undefined && this.auth.can('lgpd_consents_requests', 'create'),
  );

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
    if (this.message().riskDoubt) {
      return 'Avisada à responsável técnica em dúvida. Ela lê a mensagem e decide se inicia o POP-05.';
    }
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
        this.subjectOpen.set(false);
        this.subjectErrors.set([]);
      });
    });
  }

  /** Atalho `R`: leva o foco à resposta. */
  focusReply(): void {
    this.replyBox()?.nativeElement.focus();
  }

  protected useTemplate(body: string): void {
    const current = this.reply.value.trim();
    const name = firstNameOf(this.contact().caregiver?.fullName ?? this.contact().provider?.name);
    const text = personalizeReply(body, name, this.overdue());
    this.reply.setValue(current ? `${current}\n\n${text}` : text);
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

  protected selectValue(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }

  protected textValue(event: Event): string {
    return (event.target as HTMLTextAreaElement).value;
  }

  protected subjectError(field: string): string | null {
    return this.subjectErrors().find((e) => e.field === field)?.message ?? null;
  }

  protected toggleSubjectRequest(): void {
    if (this.subjectOpen()) {
      this.subjectOpen.set(false);
      return;
    }
    const m = this.message();
    this.subjectType.set(suggestSubjectRequest(m) ?? '');
    const when = formatDateTime(m.receivedAt);
    this.subjectDescription.set(
      m.subject ? `Pedido recebido por ${this.channelLabel()} em ${when}: ${m.subject}.` : `Pedido recebido por ${this.channelLabel()} em ${when}.`,
    );
    this.subjectErrors.set([]);
    this.subjectOpen.set(true);
  }

  protected submitSubjectRequest(event: Event): void {
    event.preventDefault();
    const errors: { field: string; message: string }[] = [];
    if (this.subjectType() === '') {
      errors.push({ field: 'type', message: 'Escolha o que o titular pede.' });
    }
    if (this.subjectDescription().trim().length < 5) {
      errors.push({ field: 'description', message: 'Descreva o pedido em palavras simples.' });
    }
    this.subjectErrors.set(errors);
    if (errors.length > 0) {
      return;
    }
    try {
      const request = this.service.registerSubjectRequest(this.message().id, {
        type: this.subjectType() as DsrType,
        description: this.subjectDescription(),
      });
      this.subjectOpen.set(false);
      this.toasts.show({
        message: `Solicitação ${request.protocol} registrada. Prazo: ${formatDate(request.dueAt)}.`,
        action: { label: 'Abrir', run: () => void this.router.navigate(['/app/lgpd/solicitacoes', request.id]) },
      });
    } catch {
      this.toasts.error('Não foi possível registrar. Tente de novo; se continuar, avise a equipe.');
    }
  }

  /** Em dúvida: avisa a responsável técnica SEM iniciar o POP-05; ela decide (CX-040). */
  protected async flagDoubt(): Promise<void> {
    const m = this.message();
    if (!m.caregiverId) {
      this.riskNeedsCaregiver.set(true);
      return;
    }
    const caregiverId = m.caregiverId;
    let at = '';
    const result = await this.dialogs.confirm({
      title: 'Avisar a responsável técnica, em dúvida?',
      message:
        'Ela é avisada agora, lê a mensagem e decide se inicia o protocolo de situações de risco (POP-05). Este aviso não inicia o POP-05 por si só. Em emergência, oriente a ligar para o SAMU (192) ou o CVV (188).',
      tone: 'attention',
      confirmLabel: 'Avisar a responsável técnica',
      busyLabel: 'Avisando...',
      run: () => {
        at = this.service.flagRisk(m.id, caregiverId, { doubt: true }).at;
      },
    });
    if (result.confirmed) {
      this.toasts.success(`Responsável técnica avisada às ${formatTime(at)}. Ela decide se inicia o POP-05.`);
    }
  }

  protected decideDoubt(decision: 'start_pop05' | 'no_risk'): void {
    this.service.resolveDoubt(this.message().id, decision);
    this.toasts.success(
      decision === 'start_pop05' ? 'POP-05 iniciado para este caso.' : 'Registrado: avaliado e sem risco.',
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
