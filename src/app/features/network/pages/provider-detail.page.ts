import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '@core/auth';
import { Clock } from '@core/clock';
import { Database } from '@core/data';
import { formatDate, formatDateTime, formatNumber, formatPercent } from '@core/format';
import { ArpBand, GraveCategory, ProviderEvaluation, ServiceRequest } from '@core/models';
import { NetworkService } from '@core/network';
import { ARP_MIN_EVALUATIONS } from '@core/rules';
import {
  BadgeComponent,
  CellDirective,
  DataTableComponent,
  EmptyStateComponent,
  FormFieldComponent,
  NxInputDirective,
  PageHeaderComponent,
  ProgressComponent,
  RadioOption,
  TabItem,
  TableColumn,
  TabsComponent,
  TimelineComponent,
  TimelineItem,
} from '@shared/ui';
import { BannerComponent, DialogService, DrawerComponent, PageContextService, ToastService } from '@shared/ui/overlay';
import { ArpBandComponent, ProviderStatusComponent, RefusalComponent } from '../components/badges.component';
import { IntegrationStepsComponent } from '../components/integration-steps.component';
import { ProviderDocumentsComponent } from '../components/provider-documents.component';
import { ReasonDrawerComponent, ReasonSubmit } from '../components/reason-drawer.component';
import { NetworkAdminService } from '../state/network-admin.service';
import {
  GRAVE_CATEGORY_LABEL,
  MODALITY_LABEL,
  PROVIDER_STATUS_VIEW,
  REQUEST_STATUS_VIEW,
  categoryLabel,
  councilText,
  subtitleOf,
} from '../state/network-labels';

interface EvaluationRow {
  id: string;
  dateText: string;
  technical: number;
  punctuality: number;
  scoreText: string;
  comment: string;
  caregiver: string;
  grave: GraveCategory | undefined;
  raw: ProviderEvaluation;
}

interface RequestRow {
  id: string;
  dateText: string;
  need: string;
  modality: string;
  status: ServiceRequest['status'];
  reason: string;
}

interface SnapshotRow {
  id: string;
  dateText: string;
  averageText: string;
  count: number;
  band: ArpBand;
  graves: number;
}

const TAB_IDS = ['dados', 'documentos', 'avaliacoes', 'solicitacoes', 'historico', 'emails'] as const;
type TabId = (typeof TAB_IDS)[number];

const GRAVE_OPTIONS: readonly RadioOption<string>[] = (
  Object.entries(GRAVE_CATEGORY_LABEL) as [GraveCategory, string][]
).map(([value, label]) => ({ value, label }));

/**
 * Ficha do prestador (SCR-M08-02, PD-03): o resumo da ARP e dos sinais da rede no topo e, em abas, dados,
 * documentos, avaliações, solicitações, histórico e e-mails registrados. Nenhuma tela da rede tem campo de
 * valor por atendimento (RN-REDE-12). O responsável técnico abre só as fichas de psicologia, para validar o
 * registro no conselho (RN-REDE-04, AC-M08-14).
 */
@Component({
  selector: 'app-network-provider-detail-page',
  imports: [
    RouterLink,
    ArpBandComponent,
    BadgeComponent,
    BannerComponent,
    CellDirective,
    DataTableComponent,
    DrawerComponent,
    EmptyStateComponent,
    FormFieldComponent,
    IntegrationStepsComponent,
    NxInputDirective,
    PageHeaderComponent,
    ProgressComponent,
    ProviderDocumentsComponent,
    ProviderStatusComponent,
    ReasonDrawerComponent,
    RefusalComponent,
    TabsComponent,
    TimelineComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      @if (!provider()) {
        <div class="card">
          <app-empty-state
            kind="error"
            title="Não encontramos este prestador"
            text="Ele pode ter sido removido da lista. Volte à lista para continuar."
          >
            <a class="btn" routerLink="/app/rede/prestadores">Voltar aos prestadores</a>
          </app-empty-state>
        </div>
      } @else if (restricted()) {
        <div class="card">
          <app-empty-state
            kind="forbidden"
            title="Esta ficha não está disponível para o seu perfil"
            text="Você abre as fichas de psicólogas e psicólogos da rede, para validar o registro no conselho."
          >
            <a class="btn" routerLink="/app/rede/prestadores">Ver as fichas que você abre</a>
          </app-empty-state>
        </div>
      } @else {
        @let p = provider()!;
        <app-page-header
          [title]="p.name"
          [description]="subtitle()"
          [breadcrumbs]="[{ label: 'Prestadores', link: '/app/rede/prestadores' }, { label: p.name }]"
        >
          @if (canSuspend()) {
            <button type="button" class="btn btn--danger-quiet" data-role="suspend" (click)="suspendOpen.set(true)">
              Suspender da busca
            </button>
          }
          @if (accreditation(); as acc) {
            <a class="btn" [routerLink]="['/app/rede/credenciamento', acc.id]" data-role="open-accreditation">
              Ver credenciamento
            </a>
          }
        </app-page-header>

        <div class="stack stack--6">
          <div class="cluster">
            <app-provider-status [status]="p.status" />
            @if (p.highlight) {
              <app-badge variant="success" icon="award">Em destaque na busca</app-badge>
            }
            @if (summaryView()?.refusal?.exitRisk && (p.status === 'active' || p.status === 'monitoring')) {
              <app-badge variant="attention" icon="triangle-alert">Risco de saída</app-badge>
            }
            @if (p.status === 'suspended' && openReviewId(); as reviewId) {
              <a class="btn btn--sm" [routerLink]="['/app/rede/avaliacao-interna', reviewId]" data-role="open-review">
                Abrir avaliação interna
              </a>
            }
          </div>

          @if (summaryView()?.refusal?.exitRisk && (p.status === 'active' || p.status === 'monitoring')) {
            <app-banner variant="attention" heading="O que é o risco de saída" data-role="exit-risk-note">
              O prestador recusa ou cancela solicitações acima do limite da rede nos últimos 30 dias (ou ficou bem
              menos disponível) e pode deixar de atender pela rede. Nenhuma ação é automática. Quem decide é a
              gestão: conversar com o prestador para entender o motivo, acompanhar nas próximas auditorias ou,
              se for preciso, suspender da busca.
            </app-banner>
          }

          <app-banner variant="info">
            A Nexus organiza a rede e não presta o serviço. O usuário escolhe, contrata e paga direto ao
            profissional, conforme as condições combinadas.
          </app-banner>

          @if (limited()) {
            <section class="card card--pad stack stack--3" aria-labelledby="nx-council-title" data-role="council-card">
              <h2 class="card__title" id="nx-council-title">Registro no conselho</h2>
              <dl class="dl">
                <dt>Conselho e número</dt>
                <dd>{{ council() }}</dd>
                <dt>Validade</dt>
                <dd>{{ p.council.validUntil ? format(p.council.validUntil) : 'Não informada' }}</dd>
                <dt>Situação da validação</dt>
                <dd>{{ councilValidation() }}</dd>
              </dl>
              @if (canValidateCouncil() && !councilOk()) {
                <div>
                  <button type="button" class="btn btn--primary" data-role="validate-council" (click)="validateCouncil()">
                    Validar registro no conselho
                  </button>
                </div>
              }
              @if (councilOk()) {
                <app-banner variant="success">O registro no conselho está validado.</app-banner>
              }
            </section>
          } @else {
            @if (summaryView(); as s) {
              <div class="grid grid--2 grid--gap-6">
                <section class="card card--pad stack stack--3" aria-labelledby="nx-arp-title" data-role="arp-card">
                  <h2 class="card__title" id="nx-arp-title">Avaliação da rede (ARP)</h2>
                  @if (s.average === null) {
                    <p class="card__title" data-role="average">Sem média (menos de 5 avaliações)</p>
                    <app-progress
                      label="Avaliações para ter média"
                      [value]="s.evaluationCount"
                      [max]="minEvaluations"
                    />
                  } @else {
                    <p class="t-num" data-role="average" style="font-size: var(--fs-3xl); line-height: 1">
                      {{ s.averageText }}
                    </p>
                    <p class="t-caption">média de {{ s.evaluationCount }} avaliações</p>
                  }
                  <div class="cluster">
                    @if (s.evaluationCount > 0 || s.band === 'deaccreditation') {
                      <app-arp-band [band]="s.band" />
                    }
                    <span class="t-ui" data-role="graves">
                      Reclamações graves: <strong>{{ s.graves }}</strong>
                    </span>
                  </div>
                  @if (s.lastSnapshotText) {
                    <p class="t-caption" data-role="snapshot-line">{{ s.lastSnapshotText }}</p>
                  } @else {
                    <p class="t-caption">Ainda não houve auditoria quinzenal para este prestador.</p>
                  }
                  @if (s.bandChangeText) {
                    <app-banner variant="attention">{{ s.bandChangeText }}</app-banner>
                  }
                </section>

                <section class="card card--pad stack stack--3" aria-labelledby="nx-signals-title" data-role="signals-card">
                  <h2 class="card__title" id="nx-signals-title">Sinais da rede</h2>
                  <div>
                    <p class="t-strong">Taxa de recusa em 30 dias</p>
                    <app-refusal [stats]="s.refusal" />
                  </div>
                  <div>
                    <p class="t-strong">Disponibilidade</p>
                    <p class="t-ui" data-role="availability">{{ s.availabilityText }}</p>
                    @if (s.availabilitySignal) {
                      <app-badge variant="attention" icon="triangle-alert">Queda de disponibilidade</app-badge>
                    }
                  </div>
                  @if (canEdit() && (p.status === 'active' || p.status === 'monitoring')) {
                    <div class="cluster">
                      <button type="button" class="btn btn--sm" data-role="register-availability" (click)="openAvailability()">
                        Registrar horários da semana
                      </button>
                      @if (p.status === 'monitoring') {
                        <button type="button" class="btn btn--sm" data-role="register-contact" (click)="contactOpen.set(true)">
                          Registrar contato de monitoramento
                        </button>
                      }
                    </div>
                  }
                </section>
              </div>
            }

            <app-tabs label="Ficha do prestador" [tabs]="tabItems()" [selected]="tab()" (selectedChange)="setTab($event)">
              @switch (tab()) {
                @case ('dados') {
                  <div class="stack stack--6">
                    <dl class="dl" data-role="provider-data">
                      <dt>Tipo</dt>
                      <dd>{{ p.personType === 'company' ? 'Empresa' : 'Pessoa' }}</dd>
                      <dt>Categoria</dt>
                      <dd>{{ categoryText() }}</dd>
                      <dt>Especialidade</dt>
                      <dd>{{ p.specialtyLabel }}</dd>
                      <dt>Conselho</dt>
                      <dd>{{ council() }}{{ p.council.validUntil ? ', válido até ' + format(p.council.validUntil) : '' }}</dd>
                      <dt>Cidade</dt>
                      <dd>{{ p.city }}</dd>
                      <dt>Atende em domicílio</dt>
                      <dd>{{ p.homeCare ? 'Sim' : 'Não' }}</dd>
                      <dt>Condições para usuários Nexus</dt>
                      <dd>{{ p.conditionsForNexusUsers }}</dd>
                      <dt>E-mail</dt>
                      <dd>{{ p.email }}</dd>
                      <dt>Telefone</dt>
                      <dd>{{ p.phone }}</dd>
                    </dl>
                    <section class="stack stack--3" aria-labelledby="nx-integration-title">
                      <h2 class="card__title" id="nx-integration-title">Integração e proteção de dados</h2>
                      <app-integration-steps [providerId]="p.id" />
                    </section>
                  </div>
                }
                @case ('documentos') {
                  <app-provider-documents [providerId]="p.id" />
                }
                @case ('avaliacoes') {
                  <app-data-table
                    caption="Avaliações do prestador"
                    noun="avaliações"
                    [rows]="evaluationRows()"
                    [columns]="evaluationColumns"
                    emptyTitle="Nenhuma avaliação ainda"
                    emptyText="Quando um usuário avaliar um serviço concluído, a avaliação aparece aqui."
                  >
                    <ng-template appCell="grave" let-row>
                      @if (row.grave) {
                        <app-badge variant="danger" icon="flag">{{ graveText(row.grave) }}</app-badge>
                      } @else if (canEdit()) {
                        <button type="button" class="btn btn--sm" data-role="classify-grave" (click)="startGrave(row.id)">
                          Classificar como grave
                        </button>
                      } @else {
                        <span class="t-muted">Não</span>
                      }
                    </ng-template>
                  </app-data-table>
                }
                @case ('solicitacoes') {
                  <app-data-table
                    caption="Solicitações do prestador"
                    noun="solicitações"
                    [rows]="requestRows()"
                    [columns]="requestColumns"
                    emptyTitle="Nenhuma solicitação ainda"
                    emptyText="Quando um usuário pedir um serviço deste prestador, a solicitação aparece aqui."
                  >
                    <ng-template appCell="status" let-row>
                      <app-badge [variant]="statusView(row.status).variant" [icon]="statusView(row.status).icon">
                        {{ statusView(row.status).label }}
                      </app-badge>
                    </ng-template>
                  </app-data-table>
                }
                @case ('historico') {
                  <div class="stack stack--6">
                    <section class="stack stack--3" aria-labelledby="nx-history-title">
                      <h2 class="card__title" id="nx-history-title">Histórico de estado</h2>
                      <app-timeline label="Histórico de estado do prestador" [items]="timeline()" />
                    </section>
                    <section class="stack stack--3" aria-labelledby="nx-snapshots-title">
                      <h2 class="card__title" id="nx-snapshots-title">Auditorias quinzenais</h2>
                      <app-data-table
                        caption="Instantâneos da auditoria quinzenal"
                        noun="auditorias"
                        [rows]="snapshotRows()"
                        [columns]="snapshotColumns"
                        emptyTitle="Nenhuma auditoria ainda"
                        emptyText="O instantâneo é gravado quando a gestão roda a auditoria quinzenal."
                      >
                        <ng-template appCell="band" let-row><app-arp-band [band]="row.band" /></ng-template>
                      </app-data-table>
                    </section>
                  </div>
                }
                @case ('emails') {
                  @if (emails().length === 0) {
                    <div class="card">
                      <app-empty-state
                        compact
                        title="Nenhum e-mail registrado"
                        text="O ERP registra o texto dos e-mails de encerramento e de pedido de documentos. O envio é feito fora do ERP."
                      />
                    </div>
                  } @else {
                    <ul class="stack stack--3" aria-label="E-mails registrados">
                      @for (mail of emails(); track mail.id) {
                        <li class="card card--pad stack stack--2" data-role="registered-email">
                          <p class="t-strong">{{ mail.title }}</p>
                          <p class="t-caption">{{ mail.when }}</p>
                          <p class="t-ui">{{ mail.body }}</p>
                        </li>
                      }
                    </ul>
                  }
                }
              }
            </app-tabs>
          }
        </div>
      }
    </div>

    @if (provider() && !restricted() && !limited()) {
    <app-reason-drawer
      [(open)]="suspendOpen"
      heading="Suspender da busca"
      [subtitle]="provider()?.name ?? ''"
      label="Motivo da suspensão"
      requiredMessage="Escreva o motivo da suspensão."
      confirmLabel="Suspender prestador"
      [danger]="true"
      [effect]="suspendEffect()"
      [error]="actionError()"
      (submitted)="suspend($event)"
    />
    <app-reason-drawer
      [(open)]="graveOpen"
      heading="Classificar como reclamação grave"
      subtitle="Conta na avaliação do prestador"
      optionsLabel="Categoria da reclamação"
      [options]="graveOptions"
      optionRequiredMessage="Escolha a categoria da reclamação grave."
      label="Observação"
      [textRequired]="false"
      confirmLabel="Classificar como grave"
      effect="Reclamações graves contam na avaliação do prestador. Três ou mais levam à suspensão da busca e à avaliação interna."
      [error]="actionError()"
      (submitted)="classify($event)"
    />
    <app-reason-drawer
      [(open)]="contactOpen"
      heading="Registrar contato de monitoramento"
      [subtitle]="provider()?.name ?? ''"
      label="O que ficou combinado"
      hint="Por exemplo: queda por motivo de agenda, ajustes combinados e retorno na próxima quinzena."
      requiredMessage="Escreva o que ficou combinado no contato."
      confirmLabel="Registrar contato"
      [error]="actionError()"
      (submitted)="registerContact($event)"
    />
    <app-drawer [(open)]="availabilityOpen" heading="Horários da semana" [subtitle]="provider()?.name ?? ''">
      <form id="nx-availability-form" class="stack stack--3" novalidate (submit)="saveAvailability($event)">
        <app-form-field
          label="Horários publicados nesta semana"
          hint="A queda de mais de 50% sobre a média das 4 semanas anteriores gera sinal na rede."
          controlId="availability-slots"
          [error]="availabilityError()"
        >
          <input
            appInput
            type="number"
            inputmode="numeric"
            min="0"
            max="80"
            [value]="availabilitySlots()"
            (input)="onSlots($event)"
          />
        </app-form-field>
      </form>
      <ng-container drawerFooter>
        <button type="button" class="btn" (click)="availabilityOpen.set(false)">Voltar</button>
        <button type="submit" form="nx-availability-form" class="btn btn--primary" data-role="save-availability">
          Registrar horários
        </button>
      </ng-container>
    </app-drawer>
    }
  `,
})
export class ProviderDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly clock = inject(Clock);
  private readonly db = inject(Database);
  private readonly network = inject(NetworkService);
  private readonly admin = inject(NetworkAdminService);
  private readonly toasts = inject(ToastService);
  private readonly dialogs = inject(DialogService);
  private readonly pageContext = inject(PageContextService);

  protected readonly minEvaluations = ARP_MIN_EVALUATIONS;
  protected readonly graveOptions = GRAVE_OPTIONS;
  protected readonly suspendOpen = signal(false);
  protected readonly graveOpen = signal(false);
  protected readonly contactOpen = signal(false);
  protected readonly availabilityOpen = signal(false);
  protected readonly actionError = signal<string | null>(null);
  protected readonly availabilitySlots = signal('0');
  protected readonly availabilityError = signal<string | null>(null);
  private readonly graveTarget = signal<string | null>(null);

  private readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), {
    initialValue: this.route.snapshot.paramMap.get('id') ?? '',
  });
  private readonly tabParam = toSignal(this.route.queryParamMap.pipe(map((p) => p.get('aba'))), {
    initialValue: this.route.snapshot.queryParamMap.get('aba'),
  });

  protected readonly provider = computed(() => this.db.providers.get(this.id()));
  protected readonly limited = computed(() => this.auth.hasRole('technical_lead'));
  protected readonly restricted = computed(
    () => this.limited() && this.provider() !== undefined && this.provider()?.category !== 'psychology',
  );
  protected readonly canEdit = computed(() => this.admin.isManager());
  protected readonly canSuspend = computed(() => {
    const status = this.provider()?.status;
    return this.canEdit() && (status === 'active' || status === 'monitoring');
  });
  protected readonly accreditation = computed(() => this.admin.accreditationOf(this.id()));
  protected readonly categoryText = computed(() => {
    const p = this.provider();
    return p ? categoryLabel(p.category) : '';
  });
  protected readonly council = computed(() => {
    const p = this.provider();
    return p ? councilText(p.council) : '';
  });
  protected readonly subtitle = computed(() => {
    const p = this.provider();
    return p ? subtitleOf(this.categoryText(), p.specialtyLabel, this.council()) : '';
  });
  protected readonly canValidateCouncil = computed(() => {
    const p = this.provider();
    return p ? this.admin.canValidateCouncil(p) : false;
  });
  protected readonly councilOk = computed(() => this.accreditation()?.checklist.council_registry.status === 'ok');
  protected readonly councilValidation = computed(() => {
    const item = this.accreditation()?.checklist.council_registry;
    if (item?.status === 'ok') {
      return `Validado${item.checkedAt ? ` em ${formatDate(item.checkedAt)}` : ''}`;
    }
    return item?.status === 'not_applicable' ? 'Não se aplica' : 'A validar';
  });

  protected readonly openReviewId = computed(
    () =>
      this.db.internalReviews.find((r) => r.providerId === this.id() && r.decision === undefined)?.id ??
      this.db.internalReviews.find((r) => r.providerId === this.id())?.id,
  );

  protected readonly summaryView = computed(() => {
    const summary = this.network.summaryOf(this.id());
    if (!summary) {
      return null;
    }
    const last = summary.lastSnapshot;
    const lastText = last
      ? `Último instantâneo (${formatDate(last.auditDate)}): ${last.average === null ? 'sem média' : `média ${formatNumber(last.average, 2)}`}, ${last.evaluationCount} avaliações, ${last.graveComplaintCount} reclamações graves.`
      : '';
    const changes = last && last.band !== summary.band;
    const week = summary.availability;
    return {
      average: summary.average,
      averageText: summary.average === null ? '' : formatNumber(summary.average, 2),
      evaluationCount: summary.evaluationCount,
      band: summary.band,
      graves: summary.graveCount,
      refusal: summary.refusal,
      lastSnapshotText: lastText,
      bandChangeText: changes ? 'Com os números de hoje a faixa muda. A próxima auditoria quinzenal grava a nova classificação.' : '',
      availabilitySignal: week.signal,
      availabilityText:
        week.current === null
          ? 'Nenhum horário registrado.'
          : week.previousAverage === null
            ? `${week.current} horários nesta semana.`
            : `${week.current} horários nesta semana; média das 4 anteriores: ${formatNumber(week.previousAverage, 1)}${week.dropPercent !== null && week.dropPercent > 0 ? ` (queda de ${formatPercent(week.dropPercent, { decimals: 1 })})` : ''}.`,
    };
  });

  protected readonly suspendEffect = computed(
    () =>
      `${this.provider()?.name ?? 'O prestador'} sai da busca na hora e a avaliação interna é aberta. O histórico de avaliações continua registrado.`,
  );

  protected readonly tab = computed<TabId>(() => {
    const wanted = this.tabParam();
    return (TAB_IDS as readonly string[]).includes(wanted ?? '') ? (wanted as TabId) : 'dados';
  });

  protected readonly tabItems = computed<TabItem[]>(() => {
    const p = this.provider();
    const expired = p ? this.network.summaryOf(p.id)?.expiredDocuments.length ?? 0 : 0;
    return [
      { id: 'dados', label: 'Dados' },
      { id: 'documentos', label: 'Documentos', ...(expired > 0 ? { badge: expired } : {}) },
      { id: 'avaliacoes', label: 'Avaliações' },
      { id: 'solicitacoes', label: 'Solicitações' },
      { id: 'historico', label: 'Histórico' },
      { id: 'emails', label: 'E-mails' },
    ];
  });

  protected readonly evaluationColumns: TableColumn<EvaluationRow>[] = [
    { key: 'dateText', header: 'Data', sortable: true, sortValue: (r) => r.raw.createdAt },
    { key: 'technical', header: 'Qualidade técnica', align: 'end', noSearch: true },
    { key: 'punctuality', header: 'Pontualidade e cordialidade', align: 'end', noSearch: true },
    { key: 'scoreText', header: 'Nota', align: 'end', noSearch: true },
    { key: 'comment', header: 'Comentário' },
    { key: 'caregiver', header: 'Cuidador', muted: true },
    { key: 'grave', header: 'Reclamação grave', noSearch: true },
  ];

  protected readonly requestColumns: TableColumn<RequestRow>[] = [
    { key: 'dateText', header: 'Pedido em', primary: true },
    { key: 'need', header: 'Necessidade' },
    { key: 'modality', header: 'Atendimento' },
    { key: 'status', header: 'Estado', noSearch: true },
    { key: 'reason', header: 'Motivo', muted: true },
  ];

  protected readonly snapshotColumns: TableColumn<SnapshotRow>[] = [
    { key: 'dateText', header: 'Data', primary: true },
    { key: 'averageText', header: 'Média', align: 'end' },
    { key: 'count', header: 'Avaliações', align: 'end' },
    { key: 'band', header: 'Faixa', noSearch: true },
    { key: 'graves', header: 'Graves', align: 'end' },
  ];

  protected readonly evaluationRows = computed<EvaluationRow[]>(() =>
    this.db.providerEvaluations
      .all()
      .filter((e) => e.providerId === this.id())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((e) => ({
        id: e.id,
        dateText: formatDate(e.createdAt),
        technical: e.technicalQuality,
        punctuality: e.punctualityCourtesy,
        scoreText: formatNumber(e.score, 1),
        comment: e.comment ?? 'Sem comentário',
        caregiver: this.admin.caregiverLabel(e.caregiverId).text,
        grave: e.grave?.category,
        raw: e,
      })),
  );

  protected readonly requestRows = computed<RequestRow[]>(() =>
    this.db.serviceRequests
      .all()
      .filter((r) => r.providerId === this.id())
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
      .map((r) => ({
        id: r.id,
        dateText: formatDate(r.requestedAt),
        need: r.need,
        modality: MODALITY_LABEL[r.modality],
        status: r.status,
        reason: r.reason ?? '',
      })),
  );

  protected readonly snapshotRows = computed<SnapshotRow[]>(() =>
    this.db.arpSnapshots
      .all()
      .filter((s) => s.providerId === this.id())
      .sort((a, b) => b.auditDate.localeCompare(a.auditDate))
      .map((s) => ({
        id: s.id,
        dateText: formatDate(s.auditDate),
        averageText: s.average === null ? 'Sem média' : formatNumber(s.average, 2),
        count: s.evaluationCount,
        band: s.band,
        graves: s.graveComplaintCount,
      })),
  );

  protected readonly timeline = computed<TimelineItem[]>(() =>
    this.db.providerStatusEvents
      .all()
      .filter((e) => e.providerId === this.id())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((e) => ({
        id: e.id,
        title: e.from === e.to && e.from !== null ? 'Comunicação registrada' : PROVIDER_STATUS_VIEW[e.to].label,
        text: e.reason,
        at: e.createdAt,
        tone: e.to === 'suspended' || e.to === 'rejected' ? ('danger' as const) : e.to === 'monitoring' ? ('attention' as const) : e.to === 'active' ? ('done' as const) : ('default' as const),
      })),
  );

  protected readonly emails = computed(() => {
    const id = this.id();
    const closure = this.db.internalReviews
      .all()
      .filter((r) => r.providerId === id && r.closureEmail !== undefined)
      .map((r) => ({
        id: r.id,
        title: `${r.closureEmail?.subject ?? 'Encerramento'} (para ${r.closureEmail?.to ?? ''})`,
        when: `Registrado em ${formatDateTime(r.closureEmail?.sentAt)}`,
        body: r.closureEmail?.body ?? '',
        at: r.closureEmail?.sentAt ?? '',
      }));
    const communications = this.db.providerStatusEvents
      .all()
      .filter((e) => e.providerId === id && e.from === e.to && e.reason.includes('E-mail registrado'))
      .map((e) => ({
        id: e.id,
        title: 'Pedido de documentos',
        when: `Registrado em ${formatDateTime(e.createdAt)}`,
        body: e.reason,
        at: e.createdAt,
      }));
    return [...closure, ...communications].sort((a, b) => b.at.localeCompare(a.at));
  });

  constructor() {
    // O título da aba é o tipo da tela (nunca o nome); as migalhas mostram o nome do prestador.
    this.pageContext.setTitle('Ficha do prestador');
  }

  protected format(date: string): string {
    return formatDate(date);
  }

  protected graveText(category: GraveCategory): string {
    return GRAVE_CATEGORY_LABEL[category];
  }

  protected statusView(status: ServiceRequest['status']): (typeof REQUEST_STATUS_VIEW)[ServiceRequest['status']] {
    return REQUEST_STATUS_VIEW[status];
  }

  protected setTab(tab: string | undefined): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { aba: tab && tab !== 'dados' ? tab : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  // ===== Ações =====

  protected suspend(input: ReasonSubmit): void {
    const result = this.admin.suspend(this.id(), input.text);
    if (!result.ok) {
      this.actionError.set(result.error);
      return;
    }
    this.actionError.set(null);
    this.suspendOpen.set(false);
    this.toasts.success(`${this.provider()?.name ?? 'O prestador'} saiu da busca. A avaliação interna foi aberta.`);
  }

  protected startGrave(evaluationId: string): void {
    this.graveTarget.set(evaluationId);
    this.actionError.set(null);
    this.graveOpen.set(true);
  }

  protected classify(input: ReasonSubmit): void {
    const target = this.graveTarget();
    if (!target || !input.choice) {
      return;
    }
    const result = this.admin.classifyGrave(target, input.choice as GraveCategory);
    if (!result.ok) {
      this.actionError.set(result.error);
      return;
    }
    this.actionError.set(null);
    this.graveOpen.set(false);
    this.toasts.success(
      result.value.suspended
        ? `Classificada como grave. ${result.value.message}`
        : 'Classificada como grave. Ela já conta na próxima auditoria.',
    );
  }

  protected registerContact(input: ReasonSubmit): void {
    const result = this.admin.registerMonitoringContact(this.id(), input.text);
    if (!result.ok) {
      this.actionError.set(result.error);
      return;
    }
    this.actionError.set(null);
    this.contactOpen.set(false);
    this.toasts.success('Contato registrado no histórico do prestador.');
  }

  protected openAvailability(): void {
    const weeks = this.provider()?.availability ?? [];
    this.availabilitySlots.set(String(weeks.at(-1)?.slots ?? 0));
    this.availabilityError.set(null);
    this.availabilityOpen.set(true);
  }

  protected onSlots(event: Event): void {
    this.availabilitySlots.set((event.target as HTMLInputElement).value);
  }

  protected saveAvailability(event: Event): void {
    event.preventDefault();
    const raw = this.availabilitySlots().trim();
    const value = raw === '' ? Number.NaN : Number(raw);
    const result = this.admin.registerAvailability(this.id(), value);
    if (!result.ok) {
      this.availabilityError.set(Number.isNaN(value) ? 'Informe quantos horários foram publicados na semana.' : result.error);
      return;
    }
    this.availabilityOpen.set(false);
    this.toasts.success('Horários da semana registrados. O sinal de disponibilidade já foi recalculado.');
  }

  protected async validateCouncil(): Promise<void> {
    const p = this.provider();
    if (!p) {
      return;
    }
    const { confirmed } = await this.dialogs.confirm({
      title: `Validar o registro no conselho de ${p.name}?`,
      message: 'Você confirma que o registro está ativo no conselho de classe.',
      effects: { keep: ['a validação fica registrada com seu nome e a data de hoje'] },
      confirmLabel: 'Validar registro',
    });
    if (!confirmed) {
      return;
    }
    const result = this.admin.validateCouncil(p.id);
    if (result.ok) {
      this.toasts.success(`Registro de ${p.name} validado em ${formatDate(this.clock.today())}.`);
    } else {
      this.toasts.error(result.error);
    }
  }
}
