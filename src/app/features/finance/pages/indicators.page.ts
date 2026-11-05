import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { formatMoney, formatNumber, formatPercent, formatYearMonth } from '@core/format';
import { Aggregate } from '@core/privacy';
import { CONVERSION_REFERENCES } from '@core/rules/finance';
import { BarChartComponent } from '@shared/ui/charts';
import { ChartFrameComponent } from '@shared/ui/charts/chart-frame.component';
import {
  CardComponent,
  EmptyStateComponent,
  IconComponent,
  KpiComponent,
  KpiStripComponent,
  OccupancyBarComponent,
  PageHeaderComponent,
  TabItem,
  TabsComponent,
} from '@shared/ui';
import { FormulaComponent } from '../components/formula.component';
import { FinanceStore } from '../state/finance.store';
import {
  INDICATOR_TAB_LABELS,
  IndicatorTab,
  IndicatorsStore,
  SERVICE_WINDOW_DAYS,
} from '../state/indicators.store';

const BAND_SHORT: Record<string, string> = {
  absent_or_small: '0 a 20',
  moderate: '21 a 40',
  moderate_to_severe: '41 a 60',
  severe: '61 a 88',
};

/** Na URL o nome da aba é em português: `?aba=cuidadores`. */
const TAB_SLUG: Record<IndicatorTab, string> = {
  caregivers: 'cuidadores',
  network: 'rede',
  team: 'equipe',
  service: 'atendimento',
};

const CHANNEL_LABEL: Record<string, string> = {
  app: 'Aplicativo',
  whatsapp: 'WhatsApp',
  phone: 'Telefone',
  email: 'E-mail',
};

/**
 * SCR-M10-06 Indicadores (People Analytics), `/app/indicadores`. Três frentes (cuidadores, rede, equipe) mais o
 * atendimento (SLA e reclamações, o operacional do `support`). Cada perfil abre só as abas da matriz. Indicador
 * clínico é agregado com mínimo de 5 pessoas: abaixo disso a tela mostra "menos de 5" e não calcula o valor
 * (RN-KPI-02). Nenhum nome de cuidador, nenhum escore individual. As fórmulas estão em "Como é calculado".
 */
@Component({
  selector: 'app-finance-indicators-page',
  imports: [
    BarChartComponent,
    ChartFrameComponent,
    CardComponent,
    EmptyStateComponent,
    IconComponent,
    KpiComponent,
    KpiStripComponent,
    OccupancyBarComponent,
    PageHeaderComponent,
    TabsComponent,
    FormulaComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .plain-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }
  `,
  template: `
    <div class="page stack stack--6">
      <app-page-header
        title="Indicadores"
        [description]="description()"
      />

      @if (store.tabs().length === 0) {
        <app-empty-state
          kind="forbidden"
          title="Nenhum indicador disponível para o seu perfil"
          text="Fale com a gestão se você precisa deste acesso."
        />
      } @else {
        <app-tabs label="Frentes de indicadores" [tabs]="tabItems()" [selected]="tab()" (selectedChange)="choose($event)">
          @switch (tab()) {
            @case ('caregivers') {
              <div class="stack stack--6" data-role="tab-caregivers">
                <app-card
                  title="Sobrecarga por faixa"
                  subtitle="Última aplicação da escala de cada cuidador"
                >
                  <div class="stack stack--3">
                    <app-chart-frame>
                    <app-bar-chart
                      [data]="bandData()"
                      [ariaLabel]="bandAria()"
                      caption="Cuidadores por faixa de sobrecarga"
                      categoryHeader="Faixa da escala (pontos)"
                      valueHeader="Cuidadores"
                      positiveLabel="Cuidadores na faixa"
                      [height]="240"
                    />
                    </app-chart-frame>
                    <p class="t-caption" data-role="band-names">
                      0 a 20: ausente ou pequena · 21 a 40: moderada · 41 a 60: moderada a severa · 61 a 88: severa.
                    </p>
                    <p class="t-caption" data-role="band-note">
                      Sem nomes e sem pontuação individual. Faixa com menos de 5 cuidadores aparece
                      como "menos de 5", sem número. O indicador acompanha a evolução ao longo do
                      tempo e serve de apoio à escuta do psicólogo.
                    </p>
                    <app-formula>
                      Pontuação da Escala de Zarit (0 a 88) da última aplicação concluída de cada
                      cuidador que concedeu os consentimentos de saúde e de People Analytics. Faixas:
                      0 a 20, 21 a 40, 41 a 60 e 61 a 88.
                    </app-formula>
                  </div>
                </app-card>

                <app-kpi-strip>
                  <app-kpi
                    label="Evolução média da sobrecarga"
                    [value]="evolutionText()"
                    [suppressed]="!store.evolution().sufficient"
                    context="Negativo indica redução. É um indício, não uma prova."
                  />
                  <app-kpi
                    label="Alertas amarelos abertos"
                    [value]="agg(store.zaritAlerts().yellow)"
                    [suppressed]="!store.zaritAlerts().yellow.sufficient"
                    link="/app/acompanhamento"
                  />
                  <app-kpi
                    label="Alertas vermelhos abertos"
                    [value]="agg(store.zaritAlerts().red)"
                    [suppressed]="!store.zaritAlerts().red.sufficient"
                    link="/app/acompanhamento"
                  />
                  <app-kpi
                    label="Contato no mesmo dia"
                    [value]="sameDayText()"
                    [suppressed]="store.sameDay().percent === null"
                    context="alertas vermelhos, últimos 30 dias"
                  />
                </app-kpi-strip>
                <app-kpi-strip>
                  <app-kpi
                    label="ARBE de atenção abertos"
                    [value]="agg(store.arbeAlerts().attention)"
                    [suppressed]="!store.arbeAlerts().attention.sufficient"
                  />
                  <app-kpi
                    label="ARBE críticos abertos"
                    [value]="agg(store.arbeAlerts().critical)"
                    [suppressed]="!store.arbeAlerts().critical.sufficient"
                  />
                </app-kpi-strip>
                <app-formula>
                  Evolução = (pontuação atual − pontuação na adesão) ÷ pontuação na adesão × 100,
                  em média entre quem tem 2 ou mais aplicações e adesão maior que zero. Alertas e ARBE:
                  contagem dos que não foram encerrados. Contato no mesmo dia: alertas vermelhos com
                  contato na data da aplicação ÷ alertas vermelhos com prazo vencido × 100.
                </app-formula>

                @if (store.role() === 'partner') {
                  <app-card title="Conversão" subtitle="Assinantes sobre usuários gratuitos" data-role="conversion-card">
                    <div class="stack stack--3">
                      <app-kpi-strip>
                        <app-kpi
                          label="Conversão realizada"
                          [value]="conversionText()"
                          [context]="store.subscribers().total + ' de ' + freeText() + ' usuários gratuitos'"
                        />
                        <app-kpi label="Assinantes" [value]="store.subscribers().total" link="/app/assinaturas" />
                        <app-kpi label="Usuários gratuitos" [value]="freeText()" />
                      </app-kpi-strip>
                      <ul class="cluster plain-list" aria-label="Referências do plano" data-role="conversion-refs">
                        @for (ref of references; track ref) {
                          <li class="badge badge--outline">Referência {{ ref }}%</li>
                        }
                      </ul>
                      <app-formula>
                        Assinantes (planos pagos ativos, inclusive os pagos por empresas) ÷ usuários
                        gratuitos acumulados (cadastros não encerrados) × 100. O plano trabalha com
                        3%, 5% e 7%.
                      </app-formula>
                    </div>
                  </app-card>

                  <app-card title="Uso do aplicativo" subtitle="Últimos 30 dias, dado simulado do protótipo">
                    <div class="stack stack--3" data-role="usage">
                      <app-kpi-strip>
                        <app-kpi label="Usuários ativos" [value]="percent(store.usage().activePercent)" context="1 ou mais acesso em 30 dias" />
                        <app-kpi label="Acessos por usuário" [value]="number(store.usage().averageAccesses, 1)" />
                        <app-kpi label="Funções usadas" [value]="number(store.usage().averageDistinctFeatures, 1)" context="em média, por usuário" />
                      </app-kpi-strip>
                    </div>
                  </app-card>
                }

                @if (store.role() === 'partner' || store.role() === 'psychologist') {
                  <app-card title="Grupos e capacitações" [subtitle]="store.role() === 'psychologist' ? 'As suas atividades' : 'Todas as atividades em andamento'">
                    @if (store.participation().length === 0) {
                      <app-empty-state compact title="Nenhuma atividade por aqui" text="Quando houver grupos ou capacitações ativos, a participação aparece nesta lista." />
                    } @else {
                      <div class="table-wrap">
                        <table class="table" data-density="comfortable" data-role="participation">
                          <caption class="sr-only">Participação nas atividades</caption>
                          <thead>
                            <tr>
                              <th scope="col">Atividade</th>
                              <th scope="col" class="col-num">Inscritos</th>
                              <th scope="col" class="col-num">Vagas</th>
                              <th scope="col" class="col-num">Preenchimento</th>
                              <th scope="col" class="col-num">Presença</th>
                            </tr>
                          </thead>
                          <tbody>
                            @for (row of store.participation(); track row.activity.id) {
                              <tr>
                                <th scope="row">{{ row.activity.title }}</th>
                                <td class="col-num t-nowrap">{{ row.stat?.enrolled }}</td>
                                <td class="col-num t-nowrap">{{ row.stat?.capacity }}</td>
                                <td class="col-num t-nowrap">{{ percent(row.stat?.fillPercent ?? null) }}</td>
                                <td class="col-num t-nowrap">{{ percent(row.stat?.attendancePercent ?? null) }}</td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                      <app-formula>
                        Inscritos = quem está inscrito, presente ou faltou (lista de espera e cancelados
                        não contam). Presença = presentes ÷ inscritos × 100. Preenchimento = inscritos ÷
                        vagas × 100.
                      </app-formula>
                    }
                  </app-card>
                }
              </div>
            }

            @case ('network') {
              <div class="stack stack--6" data-role="tab-network">
                <app-kpi-strip>
                  <app-kpi
                    label="Avaliação da rede"
                    [value]="ratingText()"
                    context="média ponderada, de 1 a 5"
                    link="/app/rede/avaliacoes"
                  />
                  <app-kpi
                    label="Credenciamentos em andamento"
                    [value]="store.accreditationsInProgress()"
                    link="/app/rede/credenciamento"
                  />
                  <app-kpi
                    label="Prestadores em risco de saída"
                    [value]="store.exitRiskCount()"
                    context="recusa alta ou queda de disponibilidade"
                    link="/app/rede/prestadores"
                  />
                </app-kpi-strip>

                <app-card title="Prestadores por faixa" subtitle="Última auditoria quinzenal">
                  <div class="stack stack--3">
                    <app-chart-frame>
                    <app-bar-chart
                      [data]="arpData()"
                      [ariaLabel]="arpAria()"
                      caption="Prestadores por faixa da avaliação"
                      categoryHeader="Faixa"
                      valueHeader="Prestadores"
                      positiveLabel="Prestadores"
                      [height]="220"
                    />
                    </app-chart-frame>
                    <app-formula>
                      Faixa do último instantâneo da auditoria de cada prestador: excelência (média
                      4,5 ou mais), alerta (4,0 a menos de 4,5), descredenciamento (abaixo de 4,0 ou 3
                      reclamações graves) e sem média (menos de 5 avaliações).
                    </app-formula>
                  </div>
                </app-card>

                <app-card title="Taxa de recusa" subtitle="Últimos 30 dias, prestadores ativos e em monitoramento">
                  <div class="stack stack--3">
                    <div class="table-wrap">
                      <table class="table" data-density="comfortable" data-role="refusal">
                        <caption class="sr-only">Taxa de recusa e disponibilidade dos prestadores</caption>
                        <thead>
                          <tr>
                            <th scope="col">Prestador</th>
                            <th scope="col" class="col-num">Solicitações</th>
                            <th scope="col" class="col-num">Taxa de recusa</th>
                            <th scope="col" class="col-num">Queda de disponibilidade</th>
                            <th scope="col">Sinal</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (row of store.providerSignals(); track row.id) {
                            <tr>
                              <th scope="row">{{ row.name }}</th>
                              <td class="col-num t-nowrap">{{ row.received }}</td>
                              <td class="col-num t-nowrap">{{ percent(row.refusalPercent) }}</td>
                              <td class="col-num t-nowrap">{{ percent(row.dropPercent) }}</td>
                              <td>
                                @if (row.exitRisk) {
                                  <span class="badge badge--danger"><svg appIcon="triangle-alert"></svg>Risco de saída</span>
                                } @else if (row.aboveThreshold) {
                                  <span class="badge badge--attention"><svg appIcon="info"></svg>Poucas solicitações</span>
                                } @else {
                                  <span class="badge badge--success"><svg appIcon="circle-check"></svg>Sem sinal</span>
                                }
                              </td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                    <app-formula>
                      Taxa de recusa = solicitações recusadas ou canceladas pelo prestador nos
                      últimos 30 dias ÷ solicitações recebidas no período × 100. Risco de saída: 30%
                      ou mais com no mínimo 5 solicitações, ou queda de disponibilidade acima de 50%.
                    </app-formula>
                  </div>
                </app-card>

                <app-card title="Entradas e saídas da rede" subtitle="Por mês">
                  <div class="table-wrap">
                    <table class="table" data-density="comfortable" data-role="flow">
                      <caption class="sr-only">Entradas e saídas da rede por mês</caption>
                      <thead>
                        <tr>
                          <th scope="col">Mês</th>
                          <th scope="col" class="col-num">Ativações</th>
                          <th scope="col" class="col-num">Descredenciamentos</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (row of store.networkFlow(); track row.month) {
                          <tr>
                            <th scope="row">{{ monthName(row.month) }}</th>
                            <td class="col-num t-nowrap">{{ row.entries }}</td>
                            <td class="col-num t-nowrap">{{ row.exits }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </app-card>
              </div>
            }

            @case ('team') {
              <div class="stack stack--6" data-role="tab-team">
                <app-kpi-strip>
                  <app-kpi
                    label="Psicólogos com alerta de sobrecarga"
                    [value]="store.overloadCount()"
                    context="acima de 80% por dois meses fechados"
                  />
                  <app-kpi
                    label="Horas de atendimento"
                    [value]="store.doneHoursLastMonth()"
                    [unit]="'h'"
                    [context]="'em ' + monthName(lastClosed())"
                  />
                </app-kpi-strip>

                <app-card title="Ocupação da agenda" subtitle="Dois últimos meses fechados">
                  <div class="stack stack--6">
                    @for (row of store.occupancy(); track row.psychologistId) {
                      <section class="stack stack--2" [attr.data-psychologist]="row.psychologistId">
                        <div class="cluster cluster--between">
                          <h3 class="t-strong">{{ row.name }}</h3>
                          @if (row.overload) {
                            <span class="badge badge--attention" data-role="overload"
                              ><svg appIcon="triangle-alert"></svg>Agenda acima de 80% por dois meses</span
                            >
                          }
                        </div>
                        @for (m of row.months; track m.month) {
                          <app-occupancy-bar [name]="monthName(m.month)" [percent]="m.percent" />
                        }
                      </section>
                    } @empty {
                      <app-empty-state compact title="Sem psicólogos na equipe" text="Quando houver agenda aberta, a ocupação aparece aqui." />
                    }
                    <p class="t-caption">
                      O alerta é um apoio para redistribuir a agenda e cuidar de quem cuida, não uma
                      cobrança. Mês sem agenda aparece como n/d e não gera alerta.
                    </p>
                    <app-formula>
                      Ocupação = horas de atendimento realizadas no mês ÷ horas disponibilizadas na
                      agenda × 100, por psicólogo. Sobrecarga: ocupação acima de 80% nos dois últimos
                      meses fechados. O mês corrente é parcial e não conta.
                    </app-formula>
                  </div>
                </app-card>

                @if (store.role() === 'partner') {
                  <app-card title="Ampliar a equipe?" subtitle="Decisão dos sócios">
                    <p class="t-ui" data-role="expansion">
                      @if (store.expansionRecommended()) {
                        O resultado do mês é positivo: ampliar a equipe é possível, se os sócios
                        decidirem.
                      } @else {
                        O resultado do mês ainda é negativo ({{ resultText() }}). Ampliar a equipe só
                        é recomendado com resultado positivo; antes disso, a saída é redistribuir a
                        agenda.
                      }
                    </p>
                  </app-card>
                }
              </div>
            }

            @case ('service') {
              <div class="stack stack--6" data-role="tab-service">
                <p class="t-caption">Janela dos indicadores de atendimento: últimos {{ windowDays }} dias.</p>
                <app-kpi-strip>
                  <app-kpi
                    label="Mensagens atrasadas"
                    [value]="store.overdueMessages()"
                    context="agora"
                    link="/app/mensagens"
                  />
                  <app-kpi label="Reclamações recebidas" [value]="store.complaints().received" link="/app/reclamacoes" />
                  <app-kpi
                    label="Reclamações abertas"
                    [value]="store.complaints().open"
                    [context]="store.complaints().overdue + ' vencidas'"
                    link="/app/reclamacoes"
                  />
                  <app-kpi
                    label="Tempo até a 1ª resposta"
                    [value]="hoursText()"
                    context="reclamações, em média"
                  />
                </app-kpi-strip>

                <app-card title="Prazo de resposta por canal" subtitle="Mensagens respondidas dentro do prazo">
                  <div class="stack stack--3">
                    <div class="table-wrap">
                      <table class="table" data-density="comfortable" data-role="sla">
                        <caption class="sr-only">Prazo de resposta por canal</caption>
                        <thead>
                          <tr>
                            <th scope="col">Canal</th>
                            <th scope="col" class="col-num">Mensagens consideradas</th>
                            <th scope="col" class="col-num">No prazo</th>
                            <th scope="col" class="col-num">Cumprimento</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (row of store.sla(); track row.channel) {
                            <tr>
                              <th scope="row">{{ channel(row.channel) }}</th>
                              <td class="col-num t-nowrap">{{ row.considered }}</td>
                              <td class="col-num t-nowrap">{{ row.onTime }}</td>
                              <td class="col-num t-nowrap">{{ percent(row.percent) }}</td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                    <app-formula>
                      Cumprimento = mensagens respondidas dentro do prazo ÷ mensagens do canal × 100.
                      Mensagem ainda dentro do prazo e sem resposta não entra na conta. Prazos úteis
                      (segunda a sexta, das 8:00 às 18:00): aplicativo 24 h, WhatsApp 4 h, telefone
                      imediato, e-mail 48 h.
                    </app-formula>
                  </div>
                </app-card>

                <app-card title="Solicitações do titular (LGPD)">
                  <app-kpi-strip>
                    <app-kpi label="Abertas" [value]="store.dsr().open" link="/app/lgpd/solicitacoes" />
                    <app-kpi label="Vencendo em breve" [value]="store.dsr().dueSoon" link="/app/lgpd/solicitacoes" />
                    <app-kpi label="Vencidas" [value]="store.dsr().overdue" link="/app/lgpd/solicitacoes" />
                  </app-kpi-strip>
                </app-card>
              </div>
            }
          }
        </app-tabs>
      }
    </div>
  `,
})
export class IndicatorsPageComponent {
  protected readonly store = inject(IndicatorsStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly references = CONVERSION_REFERENCES;
  protected readonly windowDays = SERVICE_WINDOW_DAYS;

  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  protected readonly tabItems = computed<TabItem[]>(() =>
    this.store.tabs().map((id) => ({ id, label: INDICATOR_TAB_LABELS[id] })),
  );
  protected readonly tab = computed<IndicatorTab>(() => {
    const wanted = this.query().get('aba');
    const tabs = this.store.tabs();
    return (tabs.find((t) => TAB_SLUG[t] === wanted) ?? tabs[0] ?? 'caregivers') as IndicatorTab;
  });

  protected readonly description = computed(() => {
    switch (this.store.role()) {
      case 'support':
        return 'Prazos de resposta e reclamações. Nada de saúde ou de finanças.';
      case 'psychologist':
        return 'Agregados dos seus casos e a sua ocupação. Recortes com menos de 5 pessoas não aparecem.';
      case 'technical_lead':
        return 'Indicadores clínicos agregados. Recortes com menos de 5 pessoas não aparecem.';
      default:
        return 'People Analytics em três frentes: cuidadores, rede e equipe. Recortes de saúde com menos de 5 pessoas não aparecem.';
    }
  });

  // ===== Cuidadores =====
  protected readonly bandData = computed(() =>
    this.store.bands().map((b) => ({
      label: BAND_SHORT[b.band] ?? b.label,
      value: b.aggregate.sufficient ? b.aggregate.value : null,
      suppressed: !b.aggregate.sufficient,
    })),
  );
  protected readonly bandAria = computed(
    () =>
      `Cuidadores por faixa de sobrecarga: ${this.store
        .bands()
        .map((b) => `${BAND_SHORT[b.band] ?? b.label}, ${this.agg(b.aggregate)}`)
        .join('; ')}`,
  );
  protected readonly evolutionText = computed(() => {
    const e = this.store.evolution();
    if (!e.sufficient) {
      return '';
    }
    return e.value === null ? 'n/d' : formatPercent(e.value, { decimals: 1, signed: true });
  });
  protected readonly sameDayText = computed(() => {
    const p = this.store.sameDay().percent;
    return p === null ? '' : formatPercent(p, { decimals: 1 });
  });
  protected readonly conversionText = computed(() => {
    const v = this.store.conversionPercent();
    return v === null ? 'n/d' : formatPercent(v, { decimals: 1 });
  });
  protected readonly freeText = computed(() => formatNumber(this.store.freeUsers()));

  // ===== Rede =====
  protected readonly ratingText = computed(() => {
    const v = this.store.networkRating();
    return v === null ? 'n/d' : formatNumber(v, 2);
  });
  protected readonly arpData = computed(() =>
    this.store.arpBands().map((b) => ({ label: b.label, value: b.count })),
  );
  protected readonly arpAria = computed(
    () =>
      `Prestadores por faixa: ${this.store
        .arpBands()
        .map((b) => `${b.label} ${b.count}`)
        .join(', ')}`,
  );

  // ===== Equipe =====
  protected readonly lastClosed = computed(
    () => this.store.occupancy()[0]?.months[this.store.occupancy()[0]?.months.length - 1]?.month ?? '',
  );
  private readonly finance = inject(FinanceStore);
  /** A condição de ampliar a equipe só aparece à gestão, que vê os valores em reais. */
  protected readonly resultText = computed(() => formatMoney(this.finance.realized().resultCents));

  protected hoursText(): string {
    const h = this.store.complaints().averageFirstResponseHours;
    return h === null ? 'n/d' : `${formatNumber(h, 1)} h`;
  }

  // ===== Formatação =====
  protected agg(a: Aggregate<number>): string {
    return a.sufficient ? String(a.value) : a.shortLabel;
  }

  protected percent(value: number | null): string {
    return value === null ? 'n/d' : formatPercent(value, { decimals: 1 });
  }

  protected number(value: number | null, decimals: number): string {
    return value === null ? 'n/d' : formatNumber(value, decimals);
  }

  protected channel(key: string): string {
    return CHANNEL_LABEL[key] ?? key;
  }

  protected monthName(yearMonth: string): string {
    return yearMonth ? formatYearMonth(yearMonth) : '';
  }

  protected choose(id: string | undefined): void {
    if (!id) {
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { aba: TAB_SLUG[id as IndicatorTab] ?? id },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
