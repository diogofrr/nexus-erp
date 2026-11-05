import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuditLogService } from '@core/audit';
import { AuthService } from '@core/auth';
import { Clock } from '@core/clock';
import { Database } from '@core/data';
import { formatDateTime } from '@core/format';
import type { Complaint, GraveCategory } from '@core/models';
import { NetworkService } from '@core/network';
import { ARP_BAND_LABELS } from '@core/rules';
import {
  BadgeComponent,
  BadgeVariant,
  EmptyStateComponent,
  ErrorSummaryComponent,
  ErrorSummaryItem,
  FormFieldComponent,
  IconComponent,
  NxInputDirective,
  PageHeaderComponent,
  RadioGroupComponent,
  RadioOption,
  TimelineComponent,
  TimelineItem,
  fieldErrorMessage,
} from '@shared/ui';
import { DialogService, DrawerComponent, PageContextService, ToastService } from '@shared/ui/overlay';
import { map } from 'rxjs';
import { CaregiverPickerComponent } from '../components/caregiver-picker.component';
import { ComplaintsService } from '../state/complaints.service';
import {
  CHANNEL_LABELS,
  COMPLAINT_OPEN_STATES,
  COMPLAINT_STATUS_LABELS,
  COMPLAINT_TARGET_LABELS,
  GRAVE_CATEGORY_LABELS,
  complaintDeadline,
} from '../state/message-view';

const HIDDEN_TEXT = 'Texto oculto: pode identificar o titular.';
const SENT_TO_TECHNICAL_LEAD = 'Enviado ao responsável técnico.';

const CATEGORY_OPTIONS: readonly RadioOption<GraveCategory>[] = (
  Object.keys(GRAVE_CATEGORY_LABELS) as GraveCategory[]
).map((value) => ({ value, label: GRAVE_CATEGORY_LABELS[value] }));

/**
 * Reclamação (SCR-M11-05, POP-08, F17): descrição, alvo, gravidade, suspeita de violência, linha do tempo,
 * resposta e encerramento.
 *
 * - **Grave** exige categoria e prestador, conta na ARP e, na terceira, suspende o prestador na hora (RN-ARP-09, 10).
 * - **Suspeita de violência ou negligência** abre a ocorrência POP-07 restrita ao responsável técnico e ao
 *   psicólogo do caso; o atendimento só vê "Enviado ao responsável técnico" e a gestão só a contagem.
 * - **Improcedente** exige o motivo. O responsável técnico só lê.
 */
@Component({
  selector: 'app-complaint-detail-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    BadgeComponent,
    DrawerComponent,
    EmptyStateComponent,
    ErrorSummaryComponent,
    FormFieldComponent,
    IconComponent,
    NxInputDirective,
    PageHeaderComponent,
    RadioGroupComponent,
    TimelineComponent,
    CaregiverPickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page--narrow">
      @if (complaint(); as c) {
        <app-page-header [title]="c.protocol" [description]="subtitle()">
          <a class="btn" routerLink="/app/reclamacoes">Voltar às reclamações</a>
        </app-page-header>

        <div class="stack stack--6">
          <div class="cluster" data-role="badges">
            <app-badge [variant]="statusVariant()" dot>{{ statusLabel() }}</app-badge>
            <app-badge [variant]="deadlineVariant()" icon="clock" data-role="deadline">{{ deadline().label }}</app-badge>
            @if (c.severity === 'grave') {
              <app-badge variant="danger" icon="triangle-alert" data-role="grave-badge">
                Grave: {{ graveLabel() }}
              </app-badge>
            }
            @if (c.suspectedElderAbuse) {
              <app-badge variant="danger" icon="shield-alert" data-role="abuse-badge">
                {{ isTechnicalLead() ? 'Suspeita de violência (POP-07)' : 'Enviado ao responsável técnico' }}
              </app-badge>
            }
          </div>

          <section class="card card--pad stack stack--3" aria-labelledby="rc-what">
            <h2 class="t-h4" id="rc-what">O que aconteceu</h2>
            @if (descriptionHidden()) {
              <p class="placeholder-line" data-role="description-hidden">
                <svg appIcon="lock" size="sm"></svg>{{ hiddenText() }}
              </p>
            } @else {
              <p class="discreet" data-role="description">{{ c.description }}</p>
            }
            <dl class="dl">
              <dt>Canal</dt>
              <dd>{{ channelLabel() }}</dd>
              <dt>Aberta em</dt>
              <dd>{{ openedText() }}</dd>
              <dt>Prazo de resposta</dt>
              <dd data-role="due-text">{{ deadline().absolute }}</dd>
              <dt>Cuidador</dt>
              <dd><span class="discreet">{{ caregiverLabel() }}</span></dd>
              <dt>Sobre</dt>
              <dd data-role="target">{{ targetText() }}</dd>
            </dl>
          </section>

          @if (c.target.providerId) {
            <section class="card card--pad stack stack--3" aria-labelledby="rc-arp" data-role="arp-section">
              <h2 class="t-h4" id="rc-arp">Avaliação do prestador (ARP)</h2>
              @if (arp(); as a) {
                <dl class="dl">
                  <dt>Reclamações graves</dt>
                  <dd class="t-num" data-role="grave-count">{{ a.graveCount }}</dd>
                  <dt>Média</dt>
                  <dd>{{ a.averageText }}</dd>
                  <dt>Faixa hoje</dt>
                  <dd>{{ a.bandText }}</dd>
                  <dt>Situação na rede</dt>
                  <dd>{{ a.statusText }}</dd>
                </dl>
                @if (canOpenProvider()) {
                  <p><a [routerLink]="['/app/rede/prestadores', c.target.providerId]">Abrir a ficha do prestador</a></p>
                }
              }
              @if (c.severity !== 'grave') {
                <p class="t-caption t-muted">
                  Reclamações graves contam na avaliação do prestador. Três ou mais levam à suspensão da busca.
                </p>
              }
            </section>
          }

          @if (c.suspectedElderAbuse) {
            <section class="card card--pad stack stack--2" aria-labelledby="rc-abuse" data-role="abuse-section">
              <h2 class="t-h4" id="rc-abuse">Suspeita de violência ou negligência</h2>
              @if (isTechnicalLead()) {
                <p>A ocorrência POP-07 está aberta e restrita ao responsável técnico e ao psicólogo do caso.</p>
                <p><a routerLink="/app/governanca/ocorrencias">Abrir as ocorrências</a></p>
              } @else {
                <p data-role="sent-to-rt">{{ sentToRt }}</p>
              }
            </section>
          }

          <section class="card card--pad stack stack--3" aria-labelledby="rc-timeline">
            <h2 class="t-h4" id="rc-timeline">Linha do tempo</h2>
            <app-timeline label="Linha do tempo da reclamação" [items]="timeline()" />
          </section>

          @if (canAct() && isOpenState()) {
            <section class="card card--pad stack stack--3" aria-labelledby="rc-act" data-role="actions">
              <h2 class="t-h4" id="rc-act">O que fazer agora</h2>
              <div class="cluster">
                @if (c.status === 'open') {
                  <button type="button" class="btn" data-role="start-analysis" (click)="startAnalysis()">
                    Colocar em análise
                  </button>
                }
                @if (c.severity !== 'grave') {
                  <button type="button" class="btn" data-role="classify-grave" (click)="openGrave()">
                    <svg appIcon="triangle-alert" size="sm"></svg>Classificar como grave
                  </button>
                }
                @if (!c.suspectedElderAbuse) {
                  <button type="button" class="btn" data-role="flag-abuse" (click)="flagAbuse()">
                    <svg appIcon="shield-alert" size="sm"></svg>Suspeita de violência ou negligência
                  </button>
                }
              </div>
              @if (abuseNeedsCaregiver()) {
                <div class="sunken p-3" data-role="abuse-needs-caregiver">
                  <app-caregiver-picker
                    id="abuse-caregiver"
                    label="Cuidador envolvido"
                    hint="A ocorrência precisa de um cuidador. Escolha para continuar."
                    [value]="null"
                    (valueChange)="chooseAbuseCaregiver($event)"
                  />
                </div>
              }
              <form class="stack stack--2" novalidate [formGroup]="replyForm" (ngSubmit)="respond()" data-role="reply-form">
                <app-form-field label="Resposta ao titular" controlId="complaint-reply" [forceErrors]="replySubmitted()">
                  <textarea appInput rows="4" formControlName="text"></textarea>
                </app-form-field>
                <div class="cluster cluster--end">
                  <button type="submit" class="btn btn--primary" data-role="send-response">Enviar resposta</button>
                </div>
              </form>
              <div class="cluster">
                <button type="button" class="btn btn--sm" data-role="close-complaint" (click)="openClosure('close')">
                  Encerrar reclamação
                </button>
                <button type="button" class="btn btn--sm btn--danger-quiet" data-role="dismiss-complaint" (click)="openClosure('dismiss')">
                  Marcar como improcedente
                </button>
              </div>
            </section>
          } @else if (canAct() && c.status === 'answered') {
            <section class="card card--pad stack stack--3" data-role="actions">
              <h2 class="t-h4">Resposta enviada</h2>
              <p>O titular recebeu a resposta. Encerre a reclamação quando ele confirmar.</p>
              <div class="cluster">
                <button type="button" class="btn btn--primary" data-role="close-complaint" (click)="openClosure('close')">
                  Encerrar reclamação
                </button>
              </div>
            </section>
          } @else if (!canAct()) {
            <p class="t-caption t-muted" data-role="read-only">Você acompanha esta reclamação em modo leitura.</p>
          }
        </div>
      } @else {
        <div class="card">
          <app-empty-state
            kind="error"
            title="Não encontramos esta reclamação"
            text="Ela pode não estar disponível para o seu perfil. Volte à lista para continuar."
          >
            <a class="btn" routerLink="/app/reclamacoes">Voltar às reclamações</a>
          </app-empty-state>
        </div>
      }
    </div>

    <app-drawer [(open)]="graveOpen" heading="Classificar como grave" subtitle="Conta na avaliação do prestador">
      <form id="nx-grave-form" class="stack stack--3" novalidate [formGroup]="graveForm" (ngSubmit)="classify()">
        <app-error-summary [items]="graveErrors()" />
        <p class="t-ui" data-role="grave-effect">
          Reclamações graves contam na avaliação do prestador. Três ou mais levam à suspensão na hora, e a
          avaliação interna é aberta.
        </p>
        <app-form-field label="Categoria" group controlId="grave-category" [error]="errorOf(graveErrors(), 'grave-category')">
          <app-radio-group [options]="categories" formControlName="category" />
        </app-form-field>
        <app-form-field label="Prestador" controlId="grave-provider" [error]="errorOf(graveErrors(), 'grave-provider')">
          <select appInput formControlName="providerId">
            <option value="">Escolha o prestador</option>
            @for (p of providers(); track p.id) {
              <option [value]="p.id">{{ p.name }}</option>
            }
          </select>
        </app-form-field>
      </form>
      <ng-container drawerFooter>
        <button type="button" class="btn" (click)="graveOpen.set(false)">Voltar</button>
        <button type="submit" form="nx-grave-form" class="btn btn--primary" data-role="confirm-grave">
          Classificar como grave
        </button>
      </ng-container>
    </app-drawer>

    <app-drawer
      [(open)]="closureOpen"
      [heading]="closureMode() === 'dismiss' ? 'Marcar como improcedente' : 'Encerrar reclamação'"
    >
      <form id="nx-closure-form" class="stack stack--3" novalidate [formGroup]="closureForm" (ngSubmit)="finish()">
        <app-error-summary [items]="closureErrors()" />
        <app-form-field
          [label]="closureMode() === 'dismiss' ? 'Motivo' : 'Nota de encerramento (opcional)'"
          [optional]="closureMode() !== 'dismiss'"
          controlId="closure-text"
          [error]="errorOf(closureErrors(), 'closure-text')"
        >
          <textarea appInput rows="4" formControlName="text"></textarea>
        </app-form-field>
      </form>
      <ng-container drawerFooter>
        <button type="button" class="btn" (click)="closureOpen.set(false)">Voltar</button>
        <button type="submit" form="nx-closure-form" class="btn btn--primary" data-role="confirm-closure">
          {{ closureMode() === 'dismiss' ? 'Marcar como improcedente' : 'Encerrar reclamação' }}
        </button>
      </ng-container>
    </app-drawer>
  `,
})
export class ComplaintDetailPage {
  private readonly db = inject(Database);
  private readonly auth = inject(AuthService);
  private readonly clock = inject(Clock);
  private readonly audit = inject(AuditLogService);
  private readonly network = inject(NetworkService);
  private readonly service = inject(ComplaintsService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly page = inject(PageContextService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);

  protected readonly sentToRt = SENT_TO_TECHNICAL_LEAD;
  protected readonly categories = CATEGORY_OPTIONS;

  private readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  protected readonly complaint = computed<Complaint | undefined>(() => {
    const id = this.id();
    const role = this.auth.role();
    const found = id ? this.db.complaints.get(id) : undefined;
    if (!found || !role) {
      return undefined;
    }
    // O mesmo recorte da lista: nada vaza por link direto (RT só graves e POP-07).
    return this.service.visibleTo(role).some((c) => c.id === found.id) ? found : undefined;
  });

  protected readonly isTechnicalLead = computed(() => this.auth.role() === 'technical_lead');
  protected readonly canAct = computed(() => this.auth.can('complaints', 'update'));
  protected readonly isOpenState = computed(() => {
    const c = this.complaint();
    return c !== undefined && COMPLAINT_OPEN_STATES.includes(c.status);
  });
  protected readonly canOpenProvider = computed(() => {
    const role = this.auth.role();
    return role === 'partner' || role === 'support';
  });

  protected readonly deadline = computed(() => {
    const c = this.complaint();
    return c
      ? complaintDeadline(c, this.clock.now())
      : { tone: 'ok' as const, label: '', absolute: '' };
  });
  protected readonly deadlineVariant = computed<BadgeVariant>(() => {
    const tone = this.deadline().tone;
    return tone === 'danger' ? 'danger' : tone === 'attention' ? 'attention' : tone === 'done' ? 'success' : 'info';
  });
  protected readonly statusLabel = computed(() => {
    const c = this.complaint();
    return c ? COMPLAINT_STATUS_LABELS[c.status] : '';
  });
  protected readonly statusVariant = computed<BadgeVariant>(() => {
    const status = this.complaint()?.status;
    return status === 'closed' ? 'success' : status === 'dismissed' ? 'neutral' : status === 'answered' ? 'info' : 'attention';
  });
  protected readonly graveLabel = computed(() => {
    const category = this.complaint()?.graveCategory;
    return category ? GRAVE_CATEGORY_LABELS[category] : 'sem categoria';
  });
  protected readonly channelLabel = computed(() => {
    const c = this.complaint();
    return c ? CHANNEL_LABELS[c.channel] : '';
  });
  protected readonly openedText = computed(() => formatDateTime(this.complaint()?.openedAt));
  protected readonly subtitle = computed(() => {
    const c = this.complaint();
    return c ? `${COMPLAINT_TARGET_LABELS[c.target.type]} · ${this.channelLabel()}` : '';
  });
  protected readonly caregiverLabel = computed(() => {
    const id = this.complaint()?.caregiverId;
    if (!id) {
      return 'Não identificado';
    }
    const cg = this.db.caregivers.get(id);
    return cg ? (this.auth.role() === 'partner' ? cg.code : cg.fullName) : 'Não identificado';
  });
  protected readonly targetText = computed(() => {
    const c = this.complaint();
    if (!c) {
      return '';
    }
    const provider = c.target.providerId ? this.db.providers.get(c.target.providerId) : undefined;
    return provider ? `Prestador: ${provider.name}` : COMPLAINT_TARGET_LABELS[c.target.type];
  });

  /** A gestão não lê o texto livre que identifica o titular; o atendimento não lê o da suspeita de violência. */
  protected readonly descriptionHidden = computed(() => {
    const c = this.complaint();
    const role = this.auth.role();
    return c !== undefined && (role === 'partner' || (c.suspectedElderAbuse && role === 'support'));
  });
  protected readonly hiddenText = computed(() =>
    this.complaint()?.suspectedElderAbuse && this.auth.role() === 'support' ? SENT_TO_TECHNICAL_LEAD : HIDDEN_TEXT,
  );

  protected readonly timeline = computed<TimelineItem[]>(() =>
    (this.complaint()?.events ?? []).map((e, k) => ({
      id: `${k}`,
      title: this.db.users.get(e.byUserId)?.displayName ?? 'Equipe Nexus',
      text: e.text,
      at: e.at,
    })),
  );

  protected readonly arp = computed(() => {
    const providerId = this.complaint()?.target.providerId;
    const summary = providerId ? this.network.summaryOf(providerId) : undefined;
    if (!summary) {
      return null;
    }
    return {
      graveCount: summary.graveCount,
      averageText: summary.average === null ? 'Sem média (menos de 5 avaliações)' : summary.average.toFixed(2).replace('.', ','),
      bandText: ARP_BAND_LABELS[summary.band],
      statusText: summary.provider.status === 'suspended' ? 'Suspenso: fora da busca' : summary.provider.status === 'monitoring' ? 'Em monitoramento' : summary.provider.status === 'active' ? 'Ativo' : 'Fora da rede',
    };
  });

  protected readonly providers = computed(() =>
    [...this.db.providers.all()]
      .filter((p) => p.status !== 'candidate' && p.status !== 'rejected')
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
  );

  // ===== Formulários =====

  protected readonly replyForm = this.fb.group({ text: this.fb.control('', Validators.required) });
  protected readonly replySubmitted = signal(false);

  protected readonly graveOpen = signal(false);
  protected readonly graveErrors = signal<ErrorSummaryItem[]>([]);
  protected readonly graveForm = this.fb.group({
    category: new FormControl<GraveCategory | null>(null),
    providerId: this.fb.control(''),
  });

  protected readonly closureOpen = signal(false);
  protected readonly closureMode = signal<'close' | 'dismiss'>('close');
  protected readonly closureErrors = signal<ErrorSummaryItem[]>([]);
  protected readonly closureForm = this.fb.group({ text: this.fb.control('') });

  protected readonly abuseNeedsCaregiver = signal(false);

  constructor() {
    effect(() => {
      const c = this.complaint();
      untracked(() => {
        if (c) {
          this.page.setCrumbs([{ label: 'Reclamações', link: '/app/reclamacoes' }, { label: c.protocol }]);
          this.audit.view('complaint', c.id, c.caregiverId);
        }
      });
    });
  }

  protected errorOf(items: readonly ErrorSummaryItem[], id: string): string | null {
    return items.find((i) => i.controlId === id)?.message ?? null;
  }

  // ===== Ações =====

  protected startAnalysis(): void {
    const c = this.complaint();
    if (c) {
      this.service.startAnalysis(c.id);
      this.toasts.success('Reclamação em análise.');
    }
  }

  protected respond(): void {
    const c = this.complaint();
    this.replySubmitted.set(true);
    this.replyForm.markAllAsTouched();
    if (!c || this.replyForm.invalid) {
      return;
    }
    this.service.respond(c.id, this.replyForm.controls.text.value);
    this.replyForm.reset({ text: '' });
    this.replySubmitted.set(false);
    this.toasts.success('Resposta registrada. A reclamação passou a Respondida.');
  }

  protected openGrave(): void {
    const c = this.complaint();
    this.graveForm.reset({ category: null, providerId: c?.target.providerId ?? '' });
    this.graveErrors.set([]);
    this.graveOpen.set(true);
  }

  protected classify(): void {
    const c = this.complaint();
    const { category, providerId } = this.graveForm.getRawValue();
    const errors: ErrorSummaryItem[] = [];
    if (!category) {
      errors.push({ controlId: 'grave-category', message: 'Escolha a categoria da reclamação grave.' });
    }
    if (!providerId) {
      errors.push({ controlId: 'grave-provider', message: 'Escolha o prestador citado na reclamação.' });
    }
    this.graveErrors.set(errors);
    if (!c || errors.length > 0 || !category) {
      return;
    }
    const outcome = this.service.classifyGrave(c.id, category, providerId);
    this.graveOpen.set(false);
    const name = this.db.providers.get(providerId)?.name ?? 'O prestador';
    this.toasts.success(
      outcome.reevaluation.suspended
        ? `Classificada como grave. ${outcome.reevaluation.message}`
        : `Classificada como grave. ${name} tem ${outcome.graveCount} ${outcome.graveCount === 1 ? 'reclamação grave' : 'reclamações graves'}; a terceira leva à suspensão.`,
    );
  }

  protected async flagAbuse(caregiverId?: string): Promise<void> {
    const c = this.complaint();
    if (!c) {
      return;
    }
    const cgId = caregiverId ?? c.caregiverId;
    if (!cgId) {
      this.abuseNeedsCaregiver.set(true);
      return;
    }
    const result = await this.dialogs.confirm({
      title: 'Marcar suspeita de violência ou negligência?',
      message:
        'Abre uma ocorrência restrita ao responsável técnico. Lembrete: proteger a pessoa idosa sem abandonar quem cuida.',
      effects: {
        block: ['o texto e a ocorrência, só o responsável técnico e o psicólogo do caso veem'],
        keep: ['o histórico desta reclamação'],
      },
      tone: 'danger',
      confirmLabel: 'Abrir ocorrência restrita',
      busyLabel: 'Abrindo...',
      run: () => {
        this.service.flagElderAbuse(c.id, cgId);
      },
    });
    if (result.confirmed) {
      this.abuseNeedsCaregiver.set(false);
      this.toasts.success('Enviado ao responsável técnico.');
    }
  }

  protected chooseAbuseCaregiver(id: string | null): void {
    if (id) {
      void this.flagAbuse(id);
    }
  }

  protected openClosure(mode: 'close' | 'dismiss'): void {
    this.closureMode.set(mode);
    this.closureForm.reset({ text: '' });
    this.closureErrors.set([]);
    this.closureOpen.set(true);
  }

  protected finish(): void {
    const c = this.complaint();
    const text = this.closureForm.controls.text.value.trim();
    if (!c) {
      return;
    }
    if (this.closureMode() === 'dismiss') {
      if (text.length < 10) {
        const message =
          text.length === 0
            ? (fieldErrorMessage({ required: true }, 'o motivo') ?? 'Informe o motivo.')
            : 'Escreva o motivo com pelo menos 10 caracteres.';
        this.closureErrors.set([{ controlId: 'closure-text', message }]);
        return;
      }
      this.service.dismiss(c.id, text);
      this.toasts.success('Reclamação marcada como improcedente.');
    } else {
      this.service.close(c.id, text);
      this.toasts.success('Reclamação encerrada.');
    }
    this.closureErrors.set([]);
    this.closureOpen.set(false);
  }
}
