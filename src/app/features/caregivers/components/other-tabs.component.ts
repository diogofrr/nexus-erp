import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuditLogService } from '@core/audit';
import { ACTION_LABELS, entityLabel } from '@core/audit/audit-labels';
import { AuthService } from '@core/auth';
import { SubscriptionService } from '@core/commerce/subscription.service';
import { Database } from '@core/data';
import { downloadTextFile } from '@core/export/file-download';
import { formatDate, formatDateTime } from '@core/format';
import type { Caregiver } from '@core/models';
import { ConsentService, DataSubjectRequestService } from '@core/privacy';
import { caregiverLabel } from '@core/privacy/caregiver-label';
import { SubjectExportService } from '@core/privacy/subject-export.service';
import { BadgeComponent, CardComponent, EmptyStateComponent, TimelineComponent, TimelineItem } from '@shared/ui';
import { ToastService } from '@shared/ui/overlay';
import { ConsentManagerComponent } from '@shared/ui/consent/consent-manager.component';
import { MODALITY_LABELS, SESSION_STATUS_LABELS } from '../state/caregiver-labels';

const REQUEST_STATUS: Record<string, string> = {
  requested: 'Solicitado',
  accepted: 'Aceito',
  refused_by_provider: 'Recusado pelo profissional',
  cancelled_by_provider: 'Cancelado pelo profissional',
  cancelled_by_user: 'Cancelado pelo cuidador',
  completed: 'Concluído',
  evaluated: 'Avaliado',
};

const MESSAGE_STATUS: Record<string, string> = { new: 'Nova', in_progress: 'Em andamento', answered: 'Respondida' };
const CHANNELS: Record<string, string> = { app: 'Aplicativo', whatsapp: 'WhatsApp', phone: 'Telefone', email: 'E-mail' };

/** Aba Atendimento (psicólogo do caso e responsável técnico): sessões do cuidador, sem anotação nem conteúdo clínico. */
@Component({
  selector: 'app-care-tab',
  imports: [BadgeComponent, CardComponent, EmptyStateComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-card title="Sessões" subtitle="Agenda do cuidador. As anotações ficam com o psicólogo autor." [padded]="false">
      <a appCardActions class="btn btn--sm" routerLink="/app/atendimento/agenda" [queryParams]="{ acao: 'agendar', cuidador: caregiver().id }">Agendar sessão</a>
      @if (sessions().length === 0) {
        <app-empty-state compact title="Nenhuma sessão ainda" text="Quando uma sessão for agendada, ela aparece aqui." />
      } @else {
        <div class="table-wrap table-wrap--flush">
          <table class="table table--stack">
            <caption class="sr-only">Sessões deste cuidador</caption>
            <thead><tr><th scope="col">Data e hora</th><th scope="col">Modalidade</th><th scope="col">Tipo</th><th scope="col">Situação</th><th scope="col"><span class="sr-only">Ação</span></th></tr></thead>
            <tbody>
              @for (s of sessions(); track s.id) {
                <tr>
                  <td data-label="Data e hora" class="col-primary">{{ at(s.startAt) }}</td>
                  <td data-label="Modalidade">{{ modality(s.modality) }}</td>
                  <td data-label="Tipo">{{ s.kind === 'psychotherapy' ? 'Psicoterapia' : 'Orientação psicológica' }}</td>
                  <td data-label="Situação"><app-badge [variant]="s.status === 'done' ? 'success' : s.status === 'no_show' ? 'danger' : 'info'" dot>{{ status(s.status) }}</app-badge></td>
                  <td data-label="Ação"><a class="btn btn--sm" [routerLink]="['/app/atendimento/sessoes', s.id]" [attr.aria-label]="'Abrir a sessão de ' + at(s.startAt)">Abrir</a></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </app-card>
  `,
})
export class CareTabComponent {
  private readonly db = inject(Database);
  readonly caregiver = input.required<Caregiver>();
  protected readonly sessions = computed(() => {
    this.db.careSessions.all();
    return this.db.careSessions
      .query((s) => s.caregiverId === this.caregiver().id)
      .sort((a, b) => b.startAt.localeCompare(a.startAt));
  });
  protected at(value: string): string {
    return formatDateTime(value);
  }
  protected modality(value: string): string {
    return MODALITY_LABELS[value] ?? value;
  }
  protected status(value: string): string {
    return SESSION_STATUS_LABELS[value] ?? value;
  }
}

/** Aba Consentimentos (SCR-M03-03 e SCR-M03-07): os seis consentimentos, a exportação do titular e o atalho para o canal do titular. */
@Component({
  selector: 'app-consents-tab',
  imports: [CardComponent, ConsentManagerComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack stack--6">
      <app-card title="Consentimentos" subtitle="Seis, independentes. Recusar um não muda os outros e o plano Livre continua.">
        <app-consent-manager [caregiverId]="caregiver().id" />
      </app-card>
      <app-card title="Direitos do titular">
        <div class="stack stack--3">
          @if (exportMode() !== 'none') {
            <p class="t-ui" data-role="export-note">
              Inclui apenas os dados de {{ label() }}.
              @if (exportMode() === 'sealed') {
                A parte clínica vai num pacote selado (simulado): este perfil dispara o arquivo e o entrega sem abrir.
              }
            </p>
          }
          <div class="cluster">
            @if (exportMode() !== 'none') {
              <button type="button" class="btn" (click)="exportSubject()">Exportar dados do titular (JSON)</button>
            }
            <a class="btn" routerLink="/app/lgpd/solicitacoes" [queryParams]="{ acao: 'nova', cuidador: caregiver().id }">Registrar solicitação do titular</a>
          </div>
        </div>
      </app-card>
    </div>
  `,
})
export class ConsentsTabComponent {
  private readonly auth = inject(AuthService);
  private readonly exporter = inject(SubjectExportService);
  private readonly doc = inject(DOCUMENT);
  private readonly toasts = inject(ToastService);

  readonly caregiver = input.required<Caregiver>();
  protected readonly exportMode = computed(() => this.exporter.modeFor(this.auth.role()));
  protected readonly label = computed(() => caregiverLabel(this.auth.role(), this.caregiver()).text);

  protected exportSubject(): void {
    try {
      const file = this.exporter.build(this.caregiver().id);
      const ok = downloadTextFile(this.doc, file.fileName, file.json, 'application/json');
      this.toasts.show({
        message: ok ? `Arquivo do titular gerado (${file.mode === 'sealed' ? 'pacote selado' : 'completo'}). O acesso foi registrado.` : 'Não foi possível baixar o arquivo neste navegador.',
        tone: ok ? 'success' : 'danger',
      });
    } catch {
      this.toasts.error('Este perfil não gera o arquivo do titular.');
    }
  }
}

/** Aba Comunicação: pedidos de serviço à rede e mensagens do cuidador. O responsável técnico só lê os casos de risco. */
@Component({
  selector: 'app-communication-tab',
  imports: [BadgeComponent, CardComponent, EmptyStateComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack stack--6">
      <app-card title="Pedidos de serviço" subtitle="Serviços da rede pedidos por este cuidador" [padded]="false">
        @if (requests().length === 0) {
          <app-empty-state compact title="Nenhum pedido de serviço" text="Quando o cuidador pedir um serviço da rede, ele aparece aqui." />
        } @else {
          <div class="table-wrap table-wrap--flush">
            <table class="table table--stack">
              <caption class="sr-only">Pedidos de serviço do cuidador</caption>
              <thead><tr><th scope="col">Pedido em</th><th scope="col">Profissional</th><th scope="col">Necessidade</th><th scope="col">Situação</th></tr></thead>
              <tbody>
                @for (r of requests(); track r.id) {
                  <tr>
                    <td data-label="Pedido em">{{ at(r.requestedAt) }}</td>
                    <td data-label="Profissional" class="col-primary">{{ providerName(r.providerId) }}</td>
                    <td data-label="Necessidade">{{ r.need }}</td>
                    <td data-label="Situação"><app-badge dot>{{ requestStatus(r.status) }}</app-badge></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </app-card>
      <app-card title="Mensagens" [subtitle]="role() === 'technical_lead' ? 'Só os casos sinalizados como risco' : 'Mensagens deste cuidador'" [padded]="false">
        @if (canOpenInbox()) {
          <a appCardActions class="btn btn--sm" routerLink="/app/mensagens">Abrir a caixa de mensagens</a>
        }
        @if (messages().length === 0) {
          <app-empty-state compact title="Nenhuma mensagem" text="Quando o cuidador escrever, a conversa aparece aqui com o prazo de resposta." />
        } @else {
          <div class="table-wrap table-wrap--flush">
            <table class="table table--stack">
              <caption class="sr-only">Mensagens do cuidador</caption>
              <thead><tr><th scope="col">Recebida em</th><th scope="col">Canal</th><th scope="col">Assunto</th><th scope="col">Situação</th></tr></thead>
              <tbody>
                @for (m of messages(); track m.id) {
                  <tr>
                    <td data-label="Recebida em">{{ at(m.receivedAt) }}</td>
                    <td data-label="Canal">{{ channel(m.channel) }}</td>
                    <td data-label="Assunto" class="col-primary">{{ m.subject || 'Sem assunto' }}</td>
                    <td data-label="Situação"><app-badge [variant]="m.status === 'answered' ? 'success' : 'attention'" dot>{{ messageStatus(m.status) }}</app-badge></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </app-card>
    </div>
  `,
})
export class CommunicationTabComponent {
  private readonly db = inject(Database);
  private readonly auth = inject(AuthService);
  readonly caregiver = input.required<Caregiver>();
  protected readonly role = this.auth.role;
  protected readonly canOpenInbox = computed(() => this.auth.can('message_inbox', 'view'));
  protected readonly requests = computed(() => {
    this.db.serviceRequests.all();
    return this.db.serviceRequests
      .query((r) => r.caregiverId === this.caregiver().id)
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  });
  protected readonly messages = computed(() => {
    this.db.messages.all();
    const onlyRisk = this.auth.role() === 'technical_lead';
    return this.db.messages
      .query((m) => m.caregiverId === this.caregiver().id && (!onlyRisk || m.riskFlag === true))
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  });
  protected at(value: string): string {
    return formatDateTime(value);
  }
  protected providerName(id: string): string {
    return this.db.providers.get(id)?.name ?? 'Profissional da rede';
  }
  protected requestStatus(value: string): string {
    return REQUEST_STATUS[value] ?? value;
  }
  protected messageStatus(value: string): string {
    return MESSAGE_STATUS[value] ?? value;
  }
  protected channel(value: string): string {
    return CHANNELS[value] ?? value;
  }
}

/** Aba Histórico: linha do tempo do cadastro e, para a gestão e o responsável técnico, os acessos ao cadastro (log). */
@Component({
  selector: 'app-history-tab',
  imports: [BadgeComponent, CardComponent, TimelineComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack stack--6">
      <app-card title="Linha do tempo" subtitle="O registro não se edita nem se apaga">
        <app-timeline label="Histórico do cadastro" [items]="timeline()" />
      </app-card>
      @if (canSeeLog()) {
        <app-card title="Acessos a este cadastro" subtitle="Quem consultou, mostrou ou alterou dados deste titular" [padded]="false">
          @if (accesses().length === 0) {
            <p class="card__body t-muted">Nenhum acesso registrado.</p>
          } @else {
            <div class="table-wrap table-wrap--flush">
              <table class="table table--stack" data-density="compact">
                <caption class="sr-only">Acessos ao cadastro deste cuidador</caption>
                <thead><tr><th scope="col">Quando</th><th scope="col">Quem</th><th scope="col">Ação</th><th scope="col">O quê</th></tr></thead>
                <tbody>
                  @for (e of accesses(); track e.id) {
                    <tr>
                      <td data-label="Quando">{{ at(e.at) }}</td>
                      <td data-label="Quem">{{ user(e.userId) }}</td>
                      <td data-label="Ação"><app-badge dot>{{ action(e.action) }}</app-badge></td>
                      <td data-label="O quê">{{ entity(e.entity) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </app-card>
      }
    </div>
  `,
})
export class HistoryTabComponent {
  private readonly db = inject(Database);
  private readonly auth = inject(AuthService);
  private readonly audit = inject(AuditLogService);
  private readonly consent = inject(ConsentService);
  private readonly dsr = inject(DataSubjectRequestService);
  private readonly subscriptions = inject(SubscriptionService);

  readonly caregiver = input.required<Caregiver>();
  protected readonly canSeeLog = computed(() => this.auth.can('lgpd_audit_log', 'view'));
  protected readonly accesses = computed(() => {
    this.db.accessLog.all();
    return this.audit.query({ subjectCaregiverId: this.caregiver().id }).slice(0, 30);
  });

  protected readonly timeline = computed<TimelineItem[]>(() => {
    const cg = this.caregiver();
    const role = this.auth.role();
    const items: (TimelineItem & { sort: string })[] = [];
    const push = (sort: string, item: TimelineItem): void => {
      items.push({ ...item, sort });
    };
    push(cg.createdAt, { id: 'created', title: 'Cadastro criado', at: cg.createdAt, text: `Adesão em ${formatDate(cg.enrolledAt)}.`, tone: 'done' });
    if (cg.closureRequestedAt) {
      push(`${cg.closureRequestedAt}T12:00:00-03:00`, { id: 'closure', title: 'Encerramento do cadastro pedido', timeLabel: formatDate(cg.closureRequestedAt), tone: 'attention' });
    }
    if (role !== 'psychologist') {
      const sub = this.subscriptions.current(cg.id);
      if (sub) {
        this.subscriptions.historyOf(sub.id).forEach((c) =>
          push(`${c.effectiveAt}T12:00:00-03:00`, {
            id: c.id,
            title: c.kind === 'upgrade' ? 'Upgrade de plano' : c.kind === 'cancel' ? 'Cancelamento do plano' : c.kind === 'downgrade' ? 'Mudança de plano' : 'Plano mantido',
            timeLabel: formatDate(c.effectiveAt),
            tone: c.kind === 'upgrade' ? 'done' : 'default',
          }),
        );
      }
      this.dsr.forCaregiver(cg.id).forEach((r) =>
        push(`${r.openedAt}T09:00:00-03:00`, { id: r.id, title: `Solicitação do titular ${r.protocol}`, timeLabel: formatDate(r.openedAt), text: r.status === 'completed' ? 'Concluída.' : r.status === 'rejected_with_reason' ? 'Rejeitada com motivo.' : 'Em aberto.' }),
      );
      this.consent.history(cg.id).forEach((e) =>
        push(e.at, { id: e.id, title: e.status === 'granted' ? 'Consentimento concedido' : e.status === 'refused' ? 'Consentimento recusado' : 'Consentimento revogado', at: e.at, tone: e.status === 'revoked' ? 'danger' : 'default', text: `Termo v${e.termVersion}.` }),
      );
    }
    if (role === 'psychologist') {
      this.db.zaritAssessments
        .query((a) => a.caregiverId === cg.id && a.status === 'completed' && !!a.appliedAt)
        .forEach((a) => push(`${a.appliedAt}T12:00:00-03:00`, { id: a.id, title: 'Escala aplicada', timeLabel: formatDate(a.appliedAt) }));
    }
    return items.sort((a, b) => b.sort.localeCompare(a.sort)).map(({ sort: _sort, ...item }) => item);
  });

  protected at(value: string): string {
    return formatDateTime(value);
  }
  protected user(id: string): string {
    return this.db.users.get(id)?.displayName ?? 'Usuário';
  }
  protected action(value: keyof typeof ACTION_LABELS): string {
    return ACTION_LABELS[value];
  }
  protected entity(value: string): string {
    return entityLabel(value);
  }
}
