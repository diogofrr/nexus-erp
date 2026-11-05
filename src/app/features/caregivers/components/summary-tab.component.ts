import { ChangeDetectionStrategy, Component, TemplateRef, computed, inject, input, output, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/auth';
import { Clock, ageInYears } from '@core/clock';
import { SubscriptionService, scheduledChangeOf } from '@core/commerce/subscription.service';
import { Database } from '@core/data';
import { AssignmentRequestService } from '@core/notifications/assignment-requests';
import { formatDate } from '@core/format';
import type { Caregiver } from '@core/models';
import { ConsentService, DataSubjectRequestService } from '@core/privacy';
import { canSeeCaregiverIdentity } from '@core/privacy/caregiver-label';
import {
  BadgeComponent,
  CardComponent,
  ChecklistComponent,
  ChecklistItem,
  DescriptionItem,
  DescriptionListComponent,
  IconComponent,
  MaskedFieldComponent,
  PlanBadgeComponent,
} from '@shared/ui';
import { DialogService, ToastService } from '@shared/ui/overlay';
import { CaregiverDirectory } from '../state/caregiver-directory.service';
import {
  CHANNEL_LABELS,
  LITERACY_LABELS,
  RELATIONSHIP_LABELS,
  SEX_LABELS,
  STATUS_BADGES,
  STATUS_LABELS,
} from '../state/caregiver-labels';
import { CaregiverError, CaregiverService } from '../state/caregiver.service';

interface Attention {
  icon: 'triangle-alert' | 'info' | 'clock' | 'shield-check' | 'hourglass';
  tone: 'attention' | 'info';
  text: string;
  /** Aba para onde o botão leva. */
  goto?: string;
  /** Ação do próprio botão (em vez de trocar de aba). */
  run?: 'request-assignment';
  action?: string;
}

/**
 * Aba Resumo (SCR-M03-03): "Precisa de atenção" antes dos dados, dados do cadastro (CPF, telefone e
 * e-mail mascarados, com "Mostrar" e motivo), elegibilidade ao piloto (SCR-M03-06) e psicólogo
 * responsável. A gestão vê só código, plano, situação e piloto.
 */
@Component({
  selector: 'app-caregiver-summary-tab',
  imports: [
    BadgeComponent,
    CardComponent,
    ChecklistComponent,
    DescriptionListComponent,
    IconComponent,
    MaskedFieldComponent,
    PlanBadgeComponent,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="layout-main-aside">
      <div class="stack stack--6">
        <app-card [title]="erased() ? 'Cadastro encerrado' : identified() ? 'Dados do cadastro' : 'Visão da gestão'" [subtitle]="erased() ? 'Os dados de identificação foram eliminados. Ficam só o código e o que a lei manda reter.' : identified() ? 'Dados fictícios, só neste navegador' : 'Código, plano e situação. Sem nome nem contato.'">
          <app-description-list [items]="items()" />
          <ng-template #cpf>
            <app-masked-field kind="cpf" label="CPF" [value]="caregiver().cpf" entity="caregiver" [entityId]="caregiver().id" field="cpf" [subjectId]="caregiver().id" [code]="caregiver().code" />
          </ng-template>
          <ng-template #phone>
            <app-masked-field kind="phone" label="Telefone" [value]="caregiver().phone" entity="caregiver" [entityId]="caregiver().id" field="phone" [subjectId]="caregiver().id" [code]="caregiver().code" />
          </ng-template>
          <ng-template #whatsapp>
            <app-masked-field kind="phone" label="WhatsApp" [value]="caregiver().whatsapp ?? null" entity="caregiver" [entityId]="caregiver().id" field="whatsapp" [subjectId]="caregiver().id" [code]="caregiver().code" />
          </ng-template>
          <ng-template #email>
            <app-masked-field kind="email" label="E-mail" [value]="caregiver().email" entity="caregiver" [entityId]="caregiver().id" field="email" [subjectId]="caregiver().id" [code]="caregiver().code" />
          </ng-template>
          <ng-template #plan><app-plan-badge [plan]="planId()" /></ng-template>
          <ng-template #status>
            <app-badge [variant]="statusBadge().variant" [icon]="statusBadge().icon">{{ statusLabel() }}</app-badge>
          </ng-template>
          <ng-template #psychologist>
            @if (psychologistName()) {
              {{ psychologistName() }}
            } @else {
              <app-badge variant="attention" outline dot>A atribuir</app-badge>
            }
            @if (canAssign()) {
              <span class="cluster">
                <label class="sr-only" for="nx-assign">Psicólogo responsável</label>
                <select id="nx-assign" class="select select--sm" (change)="onAssign($event)">
                  <option value="" [selected]="!caregiver().assignedPsychologistId">Sem psicólogo</option>
                  @for (p of psychologists(); track p.id) {
                    <option [value]="p.id" [selected]="caregiver().assignedPsychologistId === p.id">{{ p.displayName }}</option>
                  }
                </select>
              </span>
            }
          </ng-template>
        </app-card>

        @if (identified() && !erased()) {
          <app-card title="Piloto" subtitle="Elegibilidade e participação (RN-PIL-04)">
            <div class="stack stack--3" data-role="pilot">
              <p role="status">
                <strong>{{ eligibility().metCount }} de {{ eligibility().criteria.length }} critérios atendidos.</strong>
                @if (eligibility().eligible) {
                  O cuidador é elegível.
                } @else {
                  {{ failedCount() }} {{ failedCount() === 1 ? 'critério reprovado' : 'critérios reprovados' }}.
                }
              </p>
              <app-checklist label="Critérios de elegibilidade ao piloto" [items]="criteria()" />
              @if (canEdit()) {
                <div class="cluster">
                  @if (caregiver().isPilot) {
                    <button type="button" class="btn" (click)="leavePilot()">Retirar do piloto</button>
                  } @else {
                    <button type="button" class="btn btn--primary" [attr.aria-disabled]="!eligibility().canEnroll" (click)="enroll()">
                      Marcar como piloto
                    </button>
                    @if (!eligibility().canEnroll) {
                      <span class="t-ui" data-role="pilot-missing">Falta: {{ eligibility().missing.join('; ') }}.</span>
                    }
                  }
                </div>
              } @else if (caregiver().isPilot) {
                <app-badge variant="info" icon="activity">Participa do piloto</app-badge>
              }
            </div>
          </app-card>
        }
      </div>

      <aside class="stack stack--6" aria-label="Pendências do cuidador">
        <app-card title="Precisa de atenção">
          @if (attention().length === 0) {
            <p class="t-muted">Nada pendente por aqui.</p>
          } @else {
            <ul class="stack stack--3 list-reset" role="list">
              @for (item of attention(); track item.text) {
                <li class="cluster cluster--nowrap">
                  <svg [appIcon]="item.icon"></svg>
                  <span>{{ item.text }}</span>
                  @if (item.goto) {
                    <button type="button" class="btn btn--sm" (click)="goto.emit(item.goto)">{{ item.action }}</button>
                  } @else if (item.run) {
                    <button type="button" class="btn btn--sm" data-role="request-assignment" (click)="requestAssignment()">{{ item.action }}</button>
                  }
                </li>
              }
            </ul>
          }
        </app-card>
        @if (canSchedule()) {
          <app-card title="Atalhos">
            <div class="stack stack--2">
              <a class="btn" routerLink="/app/atendimento/agenda" [queryParams]="{ acao: 'agendar', cuidador: caregiver().id }">Agendar sessão</a>
            </div>
          </app-card>
        }
      </aside>
    </div>
  `,
})
export class SummaryTabComponent {
  private readonly auth = inject(AuthService);
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly service = inject(CaregiverService);
  private readonly directory = inject(CaregiverDirectory);
  private readonly subscriptions = inject(SubscriptionService);
  private readonly consent = inject(ConsentService);
  private readonly dsr = inject(DataSubjectRequestService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly assignments = inject(AssignmentRequestService);

  readonly caregiver = input.required<Caregiver>();
  /** Pede ao pai para trocar de aba. */
  readonly goto = output<string>();

  private readonly cpfTpl = viewChild.required<TemplateRef<unknown>>('cpf');
  private readonly phoneTpl = viewChild.required<TemplateRef<unknown>>('phone');
  private readonly whatsappTpl = viewChild.required<TemplateRef<unknown>>('whatsapp');
  private readonly emailTpl = viewChild.required<TemplateRef<unknown>>('email');
  private readonly planTpl = viewChild.required<TemplateRef<unknown>>('plan');
  private readonly statusTpl = viewChild.required<TemplateRef<unknown>>('status');
  private readonly psychologistTpl = viewChild.required<TemplateRef<unknown>>('psychologist');

  protected readonly role = this.auth.role;
  protected readonly identified = computed(() => canSeeCaregiverIdentity(this.role()));
  /** Titular eliminado (M12): só sobram código, plano e situação; o resto foi apagado (QA-006). */
  protected readonly erased = computed(() => !!this.caregiver().erasedAt);
  protected readonly canEdit = computed(() => this.auth.can('caregiver_registry', 'update'));
  protected readonly canAssign = computed(() => this.role() === 'technical_lead');
  protected readonly canSchedule = computed(() => this.role() === 'support' || this.role() === 'psychologist');
  protected readonly psychologists = this.directory.psychologists;

  protected readonly planId = computed(() => {
    this.db.subscriptions.all();
    return this.subscriptions.planOf(this.caregiver().id);
  });
  protected readonly statusBadge = computed(() => STATUS_BADGES[this.caregiver().status]);
  protected readonly statusLabel = computed(() => STATUS_LABELS[this.caregiver().status]);
  protected readonly psychologistName = computed(() => {
    const id = this.caregiver().assignedPsychologistId;
    return id ? (this.db.psychologists.get(id)?.displayName ?? null) : null;
  });

  protected readonly eligibility = computed(() => {
    // Reage a consentimentos, pessoa idosa e cadastro.
    this.db.consents.all();
    this.db.elders.all();
    return this.service.pilotEligibility(this.caregiver().id);
  });
  protected readonly failedCount = computed(() => this.eligibility().criteria.filter((c) => !c.met).length);
  protected readonly criteria = computed<ChecklistItem[]>(() => [
    ...this.eligibility().criteria.map((c): ChecklistItem => ({
      id: c.key,
      title: c.label,
      text: c.detail,
      state: c.met ? 'ok' : 'fail',
      badge: c.met ? 'Cumprido' : 'Não cumprido',
    })),
    {
      id: 'tcle',
      title: 'Termo de consentimento do piloto (TCLE) ativo',
      text: this.eligibility().tcleActive ? 'O TCLE está ativo.' : 'Registre o consentimento do piloto na aba Consentimentos.',
      state: this.eligibility().tcleActive ? 'ok' : 'pending',
      badge: this.eligibility().tcleActive ? 'Cumprido' : 'Pendente',
    },
  ]);

  protected readonly items = computed<DescriptionItem[]>(() => {
    const c = this.caregiver();
    if (!this.identified()) {
      return [
        { label: 'Código', value: c.code },
        { label: 'Plano', template: this.planTpl() },
        { label: 'Situação', template: this.statusTpl() },
        { label: 'Piloto', value: c.isPilot ? 'Participa' : 'Não participa' },
        { label: 'Adesão', value: formatDate(c.enrolledAt) },
      ];
    }
    if (this.erased()) {
      return [
        { label: 'Código', value: c.code },
        { label: 'Situação', template: this.statusTpl() },
        { label: 'Plano', template: this.planTpl() },
        { label: 'Encerrado em', value: formatDate(c.closedAt) },
        { label: 'Dados eliminados em', value: formatDate(c.erasedAt) },
      ];
    }
    return [
      { label: 'Código', value: c.code },
      { label: 'Situação', template: this.statusTpl() },
      { label: 'Plano', template: this.planTpl() },
      { label: 'CPF', template: this.cpfTpl() },
      { label: 'Telefone', template: this.phoneTpl() },
      { label: 'WhatsApp', template: this.whatsappTpl() },
      { label: 'E-mail', template: this.emailTpl() },
      { label: 'Nascimento', value: `${formatDate(c.birthDate)} (${ageInYears(c.birthDate, this.clock.today())} anos)` },
      { label: 'Sexo', value: SEX_LABELS[c.sex] },
      { label: 'Parentesco com a pessoa idosa', value: RELATIONSHIP_LABELS[c.relationship] },
      { label: 'Cidade', value: c.city },
      { label: 'Horas de cuidado por dia', value: String(c.dailyCareHours) },
      { label: 'Canal preferido', value: CHANNEL_LABELS[c.preferredChannel] },
      { label: 'Familiaridade digital', value: LITERACY_LABELS[c.digitalLiteracy] },
      { label: 'Adesão', value: formatDate(c.enrolledAt) },
      { label: 'Aplicação da escala', value: this.directory.rows().find((r) => r.id === c.id)?.scale.label },
      { label: 'Psicólogo responsável', template: this.psychologistTpl() },
    ];
  });

  protected readonly attention = computed<Attention[]>(() => {
    const c = this.caregiver();
    const out: Attention[] = [];
    this.db.consents.all();
    this.db.dataSubjectRequests.all();
    this.db.subscriptions.all();
    const hasConsentTab = this.role() !== 'psychologist' && this.role() !== null;
    const health = this.consent.status(c.id, 'health_data');
    if (health === 'revoked') {
      out.push({ icon: 'shield-check', tone: 'attention', text: 'Consentimento de saúde revogado. O acompanhamento está pausado.', ...(hasConsentTab ? { goto: 'consentimentos', action: 'Ver consentimentos' } : {}) });
    } else if (health !== 'granted') {
      out.push({ icon: 'shield-check', tone: 'attention', text: 'Sem consentimento de saúde: o acompanhamento está pausado.', ...(hasConsentTab ? { goto: 'consentimentos', action: 'Registrar consentimento' } : {}) });
    } else if (this.role() !== 'partner') {
      const scale = this.directory.rows().find((r) => r.id === c.id)?.scale;
      if (scale?.kind === 'pending') {
        out.push({ icon: 'clock', tone: 'attention', text: this.role() === 'support' ? 'Aplicação da escala: pendente.' : 'Falta aplicar a escala de adesão ou a próxima aplicação está pendente.' });
      }
    }
    if (this.role() !== 'psychologist') {
      const planPending = this.subscriptions.current(c.id);
      const scheduled = planPending ? scheduledChangeOf(planPending) : null;
      if (scheduled) {
        out.push({ icon: 'info', tone: 'info', text: scheduled.label, goto: 'plano', action: 'Ver plano' });
      }
      this.dsr
        .forCaregiver(c.id)
        .filter((r) => r.status === 'open' || r.status === 'in_progress')
        .forEach((r) => {
          const deadline = this.dsr.deadline(r);
          out.push({ icon: 'shield-check', tone: 'attention', text: `Solicitação do titular ${r.protocol}: ${deadline.label.toLowerCase()}.` });
        });
    }
    if (c.status === 'closure_requested') {
      out.push({ icon: 'hourglass', tone: 'attention', text: `Encerramento pedido em ${formatDate(c.closureRequestedAt)}. A eliminação segue o POP-10.` });
    }
    if (this.canAssign() && !c.assignedPsychologistId && c.status !== 'closed') {
      out.push({ icon: 'triangle-alert', tone: 'attention', text: 'Falta atribuir o psicólogo responsável.' });
    }
    if (this.role() === 'support' && !c.assignedPsychologistId && c.status !== 'closed') {
      // CX-041: o atendimento não atribui, mas pede pelo sistema (o aviso chega ao responsável técnico).
      out.push(
        this.assignments.isRequested(c.id)
          ? { icon: 'hourglass', tone: 'info', text: 'O responsável técnico já foi avisado para atribuir o psicólogo.' }
          : { icon: 'triangle-alert', tone: 'attention', text: 'Falta o psicólogo responsável. O responsável técnico atribui.', run: 'request-assignment', action: 'Pedir atribuição de psicólogo' },
      );
    }
    return out;
  });

  protected requestAssignment(): void {
    const result = this.assignments.request(this.caregiver().id);
    if (!result.ok) {
      this.toasts.attention(result.reason);
      return;
    }
    this.toasts.success(
      result.alreadyAsked
        ? 'O responsável técnico já tinha sido avisado.'
        : 'Pedido enviado. O responsável técnico foi avisado e atribui o psicólogo.',
    );
  }

  protected onAssign(event: Event): void {
    const id = (event.target as HTMLSelectElement).value || null;
    const previous = this.service.assignPsychologist([this.caregiver().id], id);
    const name = id ? (this.db.psychologists.get(id)?.displayName ?? 'o psicólogo') : null;
    this.toasts.show({
      message: name ? `Psicólogo responsável: ${name}.` : 'Psicólogo responsável retirado.',
      action: { label: 'Desfazer', run: () => this.service.restoreAssignments(previous) },
    });
  }

  protected enroll(): void {
    try {
      this.service.enrollInPilot(this.caregiver().id);
      this.toasts.success('Cuidador marcado no piloto. As janelas de 3 e 6 meses foram criadas.');
    } catch (error) {
      this.toasts.attention(error instanceof CaregiverError ? error.message : 'Não foi possível marcar no piloto.');
    }
  }

  protected async leavePilot(): Promise<void> {
    await this.dialogs.confirm({
      title: `Retirar ${this.caregiver().code} do piloto?`,
      message: 'O cuidador deixa a coorte do piloto e continua com o plano e o acompanhamento normais.',
      effects: { keep: ['os dados já coletados, que seguem as regras de retenção', 'o consentimento do piloto, que só muda se ele for revogado'] },
      confirmLabel: 'Retirar do piloto',
      busyLabel: 'Retirando...',
      run: () => {
        this.service.leavePilot(this.caregiver().id);
        this.toasts.success('Cuidador retirado do piloto.');
      },
    });
  }
}
