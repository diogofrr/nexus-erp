import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuditLogService } from '@core/audit';
import { SupervisionWindowService } from '@core/audit/supervision-window.service';
import { Database } from '@core/data';
import { formatDate, formatPercent } from '@core/format';
import { ZARIT_BANDS, zaritBandInfo } from '@core/rules';
import { BadgeComponent, EmptyStateComponent, PageHeaderComponent, ZaritBandBadgeComponent } from '@shared/ui';
import { GaugeBandComponent } from '@shared/ui/charts';
import { SupervisionGateComponent } from '@shared/ui/access/supervision-gate.component';
import { PageContextService } from '@shared/ui/overlay';
import { AlertCountdownComponent } from '../components/alert-countdown.component';
import { ZaritAccessService } from '../state/zarit-access.service';
import { ZaritService } from '../state/zarit.service';
import { RESULT_SUPPORT_NOTE } from '../state/zarit-labels';

/**
 * SCR-M06-03, Resultado e conduta (F05, passo 7): total "63 de 88", faixa por extenso com ícone e texto, a
 * conduta da equipe (A.5), a evolução desde a adesão, a próxima aplicação e o alerta criado. O resultado apoia
 * a escuta clínica: nunca é tratado como diagnóstico. Para o vermelho, a ação primária é "Registrar contato
 * agora"; para o amarelo, "Abrir tarefa de revisão da rede de apoio" (a tarefa já foi criada, A-28).
 */
@Component({
  selector: 'app-zarit-result-page',
  imports: [
    AlertCountdownComponent,
    BadgeComponent,
    EmptyStateComponent,
    GaugeBandComponent,
    PageHeaderComponent,
    RouterLink,
    SupervisionGateComponent,
    ZaritBandBadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page--narrow stack stack--6">
      <app-page-header title="Resultado da escala" [description]="subtitle()">
        <a class="btn" routerLink="/app/acompanhamento/fila">Voltar à fila</a>
      </app-page-header>

      @if (!assessment() || assessment()?.total === undefined) {
        <app-empty-state title="Resultado não encontrado" text="Volte à fila e abra o histórico do cuidador.">
          <a class="btn btn--primary" routerLink="/app/acompanhamento/fila">Voltar à fila</a>
        </app-empty-state>
      } @else if (gated()) {
        <app-supervision-gate
          entity="zarit_assessment"
          [entityId]="assessment()?.id ?? ''"
          [caregiverId]="assessment()?.caregiverId ?? ''"
          (granted)="unlocked.set(true)"
        />
      } @else {
        <div class="cluster">
          <app-badge variant="info" icon="lock">Dado sensível · cifrado em repouso (simulado)</app-badge>
        </div>

        <section class="card card--pad stack stack--3" aria-labelledby="result-total" data-role="result">
          <h2 id="result-total" class="sr-only">Resultado</h2>
          <p class="t-display" data-role="total"><span class="t-serif">{{ assessment()?.total }}</span> de 88</p>
          <app-zarit-band-badge [band]="info().band" [score]="assessment()?.total" long large />
          <app-gauge-band [score]="assessment()?.total ?? 0" />
        </section>

        @if (alert(); as a) {
          @if (a.level === 'red') {
            <section class="banner banner--danger" role="status" data-role="alert-red" aria-labelledby="red-title">
              <div class="banner__body">
                <span id="red-title" class="banner__title">Alerta vermelho criado</span>
                <span class="banner__text">Contato da equipe hoje, até 23:59.</span>
                @if (a.deadlineAt) {
                  <app-alert-countdown [deadlineAt]="a.deadlineAt" large />
                }
                <span class="banner__actions">
                  <a class="btn btn--primary" [routerLink]="['/app/acompanhamento/alertas', a.id]" data-role="register-contact">Registrar contato agora</a>
                </span>
              </div>
            </section>
          } @else {
            <section class="banner banner--attention" role="status" data-role="alert-yellow" aria-labelledby="yellow-title">
              <div class="banner__body">
                <span id="yellow-title" class="banner__title">Alerta amarelo criado</span>
                <span class="banner__text">
                  Sobrecarga moderada a severa. Priorize o acompanhamento e revise a rede de apoio da família. O cuidador passa a ter vagas prioritárias.
                </span>
                <span class="banner__actions">
                  <a class="btn btn--primary" [routerLink]="['/app/acompanhamento/alertas', a.id]" data-role="open-task">
                    Abrir tarefa de revisão da rede de apoio
                  </a>
                </span>
              </div>
            </section>
          }
        }

        <section class="card card--pad stack stack--3" aria-labelledby="conduct-title" data-role="conduct">
          <h2 id="conduct-title" class="card__title">Conduta da equipe</h2>
          <p>{{ conduct() }}</p>
          @switch (info().band) {
            @case ('absent_or_small') {
              <p class="t-caption">O convite é informativo; grupos de apoio seguem o plano do cuidador.</p>
              <div><a class="btn" routerLink="/app/grupos">Ver a programação de grupos</a></div>
            }
            @case ('moderate') {
              <div class="cluster">
                @if (canOffer()) {
                  <a class="btn btn--primary" routerLink="/app/atendimento/agenda" [queryParams]="{ acao: 'agendar', cuidador: assessment()?.caregiverId }" data-role="offer">
                    Oferecer atendimento
                  </a>
                }
                <a class="btn" routerLink="/app/grupos">Ver grupos e capacitações</a>
              </div>
            }
            @default {
              @if (canOffer()) {
                <div>
                  <a class="btn" routerLink="/app/atendimento/agenda" [queryParams]="{ acao: 'agendar', cuidador: assessment()?.caregiverId }">
                    Agendar uma sessão
                  </a>
                </div>
              }
            }
          }
        </section>

        <section class="card card--pad stack stack--2" aria-labelledby="evo-title" data-role="evolution">
          <h2 id="evo-title" class="card__title">Evolução desde a adesão</h2>
          <p>{{ evolutionText() }}</p>
          <p class="t-ui">Próxima aplicação: <strong>{{ nextDue() }}</strong>.</p>
        </section>

        <p class="t-ui" data-role="support-note">{{ supportNote }}</p>
        <div class="cluster">
          <a class="btn" [routerLink]="['/app/acompanhamento/cuidador', assessment()?.caregiverId]">Ver o histórico do cuidador</a>
        </div>
      }
    </div>
  `,
})
export class ZaritResultPageComponent {
  private readonly db = inject(Database);
  private readonly svc = inject(ZaritService);
  private readonly access = inject(ZaritAccessService);
  private readonly audit = inject(AuditLogService);
  private readonly supervision = inject(SupervisionWindowService);
  private readonly page = inject(PageContextService);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });

  protected readonly supportNote = RESULT_SUPPORT_NOTE;
  protected readonly unlocked = signal(false);

  protected readonly assessment = computed(() => {
    const found = this.db.zaritAssessments.get(this.params().get('id') ?? '');
    return found?.caregiverId === (this.params().get('caregiverId') ?? found?.caregiverId) ? found : undefined;
  });
  private readonly caregiver = computed(() => this.db.caregivers.get(this.assessment()?.caregiverId ?? ''));
  protected readonly info = computed(() => zaritBandInfo(this.assessment()?.total ?? 0));
  protected readonly conduct = computed(() => ZARIT_BANDS.find((b) => b.band === this.info().band)?.conduct ?? '');
  protected readonly alert = computed(() =>
    this.db.zaritAlerts.find((a) => a.assessmentId === this.assessment()?.id),
  );
  protected readonly gated = computed(() => {
    const c = this.assessment()?.caregiverId;
    return !!c && this.access.mustJustify(c) && !this.unlocked();
  });
  protected readonly canOffer = computed(() => this.access.canApply(this.assessment()?.caregiverId ?? ''));
  protected readonly subtitle = computed(() => {
    const a = this.assessment();
    const c = this.caregiver();
    return a && c ? `${c.fullName}, ${formatDate(a.appliedAt)}` : '';
  });
  protected readonly evolutionText = computed(() => {
    const a = this.assessment();
    if (!a) {
      return '';
    }
    const done = this.svc.completedOf(a.caregiverId);
    const first = done[0];
    if (!first || first.id === a.id || first.total === undefined || a.total === undefined) {
      return 'Esta é a aplicação de adesão: ela é a referência para as próximas.';
    }
    const evolution = this.svc.evolutionOf(a.caregiverId);
    if (evolution?.kind === 'not_defined') {
      return `Adesão: ${first.total}. Agora: ${a.total}. Evolução: n/d (a adesão foi 0), diferença de ${evolution.pointsDelta} ${Math.abs(evolution.pointsDelta) === 1 ? 'ponto' : 'pontos'}.`;
    }
    const pct = a.total === first.total ? '0,0%' : formatPercent(((a.total - first.total) / first.total) * 100, { decimals: 1, signed: true });
    const meaning = a.total > first.total ? 'aumento da sobrecarga' : a.total < first.total ? 'redução da sobrecarga' : 'sem mudança';
    return `Adesão: ${first.total}. Agora: ${a.total}. Evolução: ${pct} (${meaning}).`;
  });
  protected readonly nextDue = computed(() => {
    const a = this.assessment();
    const due = a ? this.svc.nextDueDate(a.caregiverId) : null;
    return due ? formatDate(due) : 'a definir';
  });

  constructor() {
    this.page.setCrumbs([
      { label: 'Acompanhamento', link: '/app/acompanhamento/fila' },
      { label: 'Resultado da escala' },
    ]);
    // Abertura do resultado: leitura de dado sensível no log; o RT entra pelo portão (motivo e janela de 30 minutos).
    effect(() => {
      const a = this.assessment();
      untracked(() => {
        if (!a) {
          return;
        }
        if (this.access.mustJustify(a.caregiverId)) {
          if (this.supervision.access('zarit_assessment', a.id, a.caregiverId) === 'open') {
            this.unlocked.set(true);
          }
        } else {
          this.audit.view('zarit_assessment', a.id, a.caregiverId);
        }
      });
    });
  }
}
