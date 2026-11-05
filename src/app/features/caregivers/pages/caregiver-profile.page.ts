import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '@core/auth';
import { SubscriptionService } from '@core/commerce/subscription.service';
import { Database } from '@core/data';
import { caregiverLabel } from '@core/privacy/caregiver-label';
import { BadgeComponent, EmptyStateComponent, IconComponent, PageHeaderComponent, TabItem, TabsComponent } from '@shared/ui';
import { BannerComponent, PageContextService } from '@shared/ui/overlay';
import { SubscriptionPanelComponent } from '@shared/ui/plan/subscription-panel.component';
import { CaregiverClosureDrawerComponent, CaregiverEditDrawerComponent } from '../components/caregiver-dialogs.component';
import { ElderCareComponent } from '../components/elder-care.component';
import { MonitoringTabComponent } from '../components/monitoring-tab.component';
import {
  CareTabComponent,
  CommunicationTabComponent,
  ConsentsTabComponent,
  HistoryTabComponent,
} from '../components/other-tabs.component';
import { SummaryTabComponent } from '../components/summary-tab.component';
import { STATUS_BADGES, STATUS_LABELS } from '../state/caregiver-labels';

/**
 * SCR-M03-03 Perfil do cuidador (PD-03). Abas por permissão (as que o perfil nunca vê somem, A-14) e a aba
 * atual na URL (`?aba=`). A gestão vê só o código; o atendimento vê dados mascarados com "Mostrar" (motivo e
 * log); o responsável técnico passa pelo portão de supervisão; o psicólogo só abre os dele (guard da rota).
 */
@Component({
  selector: 'app-caregiver-profile-page',
  imports: [
    BadgeComponent,
    BannerComponent,
    CareTabComponent,
    CaregiverClosureDrawerComponent,
    CaregiverEditDrawerComponent,
    CommunicationTabComponent,
    ConsentsTabComponent,
    ElderCareComponent,
    EmptyStateComponent,
    HistoryTabComponent,
    IconComponent,
    MonitoringTabComponent,
    PageHeaderComponent,
    RouterLink,
    SubscriptionPanelComponent,
    SummaryTabComponent,
    TabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      @if (caregiver(); as cg) {
        <app-page-header [title]="label().text" [description]="description()">
          <div class="cluster">
            @if (canEdit()) {
              <button type="button" class="btn btn--primary" (click)="editOpen.set(true)"><svg appIcon="pencil"></svg>Editar cadastro</button>
              @if (canClose()) {
                <button type="button" class="btn" (click)="closeOpen.set(true)">Encerrar cadastro</button>
              }
            }
          </div>
        </app-page-header>
        <div class="cluster">
          <app-badge [variant]="statusBadge().variant" [icon]="statusBadge().icon">{{ statusLabel() }}</app-badge>
          @if (label().pseudonymized) {
            <span class="code-chip"><svg appIcon="shield-check" size="sm"></svg>Pseudonimizado</span>
          }
        </div>
        @if (justCreated()) {
          <app-banner variant="success" [heading]="'Cadastro criado: ' + cg.code" [dismissible]="true" (dismissed)="dismissCreated()">
            Falta aplicar a escala de adesão. O psicólogo do caso faz essa etapa.
            @if (cg.assignedPsychologistId === undefined && canEdit()) {
              Peça ao responsável técnico para atribuir o psicólogo responsável.
            }
          </app-banner>
        }
        <app-tabs label="Ficha do cuidador" [tabs]="tabs()" [selected]="tab()" (selectedChange)="setTab($event)">
          @switch (tab()) {
            @case ('resumo') { <app-caregiver-summary-tab [caregiver]="cg" (goto)="setTab($event)" /> }
            @case ('idoso') { <app-elder-care [caregiver]="cg" /> }
            @case ('plano') { <app-subscription-panel [caregiverId]="cg.id" linkToDetail /> }
            @case ('acompanhamento') { <app-monitoring-tab [caregiver]="cg" /> }
            @case ('atendimento') { <app-care-tab [caregiver]="cg" /> }
            @case ('consentimentos') { <app-consents-tab [caregiver]="cg" /> }
            @case ('comunicacao') { <app-communication-tab [caregiver]="cg" /> }
            @case ('historico') { <app-history-tab [caregiver]="cg" /> }
          }
        </app-tabs>
        <app-caregiver-edit-drawer [caregiver]="cg" [(open)]="editOpen" />
        <app-caregiver-closure-drawer [caregiver]="cg" [(open)]="closeOpen" />
      } @else {
        <app-empty-state kind="error" title="Cuidador não encontrado" text="Confira o endereço ou volte à lista de cuidadores.">
          <a class="btn" routerLink="/app/cuidadores">Voltar para Cuidadores</a>
        </app-empty-state>
      }
    </div>
  `,
})
export class CaregiverProfilePage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly db = inject(Database);
  private readonly page = inject(PageContextService);
  private readonly subscriptions = inject(SubscriptionService);

  private readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), { initialValue: '' });
  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });

  protected readonly editOpen = signal(false);
  protected readonly closeOpen = signal(false);
  protected readonly createdDismissed = signal(false);

  protected readonly caregiver = computed(() => {
    this.db.caregivers.all();
    return this.db.caregivers.get(this.id());
  });
  protected readonly role = this.auth.role;
  protected readonly label = computed(() => {
    const cg = this.caregiver();
    return cg ? caregiverLabel(this.role(), cg) : { text: '', code: '', pseudonymized: true };
  });
  protected readonly description = computed(() => (this.label().pseudonymized ? 'Visão da gestão: só o código e dados somados.' : this.caregiver()?.code));
  protected readonly statusBadge = computed(() => STATUS_BADGES[this.caregiver()?.status ?? 'active']);
  protected readonly statusLabel = computed(() => STATUS_LABELS[this.caregiver()?.status ?? 'active']);
  protected readonly canEdit = computed(() => this.auth.can('caregiver_registry', 'update') && this.caregiver()?.status !== 'closed');
  protected readonly canClose = computed(() => {
    const status = this.caregiver()?.status;
    return status === 'active' || status === 'paused_by_consent_revocation';
  });
  protected readonly justCreated = computed(() => this.query().get('novo') === '1' && !this.createdDismissed());

  protected readonly tabs = computed<TabItem[]>(() => {
    const role = this.role();
    const all: (TabItem & { roles: readonly string[] })[] = [
      { id: 'resumo', label: 'Resumo', roles: ['partner', 'technical_lead', 'psychologist', 'support'] },
      { id: 'idoso', label: 'Pessoa idosa e cuidados', roles: ['technical_lead', 'psychologist', 'support'] },
      { id: 'plano', label: 'Plano e cartão', roles: ['partner', 'technical_lead', 'psychologist', 'support'] },
      { id: 'acompanhamento', label: 'Acompanhamento', roles: ['technical_lead', 'psychologist'] },
      { id: 'atendimento', label: 'Atendimento', roles: ['technical_lead', 'psychologist'] },
      { id: 'consentimentos', label: 'Consentimentos', roles: ['partner', 'technical_lead', 'support'] },
      { id: 'comunicacao', label: 'Comunicação', roles: ['technical_lead', 'psychologist', 'support'] },
      { id: 'historico', label: 'Histórico', roles: ['partner', 'technical_lead', 'psychologist', 'support'] },
    ];
    return all.filter((t) => role !== null && t.roles.includes(role)).map(({ roles: _roles, ...tab }) => tab);
  });
  protected readonly tab = computed(() => {
    const wanted = this.query().get('aba');
    const tabs = this.tabs();
    return tabs.find((t) => t.id === wanted)?.id ?? 'resumo';
  });

  constructor() {
    // Plano e cartão refletem o relógio (inclusive o simulado): o que venceu passa a valer ao abrir a ficha.
    this.subscriptions.applyDueChanges();
    effect(() => {
      const cg = this.caregiver();
      if (!cg) {
        return;
      }
      untracked(() =>
        this.page.setCrumbs([
          { label: this.role() === 'psychologist' ? 'Meus cuidadores' : 'Cuidadores', link: '/app/cuidadores' },
          { label: this.label().text },
        ]),
      );
    });
  }

  protected setTab(tab: string | undefined): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { aba: tab && tab !== 'resumo' ? tab : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected dismissCreated(): void {
    this.createdDismissed.set(true);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { novo: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }
}
