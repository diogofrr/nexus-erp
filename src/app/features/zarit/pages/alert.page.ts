import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, afterNextRender, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SupervisionWindowService } from '@core/audit/supervision-window.service';
import { AuditLogService } from '@core/audit';
import { Clock, timeOf } from '@core/clock';
import { Database } from '@core/data';
import { formatDate, formatDateTime, formatTime } from '@core/format';
import { Channel, ReferralCategory, RiskLevel } from '@core/models';
import { EMERGENCY_NOTICE, REFERRAL_TABLE, redAlertState } from '@core/rules';
import {
  BadgeComponent,
  CheckboxComponent,
  ChecklistComponent,
  ChecklistItem,
  DraftService,
  EmptyStateComponent,
  FormFieldComponent,
  IconComponent,
  MaskedFieldComponent,
  NxInputDirective,
  PageHeaderComponent,
  RadioGroupComponent,
  RadioOption,
  ZaritBandBadgeComponent,
} from '@shared/ui';
import { SupervisionGateComponent } from '@shared/ui/access/supervision-gate.component';
import { DialogService, PageContextService, ToastService } from '@shared/ui/overlay';
import { valueOf } from '@shared/ui/util/form-events';
import { AlertCountdownComponent } from '../components/alert-countdown.component';
import { ZaritAccessService } from '../state/zarit-access.service';
import { ALERT_STATUS_LABELS, CHANNEL_LABELS, RISK_LABELS } from '../state/zarit-labels';
import { FieldError, ZaritService } from '../state/zarit.service';

const CHANNEL_OPTIONS: Channel[] = ['phone', 'whatsapp', 'app', 'email'];
const RISK_OPTIONS: RadioOption<RiskLevel>[] = (['low', 'moderate', 'high'] as RiskLevel[]).map((value) => ({
  value,
  label: RISK_LABELS[value],
}));

/** Situação do Quadro 12 que costuma descrever o risco alto (só sugestão, nunca marcada à força). */
const HIGH_RISK_CATEGORY: ReferralCategory = 'severe_distress_or_suicide_risk';

/** Rascunho dos campos curtos do alerta: sobrevive a recarregar a página (CX-023). */
interface AlertDraft {
  channel: string;
  note: string;
  by: string;
  riskLevel: RiskLevel | null;
  riskNote: string;
}

/** "passos 2 a 7" quando seguidos, "passos 2, 4 e 7" quando não. */
function stepsText(steps: readonly number[]): string {
  if (steps.length === 1) {
    return `passo ${steps[0]}`;
  }
  const consecutive = steps.every((n, i) => i === 0 || n === (steps[i - 1] as number) + 1);
  if (consecutive) {
    return `passos ${steps[0]} a ${steps[steps.length - 1]}`;
  }
  return `passos ${steps.slice(0, -1).join(', ')} e ${steps[steps.length - 1]}`;
}

/**
 * SCR-M06-05 (vermelho) e SCR-M06-06 (amarelo), Alerta (F06, POP-05). No vermelho: cronômetro até 23:59, o resumo
 * "Antes de ligar" (pontuação, faixa, evolução, canal preferido, telefone e a ficha), quatro blocos que dizem a
 * que passos do POP-05 correspondem (a mesma numeração da ocorrência) e nada é redigitado: o que se preenche aqui
 * alimenta a ocorrência. O alerta só encerra com horário do contato, quem fez, avaliação de risco e, se o risco
 * for alto, o encaminhamento (RN-ZRT-15). No amarelo: a tarefa "revisar rede de apoio da família" e o
 * acompanhamento prioritário.
 */
@Component({
  selector: 'app-zarit-alert-page',
  imports: [
    AlertCountdownComponent,
    BadgeComponent,
    CheckboxComponent,
    ChecklistComponent,
    EmptyStateComponent,
    FormFieldComponent,
    IconComponent,
    MaskedFieldComponent,
    NxInputDirective,
    PageHeaderComponent,
    RadioGroupComponent,
    RouterLink,
    SupervisionGateComponent,
    ZaritBandBadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page--narrow stack stack--6">
      <app-page-header [title]="isRed() ? 'Alerta vermelho' : 'Alerta amarelo'" [description]="subtitle()">
        <a class="btn" routerLink="/app/acompanhamento/fila">Voltar à fila</a>
      </app-page-header>

      @if (!alert()) {
        <app-empty-state title="Alerta não encontrado" text="Volte à fila e escolha o caso de novo.">
          <a class="btn btn--primary" routerLink="/app/acompanhamento/fila">Voltar à fila</a>
        </app-empty-state>
      } @else if (gated()) {
        <app-supervision-gate
          entity="zarit_alert"
          [entityId]="alert()?.id ?? ''"
          [caregiverId]="alert()?.caregiverId ?? ''"
          (granted)="unlocked.set(true)"
        />
      } @else {
        <div class="cluster">
          <app-badge variant="info" icon="lock">Dado sensível · cifrado em repouso (simulado)</app-badge>
          <app-badge [variant]="statusVariant()" [icon]="isRed() ? 'octagon-alert' : 'triangle-alert'" data-role="alert-status">{{ statusText() }}</app-badge>
          @if (supervisionInfo(); as info) {
            <span class="t-caption" data-role="supervision-info">{{ info }}</span>
          }
        </div>

        @if (alert()?.status === 'closed') {
          <p class="banner banner--success" role="status" data-role="closed-banner">
            Alerta encerrado em {{ dateTime(alert()?.closedAt) }}. Depois de encerrado, só é possível adicionar adendo.
          </p>
        }

        <!-- Cronômetro e situação do prazo -->
        @if (isRed() && alert()?.deadlineAt && !alert()?.contact && alert()?.status !== 'closed') {
          <app-alert-countdown [deadlineAt]="alert()?.deadlineAt ?? ''" large />
          @if (overdue() && isSupervisor()) {
            <p class="t-ui" data-role="overdue-note">
              Sem contato registrado. Você pode registrar o contato em nome da equipe ou pedir ao psicólogo do caso que ligue agora.
            </p>
          } @else if (overdue()) {
            <p class="t-ui" data-role="overdue-note">Registre o contato assim que possível. O atraso fica no histórico.</p>
          }
          @if (canRequestContact()) {
            <div class="cluster" data-role="request-contact-block">
              <button type="button" class="btn" (click)="requestContact()" data-role="request-contact">
                <svg appIcon="phone" size="sm"></svg>Pedir {{ psychologistArticle() }} {{ psychologistName() }} que ligue agora
              </button>
              @if (contactRequest(); as request) {
                <span class="t-caption" role="status" data-role="request-sent">Pedido enviado às {{ time24(request.at) }}.</span>
              }
            </div>
          }
        }

        <!-- Antes de ligar: o que quem vai telefonar precisa ter à mão (CX-016) -->
        @if (callInfo(); as info) {
          <section class="card card--pad stack stack--3" aria-labelledby="call-title" data-role="before-call">
            <h2 id="call-title" class="card__title">Antes de ligar</h2>
            <dl class="dl">
              <dt>Pontuação na escala</dt>
              <dd data-role="call-score">
                @if (info.score !== null) {
                  <app-zarit-band-badge [score]="info.score" /> <span class="t-ui">{{ info.score }} de 88 pontos</span>
                } @else {
                  Sem pontuação registrada
                }
              </dd>
              <dt>Evolução</dt><dd data-role="call-evolution">{{ info.evolution }}</dd>
              <dt>Canal preferido</dt><dd data-role="call-channel">{{ info.channel }}</dd>
              <dt>Telefone</dt>
              <dd>
                <app-masked-field
                  kind="phone"
                  label="Telefone"
                  [value]="info.phone"
                  entity="caregiver"
                  [entityId]="info.caregiverId"
                  field="phone"
                  [subjectId]="info.caregiverId"
                  [code]="info.code"
                />
              </dd>
              @if (info.whatsapp) {
                <dt>WhatsApp</dt>
                <dd>
                  <app-masked-field
                    kind="phone"
                    label="WhatsApp"
                    [value]="info.whatsapp"
                    entity="caregiver"
                    [entityId]="info.caregiverId"
                    field="whatsapp"
                    [subjectId]="info.caregiverId"
                    [code]="info.code"
                  />
                </dd>
              }
            </dl>
            <p class="t-caption">O número aparece oculto. Para ver, use "Mostrar": o motivo fica no registro de acessos.</p>
            <div>
              <a class="btn" [routerLink]="['/app/cuidadores', info.caregiverId]" data-role="open-caregiver">Ver ficha</a>
            </div>
          </section>
        }

        @if (!isRed()) {
          <section class="card card--pad stack stack--3" aria-labelledby="task-title" data-role="yellow-task">
            <h2 id="task-title" class="card__title">Revisar rede de apoio da família</h2>
            <p class="t-ui">
              Acompanhamento psicológico prioritário, com foco no manejo do estresse. O cuidador passa a ter vagas
              prioritárias na agenda.
            </p>
            <app-checklist label="Tarefa do alerta amarelo" [items]="yellowChecklist()" />
            @if (canAct() && alert()?.status !== 'closed') {
              <div class="cluster">
                @if (!alert()?.supportNetworkReviewDone) {
                  <button type="button" class="btn btn--primary" (click)="completeReview()" data-role="complete-review">
                    Marcar a revisão da rede de apoio como feita
                  </button>
                }
                @if (canApplyCase()) {
                  <a class="btn" routerLink="/app/atendimento/agenda" [queryParams]="{ acao: 'agendar', cuidador: alert()?.caregiverId }">Agendar sessão prioritária</a>
                }
              </div>
            }
          </section>
        }

        <!-- Contato (passos 1 e 2 do POP-05) -->
        <section class="card card--pad stack stack--3" aria-labelledby="contact-title" data-role="contact-block">
          <h2 id="contact-title" class="card__title">{{ isRed() ? 'Contato da equipe' : 'Contato com o cuidador' }}</h2>
          @if (isRed()) {
            <p class="t-caption" data-role="pop-steps">Alimenta os passos 1 e 2 do POP-05.</p>
          }
          @if (alert()?.contact; as c) {
            <dl class="dl" data-role="contact-summary">
              <dt>Horário</dt><dd>{{ dateTime(c.at) }}</dd>
              <dt>Quem fez</dt><dd>{{ userName(c.byUserId) }}</dd>
              <dt>Canal</dt><dd>{{ channelName(c.channel) }}</dd>
              <dt>Anotação</dt><dd class="discreet">{{ c.note || 'Sem anotação' }}</dd>
            </dl>
          } @else if (canAct() && alert()?.status !== 'closed') {
            @if (draftNote(); as restored) {
              <p class="t-caption" role="status" data-role="draft-restored">Rascunho recuperado ({{ restored }}). Ele só vira registro quando você salvar.</p>
            }
            <form class="form-grid" novalidate (submit)="$event.preventDefault(); registerContact()" data-role="contact-form">
              <app-form-field label="Horário do contato" controlId="alert-time" [error]="err('time')" hint="Hoje. Vem preenchido com agora.">
                <input appInput type="time" [value]="time()" (input)="time.set(valueOf($event))" data-role="contact-time" />
              </app-form-field>
              <app-form-field label="Quem fez o contato" controlId="alert-by" [error]="err('by')">
                <select appInput [value]="by()" (change)="by.set(valueOf($event))" data-role="contact-by">
                  @for (u of byOptions(); track u.id) {
                    <option [value]="u.id" [selected]="u.id === by()">{{ u.name }}</option>
                  }
                </select>
              </app-form-field>
              <app-form-field label="Canal" controlId="alert-channel" [error]="err('channel')">
                <select appInput [value]="channel()" (change)="channel.set(valueOf($event))" data-role="contact-channel">
                  <option value="">Escolha o canal</option>
                  @for (ch of channelOptions; track ch) {
                    <option [value]="ch" [selected]="ch === channel()">{{ channelName(ch) }}</option>
                  }
                </select>
              </app-form-field>
              <app-form-field class="span-2" label="Anotação" controlId="alert-note" [optional]="true">
                <textarea appInput rows="2" [value]="note()" (input)="note.set(valueOf($event))" data-role="contact-note"></textarea>
              </app-form-field>
              <div>
                <button type="submit" class="btn btn--primary" data-role="register-contact">Registrar contato</button>
              </div>
            </form>
          } @else {
            <p class="t-muted t-ui">Nenhum contato registrado.</p>
          }
        </section>

        @if (isRed()) {
          <!-- Avaliação de risco (passo 3 do POP-05) -->
          <section class="card card--pad stack stack--3" aria-labelledby="risk-title" data-role="risk-block">
            <h2 id="risk-title" class="card__title">Avaliação de risco</h2>
            <p class="t-caption" data-role="pop-steps">Alimenta o passo 3 do POP-05.</p>
            @if (alert()?.riskAssessment; as r) {
              <dl class="dl" data-role="risk-summary">
                <dt>Nível</dt><dd>{{ riskName(r.level) }}</dd>
                <dt>Nota</dt><dd class="discreet">{{ r.note }}</dd>
                <dt>Registrada em</dt><dd>{{ dateTime(r.at) }}</dd>
              </dl>
            } @else if (canAct() && alert()?.status !== 'closed') {
              @if (!alert()?.contact) {
                <p class="t-muted t-ui">Registre o contato para liberar a avaliação de risco.</p>
              } @else {
                <app-form-field label="Nível de risco" group controlId="alert-risk" [error]="err('riskLevel')">
                  <app-radio-group [options]="riskOptions" [value]="riskLevel()" (valueChange)="riskLevel.set($event)" />
                </app-form-field>
                <app-form-field label="Nota da avaliação" controlId="alert-risk-note" [error]="err('riskNote')">
                  <textarea appInput rows="3" [value]="riskNote()" (input)="riskNote.set(valueOf($event))" data-role="risk-note"></textarea>
                </app-form-field>
                <div>
                  <button type="button" class="btn btn--primary" (click)="registerRisk()" data-role="register-risk">Registrar avaliação de risco</button>
                </div>
              }
            } @else {
              <p class="t-muted t-ui">Avaliação de risco não registrada.</p>
            }
          </section>

          <!-- Encaminhamento (passos 4 e 5 do POP-05) -->
          <section class="card card--pad stack stack--3" aria-labelledby="ref-title" data-role="referral-block">
            <h2 id="ref-title" class="card__title">Encaminhamento, se necessário</h2>
            <p class="t-caption" data-role="pop-steps">Alimenta os passos 4 e 5 do POP-05.</p>
            <p class="t-caption">{{ emergency }} Conforme o POP-05. CVV: 188.</p>
            @if (alert()?.riskAssessment?.level === 'high' && !(alert()?.referralIds?.length)) {
              <p class="banner banner--attention" role="note" data-role="referral-needed">
                O risco foi avaliado como alto. Registre o encaminhamento agora para poder encerrar o alerta.
              </p>
            }
            @for (r of referrals(); track r.id) {
              <p class="t-ui" data-role="referral-item"><svg appIcon="link" size="sm"></svg> {{ r.text }}</p>
            }
            @if (canAct() && alert()?.status !== 'closed' && alert()?.contact) {
              <app-form-field label="Situação" controlId="alert-ref-category" [hint]="categoryHint()" [error]="err('category')">
                <select appInput [value]="selectedCategory()" (change)="setCategory(valueOf($event))" data-role="referral-category">
                  <option value="">Escolha a situação</option>
                  @for (c of categories; track c.category) {
                    <option [value]="c.category" [selected]="c.category === selectedCategory()">{{ c.situation }}</option>
                  }
                </select>
              </app-form-field>
              @if (selectedCategory()) {
                <app-form-field label="Destinos" group controlId="alert-ref-destinations" [error]="err('referral')">
                  @for (d of destinationOptions(); track d) {
                    <app-checkbox [checked]="destinations().includes(d)" (checkedChange)="toggleDestination(d, $event)">{{ d }}</app-checkbox>
                  }
                </app-form-field>
              }
              @if (requiresFamily()) {
                <app-checkbox [checked]="family()" (checkedChange)="family.set($event)">A família foi comunicada</app-checkbox>
              }
              <div>
                <button type="button" class="btn" (click)="registerReferral()" data-role="register-referral">Registrar encaminhamento</button>
              </div>
            }
          </section>
        }

        <!-- Registro e acompanhamento (passos 6 e 7 do POP-05) -->
        <section class="card card--pad stack stack--3" aria-labelledby="close-title" data-role="close-block">
          <h2 id="close-title" class="card__title">{{ isRed() ? 'Registro e acompanhamento' : 'Encerrar o alerta' }}</h2>
          @if (isRed()) {
            <p class="t-caption" data-role="pop-steps">Alimenta os passos 6 e 7 do POP-05. O passo 7 (acompanhamento posterior) se registra na ocorrência.</p>
          }
          @if (canAct() && alert()?.status !== 'closed') {
            @if (missing().length > 0) {
              <p class="t-ui" data-role="missing" role="status">Falta: {{ missing().join(', ') }}.</p>
            }
            <div class="cluster">
              <button
                type="button"
                class="btn btn--primary"
                [attr.aria-disabled]="missing().length > 0 ? 'true' : null"
                (click)="close()"
                data-role="close-alert"
              >
                Encerrar alerta
              </button>
              @if (canApplyCase()) {
                <a class="btn" routerLink="/app/atendimento/agenda" [queryParams]="{ acao: 'agendar', cuidador: alert()?.caregiverId }" data-role="schedule-next">
                  Agendar próxima conversa
                </a>
              }
            </div>
            @if (error(); as msg) {
              <p class="field__error" role="alert" data-role="close-error">{{ msg }}</p>
            }
          }
          @if (occurrence(); as occ) {
            <p class="t-ui">
              <svg appIcon="file-lock" size="sm"></svg>
              <a [routerLink]="['/app/governanca/ocorrencias', occ.id]" data-role="occurrence-link">Abrir a ocorrência deste caso ({{ pendingSteps(occ.id) }})</a>
            </p>
          }
        </section>
      }
    </div>
  `,
})
export class ZaritAlertPageComponent {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly svc = inject(ZaritService);
  private readonly access = inject(ZaritAccessService);
  private readonly audit = inject(AuditLogService);
  private readonly supervision = inject(SupervisionWindowService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly page = inject(PageContextService);
  private readonly drafts = inject(DraftService);
  private readonly doc = inject(DOCUMENT);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });

  protected readonly valueOf = valueOf;
  protected readonly emergency = EMERGENCY_NOTICE;
  protected readonly channelOptions = CHANNEL_OPTIONS;
  protected readonly riskOptions = RISK_OPTIONS;
  protected readonly categories = REFERRAL_TABLE;

  protected readonly unlocked = signal(false);
  protected readonly errors = signal<FieldError[]>([]);
  protected readonly error = signal<string | null>(null);

  // Formulário do contato
  protected readonly time = signal(timeOf(this.clock.now()));
  protected readonly by = signal(this.access.actorUserId());
  protected readonly channel = signal('');
  protected readonly note = signal('');
  // Avaliação de risco
  protected readonly riskLevel = signal<RiskLevel | null>(null);
  protected readonly riskNote = signal('');
  // Encaminhamento: sem situação marcada de início (CX-020)
  protected readonly category = signal<ReferralCategory | ''>('');
  protected readonly destinations = signal<readonly string[]>([]);
  protected readonly family = signal(false);
  /** Texto "hoje, 09:40" do rascunho recuperado, ou `null`. */
  protected readonly draftNote = signal<string | null>(null);
  /** Pedido enviado agora, para a tela mostrar sem esperar o próximo ciclo. */
  private readonly requestTick = signal(0);
  /** Alerta cujo rascunho já foi recuperado: só depois disso o rascunho passa a ser gravado. */
  private readonly restoredFor = signal<string | null>(null);

  protected readonly alert = computed(() => this.db.zaritAlerts.get(this.params().get('id') ?? ''));
  private readonly caregiver = computed(() => this.db.caregivers.get(this.alert()?.caregiverId ?? ''));
  protected readonly isRed = computed(() => this.alert()?.level === 'red');
  protected readonly isSupervisor = computed(() => this.access.isSupervisor());
  protected readonly canAct = computed(() => this.access.canAct(this.alert()?.caregiverId ?? ''));
  protected readonly canApplyCase = computed(() => this.access.canApply(this.alert()?.caregiverId ?? ''));
  protected readonly gated = computed(() => {
    const a = this.alert();
    return !!a && this.access.mustJustify(a.caregiverId) && !this.unlocked();
  });
  protected readonly subtitle = computed(() => {
    const c = this.caregiver();
    return c ? `${c.fullName} (${c.code})` : '';
  });
  protected readonly occurrence = computed(() => this.db.occurrences.get(this.alert()?.occurrenceId ?? ''));
  protected readonly overdue = computed(() => {
    const a = this.alert();
    return !!a && redAlertState(a, this.clock.now()) === 'overdue';
  });
  protected readonly statusText = computed(() => {
    const a = this.alert();
    if (!a) {
      return '';
    }
    const state = a.level === 'red' ? redAlertState(a, this.clock.now()) : a.status;
    return ALERT_STATUS_LABELS[state];
  });
  protected readonly statusVariant = computed(() => {
    const a = this.alert();
    return a?.status === 'closed' ? ('success' as const) : this.overdue() || a?.level === 'red' ? ('danger' as const) : ('attention' as const);
  });
  protected readonly supervisionInfo = computed(() => {
    this.unlocked();
    const a = this.alert();
    const found = a && this.access.isSupervisor() ? this.supervision.current(a.caregiverId) : null;
    return found ? `Supervisão registrada às ${formatTime(found.at)} (motivo: ${found.reason})` : null;
  });
  protected readonly byOptions = computed(() =>
    this.db.users
      .all()
      .filter((u) => u.active && (u.role === 'psychologist' || u.role === 'technical_lead'))
      .map((u) => ({ id: u.id, name: u.displayName })),
  );
  protected readonly yellowChecklist = computed<ChecklistItem[]>(() => [
    {
      id: 'review',
      title: 'Revisar a rede de apoio da família',
      text: 'Tarefa criada junto com o alerta, para o psicólogo do caso.',
      state: this.alert()?.supportNetworkReviewDone ? 'ok' : 'pending',
    },
  ]);
  protected readonly referrals = computed(() => {
    const ids = this.alert()?.referralIds ?? [];
    return ids
      .map((id) => this.db.referrals.get(id))
      .filter((r) => r !== undefined)
      .map((r) => ({ id: r.id, text: `${this.categories.find((c) => c.category === r.category)?.situation ?? ''}: ${r.destinations.join(', ')}` }));
  });
  protected readonly missing = computed(() => {
    const a = this.alert();
    return a ? this.svc.missingForClosure(a) : [];
  });

  /** A situação sugerida só existe quando o risco avaliado é alto; nos outros níveis, nada vem marcado. */
  private readonly suggestedCategory = computed<ReferralCategory | ''>(() =>
    this.alert()?.riskAssessment?.level === 'high' ? HIGH_RISK_CATEGORY : '',
  );
  protected readonly selectedCategory = computed<ReferralCategory | ''>(() => this.category() || this.suggestedCategory());
  protected readonly categoryHint = computed(() => {
    const level = this.alert()?.riskAssessment?.level;
    if (level === 'high') {
      return 'Risco alto: já vem sugerida a situação de sofrimento psíquico grave. Mude se não for esta.';
    }
    return level
      ? `Risco ${RISK_LABELS[level].toLowerCase()}: nenhuma situação vem marcada. Escolha a que descreve o caso.`
      : 'Escolha a situação que descreve o caso.';
  });
  protected readonly destinationOptions = computed(
    () => this.categories.find((c) => c.category === this.selectedCategory())?.destinations ?? [],
  );
  protected readonly requiresFamily = computed(
    () => this.categories.find((c) => c.category === this.selectedCategory())?.requiresFamilyCommunicated === true,
  );

  /** O psicólogo responsável pelo caso (nome no pedido de contato). */
  protected readonly psychologistName = computed(
    () => this.db.psychologists.get(this.caregiver()?.assignedPsychologistId ?? '')?.displayName ?? '',
  );
  /** "à" para a Dra., "ao" para o Dr.: o botão concorda com quem recebe o pedido. */
  protected readonly psychologistArticle = computed(() => {
    const name = this.psychologistName();
    return name.startsWith('Dra.') ? 'à' : name.startsWith('Dr.') ? 'ao' : 'a';
  });
  protected readonly canRequestContact = computed(() => {
    const a = this.alert();
    return (
      !!a &&
      a.level === 'red' &&
      a.status !== 'closed' &&
      !a.contact &&
      this.access.isSupervisor() &&
      this.psychologistName() !== ''
    );
  });
  protected readonly contactRequest = computed(() => {
    this.requestTick();
    this.db.notifications.all();
    const a = this.alert();
    return a ? this.svc.contactRequestOf(a.id) : null;
  });

  /** O que quem vai ligar precisa ter à mão: pontuação, faixa, evolução, canal e telefone (CX-016). */
  protected readonly callInfo = computed(() => {
    const a = this.alert();
    const c = this.caregiver();
    if (!a || !c || a.level !== 'red') {
      return null;
    }
    const current = this.db.zaritAssessments.get(a.assessmentId);
    const previous = current
      ? this.db.zaritAssessments
          .query((z) => z.caregiverId === c.id && z.status === 'completed' && z.sequence < current.sequence)
          .sort((x, y) => y.sequence - x.sequence)[0]
      : undefined;
    const now = current?.total ?? null;
    const before = previous?.total ?? null;
    let evolution = 'Primeira aplicação da escala: ainda não há comparação.';
    if (now !== null && before !== null) {
      const when = previous?.appliedAt ? ` desde a aplicação de ${formatDate(previous.appliedAt)}` : '';
      evolution =
        now > before
          ? `Subiu de ${before} para ${now} pontos${when}.`
          : now < before
            ? `Desceu de ${before} para ${now} pontos${when}.`
            : `Continua em ${now} pontos${when}.`;
    }
    return {
      caregiverId: c.id,
      code: c.code,
      score: now,
      evolution,
      channel: CHANNEL_LABELS[c.preferredChannel],
      phone: c.phone,
      whatsapp: c.whatsapp ?? null,
    };
  });

  constructor() {
    this.page.setCrumbs([
      { label: 'Acompanhamento', link: '/app/acompanhamento/fila' },
      { label: 'Alerta' },
    ]);
    // CX-025: o alerta abre no topo, com o título à vista, mesmo vindo de uma fila rolada.
    afterNextRender(() => {
      this.doc.documentElement.scrollTop = 0;
      this.doc.body.scrollTop = 0;
    });
    effect(() => {
      const a = this.alert();
      untracked(() => {
        if (!a) {
          return;
        }
        if (this.access.mustJustify(a.caregiverId)) {
          if (this.supervision.access('zarit_alert', a.id, a.caregiverId) === 'open') {
            this.unlocked.set(true);
          }
        } else if (this.access.canView(a.caregiverId)) {
          this.audit.view('zarit_alert', a.id, a.caregiverId);
        }
      });
    });
    // Rascunho dos campos curtos (CX-023): volta ao recarregar, some quando vira registro.
    effect(() => {
      const id = this.alert()?.id ?? null;
      if (id === null || untracked(() => this.restoredFor()) === id) {
        return;
      }
      untracked(() => this.restoreDraft(id));
    });
    effect(() => {
      const draft: AlertDraft = {
        channel: this.channel(),
        note: this.note(),
        by: this.by(),
        riskLevel: this.riskLevel(),
        riskNote: this.riskNote(),
      };
      const id = this.alert()?.id ?? null;
      untracked(() => {
        if (id === null || this.restoredFor() !== id || !this.canAct()) {
          return;
        }
        const empty = draft.channel === '' && draft.note.trim() === '' && draft.riskLevel === null && draft.riskNote.trim() === '';
        if (empty) {
          this.drafts.clear('zarit-alert', id);
        } else {
          this.drafts.save('zarit-alert', id, draft);
        }
      });
    });
  }

  private restoreDraft(alertId: string): void {
    this.restoredFor.set(alertId);
    const found = this.drafts.load<AlertDraft>('zarit-alert', alertId);
    const alert = this.alert();
    if (!found || !alert || alert.status === 'closed') {
      return;
    }
    const d = found.data;
    const wantsContact = !alert.contact && (d.channel !== '' || d.note.trim() !== '');
    const wantsRisk = !alert.riskAssessment && !!alert.contact && (d.riskLevel !== null || d.riskNote.trim() !== '');
    if (!wantsContact && !wantsRisk) {
      this.drafts.clear('zarit-alert', alertId);
      return;
    }
    if (wantsContact) {
      this.channel.set(d.channel);
      this.note.set(d.note);
      if (this.byOptions().some((u) => u.id === d.by)) {
        this.by.set(d.by);
      }
    }
    if (wantsRisk) {
      this.riskLevel.set(d.riskLevel);
      this.riskNote.set(d.riskNote);
    }
    this.draftNote.set(this.drafts.describe(found));
  }

  protected err(field: string): string | null {
    return this.errors().find((e) => e.field === field)?.message ?? null;
  }

  protected dateTime(value: string | undefined): string {
    return formatDateTime(value);
  }

  protected time24(value: string): string {
    return formatTime(value);
  }

  protected userName(id: string): string {
    return this.db.users.get(id)?.displayName ?? '';
  }

  protected channelName(channel: Channel): string {
    return CHANNEL_LABELS[channel];
  }

  protected riskName(level: RiskLevel): string {
    return RISK_LABELS[level];
  }

  /** "passos 2 a 7 pendentes": a mesma numeração da tela da ocorrência (CX-018). */
  protected pendingSteps(occurrenceId: string): string {
    const occurrence = this.db.occurrences.get(occurrenceId);
    const pending = occurrence?.steps.filter((s) => !s.doneAt).map((s) => s.n) ?? [];
    if (pending.length === 0) {
      return 'todos os passos feitos';
    }
    return `${stepsText(pending)} do POP-05 pendente${pending.length === 1 ? '' : 's'}`;
  }

  protected requestContact(): void {
    const a = this.alert();
    if (!a) {
      return;
    }
    const result = this.svc.requestContact(a.id);
    if (!result.ok) {
      this.error.set(result.errors[0]?.message ?? null);
      return;
    }
    this.requestTick.update((n) => n + 1);
    this.toasts.success(`Pedido enviado. O aviso aparece no sino de ${result.value.psychologistName}.`);
  }

  protected registerContact(): void {
    const a = this.alert();
    if (!a) {
      return;
    }
    const result = this.svc.registerContact(a.id, {
      date: this.clock.today(),
      time: this.time(),
      byUserId: this.by(),
      channel: this.channel() as Channel | '',
      note: this.note(),
    });
    if (!result.ok) {
      this.errors.set(result.errors);
      return;
    }
    this.errors.set([]);
    this.channel.set('');
    this.note.set('');
    this.draftNote.set(null);
    const hour = this.time();
    this.toasts.success(
      result.value.late
        ? `Contato registrado às ${hour}, depois do prazo. O atraso fica no histórico.`
        : a.level === 'red'
          ? `Contato registrado às ${hour}. O prazo do dia foi cumprido.`
          : `Contato registrado às ${hour}.`,
    );
  }

  protected registerRisk(): void {
    const a = this.alert();
    if (!a) {
      return;
    }
    const level = this.riskLevel();
    const result = this.svc.registerRisk(a.id, { level: level ?? '', note: this.riskNote() });
    if (!result.ok) {
      this.errors.set(result.errors);
      return;
    }
    this.errors.set([]);
    this.riskLevel.set(null);
    this.riskNote.set('');
    this.draftNote.set(null);
    this.toasts.success(
      level === 'high'
        ? 'Avaliação de risco registrada. Registre o encaminhamento agora.'
        : 'Avaliação de risco registrada.',
    );
  }

  protected setCategory(value: string): void {
    this.category.set(value as ReferralCategory | '');
    this.destinations.set([]);
    this.family.set(false);
  }

  protected toggleDestination(destination: string, on: boolean): void {
    const current = this.destinations();
    this.destinations.set(on ? [...current, destination] : current.filter((d) => d !== destination));
  }

  protected registerReferral(): void {
    const a = this.alert();
    const category = this.selectedCategory();
    if (!a) {
      return;
    }
    if (category === '') {
      this.errors.set([{ field: 'category', message: 'Escolha a situação do encaminhamento.' }]);
      return;
    }
    const result = this.svc.registerReferral(a.id, {
      category,
      destinations: this.destinations(),
      ...(this.requiresFamily() ? { familyCommunicated: this.family() } : {}),
    });
    if (!result.ok) {
      this.errors.set(result.errors);
      return;
    }
    this.errors.set([]);
    this.destinations.set([]);
    this.category.set('');
    this.toasts.success('Encaminhamento registrado e ligado à ocorrência.');
  }

  protected completeReview(): void {
    const a = this.alert();
    if (!a) {
      return;
    }
    const result = this.svc.completeSupportReview(a.id);
    if (!result.ok) {
      this.error.set(result.errors[0]?.message ?? null);
      return;
    }
    this.toasts.success('Revisão da rede de apoio registrada.');
  }

  protected async close(): Promise<void> {
    const a = this.alert();
    if (!a) {
      return;
    }
    if (this.missing().length > 0) {
      this.error.set(`Falta: ${this.missing().join(', ')}.`);
      return;
    }
    this.error.set(null);
    const name = this.caregiver()?.fullName ?? 'o cuidador';
    const parts: string[] = [];
    if (a.contact) {
      parts.push(`Contato às ${formatTime(a.contact.at)}`);
    }
    if (a.riskAssessment) {
      parts.push(`risco ${RISK_LABELS[a.riskAssessment.level].toLowerCase()}`);
    }
    if (a.referralIds.length > 0) {
      parts.push('encaminhamento registrado');
    }
    const { confirmed } = await this.dialogs.confirm({
      title: `Encerrar o alerta de ${name}?`,
      message: `${parts.length > 0 ? `${parts.join(', ')}. ` : ''}Depois de encerrado, só é possível adicionar adendo.`,
      confirmLabel: 'Encerrar alerta',
      cancelLabel: 'Voltar',
      irreversibleNote: 'O encerramento não pode ser desfeito.',
    });
    if (!confirmed) {
      return;
    }
    const result = this.svc.closeAlert(a.id);
    if (!result.ok) {
      this.error.set(result.errors[0]?.message ?? null);
      return;
    }
    this.toasts.success('Alerta encerrado.');
  }
}
