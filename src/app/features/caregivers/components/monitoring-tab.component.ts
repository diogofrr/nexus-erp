import { ChangeDetectionStrategy, Component, computed, effect, inject, input, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuditLogService } from '@core/audit';
import { AuthService } from '@core/auth';
import { Database } from '@core/data';
import { formatDate } from '@core/format';
import type { Caregiver, ZaritAssessment } from '@core/models';
import { ConsentService } from '@core/privacy';
import { ZARIT_NOT_DIAGNOSIS_NOTE, zaritBandLabel, zaritEvolution } from '@core/rules';
import { BadgeComponent, CardComponent, EmptyStateComponent, ZaritBandBadgeComponent } from '@shared/ui';
import { SupervisionService } from '../state/supervision.service';
import { SupervisionGateComponent } from './supervision-gate.component';

/**
 * Aba Acompanhamento (SCR-M03-03): só o psicólogo do caso e o responsável técnico (o atendimento e a
 * gestão nem veem a aba, A-14). Sem consentimento de saúde mostra o motivo e não permite aplicar a escala.
 * O responsável técnico passa pelo portão de supervisão e cada abertura grava `supervise`; o psicólogo do
 * caso grava `view`. A escala apoia a escuta clínica e nunca é diagnóstico.
 */
@Component({
  selector: 'app-monitoring-tab',
  imports: [BadgeComponent, CardComponent, EmptyStateComponent, RouterLink, SupervisionGateComponent, ZaritBandBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!healthGranted()) {
      <app-card title="Acompanhamento">
        <app-empty-state
          compact
          kind="forbidden"
          title="Sem consentimento de saúde"
          [text]="reasonText()"
        />
      </app-card>
    } @else if (gated()) {
      <app-supervision-gate [caregiverId]="caregiver().id" />
    } @else {
      <div class="stack stack--6 sensitive" data-role="monitoring">
        @if (supervisionNote(); as note) {
          <p class="t-caption" role="status">Supervisão registrada às {{ note.atLabel }} (motivo: {{ note.reason }}).</p>
        }
        <div class="grid grid--2 grid--gap-6">
          <app-card title="Última aplicação" subtitle="Dado sensível, cifrado em repouso (simulado)">
            @if (last(); as a) {
              <div class="stack stack--3">
                <div class="cluster">
                  <app-zarit-band-badge [score]="a.total ?? 0" long large />
                </div>
                <dl class="dl">
                  <dt>Aplicada em</dt><dd>{{ date(a.appliedAt) }}</dd>
                  <dt>Faixa</dt><dd>{{ bandLabel(a) }}</dd>
                  <dt>Evolução desde a adesão</dt><dd>{{ evolution() }}</dd>
                  <dt>Próxima aplicação</dt><dd>{{ nextDue() ? date(nextDue()) : 'Sem aplicação agendada' }}</dd>
                </dl>
                @if (a.retentionBlock) {
                  <app-badge variant="attention" icon="lock">Bloqueado por retenção documental</app-badge>
                }
                <p class="t-caption">{{ note }}</p>
              </div>
            } @else {
              <p class="t-muted">Ainda não há aplicação da escala. Falta aplicar a escala de adesão.</p>
            }
          </app-card>
          <app-card title="Alertas" subtitle="Abertos e encerrados deste cuidador">
            @if (alerts().length === 0) {
              <p class="t-muted">Nenhum alerta registrado.</p>
            } @else {
              <ul class="stack stack--3 list-reset">
                @for (alert of alerts(); track alert.id) {
                  <li class="cluster">
                    <app-badge [variant]="alert.level === 'red' ? 'danger' : 'attention'" [icon]="alert.level === 'red' ? 'octagon-alert' : 'triangle-alert'">
                      {{ alert.level === 'red' ? 'Alerta vermelho' : 'Alerta amarelo' }}
                    </app-badge>
                    <span>{{ alert.status === 'closed' ? 'Encerrado' : 'Em acompanhamento' }}</span>
                    <a class="btn-link" [routerLink]="['/app/acompanhamento/alertas', alert.id]">Abrir alerta</a>
                  </li>
                }
              </ul>
            }
          </app-card>
        </div>
        <app-card title="Aplicações" [padded]="false">
          @if (history().length === 0) {
            <p class="card__body t-muted">Nenhuma aplicação concluída.</p>
          } @else {
            <div class="table-wrap table-wrap--flush">
              <table class="table table--stack">
                <caption class="sr-only">Aplicações da escala deste cuidador</caption>
                <thead><tr><th scope="col">Data</th><th scope="col">Tipo</th><th scope="col" class="col-num">Pontos</th><th scope="col">Faixa</th></tr></thead>
                <tbody>
                  @for (a of history(); track a.id) {
                    <tr>
                      <td data-label="Data">{{ date(a.appliedAt) }}</td>
                      <td data-label="Tipo">{{ a.kind === 'enrollment' ? 'Adesão' : 'Trimestral' }}</td>
                      <td data-label="Pontos" class="col-num">{{ a.total }}</td>
                      <td data-label="Faixa">{{ bandLabel(a) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </app-card>
        <div class="cluster">
          <a class="btn" [routerLink]="['/app/acompanhamento/cuidador', caregiver().id]">Abrir o histórico completo</a>
          @if (canApply()) {
            <a class="btn btn--primary" [routerLink]="['/app/acompanhamento/zarit', caregiver().id, 'nova']">Aplicar a escala</a>
          }
        </div>
      </div>
    }
  `,
})
export class MonitoringTabComponent {
  private readonly auth = inject(AuthService);
  private readonly db = inject(Database);
  private readonly audit = inject(AuditLogService);
  private readonly consent = inject(ConsentService);
  private readonly supervision = inject(SupervisionService);

  readonly caregiver = input.required<Caregiver>();
  protected readonly note = ZARIT_NOT_DIAGNOSIS_NOTE;

  protected readonly healthGranted = computed(() => {
    this.db.consents.all();
    return this.consent.isActive(this.caregiver().id, 'health_data');
  });
  protected readonly gated = computed(
    () => this.auth.role() === 'technical_lead' && !this.supervision.isGranted(this.caregiver().id),
  );
  protected readonly supervisionNote = computed(() =>
    this.auth.role() === 'technical_lead' ? this.supervision.info(this.caregiver().id) : null,
  );
  protected readonly canApply = computed(() => this.auth.role() === 'psychologist' && this.healthGranted());

  protected readonly reasonText = computed(() => {
    const revoked = this.consent
      .history(this.caregiver().id, 'health_data')
      .filter((e) => e.status === 'revoked')
      .pop();
    const base = revoked
      ? `O consentimento de dados de saúde foi revogado em ${formatDate(revoked.at)}. A aplicação da escala e os alertas estão pausados.`
      : 'Sem consentimento de dados de saúde. A aplicação da escala está pausada.';
    return `${base} O atendimento pode registrar o consentimento.`;
  });

  protected readonly history = computed<ZaritAssessment[]>(() => {
    this.db.zaritAssessments.all();
    return this.db.zaritAssessments
      .query((a) => a.caregiverId === this.caregiver().id && a.status === 'completed')
      .sort((a, b) => (a.appliedAt ?? '').localeCompare(b.appliedAt ?? ''));
  });
  protected readonly last = computed(() => this.history()[this.history().length - 1]);
  protected readonly nextDue = computed(() => {
    this.db.zaritAssessments.all();
    return (
      this.db.zaritAssessments
        .query((a) => a.caregiverId === this.caregiver().id && a.status === 'scheduled')
        .map((a) => a.dueDate)
        .sort()[0] ?? ''
    );
  });
  protected readonly evolution = computed(() => {
    const all = this.history();
    const first = all[0];
    const last = all[all.length - 1];
    if (!first || !last || all.length < 2 || first.total === undefined || last.total === undefined) {
      return 'Sem segunda aplicação';
    }
    return zaritEvolution(first.total, last.total).display;
  });
  protected readonly alerts = computed(() => {
    this.db.zaritAlerts.all();
    return this.db.zaritAlerts.query((a) => a.caregiverId === this.caregiver().id);
  });

  constructor() {
    // Cada abertura do conteúdo grava o log: `view` para o psicólogo do caso, `supervise` para o RT.
    effect(() => {
      const shown = this.healthGranted() && !this.gated();
      const id = this.caregiver().id;
      if (!shown) {
        return;
      }
      untracked(() => {
        if (this.auth.role() === 'technical_lead') {
          this.supervision.record(id, 'zarit_assessment');
        } else {
          this.audit.view('zarit_assessment', id, id);
        }
      });
    });
  }

  protected date(value: string | undefined): string {
    return formatDate(value);
  }

  protected bandLabel(a: ZaritAssessment): string {
    return a.band ? zaritBandLabel(a.band) : '';
  }
}
