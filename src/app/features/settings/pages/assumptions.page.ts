import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Clock } from '../../../core/clock/clock.service';
import { Database } from '../../../core/data/database';
import { defaultAppSettings } from '../../../core/data/defaults';
import { formatDate, formatMoney, formatNumber } from '../../../core/format/format';
import {
  ARP_ALERT_MIN,
  ARP_AUDIT_INTERVAL_DAYS,
  ARP_EXCELLENCE_MIN,
  ARP_GRAVE_LIMIT,
  ARP_MIN_EVALUATIONS,
} from '../../../core/rules/arp';
import { DEFAULT_ARBE_SETTINGS } from '../../../core/rules/arbe';
import { DEFAULT_PLANS } from '../../../core/rules/plans';
import { TWO_FACTOR_CODE } from '../../../core/auth/auth.service';

export type AssumptionState = 'default' | 'changed' | 'fixed';

export interface AssumptionRow {
  /** Código do catálogo de suposições, quando há (`S-02`, `E-03`). */
  code: string;
  label: string;
  /** Valor padrão do protótipo. */
  defaultValue: string;
  /** Valor atual. */
  currentValue: string;
  state: AssumptionState;
}

const STATE_TEXT: Record<AssumptionState, string> = {
  default: 'Padrão',
  changed: 'Alterada',
  fixed: 'Regra do documento',
};

/**
 * Suposições (SCR-M15-06, AC-M15-09): cada suposição do protótipo com o valor padrão e o valor atual, e as
 * regras fixas do documento (que não se editam). "Alterada" avisa o que mudou em relação ao padrão.
 */
@Component({
  selector: 'app-settings-assumptions-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-header">
        <div class="page-header__row">
          <div class="page-header__titles">
            <h1>Suposições</h1>
            <p class="page-header__desc">
              Onde o plano de negócios é omisso, o protótipo assume um valor.
              {{ changedCount() }} de {{ editable().length }}
              suposições estão diferentes do padrão.
            </p>
          </div>
        </div>
      </header>

      <div class="stack stack--6">
        <section aria-labelledby="nx-ass-edit">
          <h2 class="section-head" id="nx-ass-edit">Suposições que você pode ajustar</h2>
          <div class="table-wrap">
            <table class="table table--stack" data-density="compact" data-role="editable">
              <caption class="sr-only">
                Suposições editáveis, com o valor padrão e o atual
              </caption>
              <thead>
                <tr>
                  <th scope="col">Código</th>
                  <th scope="col">Suposição</th>
                  <th scope="col">Padrão</th>
                  <th scope="col">Atual</th>
                  <th scope="col">Situação</th>
                </tr>
              </thead>
              <tbody>
                @for (row of editable(); track row.label) {
                  <tr [attr.data-state]="row.state">
                    <td data-label="Código" class="t-code">{{ row.code }}</td>
                    <td data-label="Suposição" class="col-primary">{{ row.label }}</td>
                    <td data-label="Padrão" class="t-num">{{ row.defaultValue }}</td>
                    <td data-label="Atual" class="t-num">{{ row.currentValue }}</td>
                    <td data-label="Situação">
                      <span
                        class="badge badge--dot"
                        [class.badge--gold]="row.state === 'changed'"
                        >{{ stateText(row.state) }}</span
                      >
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="nx-ass-fixed">
          <h2 class="section-head" id="nx-ass-fixed">Regras fixas</h2>
          <div class="table-wrap">
            <table class="table table--stack" data-density="compact" data-role="fixed">
              <caption class="sr-only">
                Regras que não podem ser mudadas no protótipo
              </caption>
              <thead>
                <tr>
                  <th scope="col">Código</th>
                  <th scope="col">Regra</th>
                  <th scope="col">Valor</th>
                  <th scope="col">Situação</th>
                </tr>
              </thead>
              <tbody>
                @for (row of fixed(); track row.label) {
                  <tr>
                    <td data-label="Código" class="t-code">{{ row.code }}</td>
                    <td data-label="Regra" class="col-primary">{{ row.label }}</td>
                    <td data-label="Valor" class="t-num">{{ row.currentValue }}</td>
                    <td data-label="Situação">
                      <span class="badge badge--outline">{{ stateText(row.state) }}</span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  `,
})
export class AssumptionsPageComponent {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);

  private row(code: string, label: string, def: string, current: string): AssumptionRow {
    return {
      code,
      label,
      defaultValue: def,
      currentValue: current,
      state: def === current ? 'default' : 'changed',
    };
  }

  /** Suposições editáveis, com o valor padrão e o atual. */
  protected readonly editable = computed<AssumptionRow[]>(() => {
    const d = defaultAppSettings();
    const s = this.db.settings.get();
    const rows: AssumptionRow[] = [];
    DEFAULT_PLANS.forEach((p) => {
      const current = this.db.plans.get(p.id);
      rows.push(
        this.row(
          'S-02',
          `Desconto na sessão com psicólogo, plano ${p.name}`,
          `${p.psychSessionDiscountPercent}%`,
          `${current?.psychSessionDiscountPercent ?? p.psychSessionDiscountPercent}%`,
        ),
      );
      rows.push(
        this.row(
          'S-02',
          `Prioridade na agenda, plano ${p.name}`,
          p.priorityScheduling ? 'Sim' : 'Não',
          (current?.priorityScheduling ?? p.priorityScheduling) ? 'Sim' : 'Não',
        ),
      );
    });
    rows.push(
      this.row(
        'Protótipo',
        'Capacidade padrão do grupo',
        `${d.groupDefaultCapacity} vagas`,
        `${s.groupDefaultCapacity} vagas`,
      ),
    );
    rows.push(
      this.row(
        'Protótipo',
        'Limiar da taxa de recusa',
        `${d.refusalRateThresholdPercent}%`,
        `${s.refusalRateThresholdPercent}%`,
      ),
    );
    rows.push(
      this.row(
        'Protótipo',
        'Mínimo de solicitações para medir a recusa',
        String(d.refusalRateMinRequests),
        String(s.refusalRateMinRequests),
      ),
    );
    rows.push(
      this.row(
        'Protótipo',
        'Prazo da solicitação do titular',
        `${d.dsrDeadlineDays} dias`,
        `${s.dsrDeadlineDays} dias`,
      ),
    );
    rows.push(
      this.row(
        'Protótipo',
        'Aviso de vencimento da solicitação do titular',
        `${d.dsrDueSoonDays} dias`,
        `${s.dsrDueSoonDays} dias`,
      ),
    );
    (['app', 'whatsapp', 'phone', 'email'] as const).forEach((channel) => {
      const names = { app: 'aplicativo', whatsapp: 'WhatsApp', phone: 'telefone', email: 'e-mail' };
      rows.push(
        this.row(
          'Protótipo',
          `Prazo de resposta no ${names[channel]}`,
          `${d.slaHours[channel]} h úteis`,
          `${s.slaHours[channel]} h úteis`,
        ),
      );
    });
    rows.push(
      this.row(
        'Protótipo',
        'Antecedência para cancelar sessão',
        `${d.sessionCancellationHours} h`,
        `${s.sessionCancellationHours} h`,
      ),
    );
    rows.push(
      this.row(
        'Protótipo',
        'Valor de referência da sessão',
        formatMoney(d.sessionBasePriceCents),
        formatMoney(s.sessionBasePriceCents),
      ),
    );
    const labels: Record<keyof typeof DEFAULT_ARBE_SETTINGS, string> = {
      hoursThreshold: 'ARBE: horas por dia de cuidado',
      supportRequestsThreshold: 'ARBE: pedidos de apoio na janela',
      windowDays: 'ARBE: janela dos pedidos de apoio (dias)',
      zaritThreshold: 'ARBE: pontuação do critério da escala',
      criticalZarit: 'ARBE: pontuação do alerta crítico',
    };
    (Object.keys(labels) as (keyof typeof DEFAULT_ARBE_SETTINGS)[]).forEach((key) =>
      rows.push(
        this.row('S-11', labels[key], String(DEFAULT_ARBE_SETTINGS[key]), String(s.arbe[key])),
      ),
    );
    rows.push(
      this.row(
        'E-06',
        'Relógio simulado',
        'Desligado (data real)',
        this.clock.isSimulated()
          ? `Ligado em ${formatDate(this.clock.today())}`
          : 'Desligado (data real)',
      ),
    );
    return rows;
  });

  /** Regras do documento e da arquitetura: aparecem, mas não se editam. */
  protected readonly fixed = computed<AssumptionRow[]>(() => {
    const fixed = (code: string, label: string, value: string): AssumptionRow => ({
      code,
      label,
      defaultValue: value,
      currentValue: value,
      state: 'fixed',
    });
    return [
      fixed('RN-ARP', 'Mínimo de avaliações para ter média', String(ARP_MIN_EVALUATIONS)),
      fixed(
        'RN-ARP',
        'Faixa de excelência (média a partir de)',
        formatNumber(ARP_EXCELLENCE_MIN, 1),
      ),
      fixed('RN-ARP', 'Faixa de alerta (média a partir de)', formatNumber(ARP_ALERT_MIN, 1)),
      fixed(
        'RN-ARP',
        'Descredenciamento por reclamações graves (3 ou mais)',
        String(ARP_GRAVE_LIMIT),
      ),
      fixed('RN-ARP', 'Auditoria quinzenal', `${ARP_AUDIT_INTERVAL_DAYS} dias`),
      fixed('RN-ZRT', 'Faixas da escala de Zarit', '0 a 20, 21 a 40, 41 a 60 e 61 a 88'),
      fixed('RN-KPI', 'Mínimo por recorte nos indicadores agregados', '5 pessoas'),
      fixed('E-03', 'Inatividade da sessão (aviso aos 28 minutos)', '30 minutos'),
      fixed('RN-LGPD', 'Código do segundo fator simulado', TWO_FACTOR_CODE),
      fixed('S-21', 'Enunciados da escala de Zarit', 'Paráfrases de demonstração'),
    ];
  });

  protected readonly changedCount = computed(
    () => this.editable().filter((r) => r.state === 'changed').length,
  );

  protected stateText(state: AssumptionState): string {
    return STATE_TEXT[state];
  }
}
