import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { AuditLogService } from '@core/audit';
import { AuthService } from '@core/auth';
import { Clock } from '@core/clock';
import { Database } from '@core/data';
import { downloadTextFile } from '@core/export/file-download';
import { formatDate } from '@core/format';
import type { Caregiver, ConsentKey } from '@core/models';
import { ConsentError, ConsentService, DataSubjectRequestError, DataSubjectRequestService, RetentionService, erasurePlanFor, maskEmail, maskPhone } from '@core/privacy';
import { canSeeCaregiverIdentity, caregiverLabel } from '@core/privacy/caregiver-label';
import { SubjectExportService } from '@core/privacy/subject-export.service';
import { CONSENT_LABELS, DSR_TYPE_LABELS, validateFictitiousEmail, validateFictitiousPhone } from '@core/rules';
import { BadgeComponent, CardComponent, EmptyStateComponent, ERROR_MESSAGES, FormFieldComponent, NxInputDirective, PageHeaderComponent } from '@shared/ui';
import { BannerComponent, DialogService, PageContextService, ToastService } from '@shared/ui/overlay';
import { LgpdNavComponent } from '../components/lgpd-nav.component';
import { DEADLINE_BADGES, DSR_STATUS_BADGES, DSR_STATUS_LABELS, DSR_TYPE_DESCRIPTIONS } from '../state/privacy-labels';

export type CorrectionField = 'fullName' | 'email' | 'phone' | 'whatsapp' | 'city';

/**
 * Qual dado o pedido de correção cita (CX-037): só devolve um campo quando o texto aponta UM dado, para o
 * atendimento não corrigir o campo errado. Sem pista clara, devolve `null` e a pessoa escolhe.
 */
export function inferCorrectionField(description: string | undefined): CorrectionField | null {
  const text = (description ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const hits: CorrectionField[] = [];
  if (/\b(nome|sobrenome)\b/.test(text)) {
    hits.push('fullName');
  }
  if (/e-?mail/.test(text)) {
    hits.push('email');
  }
  if (/whats/.test(text)) {
    hits.push('whatsapp');
  }
  if (/\b(telefone|celular|fone)\b/.test(text)) {
    hits.push('phone');
  }
  if (/\b(cidade|municipio)\b/.test(text)) {
    hits.push('city');
  }
  return hits.length === 1 ? (hits[0] ?? null) : null;
}

const CORRECTION_LABELS: Record<CorrectionField, string> = {
  fullName: 'Nome completo',
  email: 'E-mail',
  phone: 'Telefone',
  whatsapp: 'WhatsApp',
  city: 'Cidade',
};

/**
 * SCR-M12-04 Solicitação do titular (F12): resumo à esquerda e as ações do tipo à direita. As ações
 * irreversíveis (anonimizar, eliminar) são da gestão e do responsável técnico e pedem para digitar o
 * código do titular; o atendimento vê "Registrado. Um sócio ou o responsável técnico executa esta etapa".
 * Rejeitar exige motivo escrito; concluir exige nota de resolução e gera a resposta em bloco copiável.
 */
@Component({
  selector: 'app-request-detail-page',
  imports: [
    BadgeComponent,
    BannerComponent,
    CardComponent,
    EmptyStateComponent,
    FormFieldComponent,
    LgpdNavComponent,
    NxInputDirective,
    PageHeaderComponent,
    ReactiveFormsModule,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      @if (request(); as r) {
        <app-page-header [title]="r.protocol" [description]="typeLabel()">
          <a class="btn" routerLink="/app/lgpd/solicitacoes">Voltar para as solicitações</a>
        </app-page-header>
        <app-lgpd-nav />
        @if (r.status === 'rejected_with_reason') {
          <app-banner variant="attention" heading="Solicitação rejeitada com motivo">{{ r.rejectedReason }}</app-banner>
        }
        <div class="layout-main-aside">
          <div class="stack stack--6">
            <app-card title="Resumo do pedido" [subtitle]="typeHint()">
              <dl class="dl">
                <dt>Titular</dt>
                <dd>
                  <span [class.discreet]="!label().pseudonymized">{{ label().text }}</span>
                  @if (!label().pseudonymized) { <span class="code-chip">{{ label().code }}</span> }
                </dd>
                <dt>Tipo</dt><dd>{{ typeLabel() }}</dd>
                <dt>Canal</dt><dd>{{ channelLabel() }}</dd>
                <dt>Aberta em</dt><dd>{{ date(r.openedAt) }}</dd>
                <dt>Prazo</dt>
                <dd><app-badge [variant]="deadlineBadge().variant" [icon]="deadlineBadge().icon">{{ deadline().label }}</app-badge> <span class="t-caption">até {{ date(r.dueAt) }}</span></dd>
                <dt>Situação</dt>
                <dd><app-badge [variant]="statusBadge().variant" [icon]="statusBadge().icon">{{ statusLabel() }}</app-badge></dd>
                @if (handler()) { <dt>Atendida por</dt><dd>{{ handler() }}</dd> }
                @if (r.description) { <dt>O que o titular pediu</dt><dd>{{ r.description }}</dd> }
                @if (r.resolutionNote) { <dt>Nota de resolução</dt><dd>{{ r.resolutionNote }}</dd> }
                @if (r.retentionBlockNote) { <dt>Retenção</dt><dd>{{ r.retentionBlockNote }}</dd> }
              </dl>
            </app-card>

            @if (corrections().length > 0) {
              <app-card title="Correções feitas" subtitle="Com o valor anterior em histórico">
                <ul class="stack stack--3 list-reset">
                  @for (c of corrections(); track $index) {
                    <li><strong>{{ c.field }}</strong>: de <span class="discreet">{{ c.previous }}</span> para <span class="discreet">{{ c.next }}</span> <span class="t-caption">({{ date(c.at) }})</span></li>
                  }
                </ul>
              </app-card>
            }

            @if (r.type === 'access' && showView() && summary(); as s) {
              <app-card title="Visão do titular" subtitle="Para conferir e imprimir. Sem conteúdo clínico.">
                <dl class="dl" data-role="subject-view">
                  <dt>Cadastro</dt><dd>{{ s.status }}, desde {{ date(s.enrolledAt) }}</dd>
                  <dt>E-mail</dt><dd>{{ s.email }}</dd>
                  <dt>Telefone</dt><dd>{{ s.phone }}</dd>
                  <dt>Plano</dt><dd>{{ s.plan }}</dd>
                  <dt>Consentimentos</dt><dd>{{ s.consents }}</dd>
                  <dt>Sessões</dt><dd>{{ s.sessions }}</dd>
                  <dt>Mensagens</dt><dd>{{ s.messages }}</dd>
                </dl>
                <div class="mt-3"><button type="button" class="btn btn--sm" (click)="printView()">Imprimir a visão do titular</button></div>
              </app-card>
            }

            @if (reply()) {
              <app-card title="Resposta ao titular" subtitle="Texto pronto para copiar">
                <div class="stack stack--3">
                  <textarea class="textarea" rows="7" readonly aria-label="Texto da resposta ao titular" [value]="reply()"></textarea>
                  <div><button type="button" class="btn" (click)="copyReply()">Copiar texto</button></div>
                </div>
              </app-card>
            }
          </div>

          <aside class="stack stack--6" aria-label="Ações da solicitação">
            @if (isClosed()) {
              <app-card title="Solicitação encerrada">
                <div class="stack stack--3">
                  <p>{{ r.status === 'completed' ? 'Esta solicitação foi concluída' + (r.completedAt ? ' em ' + date(r.completedAt) : '') + '.' : 'Esta solicitação foi rejeitada com motivo.' }}</p>
                  @if (r.status === 'completed' && (r.type === 'portability' || r.type === 'access')) {
                    <p class="t-ui">{{ exportNote() }}</p>
                    <div><button type="button" class="btn" (click)="exportFile(false)">Baixar o arquivo do titular (JSON)</button></div>
                  }
                </div>
              </app-card>
            } @else {
              <app-card title="Tratar a solicitação">
                <div class="stack stack--6">
                  @if (r.status === 'open') {
                    <div><button type="button" class="btn" (click)="start()">Começar a tratar</button></div>
                  }

                  @switch (r.type) {
                    @case ('access') {
                      <section class="stack stack--3" aria-label="Acesso">
                        <p class="t-ui">{{ exportNote() }}</p>
                        <div class="cluster">
                          @if (identified()) { <button type="button" class="btn" (click)="showView.set(true)">Gerar visão do titular</button> }
                          <button type="button" class="btn" (click)="exportFile(false)">Baixar o arquivo do titular (JSON)</button>
                        </div>
                      </section>
                    }
                    @case ('portability') {
                      <section class="stack stack--3" aria-label="Portabilidade">
                        <p class="t-ui">{{ exportNote() }}</p>
                        <div><button type="button" class="btn btn--primary" (click)="exportFile(true)">Gerar o arquivo e concluir</button></div>
                      </section>
                    }
                    @case ('correction') {
                      <section class="stack stack--3" aria-label="Correção">
                        @if (identified()) {
                          <app-form-field label="Dado a corrigir" [hint]="fixHint()" controlId="nx-fix-field" [error]="fixFieldError()">
                            <select appInput [formControl]="fixField">
                              <option [ngValue]="null">Escolha o dado a corrigir</option>
                              @for (f of correctionFields; track f.value) { <option [ngValue]="f.value">{{ f.label }}</option> }
                            </select>
                          </app-form-field>
                          <app-form-field label="Valor novo" [hint]="'Valor atual: ' + currentValue()" controlId="nx-fix-value" [error]="fixError()">
                            <input appInput [formControl]="fixValue" autocomplete="off" />
                          </app-form-field>
                          <p class="t-caption">Aplicações da escala já assinadas só recebem adendo, na tela de acompanhamento.</p>
                          <div><button type="button" class="btn btn--primary" (click)="correct()">Registrar correção</button></div>
                        } @else if (waitingForSupport()) {
                          <p class="t-ui" data-role="waiting-support">
                            <strong>Aguardando o atendimento.</strong>
                            {{ handler() ? handler() + ' está com este pedido e faz' : 'O atendimento faz' }} a correção, porque só quem vê o dado confere o valor novo. O histórico guarda o valor anterior. Quando a correção estiver registrada, você conclui o pedido por aqui.
                          </p>
                        } @else {
                          <p class="t-ui" data-role="support-done">O atendimento registrou a correção, com o valor anterior no histórico. Falta só você concluir o pedido.</p>
                        }
                      </section>
                    }
                    @case ('anonymization_or_blocking') {
                      <section class="stack stack--3" aria-label="Anonimização">
                        @if (canExecute()) {
                          <p class="t-ui">Os identificadores viram o código do titular. As contagens continuam nos indicadores. Não dá para desfazer.</p>
                          <div><button type="button" class="btn btn--danger" (click)="anonymize()">Anonimizar dados</button></div>
                        } @else {
                          <p class="t-ui">Registrado. Um sócio ou o responsável técnico executa esta etapa.</p>
                        }
                      </section>
                    }
                    @case ('erasure') {
                      <section class="stack stack--3" aria-label="Eliminação">
                        @if (canExecute()) {
                          <p class="t-ui">Apaga o que não é registro documental e bloqueia o que é, pelo prazo da retenção.</p>
                          <div><button type="button" class="btn btn--danger" (click)="erase()">Eliminar o que pode ser eliminado</button></div>
                        } @else {
                          <p class="t-ui">Registrado. Um sócio ou o responsável técnico executa esta etapa.</p>
                        }
                      </section>
                    }
                    @case ('consent_revocation') {
                      <section class="stack stack--3" aria-label="Revogação">
                        @if (grantedKeys().length > 0) {
                          <app-form-field label="Consentimento a retirar" controlId="nx-revoke-key">
                            <select appInput [formControl]="revokeKey">
                              <option [ngValue]="null">Escolha o consentimento</option>
                              @for (k of grantedKeys(); track k) { <option [ngValue]="k">{{ consentLabel(k) }}</option> }
                            </select>
                          </app-form-field>
                          @if (revokeError()) { <span class="field__error" role="alert"><span class="sr-only">Erro: </span>{{ revokeError() }}</span> }
                          <div><button type="button" class="btn btn--danger" (click)="revoke()">Registrar revogação</button></div>
                        } @else {
                          <p class="t-ui">Este titular não tem consentimento ativo para retirar. Conclua ou rejeite a solicitação.</p>
                        }
                      </section>
                    }
                    @case ('sharing_info') {
                      <section class="stack stack--3" aria-label="Compartilhamento">
                        <p class="t-ui">Quem recebeu dados deste titular (visão somente leitura):</p>
                        @if (recipients().length === 0) {
                          <p class="t-muted">Nenhum dado foi compartilhado com prestadores nem com empresas.</p>
                        } @else {
                          <ul class="stack stack--2">
                            @for (x of recipients(); track x) { <li>{{ x }}</li> }
                          </ul>
                        }
                      </section>
                    }
                    @case ('decision_review') {
                      <section class="stack stack--3" aria-label="Revisão de decisão">
                        @if (reviewOpened()) {
                          <p class="t-ui" role="status">O pedido de revisão já foi aberto ao psicólogo do caso, com prazo até {{ date(r.dueAt) }}.</p>
                        } @else if (psychologist()) {
                          <p class="t-ui">O pedido vai ao psicólogo do caso, {{ psychologist() }}, com o prazo da solicitação.</p>
                          <div><button type="button" class="btn btn--primary" (click)="openReview()">Abrir pedido de revisão ao psicólogo</button></div>
                        } @else {
                          <p class="t-ui">Este titular ainda não tem psicólogo responsável. O responsável técnico atribui um na ficha do cuidador.</p>
                        }
                      </section>
                    }
                  }

                  @if (showConclude()) {
                    <section class="stack stack--3" aria-label="Concluir">
                      <app-form-field label="Nota de resolução" hint="O que foi feito, em palavras simples." controlId="nx-dsr-note" [error]="noteError()">
                        <textarea appInput rows="3" [formControl]="note"></textarea>
                      </app-form-field>
                      <div><button type="button" class="btn btn--primary" (click)="complete()">Concluir solicitação</button></div>
                    </section>
                  }

                  <section class="stack stack--3" aria-label="Rejeitar">
                    <app-form-field label="Motivo da rejeição" hint="Obrigatório para rejeitar." controlId="nx-dsr-reject" [error]="rejectError()">
                      <textarea appInput rows="2" [formControl]="rejectReason"></textarea>
                    </app-form-field>
                    <div><button type="button" class="btn" (click)="reject()">Rejeitar solicitação</button></div>
                  </section>
                </div>
              </app-card>
            }
          </aside>
        </div>
      } @else {
        <app-empty-state kind="error" title="Solicitação não encontrada" text="Confira o endereço ou volte à lista de solicitações.">
          <a class="btn" routerLink="/app/lgpd/solicitacoes">Voltar para as solicitações</a>
        </app-empty-state>
      }
    </div>
  `,
})
export class RequestDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly db = inject(Database);
  private readonly auth = inject(AuthService);
  private readonly clock = inject(Clock);
  private readonly audit = inject(AuditLogService);
  private readonly service = inject(DataSubjectRequestService);
  private readonly consent = inject(ConsentService);
  private readonly retention = inject(RetentionService);
  private readonly exporter = inject(SubjectExportService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly page = inject(PageContextService);
  private readonly doc = inject(DOCUMENT);
  private readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), { initialValue: '' });

  protected readonly correctionFields = (Object.keys(CORRECTION_LABELS) as CorrectionField[]).map((value) => ({ value, label: CORRECTION_LABELS[value] }));
  protected readonly showView = signal(false);
  protected readonly note = new FormControl('', { nonNullable: true });
  protected readonly rejectReason = new FormControl('', { nonNullable: true });
  protected readonly fixField = new FormControl<CorrectionField | null>(null);
  protected readonly fixValue = new FormControl('', { nonNullable: true });
  protected readonly revokeKey = new FormControl<ConsentKey | null>(null);
  protected readonly noteError = signal<string | null>(null);
  protected readonly rejectError = signal<string | null>(null);
  protected readonly fixError = signal<string | null>(null);
  protected readonly fixFieldError = signal<string | null>(null);
  protected readonly revokeError = signal<string | null>(null);
  private readonly fixFieldValue = signal<CorrectionField | null>(null);
  /** O campo que o pedido cita, quando é um só (CX-037). */
  private readonly suggestedField = computed(() => inferCorrectionField(this.request()?.description));
  protected readonly fixHint = computed(() => {
    const field = this.suggestedField();
    return field && this.fixFieldValue() === field
      ? `O pedido cita: ${CORRECTION_LABELS[field].toLowerCase()}. Confira antes de corrigir.`
      : 'Escolha o dado que o titular pediu para corrigir.';
  });

  protected readonly request = computed(() => {
    this.db.dataSubjectRequests.all();
    return this.db.dataSubjectRequests.get(this.id());
  });
  protected readonly caregiver = computed<Caregiver | undefined>(() => {
    const r = this.request();
    this.db.caregivers.all();
    return r ? this.db.caregivers.get(r.caregiverId) : undefined;
  });
  protected readonly label = computed(() => {
    const cg = this.caregiver();
    return cg ? caregiverLabel(this.auth.role(), cg) : { text: 'Titular', code: '', pseudonymized: true };
  });
  protected readonly identified = computed(() => canSeeCaregiverIdentity(this.auth.role()));
  protected readonly canExecute = computed(() => this.auth.role() === 'partner' || this.auth.role() === 'technical_lead');
  protected readonly isClosed = computed(() => {
    const s = this.request()?.status;
    return s === 'completed' || s === 'rejected_with_reason';
  });
  protected readonly showConclude = computed(() => {
    const t = this.request()?.type;
    if (t === 'erasure' || t === 'anonymization_or_blocking' || t === 'consent_revocation' || t === 'portability') {
      return false;
    }
    // CX-002: quem não vê o dado só encerra a correção depois que o atendimento a registrou.
    return !this.waitingForSupport();
  });
  /** Correção que só o atendimento pode fazer e ainda não foi feita (a gestão não vê o dado). */
  protected readonly waitingForSupport = computed(() => {
    const r = this.request();
    return r?.type === 'correction' && !this.identified() && (r.corrections?.length ?? 0) === 0;
  });
  protected readonly typeLabel = computed(() => DSR_TYPE_LABELS[this.request()?.type ?? 'access']);
  protected readonly typeHint = computed(() => DSR_TYPE_DESCRIPTIONS[this.request()?.type ?? 'access']);
  protected readonly statusLabel = computed(() => DSR_STATUS_LABELS[this.request()?.status ?? 'open']);
  protected readonly statusBadge = computed(() => DSR_STATUS_BADGES[this.request()?.status ?? 'open']);
  protected readonly deadline = computed(() => {
    const r = this.request();
    return r ? this.service.deadline(r) : { state: 'on_time' as const, daysRemaining: 0, label: '' };
  });
  protected readonly deadlineBadge = computed(() => DEADLINE_BADGES[this.deadline().state]);
  protected readonly handler = computed(() => {
    const id = this.request()?.handledByUserId;
    return id ? this.db.users.get(id)?.displayName : undefined;
  });
  protected readonly channelLabel = computed(
    () => ({ in_person: 'Presencial', phone: 'Telefone', whatsapp: 'WhatsApp', app: 'Aplicativo', email: 'E-mail' })[this.request()?.channel ?? 'in_person'] ?? 'Presencial',
  );
  protected readonly corrections = computed(() => (this.identified() ? (this.request()?.corrections ?? []) : []));
  protected readonly exportNote = computed(() => {
    const mode = this.exporter.modeFor(this.auth.role());
    return mode === 'sealed'
      ? 'O arquivo inclui apenas os dados deste titular. A parte clínica vai num pacote selado (simulado): este perfil dispara o arquivo e o entrega sem abrir.'
      : 'O arquivo inclui apenas os dados deste titular, com o conteúdo clínico, e o acesso fica registrado no log.';
  });
  protected readonly grantedKeys = computed<ConsentKey[]>(() => {
    const cg = this.caregiver();
    this.db.consents.all();
    return cg ? this.consent.list(cg.id).filter((c) => c.status === 'granted').map((c) => c.key) : [];
  });
  protected readonly psychologist = computed(() => {
    const id = this.caregiver()?.assignedPsychologistId;
    return id ? this.db.psychologists.get(id)?.displayName : undefined;
  });
  protected readonly reviewOpened = computed(() => {
    const r = this.request();
    this.db.reviewRequests.all();
    return !!r && this.db.reviewRequests.count((x) => x.caregiverId === r.caregiverId && x.text.startsWith(r.protocol)) > 0;
  });
  protected readonly recipients = computed(() => {
    const cg = this.caregiver();
    if (!cg) {
      return [];
    }
    this.db.serviceRequests.all();
    const providers = [
      ...new Set(
        this.db.serviceRequests
          .query((s) => s.caregiverId === cg.id && ['accepted', 'completed', 'evaluated'].includes(s.status))
          .map((s) => this.db.providers.get(s.providerId)?.name)
          .filter((n): n is string => !!n),
      ),
    ].map((n) => `Prestador da rede: ${n}`);
    const company = cg.corporateAccountId ? this.db.corporateAccounts.get(cg.corporateAccountId)?.companyName : undefined;
    return [...providers, ...(company ? [`Empresa contratante: ${company} (só agregados de adesão)`] : [])];
  });
  protected readonly currentValue = computed(() => {
    const cg = this.caregiver();
    const field = this.fixFieldValue();
    return cg && field ? ((cg[field] as string | undefined) ?? 'não informado') : '';
  });
  protected readonly summary = computed(() => {
    const cg = this.caregiver();
    if (!cg || !this.identified()) {
      return null;
    }
    const states = this.consent.list(cg.id).map((c) => `${CONSENT_LABELS[c.key]}: ${c.status === 'granted' ? 'ativo' : c.status === 'refused' ? 'recusado' : c.status === 'revoked' ? 'revogado' : 'pendente'}`);
    return {
      status: cg.status === 'active' ? 'Ativo' : cg.status === 'closed' ? 'Encerrado' : cg.status === 'closure_requested' ? 'Encerramento pedido' : 'Pausado',
      enrolledAt: cg.enrolledAt,
      email: maskEmail(cg.email),
      phone: maskPhone(cg.phone),
      plan: this.db.plans.get(this.db.subscriptions.find((s) => s.caregiverId === cg.id)?.planId ?? 'livre')?.name ?? 'Nexus Livre',
      consents: states.join('; '),
      sessions: `${this.db.careSessions.count((s) => s.caregiverId === cg.id)} registradas`,
      messages: `${this.db.messages.count((m) => m.caregiverId === cg.id)} registradas`,
    };
  });
  protected readonly reply = computed(() => {
    const r = this.request();
    if (!r || !this.isClosed()) {
      return '';
    }
    const policy = this.db.privacyDocuments.find((d) => d.kind === 'privacy_policy');
    const contact = policy ? ` Se tiver dúvidas, fale com ${policy.dpoName} (fictícia), pelo canal ${policy.dpoEmail}.` : '';
    if (r.status === 'rejected_with_reason') {
      return `Olá. Analisamos a sua solicitação ${r.protocol} (${DSR_TYPE_LABELS[r.type]}) e não conseguimos atendê-la. Motivo: ${r.rejectedReason ?? ''}${contact}`;
    }
    return `Olá. Sua solicitação ${r.protocol} (${DSR_TYPE_LABELS[r.type]}) foi concluída em ${formatDate(r.completedAt)}. ${r.resolutionNote ?? ''}${r.retentionBlockNote ? ` ${r.retentionBlockNote}` : ''}${contact}`.replace(/\s+/g, ' ').trim();
  });

  constructor() {
    this.fixField.valueChanges.subscribe((v) => {
      this.fixFieldValue.set(v);
      this.fixFieldError.set(null);
    });
    // CX-037: o campo a corrigir já vem do pedido (quando ele cita um só); sem pista, a pessoa escolhe.
    effect(() => {
      const suggested = this.suggestedField();
      untracked(() => {
        if (suggested && this.fixField.value === null) {
          this.fixField.setValue(suggested);
        }
      });
    });
    effect(() => {
      const r = this.request();
      if (!r) {
        return;
      }
      untracked(() =>
        this.page.setCrumbs([
          { label: 'Privacidade (LGPD)', link: '/app/lgpd/consentimentos' },
          { label: 'Solicitações do titular', link: '/app/lgpd/solicitacoes' },
          { label: r.protocol },
        ]),
      );
    });
  }

  protected date(value: string | undefined): string {
    return formatDate(value);
  }

  protected consentLabel(key: ConsentKey): string {
    return CONSENT_LABELS[key];
  }

  private fail(error: unknown): void {
    this.toasts.error(
      error instanceof DataSubjectRequestError || error instanceof ConsentError
        ? error.message
        : 'Não foi possível salvar. Tente de novo; se continuar, avise a equipe.',
    );
  }

  // ===== Ações =====

  protected start(): void {
    try {
      this.service.start(this.id());
      this.toasts.success('Solicitação em andamento.');
    } catch (error) {
      this.fail(error);
    }
  }

  protected exportFile(complete: boolean): void {
    const r = this.request();
    if (!r) {
      return;
    }
    try {
      const file = this.exporter.build(r.caregiverId, `Atender a solicitação ${r.protocol}`);
      const ok = downloadTextFile(this.doc, file.fileName, file.json, 'application/json');
      if (!ok) {
        this.toasts.error('Não foi possível baixar o arquivo neste navegador.');
        return;
      }
      if (complete) {
        this.service.complete(r.id, 'Arquivo JSON do titular gerado e entregue.');
      }
      this.toasts.success(`Arquivo do titular gerado (${file.mode === 'sealed' ? 'pacote selado' : 'completo'}). O acesso foi registrado.`);
    } catch (error) {
      this.fail(error);
    }
  }

  protected printView(): void {
    const r = this.request();
    this.audit.printed('subject_view', r?.id, r?.caregiverId);
    this.doc.defaultView?.print();
  }

  protected correct(): void {
    const r = this.request();
    const cg = this.caregiver();
    if (!r || !cg) {
      return;
    }
    const field = this.fixField.value;
    const value = this.fixValue.value.trim();
    this.fixError.set(null);
    this.fixFieldError.set(null);
    if (!field) {
      this.fixFieldError.set('Escolha o dado a corrigir.');
      return;
    }
    const invalid =
      value === ''
        ? 'Informe o valor novo.'
        : field === 'email'
          ? (() => { const v = validateFictitiousEmail(value); return v.valid ? null : v.code === 'email_format' ? ERROR_MESSAGES.emailShape : ERROR_MESSAGES.email; })()
          : field === 'phone' || field === 'whatsapp'
            ? (validateFictitiousPhone(value).valid ? null : ERROR_MESSAGES.phone)
            : null;
    if (invalid) {
      this.fixError.set(invalid);
      return;
    }
    const previous = (cg[field] as string | undefined) ?? '';
    if (previous === value) {
      this.fixError.set('O valor novo é igual ao atual.');
      return;
    }
    this.db.caregivers.update(cg.id, { [field]: value });
    this.db.dataSubjectRequests.update(r.id, {
      status: r.status === 'open' ? 'in_progress' : r.status,
      corrections: [
        ...(r.corrections ?? []),
        { at: this.clock.now(), field: CORRECTION_LABELS[field], previous, next: value, byUserId: this.auth.user()?.id ?? 'system' },
      ],
    });
    this.audit.write('update', 'caregiver', cg.id, cg.id, `correção a pedido do titular: ${CORRECTION_LABELS[field]}`);
    this.fixValue.setValue('');
    this.toasts.success(`${CORRECTION_LABELS[field]} corrigido. O valor anterior ficou no histórico.`);
  }

  protected async anonymize(): Promise<void> {
    const r = this.request();
    const cg = this.caregiver();
    if (!r || !cg) {
      return;
    }
    const whose = this.label().pseudonymized ? 'do titular' : `de ${this.label().text}`;
    await this.dialogs.confirm({
      level: 3,
      title: `Anonimizar os dados de ${cg.code}?`,
      message: `Nome, CPF, e-mail e telefone ${whose} viram o código ${cg.code}. As contagens continuam nos indicadores.`,
      effects: {
        erase: ['nome, CPF, e-mail e telefone do cuidador', 'nome e condições de saúde da pessoa idosa'],
        keep: [`o código ${cg.code}`, 'as contagens nos indicadores', 'o log de acessos'],
      },
      irreversibleNote: 'Isso não pode ser desfeito.',
      confirmLabel: 'Anonimizar dados',
      typeToConfirm: cg.code,
      busyLabel: 'Anonimizando...',
      run: () => {
        this.service.executeAnonymization(r.id);
        this.toasts.success('Dados anonimizados. Os identificadores viraram o código do titular.');
      },
    });
  }

  protected async erase(): Promise<void> {
    const r = this.request();
    const cg = this.caregiver();
    if (!r || !cg) {
      return;
    }
    // CX-033: a sócia e o atendimento veem o plano sem tipos nem quantidades de registro clínico.
    const plan = erasurePlanFor(this.retention.plan(cg.id), this.auth.role());
    await this.dialogs.confirm({
      level: 3,
      title: `Eliminar os dados de ${cg.code}?`,
      message: `Os dados bloqueados ficam sem uso e sem acesso comum até o fim do prazo.${plan.note ? ` ${plan.note}` : ''}`,
      effects: {
        erase: plan.willErase.map((i) => `${i.label}${i.count > 1 ? ` (${i.count})` : ''}`),
        block: plan.willBlock.map((i) => (i.key === 'clinical' ? i.label : `${i.label} (${i.count})`)),
        keep: ['o histórico de consentimentos', 'o log de acessos'],
      },
      irreversibleNote: 'Isso não pode ser desfeito.',
      confirmLabel: 'Eliminar o que pode ser eliminado',
      typeToConfirm: cg.code,
      busyLabel: 'Eliminando...',
      run: () => {
        const done = this.service.executeErasure(r.id);
        this.toasts.success(done.retentionBlockNote ? 'Eliminação feita. Parte dos dados ficou bloqueada por registro documental.' : 'Eliminação feita.');
      },
    });
  }

  protected async revoke(): Promise<void> {
    const r = this.request();
    const key = this.revokeKey.value;
    this.revokeError.set(null);
    if (!r || !key) {
      this.revokeError.set('Escolha o consentimento que será retirado.');
      return;
    }
    const effects = this.consent.effectsOf(key, 'revoke');
    await this.dialogs.confirm({
      title: `Retirar o consentimento: ${CONSENT_LABELS[key]}?`,
      message: effects.join(' '),
      effects: { keep: ['o histórico de consentimentos, que não se edita nem se apaga'] },
      confirmLabel: 'Revogar consentimento',
      busyLabel: 'Revogando...',
      run: () => {
        const result = this.consent.revoke(r.caregiverId, key, { channel: r.channel ?? 'in_person', evidence: `Solicitação ${r.protocol}` });
        this.service.complete(r.id, `Consentimento "${CONSENT_LABELS[key]}" revogado. ${result.appliedEffects.join(' ')}`.trim());
        this.toasts.success('Consentimento revogado e solicitação concluída.');
      },
    });
  }

  protected openReview(): void {
    const r = this.request();
    const cg = this.caregiver();
    if (!r || !cg?.assignedPsychologistId) {
      return;
    }
    this.db.reviewRequests.create({
      caregiverId: cg.id,
      psychologistId: cg.assignedPsychologistId,
      about: 'zarit_decision',
      text: `${r.protocol}: ${r.description ?? 'Pedido de revisão de decisão tomada com base nos dados.'}`,
      dueAt: r.dueAt,
    });
    if (r.status === 'open') {
      this.service.start(r.id);
    }
    this.audit.write('create', 'data_subject_request', r.id, cg.id, 'pedido de revisão aberto ao psicólogo do caso');
    this.toasts.success('Pedido de revisão aberto ao psicólogo do caso.');
  }

  /** Concluir (CX-003): diálogo com o efeito, nota obrigatória e "Desfazer" logo depois. */
  protected async complete(): Promise<void> {
    const r = this.request();
    const text = this.note.value.trim();
    this.noteError.set(null);
    if (!r) {
      return;
    }
    if (text.length < 3) {
      this.noteError.set('Escreva a nota de resolução.');
      return;
    }
    const handler = this.handler();
    const { confirmed } = await this.dialogs.confirm({
      title: `Concluir a solicitação ${r.protocol}?`,
      message: 'O pedido passa a "Concluída", a data de conclusão é gravada e o texto de resposta ao titular fica pronto para copiar.',
      effects: {
        keep: [
          'a nota de resolução e o histórico do pedido',
          handler ? `${handler} como quem trata o pedido` : 'quem trata o pedido, sem troca',
        ],
      },
      confirmLabel: 'Concluir solicitação',
      busyLabel: 'Concluindo...',
      run: () => {
        this.service.complete(r.id, text);
      },
    });
    if (confirmed) {
      this.toasts.show({
        message: 'Solicitação concluída.',
        action: { label: 'Desfazer', run: () => this.undoComplete(r.id) },
      });
    }
  }

  private undoComplete(id: string): void {
    try {
      this.service.reopen(id);
      this.toasts.success('Conclusão desfeita. O pedido voltou a "Em andamento".');
    } catch (error) {
      this.fail(error);
    }
  }

  protected reject(): void {
    const text = this.rejectReason.value.trim();
    this.rejectError.set(null);
    if (text.length === 0) {
      this.rejectError.set('Escreva o motivo da rejeição.');
      return;
    }
    try {
      this.service.reject(this.id(), text);
      this.toasts.success('Solicitação rejeitada com motivo.');
    } catch (error) {
      this.fail(error);
    }
  }

  protected async copyReply(): Promise<void> {
    try {
      await this.doc.defaultView?.navigator.clipboard.writeText(this.reply());
      this.toasts.success('Texto copiado.');
    } catch {
      this.toasts.attention('O navegador não deixou copiar. Selecione o texto e copie.');
    }
  }
}

